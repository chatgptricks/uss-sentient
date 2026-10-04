import * as THREE from 'three';

/** Department-specific hardware, attached to the actual moving leaves. */
export function createHatchDesign({ kit, addMesh, texture, textPlane, materials: M }) {
  const maps = new Map(), shapes = new Map();
  const stats = { parts: 0, decorativeMeshes: 0 };
  const B = (parent, x, y, z, w, h, d, material = M.enamel) => { kit.cuboid(x, y, z, w, h, d, material, 0, parent); stats.parts++; };
  const P = (parent, a, b, radius, material = M.silver, sides = 10) => { kit.pipe(a, b, radius, material, sides, parent); stats.parts++; };
  const bolt = (parent, x, y, z, face, radius = .024) => { kit.bolt(x, y, z, face > 0 ? 0 : Math.PI, M.silver, radius, parent); stats.parts++; };
  function rounded(x, y, w, h, r, shape = new THREE.Shape()) {
    shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y); return shape;
  }
  function chamfered(w, h, cut, y = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + cut, y); shape.lineTo(w / 2 - cut, y);
    shape.lineTo(w / 2, y + cut); shape.lineTo(w / 2, y + h - cut);
    shape.lineTo(w / 2 - cut, y + h); shape.lineTo(-w / 2 + cut, y + h);
    shape.lineTo(-w / 2, y + h - cut); shape.lineTo(-w / 2, y + cut); shape.closePath();
    return shape;
  }
  function shapeMesh(key, shape, depth, material, parent, x, y, z, face = 1) {
    if (!shapes.has(key)) shapes.set(key, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, bevelSize: .009, bevelThickness: .007, curveSegments: 8 }));
    const mesh = addMesh(shapes.get(key), material, parent); mesh.position.set(x, y, z);
    if (face < 0) mesh.rotation.y = Math.PI;
    stats.decorativeMeshes++; return mesh;
  }
  function ring(parent, x, y, z, radius, thickness, material, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = i * Math.PI * 2 / count, b = (i + 1) * Math.PI * 2 / count;
      P(parent, [x + Math.cos(a) * radius, y + Math.sin(a) * radius, z], [x + Math.cos(b) * radius, y + Math.sin(b) * radius, z], thickness, material, 6);
    }
  }
  function badge(parent, content, sub, x, y, z, face, width = .40, height = .19, large = false) {
    const key = `${content}/${sub}/${large}`;
    if (!maps.has(key)) maps.set(key, texture(512, large ? 640 : 224, (g, w, h) => {
      g.fillStyle = large ? '#cfff04' : '#e5e7dc';
      g.font = `500 ${large ? 530 : 105}px Space, Arial`; g.textAlign = 'center';
      g.fillText(content, w / 2, large ? 512 : 124, w - 25);
      if (sub) { g.fillStyle = '#acb8ac'; g.font = '400 38px Space, Arial'; g.fillText(sub, w / 2, h - 23, w - 25); }
    }));
    textPlane(maps.get(key), width, height, x, y, z, face > 0 ? 0 : Math.PI, parent);
  }

  function collar(parent, variant) {
    const command = variant === 'bridge';
    const radii = { 'front-door': .41, archive: .24, floor: .13, lab: .75, commons: .89, forum: .29 };
    const shape = command ? chamfered(2.53, 2.74, .31) : rounded(-1.19, 0, 2.38, 2.68, radii[variant] ?? .65);
    // The aperture is independent of the outside silhouette. It remains wider
    // than the original inner gasket, which continues to define safe clearance.
    shape.holes.push(rounded(-1.055, .060, 2.11, 2.53, .61, new THREE.Path()));
    shapeMesh(`collar/${variant}`, shape, command ? .235 : .18, command ? M.seal : M.graphite, parent, 0, -.07, command ? -.118 : -.10);
    if (command) {
      const backing = chamfered(2.60, 2.79, .34);
      backing.holes.push(rounded(-1.125, .045, 2.25, 2.66, .61, new THREE.Path()));
      shapeMesh('command/backing', backing, .035, M.silver, parent, 0, -.084, -.02);
    }
  }

  function leaf(side, parent, variant, number) {
    const x = -.465 * side;
    for (const face of [-1, 1]) {
      const z = face * .074;
      // Sealed seam strip sits clear of every department's main mechanical motif.
      B(parent, -.024 * side, 1.28, face * .071, .026, 1.46, .029, M.silver);
      if (variant === 'front-door') {
        for (const y of [.77, 1.24, 1.71]) {
          B(parent, x, y, z, .60, .361, .043, M.graphite);
          shapeMesh('arrival/pad', rounded(-.28, -.15, .56, .30, .065), .047, M.padding, parent, x, y, face * .086, face);
          B(parent, x, y - .008, face * .148, .49, .038, .024, M.enamel);
          for (const dx of [-.238, .238]) bolt(parent, x + dx, y, face * .165, face, .026);
        }
        for (const dx of [-.217, .217]) B(parent, x + dx, 1.235, face * .141, .029, 1.27, .022, M.graphite);
      } else if (variant === 'archive') {
        for (let row = 0; row < 5; row++) {
          const y = .61 + row * .302;
          B(parent, x, y, z, .62, .276, .045, M.seal);
          B(parent, x, y, face * .112, .569, .239, .062, row % 2 ? M.enamel : M.hull);
          B(parent, x + .238 * side, y, face * .151, .021, .172, .018, M.silver);
        }
        ring(parent, x, 1.20, face * .159, .143, .019, M.graphite, 12);
        P(parent, [x, 1.20, face * .15], [x, 1.20, face * .179], .075, M.silver, 6);
        for (const dy of [-.455, .455]) P(parent, [x, 1.2 + dy, face * .143], [x, 1.2 + dy, face * .165], .038, M.graphite, 6);
      } else if (variant === 'floor') {
        B(parent, x, 1.26, z, .62, 1.54, .05, M.graphite);
        for (const y of [.61, 1.22, 1.83]) {
          B(parent, x, y, face * .124, .64, .112, .088, M.enamel);
          for (const dx of [-.249, .249]) bolt(parent, x + dx, y, face * .177, face, .031);
        }
        P(parent, [x - .225, .68, face * .134], [x + .225, 1.76, face * .134], .057, M.silver, 4);
        P(parent, [x + .225, .68, face * .134], [x - .225, 1.76, face * .134], .057, M.silver, 4);
        for (const y of [.94, 1.51]) B(parent, x, y, face * .189, .20, .044, .015, M.accent);
      } else if (variant === 'lab') {
        // A real hole in the base leaf is glazed and ringed on both faces.
        ring(parent, x, 1.47, face * .093, .168, .023, M.silver, 20);
        ring(parent, x, 1.47, face * .111, .147, .007, M.seal, 20);
        for (const dy of [-.204, .204]) bolt(parent, x, 1.47 + dy, face * .093, face, .017);
        B(parent, x, .85, z, .49, .39, .040, M.enamel);
        B(parent, x, .842, face * .101, .37, .246, .019, M.graphite);
        for (let i = 0; i < 6; i++) B(parent, x, .754 + i * .035, face * .12, .307, .012, .021, M.silver);
        B(parent, x, 1.97, face * .082, .37, .061, .026, M.blueLight);
      } else if (variant === 'commons') {
        shapeMesh('commons/soft-panel', rounded(-.294, -.735, .588, 1.47, .23), .032, M.padding, parent, x, 1.24, face * .078, face);
        P(parent, [x, .75, face * .127], [x, 1.73, face * .127], .013, M.enamel, 8);
        const foliage = [];
        for (let i = 0; i < 4; i++) {
          const sx = i % 2 ? -1 : 1, y = -.43 + i * .24, shape = new THREE.Shape();
          shape.moveTo(0, y); shape.quadraticCurveTo(sx * .225, y + .015, sx * .212, y + .20);
          shape.quadraticCurveTo(sx * .035, y + .20, 0, y); foliage.push(shape);
        }
        shapeMesh('commons/botanical-relief', foliage, .019, M.enamel, parent, x, 1.25, face * .128, face);
        for (const dy of [-.71, .71]) B(parent, x, 1.24 + dy, face * .142, .225, .026, .019, M.silver);
      } else if (variant === 'forum') {
        shapeMesh('forum/comms-panel', chamfered(.61, 1.43, .095, -.715), .043, M.enamel, parent, x, 1.25, face * .078, face);
        for (const [dx, dy, radius] of [[-.125, -.31, .10], [.115, -.04, .117], [-.115, .31, .084]]) {
          P(parent, [x + dx, 1.25 + dy, face * .122], [x + dx, 1.25 + dy, face * .161], radius, M.graphite, 6);
          P(parent, [x + dx, 1.25 + dy, face * .162], [x + dx, 1.25 + dy, face * .177], radius * .69, M.silver, 6);
        }
        for (const dy of [-.19, .16]) P(parent, [x - .15, 1.25 + dy + .05, face * .15], [x + .145, 1.25 + dy - .05, face * .15], .018, M.graphite, 6);
        for (let i = 0; i < 4; i++) B(parent, x - .135 + i * .09, 1.845, face * .143, .043, .023, .026, i === 1 ? M.accent : M.graphite);
      } else if (variant === 'bridge') {
        // Three armor sections per leaf keep the oversized identity readable
        // while giving the command airlock a sharply different physical profile.
        for (const [row, y] of [.665, 1.21, 1.755].entries()) {
          shapeMesh(`command/armor-${row}`, chamfered(.635, .486, .092, -.243), .055, row === 1 ? M.graphite : M.seal, parent, x, y, face * .071, face);
          for (const dx of [-.222, .222]) bolt(parent, x + dx, y, face * .143, face, .022);
        }
        for (const y of [.474, 1.958]) {
          P(parent, [x - .238, y + .08, face * .153], [x, y - .007, face * .153], .025, M.accent, 4);
          P(parent, [x, y - .007, face * .153], [x + .238, y + .08, face * .153], .025, M.accent, 4);
        }
        B(parent, x + .305 * side, 1.26, face * .114, .038, 1.25, .063, M.silver);
        const digit = face > 0 ? (side > 0 ? '0' : '7') : (side > 0 ? '7' : '0');
        badge(parent, digit, '', x, 1.255, face * .157, face, .43, .63, true);
      }
      if (variant !== 'bridge') badge(parent, number, variant === 'lab' ? 'CLEAN ACCESS' : variant === 'commons' ? 'BIOSPHERE' : '', x, 2.13, face * .080, face, .34, .17);
    }
    if (variant === 'lab') {
      const glass = addMesh(new THREE.CircleGeometry(.141, 24), M.glass, parent);
      glass.position.set(x, 1.47, 0); glass.castShadow = false;
      stats.decorativeMeshes++;
    }
  }

  function frame(parent, variant) {
    for (const face of [-1, 1]) {
      if (variant === 'bridge') {
        for (const side of [-1, 1]) {
          // Split fixed actuators stay outboard of the original jamb's inner edge.
          for (const y of [.57, 1.31, 2.01]) {
            B(parent, side * 1.156, y, face * .162, .19, .36, .13, M.graphite);
            B(parent, side * 1.156, y, face * .235, .122, .285, .024, M.enamel);
            B(parent, side * 1.156, y, face * .255, .071, .080, .019, M.accent);
          }
          P(parent, [side * .96, 2.40, face * .175], [side * .77, 2.574, face * .175], .043, M.accent, 4);
        }
        B(parent, 0, 2.442, face * .247, 1.51, .253, .057, M.seal);
        badge(parent, '07 / BRIDGE', 'COMMAND AIRLOCK', 0, 2.448, face * .285, face, 1.35, .235);
      } else if (variant === 'floor' || variant === 'archive') {
        for (const side of [-1, 1]) for (const y of [.48, 1.91]) {
          B(parent, side * 1.087, y, face * .166, .173, .255, .065, M.enamel);
          bolt(parent, side * 1.087, y, face * .21, face, variant === 'floor' ? .040 : .030);
        }
      } else if (variant === 'lab') {
        for (const side of [-1, 1]) B(parent, side * 1.087, 1.56, face * .172, .069, .63, .038, M.enamel);
      } else if (variant === 'commons') {
        for (const side of [-1, 1]) P(parent, [side * 1.090, .65, face * .172], [side * 1.09, 1.90, face * .172], .040, M.padding, 12);
      }
    }
  }
  return { collar, leaf, frame, stats };
}
