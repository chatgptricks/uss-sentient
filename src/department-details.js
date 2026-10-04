import * as THREE from 'three';
import { modulePolygon } from './layout.js';

/**
 * Department-specific flight hardware. The seven real Sentient functions inform
 * these fictional instruments; every insert stays on a free SE/SW hull facet
 * (both Bridge inserts share its enlarged SW facet; its SE terminal stays clear).
 * All solid detail uses the world's box batches. No floor props or collisions.
 */
export function addDepartmentDetails(ctx) {
  const { rooms, MODULES, LINKS, localBox, mat, texture, textPlane, kit, materials: palette } = ctx;
  const { hull, enamel, padding, seal, graphite, silver, accent, whiteLight, blueLight, glass } = palette;
  const amber = mat({ color: 0xba8649, roughness: .56, metalness: .32 });
  const ceramic = mat({ color: 0x7d9696, roughness: .62, metalness: .2 });
  const fabric = mat({ color: 0xa9ab91, roughness: .98, metalness: 0 });
  const botanical = mat({ color: 0x537856, roughness: .8, metalness: 0 });
  const violet = mat({ color: 0x9ca1bd, roughness: .55, metalness: .16 });
  const TAU = Math.PI * 2;
  const statistics = { panels: 0, displays: 0, detailParts: 0 };

  function facet(module, side) {
    const points = modulePolygon(module), index = side > 0 ? 3 : 5;
    const a = points[index], b = points[index + 1];
    return {
      origin: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
      yaw: -Math.atan2(b.z - a.z, b.x - a.x),
      width: Math.hypot(b.x - a.x, b.z - a.z) - .18,
    };
  }
  function subfacet(surface, x, width) {
    return { ...surface, width, origin: { x: surface.origin.x + x * Math.cos(surface.yaw), z: surface.origin.z - x * Math.sin(surface.yaw) } };
  }
  function part(surface, x, y, z, w, h, d, material = graphite, rz = 0) {
    localBox(surface.origin, surface.yaw, x, y, z, w, h, d, material, rz);
    statistics.detailParts++;
  }
  function bolt(surface, x, y, z = .236) {
    if (kit) kit.localBolt(surface.origin, surface.yaw, x, y, z, silver, .018);
    else part(surface, x, y, z, .027, .027, .014, silver);
    part(surface, x, y, z + .008, .015, .004, .003, seal, Math.PI / 4);
  }
  function plate(surface, width, height, centerY = 1.40, material = enamel) {
    statistics.panels++;
    part(surface, 0, centerY, .159, width + .07, height + .07, .065, seal);
    part(surface, 0, centerY, .197, width, height, .036, material);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) bolt(surface, sx * (width / 2 - .045), centerY + sy * (height / 2 - .045));
    for (const sx of [-1, 1]) part(surface, sx * (width / 2 + .015), centerY, .234, .024, height - .08, .028, silver);
  }
  function vent(surface, x, y, width, height, count = 8) {
    part(surface, x, y, .24, width, height, .026, seal);
    for (let i = 0; i < count; i++) part(surface, x, y - height / 2 + (i + .5) * height / count, .26, width - .025, .009, .018, silver);
  }
  function control(surface, x, y, color = silver, scale = 1) {
    if (kit) {
      kit.localPipe(surface.origin, surface.yaw, [x, y, .226], [x, y, .260], .043 * scale, seal, 12);
      kit.localPipe(surface.origin, surface.yaw, [x, y, .255], [x, y, .285], .028 * scale, color, 12);
    } else {
      part(surface, x, y, .244, .084 * scale, .082 * scale, .034, seal);
      part(surface, x, y, .27, .056 * scale, .056 * scale, .03, color);
    }
    part(surface, x, y + .014 * scale, .288, .006, .021 * scale, .006, enamel);
  }
  function switches(surface, x, y, count, spacing = .135) {
    for (let i = 0; i < count; i++) {
      const px = x + i * spacing;
      part(surface, px, y, .247, .065, .115, .025, seal);
      part(surface, px, y + (i % 2 ? -.009 : .009), .274, .022, .062, .022, silver, i % 2 ? -.2 : .2);
      part(surface, px, y + .09, .255, .016, .013, .014, i % 3 ? blueLight : accent);
    }
  }
  function path(surface, points, color = graphite, width = .014, depth = .26) {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i];
      if (kit) kit.localPipe(surface.origin, surface.yaw, [ax, ay, depth], [bx, by, depth], width / 2, color, 8);
      else part(surface, (ax + bx) / 2, (ay + by) / 2, depth, Math.hypot(bx - ax, by - ay), width, width, color, Math.atan2(by - ay, bx - ax));
    }
  }
  function keyedStrip(surface, y, width) {
    part(surface, 0, y, .236, width, .16, .028, graphite);
    for (let i = 0; i < 14; i++) {
      part(surface, -width / 2 + .06 + i * (width - .12) / 13, y, .257, .025, i % 4 ? .062 : .092, .014, i % 5 ? silver : amber);
    }
  }
  function securedPack(surface, x, y, w, h, variant = fabric) {
    part(surface, x, y, .234, w, h, .10, variant);
    part(surface, x, y - h * .23, .288, w - .05, .019, .013, graphite);
    part(surface, x - w * .27, y, .292, .028, h + .025, .018, seal);
    part(surface, x + w * .27, y, .292, .028, h + .025, .018, seal);
    part(surface, x, y + h * .26, .289, w * .35, .07, .008, enamel);
    part(surface, x - w * .20, y - .01, .304, .049, .055, .02, silver);
  }

  function drawDisplay(room, paint) {
    return texture(1024, 720, (g, w, h) => {
      g.fillStyle = '#0d191c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#314347'; g.lineWidth = 2;
      for (let x = 35; x < w; x += 40) { g.beginPath(); g.moveTo(x, 155); g.lineTo(x, 630); g.stroke(); }
      for (let y = 155; y < 640; y += 40) { g.beginPath(); g.moveTo(35, y); g.lineTo(w - 35, y); g.stroke(); }
      g.fillStyle = '#cfff04'; g.font = '500 23px Space, Arial'; g.fillText(`USS SENTIENT / ${room.number}`, 38, 43);
      g.fillStyle = '#edf0e2'; g.font = '500 47px Space, Arial'; g.fillText(room.shortName.toUpperCase(), 36, 102, w - 72);
      g.fillStyle = '#aabfbb'; g.font = '400 20px Space, Arial'; g.fillText(room.function.toUpperCase(), 38, 137, w - 76);
      paint(g, w, h);
      g.fillStyle = '#0d191c'; g.fillRect(0, 646, w, 74);
      g.fillStyle = '#8ca5a3'; g.font = '400 17px Space, Arial'; g.fillText('DEPARTMENT HARDWARE / LOCAL SIMULATION', 38, 683);
      g.fillStyle = '#cfff04'; g.fillRect(w - 54, 666, 13, 13);
    });
  }
  function display(surface, room, paint, width, centerY = 1.62) {
    const height = width * 720 / 1024;
    part(surface, 0, centerY, .229, width + .07, height + .07, .056, seal);
    const map = drawDisplay(room, paint);
    const normal = new THREE.Vector3(Math.sin(surface.yaw), 0, Math.cos(surface.yaw));
    textPlane(map, width, height, surface.origin.x + normal.x * .263, centerY, surface.origin.z + normal.z * .263, surface.yaw);
    statistics.displays++;
  }
  function caption(g, text, x, y, color = '#a8c2c5', size = 20) { g.fillStyle = color; g.font = `400 ${size}px Space, Arial`; g.fillText(text, x, y); }
  function rule(g, x1, y1, x2, y2, color = '#89c8d6', width = 3) { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function circle(g, x, y, r, color = '#89c8d6', width = 3) { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }

  const painters = {
    'front-door': g => {
      caption(g, 'ACCOUNT NETWORK / TRANSIT OVERVIEW', 54, 195, '#dce3cc', 25);
      const nodes = [[205, 370], [390, 260], [425, 485], [630, 335], [810, 230], [840, 500]];
      for (const [a, b] of [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]]) rule(g, ...nodes[a], ...nodes[b], '#668d93', 4);
      nodes.forEach(([x, y], i) => { circle(g, x, y, 27, i === 0 ? '#cfff04' : '#bbd7d7', 5); caption(g, ['HUB', 'AI', 'TECH', 'MEDIA', 'CREATORS', 'CLIENTS'][i], x - 38, y + 55, '#d4dfd2', 18); });
      caption(g, 'SENTIENT ACCOUNTS', 56, 602, '#cfff04', 24); caption(g, 'PORTFOLIO / PEOPLE / PROPERTIES', 446, 602);
    },
    floor: g => {
      caption(g, 'CREATIVE PRODUCTION / SEQUENCE DESK', 54, 195, '#dce3cc', 25);
      const labels = ['SOURCE', 'DESIGN', 'MOTION', 'EXPORT'];
      labels.forEach((label, i) => {
        const y = 258 + i * 78; caption(g, label, 54, y + 10, '#d5dbce', 22);
        for (let j = 0; j < 6; j++) { g.fillStyle = ['#7dabae', '#b5b890', '#be9868', '#748d9e'][(j + i) % 4]; g.fillRect(205 + j * 116, y - 22, 84 + (i % 2) * 12, 37); }
      });
      rule(g, 623, 220, 623, 560, '#cfff04', 3); caption(g, 'SOCIAL BRAIN', 54, 608, '#cfff04'); caption(g, 'CHART ANIMATOR / PRODUCTION LIBRARY', 368, 608);
    },
    archive: g => {
      caption(g, 'INTELLIGENCE / INDEX & EVIDENCE', 54, 195, '#dce3cc', 25);
      for (let row = 0; row < 7; row++) for (let col = 0; col < 18; col++) { g.fillStyle = (row * 7 + col * 3) % 8 < 3 ? '#b4c7c4' : '#385a65'; g.fillRect(58 + col * 32, 235 + row * 39, 21, 24); }
      caption(g, 'CORTEX', 704, 267, '#cfff04', 29); caption(g, 'TRICKS DASH', 704, 325, '#c1d9d6', 25); caption(g, 'CASE STUDIES', 704, 383, '#c1d9d6', 25);
      for (let i = 0; i < 12; i++) rule(g, 707 + i * 16, 436, 707 + i * 16, 462 + i % 4 * 17, '#92b9d0', 7);
      caption(g, 'CAPTURE  →  INDEX  →  COMPARE  →  LEARN', 54, 607, '#d8e2d3', 24);
    },
    commons: g => {
      caption(g, 'SHARED SYSTEMS / RESOURCE CYCLE', 54, 195, '#dce3cc', 25);
      for (const [x, title, value, color] of [[225, 'AIR LOOP', 72, '#a8cbd5'], [512, 'WATER LOOP', 58, '#91b9a2'], [799, 'GROWTH LOOP', 86, '#cfff04']]) {
        circle(g, x, 372, 103, '#365052', 17); g.strokeStyle = color; g.lineWidth = 17; g.beginPath(); g.arc(x, 372, 103, -Math.PI / 2, -Math.PI / 2 + TAU * value / 100); g.stroke();
        caption(g, title, x - 79, 548, '#d7e1cf', 23); caption(g, `${value}%`, x - 52, 393, '#edf0e2', 43);
      }
      caption(g, 'ACCOUNT DECKS / CREATOR CONNECTIONS', 54, 608, '#cfff04', 24);
    },
    forum: g => {
      caption(g, 'STRATEGY / ROUTE PLANNING TABLE', 54, 195, '#dce3cc', 25);
      const px = x => 334 + x * 16, py = z => 266 - z * 9;
      for (const link of LINKS) { const a = MODULES.find(m => m.id === link.from), b = MODULES.find(m => m.id === link.to); rule(g, px(a.x), py(a.z), px(b.x), py(b.z), '#86a5a6', 7); }
      for (const module of MODULES) { g.fillStyle = module.id === 'forum' ? '#cfff04' : '#acc1bd'; g.fillRect(px(module.x) - 17, py(module.z) - 17, 34, 34); }
      caption(g, 'USE CASES', 656, 283, '#dbe4d2', 27); caption(g, 'PLAYBOOKS', 656, 363, '#dbe4d2', 27); caption(g, 'PROMPT SYSTEMS', 656, 443, '#dbe4d2', 27);
      caption(g, 'CHATGPT AT WORK / CONTENT FORMATS', 54, 608, '#cfff04', 23);
    },
    lab: g => {
      caption(g, 'EXPERIMENTS / ANALYSIS CHANNELS', 54, 195, '#dce3cc', 25);
      const bars = [34, 62, 88, 53, 111, 185, 286, 218, 145, 105, 46, 81, 167, 240, 131, 58, 38, 94, 72, 35];
      bars.forEach((height, i) => { g.fillStyle = i < 7 ? '#a3b7d5' : i < 13 ? '#c4a87c' : '#8fbdae'; g.fillRect(59 + i * 30, 550 - height, 18, height); });
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) circle(g, 751 + col * 67, 300 + row * 81, 19, ['#bbc6dd', '#d4b98d', '#afd5c4'][(row + col) % 3], 5);
      caption(g, 'NEO SOLUTIONS / CLIENT BUILDS', 54, 608, '#cfff04', 24);
    },
    bridge: g => {
      caption(g, 'SOL SENTIENT / ORBITAL SOLUTION', 54, 195, '#dce3cc', 25);
      const x = 350, y = 406;
      for (const radius of [56, 110, 162]) { g.save(); g.translate(x, y); g.scale(1.45, .72); circle(g, 0, 0, radius, '#617e7c', 2); g.restore(); }
      circle(g, x, y, 31, '#cfff04', 7); rule(g, x - 258, y, x + 258, y, '#789190', 2); rule(g, x, y - 171, x, y + 171, '#789190', 2);
      g.fillStyle = '#f2e8c8'; g.fillRect(x + 150, y - 55, 16, 16); rule(g, x + 158, y - 48, x + 250, y - 143, '#dddcc2', 3);
      caption(g, 'ORBIT / STABLE', 715, 286, '#cfff04', 23); caption(g, 'ATTITUDE / TRACK', 715, 361, '#c6dcdd', 22); caption(g, 'ARRAY / ALIGNED', 715, 436, '#c6dcdd', 22); caption(g, 'HULL / NOMINAL', 715, 511, '#c6dcdd', 22);
      caption(g, 'LEADERSHIP / PORTFOLIO / CAMPAIGN OPERATIONS', 54, 608, '#c7d7d2', 22);
    },
  };

  for (const module of MODULES) {
    const room = rooms.find(room => room.id === module.id);
    if (!room) continue;
    ctx.beginModule?.(module);
    let equipment = facet(module, 1), storage = facet(module, -1);
    if (module.id === 'bridge') {
      const wall = facet(module, -1), half = (wall.width - .10) / 2;
      equipment = subfacet(wall, -(half + .10) / 2, half);
      storage = subfacet(wall, (half + .10) / 2, half);
    }
    const width = Math.min(1.42, equipment.width - .08);
    plate(equipment, width, 1.67, 1.41, module.id === 'archive' ? ceramic : enamel);
    display(equipment, room, painters[room.id], width - .14, 1.65);
    // Fine pass: secured lower switchbank, power couplers, engraved keying and service runs.
    switches(equipment, -width / 2 + .13, .93, Math.floor((width - .12) / .135));
    vent(equipment, 0, .71, width - .17, .14, 5);
    keyedStrip(equipment, 2.15, width - .13);
    path(equipment, [[-width / 2 - .035, .68], [-width / 2 - .06, .60], [width / 2 + .04, .60], [width / 2 + .06, 1.12]], silver, .018, .208);

    const sw = Math.min(1.38, storage.width - .08);
    plate(storage, sw, 1.79, 1.37, module.id === 'commons' ? padding : graphite);
    const id = module.id;
    if (id === 'front-door') {
      for (const x of [-.31, .31]) for (const y of [.86, 1.43]) securedPack(storage, x, y, .49, .45, x < 0 ? fabric : padding);
      part(storage, 0, 1.96, .243, sw - .14, .36, .08, seal);
      vent(storage, -.27, 1.96, .43, .21, 7);
      control(storage, .15, 1.98, silver, 1.3); control(storage, .37, 1.98, amber, .8);
      path(storage, [[.48, 1.81], [.52, 1.75], [.52, .70], [.18, .62]], graphite, .024, .294);
    } else if (id === 'floor') {
      part(storage, 0, 1.38, .228, sw - .13, 1.51, .045, ceramic);
      for (let row = 0; row < 9; row++) for (let col = 0; col < 6; col++) part(storage, -.45 + col * .18, .77 + row * .135, .253, .018, .018, .012, seal);
      for (const [x, height, color] of [[-.37, .58, amber], [-.10, .8, silver], [.20, .46, amber], [.42, .70, silver]]) {
        part(storage, x, 1.47, .280, .045, height, .052, color, x * .17);
        part(storage, x, 1.47 + height / 2, .277, .16, .10, .05, color);
        part(storage, x, 1.47 - height / 2, .281, .085, .17, .06, seal);
        part(storage, x, 1.47, .307, .11, .025, .028, graphite);
      }
      for (let i = 0; i < 5; i++) { part(storage, -.44 + i * .22, .77, .264, .17, .21, .08, i % 2 ? padding : enamel); bolt(storage, -.44 + i * .22, .79, .309); }
    } else if (id === 'archive') {
      for (let row = 0; row < 6; row++) for (let col = 0; col < 3; col++) {
        const x = -.40 + col * .40, y = .73 + row * .237;
        part(storage, x, y, .25, .35, .193, .10, row % 2 ? seal : graphite);
        part(storage, x - .108, y, .307, .019, .12, .023, silver);
        part(storage, x + .084, y + .03, .307, .088, .030, .015, enamel);
        part(storage, x + .107, y - .044, .314, .017, .017, .008, (row + col) % 4 ? blueLight : accent);
      }
      vent(storage, 0, 2.09, sw - .18, .12, 5);
    } else if (id === 'commons') {
      // A sealed, secured plant cassette is wall hardware, not a loose planter.
      for (const x of [-.40, 0, .40]) {
        part(storage, x, 1.40, .235, .33, 1.06, .085, seal);
        part(storage, x, .88, .26, .34, .14, .11, ceramic);
        part(storage, x, 1.93, .25, .34, .10, .09, enamel);
        part(storage, x, 1.38, .273, .021, .83, .018, botanical);
        for (let i = 0; i < 5; i++) {
          const sign = i % 2 ? -1 : 1;
          part(storage, x + sign * .056, 1.11 + i * .15, .275, .145, .034, .035, botanical, sign * .47);
        }
        part(storage, x, 1.40, .313, .31, .97, .008, glass);
        for (const sign of [-1, 1]) part(storage, x + sign * .157, 1.40, .312, .014, 1.05, .024, silver);
      }
      path(storage, [[-.56, .75], [-.56, .64], [.53, .64], [.53, .78]], ceramic, .032, .27);
      for (const x of [-.38, 0, .38]) control(storage, x, .64, silver, .65);
      part(storage, 0, 2.10, .265, sw - .18, .025, .055, whiteLight);
    } else if (id === 'forum') {
      // A relief route board provides a second, recognizably strategic silhouette.
      const nodes = [[0, .73], [0, 1.09], [-.40, 1.09], [-.40, 1.50], [0, 1.50], [.40, 1.50], [0, 1.96]];
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 4], [1, 4], [4, 5], [4, 6]]) path(storage, [nodes[a], nodes[b]], silver, .032, .237);
      nodes.forEach(([x, y], i) => {
        part(storage, x, y, .27, .23, .19, .072, i === 4 ? ceramic : enamel);
        part(storage, x, y, .312, .16, .07, .015, i === 4 ? accent : seal);
        for (const sign of [-1, 1]) bolt(storage, x + sign * .077, y + .059, .312);
      });
      keyedStrip(storage, .58, sw - .14);
    } else if (id === 'lab') {
      for (let i = 0; i < 5; i++) {
        const x = -.48 + i * .24, material = [ceramic, violet, amber, silver, botanical][i];
        part(storage, x, 1.45, .26, .145, .85, .084, seal);
        if (kit) kit.localPipe(storage.origin, storage.yaw, [x, 1.135, .285], [x, 1.765, .285], .052, material, 12);
        else part(storage, x, 1.45, .290, .10, .63, .075, material);
        for (const y of [1.05, 1.86]) part(storage, x, y, .30, .16, .065, .065, silver);
        for (let j = 0; j < 6; j++) part(storage, x + .043, 1.20 + j * .085, .335, .034, .007, .006, enamel);
        part(storage, x, 1.45, .341, .13, .77, .006, glass);
        part(storage, x, 1.96, .285, .042, .037, .022, i % 2 ? blueLight : accent);
      }
      for (let i = 0; i < 3; i++) control(storage, -.40 + i * .40, .78, i === 1 ? amber : silver, 1.18);
      vent(storage, 0, .58, sw - .2, .11, 4);
    } else if (id === 'bridge') {
      for (const x of [-.32, .32]) {
        part(storage, x, 1.71, .246, .47, .64, .09, enamel);
        part(storage, x, 1.74, .304, .32, .32, .028, seal);
        for (let i = 0; i < 4; i++) part(storage, x - .112 + i * .075, 1.74, .326, .023, .21 - i * .025, .010, i === 2 ? accent : silver);
        control(storage, x, 1.46, silver, .72);
      }
      for (let i = 0; i < 4; i++) {
        const y = .74 + i * .14;
        part(storage, 0, y, .248, sw - .14, .102, .056, seal);
        part(storage, -.42, y, .284, .088, .018, .012, i % 2 ? blueLight : accent);
        for (let j = 0; j < 8; j++) part(storage, -.20 + j * .085, y, .284, .055, .038, .014, j % 3 ? silver : ceramic);
      }
      path(storage, [[-.58, .64], [-.61, 1.18], [-.48, 1.23], [.48, 1.23], [.61, 1.18], [.58, .64]], silver, .014, .295);
      keyedStrip(storage, 2.12, sw - .14);
    }
    // Second-detail pass across all unique cabinets: hinges, torque paint, labels
    // and standoffs sit within the same shallow depth budget as the equipment.
    for (const surface of [equipment, storage]) {
      for (const y of [.57, 1.05, 1.82, 2.21]) {
        part(surface, -.62, y, .224, .045, .13, .023, silver);
        part(surface, -.615, y, .239, .007, .037, .006, amber);
        bolt(surface, .62, y, .23);
      }
      part(surface, .35, .48, .232, .38, .062, .014, enamel);
      for (let i = 0; i < 10; i++) part(surface, .21 + i * .027, .48, .242, i % 3 ? .010 : .016, .039, .006, seal);
    }
    ctx.endSection?.();
  }
  return statistics;
}
