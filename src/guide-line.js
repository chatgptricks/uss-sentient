import * as THREE from 'three';

/**
 * A Battle School-style guide light: a ribbon on the deck in the destination's
 * colour, with light pulses flowing towards it along the furniture-aware route.
 */
export function createGuideLine(scene) {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xcfff04) }, uLength: { value: 1 } },
    vertexShader: `attribute float along; attribute float across; varying float vAlong; varying float vAcross;
      void main() { vAlong = along; vAcross = across; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uLength; varying float vAlong; varying float vAcross;
      void main() {
        float edge = 1. - smoothstep(.55, 1., abs(vAcross));
        // Chevrons travel forward at a walking pace, two per metre.
        float phase = fract(vAlong * 2. - uTime * 1.4 - abs(vAcross) * .35);
        float chevron = smoothstep(.0, .12, phase) * (1. - smoothstep(.32, .5, phase));
        float start = smoothstep(.35, 1.2, vAlong), end = 1. - smoothstep(uLength - .6, uLength, vAlong);
        float far = 1. - smoothstep(14., 26., vAlong);
        float a = edge * start * end * far * (.28 + .72 * chevron);
        gl_FragColor = vec4(uColor * (1.1 + chevron * .9), a * .85);
      }`,
  });
  material.toneMapped = false;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.name = 'Guide light'; mesh.frustumCulled = false; mesh.renderOrder = 4; mesh.userData.excludeFromAO = true; mesh.userData.noTrace = true;
  scene.add(mesh);
  let key = '';

  /** points: [{x,z}] from the player onward; heightAt(p) gives the deck height. */
  function setRoute(points, heightAt, color) {
    material.uniforms.uColor.value.set(color);
    const nextKey = points.map(p => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join('|') + color;
    if (nextKey === key) return; key = nextKey;
    const samples = [];
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(1, Math.ceil(length / .12));
      for (let k = i === 1 ? 0 : 1; k <= steps; k++) {
        const t = k / steps, p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
        samples.push({ ...p, y: heightAt(p) + .018, d: distance + length * t });
      }
      distance += length;
    }
    material.uniforms.uLength.value = distance;
    const position = [], along = [], across = [], index = [], half = .075;
    samples.forEach((p, i) => {
      const q = samples[Math.min(i + 1, samples.length - 1)], o = samples[Math.max(i - 1, 0)];
      let dx = q.x - o.x, dz = q.z - o.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      for (const side of [-1, 1]) { position.push(p.x - dz * half * side, p.y, p.z + dx * half * side); along.push(p.d); across.push(side); }
      if (i) { const v = i * 2; index.push(v - 2, v - 1, v, v - 1, v + 1, v); }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    geometry.setAttribute('across', new THREE.Float32BufferAttribute(across, 1));
    geometry.setIndex(index);
    mesh.geometry.dispose(); mesh.geometry = geometry;
  }
  return {
    mesh,
    update(time, points, heightAt, color, visible) {
      mesh.visible = visible && points.length > 1;
      material.uniforms.uTime.value = time;
      if (mesh.visible) setRoute(points, heightAt, color);
    },
    dispose() { scene.remove(mesh); mesh.geometry.dispose(); material.dispose(); },
  };
}
