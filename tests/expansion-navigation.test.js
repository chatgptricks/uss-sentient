import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MODULES } from '../src/layout.js';
import { AIRLOCK, CUPOLA, CUPOLA_AREAS, EXTENSION_AREAS, expansionZone } from '../src/expansion-layout.js';
import { PLAYER_RADIUS, createWalkable, canWalk, movePlayer } from '../src/navigation.js';
import { addExpansion } from '../src/expansion.js';

const station = [...createWalkable(), ...EXTENSION_AREAS];
function walk(from, target, areas = station, colliders = []) {
  let position = { ...from };
  for (let i = 0; i < 1200; i++) {
    const dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz);
    if (distance < .001) return position;
    const step = Math.min(.10, distance);
    position = movePlayer(position, dx / distance * step, dz / distance * step, areas, colliders);
  }
  assert.fail(`Cannot reach ${JSON.stringify(target)} from ${JSON.stringify(from)}; stopped at ${JSON.stringify(position)}`);
}

// Build actual expansion geometry without creating a WebGL renderer. Batched
// boxes/pipes are recorded so the visible rails can be checked against routes.
function build() {
  const root = new THREE.Group(), boxes = [], pipes = [];
  const mat = options => new THREE.MeshStandardMaterial(options);
  const materials = Object.fromEntries(['hull', 'enamel', 'padding', 'graphite', 'silver', 'accent', 'whiteLight'].map(name => [name, mat({ color: 0xbac4bb })]));
  const painting = new Proxy({}, { get: (target, key) => target[key] || (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
  const addMesh = (geometry, material, parent = root) => { const mesh = new THREE.Mesh(geometry, material); parent.add(mesh); return mesh; };
  const ctx = {
    root, MODULES, materials, mat, endSection() {}, addMesh,
    box(x, y, z, w, h, d, material, yaw = 0) { boxes.push({ x, y, z, w, h, d, material, yaw }); },
    kit: { pipe(a, b, radius, material) { pipes.push({ a, b, radius, material }); }, cuboid() {}, bolt() {},
      toWorld(origin,yaw,[x,y,z]) { return [origin.x+x*Math.cos(yaw)+z*Math.sin(yaw),y,origin.z-x*Math.sin(yaw)+z*Math.cos(yaw)]; } },
    texture(w, h, paint) { paint(painting, w, h); return new THREE.CanvasTexture({ width: w, height: h, getContext: () => painting }); },
    textPlane(map, w, h, x, y, z, yaw, parent = root) {
      const mesh = addMesh(new THREE.PlaneGeometry(w, h), mat({ map }), parent);
      mesh.position.set(x, y, z); mesh.rotation.y = yaw || 0; return mesh;
    },
    roundedFrame() {},
  };
  return { expansion: addExpansion(ctx), boxes, pipes, root, materials };
}

test('the lower cupola has an independent bounded XZ layer beneath the Forum', () => {
  assert.ok(CUPOLA.elevation < -3);
  assert.ok(canWalk(CUPOLA.hatch.x, CUPOLA.hatch.z, station));
  assert.ok(canWalk(CUPOLA.hatch.x, CUPOLA.hatch.z, CUPOLA_AREAS));
  assert.equal(expansionZone(CUPOLA.hatch, 'station'), 'station');
  assert.equal(expansionZone(CUPOLA.hatch, 'cupola'), 'cupola');
  const lower = movePlayer(CUPOLA.hatch, 30, 0, CUPOLA_AREAS);
  assert.ok(Math.hypot(lower.x - CUPOLA.x, lower.z - CUPOLA.z) <= CUPOLA.radius - PLAYER_RADIUS + .015);
  assert.equal(canWalk(0, -26, CUPOLA_AREAS), false, 'The Forum north tube does not exist on the lower deck');
  assert.ok(canWalk(0, -26, station), 'The same XZ point is a real tube on the station deck');
  for (const [x, z] of [[1.8, -22], [-1.8, -22], [0, -20.1], [0, -23.9]]) walk(CUPOLA.hatch, { x, z }, CUPOLA_AREAS);
  for (let i = 0; i < 32; i++) {
    const angle = i * Math.PI / 16;
    assert.equal(canWalk(CUPOLA.x + Math.cos(angle) * CUPOLA.radius, CUPOLA.z + Math.sin(angle) * CUPOLA.radius, CUPOLA_AREAS), false);
  }
});

test('Arrival, airlock, exterior junction and both lookout sides form a continuous route', () => {
  let position = { x: 0, z: 0 };
  for (const target of [{ x: 3.5, z: 0 }, { x: 6.65, z: 0 }, { x: 9.6, z: 0 }, { x: 17, z: 0 }, { x: 17, z: -31 }, { x: 15.1, z: -31 }, { x: 19, z: -31 }, { x: 17, z: -31 }, { x: 17, z: -35.5 }]) position = walk(position, target);
  assert.equal(expansionZone({ x: 6.65, z: 0 }), 'airlock');
  assert.equal(expansionZone({ x: 17, z: -31 }), 'exterior');
  assert.equal(expansionZone({ x: 15.1, z: -31 }), 'exterior', 'The left lookout wing keeps EVA height and atmosphere');
  assert.equal(expansionZone({ x: 11.5, z: -22 }), 'station', 'Commons remains on its raised station deck');
  for (const [x, z] of [[12, 1.01], [17.95, -17], [20, -31], [17, -36.2], [14, -26]]) assert.equal(canWalk(x, z, station), false, 'Space beside the gantry is not a floor');
  for (const vector of [[50, 0], [-50, 0], [0, 50], [0, -50]]) {
    const stopped = movePlayer({ x: 17, z: -17 }, ...vector, station);
    assert.ok(canWalk(stopped.x, stopped.z, station));
    assert.ok(stopped.x >= 16.1 + PLAYER_RADIUS - .01 && stopped.x <= 17.9 - PLAYER_RADIUS + .01);
  }
});

test('rendered EVA floors match walkable limits and railings never cross a valid passage', () => {
  const { boxes, pipes } = build();
  const decks = boxes.filter(b => b.y < 0 && b.y > -.3 && b.x > 8.7);
  for (let x = 8.8; x <= 19.2; x += .2) for (let z = -35.8; z <= .8; z += .2) {
    if (!canWalk(x, z, EXTENSION_AREAS)) continue;
    assert.ok(decks.some(b => Math.abs(x - b.x) <= b.w / 2 + .001 && Math.abs(z - b.z) <= b.d / 2 + .001), `No floating walkable point at ${x},${z}`);
  }
  const rails = pipes.filter(p => p.a[1] === 1.02 && p.b[1] === 1.02);
  assert.ok(rails.length >= 12, 'Exterior boundary has guardrails');
  for (const rail of rails) for (const fraction of [.2, .5, .8]) {
    const x = rail.a[0] + (rail.b[0] - rail.a[0]) * fraction, z = rail.a[2] + (rail.b[2] - rail.a[2]) * fraction;
    assert.equal(canWalk(x, z, station), false, `Guardrail intersects walkable interior at ${x},${z}`);
  }
});

test('airlock doors slide away from the aisle and pressure cycling respects an occupied sill', () => {
  const { expansion } = build(), cycle = expansion.devices.find(d => d.id === 'airlock-cycle');
  expansion.update(0, .016, { x: 6.65, z: 0 });
  const [inner, outer] = expansion.doors;
  assert.ok(inner.left.position.x < 0 && inner.right.position.x > 0);
  assert.equal(inner.collider.disabled, true); assert.equal(outer.collider.disabled, false);
  const blocked = movePlayer({ x: 6.65, z: 0 }, 4, 0, station, expansion.colliders);
  assert.ok(blocked.x < AIRLOCK.outerX - PLAYER_RADIUS);
  cycle.activate();
  for (let i = 0; i < 80; i++) expansion.update(i * .05, .05, { x: AIRLOCK.innerX, z: 0 });
  assert.equal(expansion.airlock.phase, 0); assert.equal(inner.openness, 1, 'No closing leaf can sweep through a player on the sill');
  for (let i = 0; i < 110; i++) expansion.update(i * .05, .05, { x: 6.65, z: 0 });
  assert.equal(expansion.airlock.mode, 'vacuum'); assert.equal(expansion.airlock.pressure, 0);
  assert.equal(inner.collider.disabled, false); assert.equal(outer.collider.disabled, true);
  assert.ok(inner.openness < .001 && outer.openness > .99);
  walk({ x: 6.65, z: 0 }, { x: 9.6, z: 0 }, station, expansion.colliders);
  cycle.activate();
  for (let i = 0; i < 110; i++) expansion.update(i * .05, .05, { x: 6.65, z: 0 });
  assert.equal(expansion.airlock.mode, 'pressurized'); assert.equal(expansion.airlock.pressure, 101.3);
  assert.equal(inner.collider.disabled, true); assert.equal(outer.collider.disabled, false);
  assert.equal(cycle.y, cycle.mesh.position.y, 'Device aiming coordinates match the visible pressure screen');
});

test('station-side call recovers an abandoned outbound cycle without a pressure jump', () => {
  const { expansion } = build(), cycle = expansion.devices.find(d => d.id === 'airlock-cycle'), call = expansion.devices.find(d => d.id === 'airlock-call');
  assert.ok(call, 'A station-side recovery control exists');
  const sill = { x: 4.9, z: -.55 }, stationSide = { x: 3.8, z: -.55 };
  assert.ok(Math.hypot(sill.x-cycle.x,sill.z-cycle.z)<cycle.range, 'The interrupted-cycle case is reachable');
  expansion.update(0,.016,sill);cycle.activate();
  for(let i=0;i<15;i++)expansion.update(i*.05,.05,sill);
  assert.equal(expansion.airlock.phase,0);
  walk(sill,stationSide,station,expansion.colliders);
  for(let i=0;i<110;i++)expansion.update(i*.05,.05,stationSide);
  assert.equal(expansion.airlock.mode,'vacuum');assert.equal(expansion.doors[0].collider.disabled,false);
  assert.equal(expansionZone(stationSide),call.zone);
  assert.ok(Math.hypot(stationSide.x-call.x,stationSide.z-call.z)<call.range);
  call.activate();
  assert.equal(expansion.airlock.mode,'cycling-in');assert.equal(expansion.airlock.pressure,0);
  for(let i=0;i<100;i++)expansion.update(i*.05,.05,stationSide);
  assert.equal(expansion.airlock.mode,'pressurized');assert.equal(expansion.doors[0].collider.disabled,true);
  walk(stationSide,{x:6.65,z:0},station,expansion.colliders);
  cycle.activate();
  for(let i=0;i<42;i++)expansion.update(i*.05,.05,stationSide);
  const partial=expansion.airlock.pressure;
  assert.ok(partial>0&&partial<101.3);
  call.activate();assert.equal(expansion.airlock.pressure,partial);
  expansion.update(2.1,.05,stationSide);
  assert.ok(expansion.airlock.pressure>partial&&expansion.airlock.pressure<partial+2,'Reversal resumes smoothly from current pressure');
});

test('cupola equipment has local collision bounds while ladder access stays clear', () => {
  const { expansion } = build();
  assert.equal(expansion.cupolaColliders.length,4);
  for(const c of expansion.cupolaColliders)assert.equal(canWalk(c.x,c.z,CUPOLA_AREAS,expansion.cupolaColliders),false);
  walk({x:0,z:-20.6},CUPOLA.hatch,CUPOLA_AREAS,expansion.cupolaColliders);
  walk({x:-1.6,z:-22},CUPOLA.hatch,CUPOLA_AREAS,expansion.cupolaColliders);
  walk(CUPOLA.hatch,{x:1,z:-20.8},CUPOLA_AREAS,expansion.cupolaColliders);
  for(const fixture of expansion.cupolaColliders)for(const dx of [-1,1])for(const dz of [-1,1]) {
    assert.ok(Math.hypot(fixture.x+dx*fixture.w/2,fixture.z+dz*fixture.d/2-CUPOLA.z)<2.76,`${fixture.id} has a floor beneath its complete footprint`);
  }
  assert.ok(expansion.colliders.every(c=>!c.id.startsWith('cupola-')),'Lower-deck fixtures never block the Forum above');
});

test('the fitted observatory cycles visible spectral instruments without uploading screens every frame', () => {
  const { expansion, root } = build(), survey=expansion.devices.find(d=>d.id==='cupola-survey');
  assert.equal(expansion.stats.cupola.arches,8);assert.equal(expansion.stats.cupola.perches,2);
  assert.ok(expansion.stats.cupola.windowFasteners>=64);
  const arches=root.getObjectByName('Cupola / tapered pressure arches');
  assert.ok(arches?.geometry.attributes.position.count>1000,'Substantial arches are one merged geometry');
  const screen=survey.mesh.material.map, initial=survey.state(), initialVersion=screen.version;
  for(let i=0;i<30;i++)expansion.update(i*.05,.05,{x:0,z:CUPOLA.z,layer:'cupola'});
  assert.equal(screen.version,initialVersion);
  const modes=new Set([initial.mode]);
  for(let step=0;step<3;step++) {
    const before=survey.state(),message=survey.activate();
    assert.ok(!/ocean|71%/i.test(message));assert.match(message,/Pelagia/);
    const state=survey.state();modes.add(state.mode);
    assert.equal(state.count,before.count+1);assert.equal(state.canvasRevision,before.canvasRevision+1);
    assert.notEqual(state.canvasState,before.canvasState);
    const version=screen.version;
    for(let i=0;i<30;i++)expansion.update(i*.05,.05,{x:0,z:CUPOLA.z,layer:'cupola'});
    assert.equal(screen.version,version,'Instrument motion never uploads a new screen texture');
    assert.notEqual(survey.state().heading,before.heading,'The actual survey instrument changes orientation');
  }
  assert.equal(modes.size,3);
  assert.equal(survey.state().mode,initial.mode);
});

test('the cupola has a transparent downward view and an unobstructed ladder aperture', () => {
  const { root, materials, expansion } = build(); root.updateMatrixWorld(true);
  const glassDeck = root.children.find(m => m.geometry?.type === 'CircleGeometry');
  assert.ok(glassDeck && glassDeck.material.transparent && glassDeck.material.opacity < .1);
  assert.equal(glassDeck.position.y, CUPOLA.elevation);
  const ray = new THREE.Raycaster(new THREE.Vector3(1.4, CUPOLA.elevation + 1.6, CUPOLA.z), new THREE.Vector3(0, -1, 0));
  const first = ray.intersectObjects(root.children, true)[0];
  assert.equal(first.object, glassDeck, 'A view down beside the landing pad first encounters glass, not an opaque deck');
  const shaft = root.children.find(m => m.geometry?.type === 'CylinderGeometry' && m.geometry.parameters.radiusTop === .81);
  const bottom = shaft.position.y - shaft.geometry.parameters.height / 2;
  assert.ok(bottom > CUPOLA.elevation + 1.6, 'Opaque shaft ends above the cupola eye line');
  assert.equal(materials.enamel.side, THREE.FrontSide, 'Making the shaft double-sided does not mutate shared station enamel');
  expansion.hatch.open = true;
  for (let i = 0; i < 100; i++) expansion.update(i * .05, .05, { x: 0, z: -22 });
  root.updateMatrixWorld(true);
  const downShaft = new THREE.Raycaster(new THREE.Vector3(CUPOLA.hatch.x + .4, .6, CUPOLA.hatch.z + .2), new THREE.Vector3(0, -1, 0));
  const shaftHits = downShaft.intersectObjects(root.children, true);
  assert.ok(shaftHits.length > 0);
  assert.ok(shaftHits[0].point.y < -4, 'Open hatch does not conceal a glass cap or an opaque surface in the ladder path');
});
