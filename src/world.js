import * as THREE from 'three';

const ACID = 0xcfff04;
const TAU = Math.PI * 2;

/** USS Sentient: the architectural scene and its animated exhibits. */
export function createWorld(scene, rooms) {
  const root = new THREE.Group();
  root.name = 'USS Sentient';
  scene.add(root);
  const animated = [];
  const terminalMeshes = [];
  const colliders = [];
  const textures = [];
  const batches = new Map();
  const materials = [];
  const makeMaterial = (options) => {
    const material = new THREE.MeshStandardMaterial(options);
    materials.push(material);
    return material;
  };
  const hull = makeMaterial({ color: 0xe2e0d6, roughness: .64, metalness: .16 });
  const lightHull = makeMaterial({ color: 0xf1efe6, roughness: .56, metalness: .2 });
  const rib = makeMaterial({ color: 0x667478, roughness: .4, metalness: .68 });
  const black = makeMaterial({ color: 0x1d282e, roughness: .62, metalness: .3 });
  const white = makeMaterial({ color: 0xe9e8e0, roughness: .6, metalness: .12 });
  const lime = makeMaterial({ color: ACID, emissive: ACID, emissiveIntensity: .9, roughness: .38 });
  const dimLime = makeMaterial({ color: ACID, emissive: ACID, emissiveIntensity: .35, roughness: .5 });
  const warm = makeMaterial({ color: 0xf0f6da, emissive: 0xf0f6da, emissiveIntensity: 1.5 });
  const cool = makeMaterial({ color: 0x92c4c8, emissive: 0x92c4c8, emissiveIntensity: .65 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x839e97, transparent: true, opacity: .085, metalness: .1, roughness: .05, side: THREE.DoubleSide, depthWrite: false });
  const hologramMaterial = new THREE.MeshBasicMaterial({ color: ACID, transparent: true, opacity: .33, wireframe: true, depthWrite: false });
  materials.push(glass, hologramMaterial);

  function canvasTexture(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    draw(context, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.push(texture);
    return texture;
  }

  const floorTexture = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#283337'; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#354145'; ctx.fillRect(5, 5, 502, 502);
    ctx.fillStyle = '#303c40'; ctx.fillRect(9, 9, 494, 494);
    ctx.strokeStyle = '#55615e'; ctx.lineWidth = 2;
    ctx.strokeRect(17, 17, 478, 478);
    ctx.strokeStyle = '#202c30'; ctx.lineWidth = 3;
    for (let x = 40; x < 490; x += 18) { ctx.beginPath(); ctx.moveTo(x, 53); ctx.lineTo(x, 459); ctx.stroke(); }
    ctx.fillStyle = '#81907f';
    for (const x of [26, 486]) for (const y of [26, 486]) ctx.fillRect(x - 3, y - 3, 6, 6);
  });
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;

  const shapes = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
    sphere: new THREE.SphereGeometry(1, 16, 12),
  };
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler();
  function shape(kind, x, y, z, sx, sy, sz, material, ry = 0, rz = 0) {
    const key = `${kind}-${material.uuid}`;
    if (!batches.has(key)) batches.set(key, { geometry: shapes[kind], material, transforms: [] });
    q.setFromEuler(euler.set(0, ry, rz));
    matrix.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
    batches.get(key).transforms.push(matrix.clone());
  }
  const box = (x, y, z, w, h, d, mat = hull, ry = 0, rz = 0) => shape('box', x, y, z, w, h, d, mat, ry, rz);
  const cylinder = (x, y, z, r, h, mat = hull) => shape('cylinder', x, y, z, r, h, r, mat);
  const sphere = (x, y, z, r, mat = white) => shape('sphere', x, y, z, r, r, r, mat);

  function plane(texture, w, h, x, y, z, ry = 0, opacity = 1) {
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: opacity < 1, opacity, side: THREE.DoubleSide, toneMapped: false });
    materials.push(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    root.add(mesh);
    return mesh;
  }

  function label(title, subtitle, width = 1024, height = 256, number = '') {
    return canvasTexture(width, height, (ctx, w, h) => {
      ctx.fillStyle = '#0d171a'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#596459'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2);
      ctx.fillStyle = '#cfff04'; ctx.fillRect(0, 0, 9, h);
      const left = number ? 155 : 42;
      if (number) { ctx.font = '700 88px Space, Arial'; ctx.fillText(number, 35, 123); }
      ctx.fillStyle = '#f5f5ef';
      ctx.font = `600 ${title.length > 22 ? 41 : 53}px Space, Arial`;
      ctx.fillText(title.toUpperCase(), left, h * .45, w - left - 35);
      ctx.fillStyle = '#b6c48e'; ctx.font = '400 22px Space, Arial';
      ctx.fillText(subtitle.toUpperCase(), left, h * .72, w - left - 35);
      ctx.fillStyle = '#cfff04'; ctx.fillRect(w - 48, 24, 15, 15);
    });
  }

  function deck(x, z, w, d) {
    box(x, -.24, z, w, .48, d, hull);
    const tex = floorTexture.clone(); tex.needsUpdate = true;
    tex.repeat.set(w / 3, d / 3); textures.push(tex);
    const mat = makeMaterial({ map: tex, color: 0xb4c0b5, roughness: .75, metalness: .36 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .005, z); root.add(mesh);
  }

  function ring(x, y, z, radius, material = lime, rotation = Math.PI / 2, tube = .025) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 64), material);
    mesh.position.set(x, y, z); mesh.rotation.x = rotation; root.add(mesh); return mesh;
  }

  // Navigable ISS-inspired blockout: staggered sealed modules around a pressure spine.
  const sideRooms = rooms.filter(room => room.id !== 'front-door');
  const dimensions = room => ({ w: room.w || 22, d: room.d || 18 });
  const corridorStart = -44, corridorEnd = 39;
  deck(0, (corridorStart + corridorEnd) / 2, 12, corridorEnd - corridorStart);

  function octagonalFrame(x, z, width, height, material = rib, thickness = .3, depth = .35) {
    const half = width / 2, bevel = Math.min(1.2, width * .13);
    const passageSide = side => width === 11.45 && sideRooms.some(room => Math.sign(room.x) === side && Math.abs(room.z - z) < 2.65);
    if (!passageSide(-1)) box(x - half, height / 2, z, thickness, height - 2 * bevel, depth, material);
    if (!passageSide(1)) box(x + half, height / 2, z, thickness, height - 2 * bevel, depth, material);
    box(x, height, z, width - 2 * bevel, thickness, depth, material);
    box(x, .06, z, width - 2 * bevel, thickness, depth, material);
    for (const side of [-1, 1]) {
      box(x + side * (half - bevel / 2), height - bevel / 2, z, bevel * Math.SQRT2, thickness, depth, material, 0, side * Math.PI / 4);
      if (!passageSide(side)) box(x + side * (half - bevel / 2), bevel / 2, z, bevel * Math.SQRT2, thickness, depth, material, 0, -side * Math.PI / 4);
    }
  }

  // Each side has its own hatch locations; no mirrored department grid.
  for (const side of [-1, 1]) {
    const openings = sideRooms.filter(room => Math.sign(room.x) === side).map(room => [room.z - 2.4, room.z + 2.4]).sort((a, b) => a[0] - b[0]);
    let cursor = corridorStart;
    const segments = [];
    for (const [start, end] of openings) { if (start > cursor) segments.push([cursor, start]); cursor = end; }
    if (cursor < corridorEnd) segments.push([cursor, corridorEnd]);
    for (const [start, end] of segments) {
      const z = (start + end) / 2, length = end - start;
      box(side * 6.13, 3.05, z, .35, 6.1, length, hull);
      box(side * 5.89, .48, z, .22, .9, length, black);
      box(side * 5.94, 4.97, z, .12, .12, length, lightHull);
      box(side * 5.83, 1.04, z, .07, .045, length, dimLime);
      // Broad angled shoulder panels establish a pressure-hull cross-section.
      box(side * 5.52, 5.67, z, 1.45, .2, length, lightHull, 0, -side * Math.PI / 4);
      for (let panelZ = start + 1.2; panelZ < end - .7; panelZ += 3) {
        box(side * 5.935, 2.98, panelZ, .08, 3.25, 2.6, white);
        box(side * 5.88, 2.98, panelZ - 1.2, .055, 2.6, .035, rib);
      }
    }
    box(side * 4.72, .026, -2.5, .045, .025, 82.8, lightHull);
  }
  // Closed ceiling panels and structural hoops replace the glazed greenhouse roof.
  box(0, 6.29, -2.5, 10.2, .35, 83, hull);
  for (let z = -42; z < 38; z += 5) {
    box(0, 6.06, z, 8.8, .15, 4.65, white);
    box(0, 5.94, z, 1.5, .1, 4.5, black);
    for (const side of [-1, 1]) box(side * 3.1, 5.98, z, .26, .065, 3.3, warm);
    octagonalFrame(0, z - 2.5, 11.45, 6.04, rib, .16, .22);
    // Frames are recessed at hatches, keeping the full connection clear.
  }
  // Remove wall-crossing frame members through doorway zones with visible colliders
  // only on isolated support posts; passage openings are built independently below.
  for (let z = -44.5; z < 38; z += 5) {
    for (const side of [-1, 1]) {
      if (!sideRooms.some(room => Math.sign(room.x) === side && Math.abs(room.z - z) < 2.65)) {
        colliders.push({ x: side * 5.725, z, w: .16, d: .22 });
      }
    }
  }
  box(0, 3.1, 39.18, 12.4, 6.2, .38, hull);
  box(0, 2.55, 38.95, 4.4, 5.1, .12, black);
  octagonalFrame(0, 38.82, 4.65, 5.45, lightHull, .23, .22);
  plane(label('AFT AIRLOCK', 'USS SENTIENT / PRESSURE SEALED'), 4.2, 1.05, 0, 4.4, 38.7, Math.PI);

  for (const room of sideRooms) {
    const side = Math.sign(room.x), { w } = dimensions(room);
    const innerX = room.x - side * w / 2;
    const length = Math.abs(innerX) - 6;
    const cx = side * (6 + length / 2);
    deck(cx, room.z, length + .1, 4.8);
    box(cx, 5.28, room.z, length + .4, .35, 5.4, hull);
    for (const dz of [-2.55, 2.55]) {
      box(cx, 2.65, room.z + dz, length + .5, 5.3, .3, hull);
      box(cx, .42, room.z + dz - Math.sign(dz) * .23, length, .62, .16, black);
      box(cx, 4.79, room.z + dz - Math.sign(dz) * .38, length, .16, .75, lightHull, 0, 0);
    }
    box(cx, 5.05, room.z, Math.max(1, length - 1), .06, .25, warm);
    // Side-facing hatch portals, layered seals and chamfered shoulders.
    for (const hatchX of [side * 6, innerX]) {
      for (const dz of [-2.4, 2.4]) {
        box(hatchX, 2.55, room.z + dz, .38, 5.1, .28, rib);
        box(hatchX - side * .23, 2.25, room.z + dz, .055, 3.5, .075, lightHull);
      }
      box(hatchX, 4.92, room.z, .5, .45, 4.8, black);
      box(hatchX, 4.63, room.z, .53, .055, 2.7, warm);
      for (const dz of [-1, 1]) {
        // Wedge-shaped collar blocks at the upper corners of each hatch.
        shape('box', hatchX, 4.54, room.z + dz * 2.14, .5, .75, .75, lightHull, Math.PI / 4, 0);
      }
    }
  }

  // Forward observation deck: taller enclosed command module with a deep viewport.
  deck(0, -53, 24, 18);
  box(0, 9.44, -53, 22.5, .44, 18.7, hull);
  for (const x of [-8.5, -4.25, 0, 4.25, 8.5]) {
    box(x, 9.14, -53, 3.96, .15, 17.5, white);
    if (x !== 0) box(x, 8.98, -52, .2, .07, 9, warm);
  }
  for (const side of [-1, 1]) {
    box(side * 9.1, 4.65, -43.88, 6.2, 9.3, .38, hull);
    colliders.push({ x: side * 9.1, z: -43.88, w: 6.2, d: .38 });
    // Small isolated side ports, surrounded by opaque off-white pressure hull.
    box(side * 11.9, 1.31, -53, .55, 2.62, 18.4, hull);
    box(side * 11.9, 7.46, -53, .55, 3.9, 18.4, hull);
    box(side * 11.9, 4.1, -47.8, .55, 3.0, 7.6, hull);
    box(side * 11.9, 4.1, -59.2, .55, 3.0, 5.6, hull);
    box(side * 12.14, 4.09, -54, .065, 2.92, 4.8, glass);
    for (const dz of [-2.42, 2.42]) box(side * 11.66, 4.1, -54 + dz, .9, 3.12, .28, rib);
    for (const wy of [2.62, 5.57]) box(side * 11.66, wy, -54, .9, .24, 5.02, rib);
    box(side * 11.34, 8.55, -53, 1.6, .27, 18, lightHull, 0, -side * Math.PI / 4);
  }
  box(0, 7.84, -43.88, 12, 3.1, .38, hull);
  octagonalFrame(0, -44.03, 11.55, 6.12, rib, .24, .35);
  box(0, .8, -62.1, 24.25, 1.6, .75, hull);
  box(0, 9.0, -62.1, 24.25, .92, .75, hull);
  for (const side of [-1, 1]) box(side * 11.55, 4.8, -62.1, 1.1, 8.7, .8, hull);
  const viewport = new THREE.Mesh(new THREE.PlaneGeometry(22.5, 7.12), glass);
  viewport.position.set(0, 5.02, -62.44); root.add(viewport);
  octagonalFrame(0, -61.83, 22.4, 8.93, rib, .44, .62);
  for (const x of [-7.2, 7.2]) box(x, 4.95, -61.74, .22, 7.05, .76, rib);
  box(0, 1.65, -61.65, 21.5, .13, .88, black);
  box(0, 1.82, -61.25, 19.6, .042, .055, dimLime);
  plane(label('USS SENTIENT / OBSERVATION DECK', 'SOL SENTIENT · STABLE ORBIT'), 7.2, 1.2, 0, 8.18, -61.27);
  const arrivalMark = plane(canvasTexture(1024, 256, (ctx) => {
    ctx.fillStyle = '#cfff04'; ctx.font = '500 92px Space, Arial'; ctx.textAlign = 'center';
    ctx.fillText('SENTIENT', 512, 140); ctx.fillStyle = '#91a094'; ctx.font = '25px Space, Arial'; ctx.fillText('ORBITAL EXPLORATION / DECK 01', 512, 203);
  }), 6.8, 1.7, 0, .03, -48.0);
  arrivalMark.rotation.x = -Math.PI / 2;
  const holoX = 6, holoZ = -54;
  cylinder(holoX, .2, holoZ, 1.35, .4, black);
  cylinder(holoX, .43, holoZ, 1.13, .06, dimLime);
  ring(holoX, .48, holoZ, 1.25, dimLime);
  const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 2), hologramMaterial);
  globe.position.set(holoX, 2.03, holoZ); root.add(globe);
  const orbit = ring(holoX, 2.03, holoZ, 1.45, dimLime, .8, .018);
  animated.push((time) => { globe.rotation.y = time * .16; orbit.rotation.z = time * .12; });
  colliders.push({ x: holoX, z: holoZ, w: 2.6, d: 2.6 });

  const stationLight = new THREE.HemisphereLight(0xe8f0f6, 0x4c514f, 1.15); root.add(stationLight);
  const ambient = new THREE.AmbientLight(0xc6d0d8, .24); root.add(ambient);
  const sun = new THREE.DirectionalLight(0xf1ffdb, 1.65); sun.position.set(8, 24, -120); root.add(sun);
  const fill = new THREE.DirectionalLight(0xe5f1ff, .8); fill.position.set(-25, 30, 30); root.add(fill);

  for (const z of [-54, -30, -7, 18, 33]) {
    const light = new THREE.PointLight(0xecf0f7, z === -54 ? 95 : 42, z === -54 ? 28 : 19, 1.5);
    light.position.set(0, z === -54 ? 7.3 : 4.9, z); root.add(light);
  }

  function terminal(room) {
    const { x, z } = room;
    const tz = z - 3;
    cylinder(x, .19, tz, 1.1, .36, black);
    cylinder(x, .42, tz, .6, .1, dimLime);
    box(x, .86, tz, .58, 1.05, .6, rib);
    box(x, 1.73, tz, 3.05, 1.9, .25, black);
    box(x, 2.72, tz, 3.08, .045, .25, lime);
    box(x, .83, tz + .54, 2.5, .1, 1.02, lightHull);
    box(x, .9, tz + .56, 1.9, .025, .43, black);
    for (let i = 0; i < 11; i++) box(x - .82 + i * .164, .924, tz + .53, .1, .018, .24, dimLime);
    const tex = canvasTexture(1024, 576, (ctx, w, h) => {
      ctx.fillStyle = '#0b1618'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#cfff04'; ctx.fillRect(40, 45, 10, 56);
      ctx.font = '600 24px Space, Arial'; ctx.fillText('SENTIENT SYSTEMS    /    0' + (Number(room.number) || 1), 76, 80);
      ctx.fillStyle = '#f3f4ef'; ctx.font = '700 62px Space, Arial';
      ctx.fillText((room.shortName || room.name).toUpperCase(), 45, 184, 940);
      ctx.fillStyle = '#a2b497'; ctx.font = '28px Space, Arial'; ctx.fillText('DEPARTMENT ARCHIVE  •  ACCESS AVAILABLE', 47, 230);
      ctx.strokeStyle = '#3e503c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(45, 275); ctx.lineTo(976, 275); ctx.stroke();
      for (let i = 0; i < 27; i++) { ctx.fillStyle = i % 4 ? '#687d46' : '#cfff04'; ctx.fillRect(47 + i * 22, 317 + (i % 5) * 6, 12, 62 - (i % 5) * 6); }
      ctx.fillStyle = '#cfff04'; ctx.font = '600 35px Space, Arial'; ctx.fillText('[ E ]  EXPLORE THIS DEPARTMENT', 47, 470);
      ctx.fillStyle = '#6c8278'; ctx.font = '19px Space, Arial'; ctx.fillText('USS SENTIENT / KNOWLEDGE TERMINAL / ONLINE', 47, 525);
      ctx.fillStyle = '#cfff04'; ctx.beginPath(); ctx.arc(951, 64, 9, 0, TAU); ctx.fill();
    });
    const screen = plane(tex, 2.84, 1.60, x, 1.76, tz + .138);
    screen.userData.roomId = room.id;
    screen.userData.room = room;
    screen.userData.isTerminal = true;
    terminalMeshes.push(screen);
    colliders.push({ x, z: tz, w: 3.1, d: 1.05 });
  }

  function table(x, z, w = 5.4, d = 2.3) {
    box(x, 1.03, z, w, .19, d, lightHull);
    box(x, 1.14, z, w - .18, .04, d - .17, black);
    box(x, 1.18, z + d / 2 - .15, w - .25, .025, .04, lime);
    box(x, .51, z, w - .28, .98, d - .18, hull);
    box(x, .45, z + d / 2 - .075, w - .62, .56, .035, black);
    colliders.push({ x, z, w, d });
  }
  function chair(x, z, ry = 0) {
    colliders.push({ x, z, w: .9, d: .95 });
    cylinder(x, .13, z, .45, .12, black);
    cylinder(x, .4, z, .09, .48, lightHull);
    box(x, .67, z, .8, .16, .84, black, ry);
    box(x + Math.sin(ry) * .34, 1.14, z + Math.cos(ry) * .34, .85, .96, .16, rib, ry);
  }
  function monitor(x, y, z, w = 1.1, h = .68, ry = 0, index = 0) {
    const tex = canvasTexture(384, 240, (ctx) => {
      ctx.fillStyle = '#122022'; ctx.fillRect(0, 0, 384, 240);
      ctx.fillStyle = '#cfff04'; ctx.font = '14px monospace'; ctx.fillText(['LIVE INTELLIGENCE','NETWORK UPLINK','CREATIVE SYSTEMS','SIGNAL ANALYSIS'][Math.abs(index) % 4], 18, 27);
      ctx.strokeStyle = '#cfff04'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 20; i++) { const x = 20 + i * 17; const y = 105 + Math.sin(i * 1.7 + index) * 32; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      ctx.fillStyle = '#5b7863'; for (let i = 0; i < 5; i++) ctx.fillRect(20, 164 + i * 12, 210 - i * 28, 4);
      ctx.strokeStyle = '#8eae64'; ctx.strokeRect(281, 159, 65, 58);
    });
    box(x, y, z, w + .1, h + .1, .13, black, ry);
    const nx = Math.sin(ry) * .075, nz = Math.cos(ry) * .075;
    plane(tex, w, h, x + nx, y, z + nz, ry);
  }
  function planter(x, z) {
    // A plain life-support equipment canister marks the future habitat exhibit.
    cylinder(x, .14, z, .65, .28, black);
    cylinder(x, 1.06, z, .5, 1.6, white);
    cylinder(x, 1.9, z, .55, .12, rib);
    box(x, 1.22, z + .48, .32, .53, .035, black);
    box(x, 1.22, z + .506, .04, .4, .012, dimLime);
    colliders.push({ x, z, w: 1.3, d: 1.3 });
  }

  for (const room of rooms) {
    if (room.id === 'front-door') { terminal(room); continue; }
    const { x, z } = room;
    const { w, d } = dimensions(room);
    const side = Math.sign(x), hw = w / 2, hd = d / 2;
    deck(x, z, w, d);
    const entryX = x - side * hw, outsideX = x + side * hw;
    // A sealed off-white compartment, north-facing window and side observation port.
    box(x, 6.3, z, w + .35, .4, d + .35, hull);
    box(x, 5.98, z, w - 2.5, .12, d - .5, white);
    box(x, 3.08, z + hd + .1, w + .3, 6.16, .36, hull);
    colliders.push({ x, z: z + hd + .1, w: w + .3, d: .36 });
    const winW = 5.6;
    box(x, 1.16, z - hd - .1, w + .3, 2.32, .36, hull);
    box(x, 5.39, z - hd - .1, w + .3, 1.7, .36, hull);
    for (const dx of [-1, 1]) box(x + dx * (winW / 2 + (w - winW) / 4), 3.5, z - hd - .1, (w - winW) / 2, 4, .36, hull);
    box(x, 3.42, z - hd - .3, winW, 2.23, .045, glass);
    for (const dx of [-winW / 2, winW / 2]) box(x + dx, 3.42, z - hd + .12, .28, 2.48, .78, rib);
    for (const wy of [2.3, 4.54]) box(x, wy, z - hd + .12, winW, .22, .78, rib);
    colliders.push({ x, z: z - hd - .1, w: w + .3, d: .36 });
    // One compact side porthole sits inside the otherwise solid hull.
    box(outsideX, 1.14, z, .4, 2.28, d + .2, hull);
    box(outsideX, 5.34, z, .4, 1.8, d + .2, hull);
    for (const dz of [-1, 1]) box(outsideX, 3.4, z + dz * (hd + 1.8) / 2, .4, 2.4, hd - 1.8, hull);
    box(outsideX + side * .2, 3.4, z, .045, 2.16, 3.6, glass);
    for (const dz of [-1.8, 1.8]) box(outsideX - side * .12, 3.4, z + dz, .7, 2.4, .24, rib);
    for (const wy of [2.29, 4.51]) box(outsideX - side * .12, wy, z, .7, .22, 3.6, rib);
    const remaining = hd - 2.4;
    for (const dz of [-1, 1]) box(entryX, 3.1, z + dz * (2.4 + remaining / 2), .38, 6.2, remaining, hull);
    box(entryX, 5.6, z, .42, 1.2, 4.8, hull);
    // Angled shoulders and broad ceiling panels read as an enclosed pressure module.
    for (const dx of [-1, 1]) {
      box(x + dx * (hw - .64), 5.67, z, 1.58, .2, d, lightHull, 0, -dx * Math.PI / 4);
      // The inner-wall skirting ends at the hatch instead of crossing its floor.
      if (dx === -side) {
        for (const direction of [-1, 1]) {
          const segment = hd - 2.5;
          const center = z + direction * (2.5 + segment / 2);
          box(x + dx * (hw - .5), .44, center, .45, .8, segment, black);
          box(x + dx * (hw - .8), .93, center, .045, .04, segment, dimLime);
        }
      } else {
        box(x + dx * (hw - .5), .44, z, .45, .8, d, black);
        box(x + dx * (hw - .8), .93, z, .045, .04, d - .6, dimLime);
      }
    }
    for (let dz = -hd + 2.3; dz < hd; dz += 4.6) {
      box(x, 5.83, z + dz, w - 2.2, .2, .2, rib);
      for (const dx of [-1, 1]) box(x + dx * w * .26, 5.91, z + dz - .9, .2, .055, 2.7, warm);
    }
    // Room directory on the hatch and a compact ID above the forward viewport.
    const short = room.shortName || room.name;
    plane(label(short, room.function || 'SENTIENT SYSTEMS', 1024, 256, String(room.number).padStart(2, '0')), 4.35, 1.08, entryX - side * .29, 4.03, z, -side * Math.PI / 2);
    plane(label(room.name, room.designation || 'USS SENTIENT', 1024, 256, room.number), 5.2, .84, x, 5.76, z - hd + .32);
    terminal(room);
    const areaLight = new THREE.PointLight(0xf3f0df, 38, 25, 1.5); areaLight.position.set(x, 4.8, z + 1); root.add(areaLight);

    if (room.id === 'floor') {
      // Distribution floor: six active network workstations.
      for (const dz of [1.8, 6.0]) for (const dx of [-5.3, 5.3]) {
        table(x + dx, z + dz, 4.1, 1.5);
        monitor(x + dx, 1.74, z + dz - .35, 1.45, .86, 0, Math.round(dx + dz));
        chair(x + dx, z + dz + 1.2);
      }
      planter(x + 8, z - 6.3);
      for (const dx of [-6, 6]) ring(x + dx, .047, z - 5, 1.6, dimLime, Math.PI / 2, .018);
    } else if (room.id === 'archive') {
      // Servers and archival stacks, clear central reading aisle.
      for (const dx of [-7.5, 7.5]) for (const dz of [-4, 1, 6]) {
        box(x + dx, 1.7, z + dz, 2.4, 3.4, 1.5, black);
        box(x + dx, 3.44, z + dz, 2.5, .08, 1.6, lightHull);
        for (let shelf = 0; shelf < 8; shelf++) {
          box(x + dx, .3 + shelf * .39, z + dz + .77, 2.15, .28, .045, rib);
          box(x + dx - .88, .3 + shelf * .39, z + dz + .804, .045, .09, .025, lime);
          box(x + dx + .55, .3 + shelf * .39, z + dz + .804, .43, .035, .025, cool);
        }
        colliders.push({ x: x + dx, z: z + dz, w: 2.4, d: 1.5 });
      }
      table(x, z + 5.7, 6, 2);
      const data = new THREE.Mesh(new THREE.OctahedronGeometry(.95), hologramMaterial);
      data.position.set(x, 2.35, z + 5.7); root.add(data);
      animated.push((t) => { data.rotation.y = t * .28; data.rotation.z = .15; data.position.y = 2.35 + Math.sin(t) * .1; });
    } else if (room.id === 'commons') {
      // Media commons: sociable lounge with an active audience wall.
      for (const dx of [-6.1, 6.1]) {
        box(x + dx, .43, z + 3.7, 3.2, .72, 1.25, rib);
        box(x + dx, 1.0, z + 4.29, 3.2, .94, .2, black);
        box(x + dx, .71, z + 3.65, 2.92, .22, 1.1, white);
        colliders.push({ x: x + dx, z: z + 3.7, w: 3.3, d: 1.4 });
        cylinder(x + dx, .38, z + 1.0, 1.0, .16, lightHull);
        cylinder(x + dx, .18, z + 1.0, .12, .36, rib);
        colliders.push({ x: x + dx, z: z + 1.0, w: 2, d: 2 });
      }
      planter(x - 8, z + 6.8); planter(x + 8, z + 6.8);
      for (let i = 0; i < 4; i++) monitor(x - 5.3 + i * 3.5, 2.85, z + hd - .24, 2.75, 1.65, Math.PI, i);
      ring(x, .028, z + 3.5, 3.2, dimLime, Math.PI / 2, .03);
    } else if (room.id === 'forum') {
      // Strategy forum: an architectural meeting table, suspended orbit model.
      table(x, z + 4.8, 8.7, 2.7);
      for (let dx = -3; dx <= 3; dx += 2) { chair(x + dx, z + 7, 0); chair(x + dx, z + 2.55, Math.PI); }
      const strategy = new THREE.Group(); strategy.position.set(x, 3.25, z + 4.8); root.add(strategy);
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(1.3 + i * .4, .018, 5, 60), i === 1 ? lime : hologramMaterial);
        r.rotation.set(.45 + i * .7, i * .6, 0); strategy.add(r);
      }
      animated.push((t) => { strategy.rotation.y = t * .14; });
      monitor(x + 7, 2.8, z - hd + .5, 4.3, 2.65, 0, 3);
      planter(x - 8, z - 6.5);
    } else if (room.id === 'lab') {
      // Development lab: fabrication pods and a floating procedural prototype.
      for (const dx of [-6.5, 6.5]) {
        table(x + dx, z + 4.8, 4.8, 2.1);
        for (const dz of [-5.3, .2]) {
          cylinder(x + dx, .24, z + dz, 1.55, .48, black);
          ring(x + dx, .52, z + dz, 1.42, lime);
          cylinder(x + dx, 2, z + dz, 1.36, 2.9, glass);
          cylinder(x + dx, 3.53, z + dz, 1.47, .17, rib);
          for (let i = 0; i < 3; i++) box(x + dx + Math.cos(i * TAU / 3) * 1.38, 1.98, z + dz + Math.sin(i * TAU / 3) * 1.38, .07, 2.9, .07, lightHull);
          const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(.7, 0), hologramMaterial);
          crystal.position.set(x + dx, 1.92, z + dz); root.add(crystal);
          animated.push((t) => { crystal.rotation.y = t * .36; crystal.rotation.z = t * .13; crystal.position.y = 1.92 + Math.sin(t + dx) * .18; });
          colliders.push({ x: x + dx, z: z + dz, w: 3.1, d: 3.1 });
        }
        monitor(x + dx, 1.9, z + 4.3, 1.85, 1.1, 0, 2);
      }
    } else if (room.id === 'bridge') {
      // Command bridge: panoramic instruments and the orbital situation table.
      for (const dx of [-6.5, 6.5]) {
        table(x + dx, z - 5.65, 4.5, 1.7);
        monitor(x + dx, 2.15, z - 6.0, 3.65, 1.65, 0, 1);
        chair(x + dx, z - 4.1);
      }
      cylinder(x, .6, z + 5.3, 2.8, 1.2, black);
      cylinder(x, 1.23, z + 5.3, 2.63, .055, lightHull);
      ring(x, 1.3, z + 5.3, 2.5, lime);
      for (const radius of [.7, 1.3, 1.95]) ring(x, 1.34, z + 5.3, radius, hologramMaterial, Math.PI / 2, .015);
      sphere(x, 1.53, z + 5.3, .35, lime);
      const satellite = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), warm); root.add(satellite);
      animated.push((t) => satellite.position.set(x + Math.cos(t * .23) * 1.94, 1.48, z + 5.3 + Math.sin(t * .23) * 1.94));
      colliders.push({ x, z: z + 5.3, w: 5.6, d: 5.6 });
    }
  }

  // A lime-neon stellar body, with animated cellular plasma and a soft corona.
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vPosition; varying vec3 vNormal; void main(){vPosition=position;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec3 vPosition; varying vec3 vNormal; uniform float time;
      float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 p=normalize(vPosition)*9.;p.y+=time*.028;float n=noise(p)*.5+noise(p*2.3+time*.03)*.3+noise(p*6.)*.2;float veins=smoothstep(.35,.67,n);vec3 col=mix(vec3(.20,.39,.003),vec3(.88,1.,.15),veins);col+=pow(n,3.)*vec3(.48,.55,.13);gl_FragColor=vec4(col*1.65,1.);}`,
  });
  materials.push(starMaterial);
  const star = new THREE.Mesh(new THREE.SphereGeometry(28, 72, 48), starMaterial);
  star.position.set(8, 14, -145); root.add(star);
  animated.push((time) => { starMaterial.uniforms.time.value = time; star.rotation.y = time * .006; });
  const corona = canvasTexture(256, 256, (ctx) => {
    const gradient = ctx.createRadialGradient(128, 128, 38, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(216,255,46,.36)'); gradient.addColorStop(.33, 'rgba(200,255,0,.29)');
    gradient.addColorStop(.57, 'rgba(164,219,0,.09)'); gradient.addColorStop(1, 'rgba(131,220,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  });
  const coronaMaterial = new THREE.SpriteMaterial({ map: corona, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff }); materials.push(coronaMaterial);
  const glow = new THREE.Sprite(coronaMaterial); glow.position.copy(star.position); glow.scale.set(106, 106, 1); root.add(glow);
  for (let i = 0; i < 2; i++) {
    const orbital = new THREE.Mesh(new THREE.TorusGeometry(41 + i * 12, .027, 4, 160), new THREE.MeshBasicMaterial({ color: 0x8fbc60, transparent: true, opacity: .24 }));
    orbital.position.copy(star.position); orbital.rotation.set(1.16, .14, .27); root.add(orbital); materials.push(orbital.material);
  }
  const starPositions = [], starColors = [];
  let seed = 23419;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 1900; i++) {
    const theta = random() * TAU, vertical = random() * 2 - 1, r = 250 + random() * 420;
    const radial = Math.sqrt(1 - vertical * vertical);
    starPositions.push(Math.cos(theta) * radial * r, vertical * r, Math.sin(theta) * radial * r);
    const brightness = .4 + random() * .6;
    starColors.push(brightness * .8, brightness, brightness * .88);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  const starfieldMaterial = new THREE.PointsMaterial({ size: .85, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: .85, depthWrite: false }); materials.push(starfieldMaterial);
  const stars = new THREE.Points(starGeometry, starfieldMaterial); root.add(stars);
  animated.push(time => { stars.rotation.y = time * .00065; });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(17, 40, 28), makeMaterial({ color: 0x748b73, roughness: .95, metalness: .08 }));
  planet.position.set(-90, -22, -160); root.add(planet);
  const planetRing = ring(-90, -22, -160, 27, new THREE.MeshBasicMaterial({ color: 0x8ca194, transparent: true, opacity: .35 }), .94, .35);
  materials.push(planetRing.material); planetRing.rotation.y = .4;
  animated.push(time => {
    const phase = time * .0007;
    planet.position.set(8 - Math.cos(phase) * 98 + Math.sin(phase) * 15, -22, -145 - Math.sin(phase) * 98 - Math.cos(phase) * 15);
    planetRing.position.copy(planet.position);
  });
  // Visible structure under the glazed roof gives the station an orbital silhouette.
  for (const x of [-38, 38]) {
    box(x, -2, -4, .65, 1.1, 96, rib);
    for (let z = -42; z <= 34; z += 19) box(x * .82, -1.8, z, 14, .55, .7, lightHull, x < 0 ? -.17 : .17);
  }

  for (const { geometry, material, transforms } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
    transforms.forEach((transform, index) => mesh.setMatrixAt(index, transform));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
  }

  return {
    terminalMeshes,
    colliders,
    animate(time) { for (const update of animated) update(time); },
    dispose() {
      scene.remove(root);
      const geometries = new Set();
      root.traverse((object) => { if (object.geometry) geometries.add(object.geometry); });
      geometries.forEach((geometry) => geometry.dispose());
      new Set(materials).forEach((material) => material.dispose());
      new Set(textures).forEach((texture) => texture.dispose());
    },
  };
}
