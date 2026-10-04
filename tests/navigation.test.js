import test from 'node:test';
import assert from 'node:assert/strict';
import { rooms } from '../src/rooms.js';
import { MODULES, LINKS, modulePolygon, insidePolygon, routeTo, surfaceHeight } from '../src/layout.js';
import { PLAYER_RADIUS, START, createWalkable, canWalk, movePlayer, readProgress } from '../src/navigation.js';

const areas = createWalkable(rooms);

function walkTo(from, destination, colliders = []) {
  let position = { ...from };
  for (let frame = 0; frame < 1000; frame++) {
    const dx = destination.x - position.x, dz = destination.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.001) return position;
    const step = Math.min(distance, 0.12);
    position = movePlayer(position, dx / distance * step, dz / distance * step, areas, colliders);
    assert.ok(canWalk(position.x, position.z, areas, colliders), 'Every route movement frame remains inside the pressure hull');
  }
  assert.fail(`Blocked route to (${destination.x},${destination.z}) at (${position.x},${position.z})`);
}

test('all seven compact modules and their terminal approaches match the shared hull plan', () => {
  assert.equal(rooms.length, 7);
  assert.equal(new Set(rooms.map(room => room.id)).size, 7);
  assert.ok(canWalk(START.x, START.z, areas));
  for (const room of rooms) {
    const module = MODULES.find(module => module.id === room.id);
    assert.deepEqual([room.x, room.z, room.terminal, room.approach], [module.x, module.z, module.terminal, module.approach]);
    assert.equal(modulePolygon(module).length, 8);
    assert.ok(insidePolygon(module.approach.x, module.approach.z, modulePolygon(module)));
    assert.ok(canWalk(room.approach.x, room.approach.z, areas));
  }
});

test('every module is independently reachable through the compact floor plan', () => {
  const step = 0.25, queue = [{ x: 0, z: 0 }], seen = new Set(['0,0']);
  for (let i = 0; i < queue.length; i++) {
    const here = queue[i];
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const x = here.x + dx, z = here.z + dz, key = `${x},${z}`;
      if (!seen.has(key) && canWalk(x, z, areas)) {
        seen.add(key); queue.push({ x, z });
        assert.ok(queue.length < 15000, 'Walkable cells cannot escape into unbounded space');
      }
    }
  }
  for (const room of rooms) {
    assert.ok(seen.has(`${room.x},${room.z}`), room.name);
    assert.ok(queue.some(point => Math.hypot(point.x - room.approach.x, point.z - room.approach.z) < 0.2), `${room.name} terminal approach`);
  }
});

test('all-pairs guidance routes lead through real doorways to terminal approaches', () => {
  for (const origin of MODULES) {
    for (const destination of MODULES) {
      let position = { ...origin.approach };
      const route = routeTo(position, destination.id);
      assert.ok(route.length > 0 && route.length <= MODULES.length * 3);
      for (const waypoint of route) position = walkTo(position, waypoint);
      assert.ok(Math.hypot(position.x - destination.approach.x, position.z - destination.approach.z) < 0.001, `${origin.id} → ${destination.id}`);
    }
  }
});

test('guidance also works when a destination is selected inside any connecting tube', () => {
  for (const link of LINKS) {
    const start = { x: (link.a.x + link.b.x) / 2, z: (link.a.z + link.b.z) / 2 };
    for (const destination of MODULES) {
      let position = { ...start };
      const route = routeTo(position, destination.id);
      assert.ok(route.length > 0);
      for (const waypoint of route) position = walkTo(position, waypoint);
      assert.ok(Math.hypot(position.x - destination.approach.x, position.z - destination.approach.z) < 0.001);
    }
  }
  assert.deepEqual(routeTo(START, 'unknown'), []);
  assert.deepEqual(routeTo({ x: 100, z: 100 }, 'bridge'), []);
});

test('live guidance can be recalculated every movement frame without cutting through hull corners', () => {
  for (const origin of MODULES) for (const goal of MODULES) {
    let position = { ...origin.approach };
    for (let frame = 0; frame < 1600 && Math.hypot(position.x - goal.approach.x, position.z - goal.approach.z) > 0.02; frame++) {
      const waypoint = routeTo(position, goal.id)[0];
      assert.ok(waypoint);
      const dx = waypoint.x - position.x, dz = waypoint.z - position.z, distance = Math.hypot(dx, dz);
      const step = Math.min(distance, 0.08);
      position = movePlayer(position, dx / distance * step, dz / distance * step, areas);
      assert.ok(canWalk(position.x, position.z, areas));
    }
    assert.ok(Math.hypot(position.x - goal.approach.x, position.z - goal.approach.z) <= 0.02, `Live route ${origin.id} → ${goal.id}`);
  }
});

test('tube-to-module seams stay open while tube walls reject body clipping', () => {
  for (const link of LINKS) {
    const dx = Math.sign(link.b.x - link.a.x), dz = Math.sign(link.b.z - link.a.z);
    for (const endpoint of [link.a, link.b]) {
      for (const offset of [-0.2, 0, 0.2]) assert.ok(canWalk(endpoint.x + dx * offset, endpoint.z + dz * offset, areas), link.id);
    }
    const middle = { x: (link.a.x + link.b.x) / 2, z: (link.a.z + link.b.z) / 2 };
    assert.ok(canWalk(middle.x, middle.z, areas));
    for (const sign of [-1, 1]) {
      assert.equal(canWalk(middle.x + dz * sign * link.width / 2, middle.z + dx * sign * link.width / 2, areas), false, `${link.id} wall`);
    }
  }
});

test('octagonal chamfers and unconnected hull faces are solid', () => {
  for (const module of MODULES) {
    const polygon = modulePolygon(module);
    const extentX = Math.max(...polygon.map(point => Math.abs(point.x - module.x)));
    const extentZ = Math.max(...polygon.map(point => Math.abs(point.z - module.z)));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      assert.equal(canWalk(module.x + sx * (extentX - 0.1), module.z + sz * (extentZ - 0.1), areas), false, `${module.id} corner`);
    }
    for (const [port, dx, dz] of [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]]) {
      if (!module.ports.includes(port)) assert.equal(canWalk(module.x + dx * extentX, module.z + dz * extentZ, areas), false, `${module.id} ${port}`);
    }
  }
  for (const point of [{ x: 100, z: 100 }, { x: 5, z: -5 }, { x: -5, z: -15 }, { x: 10, z: -10 }]) {
    assert.equal(canWalk(point.x, point.z, areas), false, 'No floor exists between disconnected hull volumes');
  }
});

test('movement slides along narrow tubes and cannot tunnel out of the station', () => {
  const link = LINKS.find(link => link.from === 'front-door');
  const center = { x: (link.a.x + link.b.x) / 2, z: (link.a.z + link.b.z) / 2 };
  const next = movePlayer({ x: center.x + 0.2, z: center.z }, 1, -1, areas);
  assert.ok(next.x >= center.x + 0.2 && next.x <= center.x + (link.width - .45) / 2 - PLAYER_RADIUS + 0.001);
  assert.ok(Math.abs(next.z - (center.z - 1)) < 0.001, 'Unblocked movement continues along the tube');
  const escaped = movePlayer({ x: 0, z: 0 }, 0, 50, areas);
  const arrival = MODULES.find(module => module.id === 'front-door');
  const southWall = Math.max(...modulePolygon(arrival).map(point => point.z));
  assert.ok(escaped.z < southWall - PLAYER_RADIUS + 0.001);
  assert.ok(escaped.z > southWall - PLAYER_RADIUS - 0.2);
  assert.ok(canWalk(escaped.x, escaped.z, areas));
});

test('unequal modules use their own footprint and all four deck elevations', () => {
  assert.ok(new Set(MODULES.map(module => `${module.hx},${module.hz}`)).size >= 6);
  assert.ok(MODULES.some(module => module.hx !== module.hz));
  assert.deepEqual([...new Set(MODULES.map(module => module.elevation))].sort((a, b) => a - b), [-1.05, 0, .75, 1.5]);
  for (const module of MODULES) {
    assert.equal(surfaceHeight(module), module.elevation, `${module.id} center elevation`);
    assert.equal(surfaceHeight(module.approach), module.elevation, `${module.id} terminal approach elevation`);
    assert.equal(surfaceHeight(module.terminal), module.elevation, `${module.id} console floor elevation`);
  }
});

test('stair and ramp heights meet both decks and change monotonically in both directions', () => {
  assert.equal(LINKS.filter(link => link.kind === 'stairs').length, 3);
  assert.equal(LINKS.filter(link => link.kind === 'ramp').length, 1);
  for (const link of LINKS) {
    const heights = Array.from({ length: 201 }, (_, index) => surfaceHeight({
      x: link.a.x + (link.b.x - link.a.x) * index / 200,
      z: link.a.z + (link.b.z - link.a.z) * index / 200,
    }));
    assert.ok(Math.abs(heights[0] - link.elevationA) < 1e-8, `${link.id} first landing`);
    assert.ok(Math.abs(heights.at(-1) - link.elevationB) < 1e-8, `${link.id} last landing`);
    for (const sequence of [heights, [...heights].reverse()]) {
      const direction = Math.sign(sequence.at(-1) - sequence[0]);
      for (let index = 1; index < sequence.length; index++) {
        const delta = sequence[index] - sequence[index - 1];
        assert.ok(direction * delta >= -1e-8, `${link.id} never reverses slope`);
        assert.ok(Math.abs(delta) <= .151, `${link.id} never introduces a tall step`);
      }
    }
    if (link.kind === 'level') assert.ok(heights.every(height => height === link.elevationA));
    if (link.kind === 'ramp') {
      assert.ok(Math.abs(heights[100] - (link.elevationA + link.elevationB) / 2) < 1e-8, `${link.id} ramp midpoint`);
    }
  }
});

test('large movements stop at thin closed colliders and cross disabled open colliders', () => {
  const testArea = [{ x: 0, z: 0, w: 30, d: 20 }];
  const obstacle = { x: 0, z: 0, w: 0.05, d: 8 };
  const stopped = movePlayer({ x: -6, z: 0 }, 12, 0, testArea, [obstacle]);
  assert.ok(stopped.x < -0.025 - PLAYER_RADIUS && stopped.x > -0.6);
  assert.equal(canWalk(0, 0, testArea, [obstacle]), false);
  const passed = movePlayer({ x: -6, z: 0 }, 12, 0, testArea, [{ ...obstacle, disabled: true }]);
  assert.ok(Math.abs(passed.x - 6) < 0.001);
  assert.equal(canWalk(0, 0, testArea, [{ ...obstacle, disabled: true }]), true);
});

test('prop corners allow sliding on the unobstructed axis', () => {
  const testArea = [{ x: 0, z: 0, w: 30, d: 30 }];
  const obstacle = [{ x: 0, z: 0, w: 2, d: 10 }];
  const next = movePlayer({ x: -2, z: 0 }, 3, 3, testArea, obstacle);
  assert.ok(next.x < -1 - PLAYER_RADIUS);
  assert.ok(Math.abs(next.z - 3) < 0.001);
  assert.ok(canWalk(next.x, next.z, testArea, obstacle));
});

test('saved progress accepts known rooms and discards duplicate or unrelated data', () => {
  const storage = { getItem(key) {
    assert.equal(key, 'uss-sentient-expedition-v1');
    return JSON.stringify(['floor', 'bridge', 'floor', 'unknown', null, {}, 7, 'archive']);
  } };
  assert.deepEqual([...readProgress(storage, rooms)], ['floor', 'bridge', 'archive']);
});

test('missing, malformed or unavailable storage starts a fresh expedition', () => {
  for (const value of [null, '', '{not-json', 'null', '{}', '42', '"bridge"', 'true', '[]']) {
    assert.equal(readProgress({ getItem: () => value }, rooms).size, 0, String(value));
  }
  assert.equal(readProgress({ getItem() { throw new Error('Storage is blocked'); } }, rooms).size, 0);
  assert.equal(readProgress(undefined, rooms).size, 0);
});
