import * as THREE from 'three';

// Repeated engineering parts share geometry and materials, including parts
// attached to moving hatch leaves. Thousands of details become a few batches.
export function createDetailKit(root, geometries) {
  const batches = new Map(), cylinders = new Map();
  let activeParent = root;
  const yAxis = new THREE.Vector3(0, 1, 0);
  const cube = new THREE.BoxGeometry(1, 1, 1); geometries.add(cube);
  function cylinderGeometry(sides) {
    if (!cylinders.has(sides)) {
      const geometry = new THREE.CylinderGeometry(1, 1, 1, sides);
      cylinders.set(sides, geometry); geometries.add(geometry);
    }
    return cylinders.get(sides);
  }
  function part(geometry, material, position, quaternion, scale, parent = activeParent) {
    const key = `${parent.uuid}:${geometry.uuid}:${material.uuid}`;
    if (!batches.has(key)) batches.set(key, { parent, geometry, material, transforms: [] });
    batches.get(key).transforms.push(new THREE.Matrix4().compose(position, quaternion, scale));
  }
  function pipe(a, b, radius, material, sides = 10, parent = activeParent) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), direction = to.clone().sub(from);
    const length = direction.length();
    if (length < .00001) return;
    part(cylinderGeometry(sides), material, from.add(to).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(yAxis, direction.normalize()), new THREE.Vector3(radius, length, radius), parent);
  }
  function bolt(x, y, z, ry, material, radius = .021, parent = activeParent) {
    const nx = Math.sin(ry), nz = Math.cos(ry);
    pipe([x-nx*.009,y,z-nz*.009],[x+nx*.009,y,z+nz*.009],radius,material,6,parent);
  }
  function toWorld(origin, ry, point) {
    const [x,y,z] = point, c = Math.cos(ry), s = Math.sin(ry);
    return [origin.x + x*c + z*s, y, origin.z - x*s + z*c];
  }
  function localPipe(origin, ry, a, b, radius, material, sides = 10) {
    pipe(toWorld(origin,ry,a),toWorld(origin,ry,b),radius,material,sides);
  }
  function localBolt(origin, ry, x, y, z, material, radius = .021) {
    const p = toWorld(origin,ry,[x,y,z]); bolt(...p,ry,material,radius);
  }
  function cuboid(x,y,z,w,h,d,material,ry=0,parent=activeParent) {
    part(cube,material,new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ry,0)),new THREE.Vector3(w,h,d),parent);
  }
  function flush() {
    let instances = 0;
    for (const {parent,geometry,material,transforms} of batches.values()) {
      const mesh = new THREE.InstancedMesh(geometry,material,transforms.length);
      transforms.forEach((matrix,i) => mesh.setMatrixAt(i,matrix));
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh); instances += transforms.length;
    }
    return { batches: batches.size, instances };
  }
  return { pipe, bolt, localPipe, localBolt, cuboid, toWorld, flush, setParent: parent => { activeParent = parent; } };
}
