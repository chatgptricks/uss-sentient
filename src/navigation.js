export const PLAYER_RADIUS = 0.34;
export const START = { x: 0, z: -44 };

export function createWalkable(rooms) {
  return [
    { x: 0, z: -4, w: 12, d: 86 },
    { x: 0, z: -53, w: 24, d: 18 },
    ...rooms.filter(r => r.id !== 'front-door').flatMap(r => {
      const width = r.w || 22, depth = r.d || 18;
      const inner = Math.abs(r.x) - width / 2;
      return [
        { x: r.x, z: r.z, w: width, d: depth },
        { x: Math.sign(r.x) * (6 + inner) / 2, z: r.z, w: inner - 6 + .2, d: 4.8 },
      ];
    }),
  ];
}

export function canWalk(x, z, areas, colliders = []) {
  // Test the player's perimeter against the union, preserving open door seams.
  const radius = PLAYER_RADIUS;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const px = x + Math.cos(angle) * radius;
    const pz = z + Math.sin(angle) * radius;
    if (!areas.some(a => Math.abs(px - a.x) <= a.w / 2 && Math.abs(pz - a.z) <= a.d / 2)) return false;
  }
  return !colliders.some(c => Math.abs(x - c.x) < c.w / 2 + radius && Math.abs(z - c.z) < c.d / 2 + radius);
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
