import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, modulePolygon, insidePolygon } from '../src/layout.js';
import { createPressureShoulderGeometry } from '../src/roof-geometry.js';

// Float32 GPU positions can land a few micrometres across an exact boundary.
function withinFootprint(point, polygon) {
  if (insidePolygon(point.x, point.z, polygon)) return true;
  return polygon.some((a, index) => {
    const b = polygon[(index + 1) % polygon.length], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t) < .00002;
  });
}

function inspect(geometry, polygon) {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  assert.ok(positions.count > 0);
  assert.equal(positions.count % 3, 0);
  assert.ok(positions.count / 3 < 1000, 'Shoulders stay a small build-time mesh');
  for (const attribute of [positions, normals, geometry.getAttribute('uv')]) {
    assert.ok([...attribute.array].every(Number.isFinite), 'Every GPU attribute is finite');
  }
  for (let i = 0; i < positions.count; i += 3) {
    const triangle = [0, 1, 2].map(offset => ({ x: positions.getX(i + offset), z: positions.getZ(i + offset) }));
    const points = [...triangle];
    // Check vertices, centroid, and edge/interior barycentric samples. A flat
    // ceiling spanning a concave bay's notch must not pass as a valid shoulder.
    for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4 - a; b++) {
      const c = 4 - a - b;
      points.push({ x: (triangle[0].x * a + triangle[1].x * b + triangle[2].x * c) / 4,
        z: (triangle[0].z * a + triangle[1].z * b + triangle[2].z * c) / 4 });
    }
    points.push({ x: triangle.reduce((sum, point) => sum + point.x, 0) / 3,
      z: triangle.reduce((sum, point) => sum + point.z, 0) / 3 });
    for (const point of points) assert.ok(withinFootprint(point, polygon), `Roof leaks outside hull at ${JSON.stringify(point)}`);
    for (let offset = 0; offset < 3; offset++) {
      assert.ok(positions.getY(i + offset) >= 2.55999 && positions.getY(i + offset) <= 3.08001);
      assert.ok(normals.getY(i + offset) < -.01, 'Ceiling faces into the cabin');
    }
  }
  assert.ok(Number.isFinite(geometry.boundingSphere.radius));
}

for (const module of MODULES) test(`${module.id} pressure shoulders stay within the authored hull`, () => {
  const polygon = modulePolygon(module), original = structuredClone(polygon);
  const geometry = createPressureShoulderGeometry(polygon, module);
  try { inspect(geometry, polygon); assert.deepEqual(polygon, original, 'Building a roof does not mutate the shared floor plan'); }
  finally { geometry.dispose(); }
});

test('a concave L-shaped hull is safe with either input winding', () => {
  const polygon = [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 5, z: 2 }, { x: 2, z: 2 }, { x: 2, z: 5 }, { x: 0, z: 5 }];
  const forward = createPressureShoulderGeometry(polygon, { x: 1, z: 1 });
  const reversed = createPressureShoulderGeometry([...polygon].reverse(), { x: 1, z: 1 });
  try {
    inspect(forward, polygon); inspect(reversed, polygon);
    assert.equal(reversed.getAttribute('position').count, forward.getAttribute('position').count);
    assert.deepEqual(reversed.boundingBox, forward.boundingBox);
  } finally { forward.dispose(); reversed.dispose(); }
});

test('invalid roof bounds fail before producing GPU geometry', () => {
  assert.throws(() => createPressureShoulderGeometry([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }], { x: 1, z: 0 }), /nondegenerate polygon/);
  const polygon = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 0, z: 2 }];
  for (const options of [{ minDepth: 0 }, { minDepth: 2, maxDepth: 1 }, { ceilingHeight: 2.4 }]) {
    assert.throws(() => createPressureShoulderGeometry(polygon, { x: .5, z: .5 }, options), /depth or height/);
  }
});
