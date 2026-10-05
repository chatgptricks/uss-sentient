import * as THREE from 'three';

// Equipment occupies the gaps in hull-details' 1.25 m service-panel rhythm.
// Only three existing finishes plus one shared instrument atlas are used.
const SYSTEMS = {
  'front-door--archive': { title: 'TRANSFER CONTROL', line: 'CARGO / CREW / RESCUE', equipment: ['rescue', 'canisters', 'cargo'], circuits: 2 },
  'archive--floor': { title: 'PRODUCTION FEED', line: 'TOOLS / MATERIAL TRANSFER', equipment: ['table', 'cargo', 'inspection'], circuits: 3 },
  'floor--lab': { title: 'UTILITY MANIFOLD', line: 'COOLANT / POWER / AIR', equipment: ['canisters', 'inspection', 'table'], circuits: 3 },
  'lab--forum': { title: 'SAMPLE TRANSFER', line: 'ISOLATION / DIAGNOSTICS', equipment: ['inspection', 'canisters', 'rescue'], circuits: 2 },
  'archive--forum': { title: 'NETWORK JUNCTION', line: 'ROUTING / MEMORY / COMMS', equipment: ['cargo', 'table', 'inspection'], circuits: 1 },
  'forum--commons': { title: 'LIFE SUPPORT', line: 'OXYGEN / WATER / HABITAT', equipment: ['canisters', 'rescue', 'table'], circuits: 2 },
  'forum--bridge': { title: 'COMMAND UPLINK', line: 'AVIONICS / FLIGHT SYSTEMS', equipment: ['inspection', 'cargo', 'table'], circuits: 3 },
};

/** Wall-mounted hall equipment, with no lights, floor obstacles or colliders. */
export function addCorridorDetails(ctx) {
  const { LINKS, MODULES, rooms, localBox, kit, texture, mat, addMesh, materials: M } = ctx;
  const stats = { links: 0, parts: 0, panels: 0, canisters: 0, inspectionWindows: 0, closedTables: 0,
    rescuePacks: 0, cargoRacks: 0, overheadCassettes: 0, grates: 0, sharedMaterials: 4, maxWallInset: .15 };
  const tileW = 384, tileH = 576;
  const atlas = texture(tileW * LINKS.length, tileH, (g, width, height) => {
    g.fillStyle = '#0b171d'; g.fillRect(0, 0, width, height);
    LINKS.forEach((link, index) => {
      const system = SYSTEMS[link.id] || SYSTEMS['archive--forum'];
      const left = index * tileW, inset = left + 22;
      const horizontal = Math.abs(link.a.x - link.b.x) > .01;
      const forward = horizontal ? link.b.x > link.a.x : link.b.z > link.a.z;
      const from = rooms.find(room => room.id === (forward ? link.from : link.to));
      const to = rooms.find(room => room.id === (forward ? link.to : link.from));
      g.fillStyle = '#cfff04'; g.fillRect(inset, 21, 43, 5);
      g.font = '500 23px Space, Arial'; g.fillStyle = '#edf0de'; g.fillText(system.title, inset, 62, tileW - 44);
      g.font = '400 12px Space, Arial'; g.fillStyle = '#97afaf'; g.fillText(system.line, inset, 88, tileW - 44);
      g.strokeStyle = '#31454a'; g.lineWidth = 2; g.strokeRect(inset, 111, tileW - 44, 285);
      const screenPoint = module => ({ x: left + 62 + (module.x + 11) * 11.2, y: 146 - module.z * 6.1 });
      // The same seven-module topology as the world, with this transfer tube lit.
      for (const other of LINKS) {
        const a = screenPoint(MODULES.find(module => module.id === other.from));
        const b = screenPoint(MODULES.find(module => module.id === other.to));
        g.strokeStyle = other === link ? '#cfff04' : '#48616a'; g.lineWidth = other === link ? 6 : 3;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
      for (const module of MODULES) {
        const point = screenPoint(module), room = rooms.find(room => room.id === module.id);
        g.fillStyle = module.id === link.from || module.id === link.to ? '#cfff04' : '#718989';
        g.fillRect(point.x - 6, point.y - 5, 12, 10);
        g.fillStyle = '#c9d4c9'; g.font = '500 13px Space, Arial'; g.fillText(room.number, point.x + 9, point.y - 8);
      }
      g.fillStyle = '#eceddf'; g.font = '500 21px Space, Arial';
      g.fillText(`← ${from.shortName.toUpperCase()}`, inset, 433, tileW - 44);
      g.fillText(`${to.shortName.toUpperCase()} →`, inset, 463, tileW - 44);
      g.fillStyle = '#91aaa9'; g.font = '400 12px Space, Arial'; g.fillText('HULL / FLOW / POWER', inset, 502);
      for (let bar = 0; bar < 3; bar++) {
        const x = inset + bar * 116;
        g.fillStyle = '#273b40'; g.fillRect(x, 517, 98, 9);
        g.fillStyle = bar === index % 3 ? '#cfff04' : '#95bfc3'; g.fillRect(x, 517, 70 + ((index + bar) % 3) * 8, 9);
      }
      g.font = '400 11px Space, Arial'; g.fillStyle = '#7e9290';
      g.fillText(`${String(index + 1).padStart(2, '0')} / PRESSURE TRANSFER / NOMINAL`, inset, 553, tileW - 44);
    });
  });
  const display = mat({ color: 0xffffff, map: atlas, emissive: 0xffffff, emissiveMap: atlas,
    emissiveIntensity: .24, roughness: .48, metalness: 0 });

  for (let index = 0; index < LINKS.length; index++) {
    const link = LINKS[index], system = SYSTEMS[link.id] || SYSTEMS['archive--forum'];
    const length = Math.hypot(link.b.x - link.a.x, link.b.z - link.a.z), half = link.width / 2;
    if (length < 2.2) continue;
    ctx.beginLink(link);
    const origin = { x: (link.a.x + link.b.x) / 2, z: (link.a.z + link.b.z) / 2 };
    const ry = Math.abs(link.a.x - link.b.x) > .01 ? Math.PI / 2 : 0;
    const L = (...args) => { stats.parts++; localBox(origin, ry, ...args); };
    const P = (...args) => { stats.parts++; kit.localPipe(origin, ry, ...args); };
    function face(side, at) {
      const point = kit.toWorld(origin, ry, [side * half, 0, at]);
      return { origin: { x: point[0], z: point[2] }, ry: ry - side * Math.PI / 2 };
    }
    function W(f, u, y, inset, w, h, d, material = M.enamel) {
      stats.parts++; localBox(f.origin, f.ry, u, y, inset, w, h, d, material);
    }
    function WP(f, a, b, radius, material = M.silver) {
      stats.parts++; kit.localPipe(f.origin, f.ry, a, b, radius, material, 10);
    }
    function caseFrame(f, cy, width = .44, height = .64) {
      W(f, 0, cy, .044, width, height, .066, M.seal);
      for (const side of [-1, 1]) {
        W(f, side * (width / 2 - .019), cy, .095, .038, height, .055);
        W(f, 0, cy + side * (height / 2 - .019), .095, width, .038, .055);
      }
    }
    function rescue(f) {
      caseFrame(f, 1.52, .44, .68);
      W(f, 0, 1.52, .095, .33, .53, .07);
      for (const side of [-1, 1]) {
        W(f, side * .093, 1.52, .136, .045, .52, .014, M.seal);
        W(f, side * .093, 1.48, .148, .063, .074, .004, M.silver);
      }
      W(f, 0, 1.765, .14, .14, .033, .014, M.silver);
      // Rescue-cross emboss and rolled retention handle, readable without text.
      W(f, 0, 1.60, .137, .098, .027, .009, M.seal);
      W(f, 0, 1.60, .139, .027, .098, .009, M.seal);
      WP(f, [-.066, 1.75, .132], [.066, 1.75, .132], .012);
      stats.rescuePacks++;
    }
    function canisters(f) {
      caseFrame(f, .77, .44, .34);
      for (const u of [-.125, 0, .125]) {
        WP(f, [u, .65, .087], [u, .86, .087], .052, M.enamel);
        WP(f, [u, .86, .087], [u, .904, .087], .027);
        W(f, u, .914, .085, .068, .025, .051, M.silver);
        W(f, u, .75, .142, .069, .055, .010, M.seal);
        stats.canisters++;
      }
      for (const y of [.665, .853]) W(f, 0, y, .140, .408, .024, .018, M.silver);
    }
    function table(f) {
      caseFrame(f, .766, .46, .352);
      // Hinges at the bottom and two recessed catches show that it is STOWED.
      W(f, 0, .766, .113, .365, .25, .052);
      for (const side of [-1, 1]) {
        WP(f, [side * .12 - .035, .61, .113], [side * .12 + .035, .61, .113], .024);
        W(f, side * .13, .868, .143, .046, .039, .009, M.seal);
        W(f, side * .13, .867, .149, .019, .021, .0005, M.silver);
      }
      W(f, 0, .75, .144, .145, .018, .006, M.silver);
      stats.closedTables++;
    }
    function cargo(f) {
      caseFrame(f, 1.55, .44, .72);
      for (let shelf = 0; shelf < 3; shelf++) {
        const y = 1.31 + shelf * .24;
        W(f, 0, y, .095, .348, .184, .072);
        W(f, 0, y + .016, .136, .295, .021, .018, M.seal);
        W(f, .104, y - .047, .143, .075, .038, .009, M.silver);
        W(f, -.119, y - .045, .143, .026, .05, .009, M.seal);
      }
      stats.cargoRacks++;
    }
    function inspection(f) {
      caseFrame(f, 1.57, .44, .65);
      W(f, 0, 1.57, .082, .343, .55, .029, M.seal);
      for (const u of [-.105, .072]) {
        WP(f, [u, 1.35, .113], [u, 1.79, .113], .025);
        for (const y of [1.40, 1.71]) W(f, u, y, .137, .085, .035, .024);
      }
      // The dark shallow opening and cross retainers read as a machinery recess,
      // without pretending a transparent pane exposes the outside of the hull.
      W(f, 0, 1.58, .135, .33, .026, .025, M.silver);
      W(f, -.016, 1.58, .148, .063, .072, .004, M.seal);
      stats.inspectionWindows++;
    }

    const gaps = [];
    for (let at = -length / 2 + 1.635; at + .23 <= length / 2 - .50; at += 1.25) gaps.push(at);
    if (!gaps.length) gaps.push(0);
    const first = gaps[0], last = gaps.at(-1);
    const builders = { rescue, canisters, table, cargo, inspection };
    builders[system.equipment[0]](face(-1, first));
    builders[system.equipment[1]](face(1, last));
    builders[system.equipment[2]](face(-1, last));

    const screenFace = face(1, first);
    caseFrame(screenFace, 1.58, .46, .74);
    const geometry = new THREE.PlaneGeometry(.395, .622), uv = geometry.getAttribute('uv');
    for (let vertex = 0; vertex < uv.count; vertex++) uv.setX(vertex, (index + .015 + uv.getX(vertex) * .97) / LINKS.length);
    uv.needsUpdate = true;
    const screen = addMesh(geometry, display);
    screen.position.set(...kit.toWorld(screenFace.origin, screenFace.ry, [0, 1.58, .149])); screen.rotation.y = screenFace.ry;
    screen.castShadow = false; screen.userData.excludeFromAO = true;
    screen.name = `${link.id} / ${system.title.toLowerCase()}`;
    stats.panels++;

    // One asymmetric overhead avionics cassette; bottom is at least 2.097 m.
    // Cable bridges run below the existing shoulder bundles, clear of lamps.
    const overheadAt = (index % 2 ? first : last), overheadSide = index % 2 ? 1 : -1;
    L(overheadSide * .355, 2.255, overheadAt, .39, .25, .48, M.seal);
    L(overheadSide * .355, 2.120, overheadAt, .34, .03, .43, M.enamel);
    for (const side of [-1, 1]) {
      L(overheadSide * .355 + side * .161, 2.163, overheadAt, .021, .073, .46, M.silver);
      L(overheadSide * .355, 2.147, overheadAt + side * .214, .30, .042, .027, M.silver);
    }
    for (let vent = 0; vent < 5; vent++) L(overheadSide * .355, 2.101, overheadAt - .12 + vent * .06, .24, .008, .018, M.seal);
    for (let cable = 0; cable < system.circuits; cable++) {
      const at = overheadAt + .33 + cable * .066;
      // Keep the complete bridge, including its collars, inside the hatch margin.
      if (at > length / 2 - .55) continue;
      P([-.62, 2.26, at], [.62, 2.26, at], .013, cable === 0 ? M.enamel : M.silver, 10);
      for (const side of [-1, 1]) L(side * .58, 2.26, at, .069, .06, .07, M.seal);
    }
    stats.overheadCassettes++;

    if (link.kind !== 'stairs') {
      for (const side of [-1, 1]) {
        const at = side * (length / 2 - .64), width = Math.min(1.50, link.width - .62);
        L(0, .008, at, width, .011, .18, M.seal);
        for (let slat = 0; slat < 8; slat++) L((slat - 3.5) * (width - .09) / 8, .016, at, .028, .007, .144, M.silver);
        for (const edge of [-1, 1]) L(0, .015, at + edge * .085, width - .028, .007, .017, M.enamel);
        stats.grates++;
      }
    }
    stats.links++;
    ctx.endSection();
  }
  return stats;
}
