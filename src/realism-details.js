import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { moduleEdges } from './layout.js';
import { corridorWindowAt } from './corridor-layout.js';
import { createOccupancy, obbFromMatrix, frameObb, seededRandom } from './occupancy.js';

const TAU = Math.PI * 2;

/**
 * Lived-in crew layer: stowage bags, bungees, procedures, photos, safety kits,
 * intercoms, smoke detectors, utility outlets, vent streamers, sagging cable
 * runs, labels and wear. Everything is placed against wall space that is
 * measured to be free and backed by real hull, never into an aisle.
 */
export function addRealismDetails(ctx) {
  const { root, MODULES, LINKS, rooms, mat, texture, beginModule, beginLink, endSection, pendingBatches, resourceGeometries } = ctx;
  const stats = { items: 0, rejected: 0, bags: 0, bungees: 0, procedures: 0, photos: 0, fireKits: 0, intercoms: 0, smokeDetectors: 0,
    outlets: 0, dataPanels: 0, vents: 0, streamers: 0, cableRuns: 0, cables: 0, handrails: 0, pouches: 0, stickers: 0, firePorts: 0,
    labels: 0, grime: 0, floorWear: 0, leds: 0, dustMotes: 0, frames: 0, perModule: {}, drawCalls: 0, wallInsetMax: 0 };

  // 1. Measure what already exists. Huge structural shells (floors, roofs and
  //    sky) would cover the whole room, so they are not treated as obstacles.
  root.updateMatrixWorld(true);
  const occupancy = createOccupancy(1), worldMatrix = new THREE.Matrix4(), instance = new THREE.Matrix4();
  const consider = (elements, box) => {
    const o = obbFromMatrix(elements, box.min.toArray(), box.max.toArray());
    // Walls are long and tall; decks, ceilings and shells are wide in both
    // horizontal directions and would otherwise fill every room.
    if (!Number.isFinite(o.r) || o.u.filter((axis, i) => Math.abs(axis[1]) < .5 && o.e[i] > 1.2).length >= 2) return;
    occupancy.add(o);
  };
  for (const { parent, geometry, transforms } of pendingBatches()) {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    for (const transform of transforms) consider(worldMatrix.multiplyMatrices(parent.matrixWorld, transform).elements, geometry.boundingBox);
  }
  root.traverse(object => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (object.isInstancedMesh) for (let i = 0; i < object.count; i++) { object.getMatrixAt(i, instance); consider(worldMatrix.multiplyMatrices(object.matrixWorld, instance).elements, object.geometry.boundingBox); }
    else consider(object.matrixWorld.elements, object.geometry.boundingBox);
  });
  stats.obstacles = occupancy.size;

  // 2. Wall frames: x along the wall, y up from the deck, z out into the cabin.
  const frames = [];
  for (const module of MODULES) {
    const section = beginModule(module); endSection();
    moduleEdges(module).forEach((edge, i) => {
      const { a, b } = edge, length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < .55) return;
      frames.push({ id: `${module.id}-${i}`, kind: 'module', module, owner: module.id, edge, length, face: .02,
        origin: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, yaw: -Math.atan2(b.z - a.z, b.x - a.x), section });
    });
  }
  for (const link of LINKS) {
    const section = beginLink(link); endSection();
    const travelX = Math.abs(link.b.x - link.a.x) > .01, t = travelX ? Math.PI / 2 : 0, hw = link.width / 2;
    const center = { x: (link.a.x + link.b.x) / 2, z: (link.a.z + link.b.z) / 2 }, length = Math.hypot(link.b.x - link.a.x, link.b.z - link.a.z);
    for (const side of [-1, 1]) {
      const across = side * (hw - .02);
      frames.push({ id: `${link.id}-${side}`, kind: 'tube', link, side, owner: link.id, length, face: 0,
        origin: { x: center.x + across * Math.cos(t), z: center.z - across * Math.sin(t) },
        yaw: Math.atan2(-side * Math.cos(t), side * Math.sin(t)), section });
    }
  }
  stats.frames = frames.length;
  const v = new THREE.Vector3();
  // Frame point -> world point, including the stair/ramp shear of tube sections.
  function world(f, x, y, z) {
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    return v.set(f.origin.x + x * c + z * s, y, f.origin.z - x * s + z * c).applyMatrix4(f.section.matrixWorld).clone();
  }
  function backed(f, x, y, w, h) {
    for (const [sx, sy] of [[0, 0], [-.42, -.42], [.42, -.42], [-.42, .42], [.42, .42]]) {
      const p = world(f, x + sx * w, y + sy * h, f.face - .035);
      if (!occupancy.contains([p.x, p.y, p.z], .004)) return false;
    }
    return true;
  }
  /** Reserve a footprint if it is free, hull-backed and not in a corridor window. */
  function reserve(f, x, y, w, h, d, margin = .012) {
    if (Math.abs(x) + w / 2 > f.length / 2 - .06) return false;
    if (f.kind === 'tube' && corridorWindowAt(f.link, f.side, f.side * x, w / 2)) return false;
    const z = f.face + .004 + d / 2, p = world(f, x, y, z), o = frameObb({ x: p.x, z: p.z }, f.yaw, [0, p.y, 0], [w / 2, h / 2, d / 2]);
    // No growth towards the wall: the item is meant to touch the hull face.
    if (occupancy.overlaps(o, [margin, margin, .001]) || !backed(f, x, y, w, h)) { stats.rejected++; return false; }
    occupancy.add(o); stats.wallInsetMax = Math.max(stats.wallInsetMax, .004 + d);
    return true;
  }

  // 3. One shared atlas for every printed thing: procedures, photos, labels, wear.
  const regions = [], ATLAS = 2048;
  let shelfX = 0, shelfY = 0, shelfH = 0;
  function region(w, h, paint) {
    if (shelfX + w > ATLAS) { shelfX = 0; shelfY += shelfH + 2; shelfH = 0; }
    const r = { x: shelfX, y: shelfY, w, h, paint };
    shelfX += w + 2; shelfH = Math.max(shelfH, h); regions.push(r); return r;
  }
  const rand0 = seededRandom('sentient-atlas');
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  const font = (g, weight, size) => { g.font = `${weight} ${size}px Space, Arial`; };
  function barcode(g, x, y, w, h, r) {
    g.fillStyle = '#16191a'; let cx = x;
    while (cx < x + w - 3) { const bw = 1 + Math.floor(r() * 3); if (r() > .35) g.fillRect(cx, y, bw, h); cx += bw + 1 + Math.floor(r() * 2); }
  }
  function textLines(g, x, y, w, count, r, color = '#59605d', gap = 13) {
    g.fillStyle = color;
    for (let i = 0; i < count; i++) g.fillRect(x + (i % 4 === 0 ? 0 : 12), y + i * gap, (w - 12) * (.45 + r() * .5), 3);
  }
  const tags = Array.from({ length: 8 }, (_, i) => region(200, 130, (g, x, y, w, h) => {
    const r = seededRandom(`tag${i}`);
    g.fillStyle = '#f2f0e6'; g.fillRect(x, y, w, h); g.strokeStyle = '#2a3133'; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
    g.fillStyle = ['#2f5d8a', '#b2281f', '#3a6b3c', '#b48a24'][i % 4]; g.fillRect(x + 4, y + 4, w - 8, 24);
    g.fillStyle = '#f5f3ea'; font(g, 500, 16); g.fillText(['CTB 1.0', 'CTB 0.5', 'M-BAG', 'CTB 2.0'][i % 4], x + 10, y + 22);
    g.fillStyle = '#1d2326'; font(g, 500, 19); g.fillText(`SNT-${4400 + i * 37}-${String(i + 2).padStart(2, '0')}`, x + 10, y + 52);
    font(g, 400, 12); g.fillStyle = '#4b5352';
    g.fillText(['SPARE FILTERS ×4', 'HYGIENE / CREW B', 'CABLES · DATA', 'FOOD · DAY 41-47', 'TOOLS · TORQUE', 'MEDICAL · LEVEL 1', 'CLOTHING · CREW A', 'SCIENCE CONSUM.'][i], x + 10, y + 70);
    barcode(g, x + 10, y + 82, w - 20, 30, r); g.fillStyle = '#1d2326'; font(g, 400, 10); g.fillText(`0${70000 + i * 913}`, x + 12, y + 124);
  }));
  const procedureTitles = [['2.104', 'CO2 SCRUBBER BED SWAP'], ['4.210', 'HATCH SEAL INSPECTION'], ['1.007', 'EMERGENCY: RAPID DEPRESS'], ['3.330', 'WATER RECOVERY SAMPLE'],
    ['5.012', 'FIRE RESPONSE / PBA DON'], ['6.441', 'FILTER CASSETTE CLEAN'], ['2.880', 'DAILY PLANNING / CREW'], ['7.002', 'SAFE HAVEN ROUTE']];
  const procedures = procedureTitles.map(([code, title], i) => region(210, 280, (g, x, y, w, h) => {
    const r = seededRandom(`proc${i}`);
    g.fillStyle = '#f3f1e8'; g.fillRect(x, y, w, h);
    g.fillStyle = i === 2 || i === 4 ? '#c0352a' : ['#2f5d8a', '#4f7b57', '#a27c2c'][i % 3]; g.fillRect(x, y, w, 34);
    g.fillStyle = '#ffffff'; font(g, 500, 13); g.fillText(`SNT OPS ${code}`, x + 9, y + 15); font(g, 500, 10); g.fillText(title, x + 9, y + 29, w - 18);
    textLines(g, x + 12, y + 50, w - 30, 6, r);
    g.strokeStyle = '#8b918d'; g.lineWidth = 1;
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) g.strokeRect(x + 12 + col * 62, y + 136 + row * 17, 62, 17);
    g.fillStyle = '#6a706d'; for (let row = 0; row < 5; row++) g.fillRect(x + 16, y + 143 + row * 17, 30 + r() * 20, 3);
    for (let k = 0; k < 4; k++) { g.strokeStyle = '#3c4446'; g.strokeRect(x + 12, y + 232 + k * 11, 7, 7); }
    g.strokeStyle = '#2d4fa3'; g.lineWidth = 2; // pen ticks and a hand-written note
    for (let k = 0; k < 2 + (i % 3); k++) { g.beginPath(); g.moveTo(x + 12, y + 236 + k * 11); g.lineTo(x + 15, y + 239 + k * 11); g.lineTo(x + 21, y + 230 + k * 11); g.stroke(); }
    g.beginPath(); g.moveTo(x + 40, y + 252);
    for (let k = 0; k < 18; k++) g.lineTo(x + 40 + k * 7, y + 252 + Math.sin(k * 1.9 + i) * 3 - (k % 5 === 0 ? 4 : 0)); g.stroke();
    g.fillStyle = '#8b908c'; font(g, 400, 8); g.fillText('REV C · LAMINATED · DO NOT REMOVE', x + 12, y + h - 7);
  }));
  const photoPainters = [
    (g, x, y, w, h) => { g.fillStyle = '#05070c'; g.fillRect(x, y, w, h); const gr = g.createRadialGradient(x + w * .7, y + h * 1.25, h * .2, x + w * .7, y + h * 1.25, h * 1.05); gr.addColorStop(0, '#2c7cc4'); gr.addColorStop(.75, '#7fb6d9'); gr.addColorStop(.8, '#bfe3f2'); gr.addColorStop(.83, '#0000'); g.fillStyle = gr; g.fillRect(x, y, w, h); },
    (g, x, y, w, h) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#f2a65a'); gr.addColorStop(.6, '#e46b4a'); gr.addColorStop(1, '#5b2c43'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.fillStyle = '#2b1d2c'; g.beginPath(); g.moveTo(x, y + h); for (let k = 0; k <= 8; k++) g.lineTo(x + k * w / 8, y + h * (.55 + ((k * 37) % 7) / 25)); g.lineTo(x + w, y + h); g.fill(); },
    (g, x, y, w, h) => { g.fillStyle = '#070611'; g.fillRect(x, y, w, h); const gr = g.createRadialGradient(x + w * .45, y + h * .5, 4, x + w * .5, y + h * .5, h * .42); gr.addColorStop(0, '#d3a0ff'); gr.addColorStop(.7, '#6b3b9a'); gr.addColorStop(1, '#0000'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.strokeStyle = '#c8a46a'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + w * .5, y + h * .5, w * .42, h * .1, -.3, 0, TAU); g.stroke(); },
    (g, x, y, w, h) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#9cc3d6'); gr.addColorStop(1, '#e7e3d3'); g.fillStyle = gr; g.fillRect(x, y, w, h); for (let k = 0; k < 5; k++) { g.fillStyle = ['#2c3b48', '#7a3d2e', '#2f4d35', '#4d3d6b', '#24292c'][k]; const px = x + 18 + k * (w - 36) / 4; g.beginPath(); g.arc(px, y + h * .45, 9, 0, TAU); g.fill(); g.fillRect(px - 11, y + h * .45 + 11, 22, h * .45); } },
    (g, x, y, w, h) => { g.fillStyle = '#fbf8ee'; g.fillRect(x, y, w, h); g.lineWidth = 4; g.strokeStyle = '#e0a020'; g.beginPath(); g.arc(x + w * .82, y + h * .22, 14, 0, TAU); g.stroke(); g.strokeStyle = '#3b6fc0'; g.strokeRect(x + w * .2, y + h * .45, w * .5, h * .25); g.strokeStyle = '#c03a3a'; g.beginPath(); g.moveTo(x + w * .08, y + h * .57); g.lineTo(x + w * .2, y + h * .57); g.moveTo(x + w * .7, y + h * .57); g.lineTo(x + w * .9, y + h * .57); g.stroke(); g.strokeStyle = '#2f8a3a'; g.beginPath(); g.moveTo(x + 8, y + h * .9); for (let k = 0; k < 12; k++) g.lineTo(x + 8 + k * w / 12, y + h * (.86 + (k % 2) * .05)); g.stroke(); },
    (g, x, y, w, h) => { g.fillStyle = '#1d2833'; g.fillRect(x, y, w, h); const cx = x + w / 2, cy = y + h / 2, rad = Math.min(w, h) * .42; g.fillStyle = '#cfff04'; g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill(); g.fillStyle = '#142026'; g.beginPath(); g.arc(cx, cy, rad - 7, 0, TAU); g.fill(); g.fillStyle = '#e8ebe0'; g.beginPath(); g.arc(cx - 6, cy + 4, rad * .45, 0, TAU); g.fill(); g.fillStyle = '#cfff04'; font(g, 500, 11); g.textAlign = 'center'; g.fillText('SENTIENT · EXP 001', cx, cy - rad * .55); g.textAlign = 'left'; },
    (g, x, y, w, h) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#8fc4e8'); gr.addColorStop(.5, '#3f8fb5'); gr.addColorStop(.62, '#e6d7a8'); gr.addColorStop(1, '#d8c690'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.fillStyle = '#ffffffaa'; g.fillRect(x, y + h * .5, w, 2); },
    (g, x, y, w, h) => { g.fillStyle = '#a8c7a0'; g.fillRect(x, y, w, h); for (let k = 0; k < 9; k++) { g.fillStyle = k % 2 ? '#2f5a35' : '#3d6e3f'; const px = x + 8 + k * (w - 16) / 8; g.beginPath(); g.moveTo(px, y + h * .25); g.lineTo(px - 12, y + h * .9); g.lineTo(px + 12, y + h * .9); g.fill(); } },
  ];
  const photos = photoPainters.map((paint, i) => region(i === 5 ? 180 : 200, i === 5 ? 180 : 150, (g, x, y, w, h) => {
    g.fillStyle = '#f4f2ea'; g.fillRect(x, y, w, h); paint(g, x + 9, y + 9, w - 18, h - (i === 5 ? 18 : 30));
    if (i !== 5) { g.fillStyle = '#6b6f6c'; font(g, 400, 11); g.fillText(['HOME', 'MOUNTAIN HUT', 'PELAGIA · DAY 3', 'CREW · LAUNCH', 'BY MAYA, 6', '', 'BEACH, AUG', 'SIERRA TRAIL'][i], x + 11, y + h - 9); }
    g.fillStyle = '#c9cbc4b8'; g.fillRect(x + w * .38, y - 1, w * .24, 13); // tape
  }));
  const warningSpecs = [['#e2b52a', '#16191a', 'CAUTION', 'HOT SURFACE'], ['#e2b52a', '#16191a', 'CAUTION', 'PINCH POINT'], ['#f2f0e6', '#b2281f', 'NO STOWAGE', 'KEEP CLEAR'],
    ['#2f5d8a', '#f2f0e6', 'ESD', 'SENSITIVE PARTS'], ['#f2f0e6', '#16191a', 'AIR INLET', 'DO NOT BLOCK'], ['#e2b52a', '#16191a', 'CAUTION', '28 VDC / 15 A'],
    ['#b2281f', '#f2f0e6', 'SHUTOFF', 'VALVE  ↓'], ['#f2f0e6', '#2f5d8a', 'POTABLE', 'WATER LINE']];
  const warnings = warningSpecs.map(([bg, fg, top, bottom], i) => region(180, 96, (g, x, y, w, h) => {
    g.fillStyle = bg; g.fillRect(x, y, w, h); g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    if (bg === '#e2b52a') { g.fillStyle = fg; g.beginPath(); g.moveTo(x + 30, y + 18); g.lineTo(x + 50, y + 56); g.lineTo(x + 10, y + 56); g.closePath(); g.fill(); g.fillStyle = bg; g.fillRect(x + 28, y + 30, 4, 14); g.fillRect(x + 28, y + 47, 4, 4); }
    const left = bg === '#e2b52a' ? 60 : 14;
    g.fillStyle = fg; font(g, 500, 22); g.fillText(top, x + left, y + 40, w - left - 10); font(g, 500, 14); g.fillText(bottom, x + left, y + 66, w - left - 10);
    font(g, 400, 9); g.fillText(`SNT-LBL-${310 + i}`, x + left, y + 84);
  }));
  const firePortLabel = region(150, 120, (g, x, y, w, h) => {
    g.fillStyle = '#f2f0e6'; g.fillRect(x, y, w, h); g.strokeStyle = '#b2281f'; g.lineWidth = 9; g.beginPath(); g.arc(x + w / 2, y + 52, 32, 0, TAU); g.stroke();
    g.fillStyle = '#b2281f'; font(g, 500, 19); g.textAlign = 'center'; g.fillText('FIRE PORT', x + w / 2, y + 108); g.textAlign = 'left';
  });
  const fireBoard = region(260, 120, (g, x, y, w, h) => {
    g.fillStyle = '#b2281f'; g.fillRect(x, y, w, h); g.strokeStyle = '#f2f0e6'; g.lineWidth = 4; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
    g.fillStyle = '#f2f0e6'; font(g, 500, 34); g.fillText('PFE · PBA', x + 18, y + 52); font(g, 500, 14); g.fillText('FIRE EXTINGUISHER / BREATHING', x + 18, y + 78, w - 34); font(g, 400, 12); g.fillText('PULL PIN · AIM AT PORT · 1 MIN', x + 18, y + 100, w - 34);
  });
  const egress = [1, -1].map(dir => region(256, 64, (g, x, y, w, h) => {
    g.fillStyle = '#d6f2c6'; g.fillRect(x, y, w, h); g.fillStyle = '#1f5130';
    for (let k = 0; k < 3; k++) { const ax = dir > 0 ? x + 150 + k * 30 : x + w - 150 - k * 30; g.beginPath(); g.moveTo(ax, y + 12); g.lineTo(ax + dir * 22, y + 32); g.lineTo(ax, y + 52); g.lineTo(ax - dir * 8, y + 52); g.lineTo(ax + dir * 14, y + 32); g.lineTo(ax - dir * 8, y + 12); g.fill(); }
    font(g, 500, 24); g.fillText('EGRESS', dir > 0 ? x + 16 : x + w - 110, y + 41);
  }));
  const smallLabels = ['ATU · CH 03', 'SMOKE DET', 'UOP 120 V', 'DATA · ETH', 'HR'].map((text, i) => region(140, 40, (g, x, y, w, h) => {
    g.fillStyle = i === 1 ? '#e8e6dc' : '#1f2629'; g.fillRect(x, y, w, h); g.fillStyle = i === 1 ? '#1f2629' : '#e7eadf'; font(g, 500, 17); g.fillText(text, x + 9, y + 27, w - 16);
  }));
  const frameLabels = new Map();
  for (const f of frames) {
    const room = rooms.find(room => room.id === f.owner), n = room ? room.number : 'T';
    const code = f.kind === 'module' ? `SNT1-${n}-${['F', 'FS', 'S', 'AS', 'A', 'AP', 'P', 'FP'][f.edge.face]}${f.edge.primary ? '' : 'x'}${f.edge.index % 8}` : `SNT1-${f.link.from.slice(0, 2).toUpperCase()}${f.link.to.slice(0, 2).toUpperCase()}-${f.side > 0 ? 'S' : 'P'}`;
    frameLabels.set(f, region(172, 42, (g, x, y, w, h) => {
      g.fillStyle = '#e9e7dc'; g.fillRect(x, y, w, h); g.fillStyle = '#29323a'; g.fillRect(x, y, 8, h);
      font(g, 500, 19); g.fillText(code.toUpperCase(), x + 15, y + 27, w - 22);
    }));
  }
  const grimeBands = Array.from({ length: 4 }, (_, i) => region(512, 64, (g, x, y, w, h) => {
    const r = seededRandom(`grime${i}`);
    for (let k = 0; k < 90; k++) {
      const px = x + r() * w, py = y + h * (.35 + r() * .65), rad = 6 + r() * 26;
      const gr = g.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, `rgba(48,44,36,${.05 + r() * .08})`); gr.addColorStop(1, 'rgba(48,44,36,0)');
      g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(40,38,32,${.05 + r() * .07})`; g.lineWidth = 1 + r() * 2; const px = x + r() * w; g.beginPath(); g.moveTo(px, y + h - 2); g.lineTo(px + (r() - .5) * 40, y + h * (.4 + r() * .4)); g.stroke(); }
  }));
  const smudges = Array.from({ length: 3 }, (_, i) => region(128, 128, (g, x, y, w, h) => {
    const r = seededRandom(`smudge${i}`);
    for (let k = 0; k < 9; k++) {
      const px = x + w * (.25 + r() * .5), py = y + h * (.25 + r() * .5), rad = 8 + r() * 14;
      const gr = g.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, 'rgba(56,52,44,.13)'); gr.addColorStop(1, 'rgba(56,52,44,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, rad, rad * .7, r() * 3, 0, TAU); g.fill();
    }
  }));
  const scuffs = Array.from({ length: 4 }, (_, i) => region(256, 128, (g, x, y, w, h) => {
    const r = seededRandom(`scuff${i}`);
    for (let k = 0; k < 16; k++) {
      g.strokeStyle = i === 3 ? `rgba(190,196,188,${.05 + r() * .07})` : `rgba(14,14,12,${.06 + r() * .1})`; g.lineWidth = 1 + r() * 4;
      const cx = x + w * (.2 + r() * .6), cy = y + h * (.3 + r() * .4), rad = 20 + r() * 50, a0 = r() * TAU;
      g.beginPath(); g.arc(cx, cy, rad, a0, a0 + .4 + r() * 1.2); g.stroke();
    }
  }));
  const atlas = texture(ATLAS, ATLAS, g => {
    g.clearRect(0, 0, ATLAS, ATLAS);
    for (const r of regions) { g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); r.paint(g, r.x, r.y, r.w, r.h); g.restore(); }
  });
  atlas.anisotropy = 8;

  // 4. Shared resources: a small palette of physical surface types.
  const geo = g => { resourceGeometries.add(g); if (!g.boundingBox) g.computeBoundingBox(); return g; };
  const G = { box: geo(new THREE.BoxGeometry(1, 1, 1)), soft: geo(new RoundedBoxGeometry(1, 1, 1, 3, .2)), cyl: geo(new THREE.CylinderGeometry(1, 1, 1, 14)),
    rod: geo(new THREE.CylinderGeometry(1, 1, 1, 7)), ball: geo(new THREE.SphereGeometry(1, 12, 8)) };
  const loader = new THREE.TextureLoader();
  const weave = loader.load(`${import.meta.env?.BASE_URL || '/'}textures/habitation/fabric_pattern_07_nor_gl_1k.jpg`);
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.repeat.set(2, 2); weave.colorSpace = THREE.NoColorSpace;
  ctx.resourceTextures?.add(weave);
  const fabric = (color, name) => { const m = mat({ color, roughness: .96, metalness: 0, normalMap: weave, normalScale: new THREE.Vector2(.45, .45) }); m.name = `Crew / ${name}`; return m; };
  const paint = (color, name, roughness = .48, metalness = .12) => { const m = mat({ color, roughness, metalness }); m.name = `Crew / ${name}`; return m; };
  const P = {
    beta: fabric(0xe1dccb, 'beta cloth'), blue: fabric(0x55708a, 'blue nomex'), grey: fabric(0x878d88, 'grey nomex'), ochre: fabric(0xb39657, 'ochre nomex'),
    tan: fabric(0xc8b892, 'tan stowage'), dark: fabric(0x343a3e, 'black webbing'), orange: fabric(0xd2702a, 'PBA orange'), webbing: fabric(0x666b67, 'grey webbing'),
    red: paint(0xae2a1f, 'extinguisher red', .4, .25), white: paint(0xdcded5, 'panel white', .5, .05), panel: paint(0x667070, 'panel grey', .46, .3),
    black: paint(0x202528, 'black plastic', .42, .05), yellow: paint(0xd8b43a, 'safety yellow', .5, .05), rail: paint(0xc6ad72, 'handrail ochre', .38, .22),
    steel: paint(0xa6aeac, 'brushed steel', .3, .82), rubber: paint(0x1a1e20, 'rubber', .9, 0), blueP: paint(0x2f5d8a, 'blue plastic', .4, .05),
    clear: (() => { const m = mat({ color: 0xd8e4e6, roughness: .12, metalness: 0, transparent: true, opacity: .32, depthWrite: false }); m.name = 'Crew / zip bag'; return m; })(),
  };
  const batches = new Map(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), e = new THREE.Euler(), yAxis = new THREE.Vector3(0, 1, 0);
  function put(g, material, f, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const key = `${g.uuid}:${material.uuid}`;
    if (!batches.has(key)) batches.set(key, { g, material, list: [] });
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    qy.setFromAxisAngle(yAxis, f.yaw); q.setFromEuler(e.set(rx, ry, rz)); qy.multiply(q);
    const local = new THREE.Matrix4().compose(new THREE.Vector3(f.origin.x + x * c + z * s, y, f.origin.z - x * s + z * c), qy, new THREE.Vector3(sx, sy, sz));
    batches.get(key).list.push(local.premultiply(f.section.matrixWorld));
    stats.items++;
  }
  const B = (f, material, x, y, z, w, h, d, rx, ry, rz) => put(G.box, material, f, x, y, z, w, h, d, rx, ry, rz);
  const S = (f, material, x, y, z, w, h, d, rx, ry, rz) => put(G.soft, material, f, x, y, z, w, h, d, rx, ry, rz);
  const dir = new THREE.Vector3(), qd = new THREE.Quaternion();
  function rod(f, a, b, radius, material, g = G.rod) {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const length = dir.length(); if (length < 1e-5) return;
    // Convert the direction into an Euler in the frame, so put() adds the wall yaw.
    qd.setFromUnitVectors(yAxis, dir.normalize()); e.setFromQuaternion(qd);
    put(g, material, f, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, radius, length, radius, e.x, e.y, e.z);
  }
  // Cylinders whose axis points out of the wall (dials, sockets, ports).
  const disc = (f, material, x, y, z, radius, depth, g = G.cyl) => put(g, material, f, x, y, z, radius, depth, radius, Math.PI / 2);

  // Decals: three materials over one atlas.
  const decalSets = { sticker: [], grime: [], glow: [] };
  function uvOf(r) { return [r.x / ATLAS, 1 - (r.y + r.h) / ATLAS, (r.x + r.w) / ATLAS, 1 - r.y / ATLAS]; }
  function decal(f, r, x, y, z, w, h, angle = 0, kind = 'sticker') {
    const [u0, v0, u1, v1] = uvOf(r), c = Math.cos(angle), s = Math.sin(angle);
    const corners = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]].map(([cx, cy, u, vv]) => {
      const lx = cx * w / 2 * c - cy * h / 2 * s, ly = cx * w / 2 * s + cy * h / 2 * c;
      return { p: world(f, x + lx, y + ly, z), u, v: vv };
    });
    decalSets[kind].push(corners);
    if (kind === 'sticker') stats.stickers++;
  }
  function floorDecal(section, x, z, y, r, w, h, angle) {
    const [u0, v0, u1, v1] = uvOf(r), c = Math.cos(angle), s = Math.sin(angle);
    const corners = [[-1, 1, u0, v0], [1, 1, u1, v0], [1, -1, u1, v1], [-1, -1, u0, v1]].map(([cx, cz, u, vv]) => {
      const lx = cx * w / 2 * c - cz * h / 2 * s, lz = cx * w / 2 * s + cz * h / 2 * c;
      return { p: new THREE.Vector3(x + lx, y, z + lz).applyMatrix4(section.matrixWorld), u, v: vv };
    });
    decalSets.grime.push(corners); stats.floorWear++;
  }
  const leds = [];
  const LED = { green: 0x6dff7a, amber: 0xffb43c, red: 0xff4636, blue: 0x5bb4ff, lime: 0xcfff04 };
  function led(f, x, y, z, color = 'green', pattern = 'steady', size = .011) {
    const p = world(f, x, y, z), m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(yAxis, f.yaw), new THREE.Vector3(size, size, .006));
    leds.push({ m, color: new THREE.Color(LED[color]), pattern, phase: leds.length * 1.37 % 7 }); stats.leds++;
  }
  const cablePaths = [];
  function cable(f, points, radius, color) {
    cablePaths.push({ points: points.map(p => world(f, ...p)), radius, color: new THREE.Color(color) }); stats.cables++;
  }
  const ribbons = [];

  // 5. The items. Each builder draws inside the footprint reserved for it.
  function bag(f, r, x, y) {
    const w = .36 + r() * .16, h = .25 + r() * .1, d = .1 + r() * .025;
    if (!reserve(f, x, y, w, h, d + .012)) return false;
    const z = f.face + .004 + d / 2, body = pick(r, [P.beta, P.beta, P.tan, P.grey, P.blue, P.beta, P.ochre]);
    S(f, body, x, y, z, w, h, d);
    for (const side of [-1, 1]) { B(f, P.webbing, x + side * w * .3, y, z + d / 2 + .003, .032, h * .96, .006); B(f, P.webbing, x + side * w * .3, y + h / 2 - .004, z, .032, .008, d * .92); }
    B(f, P.dark, x, y + h * .34, z + d / 2 + .002, w * .86, .008, .004);
    B(f, P.steel, x + w * .32, y + h * .34, z + d / 2 + .006, .012, .026, .006);
    rod(f, [x - .07, y + h / 2 + .016, z + d * .1], [x + .07, y + h / 2 + .016, z + d * .1], .011, P.webbing);
    for (const side of [-1, 1]) B(f, P.webbing, x + side * .075, y + h / 2 + .008, z + d * .1, .026, .02, .014);
    decal(f, pick(r, tags), x - w * .14, y - h * .1, z + d / 2 + .004, .11, .072, (r() - .5) * .05);
    stats.bags++; return true;
  }
  function bungee(f, r, x, y) {
    const w = .62 + r() * .4, h = .28, d = .05;
    if (!reserve(f, x, y, w, h, d)) return false;
    const z = f.face + .004, color = pick(r, [0x23282a, 0x2b4a72, 0x4f5450]);
    for (const [k, cy] of [[0, y + .07], [1, y - .07]]) {
      for (const side of [-1, 1]) { B(f, P.black, x + side * (w / 2 - .02), cy, z + .012, .026, .036, .022); rod(f, [x + side * (w / 2 - .03), cy, z + .03], [x + side * (w / 2 - .055), cy, z + .03], .006, P.steel); }
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([x - w / 2 + .05 + (w - .1) * t, cy - Math.sin(Math.PI * t) * (.008 + k * .006), z + .032]); }
      cable(f, pts, .0055, color);
    }
    // Tucked behind the cords: a procedure, a pen, scissors, a light or a zip bag.
    let cursor = x - w / 2 + .1;
    while (cursor < x + w / 2 - .12) {
      const choice = Math.floor(r() * 5);
      if (choice === 0 && cursor + .2 < x + w / 2) { B(f, P.white, cursor + .1, y, z + .006, .19, .25, .003, 0, 0, (r() - .5) * .08); decal(f, pick(r, procedures), cursor + .1, y, z + .0085, .18, .24, (r() - .5) * .08); cursor += .24; stats.procedures++; }
      else if (choice === 1) { rod(f, [cursor, y - .1, z + .022], [cursor + .02, y + .07, z + .022], .0045, pick(r, [P.blueP, P.black, P.red])); B(f, P.steel, cursor + .021, y + .075, z + .022, .006, .016, .004); cursor += .06; }
      else if (choice === 2) { rod(f, [cursor + .03, y - .07, z + .02], [cursor + .03, y + .06, z + .02], .016, P.black, G.cyl); disc(f, P.steel, cursor + .03, y + .068, z + .02, .019, .02); cursor += .08; }
      else if (choice === 3 && cursor + .16 < x + w / 2) { B(f, P.clear, cursor + .075, y - .01, z + .014, .14, .17, .018); B(f, pick(r, [P.yellow, P.blueP, P.white]), cursor + .07, y - .03, z + .012, .08, .07, .01); B(f, P.blueP, cursor + .075, y + .072, z + .024, .14, .008, .004); cursor += .18; }
      else { B(f, P.steel, cursor + .02, y - .02, z + .018, .007, .11, .003, 0, 0, .14); B(f, P.steel, cursor + .025, y - .02, z + .02, .007, .11, .003, 0, 0, -.14); B(f, P.red, cursor + .02, y - .085, z + .02, .03, .03, .008); cursor += .07; }
    }
    stats.bungees++; return true;
  }
  function procedure(f, r, x, y) {
    if (!reserve(f, x, y, .23, .3, .012)) return false;
    const z = f.face + .004, a = (r() - .5) * .07;
    B(f, P.dark, x, y + .12, z + .002, .06, .03, .004); B(f, P.white, x, y, z + .006, .215, .285, .003, 0, 0, a);
    decal(f, pick(r, procedures), x, y, z + .0085, .205, .275, a); stats.procedures++; return true;
  }
  function photoCluster(f, r, x, y) {
    const count = 2 + Math.floor(r() * 3), w = .17 * count + .04;
    if (!reserve(f, x, y, w, .27, .008)) return false;
    for (let i = 0; i < count; i++) {
      const p = pick(r, photos), pw = p.w === p.h ? .11 : .15, ph = p.w === p.h ? .11 : .112;
      decal(f, p, x - w / 2 + .1 + i * .17, y + (r() - .5) * .08, f.face + .005 + i * .0006, pw, ph, (r() - .5) * .22);
    }
    stats.photos++; return true;
  }
  function velcroField(f, r, x, y) {
    if (!reserve(f, x, y, .34, .3, .06)) return false;
    const z = f.face + .004;
    for (let i = 0; i < 6; i++) B(f, P.dark, x - .12 + (i % 3) * .12, y - .08 + Math.floor(i / 3) * .16, z + .002, .05, .05, .004);
    // A roll of grey tape, a tethered pen and a small flashlight on the patches.
    disc(f, P.grey, x - .12, y + .08, z + .022, .042, .034); disc(f, P.black, x - .12, y + .08, z + .03, .024, .036);
    rod(f, [x, y - .12, z + .014], [x + .01, y + .02, z + .014], .005, P.blueP);
    cable(f, [[x + .01, y + .02, z + .014], [x + .03, y + .07, z + .02], [x + .06, y + .05, z + .02], [x + .08, y + .085, z + .01]], .0018, 0x2b2f31);
    rod(f, [x + .12, y - .12, z + .02], [x + .12, y + .0, z + .02], .015, P.yellow, G.cyl); disc(f, P.black, x + .12, y + .006, z + .02, .017, .016);
    stats.pouches++; return true;
  }
  function pouch(f, r, x, y) {
    const w = .17 + r() * .06, h = .2 + r() * .06, d = .065;
    if (!reserve(f, x, y, w, h + .05, d)) return false;
    const z = f.face + .004 + d / 2, material = pick(r, [P.dark, P.blue, P.grey, P.ochre]);
    S(f, material, x, y - .01, z, w, h, d); S(f, material, x, y + h / 2 - .035, z + .006, w + .006, .07, d * .82);
    B(f, P.dark, x, y + h / 2 - .06, z + d / 2 + .006, .04, .03, .004);
    if (r() > .4) rod(f, [x + w * .2, y + h / 2 - .02, z - .005], [x + w * .24, y + h / 2 + .045, z - .005], .0045, pick(r, [P.red, P.blueP, P.yellow]));
    if (r() > .5) decal(f, pick(r, tags), x, y - .04, z + d / 2 + .003, .08, .052);
    stats.pouches++; return true;
  }
  function cableRun(f, r, x, y) {
    const w = .8 + r() * 1.1, h = .2, d = .07;
    if (!reserve(f, x, y, w, h, d)) return false;
    const z = f.face + .004, count = 2 + Math.floor(r() * 3), colors = [0x1f2325, 0x9aa19c, 0x2b5e8f, 0xd2b13c, 0xe6e4da, 0x1f2325];
    const top = y + h / 2 - .03, sag = .03 + r() * .07;
    for (const end of [-1, 1]) { B(f, P.black, x + end * (w / 2 - .03), top, z + .02, .045, .05, .032); disc(f, P.steel, x + end * (w / 2 - .03), top + .012, z + .038, .007, .006); }
    for (let c = 0; c < count; c++) {
      const pts = [], cz = z + .018 + (c % 2) * .016, cy = top - c * .011, extra = c * .008;
      for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([x - w / 2 + .03 + (w - .06) * t, cy - Math.sin(Math.PI * t) * (sag + extra), cz + Math.sin(t * 9 + c) * .003]); }
      cable(f, pts, .0065 + (c === 0 ? .003 : 0), colors[(c + Math.floor(r() * 6)) % colors.length]);
    }
    // Zip ties gather the bundle every quarter metre.
    for (let t = .2; t < .85; t += .22) { const px = x - w / 2 + w * t, py = top - Math.sin(Math.PI * t) * sag - count * .005; B(f, P.black, px, py, z + .026, .006, .04 + count * .01, .03); }
    stats.cableRuns++; return true;
  }
  function outlet(f, r, x, y) {
    if (!reserve(f, x, y, .23, .17, .05)) return false;
    const z = f.face + .004;
    B(f, P.panel, x, y, z + .012, .22, .155, .024); B(f, P.black, x, y, z + .025, .2, .135, .004);
    for (const side of [-1, 1]) {
      disc(f, P.black, x + side * .055, y - .01, z + .034, .03, .018); disc(f, P.rubber, x + side * .055, y - .01, z + .044, .019, .005);
      B(f, side > 0 ? P.yellow : P.red, x + side * .055, y + .03, z + .043, .036, .014, .01, -.5);
    }
    B(f, P.black, x - .08, y + .055, z + .032, .016, .026, .012); B(f, P.white, x - .08, y + .062, z + .04, .008, .012, .006);
    led(f, x + .08, y + .055, z + .03, 'green', 'steady'); decal(f, smallLabels[2], x + .02, y + .055, z + .028, .07, .02);
    stats.outlets++; return true;
  }
  function dataPanel(f, r, x, y) {
    if (!reserve(f, x, y, .26, .1, .04)) return false;
    const z = f.face + .004;
    B(f, P.black, x, y, z + .014, .25, .085, .028); decal(f, smallLabels[3], x - .07, y + .027, z + .029, .08, .022);
    for (let i = 0; i < 6; i++) { const px = x - .1 + i * .04; B(f, P.rubber, px, y - .01, z + .03, .026, .022, .006); led(f, px + .009, y + .012, z + .029, i % 3 ? 'green' : 'amber', 'data', .007); }
    if (r() > .35) cable(f, [[x - .06, y - .01, z + .033], [x - .05, y - .07, z + .045], [x - .12, y - .2, z + .04], [x - .18, y - .28, z + .03]], .004, pick(r, [0x2b5e8f, 0xd2b13c, 0xe6e4da]));
    stats.dataPanels++; return true;
  }
  function intercom(f, r, x, y) {
    if (!reserve(f, x, y, .19, .27, .05)) return false;
    const z = f.face + .004;
    B(f, P.white, x, y, z + .016, .17, .25, .032); B(f, P.black, x, y + .065, z + .033, .13, .09, .003);
    for (let i = 0; i < 6; i++) B(f, P.panel, x, y + .03 + i * .014, z + .036, .11, .005, .004);
    disc(f, P.black, x, y - .04, z + .038, .028, .016); disc(f, P.red, x, y - .04, z + .047, .02, .008);
    for (const side of [-1, 1]) for (const dy of [-.09, -.06]) B(f, P.panel, x + side * .045, y + dy, z + .036, .028, .016, .01);
    led(f, x + .06, y + .113, z + .033, 'green', 'steady'); led(f, x + .04, y + .113, z + .033, 'amber', 'blink');
    decal(f, smallLabels[0], x - .03, y + .113, z + .033, .085, .022);
    cable(f, [[x + .06, y - .11, z + .02], [x + .1, y - .2, z + .03], [x + .05, y - .26, z + .035], [x - .02, y - .22, z + .03], [x + .02, y - .14, z + .02]], .0035, 0x1f2325);
    stats.intercoms++; return true;
  }
  function smoke(f, r, x, y) {
    if (!reserve(f, x, y, .14, .14, .05)) return false;
    const z = f.face + .004;
    disc(f, P.white, x, y, z + .016, .06, .03); disc(f, P.panel, x, y, z + .034, .045, .006);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; B(f, P.black, x + Math.cos(a) * .03, y + Math.sin(a) * .03, z + .038, .012, .004, .003, 0, 0, a); }
    led(f, x + .038, y - .038, z + .03, 'red', 'beacon', .008); decal(f, smallLabels[1], x, y - .075, z + .006, .09, .026);
    stats.smokeDetectors++; return true;
  }
  function fireKit(f, r, x, y) {
    if (!reserve(f, x, y + .06, .56, .7, .14)) return false;
    const z = f.face + .004, ex = x - .14;
    // Portable fire extinguisher in its quick-release bracket.
    B(f, P.panel, ex, y - .04, z + .008, .15, .5, .012);
    rod(f, [ex, y - .25, z + .07], [ex, y + .14, z + .07], .058, P.red, G.cyl);
    put(G.ball, P.red, f, ex, y + .14, z + .07, .058, .03, .058);
    for (const by of [-.17, .06]) { B(f, P.black, ex, y + by, z + .07, .132, .035, .128); B(f, P.steel, ex + .066, y + by, z + .1, .012, .03, .02); }
    B(f, P.black, ex, y + .19, z + .07, .03, .06, .03); B(f, P.black, ex + .04, y + .215, z + .07, .09, .014, .022, 0, 0, -.25);
    rod(f, [ex - .02, y + .2, z + .07], [ex - .06, y + .27, z + .085], .009, P.black);
    disc(f, P.white, ex - .035, y + .17, z + .118, .018, .008); B(f, P.yellow, ex + .025, y + .2, z + .096, .006, .02, .006);
    // Portable breathing apparatus pouch with its clear mask window.
    S(f, P.orange, x + .13, y - .02, z + .055, .25, .32, .11); B(f, P.webbing, x + .13, y - .02, z + .113, .03, .3, .006);
    B(f, P.clear, x + .13, y + .05, z + .114, .16, .08, .006); B(f, P.white, x + .13, y - .11, z + .114, .12, .04, .004);
    decal(f, fireBoard, x, y + .34, z + .004, .32, .148);
    stats.fireKits++; return true;
  }
  function firePort(f, r, x, y) {
    if (!reserve(f, x, y, .13, .12, .012)) return false;
    const z = f.face + .004;
    disc(f, P.rubber, x, y + .012, z + .002, .024, .006); disc(f, P.black, x, y + .012, z + .006, .012, .004);
    decal(f, firePortLabel, x, y, z + .001, .12, .096); stats.firePorts++; return true;
  }
  function vent(f, r, x, y) {
    if (!reserve(f, x, y - .04, .32, .26, .1)) return false;
    const z = f.face + .004;
    B(f, P.panel, x, y, z + .012, .3, .14, .024); B(f, P.black, x, y, z + .02, .27, .11, .012);
    for (let i = 0; i < 7; i++) B(f, P.white, x, y - .045 + i * .015, z + .028, .26, .006, .016, -.55);
    for (const side of [-1, 1]) for (const dy of [-1, 1]) disc(f, P.steel, x + side * .135, y + dy * .057, z + .025, .006, .004);
    // Crew-taped streamers prove the air is moving.
    const count = 2 + Math.floor(r() * 2);
    for (let i = 0; i < count; i++) {
      const p = world(f, x - .08 + i * .16 / Math.max(1, count - 1), y - .07, z + .03);
      ribbons.push({ p, yaw: f.yaw, length: .085 + r() * .04, phase: r() * TAU, rate: 6 + r() * 4 }); stats.streamers++;
    }
    decal(f, warnings[4], x + .21, y, z + .001, .085, .045);
    stats.vents++; return true;
  }
  function handrail(f, r, x, y) {
    const w = .44 + r() * .26;
    if (!reserve(f, x, y, w + .04, .07, .11)) return false;
    const z = f.face + .004;
    for (const side of [-1, 1]) { B(f, P.rail, x + side * (w / 2 - .02), y, z + .04, .035, .045, .08); disc(f, P.steel, x + side * (w / 2 - .02), y, z + .004, .025, .008); }
    rod(f, [x - w / 2, y, z + .084], [x + w / 2, y, z + .084], .016, P.rail, G.cyl);
    B(f, P.dark, x - w * .18, y, z + .084, .05, .036, .036); // a worn grip wrap
    decal(f, smallLabels[4], x, y + .06, z + .001, .05, .016);
    stats.handrails++; return true;
  }
  function sticker(f, r, x, y) {
    const w = .1 + r() * .04, h = w * 96 / 180;
    if (!reserve(f, x, y, w, h, .004, .004)) return false;
    decal(f, pick(r, warnings), x, y, f.face + .0045, w, h, (r() - .5) * .03); return true;
  }

  // Location codes, egress markers and wear on every backed run of wall.
  function wallDressing(f, r) {
    const runs = []; let start = null;
    for (let x = -f.length / 2 + .08; x <= f.length / 2 - .08; x += .12) {
      const ok = backed(f, x, .5, .06, .16) && !(f.kind === 'tube' && corridorWindowAt(f.link, f.side, f.side * x, .05));
      if (ok && start === null) start = x;
      if ((!ok || x + .12 > f.length / 2 - .08) && start !== null) { const end = ok ? x : x - .12; if (end - start > .3) runs.push([start, end]); start = null; }
    }
    for (const [a, b] of runs) { const w = b - a + .08; decal(f, pick(r, grimeBands), (a + b) / 2, .47, f.face + .0025, w, .26, 0, 'grime'); stats.grime++; }
    for (const y of [2.31, 2.24, 2.08]) {
      let placed = false;
      for (const x of [-f.length / 2 + .2, f.length / 2 - .2, 0, -f.length / 4, f.length / 4]) if (reserve(f, x, y, .19, .05, .004, .004)) { decal(f, frameLabels.get(f), x, y, f.face + .005, .17, .042); stats.labels++; placed = true; break; }
      if (placed) break;
    }
  }

  const quotas = [[fireKit, 1, [.95, 1.25]], [intercom, 1, [1.35, 1.5]], [smoke, 1, [2.15, 2.32]], [vent, 2, [1.95, 2.25]], [firePort, 1, [.9, 1.5]],
    [outlet, 2, [.42, .62]], [dataPanel, 1, [.65, 1.0]], [handrail, 2, [.95, 1.55]]];
  const fillers = [[bag, 5, [.55, 1.95]], [bungee, 3, [.9, 1.7]], [procedure, 3, [1.2, 1.65]], [photoCluster, 2, [1.3, 1.7]], [velcroField, 2, [1.0, 1.6]],
    [pouch, 3, [.8, 1.8]], [cableRun, 4, [1.9, 2.25]], [sticker, 2, [.7, 2.0]], [outlet, 1, [.42, .62]]];
  // Tubes are tighter: fewer, smaller items between the existing service packs.
  const tubeQuotas = [[vent, 1, [1.95, 2.15]], [outlet, 1, [.42, .6]], [handrail, 1, [1.0, 1.4]]];
  const tubeFillers = [[procedure, 2, [1.2, 1.6]], [cableRun, 4, [1.95, 2.2]], [sticker, 3, [.7, 1.9]], [pouch, 1, [1.1, 1.7]], [photoCluster, 1, [1.3, 1.6]]];
  function furnish(owner, list, r, quotas, fillers) {
    let count = 0;
    for (const [builder, weight, [y0, y1]] of quotas) {
      let placed = 0;
      for (let attempt = 0; attempt < 60 && placed < weight; attempt++) {
        const f = pick(r, list), x = (r() - .5) * (f.length - .3), y = y0 + r() * (y1 - y0);
        if (builder(f, r, x, y)) { placed++; count++; }
      }
    }
    const total = fillers.reduce((sum, [, weight]) => sum + weight, 0), length = list.reduce((sum, f) => sum + f.length, 0);
    for (let attempt = 0; attempt < length * 26; attempt++) {
      let roll = r() * total, entry = fillers[0];
      for (const item of fillers) { roll -= item[1]; if (roll <= 0) { entry = item; break; } }
      const [builder, , [y0, y1]] = entry, f = pick(r, list);
      if (builder(f, r, (r() - .5) * (f.length - .3), y0 + r() * (y1 - y0))) count++;
    }
    stats.perModule[owner] = count;
  }

  const byOwner = new Map();
  for (const f of frames) { if (!byOwner.has(f.owner)) byOwner.set(f.owner, []); byOwner.get(f.owner).push(f); }
  for (const f of frames) wallDressing(f, seededRandom(`dress-${f.id}`));
  for (const [owner, list] of byOwner) {
    const r = seededRandom(`furnish-${owner}`);
    if (list[0].kind === 'tube') furnish(owner, list, r, tubeQuotas, tubeFillers);
    else furnish(owner, list, r, quotas, fillers);
  }

  // Deck wear: scuffs gather at hatch thresholds and along the walking lines.
  for (const module of MODULES) {
    const section = beginModule(module); endSection();
    const r = seededRandom(`wear-${module.id}`);
    for (const link of LINKS.filter(l => l.from === module.id || l.to === module.id)) {
      const end = link.from === module.id ? link.a : link.b;
      for (let i = 0; i < 4; i++) {
        const t = .12 + i * .2 + r() * .08;
        const x = end.x + (module.x - end.x) * t + (r() - .5) * .8, z = end.z + (module.z - end.z) * t + (r() - .5) * .8;
        if (Math.hypot(x - module.x, z - module.z) < .75) continue;
        floorDecal(section, x, z, .0045 + i * .0004, pick(r, scuffs), .7 + r() * .5, .35 + r() * .2, r() * TAU);
      }
    }
  }

  // 6. Build: palette batches, merged cables, decals, LEDs, streamers and dust.
  const group = new THREE.Group(); group.name = 'Crew realism layer'; root.add(group);
  for (const { g, material, list } of batches.values()) {
    const mesh = new THREE.InstancedMesh(g, material, list.length); mesh.name = material.name;
    list.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    mesh.castShadow = mesh.receiveShadow = true; mesh.userData.realism = true; group.add(mesh); stats.drawCalls++;
  }
  if (cablePaths.length) {
    const parts = cablePaths.map(({ points, radius, color }) => {
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(6, points.length * 3), radius, 6, false);
      const colors = new Float32Array(tube.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
      tube.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return tube;
    });
    const merged = geo(mergeGeometries(parts, false)); parts.forEach(p => p.dispose());
    const material = mat({ vertexColors: true, roughness: .62, metalness: .05 }); material.name = 'Crew / cable jackets';
    const mesh = new THREE.Mesh(merged, material); mesh.name = 'Crew / sagging cable runs'; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); stats.drawCalls++;
  }
  const decalMaterials = {
    sticker: mat({ map: atlas, transparent: true, alphaTest: .35, roughness: .62, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    grime: mat({ map: atlas, transparent: true, depthWrite: false, roughness: .9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    glow: mat({ map: atlas, emissiveMap: atlas, emissive: 0xc9f0b5, emissiveIntensity: .55, transparent: true, alphaTest: .35, roughness: .7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };
  for (const [kind, quads] of Object.entries(decalSets)) {
    if (!quads.length) continue;
    const position = new Float32Array(quads.length * 12), uv = new Float32Array(quads.length * 8), index = [];
    quads.forEach((corners, k) => {
      corners.forEach((c, i) => { position.set([c.p.x, c.p.y, c.p.z], k * 12 + i * 3); uv.set([c.u, c.v], k * 8 + i * 2); });
      index.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(position, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(index); g.computeVertexNormals(); geo(g);
    const mesh = new THREE.Mesh(g, decalMaterials[kind]); mesh.name = `Crew / ${kind} decals`; mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.excludeFromAO = true; mesh.renderOrder = kind === 'grime' ? 1 : 2; group.add(mesh); stats.drawCalls++;
  }
  decalMaterials.sticker.name = 'Crew / printed labels'; decalMaterials.grime.name = 'Crew / wear'; decalMaterials.glow.name = 'Crew / photoluminescent';

  const glowLater = [];
  // Egress markers: one photoluminescent strip per module, pointing at a hatch.
  // (Placed after the main pass so it can use any remaining low wall run.)
  for (const [owner, list] of byOwner) {
    if (list[0].kind !== 'module') continue;
    const r = seededRandom(`egress-${owner}`);
    for (let attempt = 0; attempt < 40; attempt++) {
      const f = pick(r, list), x = (r() - .5) * (f.length - .5);
      if (!reserve(f, x, .66, .34, .085, .004, .004)) continue;
      const port = f.module.ports.map(p => ({ N: 0, E: 2, S: 4, W: 6 })[p]).find(face => Math.abs(face - f.edge.face) === 1 || Math.abs(face - f.edge.face) === 7);
      const towardB = port !== undefined ? ((port - f.edge.face + 8) % 8 === 1 ? 1 : -1) : (x < 0 ? -1 : 1);
      glowLater.push([f, egress[towardB > 0 ? 0 : 1], x]);
      break;
    }
  }
  if (glowLater.length) {
    const quads = [];
    for (const [f, r, x] of glowLater) {
      const [u0, v0, u1, v1] = uvOf(r);
      quads.push([[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]].map(([cx, cy, u, vv]) => ({ p: world(f, x + cx * .16, .66 + cy * .04, f.face + .005), u, v: vv })));
    }
    const position = new Float32Array(quads.length * 12), uv = new Float32Array(quads.length * 8), index = [];
    quads.forEach((corners, k) => { corners.forEach((c, i) => { position.set([c.p.x, c.p.y, c.p.z], k * 12 + i * 3); uv.set([c.u, c.v], k * 8 + i * 2); }); index.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(position, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(index); g.computeVertexNormals(); geo(g);
    const mesh = new THREE.Mesh(g, decalMaterials.glow); mesh.name = 'Crew / egress markers'; mesh.castShadow = false; mesh.userData.excludeFromAO = true; mesh.renderOrder = 2; group.add(mesh); stats.drawCalls++;
    stats.egressMarkers = glowLater.length;
  }

  let ledMesh = null;
  if (leds.length) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); ctx.resourceMaterials?.add(material);
    ledMesh = new THREE.InstancedMesh(G.box, material, leds.length); ledMesh.name = 'Crew / status LEDs';
    leds.forEach((l, i) => { ledMesh.setMatrixAt(i, l.m); ledMesh.setColorAt(i, l.color); });
    ledMesh.instanceMatrix.needsUpdate = true; ledMesh.computeBoundingSphere(); ledMesh.castShadow = false; ledMesh.userData.excludeFromAO = true; group.add(ledMesh); stats.drawCalls++;
  }
  let ribbonMesh = null;
  if (ribbons.length) {
    const strip = geo(new THREE.PlaneGeometry(1, 1).translate(0, -.5, 0));
    const material = mat({ color: 0xf1efe4, roughness: .9, side: THREE.DoubleSide }); material.name = 'Crew / vent streamers';
    ribbonMesh = new THREE.InstancedMesh(strip, material, ribbons.length); ribbonMesh.name = 'Crew / vent streamers';
    ribbonMesh.castShadow = false; ribbonMesh.frustumCulled = false; group.add(ribbonMesh); stats.drawCalls++;
  }
  // Cabin dust: a fixed cloud wrapped around the viewer, lit only by its own tint.
  const DUST = 700, dustSize = new THREE.Vector3(7, 3.2, 7), seeds = new Float32Array(DUST * 3), rd = seededRandom('dust');
  for (let i = 0; i < DUST * 3; i += 3) { seeds[i] = rd() * dustSize.x; seeds[i + 1] = rd() * dustSize.y; seeds[i + 2] = rd() * dustSize.z; }
  const dustGeometry = geo(new THREE.BufferGeometry()); dustGeometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
  dustGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const dustMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSize: { value: dustSize }, uScale: { value: 500 }, uOpacity: { value: .5 } },
    vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform vec3 uSize; uniform float uScale; varying float vFade;
      void main() {
        vec3 p = position + vec3(sin(uTime * .07 + position.y * 2.3) * .35, uTime * .011, cos(uTime * .05 + position.x * 1.7) * .35);
        p = mod(p - uCenter + uSize * .5, uSize) - uSize * .5 + uCenter;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        float d = -mv.z;
        vFade = smoothstep(3.6, 1.4, d) * smoothstep(.18, .55, d) * (.55 + .45 * sin(uTime * .6 + position.z * 5.));
        gl_PointSize = clamp(uScale * (.006 + fract(position.x * 13.7) * .006) / max(d, .1), 1., 5.);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uOpacity; varying float vFade;
      void main() { float r = length(gl_PointCoord - .5); if (r > .5) discard; gl_FragColor = vec4(vec3(1., .96, .86) * (1. - r * 2.) * vFade * uOpacity, 1.); }`,
  });
  ctx.resourceMaterials?.add(dustMaterial);
  const dust = new THREE.Points(dustGeometry, dustMaterial); dust.name = 'Cabin dust motes'; dust.frustumCulled = false; dust.renderOrder = 3; dust.userData.cabinDust = true;
  const bufferSize = new THREE.Vector2();
  dust.onBeforeRender = (renderer, scene, camera) => { renderer.getDrawingBufferSize(bufferSize); dustMaterial.uniforms.uScale.value = bufferSize.y * .5 * camera.projectionMatrix.elements[5]; };
  group.add(dust); stats.dustMotes = DUST; stats.drawCalls++;

  const pattern = (l, t) => {
    switch (l.pattern) {
      case 'blink': return Math.sin(t * 3.1 + l.phase) > 0 ? 1 : .08;
      case 'beacon': return (t * .5 + l.phase) % 1 < .07 ? 1 : .06;
      case 'data': return Math.sin(t * 17 + l.phase * 9) + Math.sin(t * 29 + l.phase * 4) > .2 ? 1 : .15;
      default: return 1;
    }
  };
  const ledColor = new THREE.Color(), ribbonMatrix = new THREE.Matrix4(), rq = new THREE.Quaternion(), rs = new THREE.Vector3(), tilt = new THREE.Quaternion(), xAxis = new THREE.Vector3(1, 0, 0);
  let lastLed = -1;
  return {
    stats, group,
    update(time, dt, player) {
      if (ledMesh && time - lastLed > 1 / 15) {
        lastLed = time;
        leds.forEach((l, i) => { ledMesh.setColorAt(i, ledColor.copy(l.color).multiplyScalar(pattern(l, time))); });
        ledMesh.instanceColor.needsUpdate = true;
      }
      if (ribbonMesh) ribbons.forEach((r, i) => {
        const angle = .55 + Math.sin(time * r.rate + r.phase) * .22 + Math.sin(time * r.rate * 2.3 + r.phase * 3) * .09;
        rq.setFromAxisAngle(yAxis, r.yaw).multiply(tilt.setFromAxisAngle(xAxis, -angle));
        ribbonMesh.setMatrixAt(i, ribbonMatrix.compose(r.p, rq, rs.set(.016, r.length, 1)));
      });
      if (ribbonMesh) ribbonMesh.instanceMatrix.needsUpdate = true;
      dustMaterial.uniforms.uTime.value = time;
      if (player) {
        dustMaterial.uniforms.uCenter.value.set(player.x, player.y ?? 1.6, player.z);
        dust.visible = player.zone !== 'exterior';
      }
    },
  };
}
