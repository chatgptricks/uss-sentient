import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// NASA's Extravehicular Mobility Unit (public NASA 3D Resources model), with the
// MMU jetpack removed and repainted in Sentient colours: docs/ASSET-CREDITS.md.
const MODEL = 'models/nasa/emu-sentient.glb';
const SCALE = .9;
// Model space: boots at y=.048, the life-support pack's back at z=+.614,
// the suit facing -z. These bounds come from the cleaned asset.
const BOUNDS = { feet: .048, back: .614, front: -.353, left: -.535, right: .565 };

async function sentientMark(base) {
  const image = new Image(); image.src = `${base}brand/sentient-mark-green.svg`;
  try { await image.decode(); return image; } catch { return null; }
}

/** Sentient replacements painted onto the flag and mission-patch layouts. */
function patchTextures(mark) {
  const make = paint => {
    const canvas = document.createElement('canvas'); canvas.width = 582; canvas.height = 564;
    const g = canvas.getContext('2d'); g.fillStyle = '#f1f0e5'; g.fillRect(0, 0, 582, 564); paint(g);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.flipY = false; map.anisotropy = 4; return map;
  };
  const font = (g, size) => { g.font = `500 ${size}px Space, Arial`; };
  // Shoulder flag (31–547 × 118–410 in the original layout).
  const flag = make(g => {
    g.fillStyle = '#1a2429'; g.fillRect(31, 118, 516, 292);
    g.fillStyle = '#cfff04'; g.fillRect(31, 118, 22, 292); g.fillRect(31, 388, 516, 22);
    if (mark) g.drawImage(mark, 78, 158, 150, 152);
    g.fillStyle = '#f1f0e5'; font(g, 64); g.fillText('SENTIENT', 248, 250, 280);
    g.fillStyle = '#a8b4ad'; font(g, 30); g.fillText('USS SENTIENT · EVA', 250, 300, 280);
  });
  // Mission patch: an arched shield (110–475 × 70–460).
  const patch = make(g => {
    const shield = (inset) => { g.beginPath(); g.moveTo(110 + inset, 460 - inset); g.lineTo(110 + inset, 255); g.arc(292, 255, 182 - inset, Math.PI, 0); g.lineTo(475 - inset, 460 - inset); g.closePath(); };
    shield(0); g.fillStyle = '#cfff04'; g.fill();
    shield(20); g.fillStyle = '#1a2429'; g.fill();
    if (mark) g.drawImage(mark, 222, 150, 140, 142);
    g.textAlign = 'center'; g.fillStyle = '#f1f0e5'; font(g, 40); g.fillText('EXP 001', 292, 350);
    g.fillStyle = '#cfff04'; font(g, 26); g.fillText('NO SIGNAL TOO SMALL', 292, 410, 300);
  });
  return { emusuitFLAGpatch: flag, emusuitvitruvianpatch: patch };
}

export async function addEvaSuits(ctx) {
  const { MODULES, colliders, beginModule, endSection, kit, materials: M, resourceGeometries, resourceMaterials, resourceTextures } = ctx;
  const base = import.meta.env?.BASE_URL || '/';
  const [gltf, mark] = await Promise.all([new GLTFLoader().loadAsync(`${base}${MODEL}`), sentientMark(base)]);
  const patches = patchTextures(mark);
  const template = gltf.scene;
  let patched = 0;
  template.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    resourceGeometries.add(o.geometry); resourceMaterials.add(o.material);
    const map = o.material.map, replacement = map && patches[map.name];
    if (replacement) { map.dispose(); o.material.map = replacement; o.material.needsUpdate = true; patched++; }
    if (o.material.map) resourceTextures.add(o.material.map);
    // A smoked visor still catches cabin light; pure black reads as a hole.
    if (o.material.name.includes('visor')) { o.material.color.set(0x2c3b41); o.material.metalness = .82; o.material.roughness = .1; o.material.envMapIntensity = 3; }
  });
  const stats = { suits: 0, triangles: 0, sentientPatches: patched, markLoaded: !!mark };
  template.traverse(o => { if (o.isMesh) stats.triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });

  /** Mount a suit with its pack against a wall; `yaw` turns the model's front. */
  function mount(parent, x, z, yaw, name) {
    const suit = template.clone(true); suit.name = name;
    suit.scale.setScalar(SCALE); suit.rotation.y = yaw;
    suit.position.set(x, .045 - BOUNDS.feet * SCALE, z);
    parent.add(suit); stats.suits++;
    return suit;
  }

  // Arrival suit stand: the pack backs onto the existing don/doff frame,
  // which sits on the east wall beside the airlock passage.
  const arrival = MODULES.find(m => m.id === 'front-door');
  const parent = beginModule(arrival);
  const wallFace = arrival.x + arrival.hx - .39, z = arrival.z + 1.33; // front of the stand's backboard
  const x = wallFace - BOUNDS.back * SCALE - .012;
  mount(parent, x, z, Math.PI / 2, 'Arrival / NASA EMU on don-doff stand');
  // Base plate and the two life-support pack brackets of the stand.
  kit.cuboid(x + .06, .022, z, .82, .045, .72, M.graphite);
  kit.cuboid(x + .06, .047, z, .76, .006, .66, M.seal);
  for (const side of [-1, 1]) kit.cuboid(wallFace - .07, 1.45, z + side * .17, .14, .06, .05, M.silver);
  endSection();
  colliders.push({ id: 'eva-suit-front-door', x: (x + BOUNDS.front * SCALE + wallFace) / 2, z, w: wallFace - (x + BOUNDS.front * SCALE), d: (BOUNDS.right - BOUNDS.left) * SCALE });
  return stats;
}
