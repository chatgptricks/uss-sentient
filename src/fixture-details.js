import { moduleFacet, facetInset } from './layout.js';

/** Shallow mechanical surfaces for the cabin lighting to rake across.
 * All parts are batched through the existing builders and sit above head height.
 * Emitters and actual lights remain the responsibility of the world/lighting rig.
 */
export function addFixtureDetails(ctx) {
  const { MODULES, LINKS, box, localBox, kit, materials: M } = ctx;
  const stats = { moduleFixtures: 0, tunnelFixtures: 0, ceilingTrims: 0, vents: 0, parts: 0 };
  const B = (...args) => { stats.parts++; box(...args); };
  const L = (...args) => { stats.parts++; localBox(...args); };
  const P = (...args) => { stats.parts++; kit.pipe(...args); };

  // A countersunk retainer facing down, so its rim catches reflected cabin light.
  function downBolt(origin, ry, x, y, z, radius = .016) {
    const p = kit.toWorld(origin, ry, [x, y, z]);
    P([p[0], p[1] - .006, p[2]], [p[0], p[1] + .006, p[2]], radius, M.silver, 6);
    L(origin, ry, x, y - .0075, z, radius * .95, .004, .004, M.seal);
  }

  function moduleFixture(origin, ry, width, inset) {
    // The diffuser is the existing .065m-high whiteLight strip at y=2.85.
    // Back plate, black recess, then rolled edges remain separate physical layers.
    L(origin, ry, 0, 2.917, inset, width + .25, .055, .31, M.enamel);
    L(origin, ry, 0, 2.891, inset, width + .17, .032, .235, M.seal);
    for (const side of [-1, 1]) {
      L(origin, ry, 0, 2.849, inset + side * .112, width + .08, .089, .030, M.graphite);
      L(origin, ry, 0, 2.807, inset + side * .129, width + .10, .025, .041, M.enamel);
      // A narrow exposed fold gives the enclosure a bright metal edge.
      L(origin, ry, 0, 2.791, inset + side * .122, width + .045, .009, .012, M.silver);
      L(origin, ry, side * (width / 2 + .064), 2.858, inset, .098, .115, .295, M.enamel);
      L(origin, ry, side * (width / 2 + .070), 2.797, inset, .037, .010, .17, M.graphite);
      downBolt(origin, ry, side * (width / 2 + .070), 2.790, inset);
    }
    // Sparse glare-control blades break the diffuser into luminous cells.
    const divisions = Math.max(3, Math.round(width / .24));
    for (let i = 1; i < divisions; i++) {
      L(origin, ry, -width / 2 + width * i / divisions, 2.810, inset, .012, .041, .191, M.silver);
    }
    stats.moduleFixtures++;
  }

  function roofVent(module, dz) {
    const x = module.x, z = module.z + dz, w = .72, d = .32;
    B(x, 3.036, z, w + .10, .057, d + .09, M.seal);
    // Back wall stays above the fins; the gap is visible from oblique viewpoints.
    B(x, 3.021, z, w - .045, .018, d - .026, M.graphite);
    for (const side of [-1, 1]) {
      B(x + side * w / 2, 3.001, z, .038, .063, d + .038, M.enamel);
      B(x, 3.001, z + side * d / 2, w, .063, .038, M.enamel);
      B(x + side * (w / 2 - .025), 2.972, z, .016, .020, d - .01, M.silver, 0, side * .45);
    }
    for (let i = 0; i < 5; i++) B(x, 2.980, z - .113 + i * .0565, w - .09, .034, .015, M.silver, 0, 0, -.35);
    stats.vents++;
  }

  for (const module of MODULES) {
    ctx.beginModule(module);
    for (const index of [0, 2, 4, 6]) {
      const { a, b } = moduleFacet(module, index);
      const origin = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const ry = -Math.atan2(b.z - a.z, b.x - a.x);
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      // Shoulder rises .52m while moving inward by .23 times the wall radius.
      // Clearance includes the housing's .155m half-depth and top at y=2.945,
      // so its outer lip never disappears into the angled hull panel.
      // Existing world emitters use this same inset and retain their y=2.85.
      const inset = facetInset(module,moduleFacet(module,index));
      moduleFixture(origin, ry, Math.min(1.25, length - .35), inset);
    }

    // Preserve the three padded service covers and their existing release catches.
    // These folded lips frame only the covers' perimeter, exposing several normals
    // to the key light rather than drawing flat decorative lines on the ceiling.
    for (const dz of [-.93, 0, .93]) {
      for (const side of [-1, 1]) {
        B(module.x + side * .379, 2.894, module.z + dz, .029, .085, .838, M.seal);
        B(module.x + side * .363, 2.850, module.z + dz, .029, .031, .812, M.enamel, 0, side * .52);
        B(module.x + side * .348, 2.834, module.z + dz, .008, .008, .776, M.silver);
        B(module.x, 2.889, module.z + dz + side * .417, .72, .061, .026, M.seal);
        B(module.x, 2.848, module.z + dz + side * .403, .698, .025, .031, M.enamel, 0, 0, -side * .52);
      }
      stats.ceilingTrims++;
    }
    const ventZ = Math.min(1.72, module.hz * .77 - .31);
    roofVent(module, -ventZ); roofVent(module, ventZ);
    ctx.endSection();
  }

  for (const link of LINKS) {
    ctx.beginLink(link);
    const length = Math.hypot(link.b.x - link.a.x, link.b.z - link.a.z);
    const origin = { x: (link.a.x + link.b.x) / 2, z: (link.a.z + link.b.z) / 2 };
    const ry = Math.abs(link.a.x - link.b.x) > .01 ? Math.PI / 2 : 0;
    for (let rib = -length / 2 + .35; rib < length / 2; rib += 1.25) {
      const lampZ = rib + .33;
      // Match only existing fixtures that fit inside the tube, clear of hatch collars.
      if (lampZ + .29 < length / 2 - .12) {
        L(origin, ry, 0, 2.543, lampZ, .37, .037, .54, M.graphite);
        for (const side of [-1, 1]) {
          L(origin, ry, side * .161, 2.514, lampZ, .047, .058, .535, M.enamel);
          L(origin, ry, side * .143, 2.481, lampZ, .015, .012, .49, M.silver);
          L(origin, ry, 0, 2.510, lampZ + side * .246, .35, .061, .046, M.enamel);
          downBolt(origin, ry, 0, 2.475, lampZ + side * .249, .013);
        }
        for (const dz of [-.14, 0, .14]) L(origin, ry, 0, 2.487, lampZ + dz, .272, .033, .012, M.silver);
        stats.tunnelFixtures++;
      }
      // Rolled underside edges on the existing transverse pressure ribs.
      // The pipes below remain visible and nothing crosses the standing aisle.
      for (const side of [-1, 1]) {
        const p = kit.toWorld(origin, ry, [0, 2.525, rib + side * .049]);
        B(...p, 1.43, .022, .022, M.enamel, ry, 0, -side * .58);
      }
    }
    ctx.endSection();
  }
  return stats;
}
