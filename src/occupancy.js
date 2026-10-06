// Oriented boxes and a coarse spatial hash. Late detail passes use them to find
// genuinely free wall space instead of assuming which panels are still empty.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** An oriented box from a column-major affine matrix and a local bounding box. */
export function obbFromMatrix(e, min = [-.5, -.5, -.5], max = [.5, .5, .5]) {
  const lc = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const lh = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
  const c = [
    e[0] * lc[0] + e[4] * lc[1] + e[8] * lc[2] + e[12],
    e[1] * lc[0] + e[5] * lc[1] + e[9] * lc[2] + e[13],
    e[2] * lc[0] + e[6] * lc[1] + e[10] * lc[2] + e[14],
  ];
  const u = [], half = [];
  for (let i = 0; i < 3; i++) {
    const col = [e[i * 4], e[i * 4 + 1], e[i * 4 + 2]], length = Math.hypot(...col) || 1;
    u.push(col.map(v => v / length)); half.push(lh[i] * length);
  }
  return { c, u, e: half, r: Math.hypot(...half) };
}

/** A box in a yawed wall frame: x along the wall, y up, z out of the wall. */
export function frameObb(origin, yaw, center, half) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return {
    c: [origin.x + center[0] * c + center[2] * s, center[1], origin.z - center[0] * s + center[2] * c],
    u: [[c, 0, -s], [0, 1, 0], [s, 0, c]], e: [...half], r: Math.hypot(...half),
  };
}

/** Separating-axis test for two oriented boxes. `margin` grows the first box,
 * either uniformly or per local axis (e.g. none towards the wall it touches). */
export function obbOverlap(a, b, margin = 0) {
  const grow = Array.isArray(margin) ? margin : [margin, margin, margin];
  if (Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1], a.c[2] - b.c[2]) > a.r + b.r + Math.hypot(...grow)) return false;
  const ae = a.e.map((v, i) => v + grow[i]), be = b.e, R = [[], [], []], A = [[], [], []];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { R[i][j] = dot(a.u[i], b.u[j]); A[i][j] = Math.abs(R[i][j]) + 1e-7; }
  const d = [b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2]], t = [dot(d, a.u[0]), dot(d, a.u[1]), dot(d, a.u[2])];
  for (let i = 0; i < 3; i++) if (Math.abs(t[i]) > ae[i] + be[0] * A[i][0] + be[1] * A[i][1] + be[2] * A[i][2]) return false;
  for (let j = 0; j < 3; j++) if (Math.abs(t[0] * R[0][j] + t[1] * R[1][j] + t[2] * R[2][j]) > ae[0] * A[0][j] + ae[1] * A[1][j] + ae[2] * A[2][j] + be[j]) return false;
  for (let i = 0; i < 3; i++) {
    const i1 = (i + 1) % 3, i2 = (i + 2) % 3;
    for (let j = 0; j < 3; j++) {
      const j1 = (j + 1) % 3, j2 = (j + 2) % 3;
      const ra = ae[i1] * A[i2][j] + ae[i2] * A[i1][j], rb = be[j1] * A[i][j2] + be[j2] * A[i][j1];
      if (Math.abs(t[i2] * R[i1][j] - t[i1] * R[i2][j]) > ra + rb) return false;
    }
  }
  return true;
}

export function pointInObb(p, o, margin = 0) {
  const d = [p[0] - o.c[0], p[1] - o.c[1], p[2] - o.c[2]];
  return o.u.every((axis, i) => Math.abs(dot(d, axis)) <= o.e[i] + margin);
}

/** Boxes bucketed on a horizontal grid. Large boxes simply occupy more cells. */
export function createOccupancy(cell = 1) {
  const grid = new Map(), all = [];
  const key = (x, z) => `${x},${z}`;
  function cells(o, pad, visit) {
    const reach = o.r + pad;
    for (let x = Math.floor((o.c[0] - reach) / cell); x <= Math.floor((o.c[0] + reach) / cell); x++)
      for (let z = Math.floor((o.c[2] - reach) / cell); z <= Math.floor((o.c[2] + reach) / cell); z++) visit(key(x, z));
  }
  return {
    get size() { return all.length; },
    add(o) {
      all.push(o);
      cells(o, 0, k => { if (!grid.has(k)) grid.set(k, []); grid.get(k).push(o); });
      return o;
    },
    overlaps(o, margin = 0) {
      let hit = false;
      const seen = new Set();
      cells(o, Array.isArray(margin) ? Math.max(...margin) : margin, k => {
        if (hit) return;
        for (const other of grid.get(k) || []) {
          if (seen.has(other)) continue; seen.add(other);
          if (obbOverlap(o, other, margin)) { hit = true; return; }
        }
      });
      return hit;
    },
    contains(p, margin = 0) {
      const list = grid.get(key(Math.floor(p[0] / cell), Math.floor(p[2] / cell))) || [];
      return list.some(o => pointInObb(p, o, margin));
    },
  };
}

/** Small deterministic generator, so every load furnishes the same station. */
export function seededRandom(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
