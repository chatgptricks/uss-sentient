import { moduleFacet } from './layout.js';
import { corridorWindowAt } from './corridor-layout.js';

/** Fixed spacecraft detailing. It adds no collision volumes or moving door parts. */
export function addHullDetails(ctx) {
  const { MODULES, LINKS, rooms, box, localBox, mat, texture, textPlane, materials: M, kit } = ctx;
  const stats = { structural: 0, fine: 0, decals: 0 };
  let pass = 'structural';
  const B = (...args) => { stats[pass]++; box(...args); };
  const L = (...args) => { stats[pass]++; localBox(...args); };
  const P = (...args) => { stats[pass]++; kit.pipe(...args); };
  const LP = (...args) => { stats[pass]++; kit.localPipe(...args); };
  const bolt = (...args) => { stats[pass]++; kit.localBolt(...args); };
  const titanium = mat({ color: 0x889696, metalness: .83, roughness: .34 });
  const hose = mat({ color: 0x2a302f, metalness: .13, roughness: .86 });
  const brass = mat({ color: 0x9d937b, metalness: .71, roughness: .45 });
  const mutedMark = mat({ color: 0xc5c7b9, metalness: .12, roughness: .78 });
  const serviceMaps = new Map();

  function facets(module) {
    return Array.from({length:8}, (_, i) => {
      const {a,b} = moduleFacet(module, i);
      return {
        index: i, origin: { x:(a.x+b.x)/2, z:(a.z+b.z)/2 },
        ry:-Math.atan2(b.z-a.z,b.x-a.x), length:Math.hypot(b.x-a.x,b.z-a.z),
        port:module.ports.includes(({0:'N',2:'E',4:'S',6:'W'})[i]),
        window:i===7 || (module.id==='bridge' && [0,1,2].includes(i)),
      };
    });
  }

  function labelMap(title, sub = '', warning = false) {
    const key = `${title}|${sub}|${warning}`;
    if (!serviceMaps.has(key)) serviceMaps.set(key, texture(512, 128, (g, w, h) => {
      g.fillStyle = warning ? '#c9c7ac' : '#dadbd0'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#263234'; g.fillRect(0, 0, 10, h); g.font = '500 42px Space, Arial';
      g.fillText(title, 24, 58, w - 48);
      g.font = '400 23px Space, Arial'; g.fillStyle = '#53615c'; g.fillText(sub, 26, 99, w - 48);
      if (warning) { g.strokeStyle = '#565745'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10); }
    }));
    return serviceMaps.get(key);
  }
  function decal(facet, title, sub, x, y, z, w = .36, h = .09, warning = false) {
    const p = kit.toWorld(facet.origin, facet.ry, [x, y, z]);
    textPlane(labelMap(title, sub, warning), w, h, ...p, facet.ry); stats.decals++;
  }
  function tubeStyle(link) {
    if (link.to === 'commons' || link.from === 'commons') return 'habitat';
    if (link.to === 'bridge') return 'observatory';
    if (link.to === 'lab' || link.from === 'lab') return 'utility';
    if (link.to === 'floor' || link.from === 'floor') return 'production';
    return 'vault';
  }
  function hatchChevrons(facet) {
    for (const z of [.56, .82]) for (const side of [-1, 1]) {
      const p = kit.toWorld(facet.origin, facet.ry, [side * .09, .014, z]);
      B(...p, .25, .012, .034, M.accent, facet.ry - side * Math.PI / 4);
    }
    // Flush metal threshold tracks; the passage remains physically unobstructed.
    L(facet.origin, facet.ry, 0, .012, .26, 1.68, .018, .062, titanium);
  }

  // PASS ONE — readable systems, layered structural panels, and continuous services.
  for (const module of MODULES) {
    ctx.beginModule?.(module);
    const room = rooms.find(r => r.id === module.id);
    const faces = facets(module);
    const hx = module.hx ?? module.a, hz = module.hz ?? module.a;
    const run = Math.max(1.1, hz * .77 - .44), bundle = Math.min(hx * .49, hx * .77 - .50);
    for (const side of [-1, 1]) {
      // Three different pipe diameters make a legible overhead thermal/service bundle.
      const xs = [side * bundle, side * (bundle + .14), side * (bundle + .25)];
      for (let i = 0; i < xs.length; i++) {
        P([module.x + xs[i], 2.865, module.z - run], [module.x + xs[i], 2.865, module.z + run], [.047,.032,.023][i], [M.enamel,titanium,hose][i]);
      }
      // Open-sided cable trays sit between the pipes and the centre service spine.
      B(module.x + side * .63, 2.92, module.z, .22, .055, run * 2, M.seal);
      B(module.x + side * .755, 2.91, module.z, .026, .11, run * 2, titanium);
      B(module.x + side * .505, 2.91, module.z, .026, .11, run * 2, titanium);
      for (const dz of [-run + .24, 0, run - .24]) {
        B(module.x + side * (bundle + .11), 2.93, module.z + dz, .51, .09, .12, M.graphite);
        B(module.x + side * (bundle + .11), 2.825, module.z + dz, .49, .04, .105, titanium);
      }
    }
    // Two service junctions attach the overhead runs to the pressure structure.
    for (const dz of [-run, run]) {
      B(module.x - bundle - .12, 2.83, module.z + dz, .55, .20, .28, M.enamel);
      B(module.x - bundle - .12, 2.716, module.z + dz, .44, .024, .19, M.graphite);
      B(module.x + bundle + .09, 2.87, module.z + dz, .41, .15, .24, titanium);
    }
    // Flush deck inspection plates frame, rather than cover, the central module ID.
    for (const side of [-1, 1]) {
      B(module.x + side * 1.06, .008, module.z + .19, .61, .009, 1.36, M.seal);
      B(module.x + side * 1.06, .015, module.z + .19, .54, .01, 1.25, M.graphite);
      B(module.x + side * 1.06, .022, module.z + .19, .055, .008, .29, titanium);
      for (const dz of [-.36, .75]) B(module.x + side * 1.06, .023, module.z + dz, .43, .007, .035, M.silver);
    }

    for (const face of faces) {
      const { origin, ry, length, index } = face;
      if (face.port) { hatchChevrons(face); continue; }
      // The equipment agent owns the centres of SE/SW facets; these stay as edge frames.
      const equipmentFacet = index === 3 || index === 5;
      const terminalFacet = index === (module.id === 'bridge' ? 3 : 1);
      const clearWidth = length - .18;
      L(origin, ry, 0, .185, .090, clearWidth, .10, .07, titanium);
      L(origin, ry, 0, .335, .070, clearWidth - .04, .055, .075, M.seal);
      if (!terminalFacet) {
        // Low recirculation ducts with a distinctly recessed, finned face.
        L(origin, ry, 0, .48, .085, clearWidth - .05, .22, .075, M.graphite);
        L(origin, ry, 0, .48, .131, clearWidth - .17, .155, .018, M.seal);
        const fins = Math.max(4, Math.floor((clearWidth - .20) / .085));
        for (let k = 0; k < fins; k++) L(origin, ry, -.5 * (fins - 1) * .085 + k * .085, .48, .156, .021, .154, .035, titanium);
      }
      if (!face.window && !terminalFacet) {
        // Side rails around existing access doors add structure without replacing their faces.
        const borderX = length / 2 - .12;
        for (const side of [-1, 1]) {
          L(origin, ry, side * borderX, 1.43, .13, .07, 1.70, .105, M.enamel);
          L(origin, ry, side * (borderX - .038), 1.43, .187, .018, 1.54, .026, titanium);
          LP(origin, ry, [side * (borderX - .085), .66, .135], [side * (borderX - .085), 2.24, .135], .024, hose);
          for (const y of [.80, 1.65, 2.10]) L(origin, ry, side * (borderX - .085), y, .165, .09, .065, .066, titanium);
        }
        if (!equipmentFacet) {
          L(origin, ry, 0, 2.23, .13, Math.min(.94, length - .35), .10, .09, M.graphite);
          L(origin, ry, -.28, 2.23, .184, .045, .028, .018, M.blueLight);
          L(origin, ry, .28, 2.23, .184, .045, .028, .018, M.accent);
        }
      }
      // Bonding braid and service channels remain below the pressure roof seam.
      if (!terminalFacet) {
        L(origin, ry, 0, 2.405, .10, Math.max(.4, length - .32), .074, .084, M.graphite);
        LP(origin, ry, [-length / 2 + .25, 2.415, .156], [length / 2 - .25, 2.415, .156], .018, brass);
      }
      if (face.window && module.id !== 'bridge') {
        const isMain = module.id === 'bridge' && index === 0;
        const w = isMain ? 2.85 : Math.min(1.12, length - .46), h = isMain ? 1.62 : .94, cy = isMain ? 1.6 : 1.73;
        for (const side of [-1, 1]) {
          L(origin, ry, side * (w / 2 + .157), cy, .249, .075, .43, .073, M.graphite);
          L(origin, ry, side * (w / 2 + .157), cy, .294, .039, .16, .035, titanium);
        }
        // Mechanical shade cassette above the glazing, never across the view.
        L(origin, ry, 0, cy + h / 2 + .205, .135, Math.min(length - .08, w + .34), .11, .19, M.enamel);
        L(origin, ry, 0, cy + h / 2 + .146, .225, Math.min(length - .14, w + .25), .022, .028, M.seal);
      }
    }
    const labelFacet = faces.find(f => !f.port && !f.window && f.index !== 1 && f.index !== 3 && f.index !== 5);
    if (labelFacet) decal(labelFacet, `SECTOR ${room.number} / ${room.shortName.toUpperCase()}`, 'PRESSURE HULL ACCESS', 0, .64, .152, .56, .14);
    ctx.endSection?.();
  }

  for (const link of LINKS) {
    ctx.beginLink?.(link);
    const length = Math.hypot(link.b.x - link.a.x, link.b.z - link.a.z);
    const origin = { x: (link.a.x + link.b.x) / 2, z: (link.a.z + link.b.z) / 2 };
    const ry = Math.abs(link.a.x - link.b.x) > .01 ? Math.PI / 2 : 0;
    const half = link.width / 2, run = Math.max(.4, length / 2 - .45), style = tubeStyle(link);
    for (const side of [-1, 1]) {
      // Suspended, clamped pipe banks fit into the shoulder envelope of the tube.
      const pipeCount = style === 'utility' ? 3 : style === 'vault' ? 1 : 2;
      for (let i = 0; i < pipeCount; i++) LP(origin, ry, [side * (.49 + .11 * i), 2.365, -run], [side * (.49 + .11 * i), 2.365, run], [.037,.028,.022][i], [M.enamel,titanium,hose][i]);
      LP(origin, ry, [side * (half - .09), .19, -run], [side * (half - .09), .19, run], .03, titanium);
      for (let z = -run + .18; z <= run - .08; z += .85) {
        L(origin, ry, side * .60, 2.415, z, .41, .08, .10, M.graphite);
        L(origin, ry, side * .60, 2.325, z, .39, .033, .09, M.silver);
      }
      // Small inset service boxes break the tube walls without narrowing the aisle.
      for (let z = -run + .56; z < run - .12; z += 1.25) {
        if (corridorWindowAt(link, side, z, .345)) continue;
        L(origin, ry, side * (half - .024), 1.51, z, .105, 1.05, .69, M.seal);
        L(origin, ry, side * (half - .087), 1.51, z, .027, .94, .59, style === 'habitat' ? M.padding : style === 'production' ? M.graphite : M.enamel);
        if (style === 'production') {
          LP(origin, ry, [side * (half - .127), 1.50, z - .22], [side * (half - .127), 1.50, z + .22], .055, titanium);
          L(origin, ry, side * (half - .17), 1.50, z, .085, .18, .095, M.graphite);
          L(origin, ry, side * (half - .22), 1.50, z, .018, .12, .16, brass);
          L(origin, ry, side * (half - .123), 1.80, z, .022, .16, .40, M.enamel);
        } else if (style === 'utility') {
          for (const offset of [-.17,0,.17]) LP(origin, ry, [side * (half - .12), 1.08, z + offset], [side * (half - .12), 1.94, z + offset], .025, offset ? titanium : hose);
          for (const y of [1.2,1.8]) L(origin, ry, side * (half - .16), y, z, .055, .068, .48, M.graphite);
        } else if (style === 'habitat') {
          for (const offset of [-.17,.17]) L(origin, ry, side * (half - .115), 1.51, z + offset, .030, .92, .055, M.graphite);
          L(origin, ry, side * (half - .12), 1.48, z, .027, .055, .56, M.graphite);
          L(origin, ry, side * (half - .143), 1.48, z, .030, .105, .11, titanium);
        } else if (style === 'vault') {
          for (const y of [1.18,1.37,1.56,1.75]) {
            L(origin, ry, side * (half - .118), y, z, .023, .027, .46, M.graphite);
            L(origin, ry, side * (half - .130), y + .07, z - .19, .016, .025, .038, M.blueLight);
          }
        } else {
          L(origin, ry, side * (half - .115), 1.50, z, .016, .68, .028, titanium);
          L(origin, ry, side * (half - .115), 1.97, z, .016, .022, .46, M.blueLight);
        }
        L(origin, ry, side * (half - .112), 1.64, z + .16, .028, .19, .029, titanium);
        L(origin, ry, side * (half - .114), 1.16, z, .026, .036, .41, titanium);
      }
    }
    // Root owns stair treads; flush inspection plates are reserved for level tubes.
    for (let z = -run + .18; link.kind !== 'stairs' && z < run; z += .82) {
      L(origin, ry, 0, .010, z, .77, .012, .68, M.seal);
      L(origin, ry, 0, .017, z, .70, .011, .61, M.graphite);
      for (const side of [-1, 1]) L(origin, ry, side * .305, .025, z, .019, .006, .48, titanium);
    }
    ctx.endSection?.();
  }

  // PASS TWO — the same systems gain fasteners, retainers, latches and physical joints.
  pass = 'fine';
  for (const module of MODULES) {
    ctx.beginModule?.(module);
    const faces = facets(module), hx = module.hx ?? module.a, hz = module.hz ?? module.a;
    const run = Math.max(1.1, hz * .77 - .44), bundle = Math.min(hx * .49, hx * .77 - .50);
    for (const side of [-1, 1]) {
      for (const z of [-run + .25, 0, run - .25]) {
        // Paired saddles actually wrap the visible pipe assembly.
        for (const x of [side * bundle, side * (bundle + .14)]) {
          P([module.x + x, 2.866, module.z + z - .032], [module.x + x, 2.866, module.z + z + .032], x === side * bundle ? .054 : .039, M.graphite);
        }
        for (const dx of [-.18, .18]) {
          B(module.x + side * (bundle + .11) + dx, 2.793, module.z + z, .043, .028, .043, titanium);
          B(module.x + side * (bundle + .11) + dx, 2.776, module.z + z, .022, .009, .022, M.graphite);
        }
      }
      for (let z = -run + .14; z < run; z += .31) {
        B(module.x + side * .63, 2.882, module.z + z, .245, .017, .035, titanium);
        // Two thinner wire runs remain visible between the tray ties.
        P([module.x + side * .585, 2.867, module.z + z - .07], [module.x + side * .585, 2.867, module.z + z + .09], .012, hose, 6);
        P([module.x + side * .665, 2.867, module.z + z - .07], [module.x + side * .665, 2.867, module.z + z + .09], .012, brass, 6);
      }
    }
    // Quick-release catches on the central padded overhead panels.
    for (const dz of [-.93, 0, .93]) for (const dx of [-.25, .25]) {
      B(module.x + dx, 2.838, module.z + dz, .064, .025, .17, M.graphite);
      B(module.x + dx, 2.819, module.z + dz, .038, .017, .094, titanium);
    }
    for (const side of [-1, 1]) for (const dx of [-.225, .225]) for (const dz of [-.53, .91]) {
      B(module.x + side * 1.06 + dx, .027, module.z + dz, .033, .007, .033, titanium);
      B(module.x + side * 1.06 + dx, .031, module.z + dz, .020, .003, .004, M.seal);
    }
    for (const face of faces) {
      const { origin, ry, length, index } = face;
      if (face.port) {
        // Threshold registration marks outside the rounded leaf travel envelope.
        for (const x of [-.68, .68]) L(origin, ry, x, .028, .31, .062, .008, .16, mutedMark);
        continue;
      }
      if (index === (module.id === 'bridge' ? 3 : 1)) {
        // Only the upper terminal facet gets hull fasteners; the screen stays untouched.
        for (const side of [-1, 1]) bolt(origin, ry, side * (length / 2 - .2), 2.34, .072, titanium, .019);
        continue;
      }
      if (face.window) {
        if (module.id === 'bridge') continue;
        const isMain = module.id === 'bridge' && index === 0;
        const w = isMain ? 2.85 : Math.min(1.12, length - .46), h = isMain ? 1.62 : .94, cy = isMain ? 1.6 : 1.73;
        for (const side of [-1, 1]) {
          for (const sy of [-1, 1]) bolt(origin, ry, side * (w / 2 + .115), cy + sy * h * .33, .23, titanium, .024);
          for (const x of [-w * .29, 0, w * .29]) bolt(origin, ry, x, cy + side * (h / 2 + .09), .223, titanium, .021);
          // The latch pin and hinge boss are distinct from the existing handles.
          LP(origin, ry, [side * (w / 2 + .157), cy - .125, .334], [side * (w / 2 + .157), cy + .125, .334], .024, brass);
        }
        continue;
      }
      const edge = length / 2 - .12;
      for (const side of [-1, 1]) {
        for (const y of [.65, 1.10, 1.80, 2.25]) bolt(origin, ry, side * edge, y, .196, titanium, .020);
        // Cable identification bands and upper terminal couplers.
        for (const y of [.72, 1.43, 2.13]) {
          LP(origin, ry, [side * (edge - .085), y - .025, .135], [side * (edge - .085), y + .025, .135], .030, side < 0 ? mutedMark : M.graphite);
        }
        L(origin, ry, side * (edge - .085), 2.295, .14, .10, .09, .11, M.graphite);
      }
      for (const side of [-1, 1]) bolt(origin, ry, side * (length / 2 - .22), .48, .175, titanium, .018);
      if (index % 2 === 0 && index !== 4) {
        const x = Math.min(.38, length / 2 - .43);
        decal(face, 'SERVICE / 24 V', 'ISOLATE BEFORE ACCESS', x, .66, .159, .32, .08, true);
      }
      if (index === 3 || index === 5) continue;
      // Flat-wall access panel retaining hinges: a visible second level of physical detail.
      const panelWidth = Math.min(length - .24, index % 2 ? 1.05 : 1.62);
      for (const side of [-1, 1]) {
        L(origin, ry, -panelWidth / 2 + .075, 1.45 + side * .36, .184, .12, .065, .07, titanium);
        LP(origin, ry, [-panelWidth / 2 + .075, 1.45 + side * .36 - .052, .223], [-panelWidth / 2 + .075, 1.45 + side * .36 + .052, .223], .020, M.graphite);
        L(origin, ry, panelWidth / 2 - .078, 1.45 + side * .36, .164, .11, .09, .05, M.graphite);
        L(origin, ry, panelWidth / 2 - .078, 1.45 + side * .36, .201, .06, .044, .025, brass);
      }
    }
    ctx.endSection?.();
  }

  for (const link of LINKS) {
    ctx.beginLink?.(link);
    const length = Math.hypot(link.b.x - link.a.x, link.b.z - link.a.z);
    const origin = { x: (link.a.x + link.b.x) / 2, z: (link.a.z + link.b.z) / 2 }, ry = Math.abs(link.a.x - link.b.x) > .01 ? Math.PI / 2 : 0;
    const half = link.width / 2, run = Math.max(.4, length / 2 - .45);
    for (const side of [-1, 1]) {
      for (let z = -run + .18; z <= run - .08; z += .85) {
        for (const x of [side * .49, side * .60, side * .71]) LP(origin, ry, [x, 2.365, z - .025], [x, 2.365, z + .025], .043, M.graphite, 10);
        L(origin, ry, side * .6, 2.295, z, .25, .023, .045, titanium);
      }
      for (let z = -run + .56; z < run - .12; z += 1.25) {
        if (corridorWindowAt(link, side, z, .345)) continue;
        // All wall fasteners face inward toward the tube centre.
        const normalRy = ry - side * Math.PI / 2;
        const p = kit.toWorld(origin, ry, [side * (half - .13), 0, z]);
        const face = { origin: { x: p[0], z: p[2] }, ry: normalRy };
        for (const x of [-.23, .23]) for (const y of [1.08, 1.94]) bolt(face.origin, face.ry, x, y, .01, titanium, .017);
        L(origin, ry, side * (half - .123), 1.73, z - .16, .014, .021, .14, mutedMark);
        for (let i = 0; i < 5; i++) L(origin, ry, side * (half - .124), 1.31 + i * .038, z - .03, .015, .017, .30, M.graphite);
      }
    }
    // A single readable plate per link, kept modest beside the functional wayfinding UI.
    const p = kit.toWorld(origin, ry, [-half + .13, 0, 0]);
    const face = { origin: { x: p[0], z: p[2] }, ry: ry + Math.PI / 2 };
    const from = rooms.find(r => r.id === link.from), to = rooms.find(r => r.id === link.to);
    decal(face, `TUBE ${from.number} / ${to.number}`, 'PRESSURIZED TRANSFER', 0, 2.07, .002, .38, .095);
    ctx.endSection?.();
  }
  return stats;
}
