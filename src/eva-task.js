import * as THREE from 'three';

// Radiator loop 3 has a failed orbital replacement unit (ORU) mounted just
// outside the EVA lookout rail. Two steps: release the failed panel, then seat
// the spare from the stowage cradle. Both are animated, not instant swaps.
const MOUNT = { x: 19.72, y: .98, z: -31 };

export function addEvaTask(ctx) {
  const { root, kit, mat, texture, textPlane, materials: M } = ctx;
  const stats = { steps: 0, completed: false };
  const fin = mat({ color: 0xd9dbd0, roughness: .38, metalness: .55 });
  const scorched = mat({ color: 0x6b5a48, roughness: .8, metalness: .3 });
  const fault = mat({ color: 0xffa13a, emissive: 0xff8a1a, emissiveIntensity: 1.6, toneMapped: false });
  fault.name = 'EVA task / fault beacon';
  const mountYaw = -Math.PI / 2; // faces back into the lookout (-x)

  // Fixed structure: a strut from the gantry, a cradle frame and the spare.
  kit.pipe([19.3, -.2, -31], [MOUNT.x, -.2, -31], .05, M.silver, 10, root);
  kit.pipe([MOUNT.x, -.2, -31], [MOUNT.x, .38, -31], .05, M.silver, 10, root);
  for (const dz of [-.72, .72]) kit.pipe([MOUNT.x + .06, .4, MOUNT.z + dz], [MOUNT.x + .06, 1.62, MOUNT.z + dz], .035, M.graphite, 8, root);
  kit.cuboid(MOUNT.x + .08, .4, MOUNT.z, .12, .06, 1.52, M.graphite, 0, root);
  kit.cuboid(MOUNT.x + .08, 1.62, MOUNT.z, .12, .06, 1.52, M.graphite, 0, root);
  // Stowage cradle a little further along the rail, holding the spare panel.
  const cradle = { x: 19.72, z: -29.25 };
  kit.pipe([19.3, -.2, cradle.z], [cradle.x, -.2, cradle.z], .045, M.silver, 10, root);
  kit.pipe([cradle.x, -.2, cradle.z], [cradle.x, .45, cradle.z], .045, M.silver, 10, root);
  kit.cuboid(cradle.x + .08, .48, cradle.z, .16, .06, 1.0, M.graphite, 0, root);

  function panel(material, name) {
    const g = new THREE.Group(); g.name = name;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.1, 1.36), material); g.add(plate);
    for (let i = -5; i <= 5; i++) { const finMesh = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.04, .02), fin); finMesh.position.set(-.05, 0, i * .12); g.add(finMesh); }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.08, .014, 6, 12, Math.PI), M.accent); handle.rotation.set(0, Math.PI / 2, Math.PI / 2); handle.position.set(-.09, .35, 0); g.add(handle);
    g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; ctx.resourceGeometries.add(o.geometry); } });
    root.add(g); return g;
  }
  const failed = panel(scorched, 'Radiator ORU / failed');
  failed.position.set(MOUNT.x, MOUNT.y, MOUNT.z);
  const spare = panel(M.enamel, 'Radiator ORU / spare');
  const spareHome = new THREE.Vector3(cradle.x, .94, cradle.z), spareScale = .74;
  spare.position.copy(spareHome); spare.scale.setScalar(spareScale);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 8), fault); beacon.position.set(MOUNT.x - .02, 1.72, MOUNT.z); root.add(beacon);
  ctx.resourceGeometries.add(beacon.geometry);

  const statusMap = texture(512, 160, () => {}); statusMap.userData.emissiveDisplay = true;
  const status = textPlane(statusMap, .62, .195, MOUNT.x - .02, 1.9, MOUNT.z, mountYaw, root);
  let step = 0, anim = null; // 0 failed in place, 1 removed, 2 spare installed
  function paint() {
    const g = statusMap.image.getContext('2d');
    g.fillStyle = '#0a1820'; g.fillRect(0, 0, 512, 160);
    g.fillStyle = step === 2 ? '#cfff04' : '#ffa13a'; g.fillRect(0, 0, 10, 160);
    g.font = '500 30px Space, Arial'; g.fillText(step === 2 ? 'LOOP 3 · NOMINAL' : 'LOOP 3 · RADIATOR FAULT', 28, 50);
    g.fillStyle = '#e5efe5'; g.font = '400 22px Space, Arial';
    g.fillText(['E · RELEASE FAILED PANEL', 'E · SEAT SPARE FROM CRADLE', 'ORU REPLACED · COOLANT FLOWING'][step], 28, 96);
    g.fillStyle = '#7f9a96'; g.font = '400 17px Space, Arial'; g.fillText('ORU 3-B / 4 LATCHES / 28 VDC ISOLATED', 28, 134);
    statusMap.needsUpdate = true;
  }
  paint();

  const device = {
    id: 'eva-radiator', zone: 'exterior', range: 2.1, mesh: failed,
    x: MOUNT.x - .3, y: 1.0, z: MOUNT.z, approach: { x: 18.6, z: -31 },
    get label() { return ['RELEASE FAILED RADIATOR PANEL', 'SEAT SPARE RADIATOR PANEL', 'RADIATOR LOOP 3 NOMINAL'][step]; },
    activate() {
      if (anim) return 'Hold position. The latches are still cycling.';
      if (step === 0) { anim = { kind: 'remove', t: 0 }; step = 1; stats.steps++; paint(); device.mesh = spare; return 'Latches released. The failed panel is backing out of its guides.'; }
      if (step === 1) { anim = { kind: 'install', t: 0 }; step = 2; stats.steps++; return 'Seating the spare. Torque the four latches, then coolant will flow.'; }
      return 'Radiator loop 3 is nominal. Thanks for the spacewalk.';
    },
    state: () => ({ step, completed: stats.completed, animating: !!anim }),
  };
  const listeners = [];
  const mountPos = new THREE.Vector3(MOUNT.x, MOUNT.y, MOUNT.z);
  return {
    devices: [device], stats,
    onComplete(fn) { listeners.push(fn); },
    update(time, dt) {
      beacon.material = step === 2 ? M.accent : fault;
      beacon.visible = step === 2 || (time % 1) < .55;
      if (!anim) return;
      anim.t += Math.max(0, dt);
      const u = Math.min(1, anim.t / 2.6), e = u * u * (3 - 2 * u);
      if (anim.kind === 'remove') {
        // Back out along the guides, then drift down and away on its tether.
        failed.position.set(MOUNT.x + e * .55, MOUNT.y - Math.max(0, e - .5) * .9, MOUNT.z + Math.max(0, e - .5) * 1.1);
        failed.rotation.y = e * .4; failed.rotation.z = Math.max(0, e - .6) * .5;
        if (u >= 1) { failed.visible = false; anim = null; }
      } else {
        spare.position.lerpVectors(spareHome, mountPos, e); spare.scale.setScalar(spareScale + (1 - spareScale) * e);
        if (u >= 1) { anim = null; stats.completed = true; paint(); listeners.forEach(fn => fn()); }
      }
    },
  };
}
