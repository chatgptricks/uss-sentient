import { MODULES, LINKS, modulePolygon, insidePolygon } from './layout.js';

export const PLAYER_RADIUS = 0.28;
export const START = { x: 0, z: 1.3 };

export function createWalkable() {
  return [
    ...MODULES.map(m => ({ id: m.id, points: modulePolygon(m), x: m.x, z: m.z })),
    ...LINKS.map(l => ({ id: l.id, x: (l.a.x+l.b.x)/2, z: (l.a.z+l.b.z)/2,
      w: Math.abs(l.a.x-l.b.x) + (l.a.x===l.b.x ? l.width-.45 : .12),
      d: Math.abs(l.a.z-l.b.z) + (l.a.z===l.b.z ? l.width-.45 : .12) })),
  ];
}

export function canWalk(x, z, areas, colliders = []) {
  // Test the player's perimeter against the union, preserving open door seams.
  const radius = PLAYER_RADIUS;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const px = x + Math.cos(angle) * radius;
    const pz = z + Math.sin(angle) * radius;
    if (!areas.some(a => a.points ? insidePolygon(px, pz, a.points) : Math.abs(px - a.x) <= a.w / 2 && Math.abs(pz - a.z) <= a.d / 2)) return false;
  }
  return !colliders.some(c => !c.disabled && Math.abs(x - c.x) < c.w / 2 + radius && Math.abs(z - c.z) < c.d / 2 + radius);
}

export function movePlayer(position, dx, dz, areas, colliders = []) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
  const next = { x: position.x, z: position.z };
  for (let i = 0; i < steps; i++) {
    if (canWalk(next.x + dx / steps, next.z, areas, colliders)) next.x += dx / steps;
    if (canWalk(next.x, next.z + dz / steps, areas, colliders)) next.z += dz / steps;
  }
  return next;
}

export function readProgress(storage, rooms) {
  try {
    const saved = JSON.parse(storage.getItem('uss-sentient-expedition-v1') || '[]');
    return new Set(Array.isArray(saved) ? saved.filter(id => rooms.some(r => r.id === id)) : []);
  } catch { return new Set(); }
}
