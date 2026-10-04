// Metres. One shared pressure-hull plan drives geometry, collision and navigation.
export const MODULES = [
  { id: 'front-door', x: 0, z: 0, a: 2.8, cut: 1.2 },
  { id: 'archive', x: 0, z: -10, a: 3, cut: 1.3 },
  { id: 'floor', x: -10, z: -10, a: 3.1, cut: 1.3 },
  { id: 'lab', x: -10, z: -20, a: 2.8, cut: 1.2 },
  { id: 'forum', x: 0, z: -20, a: 3, cut: 1.3 },
  { id: 'commons', x: 10, z: -20, a: 3.2, cut: 1.4 },
  { id: 'bridge', x: 0, z: -30, a: 3.2, cut: 1.4 },
].map(m => ({ ...m, ports: [], terminal: { x: m.x + m.a - .95, z: m.z - m.a + .95 }, approach: { x: m.x + m.a - 1.65, z: m.z - m.a + 1.65 } }));

export const LINKS = [
  ['front-door', 'archive'], ['archive', 'floor'], ['floor', 'lab'],
  ['lab', 'forum'], ['archive', 'forum'], ['forum', 'commons'], ['forum', 'bridge'],
].map(([from, to]) => {
  const first = MODULES.find(m => m.id === from), second = MODULES.find(m => m.id === to);
  const dx = Math.sign(second.x - first.x), dz = Math.sign(second.z - first.z);
  const port = dx ? dx > 0 ? 'E' : 'W' : dz > 0 ? 'S' : 'N';
  first.ports.push(port); second.ports.push({ N: 'S', S: 'N', E: 'W', W: 'E' }[port]);
  return { id: `${from}--${to}`, from, to, a: { x: first.x + dx * first.a, z: first.z + dz * first.a }, b: { x: second.x - dx * second.a, z: second.z - dz * second.a }, width: 2.25 };
});

export function modulePolygon(m) {
  const a = m.a, b = a - m.cut;
  return [[-b,-a],[b,-a],[a,-b],[a,b],[b,a],[-b,a],[-a,b],[-a,-b]].map(([x,z]) => ({ x: x + m.x, z: z + m.z }));
}

export function insidePolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x-a.x) * (z-a.z) / (b.z-a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function moduleAt(point) {
  return MODULES.find(m => insidePolygon(point.x, point.z, modulePolygon(m)));
}

// Shortest module graph route. In a connector, first continue to the nearer
// destination-side endpoint. Every waypoint crosses a real hatch opening.
export function routeTo(position, targetId) {
  const goal = MODULES.find(m => m.id === targetId);
  if (!goal) return [];
  const paths = new Map([[goal.id, { distance: 0, next: null }]]), pending = [goal.id];
  while (pending.length) {
    pending.sort((a,b) => paths.get(a).distance - paths.get(b).distance);
    const id = pending.shift(), m = MODULES.find(m => m.id === id);
    for (const link of LINKS.filter(l => l.from === id || l.to === id)) {
      const otherId = link.from === id ? link.to : link.from, other = MODULES.find(m => m.id === otherId);
      const distance = paths.get(id).distance + Math.hypot(m.x-other.x,m.z-other.z);
      if (!paths.has(otherId) || distance < paths.get(otherId).distance) { paths.set(otherId, { distance, next: id }); pending.push(otherId); }
    }
  }
  let current = moduleAt(position), result = [], entering = false;
  if (!current) {
    const link = LINKS.find(l => Math.abs(position.x-(l.a.x+l.b.x)/2) <= Math.abs(l.a.x-l.b.x)/2+l.width/2 && Math.abs(position.z-(l.a.z+l.b.z)/2) <= Math.abs(l.a.z-l.b.z)/2+l.width/2);
    if (!link) return [];
    current = [link.from,link.to].map(id => MODULES.find(m => m.id === id)).sort((a,b) => Math.hypot(a.x-position.x,a.z-position.z)+paths.get(a.id).distance-Math.hypot(b.x-position.x,b.z-position.z)-paths.get(b.id).distance)[0];
    const entry = link.from === current.id ? link.a : link.b;
    result.push({ ...entry });
    entering = true;
  }
  while (current.id !== goal.id) {
    const nextId = paths.get(current.id).next;
    const link = LINKS.find(l => (l.from === current.id && l.to === nextId) || (l.to === current.id && l.from === nextId));
    const exit = link.from === current.id ? link.a : link.b;
    const dx = Math.sign(exit.x-current.x), dz = Math.sign(exit.z-current.z);
    const along = (position.x-current.x)*dx + (position.z-current.z)*dz;
    const across = (position.x-current.x)*dz - (position.z-current.z)*dx;
    // Corner equipment stays outside the central aisle. Once walking along the
    // exit aisle, keep the next hatch ahead instead of pointing back to centre.
    if (entering || along < -.35 || Math.abs(across) > .65) result.push({ x: current.x, z: current.z });
    result.push({ ...exit }, { ...(link.from === current.id ? link.b : link.a) });
    current = MODULES.find(m => m.id === nextId);
    entering = true;
  }
  result.push({ ...goal.approach });
  while (result.length > 1 && Math.hypot(result[0].x-position.x,result[0].z-position.z) < .65) result.shift();
  return result;
}
