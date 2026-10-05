// All equipment builders share window reservations, so no cabinet covers glass.
const WINDOWS = { 'front-door--archive': -1, 'floor--lab': 1,
  'archive--forum': 1, 'forum--bridge': -1 };

export function corridorWindows(link) {
  const side = WINDOWS[link.id];
  if (!side) return [];
  const length = Math.hypot(link.b.x-link.a.x, link.b.z-link.a.z);
  return [{ side, at: -length/2+.975, width: .76, height: .86, centerY: 1.64 }];
}

export function corridorWindowAt(link, side, at, halfWidth = 0) {
  return corridorWindows(link).some(w => w.side===side && Math.abs(w.at-at)<w.width/2+.22+halfWidth);
}
