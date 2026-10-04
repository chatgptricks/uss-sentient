import test from 'node:test';
import assert from 'node:assert/strict';
import { rooms } from '../src/rooms.js';
import { PLAYER_RADIUS, START, createWalkable, canWalk, movePlayer, readProgress } from '../src/navigation.js';

const areas = createWalkable(rooms);

function walkTo(from, destination) {
  let position = { ...from };
  for (let frame = 0; frame < 1200; frame++) {
    const dx = destination.x - position.x;
    const dz = destination.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.001) return position;
    const step = Math.min(distance, 0.24);
    position = movePlayer(position, dx / distance * step, dz / distance * step, areas);
    assert.ok(canWalk(position.x, position.z, areas), 'Every simulated movement frame stays inside the station');
  }
  assert.fail(`Route became stuck approaching (${destination.x}, ${destination.z}) from (${position.x}, ${position.z})`);
}

test('all seven rooms can be visited and exited from the observation-deck entrance', () => {
  assert.equal(rooms.length, 7);
  assert.ok(canWalk(START.x, START.z, areas));
  for (const room of rooms) {
    let position = walkTo(START, { x: 0, z: room.z });
    position = walkTo(position, { x: room.x, z: room.z });
    // Reach the far half of each room, then retrace the doorway to the starting deck.
    position = walkTo(position, { x: room.x, z: room.z - 5 });
    position = walkTo(position, { x: room.x, z: room.z });
    position = walkTo(position, { x: 0, z: room.z });
    position = walkTo(position, START);
    assert.ok(Math.hypot(position.x - START.x, position.z - START.z) < 0.001, room.name);
  }
});

test('doorway seams are traversable on both sides of all six side rooms', () => {
  for (const room of rooms.filter(room => room.x !== 0)) {
    const direction = Math.sign(room.x);
    const innerWall = Math.abs(room.x) - room.w / 2;
    const connectorCenter = (6 + innerWall) / 2;
    for (const distance of [5.5, 5.9, 6.1, connectorCenter, innerWall - 0.1, innerWall + 0.1, innerWall + 0.5]) {
      assert.ok(canWalk(direction * distance, room.z, areas), `${room.name}: seam at ${direction * distance}`);
    }
    assert.ok(canWalk(direction * connectorCenter, room.z + 1.7, areas), 'Door opening has useful width');
    assert.equal(canWalk(direction * connectorCenter, room.z + 2.3, areas), false, 'Player cannot clip the upper door frame');
    assert.equal(canWalk(direction * connectorCenter, room.z - 2.3, areas), false, 'Player cannot clip the lower door frame');
  }
});

test('outer station walls and spaces between room wings block movement', () => {
  for (const point of [
    { x: 0, z: 39 }, { x: 0, z: -62 },
    { x: 12, z: -53 }, { x: -12, z: -53 },
    { x: 6, z: 0 }, { x: -6, z: 0 },
    { x: 18, z: 11 }, { x: -18, z: -25 },
    ...rooms.filter(room => room.x !== 0).map(room => ({ x: room.x + Math.sign(room.x) * room.w / 2, z: room.z })),
    { x: 100, z: 100 },
  ]) {
    assert.equal(canWalk(point.x, point.z, areas), false, JSON.stringify(point));
  }
});

test('the enclosed observation deck joins the central corridor without a collision seam', () => {
  for (const point of [
    { x: 0, z: -43.8 }, { x: 0, z: -44.2 },
    { x: 0, z: -46.9 }, { x: 0, z: -47.1 },
    { x: 11.5, z: -53 }, { x: -11.5, z: -53 },
    { x: 0, z: -61.5 },
  ]) {
    assert.ok(canWalk(point.x, point.z, areas), JSON.stringify(point));
  }
  const next = movePlayer({ x: 0, z: -53 }, 0, -20, areas);
  assert.ok(next.z > -62 + PLAYER_RADIUS, 'The observation window remains a solid boundary');
  assert.ok(next.z < -61.5);
});

test('diagonal movement slides along a corridor wall instead of freezing', () => {
  const next = movePlayer({ x: 5.4, z: 0 }, 2, 3, areas);
  assert.ok(next.x >= 5.4 && next.x <= 6 - PLAYER_RADIUS);
  assert.ok(Math.abs(next.z - 3) < 0.001, 'Unblocked forward movement continues');
  assert.ok(canWalk(next.x, next.z, areas));
});

test('a large movement cannot tunnel through a thin prop collider', () => {
  const testArea = [{ x: 0, z: 0, w: 30, d: 20 }];
  const obstacle = [{ x: 0, z: 0, w: 0.05, d: 8 }];
  const next = movePlayer({ x: -6, z: 0 }, 12, 0, testArea, obstacle);
  assert.ok(next.x < -0.025 - PLAYER_RADIUS, 'Movement stops on the near side of the prop');
  assert.ok(next.x > -0.6, 'Movement advances up to the obstacle');
  assert.ok(canWalk(next.x, next.z, testArea, obstacle));
  assert.equal(canWalk(0, 0, testArea, obstacle), false);
});

test('a large movement cannot cross the empty gap between rooms', () => {
  const floor = rooms.find(room => room.id === 'floor');
  const innerBoundary = floor.z - floor.d / 2;
  const next = movePlayer({ x: floor.x, z: floor.z }, 0, -52, areas);
  assert.ok(next.z >= innerBoundary + PLAYER_RADIUS, 'Player cannot jump through the wall toward another room');
  assert.ok(next.z < innerBoundary + 1);
  assert.ok(canWalk(next.x, next.z, areas));
});

test('prop corners allow sliding on the unobstructed axis', () => {
  const testArea = [{ x: 0, z: 0, w: 30, d: 30 }];
  const obstacle = [{ x: 0, z: 0, w: 2, d: 10 }];
  const next = movePlayer({ x: -2, z: 0 }, 3, 3, testArea, obstacle);
  assert.ok(next.x < -1 - PLAYER_RADIUS);
  assert.ok(Math.abs(next.z - 3) < 0.001);
  assert.ok(canWalk(next.x, next.z, testArea, obstacle));
});

test('saved progress accepts known rooms and deduplicates while discarding unrelated data', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, 'uss-sentient-expedition-v1');
      return JSON.stringify(['floor', 'bridge', 'floor', 'unknown', null, {}, 7, 'archive']);
    },
  };
  assert.deepEqual([...readProgress(storage, rooms)], ['floor', 'bridge', 'archive']);
});

test('missing, malformed or unavailable saved progress starts a fresh expedition', () => {
  for (const value of [null, '', '{not-json', 'null', '{}', '42', '"bridge"', 'true', '[]']) {
    assert.equal(readProgress({ getItem: () => value }, rooms).size, 0, String(value));
  }
  assert.equal(readProgress({ getItem() { throw new Error('Storage is blocked'); } }, rooms).size, 0);
  assert.equal(readProgress(undefined, rooms).size, 0);
});
