import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MODULES, modulePolygon, insidePolygon, routeTo } from '../src/layout.js';
import { createWalkable, canWalk, movePlayer } from '../src/navigation.js';
import { interactionBlocked } from '../src/amenities.js';
import { addServiceDetails } from '../src/service-details.js';

const areas = createWalkable();

// The real service meshes and animations are constructed without WebGL. Static
// batches need no rendering for collision, interaction, or lifecycle checks.
function build(t) {
  const root = new THREE.Group(), colliders = [], resources = new Set();
  let parent = root, elapsed = 0;
  const keep = resource => { resources.add(resource); return resource; };
  const mat = options => keep(new THREE.MeshStandardMaterial(options));
  const materials = Object.fromEntries(['hull', 'enamel', 'padding', 'seal', 'graphite', 'silver', 'accent', 'whiteLight', 'blueLight', 'glass'].map(name => [name, mat({ color: 0xdde0d6 })]));
  const painting = new Proxy({}, { get: (target, key) => target[key] || (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
  const addMesh = (geometry, material, destination = parent) => {
    keep(geometry); const mesh = new THREE.Mesh(geometry, material); destination.add(mesh); return mesh;
  };
  const ctx = {
    root, MODULES, colliders, materials, mat, addMesh, box() {}, localBox() {}, roundedFrame() {},
    beginModule(module) { parent = new THREE.Group(); parent.position.y = module.elevation; root.add(parent); return parent; },
    endSection() { parent = root; },
    kit: { pipe() {}, cuboid() {}, bolt() {}, localPipe() {}, localBolt() {},
      toWorld(origin, yaw, [x, y, z]) { return [origin.x + x * Math.cos(yaw) + z * Math.sin(yaw), y, origin.z - x * Math.sin(yaw) + z * Math.cos(yaw)]; } },
    texture(w, h, paint) { paint(painting, w, h); return keep(new THREE.CanvasTexture({ width: w, height: h, getContext: () => painting })); },
    textPlane(map, w, h, x, y, z, yaw, destination = parent) {
      const mesh = addMesh(new THREE.PlaneGeometry(w, h), mat({ map }), destination);
      mesh.position.set(x, y, z); mesh.rotation.y = yaw; return mesh;
    },
  };
  const services = addServiceDetails(ctx);
  root.updateMatrixWorld(true);
  t.after(() => resources.forEach(resource => resource.dispose()));
  return { services, colliders, root,
    device: id => { const result = services.devices.find(device => device.id === id); assert.ok(result, id); return result; },
    advance(seconds, player = { x: 12.5, z: -18.95, layer: 'station' }, motionScale = 1) {
      const steps = Math.ceil(seconds * 60), dt = seconds / steps;
      for (let i = 0; i < steps; i++) { elapsed += dt; services.update(elapsed, dt, player, motionScale); }
    },
  };
}

function walk(from, target, colliders) {
  let position = { x: from.x, z: from.z };
  for (let i = 0; i < 1800; i++) {
    const dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz);
    if (distance < .025) return position;
    const step = Math.min(.045, distance), next = movePlayer(position, dx / distance * step, dz / distance * step, areas, colliders);
    assert.ok(Math.hypot(next.x - position.x, next.z - position.z) > .000001, `Blocked between ${JSON.stringify(position)} and ${JSON.stringify(target)}`);
    position = next;
  }
  assert.fail(`Service approach was not reached: ${JSON.stringify(target)}`);
}

test('service fixtures fit their hulls and every control has a safe, accurate approach', t => {
  const { services, colliders } = build(t);
  for (const collider of colliders) {
    const module = MODULES.find(module => module.id === (collider.id.startsWith('service-floor') ? 'floor' : 'commons'));
    const polygon = modulePolygon(module);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      assert.ok(insidePolygon(collider.x + sx * collider.w / 2, collider.z + sz * collider.d / 2, polygon), `${collider.id} escapes the pressure hull`);
    }
  }
  for (const device of services.devices) {
    assert.ok(canWalk(device.approach.x, device.approach.z, areas, colliders), `${device.id} approach is obstructed`);
    assert.ok(Math.hypot(device.x - device.approach.x, device.z - device.approach.z) < device.range, `${device.id} is out of range`);
    const actual = device.mesh.getWorldPosition(new THREE.Vector3());
    assert.ok(actual.distanceTo(new THREE.Vector3(device.x, device.y, device.z)) < .000001, `${device.id} has incorrect deck height`);
    assert.equal(interactionBlocked(device.approach, device, colliders), false, `${device.id} cannot be used from its own side`);
  }
});

test('privacy leaf blocks movement, clears on command, and cannot close on an occupant', t => {
  const { services, colliders, device, advance } = build(t), door = services.doors[0];
  const outside = { x: door.x, z: door.z - .85, layer: 'station' };
  const stopped = movePlayer(outside, 0, 1.8, areas, colliders);
  assert.ok(stopped.z < door.z - .30, 'A long movement cannot pass a closed door');
  advance(.5, outside);
  assert.equal(door.openness, 0, 'A closed privacy door does not automatically open merely because someone approaches');
  device('service-bath-door').activate(); advance(.03, outside);
  assert.equal(door.collider.disabled, false, 'The leaf still blocks the aperture while opening');
  advance(1.5, outside); assert.equal(door.collider.disabled, true);
  walk(outside, { x: door.x, z: door.z + .8 }, colliders);
  device('service-bath-door-inside').activate();
  advance(2, { x: door.x, z: door.z, layer: 'station' });
  assert.ok(door.openness > .95); assert.equal(door.collider.disabled, true, 'The occupied sill holds open');
  advance(2, outside);
  assert.ok(door.openness < .01); assert.equal(door.collider.disabled, false);
});

test('inside and outside privacy controls have separate hit points behind real partitions', t => {
  const { services, colliders, device, advance } = build(t);
  const outer = device('service-bath-door'), inner = device('service-bath-door-inside');
  assert.notEqual(outer.mesh, inner.mesh);
  assert.equal(outer.sound, 'door-open'); assert.equal(inner.sound, 'door-open');
  assert.equal(interactionBlocked(outer.approach, outer, colliders), false);
  assert.equal(interactionBlocked(inner.approach, inner, colliders), false);
  assert.equal(interactionBlocked(outer.approach, inner, colliders), true, 'The inner switch is not usable through the partition');
  assert.equal(interactionBlocked(inner.approach, outer, colliders), true, 'The outer switch is not usable through the partition');
  const door = services.doors[0], from = { x: door.x, z: door.z - .7 }, to = { x: door.x, z: door.z + .7 };
  assert.equal(interactionBlocked(from, to, colliders), true);
  outer.activate(); advance(1.5);
  assert.equal(interactionBlocked(from, to, colliders), false, 'Opening the actual leaf restores line of sight');
  assert.deepEqual(inner.state, outer.state, 'Both switches control the same physical door');
});

test('bathroom fixtures and machinery can be approached and left using physical movement', t => {
  const { colliders, device, advance } = build(t);
  let position = walk({ x: 11.5, z: -22 }, { x: 12.5, z: -18.95 }, colliders);
  device('service-bath-door').activate(); advance(1.5, position);
  position = walk(position, { x: 12.5, z: -17.35 }, colliders);
  for (const id of ['service-bath-door-inside', 'service-bath-wash', 'service-bath-flush']) position = walk(position, device(id).approach, colliders);
  position = walk(position, { x: 12.5, z: -17.35 }, colliders);
  position = walk(position, { x: 12.5, z: -18.95 }, colliders);
  walk(position, { x: 11.5, z: -22 }, colliders);
  const machinery = device('service-floor-cooling').approach;
  walk({ x: -11, z: -11 }, machinery, colliders); walk(machinery, { x: -11, z: -11 }, colliders);
});

test('metered washing shows water, completes once, and stops updating its display while idle', t => {
  const { root, device, advance } = build(t), control = device('service-bath-wash');
  const hidden = []; root.traverse(object => { if (object.isMesh && !object.visible) hidden.push(object); });
  assert.ok(hidden.length, 'A real water-stream mesh starts hidden');
  control.activate(); control.activate();
  assert.equal(control.state.cycles, 1, 'Repeated input cannot restart an active metered cycle');
  assert.ok(hidden.some(mesh => mesh.visible));
  const runningVersion = control.mesh.material.map.version;
  advance(1, undefined, 0);
  assert.equal(control.state.active, true);
  assert.equal(control.mesh.material.map.version, runningVersion, 'No per-frame canvas upload is needed');
  advance(5, undefined, 0);
  assert.equal(control.state.active, false); assert.equal(control.state.reclaimedLitres, .18);
  assert.ok(hidden.every(mesh => !mesh.visible));
  const idleVersion = control.mesh.material.map.version; advance(2);
  assert.equal(control.mesh.material.map.version, idleVersion);
});

test('vacuum sanitation seals its lid, transfers, purges, and returns ready under reduced motion', t => {
  const { device, advance } = build(t), control = device('service-bath-flush');
  const initialAngle = control.state.lidAngle;
  control.activate(); control.activate();
  assert.equal(control.state.cycles, 1);
  assert.equal(control.state.phase, 'SEALING LID');
  advance(.55, undefined, 0);
  assert.ok(Math.abs(control.state.lidAngle) < Math.abs(initialAngle) / 3, 'The visible lid closes');
  advance(.5, undefined, 0); assert.equal(control.state.phase, 'VACUUM TRANSFER');
  advance(1.75, undefined, 0); assert.equal(control.state.phase, 'AIR PURGE');
  advance(1.6, undefined, 0);
  assert.equal(control.state.active, false); assert.equal(control.state.phase, 'READY');
  assert.ok(control.state.lidAngle < -1, 'The toilet is ready with its lid open again');
  const version = control.mesh.material.map.version; advance(2);
  assert.equal(control.mesh.material.map.version, version);
});

test('environmental plant cycles cooling, purge and standby without continuous display uploads', t => {
  const { device, advance } = build(t), control = device('service-floor-cooling');
  assert.equal(control.state.mode, 'CABIN COOLING');
  const coolingSpeed = control.state.fanSpeed, version = control.mesh.material.map.version;
  advance(1); assert.equal(control.mesh.material.map.version, version);
  control.activate(); assert.equal(control.state.mode, 'FILTER PURGE'); assert.ok(control.state.fanSpeed > coolingSpeed);
  control.activate(); assert.equal(control.state.mode, 'STANDBY'); assert.equal(control.state.fanSpeed, 0);
  control.activate(); assert.equal(control.state.mode, 'CABIN COOLING');
  assert.equal(control.state.activations, 3);
});

test('service collision footprints preserve all department navigation routes', t => {
  const { colliders } = build(t);
  for (const from of MODULES) for (const to of MODULES) {
    let position = { ...from.approach }, arrived = false;
    for (let i = 0; i < 1800; i++) {
      const route = routeTo(position, to.id), next = route[0]; assert.ok(next);
      const dx = next.x - position.x, dz = next.z - position.z, distance = Math.hypot(dx, dz);
      if (route.length === 1 && distance < .1) { arrived = true; break; }
      const step = Math.min(.065, distance), moved = movePlayer(position, dx / distance * step, dz / distance * step, areas, colliders);
      assert.ok(Math.hypot(moved.x - position.x, moved.z - position.z) > .000001, `${from.id} → ${to.id} is blocked by service equipment`);
      position = moved;
    }
    assert.ok(arrived, `${from.id} → ${to.id} did not arrive`);
  }
});
