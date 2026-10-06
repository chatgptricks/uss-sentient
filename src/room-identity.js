import { MODULES, LINKS } from './layout.js';

// One wayfinding identity per department: the same colour and symbol appear on
// its hatches, the deck gate markers, the guide light, the map and the HUD.
export const ROOM_IDENTITY = {
  'front-door': { color: '#3fd0c0', name: 'teal', glyph: 'network', tagline: 'Arrival · suits · airlock A1' },
  floor: { color: '#ff8b3d', name: 'orange', glyph: 'gear', tagline: 'Fabrication · machinery bay' },
  archive: { color: '#f2c14e', name: 'gold', glyph: 'stack', tagline: 'Data vault · records' },
  commons: { color: '#79d98c', name: 'green', glyph: 'leaf', tagline: 'Hydroponics · washroom' },
  forum: { color: '#b48cff', name: 'violet', glyph: 'table', tagline: 'Briefing room · cupola below' },
  lab: { color: '#56c2ff', name: 'blue', glyph: 'flask', tagline: 'Specimens · scanner' },
  bridge: { color: '#cfff04', name: 'lime', glyph: 'chevron', tagline: 'Command · observation deck' },
};

export const identityOf = id => ROOM_IDENTITY[id] || { color: '#cfff04', name: 'lime', glyph: 'chevron', tagline: '' };
export const hexOf = id => parseInt(identityOf(id).color.slice(1), 16);

/** For each room, the rooms reached first through each neighbouring hatch. */
export function roomsVia(fromId) {
  const distance = (a, b) => { const p = MODULES.find(m => m.id === a), q = MODULES.find(m => m.id === b); return Math.hypot(p.x - q.x, p.z - q.z); };
  const firstHop = new Map(), best = new Map([[fromId, 0]]), pending = [fromId];
  while (pending.length) {
    pending.sort((a, b) => best.get(a) - best.get(b));
    const id = pending.shift();
    for (const link of LINKS.filter(l => l.from === id || l.to === id)) {
      const other = link.from === id ? link.to : link.from, d = best.get(id) + distance(id, other);
      if (!best.has(other) || d < best.get(other)) {
        best.set(other, d); firstHop.set(other, id === fromId ? other : firstHop.get(id)); pending.push(other);
      }
    }
  }
  const via = {};
  for (const [room, hop] of firstHop) (via[hop] ||= []).push(room);
  // Nearest first: the neighbour itself, then the rooms beyond it.
  for (const hop in via) via[hop].sort((a, b) => best.get(a) - best.get(b));
  return via;
}

/** Department symbols drawn with plain canvas paths (signs, deck markers and map). */
export function drawGlyph(g, glyph, cx, cy, size, color, line = Math.max(2, size * .09)) {
  const s = size / 2;
  g.save(); g.translate(cx, cy); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = line; g.lineCap = 'round'; g.lineJoin = 'round';
  const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  if (glyph === 'network') {
    const nodes = [[-.7, .45], [0, -.6], [.7, .4], [0, .1]];
    g.beginPath(); for (const [a, b] of [[0, 3], [1, 3], [2, 3], [0, 1], [1, 2]]) { g.moveTo(nodes[a][0] * s, nodes[a][1] * s); g.lineTo(nodes[b][0] * s, nodes[b][1] * s); } g.stroke();
    nodes.forEach(([x, y], i) => dot(x * s, y * s, s * (i === 3 ? .2 : .15)));
  } else if (glyph === 'gear') {
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? .62 : .9; g.lineTo(Math.cos(a) * r * s, Math.sin(a) * r * s); }
    g.closePath(); g.stroke(); g.beginPath(); g.arc(0, 0, s * .28, 0, Math.PI * 2); g.stroke();
  } else if (glyph === 'stack') {
    for (const y of [-.55, 0, .55]) { g.beginPath(); g.ellipse(0, y * s, s * .78, s * .2, 0, 0, Math.PI * 2); g.stroke(); }
  } else if (glyph === 'leaf') {
    g.beginPath(); g.moveTo(-.65 * s, .7 * s); g.quadraticCurveTo(-.7 * s, -.75 * s, .75 * s, -.75 * s); g.quadraticCurveTo(.7 * s, .65 * s, -.65 * s, .7 * s); g.stroke();
    g.beginPath(); g.moveTo(-.65 * s, .7 * s); g.lineTo(.35 * s, -.3 * s); g.stroke();
  } else if (glyph === 'table') {
    g.beginPath(); g.arc(0, 0, s * .42, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; dot(Math.cos(a) * s * .8, Math.sin(a) * s * .8, s * .13); }
  } else if (glyph === 'flask') {
    g.beginPath(); g.moveTo(-.22 * s, -.85 * s); g.lineTo(-.22 * s, -.2 * s); g.lineTo(-.7 * s, .75 * s); g.lineTo(.7 * s, .75 * s); g.lineTo(.22 * s, -.2 * s); g.lineTo(.22 * s, -.85 * s); g.stroke();
    g.beginPath(); g.moveTo(-.38 * s, -.85 * s); g.lineTo(.38 * s, -.85 * s); g.moveTo(-.48 * s, .3 * s); g.lineTo(.48 * s, .3 * s); g.stroke();
  } else {
    for (const y of [-.35, .25]) { g.beginPath(); g.moveTo(-.75 * s, (y + .45) * s); g.lineTo(0, (y - .3) * s); g.lineTo(.75 * s, (y + .45) * s); g.stroke(); }
  }
  g.restore();
}
