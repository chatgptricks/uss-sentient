// Metres. One shared pressure-hull plan drives geometry, collision and navigation.
export const MODULES = [
  { id: 'front-door', x: 0, z: 0, hx: 2.55, hz: 3.3, cut: 1.35, character: 'docking' },
  { id: 'archive', x: 0, z: -11, hx: 2.45, hz: 3.15, cut: 1.0, character: 'vault' },
  { id: 'floor', x: -11, z: -11, hx: 3.7, hz: 2.7, cut: 1.3, character: 'workshop' },
  { id: 'lab', x: -11, z: -22, hx: 2.7, hz: 3.4, cut: 1.65, character: 'laboratory' },
  { id: 'forum', x: 0, z: -22, hx: 3.4, hz: 2.55, cut: 1.25, character: 'junction' },
  { id: 'commons', x: 11.5, z: -22, hx: 3.9, hz: 2.7, cut: 1.5, character: 'habitat' },
  { id: 'bridge', x: 0, z: -35, hx: 4.8, hz: 5.0, cut: 2.2, character: 'observatory' },
].map(m => {
  const south = m.id === 'bridge';
  const elevation = {floor:-1.05, lab:-1.05, commons:.75, bridge:1.5}[m.id] || 0;
  const terminal = { x: m.x + m.hx - m.cut / 2 - .35, z: m.z + (south ? 1 : -1) * (m.hz - m.cut / 2 - .35) };
  return { ...m, elevation, a: Math.min(m.hx,m.hz), ports: [], terminal,
    terminalYaw: south ? -Math.PI * 3 / 4 : -Math.PI / 4,
    approach: { x: terminal.x - .7, z: terminal.z + (south ? -.7 : .7) } };
});

export const LINKS = [
  ['front-door', 'archive'], ['archive', 'floor'], ['floor', 'lab'],
  ['lab', 'forum'], ['archive', 'forum'], ['forum', 'commons'], ['forum', 'bridge'],
].map(([from, to]) => {
  const first = MODULES.find(m => m.id === from), second = MODULES.find(m => m.id === to);
  const dx = Math.sign(second.x - first.x), dz = Math.sign(second.z - first.z);
  const port = dx ? dx > 0 ? 'E' : 'W' : dz > 0 ? 'S' : 'N';
  first.ports.push(port); second.ports.push({ N: 'S', S: 'N', E: 'W', W: 'E' }[port]);
  const widths = { 'front-door': 2.25, 'floor': 2.5, 'lab': 2.05 };
  const width = to === 'commons' ? 2.7 : to === 'bridge' ? 2.5 : to === 'floor' ? 2.0 : widths[from] || 2.3;
  return { id: `${from}--${to}`, from, to, a: { x: first.x + dx * first.hx, z: first.z + dz * first.hz }, b: { x: second.x - dx * second.hx, z: second.z - dz * second.hz }, width, elevationA: first.elevation, elevationB: second.elevation, kind: first.elevation === second.elevation ? 'level' : to === 'commons' ? 'ramp' : 'stairs' };
});

// Dedicated EVA side port; this is not an eighth Sentient department.
MODULES.find(m => m.id === 'front-door').ports.push('E');

// Each pressure body has a different, deliberately asymmetric expansion. Values
// describe distance along the original face and metres outward. Cardinal hatch
// faces and the department terminal stay fixed, so old passageways still align.
export const HULL_PROFILES = {
  'front-door': { name: 'Offset docking nose', face: 4, main: 2, path: [[-.12,.75],[-.06,1.75],[.94,2.1],[1.13,.85]] },
  archive: { name: 'Stepped data vault', face: 2, main: 2, path: [[0,.7],[.18,1.5],[.72,1.5],[.72,.45],[1,.45]] },
  floor: { name: 'Fabrication and machinery bay', face: 4, main: 3, path: [[.02,.35],[.08,2.8],[.3,3.5],[.95,3.5],[1,2.0]] },
  lab: { name: 'Faceted specimen lobe', face: 6, main: 3, path: [[-.14,.7],[-.12,1.5],[.1,1.95],[.88,1.75],[1.05,.9]] },
  forum: { name: 'Six-seat strategy chamber', face: 3, main: 3, path: [[-.9,2.1],[-1.2,4.5],[-.35,6.1],[1.8,6.1],[2.2,4.3],[1.8,2.0]] },
  commons: { name: 'Habitat and sanitation crescent', face: 4, main: 3, path: [[-.3,.8],[-.3,4.2],[-.021,4.95],[.75,4.85],[1.05,2.8],[1,1]] },
  bridge: { name: 'Offset panoramic prow', face: 0, main: 2, path: [[-.12,1.05],[.08,2.45],[.7,3.3],[1.1,2.55],[1.15,.85]] },
};

function corePolygon(m) {
  const x = m.hx, z = m.hz, cx = x - m.cut, cz = z - m.cut;
  return [[-cx,-z],[cx,-z],[x,-cz],[x,cz],[cx,z],[-cx,z],[-x,cz],[-x,-cz]].map(([x,z]) => ({ x: x + m.x, z: z + m.z }));
}

// Module geometry is immutable after construction; reuse its boundary during movement.
const edgeCache = new WeakMap(), polygonCache = new WeakMap();

// Semantic faces remain N, NE, E, SE, S, SW, W, NW even when the boundary
// gains extra vertices. Wall-mounted systems use the main face of each bay.
export function moduleEdges(m) {
  if (edgeCache.has(m)) return edgeCache.get(m);
  const core = corePolygon(m), profile = HULL_PROFILES[m.id], edges = [];
  for (let face = 0; face < 8; face++) {
    const a = core[face], b = core[(face + 1) % 8];
    const dx = b.x-a.x, dz = b.z-a.z, length = Math.hypot(dx,dz);
    const expanded = profile?.face === face;
    const path = expanded ? [a, ...profile.path.map(([t,d]) => ({x:a.x+dx*t+dz/length*d,z:a.z+dz*t-dx/length*d})), b] : [a,b];
    for (let segment = 0; segment < path.length-1; segment++) {
      const primary = !expanded || segment === profile.main;
      edges.push({a:path[segment],b:path[segment+1],face,index:primary?face:8+face,primary,expanded,
        port:!expanded?({0:'N',2:'E',4:'S',6:'W'})[face]:undefined,
        panoramic:expanded && m.id==='bridge' });
    }
  }
  edgeCache.set(m,edges);
  return edges;
}

export function moduleFacet(m, index) {
  return moduleEdges(m).find(edge => edge.index === index && edge.primary);
}

export function facetInset(m, edge) {
  const dx=edge.b.x-edge.a.x, dz=edge.b.z-edge.a.z, length=Math.hypot(dx,dz);
  const radius=((m.x-edge.a.x)*-dz+(m.z-edge.a.z)*dx)/length;
  return radius*.17+.16;
}

export function modulePolygon(m) {
  if (!polygonCache.has(m)) polygonCache.set(m,moduleEdges(m).map(edge => edge.a));
  return polygonCache.get(m);
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

export function surfaceHeight(point) {
  const module = moduleAt(point);
  if (module) return module.elevation;
  for (const link of LINKS) {
    const dx = link.b.x-link.a.x, dz = link.b.z-link.a.z, length2 = dx*dx+dz*dz;
    const t = Math.max(0,Math.min(1,((point.x-link.a.x)*dx+(point.z-link.a.z)*dz)/length2));
    const x = link.a.x+t*dx, z = link.a.z+t*dz;
    if (Math.hypot(point.x-x,point.z-z) <= link.width/2+.05) {
      const steps = Math.max(1,Math.round(Math.abs(link.elevationB-link.elevationA)/.15));
      const factor = link.kind === 'stairs' ? Math.min(steps,Math.floor(t*steps+.0001))/steps : t;
      return link.elevationA+(link.elevationB-link.elevationA)*factor;
    }
  }
  return 0;
}
