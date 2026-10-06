import * as THREE from 'three';
import { MODULES, moduleFacet } from './layout.js';

// One full traffic cycle, in seconds. The tender is seen crossing the Bridge
// prow, swings round the station and docks at the Front Door's offset nose.
const CYCLE = 240;
const PHASES = [
  { id: 'approach', start: 0, label: 'Inbound' },
  { id: 'final', start: 62, label: 'Final approach' },
  { id: 'docked', start: 84, label: 'Hard dock' },
  { id: 'undock', start: 152, label: 'Undocking' },
  { id: 'depart', start: 168, label: 'Departing' },
  { id: 'away', start: 214, label: 'Clear of station' },
];

/** Sentient tender 02: periodic approach, docking, hold and departure. */
export function createDocking(ctx) {
  const { root, mat, texture, resourceGeometries, resourceMaterials, resourceTextures } = ctx;
  const arrival = MODULES.find(m => m.id === 'front-door');
  const nose = moduleFacet(arrival, 4);
  const mid = { x: (nose.a.x + nose.b.x) / 2, z: (nose.a.z + nose.b.z) / 2 };
  const along = new THREE.Vector3(nose.b.x - nose.a.x, 0, nose.b.z - nose.a.z).normalize();
  let normal = new THREE.Vector3(-along.z, 0, along.x);
  if (normal.x * (mid.x - arrival.x) + normal.z * (mid.z - arrival.z) < 0) normal.negate();
  const port = new THREE.Vector3(mid.x, arrival.elevation + 1.35, mid.z).addScaledVector(normal, .32);

  // ---- The tender: hull, docking adapter, solar wings, radiator and lights.
  const tender = new THREE.Group(); tender.name = 'SNT tender 02';
  const shipMat = (color, emissive = .28, metal = .3, rough = .55) => {
    const m = mat({ color, roughness: rough, metalness: metal, emissive: color, emissiveIntensity: emissive }); m.name = 'Tender / hull'; return m;
  };
  const hullMat = shipMat(0xe9e8dd), darkMat = shipMat(0x38434b, .16), panelMat = shipMat(0x1f3446, .22, .6, .35), limeMat = shipMat(0xcfff04, .9, 0), steelMat = shipMat(0x9eaaa8, .12, .8, .3);
  const geo = g => { resourceGeometries.add(g); return g; };
  const part = (g, material, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo(g), material); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); tender.add(m); return m; };
  const along_x = Math.PI / 2;
  part(new THREE.CylinderGeometry(1.1, 1.1, 6.5, 24), hullMat, 0, 0, 0, 0, 0, along_x);
  part(new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hullMat, 3.25, 0, 0, 0, 0, -along_x);
  part(new THREE.CylinderGeometry(.62, .62, .55, 20), steelMat, 4.45, 0, 0, 0, 0, along_x); // docking adapter
  part(new THREE.TorusGeometry(.66, .06, 8, 24), limeMat, 4.72, 0, 0, 0, along_x, 0);
  part(new THREE.CylinderGeometry(.75, 1.05, 1.3, 18), darkMat, -3.9, 0, 0, 0, 0, along_x);
  part(new THREE.CylinderGeometry(1.13, 1.13, .35, 24), limeMat, 1.6, 0, 0, 0, 0, along_x);
  for (const side of [-1, 1]) {
    part(new THREE.BoxGeometry(.2, .2, 1.6), darkMat, -.6, 0, side * 1.9);
    part(new THREE.BoxGeometry(2.6, .05, 4.4), panelMat, -.6, 0, side * 4.9);
    for (let i = -1; i <= 1; i++) part(new THREE.BoxGeometry(2.62, .055, .03), steelMat, -.6, 0, side * (4.9 + i * 1.47));
  }
  part(new THREE.BoxGeometry(1.8, .9, .9), darkMat, -1.6, 1.15, 0);
  part(new THREE.BoxGeometry(2.4, .04, 1.4), hullMat, -1.6, -1.25, 0, .25, 0, 0);
  // RCS quads at both ends: four nozzles each, their puffs are sprites below.
  const rcsPoints = [];
  for (const x of [2.6, -2.9]) for (const [y, z] of [[1.15, 0], [-1.15, 0], [0, 1.15], [0, -1.15]]) {
    part(new THREE.BoxGeometry(.24, .18, .18), darkMat, x, y, z); rcsPoints.push(new THREE.Vector3(x, y * 1.12, z * 1.12));
  }
  const navLight = (color, x, y, z) => { const m = new THREE.MeshBasicMaterial({ color, toneMapped: false }); resourceMaterials.add(m); return part(new THREE.SphereGeometry(.12, 8, 6), m, x, y, z); };
  const portLight = navLight(0xff3b2f, -.6, 0, -7.1), starboardLight = navLight(0x36ff6a, -.6, 0, 7.1);
  const strobe = navLight(0xffffff, -1.6, 1.62, 0), dockLight = navLight(0xcfff04, 4.72, .7, 0);
  const puffMap = texture(64, 64, (g, w, h) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(.4, 'rgba(220,235,255,.35)'); r.addColorStop(1, 'rgba(220,235,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const puffMaterial = new THREE.SpriteMaterial({ map: puffMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  resourceMaterials.add(puffMaterial); resourceTextures?.add(puffMap);
  const puffs = rcsPoints.map(p => { const s = new THREE.Sprite(puffMaterial); s.position.copy(p); s.scale.setScalar(.01); s.visible = false; tender.add(s); return s; });
  tender.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = false; o.userData.excludeFromAO = true; } });
  root.add(tender);

  // ---- Choreography: a smooth cruise path, then a straight final approach
  // along the port's outward normal. The adapter tip sits 4.99 m ahead of centre.
  const TIP = 4.99, docked = port.clone().addScaledVector(normal, TIP), standoff = docked.clone().addScaledVector(normal, 16);
  const inbound = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-170, 12, -112), new THREE.Vector3(-70, 8, -78), new THREE.Vector3(-42, 5, -20),
    new THREE.Vector3(-34, 3, 22), new THREE.Vector3(-12, 2, standoff.z + 6), standoff.clone(),
  ], false, 'centripetal');
  const outbound = new THREE.CatmullRomCurve3([standoff.clone(), standoff.clone().addScaledVector(normal, 18).add(new THREE.Vector3(14, 3, 0)), new THREE.Vector3(70, 9, 70), new THREE.Vector3(220, 22, 140)], false, 'centripetal');
  const facingStation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), normal.clone().negate());
  const tangentQuat = (curve, t) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), curve.getTangentAt(Math.min(.999, Math.max(.001, t))).normalize());
  const ease = t => t * t * (3 - 2 * t);
  const state = { phase: 'approach', label: 'Inbound', range: 0, closing: 0, docked: false, cycle: 0, visible: true };
  let lastPhase = null, lastRange = null;
  const listeners = [];

  function pose(t) {
    // Returns position, orientation and whether the thrusters are firing.
    if (t < 62) {
      const u = ease(t / 62);
      const q = tangentQuat(inbound, u);
      if (t > 52) q.slerp(facingStation, ease((t - 52) / 10));
      return { p: inbound.getPointAt(u), q, rcs: t > 50 };
    }
    if (t < 84) { const u = 1 - Math.pow(1 - (t - 62) / 22, 2.2); return { p: standoff.clone().lerp(docked, u), q: facingStation, rcs: t < 70 || t > 80 }; }
    if (t < 152) return { p: docked.clone(), q: facingStation, rcs: false };
    if (t < 168) { const u = ease((t - 152) / 16); return { p: docked.clone().lerp(standoff, u), q: facingStation, rcs: t < 156 || t > 164 }; }
    if (t < 214) {
      const u = ease((t - 168) / 46), q = facingStation.clone().slerp(tangentQuat(outbound, u), ease(Math.min(1, (t - 168) / 9)));
      return { p: outbound.getPointAt(u), q, rcs: t < 178 };
    }
    return null;
  }

  // ---- Docking camera: a low-resolution feed on Arrival's proximity screen.
  const feed = new THREE.WebGLRenderTarget(512, 288, { samples: 0 });
  feed.texture.name = 'Arrival / docking camera feed';
  const camera = new THREE.PerspectiveCamera(34, 512 / 288, .2, 600);
  camera.position.copy(port).addScaledVector(normal, .45).add(new THREE.Vector3(0, .9, 0));
  camera.lookAt(standoff.clone().add(new THREE.Vector3(0, .6, 0)));
  const overlayCanvas = document.createElement('canvas'); overlayCanvas.width = 512; overlayCanvas.height = 288;
  const overlay = new THREE.CanvasTexture(overlayCanvas); overlay.colorSpace = THREE.SRGBColorSpace; resourceTextures?.add(overlay);
  let screen = null, overlayMesh = null;
  root.traverse(o => { if (o.name === 'front-door / radar display 0') screen = o; });
  if (screen) {
    const material = screen.material;
    material.map = feed.texture; material.emissiveMap = feed.texture; material.emissive.set(0xffffff); material.emissiveIntensity = 1.15; material.needsUpdate = true;
    const overlayMaterial = new THREE.MeshBasicMaterial({ map: overlay, transparent: true, depthWrite: false, toneMapped: false }); resourceMaterials.add(overlayMaterial);
    overlayMesh = new THREE.Mesh(screen.geometry, overlayMaterial); overlayMesh.name = 'Arrival / docking camera overlay';
    overlayMesh.position.copy(screen.position); overlayMesh.quaternion.copy(screen.quaternion);
    overlayMesh.translateZ(.003); screen.parent.add(overlayMesh);
  }
  function paintOverlay() {
    const g = overlayCanvas.getContext('2d'), w = 512, h = 288; g.clearRect(0, 0, w, h);
    const lime = '#cfff04';
    g.strokeStyle = 'rgba(207,255,4,.85)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(w / 2 - 30, h / 2); g.lineTo(w / 2 - 8, h / 2); g.moveTo(w / 2 + 8, h / 2); g.lineTo(w / 2 + 30, h / 2);
    g.moveTo(w / 2, h / 2 - 30); g.lineTo(w / 2, h / 2 - 8); g.moveTo(w / 2, h / 2 + 8); g.lineTo(w / 2, h / 2 + 30); g.stroke();
    for (const [x, y, dx, dy] of [[20, 20, 1, 1], [w - 20, 20, -1, 1], [20, h - 20, 1, -1], [w - 20, h - 20, -1, -1]]) { g.beginPath(); g.moveTo(x, y + dy * 22); g.lineTo(x, y); g.lineTo(x + dx * 22, y); g.stroke(); }
    g.fillStyle = 'rgba(6,14,18,.72)'; g.fillRect(0, 0, w, 34); g.fillRect(0, h - 40, w, 40);
    g.fillStyle = lime; g.font = '500 17px Space, Arial'; g.fillText('DOCKING CAMERA / PORT 01-S', 14, 23);
    g.fillStyle = '#e5efe5'; g.textAlign = 'right'; g.fillText(state.label.toUpperCase(), w - 14, 23); g.textAlign = 'left';
    g.font = '500 20px Space, Arial'; g.fillStyle = state.docked ? lime : '#e5efe5';
    const range = state.visible ? `${state.range < 100 ? state.range.toFixed(1) : Math.round(state.range)} m` : '— —';
    g.fillText(`RANGE ${range}`, 14, h - 13);
    g.fillText(state.docked ? 'LATCHED · PRESSURE EQUAL' : `RATE ${state.closing.toFixed(2)} m/s`, 230, h - 13, w - 244);
    overlay.needsUpdate = true;
  }

  let feedFrame = 0, overlayTime = -1;
  return {
    tender, state, phases: PHASES, port, normal,
    onPhase(callback) { listeners.push(callback); },
    update(time, dt = 1 / 60) {
      const t = ((time % CYCLE) + CYCLE) % CYCLE, p = pose(t);
      const phase = [...PHASES].reverse().find(x => t >= x.start);
      state.cycle = t; state.phase = phase.id; state.label = phase.label; state.docked = phase.id === 'docked'; state.visible = !!p;
      tender.visible = !!p;
      if (p) {
        tender.position.copy(p.p); tender.quaternion.copy(p.q);
        const flicker = (time * 7) % 1;
        puffs.forEach((s, i) => { s.visible = p.rcs && ((i + Math.floor(time * 3)) % 3 === 0); s.scale.setScalar(.5 + flicker * .7); });
        strobe.visible = (time % 1.6) < .09;
        portLight.visible = starboardLight.visible = (time % 3) > .25;
        dockLight.visible = state.docked || (time % .8) < .4;
        const range = Math.max(0, tender.position.distanceTo(docked));
        state.closing = lastRange === null ? 0 : Math.max(0, (lastRange - range) / Math.max(dt, 1e-3));
        state.range = range; lastRange = range;
      } else lastRange = null;
      if (phase.id !== lastPhase) { const previous = lastPhase; lastPhase = phase.id; if (previous !== null) listeners.forEach(fn => fn(phase.id, phase)); }
      if (time - overlayTime > .25) { overlayTime = time; if (overlayMesh) paintOverlay(); }
    },
    /** Called from the render loop; refreshes the feed while the player is in Arrival. */
    renderFeed(renderer, scene, player) {
      if (!screen || !player || player.layer !== 'station' || Math.hypot(player.x - arrival.x, player.z - arrival.z) > 7) return false;
      if (feedFrame++ % 3) return false;
      const previous = renderer.getRenderTarget();
      overlayMesh.visible = false; screen.visible = false;
      renderer.setRenderTarget(feed); renderer.render(scene, camera); renderer.setRenderTarget(previous);
      overlayMesh.visible = true; screen.visible = true;
      return true;
    },
    dispose() { feed.dispose(); },
  };
}
