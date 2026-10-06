import test from 'node:test';
import assert from 'node:assert/strict';
import { obbOverlap, pointInObb, frameObb, obbFromMatrix, createOccupancy, seededRandom } from '../src/occupancy.js';

const box = (x, y, z, hx, hy, hz, yaw = 0) => frameObb({ x, z }, yaw, [0, y, 0], [hx, hy, hz]);

test('oriented boxes separate on face and edge axes', () => {
  assert.ok(obbOverlap(box(0, 0, 0, .5, .5, .5), box(.9, 0, 0, .5, .5, .5)));
  assert.ok(!obbOverlap(box(0, 0, 0, .5, .5, .5), box(1.05, 0, 0, .5, .5, .5)));
  // A 45° box whose corner just misses: only a rotated axis separates them.
  assert.ok(!obbOverlap(box(0, 0, 0, .5, .5, .5), box(1.25, 0, 0, .5, .5, .5, Math.PI / 4)));
  assert.ok(obbOverlap(box(0, 0, 0, .5, .5, .5), box(1.15, 0, 0, .5, .5, .5, Math.PI / 4)));
  // Margins can be zero towards a wall while still padding sideways.
  assert.ok(!obbOverlap(box(0, 0, .515, .5, .5, .01), box(0, 0, 0, .5, .5, .5), [.05, .05, 0]));
  assert.ok(obbOverlap(box(1.04, 0, 0, .5, .5, .5), box(0, 0, 0, .5, .5, .5), [.05, .05, 0]));
});

test('matrix boxes, points and the spatial hash agree', () => {
  const o = obbFromMatrix([2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 4, 0, 3, 1, -2, 1]);
  assert.deepEqual(o.e, [1, .5, 2]);
  assert.ok(pointInObb([3.9, 1.4, -.1], o) && !pointInObb([4.1, 1, -2], o));
  const grid = createOccupancy(1); grid.add(o);
  assert.ok(grid.contains([2.2, 1, -3.5]) && !grid.contains([6, 1, -2]));
  assert.ok(grid.overlaps(box(4.05, 1, -2, .1, .1, .1), .1) && !grid.overlaps(box(4.3, 1, -2, .1, .1, .1), .1));
});

test('seeded furnishing is deterministic', () => {
  const a = seededRandom('forum'), b = seededRandom('forum'), c = seededRandom('lab');
  const first = [a(), a(), a()];
  assert.deepEqual(first, [b(), b(), b()]);
  assert.notDeepEqual(first, [c(), c(), c()]);
  assert.ok(first.every(v => v >= 0 && v < 1));
});
