import * as THREE from 'three';

const EPSILON = 1e-9;
const area2 = points => points.reduce((sum, p, i) => {
  const q = points[(i + 1) % points.length];
  return sum + p.x * q.z - q.x * p.z;
}, 0);
const side = (a, b, p) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);

// Clip a convex polygon against the four inward half-planes of a shoulder.
// Starting from floor triangles keeps every result inside a concave hull too.
function clipToStrip(triangle, strip) {
  let result = triangle;
  for (let edge = 0; edge < strip.length && result.length; edge++) {
    const a = strip[edge], b = strip[(edge + 1) % strip.length], input = result;
    result = [];
    let previous = input.at(-1), previousSide = side(a, b, previous);
    for (const current of input) {
      const currentSide = side(a, b, current);
      const previousInside = previousSide >= -EPSILON, currentInside = currentSide >= -EPSILON;
      if (previousInside !== currentInside) {
        const t = previousSide / (previousSide - currentSide);
        result.push({ x: previous.x + (current.x - previous.x) * t,
          z: previous.z + (current.z - previous.z) * t });
      }
      if (currentInside) result.push(current);
      previous = current; previousSide = currentSide;
    }
  }
  return result;
}

/**
 * Sloping ceiling shoulders clipped to an arbitrary simple pressure footprint.
 * Coordinates are global X/Z and local deck Y, matching the world builders.
 * Keep a sealed full-footprint lid above these panels; corner slopes can overlap
 * without requiring a concave offset polygon or introducing exterior surfaces.
 */
export function createPressureShoulderGeometry(points, center, {
  wallHeight = 2.56, ceilingHeight = 3.08, minDepth = .45, maxDepth = 1.8,
} = {}) {
  if (points.length < 3 || Math.abs(area2(points)) < EPSILON) {
    throw new Error('A pressure roof needs a nondegenerate polygon.');
  }
  if (!(minDepth > 0 && maxDepth >= minDepth && ceilingHeight > wallHeight)) {
    throw new Error('Invalid pressure-roof depth or height.');
  }
  const contour = points.map(p => ({ x: p.x, z: p.z }));
  if (area2(contour) < 0) contour.reverse();
  const faces = THREE.ShapeUtils.triangulateShape(contour.map(p => new THREE.Vector2(p.x, p.z)), []);
  const positions = [], uvs = [];
  let patches = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < EPSILON) continue;
    const nx = -dz / length, nz = dx / length;
    const radius = (center.x - a.x) * nx + (center.z - a.z) * nz;
    const depth = THREE.MathUtils.clamp(radius * .23, minDepth, maxDepth);
    const strip = [a, b, { x: b.x + nx * depth, z: b.z + nz * depth },
      { x: a.x + nx * depth, z: a.z + nz * depth }];
    for (const face of faces) {
      const patch = clipToStrip(face.map(index => contour[index]), strip);
      if (patch.length < 3 || Math.abs(area2(patch)) < EPSILON) continue;
      if (area2(patch) < 0) patch.reverse();
      patches++;
      for (let j = 1; j < patch.length - 1; j++) {
        const triangle = [patch[0], patch[j], patch[j + 1]];
        if (Math.abs(side(...triangle)) < EPSILON) continue;
        // Positive XZ winding gives an inward/downward normal on the ceiling.
        for (const p of triangle) {
          const t = THREE.MathUtils.clamp(((p.x - a.x) * nx + (p.z - a.z) * nz) / depth, 0, 1);
          positions.push(p.x, wallHeight + (ceilingHeight - wallHeight) * t, p.z);
          uvs.push(p.x, p.z);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.roof = { patches, triangles: positions.length / 9, wallHeight, ceilingHeight };
  return geometry;
}
