import * as THREE from 'three';
import { moduleFacet } from './layout.js';

/** Secured botanical and laboratory hardware; all coordinates are local deck heights. */
export function addLifeScienceDetails(ctx) {
  const { MODULES, materials: M, mat, localBox, kit, addMesh, colliders, texture, textPlane } = ctx;
  const stats = { growRacks: 0, seedTrays: 0, plants: 0, leaves: 0, nutrientPods: 0, microscopes: 0, centrifuges: 0, specimens: 0, parts: 0, meshes: 0, colliders: 0 };
  const stem = mat({ color: 0x567344, roughness: .76, metalness: 0 });
  const leaves = [0x426c32, 0x739a42, 0x91aa56].map(color => mat({ color, roughness: .67, metalness: 0, side: THREE.DoubleSide }));
  const substrate = mat({ color: 0x3f4b3b, roughness: .98, metalness: 0 });
  const ceramic = mat({ color: 0x9baea1, roughness: .45, metalness: .04 });
  const nutrient = mat({ color: 0x96ad63, roughness: .39, metalness: 0 });
  const reagent = mat({ color: 0x7cabb2, roughness: .3, metalness: 0 });
  const specimenGlass = mat({ color: 0xc9ded6, transparent: true, opacity: .27, roughness: .12, metalness: .02, depthWrite: false });
  const leafBuffers = leaves.map(() => ({ positions: [], indices: [] }));
  const v = new THREE.Vector3(), matrix = new THREE.Matrix4(), quat = new THREE.Quaternion();

  function face(module, index, offset = 0) {
    const { a, b } = moduleFacet(module, index);
    const ry = -Math.atan2(b.z - a.z, b.x - a.x);
    return { origin: { x: (a.x + b.x) / 2 + offset * Math.cos(ry), z: (a.z + b.z) / 2 - offset * Math.sin(ry) }, ry };
  }
  const B = (s, x, y, z, w, h, d, material, rz = 0) => { localBox(s.origin, s.ry, x, y, z, w, h, d, material, rz); stats.parts++; };
  const P = (s, a, b, radius, material, sides = 10) => { kit.localPipe(s.origin, s.ry, a, b, radius, material, sides); stats.parts++; };
  function mesh(geometry, material, s, x, y, z, rx = 0) {
    const object = addMesh(geometry, material);
    object.position.set(...kit.toWorld(s.origin, s.ry, [x, y, z]));
    object.rotation.y = s.ry; object.rotateX(rx);
    if (material.transparent) object.castShadow = false;
    stats.meshes++; return object;
  }
  function boundary(module, s, x, z, w, d, id) {
    const p = kit.toWorld(s.origin, s.ry, [x, 0, z]);
    colliders.push({ id: `life-science-${id}`, x: p[0], z: p[2], w: Math.abs(Math.cos(s.ry)) * w + Math.abs(Math.sin(s.ry)) * d, d: Math.abs(Math.sin(s.ry)) * w + Math.abs(Math.cos(s.ry)) * d });
    stats.colliders++;
  }
  function label(s, title, sub, x, y, z, w = .43) {
    const map = texture(512, 128, (g, width, height) => {
      g.fillStyle = '#e0e3d6'; g.fillRect(0, 0, width, height);
      g.fillStyle = '#263931'; g.font = '500 35px Space, Arial'; g.fillText(title, 20, 48, width - 40);
      g.fillStyle = '#5a6d5a'; g.font = '400 20px Space, Arial'; g.fillText(sub, 21, 93, width - 42);
      g.fillStyle = '#708148'; g.fillRect(width - 29, 83, 11, 11);
    });
    textPlane(map, w, w / 4, ...kit.toWorld(s.origin, s.ry, [x, y, z]), s.ry);
  }

  // Curved indexed blades have a raised midrib and cupped margins. Geometry is
  // collected into three meshes for the entire garden, rather than one per leaf.
  function leaf(s, x, y, z, length, width, azimuth, pitch, variant) {
    const buffer = leafBuffers[variant], start = buffer.positions.length / 3;
    quat.setFromEuler(new THREE.Euler(pitch, s.ry + azimuth, 0, 'YXZ'));
    matrix.compose(new THREE.Vector3(...kit.toWorld(s.origin, s.ry, [x, y, z])), quat, new THREE.Vector3(1, 1, 1));
    for (let row = 0; row <= 8; row++) {
      const t = row / 8, breadth = Math.max(.001, Math.pow(Math.sin(Math.PI * t), .84) * width / 2);
      for (const side of [-1, 0, 1]) {
        const ridge = Math.sin(Math.PI * t) * (.014 + (side ? .0 : .012));
        v.set(side * breadth, ridge + t * t * .020, length * t).applyMatrix4(matrix);
        buffer.positions.push(v.x, v.y, v.z);
      }
    }
    for (let row = 0; row < 8; row++) for (let column = 0; column < 2; column++) {
      const a = start + row * 3 + column, b = a + 1, c = a + 3, d = c + 1;
      buffer.indices.push(a, c, b, b, c, d);
    }
    stats.leaves++;
  }
  function plant(s, x, y, z, seed) {
    const h = .27 + (seed % 3) * .023;
    P(s, [x, y, z], [x + .013, y + h, z], .007, stem, 6);
    for (let i = 0; i < 7; i++) {
      const angle = seed * .67 + i * 2.40;
      const nodeY = y + .055 + i * h * .107;
      const leafX = x + Math.sin(angle) * .030, leafZ = z + Math.cos(angle) * .030;
      P(s, [x, nodeY - .015, z], [leafX, nodeY, leafZ], .0037, stem, 6);
      leaf(s, leafX, nodeY, leafZ, .145 + ((i + seed) % 4) * .018, .090 + ((i * 3 + seed) % 4) * .014, angle, -.28 - i * .065, (seed + i) % leaves.length);
    }
    stats.plants++;
  }
  function growRack(module, s, centerX, index) {
    const width = 1.12;
    B(s, centerX, 1.29, .105, width, 2.30, .10, M.seal);
    B(s, centerX, .19, .47, width + .06, .20, .68, M.enamel);
    for (const side of [-1, 1]) {
      B(s, centerX + side * .574, 1.28, .48, .043, 2.35, .68, M.enamel);
      P(s, [centerX + side * .594, .39, .74], [centerX + side * .594, 2.37, .74], .021, M.silver);
      P(s, [centerX + side * .52, .27, .23], [centerX + side * .52, 2.34, .23], .018, ceramic);
      for (const y of [.65, 1.35, 2.08]) B(s, centerX + side * .518, y, .26, .068, .043, .05, M.graphite);
    }
    B(s, centerX, 2.42, .47, width + .06, .087, .71, M.enamel);
    B(s, centerX, 2.374, .44, .91, .019, .37, M.whiteLight);
    label(s, `BOTANY / 0${index + 1}`, 'ROOT ZONE / CLOSED WATER LOOP', centerX, 2.424, .831, .83);
    for (const [tier, y] of [.52, 1.12, 1.72].entries()) {
      B(s, centerX, y - .058, .47, width - .09, .095, .61, ceramic);
      B(s, centerX, y - .001, .47, width - .16, .025, .53, substrate);
      B(s, centerX, y - .074, .782, width - .11, .036, .024, M.silver);
      for (const x of [-.32, 0, .32]) for (const [row, z] of [.32, .62].entries()) {
        P(s, [centerX + x, y - .006, z], [centerX + x, y + .029, z], .061, M.graphite, 12);
        P(s, [centerX + x, y + .027, z], [centerX + x, y + .041, z], .044, substrate, 10);
        plant(s, centerX + x, y + .039, z, index * 19 + tier * 7 + Math.round((x + .32) * 12) + row);
      }
      P(s, [centerX - .52, y + .032, .23], [centerX + .52, y + .032, .23], .014, ceramic, 8);
      for (const x of [-.32, 0, .32]) P(s, [centerX + x, y + .032, .23], [centerX + x, y + .040, .32], .009, M.graphite, 8);
      if (tier < 2) B(s, centerX, y + .558, .44, .93, .020, .34, M.whiteLight);
      stats.seedTrays++;
    }
    for (let i = 0; i < 4; i++) {
      const x = centerX - .39 + i * .26;
      P(s, [x, .22, .62], [x, .39, .62], .082, ceramic, 16);
      P(s, [x, .26, .62], [x, .33, .62], .084, nutrient, 16);
      P(s, [x, .392, .62], [x, .419, .62], .073, M.graphite, 12);
      P(s, [x, .42, .62], [x, .45, .46], .011, M.graphite, 8);
      stats.nutrientPods++;
    }
    boundary(module, s, centerX, .47, 1.25, .88, `grow-${index}`);
    stats.growRacks++;
  }

  const commons = MODULES.find(module => module.id === 'commons');
  if (commons) {
    ctx.beginModule(commons);
    const north = face(commons, 0);
    growRack(commons, north, -1.63, 0); growRack(commons, north, 1.63, 1);
    // An enclosed return line links both rack bases; no loose roots or free liquid.
    P(north, [-1.63, .275, .20], [1.63, .275, .20], .021, ceramic, 10);
    for (const x of [-.72, .72]) {
      B(north, x, .275, .20, .069, .048, .050, M.graphite);
      P(north, [x, .275, .226], [x, .275, .247], .021, M.silver, 12);
    }
    for (const [index, buffer] of leafBuffers.entries()) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffer.positions, 3));
      geometry.setIndex(buffer.indices); geometry.computeVertexNormals();
      const foliage = addMesh(geometry, leaves[index]); foliage.name = 'Hydroponics / curved living foliage';
      stats.meshes++;
    }
    ctx.endSection();
  }

  const lab = MODULES.find(module => module.id === 'lab');
  if (lab) {
    ctx.beginModule(lab);
    // Offset toward the west end of the NW facet to clear the existing generators.
    const s = face(lab, 7, -.20), depth = .48;
    B(s, 0, .965, depth, 1.18, .083, .65, M.enamel);
    B(s, 0, 1.013, depth, 1.13, .012, .605, M.silver);
    B(s, 0, .906, .797, 1.16, .030, .035, M.graphite);
    for (const side of [-1, 1]) {
      B(s, side * .536, .505, depth, .055, .91, .58, M.enamel);
      B(s, side * .509, .315, .718, .055, .13, .11, M.graphite);
    }
    B(s, 0, .43, depth, 1.11, .043, .56, ceramic);
    label(s, 'MICROBIOLOGY / ANALYSIS', 'OPTICS / ROTOR / SAMPLE RETENTION', 0, .897, .821, .89);

    // Binocular microscope: optical head, articulated stand, specimen stage and turret.
    const mx = -.29, mz = .53;
    B(s, mx, 1.055, mz, .33, .069, .29, M.graphite);
    B(s, mx, 1.082, mz, .285, .035, .258, M.enamel);
    P(s, [mx, 1.08, mz - .115], [mx, 1.41, mz - .14], .038, M.enamel, 12);
    P(s, [mx, 1.39, mz - .14], [mx, 1.47, mz + .022], .046, M.enamel, 12);
    B(s, mx, 1.224, mz + .025, .258, .025, .206, M.graphite);
    B(s, mx, 1.239, mz + .04, .124, .009, .060, specimenGlass);
    P(s, [mx - .16, 1.22, mz - .057], [mx + .16, 1.22, mz - .057], .029, M.silver, 12);
    for (const side of [-1, 1]) {
      P(s, [mx + side * .152, 1.22, mz - .057], [mx + side * .177, 1.22, mz - .057], .053, M.graphite, 16);
      P(s, [mx + side * .041, 1.46, mz + .013], [mx + side * .041, 1.568, mz + .093], .030, M.graphite, 12);
      P(s, [mx + side * .041, 1.566, mz + .092], [mx + side * .041, 1.591, mz + .111], .039, M.enamel, 12);
      P(s, [mx + side * .041, 1.590, mz + .111], [mx + side * .041, 1.598, mz + .117], .027, M.seal, 12);
    }
    P(s, [mx, 1.382, mz + .020], [mx, 1.436, mz + .020], .074, M.graphite, 16);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3, x = mx + Math.sin(angle) * .046, z = mz + .020 + Math.cos(angle) * .046;
      P(s, [x, 1.326, z], [x, 1.391, z], .018, M.silver, 10);
      P(s, [x, 1.316, z], [x, 1.335, z], .021, i === 1 ? nutrient : M.graphite, 10);
    }
    stats.microscopes++;

    // Open benchtop centrifuge, with a recessed six-position rotor and hinged lid.
    const cx = .28, cz = .52;
    P(s, [cx, 1.035, cz], [cx, 1.229, cz], .193, M.enamel, 24);
    P(s, [cx, 1.216, cz], [cx, 1.241, cz], .175, M.graphite, 24);
    P(s, [cx, 1.239, cz], [cx, 1.255, cz], .115, M.silver, 20);
    P(s, [cx, 1.250, cz], [cx, 1.272, cz], .035, M.graphite, 12);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3, x = cx + Math.sin(angle) * .102, z = cz + Math.cos(angle) * .102;
      P(s, [x, 1.239, z], [x, 1.278, z], .027, i % 2 ? reagent : nutrient, 10);
      P(s, [x, 1.275, z], [x, 1.291, z], .030, M.enamel, 10);
    }
    P(s, [cx - .106, 1.25, cz - .171], [cx + .106, 1.25, cz - .171], .024, M.silver, 12);
    mesh(new THREE.TorusGeometry(.177, .014, 8, 28), M.enamel, s, cx, 1.443, cz - .184, -.12);
    mesh(new THREE.CircleGeometry(.169, 28), specimenGlass, s, cx, 1.443, cz - .185, -.12);
    B(s, cx, 1.127, cz + .190, .12, .052, .018, M.seal);
    for (const side of [-1, 1]) B(s, cx + side * .035, 1.127, cz + .202, .022, .015, .013, side > 0 ? M.accent : M.blueLight);
    stats.centrifuges++;

    // Retained glass specimen vessels live in the lower bench, above its shelf.
    for (let i = 0; i < 5; i++) {
      const x = -.41 + i * .205, z = .62;
      P(s, [x, .459, z], [x, .492, z], .078, M.graphite, 16);
      P(s, [x, .490, z], [x, .650, z], .045, i % 2 ? reagent : nutrient, 12);
      mesh(new THREE.CylinderGeometry(.065, .065, .24, 16, 1, true), specimenGlass, s, x, .612, z);
      P(s, [x, .727, z], [x, .760, z], .071, M.enamel, 16);
      B(s, x, .602, z + .066, .08, .046, .012, M.enamel);
      B(s, x, .600, z + .075, .04, .012, .004, M.graphite);
      stats.specimens++;
    }
    boundary(lab, s, 0, depth, 1.20, .67, 'lab-bench');
    ctx.endSection();
  }
  return stats;
}
