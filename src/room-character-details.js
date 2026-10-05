import * as THREE from 'three';
import { HULL_PROFILES, moduleEdges, moduleFacet, modulePolygon, insidePolygon } from './layout.js';

/** Authored equipment for the irregular bays. Semantic primary faces stay free. */
export function addRoomCharacterDetails(ctx) {
  const { MODULES, rooms, localBox, kit, mat, texture, addMesh, colliders, materials: M } = ctx;
  const stats = { profiles: [], parts: 0, ribs: 0, displays: 0, cargoCradles: 0, cableBanks: 0,
    toolCarriages: 0, specimenRacks: 0, samples: 0, seats: 0, plantTrays: 0, leaves: 0,
    surveyInstruments: 0, rails: 0, colliders: 0 };
  const atlas = texture(2048, 1024, (g, w, h) => {
    g.fillStyle = '#112027'; g.fillRect(0, 0, w, h);
    const labels = ['DOCK / CARGO', 'ARCHIVE / BUS', 'FABRICATION', 'SPECIMEN LOBE', 'STRATEGY ANNEX', 'HABITAT / GROW', 'PROW / SURVEY'];
    MODULES.forEach((module, index) => {
      const x = (index % 4) * 512, y = Math.floor(index / 4) * 512;
      const room = rooms.find(value => value.id === module.id);
      g.fillStyle = '#cfff04'; g.fillRect(x + 27, y + 27, 55, 7);
      g.fillStyle = '#e7ecdc'; g.font = '500 30px Space, Arial'; g.fillText(labels[index], x + 26, y + 81, 458);
      g.fillStyle = '#849f9f'; g.font = '400 17px Space, Arial'; g.fillText(HULL_PROFILES[module.id].name.toUpperCase(), x + 27, y + 112, 456);
      g.strokeStyle = '#334e55'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x + 35, y + 156 + i * 48); g.lineTo(x + 478, y + 156 + i * 48); g.stroke(); }
      if (module.id === 'forum') {
        const nodes = [[89, 239], [207, 174], [211, 373], [349, 263], [425, 377]];
        for (const [a, b] of [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]]) {
          g.strokeStyle = '#8badaf'; g.lineWidth = 5; g.beginPath(); g.moveTo(x + nodes[a][0], y + nodes[a][1]); g.lineTo(x + nodes[b][0], y + nodes[b][1]); g.stroke();
        }
        nodes.forEach(([nx, ny], i) => { g.fillStyle = i === 3 ? '#cfff04' : '#9bb5b1'; g.fillRect(x + nx - 17, y + ny - 14, 34, 28); });
      } else if (module.id === 'bridge' || module.id === 'lab') {
        for (let ring = 0; ring < 4; ring++) {
          g.strokeStyle = ring === 1 ? '#cfff04' : '#88b7c4'; g.lineWidth = 3;
          g.beginPath(); g.ellipse(x + 254, y + 286, 61 + ring * 33, 39 + ring * 21, -.37, 0, Math.PI * 2); g.stroke();
        }
        g.fillStyle = '#d2edaa'; g.beginPath(); g.arc(x + 251, y + 284, 15, 0, Math.PI * 2); g.fill();
      } else {
        for (let row = 0; row < 4; row++) {
          g.fillStyle = '#7d999c'; g.font = '400 16px Space, Arial'; g.fillText(['LOCK', 'FLOW', 'LINK', 'SAFE'][row], x + 37, y + 196 + row * 59);
          g.fillStyle = '#2b4449'; g.fillRect(x + 118, y + 176 + row * 59, 330, 25);
          g.fillStyle = row === index % 4 ? '#cfff04' : '#a2b3a4'; g.fillRect(x + 118, y + 176 + row * 59, 205 + (row + index) % 4 * 32, 25);
        }
      }
      g.fillStyle = '#cbd8c7'; g.font = '500 18px Space, Arial'; g.fillText(`${room.number} / SECURED / LOCAL SYSTEM`, x + 28, y + 468, 456);
    });
    // The eighth atlas tile supplies muted green to the real, curved leaf mesh.
    const x = 1536, y = 512, gradient = g.createLinearGradient(x, y, x + 512, y + 512);
    gradient.addColorStop(0, '#324b32'); gradient.addColorStop(.45, '#718b47'); gradient.addColorStop(1, '#afb376');
    g.fillStyle = gradient; g.fillRect(x, y, 512, 512);
    g.strokeStyle = '#92a566'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 257, y); g.lineTo(x + 257, y + 512); g.stroke();
    for (let i = 1; i < 9; i++) for (const side of [-1, 1]) {
      g.lineWidth = 2; g.beginPath(); g.moveTo(x + 257, y + i * 55); g.lineTo(x + 257 + side * 170, y + i * 55 - 62); g.stroke();
    }
  });
  const instrument = mat({ color: 0xffffff, map: atlas, emissive: 0xffffff, emissiveMap: atlas,
    emissiveIntensity: .13, metalness: .05, roughness: .67, side: THREE.DoubleSide });
  const B = (f, ...args) => { stats.parts++; localBox(f.origin, f.ry, ...args); };
  const P = (f, ...args) => { stats.parts++; kit.localPipe(f.origin, f.ry, ...args); };
  const point = (f, x, y, z) => kit.toWorld(f.origin, f.ry, [x, y, z]);
  function surface(edge) {
    return { edge, origin: { x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 },
      ry: -Math.atan2(edge.b.z - edge.a.z, edge.b.x - edge.a.x), length: Math.hypot(edge.b.x - edge.a.x, edge.b.z - edge.a.z) };
  }
  function atlasUV(tile, u, v) { return [(tile % 4 + .015 + u * .97) / 4, (1 - Math.floor(tile / 4)) / 2 + (.015 + v * .97) / 2]; }
  function display(f, tile, width, height, y, inset = .178) {
    B(f, 0, y, .138, width + .07, height + .07, .071, M.seal);
    const geometry = new THREE.PlaneGeometry(width, height), uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ...atlasUV(tile, uv.getX(i), uv.getY(i)));
    const mesh = addMesh(geometry, instrument); mesh.position.set(...point(f, 0, y, inset)); mesh.rotation.y = f.ry;
    mesh.castShadow = false; mesh.userData.excludeFromAO = true; stats.displays++;
  }
  function panel(f, width, y, height) {
    B(f, 0, y, .062, width + .07, height + .07, .065, M.seal);
    B(f, 0, y, .108, width, height, .054, M.enamel);
    for (const side of [-1, 1]) B(f, side * (width / 2 - .032), y, .151, .034, height - .035, .042, M.silver);
  }

  // New corners get deliberate collars rather than generic, identical posts.
  function ribs(module, expanded) {
    const polygon = modulePolygon(module);
    for (let i = 0; i < expanded.length - 1; i++) {
      const before = surface(expanded[i]), after = surface(expanded[i + 1]);
      let nx = Math.sin(before.ry) + Math.sin(after.ry), nz = Math.cos(before.ry) + Math.cos(after.ry);
      const magnitude = Math.hypot(nx, nz); nx /= magnitude || 1; nz /= magnitude || 1;
      const vertex = expanded[i].b, origin = { x: vertex.x + nx * .115, z: vertex.z + nz * .115 };
      if (!insidePolygon(origin.x, origin.z, polygon)) continue;
      const f = { origin, ry: Math.atan2(nx, nz) };
      B(f, 0, 1.32, 0, .078, 2.37, .069, M.enamel);
      B(f, 0, 1.32, .039, .038, 2.28, .017, M.seal);
      const bands = module.id === 'archive' ? 5 : module.id === 'commons' ? 2 : 3;
      for (let band = 0; band < bands; band++) {
        const y = .45 + band * 1.76 / Math.max(1, bands - 1);
        B(f, 0, y, .016, module.id === 'floor' ? .19 : .135, .065, .10, M.silver);
        B(f, 0, y, .072, .081, .027, .011, band === 1 && ['archive', 'forum'].includes(module.id) ? M.accent : M.seal);
      }
      if (module.id === 'lab' || module.id === 'bridge') for (const side of [-1, 1]) P(f, [side * .062, .36, .006], [side * .062, 2.39, .006], .014, M.silver, 10);
      if (module.id === 'floor' || module.id === 'forum') {
        B(f, -.060, 2.26, .036, .24, .038, .04, M.enamel, -.63);
        B(f, .035, .34, .036, .15, .038, .04, M.enamel, -.63);
      }
      stats.ribs++;
    }
  }
  function dock(f) {
    const width = Math.min(.68, f.length - .30);
    panel(f, width, 1.24, 1.31);
    for (const y of [.85, 1.45]) {
      B(f, 0, y, .112, width - .10, .48, .082, M.padding);
      for (const side of [-1, 1]) {
        B(f, side * width * .24, y, .164, .042, .49, .019, M.seal);
        B(f, side * width * .24, y - .06, .177, .063, .07, .004, M.silver);
      }
      B(f, 0, y - .235, .121, width + .02, .043, .114, M.silver);
      B(f, 0, y + .14, .158, width * .38, .07, .01, M.enamel);
    }
    stats.cargoCradles++;
  }
  function dataCabling(f) {
    const width = Math.min(.71, f.length - .29);
    panel(f, width, 1.34, 1.73);
    for (let line = 0; line < 5; line++) {
      const x = (line - 2) * width / 6;
      P(f, [x, .57, .143], [x, 1.33, .143], .012, line % 2 ? M.silver : M.seal, 8);
      P(f, [x, 1.33, .143], [x + .035, 1.53, .143], .012, line % 2 ? M.silver : M.seal, 8);
      P(f, [x + .035, 1.53, .143], [x + .035, 2.13, .143], .012, line % 2 ? M.silver : M.seal, 8);
      B(f, x, .61, .160, .063, .083, .032, M.graphite);
      B(f, x + .035, 2.09, .161, .049, .025, .02, line === 2 ? M.accent : M.enamel);
    }
    for (const y of [.76, 1.18, 1.86]) B(f, 0, y, .165, width - .045, .04, .019, M.silver);
    stats.cableBanks++;
  }
  function toolCarriage(f) {
    const width = Math.min(1.52, f.length - .36);
    for (const z of [.22, .62]) {
      P(f, [-width / 2, 2.40, z], [width / 2, 2.40, z], .028, M.silver, 10);
      for (const side of [-1, 1]) B(f, side * width / 2, 2.40, z, .13, .12, .115, M.graphite);
    }
    B(f, -.13, 2.355, .42, .43, .115, .52, M.enamel);
    for (const z of [.22, .62]) P(f, [-.35, 2.375, z], [.09, 2.375, z], .043, M.seal, 10);
    B(f, -.13, 2.27, .42, .24, .065, .29, M.graphite);
    for (const side of [-1, 1]) {
      P(f, [-.13 + side * .10, 2.27, .42], [-.13 + side * .10, 2.12, .42], .023, M.silver, 10);
      B(f, -.13 + side * .063, 2.10, .42, .10, .032, .063, M.seal);
    }
    for (let chain = 0; chain < 7; chain++) B(f, .15 + chain * .073, 2.37, .49, .06, .034, .11, M.seal);
    stats.toolCarriages++;
  }
  function specimenRack(f) {
    const width = Math.min(.74, f.length - .28);
    panel(f, width, 1.35, 1.55);
    const positions = [], normals = [];
    const base = new THREE.OctahedronGeometry(.074, 0);
    const vertices = base.getAttribute('position'), normal = base.getAttribute('normal');
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(.12, f.ry, -.22));
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (const y of [.83, 1.36, 1.89]) {
      B(f, 0, y - .17, .112, width - .055, .054, .12, M.graphite);
      for (const side of [-1, 1]) {
        const x = side * width * .245, center = point(f, x, y, .113);
        for (let i = 0; i < vertices.count; i++) {
          v.fromBufferAttribute(vertices, i); v.y *= 1.75; v.z *= .42; v.applyQuaternion(q); positions.push(v.x + center[0], v.y + center[1], v.z + center[2]);
          n.fromBufferAttribute(normal, i).set(n.x, n.y / 1.75, n.z / .42).normalize().applyQuaternion(q); normals.push(n.x, n.y, n.z);
        }
        for (const dx of [-.064, .064]) P(f, [x + dx, y - .115, .11], [x + dx, y + .13, .11], .009, M.silver, 8);
        B(f, x, y - .126, .124, .162, .025, .089, M.enamel);
        stats.samples++;
      }
    }
    base.dispose();
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    addMesh(geometry, M.accent).name = 'Secured non-terrestrial crystalline samples';
    stats.specimenRacks++;
  }
  function seat(module, f, ordinal) {
    const width = Math.min(.65, f.length - .30), polygon = modulePolygon(module);
    if (width < .40) return;
    // Conservative world-axis rectangles must fit fully inside the irregular
    // bay. The seat is freestanding, so its entire footprint shares this bound.
    let chosen;
    for (let inset = .40; inset <= .90; inset += .025) {
      const [x, , z] = point(f, 0, 0, inset), c = Math.abs(Math.cos(f.ry)), s = Math.abs(Math.sin(f.ry));
      const w = (width + .10) * c + .59 * s, d = (width + .10) * s + .59 * c;
      const corners = [-1, 0, 1].flatMap(sx => [-1, 0, 1].map(sz => [x + sx * w / 2, z + sz * d / 2]));
      if (!corners.every(([px, pz]) => insidePolygon(px, pz, polygon))) continue;
      if (colliders.some(other => !other.disabled && Math.abs(other.x - x) < (other.w + w) / 2 + .035 && Math.abs(other.z - z) < (other.d + d) / 2 + .035)) continue;
      chosen = { id: `character-commons-seat-${ordinal}`, x, z, w, d, inset }; break;
    }
    if (!chosen) return;
    const z = chosen.inset;
    B(f, 0, .46, z, width, .13, .47, M.padding);
    B(f, 0, .405, z, width + .04, .06, .48, M.enamel);
    B(f, 0, .80, z - .21, width - .035, .57, .11, M.padding);
    B(f, 0, 1.00, z - .145, width - .09, .045, .019, M.seal);
    for (const side of [-1, 1]) {
      P(f, [side * width * .31, .085, z - .13], [side * width * .31, .395, z + .13], .028, M.silver, 10);
      B(f, side * width * .31, .063, z, .15, .07, .42, M.graphite);
      P(f, [side * (width / 2 - .045), .56, z - .11], [side * (width / 2 - .045), .56, z + .18], .026, M.silver, 10);
    }
    const { inset, ...collider } = chosen; colliders.push(collider); stats.colliders++; stats.seats++;
  }
  function plantTray(f, ordinal) {
    const width = Math.min(.71, f.length - .30), y = 1.63;
    B(f, 0, y, .097, width, .108, .14, M.enamel);
    B(f, 0, y + .059, .097, width - .05, .014, .11, M.seal);
    P(f, [-width / 2 + .04, y - .068, .10], [width / 2 - .04, y - .068, .10], .013, M.silver, 8);
    const positions = [], uvs = [], indices = [];
    for (let plant = 0; plant < 3; plant++) {
      const x = (plant - 1) * width * .30;
      P(f, [x, y + .055, .10], [x, y + .38, .10], .007, M.graphite, 6);
      for (let leaf = 0; leaf < 5; leaf++) {
        const base = positions.length / 3, side = (leaf + plant + ordinal) % 2 ? 1 : -1;
        const rootY = y + .09 + leaf * .046, reach = .095 + (leaf % 2) * .025;
        for (let row = 0; row <= 5; row++) {
          const t = row / 5, spread = Math.sin(Math.PI * t) * .039;
          for (const edge of [-1, 0, 1]) {
            positions.push(...point(f, x + side * reach * t, rootY + t * .085 + edge * spread, .10 + Math.sin(Math.PI * t) * (edge ? .022 : .040)));
            uvs.push(...atlasUV(7, (edge + 1) / 2, t));
          }
        }
        for (let row = 0; row < 5; row++) for (let column = 0; column < 2; column++) {
          const a = base + row * 3 + column; indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
        }
        stats.leaves++;
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    addMesh(geometry, instrument).name = 'Crescent habitat leaf trays'; stats.plantTrays++;
  }
  function survey(f) {
    const width = Math.min(1.55, f.length - .33);
    P(f, [-width / 2, .37, .143], [width / 2, .37, .143], .025, M.silver, 10);
    for (const side of [-1, 1]) P(f, [side * width * .41, .19, .084], [side * width * .41, .37, .143], .017, M.enamel, 10);
    B(f, 0, .56, .099, .34, .20, .13, M.graphite);
    for (const side of [-1, 1]) {
      P(f, [side * .083, .565, .119], [side * .083, .565, .171], .052, M.silver, 12);
      P(f, [side * .083, .565, .169], [side * .083, .565, .176], .038, M.blueLight, 12);
    }
    B(f, 0, .688, .134, .14, .036, .06, M.enamel);
    stats.surveyInstruments++; stats.rails++;
  }

  for (let index = 0; index < MODULES.length; index++) {
    const module = MODULES[index], profile = HULL_PROFILES[module.id];
    if (!profile) continue;
    const expanded = moduleEdges(module).filter(edge => edge.expanded);
    // Exclude the semantic main face even if a future profile changes its index.
    const primary = moduleFacet(module, profile.face);
    const extras = expanded.filter(edge => !edge.primary).map(surface);
    if (!extras.length) continue;
    ctx.beginModule(module); ribs(module, expanded);
    const broad = [...extras].sort((a, b) => b.length - a.length), first = broad[0], second = broad[1] || first;
    if (module.id === 'front-door') {
      dock(first); dock(second);
      display(first, index, Math.min(.50, first.length - .34), .25, 2.02);
    } else if (module.id === 'archive') {
      dataCabling(first); dataCabling(second);
      display(broad[2] || first, index, .40, .33, 1.41);
    } else if (module.id === 'floor') {
      toolCarriage(first);
      panel(second, Math.min(.74, second.length - .30), 1.38, 1.2);
      for (let tool = 0; tool < 4; tool++) {
        const x = (tool - 1.5) * .13;
        P(second, [x, .97, .14], [x, 1.55 + (tool % 2) * .12, .14], .014, M.silver, 8);
        B(second, x, 1.59 + (tool % 2) * .12, .148, .085, .06, .04, M.graphite);
      }
      display(second, index, .44, .23, 1.90);
    } else if (module.id === 'lab') {
      specimenRack(first); specimenRack(second);
      display(broad[2] || first, index, .43, .41, 1.58);
    } else if (module.id === 'forum') {
      display(first, index, Math.min(.97, first.length - .32), .79, 1.58);
      for (const y of [1.02, 2.11]) B(first, 0, y, .15, Math.min(.99, first.length - .28), .045, .055, M.enamel);
      for (let control = 0; control < 6; control++) B(first, (control - 2.5) * .118, 1.075, .163, .076, .042, .025, control === 4 ? M.accent : M.silver);
      panel(second, Math.min(.64, second.length - .28), 1.34, 1.28);
      for (let row = 0; row < 4; row++) for (const side of [-1, 1]) B(second, side * .15, .95 + row * .26, .155, .23, .16, .043, row === 2 ? M.padding : M.seal);
    } else if (module.id === 'commons') {
      for (let i = 0; i < extras.length; i += 2) { seat(module, extras[i], i); plantTray(extras[i], i); }
      display(second, index, .43, .29, 2.13);
    } else if (module.id === 'bridge') {
      // All new panes remain clear: instruments and rails are below 0.71 m.
      for (const f of [first, second, extras.at(-1)]) survey(f);
      display(extras[0], index, .38, .16, .49, .178);
    }
    stats.profiles.push({ id: module.id, name: profile.name, extraFacets: extras.length,
      primarySpan: Math.hypot(primary.b.x - primary.a.x, primary.b.z - primary.a.z) });
    ctx.endSection();
  }
  return stats;
}
