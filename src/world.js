import * as THREE from 'three';
import { MODULES, LINKS, modulePolygon } from './layout.js';

const LIME = 0xcfff04;
const TAU = Math.PI * 2;

/** A human-scale pressure vessel. Every hull surface follows the shared floor plan. */
export function createWorld(scene, rooms) {
  const root = new THREE.Group();
  root.name = 'USS Sentient compact pressure modules';
  scene.add(root);
  const terminalMeshes = [], colliders = [], doors = [], animated = [];
  const materials = new Set(), textures = new Set(), geometries = new Set();
  const batches = new Map();
  const mat = options => { const material = new THREE.MeshStandardMaterial(options); materials.add(material); return material; };
  const hull = mat({ color: 0xd9d8cc, roughness: .67, metalness: .12 });
  const enamel = mat({ color: 0xf2eee1, roughness: .58, metalness: .1 });
  const padding = mat({ color: 0xc4c5b8, roughness: .94, metalness: .02 });
  const seal = mat({ color: 0x182127, roughness: .79, metalness: .18 });
  const graphite = mat({ color: 0x38434b, roughness: .49, metalness: .53 });
  const silver = mat({ color: 0x9eaaa8, roughness: .31, metalness: .79 });
  const accent = mat({ color: LIME, emissive: LIME, emissiveIntensity: .32, roughness: .6 });
  const whiteLight = mat({ color: 0xfff4d9, emissive: 0xfff4df, emissiveIntensity: 2.2 });
  const blueLight = mat({ color: 0xa8c6d4, emissive: 0xb3d1e1, emissiveIntensity: 1.1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xc1d3cd, roughness: .04, metalness: .08, transparent: true, opacity: .09, depthWrite: false, side: THREE.DoubleSide });
  materials.add(glass);
  const unitBox = new THREE.BoxGeometry(1, 1, 1); geometries.add(unitBox);
  const quaternion = new THREE.Quaternion(), rotation = new THREE.Euler(), matrix = new THREE.Matrix4();

  function texture(width, height, paint) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    paint(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    textures.add(map); return map;
  }
  const grain = texture(256, 256, ctx => {
    ctx.fillStyle = '#bcbdb8'; ctx.fillRect(0, 0, 256, 256);
    let seed = 121;
    for (let i = 0; i < 6000; i++) {
      seed = (seed * 16807) % 2147483647; const x = seed % 256;
      seed = (seed * 16807) % 2147483647; const y = seed % 256;
      ctx.fillStyle = `rgba(50,55,51,${.03 + (i % 3) * .015})`; ctx.fillRect(x, y, 1, 1);
    }
  });
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  for (const material of [hull, enamel, padding]) { material.bumpMap = grain; material.bumpScale = .011; }
  const deckMap = texture(512, 512, ctx => {
    ctx.fillStyle = '#343b3e'; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#252e32'; ctx.fillRect(3, 3, 506, 506);
    ctx.strokeStyle = '#58605f'; ctx.lineWidth = 2; ctx.strokeRect(11, 11, 490, 490);
    ctx.fillStyle = '#465051';
    for (let y = 36; y < 490; y += 17) for (let x = 34; x < 480; x += 38) ctx.fillRect(x + (y % 2) * 9, y, 21, 3);
    ctx.fillStyle = '#85908b'; for (const x of [22, 490]) for (const y of [22, 490]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }
  });
  deckMap.wrapS = deckMap.wrapT = THREE.RepeatWrapping; deckMap.repeat.set(.6, .6);
  const deckMat = mat({ color: 0xb9c1bd, map: deckMap, bumpMap: deckMap, bumpScale: .012, metalness: .5, roughness: .72, side: THREE.DoubleSide });

  function addMesh(geometry, material, parent = root) {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function box(x, y, z, w, h, d, material = hull, ry = 0, rz = 0, rx = 0) {
    if (!batches.has(material.uuid)) batches.set(material.uuid, { material, transforms: [] });
    quaternion.setFromEuler(rotation.set(rx, ry, rz));
    matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(w, h, d));
    batches.get(material.uuid).transforms.push(matrix.clone());
  }
  function localBox(origin, ry, x, y, z, w, h, d, material = hull, rz = 0) {
    const c = Math.cos(ry), s = Math.sin(ry);
    box(origin.x + x * c + z * s, y, origin.z - x * s + z * c, w, h, d, material, ry, rz);
  }
  function solidBox(parent, x, y, z, w, h, d, material) {
    const mesh = new THREE.Mesh(unitBox, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh); return mesh;
  }
  function roundedRect(x, y, w, h, r, path = new THREE.Shape()) {
    path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
    path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
    path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y); return path;
  }
  function roundedFrame(width, height, border, radius, depth, material, parent = root) {
    const shape = roundedRect(-width / 2, 0, width, height, radius);
    const hole = roundedRect(-width / 2 + border, border, width - 2 * border, height - 2 * border, Math.max(.05, radius - border), new THREE.Path());
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .018, bevelThickness: .018, curveSegments: 8 });
    return addMesh(geo, material, parent);
  }
  function textPlane(map, w, h, x, y, z, ry = 0, parent = root) {
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false }); materials.add(material);
    const mesh = addMesh(new THREE.PlaneGeometry(w, h), material, parent); mesh.position.set(x, y, z); mesh.rotation.y = ry; return mesh;
  }
  function sign(title, sub = '', number = '') {
    return texture(768, 192, (ctx, w, h) => {
      ctx.fillStyle = '#1a2429'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#cfff04'; ctx.fillRect(0, 0, 8, h);
      ctx.font = '500 62px Space, Arial';
      let offset = 28;
      if (number) { ctx.fillText(number, 28, 100); offset = 122; }
      ctx.fillStyle = '#f1f0e5'; ctx.font = '500 46px Space, Arial'; ctx.fillText(title.toUpperCase(), offset, 86, w - offset - 24);
      ctx.fillStyle = '#a8b4ad'; ctx.font = '400 22px Space, Arial'; ctx.fillText(sub.toUpperCase(), offset, 135, w - offset - 24);
    });
  }
  function floorPolygon(module) {
    const points = modulePolygon(module);
    const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.x - module.x, -(p.z - module.z))));
    const mesh = addMesh(new THREE.ShapeGeometry(shape), deckMat); mesh.rotation.x = -Math.PI / 2; mesh.position.set(module.x, .002, module.z);
    const underside = addMesh(new THREE.ExtrudeGeometry(shape, { depth: .18, bevelEnabled: false }), graphite);
    underside.rotation.x = -Math.PI / 2; underside.position.set(module.x, -.18, module.z);
  }
  function quadGeometry(quads, material) {
    const vertices = [];
    for (const [a, b, c, d] of quads) for (const p of [a, b, c, a, c, d]) vertices.push(...p);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
    const mesh = addMesh(geometry, material); mesh.material.side = THREE.DoubleSide; return mesh;
  }

  function pressureRoof(module) {
    const points = modulePolygon(module), inner = points.map(p => ({ x: module.x + (p.x - module.x) * .77, z: module.z + (p.z - module.z) * .77 }));
    const quads = [];
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      quads.push([[points[i].x, 2.56, points[i].z], [points[j].x, 2.56, points[j].z], [inner[j].x, 3.08, inner[j].z], [inner[i].x, 3.08, inner[i].z]]);
      const a = points[i], b = points[j], center = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const len = Math.hypot(b.x - a.x, b.z - a.z), ry = -Math.atan2(b.z - a.z, b.x - a.x);
      // A gasket at the shoulder seam and short lamps in the angled ceiling.
      localBox(center, ry, 0, 2.56, .015, len, .055, .065, graphite);
      if (i % 2 === 0) localBox(center, ry, 0, 2.85, .38, Math.min(1.25, len - .35), .065, .14, whiteLight);
    }
    quadGeometry(quads, hull);
    const roofShape = new THREE.Shape(inner.map(p => new THREE.Vector2(p.x - module.x, -(p.z - module.z))));
    const roof = addMesh(new THREE.ShapeGeometry(roofShape), enamel); roof.rotation.x = Math.PI / 2; roof.rotation.z = Math.PI; roof.position.set(module.x, 3.08, module.z);
    // Low-profile overhead service spine, broken up by recessed access tiles.
    box(module.x, 3.00, module.z, .86, .14, 2.9, seal);
    for (const dz of [-.93, 0, .93]) box(module.x, 2.90, module.z + dz, .72, .095, .80, padding);
    for (const dx of [-.9, .9]) box(module.x + dx, 3.0, module.z, .036, .06, module.a * 1.25, silver);
    // Two visible pressure hoops continue across the sloping shoulders.
    for (const dz of [-.93, .93]) {
      const innerX = module.a * .77, outerX = module.a - .035;
      box(module.x, 3.005, module.z + dz, innerX * 2, .145, .15, graphite);
      box(module.x, 2.965, module.z + dz, innerX * 2 - .06, .06, .19, enamel);
      const slope = Math.atan2(.50, outerX - innerX);
      for (const side of [-1, 1]) {
        box(module.x + side * (innerX + outerX) / 2, 2.775, module.z + dz, Math.hypot(outerX - innerX, .50), .14, .18, graphite, 0, -side * slope);
        box(module.x + side * (innerX + outerX) / 2, 2.73, module.z + dz, Math.hypot(outerX - innerX, .50), .055, .205, enamel, 0, -side * slope);
      }
    }
    // Recessed service grille rather than a blank domestic ceiling plane.
    box(module.x + 1.1, 3.00, module.z, .40, .1, 1.7, seal);
    for (let i = 0; i < 12; i++) box(module.x + 1.1, 2.94, module.z - .74 + i * .135, .38, .028, .055, silver);
  }

  function porthole(origin, ry, length, width, height, centerY, bridge = false) {
    const bottom = centerY - height / 2, top = centerY + height / 2;
    localBox(origin, ry, 0, bottom / 2, -.08, length, bottom, .2, hull);
    localBox(origin, ry, 0, (top + 2.58) / 2, -.08, length, 2.58 - top, .2, hull);
    const sideWidth = (length - width) / 2;
    for (const side of [-1, 1]) localBox(origin, ry, side * (width / 2 + sideWidth / 2), centerY, -.08, sideWidth, height, .2, hull);
    const group = new THREE.Group(); group.position.set(origin.x, centerY - height / 2 - .1, origin.z); group.rotation.y = ry; root.add(group);
    const gasket = roundedFrame(width + .23, height + .2, .105, .25, .12, seal, group); gasket.position.z = .005;
    const metalFrame = roundedFrame(width + .37, height + .34, .085, .3, .105, silver, group); metalFrame.position.set(0, -.07, .085);
    const glassPane = addMesh(new THREE.PlaneGeometry(width + .03, height + .015), glass, group); glassPane.position.set(0, height / 2 + .1, -.11);
    for (const side of [-1, 1]) solidBox(group, side * (width / 2 + .135), height / 2 + .1, .22, .045, height * .55, .07, enamel);
    if (bridge) {
      localBox(origin, ry, 0, .72, .18, width + .25, .15, .5, graphite);
      localBox(origin, ry, 0, .80, .41, width - .3, .026, .045, accent);
    }
  }

  function wallPanel(origin, ry, length, kind, room, index) {
    const port = kind && room.ports.includes(kind);
    if (port) {
      const gap = 2.08, sideW = (length - gap) / 2;
      for (const side of [-1, 1]) localBox(origin, ry, side * (gap / 2 + sideW / 2), 1.3, -.08, sideW, 2.6, .20, hull);
      localBox(origin, ry, 0, 2.5, -.08, gap, .2, .2, hull);
      return;
    }
    const bridgeWindow = room.id === 'bridge' && index === 0;
    const smallWindow = index === 7 || (room.id === 'bridge' && index === 2);
    if (bridgeWindow || smallWindow) {
      porthole(origin, ry, length, bridgeWindow ? 2.85 : Math.min(1.12, length - .46), bridgeWindow ? 1.62 : .94, bridgeWindow ? 1.6 : 1.73, bridgeWindow);
      return;
    }
    localBox(origin, ry, 0, 1.3, -.08, length, 2.6, .20, hull);
    localBox(origin, ry, 0, .19, .035, length - .04, .30, .08, graphite);
    localBox(origin, ry, 0, 2.43, .025, length - .06, .08, .09, silver);
    // Recessed equipment faces and fabric-like covers integrated with the pressure wall.
    if (index !== 1) {
      const w = Math.min(length - .24, index % 2 ? 1.05 : 1.62);
      localBox(origin, ry, 0, 1.45, .045, w, 1.43, .09, seal);
      localBox(origin, ry, 0, 1.45, .102, w - .1, 1.31, .045, index % 2 ? padding : enamel);
      for (const side of [-1, 1]) {
        localBox(origin, ry, side * (w / 2 - .17), 1.44, .149, .035, .29, .06, graphite);
        localBox(origin, ry, side * (w / 2 - .10), 1.90, .145, .029, .055, .025, silver);
      }
      localBox(origin, ry, 0, .76, .12, w - .17, .034, .035, silver);
      if (index % 2 === 0) {
        localBox(origin, ry, 0, 1.96, .146, Math.min(.78, w - .2), .16, .022, seal);
        for (let i = -3; i <= 3; i++) localBox(origin, ry, i * .09, 1.96, .166, .029, .13, .022, silver);
      }
    }
    // A rail, never furniture, gives immediate human-scale reference.
    if (index === 4 || index === 6) {
      localBox(origin, ry, 0, 1.00, .245, Math.min(1.4, length - .3), .052, .052, silver);
      for (const side of [-1, 1]) localBox(origin, ry, side * .48, 1.0, .15, .05, .05, .2, silver);
    }
  }

  function terminal(module, room) {
    const p = module.terminal, ry = -Math.PI / 4;
    const origin = { x: p.x, z: p.z };
    localBox(origin, ry, 0, 1.40, 0, .98, .94, .28, graphite);
    localBox(origin, ry, 0, 1.48, .16, .98, .76, .08, seal);
    localBox(origin, ry, 0, .78, .22, .98, .12, .39, hull);
    localBox(origin, ry, 0, .855, .26, .66, .028, .24, seal);
    localBox(origin, ry, 0, 1.925, .1, .87, .036, .045, accent);
    const map = texture(768, 576, (ctx, w, h) => {
      ctx.fillStyle = '#102026'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#cfff04'; ctx.font = '500 27px Space, Arial'; ctx.fillText(`SENTIENT / ${room.number}`, 35, 56);
      ctx.fillStyle = '#f1f0e5'; ctx.font = '500 61px Space, Arial'; ctx.fillText(room.shortName.toUpperCase(), 35, 144, w - 70);
      ctx.fillStyle = '#92aca7'; ctx.font = '400 24px Space, Arial'; ctx.fillText('DEPARTMENT SIGNAL / ONLINE', 37, 190);
      ctx.strokeStyle = '#526a61'; ctx.lineWidth = 2; ctx.strokeRect(37, 230, 694, 179);
      ctx.strokeStyle = '#cfff04'; ctx.beginPath();
      for (let i = 0; i < 29; i++) { const x = 53 + i * 23.5, y = 320 + Math.sin(i * 1.7 + Number(room.number)) * 37; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.fillStyle = '#cfff04'; ctx.font = '500 34px Space, Arial'; ctx.fillText('[ E ]  ACCESS DEPARTMENT', 37, 482);
      ctx.fillStyle = '#728c89'; ctx.font = '400 19px Space, Arial'; ctx.fillText('PRESSURE STABLE    /    SYSTEM READY', 37, 535);
    });
    const forward = new THREE.Vector3(Math.sin(ry) * .21, 0, Math.cos(ry) * .21);
    const screen = textPlane(map, .85, .6375, p.x + forward.x, 1.48, p.z + forward.z, ry);
    screen.userData.roomId = room.id; screen.userData.room = room; terminalMeshes.push(screen);
    colliders.push({ id: `terminal-${room.id}`, x: p.x, z: p.z, w: .76, d: .76 });
  }

  function moduleDetails(module, room) {
    // Distinct equipment inserts preserve each department without office furnishings.
    const ry = Math.PI, origin = { x: module.x, z: module.z + module.a };
    if (!module.ports.includes('S')) {
      const map = sign(room.name, room.function, room.number);
      textPlane(map, 1.5, .375, origin.x, 2.1, origin.z - .145, ry);
    }
    const rackX = module.x - module.a + .28, rackZ = module.z + .6;
    if (!module.ports.includes('W')) {
      for (let i = 0; i < 4; i++) {
        box(rackX, .69 + i * .32, rackZ, .22, .24, .74, room.id === 'commons' ? padding : seal);
        box(rackX + .125, .69 + i * .32, rackZ - .24, .025, .035, .08, i % 3 ? blueLight : accent);
      }
    }
    if (room.id === 'lab') {
      const capsule = addMesh(new THREE.CylinderGeometry(.24, .24, .88, 24), glass); capsule.position.set(module.x - 1.85, 1.35, module.z - .75);
      box(module.x - 1.85, .87, module.z - .75, .57, .10, .57, graphite);
      box(module.x - 1.85, 1.83, module.z - .75, .57, .1, .57, hull);
      const sample = addMesh(new THREE.IcosahedronGeometry(.17), mat({ color: LIME, emissive: LIME, emissiveIntensity: .35, metalness: .4, roughness: .2 }));
      sample.position.copy(capsule.position); animated.push(t => { sample.rotation.y = t * .35; });
      colliders.push({ x: module.x - 1.85, z: module.z - .75, w: .6, d: .6 });
    }
    // Centre remains completely clear; this marking helps orient the module geometry.
    const map = texture(512, 512, ctx => {
      ctx.strokeStyle = '#b1b8a780'; ctx.lineWidth = 3; ctx.strokeRect(85, 85, 342, 342);
      ctx.fillStyle = '#cfff04'; ctx.font = '500 106px Space, Arial'; ctx.textAlign = 'center'; ctx.fillText(room.number, 256, 276);
      ctx.fillStyle = '#9daba6'; ctx.font = '400 22px Space, Arial'; ctx.fillText('SENTIENT / DECK 01', 256, 325);
    });
    const marker = textPlane(map, 1.25, 1.25, module.x, .008, module.z); marker.rotation.x = -Math.PI / 2;
    const light = new THREE.PointLight(0xfff4dd, 12.0, 8.5, 2); light.position.set(module.x - .50, 2.65, module.z + .45); root.add(light);
    const fill = new THREE.PointLight(0xd6e6f0, 2.3, 4.8, 2); fill.position.set(module.x + module.a * .55, 2.15, module.z - .2); root.add(fill);
  }

  for (const module of MODULES) {
    const room = rooms.find(room => room.id === module.id);
    floorPolygon(module); pressureRoof(module);
    const points = modulePolygon(module);
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length], origin = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const length = Math.hypot(b.x - a.x, b.z - a.z), ry = -Math.atan2(b.z - a.z, b.x - a.x);
      wallPanel(origin, ry, length, ({ 0: 'N', 2: 'E', 4: 'S', 6: 'W' })[i], module, i);
      // Small vertical hull seals at each octagonal corner.
      box(a.x + (module.x - a.x) * .006, 1.36, a.z + (module.z - a.z) * .006, .055, 2.52, .055, silver);
    }
    terminal(module, room); moduleDetails(module, room);
  }

  function tube(link) {
    const dx = link.b.x - link.a.x, dz = link.b.z - link.a.z, length = Math.hypot(dx, dz);
    const travelX = Math.abs(dx) > .01;
    const center = { x: (link.a.x + link.b.x) / 2, z: (link.a.z + link.b.z) / 2 }, ry = travelX ? Math.PI / 2 : 0;
    const hw = link.width / 2;
    localBox(center, ry, 0, -.1, 0, link.width, .2, length, graphite);
    const plane = addMesh(new THREE.PlaneGeometry(link.width, length), deckMat); plane.position.set(center.x, .003, center.z); plane.rotation.set(-Math.PI / 2, 0, -ry);
    for (const side of [-1, 1]) {
      localBox(center, ry, side * (hw + .07), 1.25, 0, .18, 2.25, length, hull);
      localBox(center, ry, side * (hw - .04), .30, 0, .085, .44, length, graphite);
      localBox(center, ry, side * (hw - .055), .57, 0, .048, .045, length, accent);
      localBox(center, ry, side * (hw - .08), 1.0, 0, .035, .044, length - .35, silver);
      // Sloped octagonal shoulders, no flat box corridor ceiling.
      localBox(center, ry, side * (hw - .21), 2.43, 0, .65, .14, length, enamel, -side * Math.PI / 4);
    }
    localBox(center, ry, 0, 2.68, 0, 1.6, .17, length, hull);
    localBox(center, ry, 0, 2.565, 0, .43, .10, length - .2, seal);
    for (let offset = -.5 * length + .35; offset < .5 * length; offset += 1.25) {
      for (const side of [-1, 1]) {
        localBox(center, ry, side * (hw - .04), 1.31, offset, .07, 1.92, .095, graphite);
        localBox(center, ry, side * .86, 2.4, offset, .57, .075, .095, silver, -side * Math.PI / 4);
      }
      localBox(center, ry, 0, 2.57, offset, 1.48, .085, .095, silver);
      localBox(center, ry, 0, 2.505, offset + .33, .25, .035, .44, whiteLight);
    }
    const light = new THREE.PointLight(0xeaf2fb, 3.3, 5.5, 2); light.position.set(center.x, 2.3, center.z); root.add(light);
  }

  function hatchLeaf(side, parent) {
    const shape = new THREE.Shape(), r = .49, left = -.91, right = 0, bottom = .035, top = 2.32;
    const x = v => v * side;
    shape.moveTo(x(right), bottom); shape.lineTo(x(left + r), bottom); shape.quadraticCurveTo(x(left), bottom, x(left), bottom + r);
    shape.lineTo(x(left), top - r); shape.quadraticCurveTo(x(left), top, x(left + r), top);
    shape.lineTo(x(right), top); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: true, bevelSegments: 1, bevelSize: .016, bevelThickness: .012, curveSegments: 8 });
    const mesh = addMesh(geometry, enamel, parent); mesh.position.z = -.055;
    const xCenter = -.455 * side;
    solidBox(parent, xCenter, 1.28, .064, .54, 1.35, .027, hull);
    solidBox(parent, xCenter, 1.28, -.076, .54, 1.35, .027, hull);
    for (const z of [-.10, .094]) {
      solidBox(parent, -.13 * side, 1.05, z, .032, .32, .045, graphite);
      solidBox(parent, -.45 * side, .50, z, .51, .075, .02, graphite);
      solidBox(parent, -.02 * side, 1.4, z, .019, .81, .012, silver);
      solidBox(parent, -.45 * side, .56, z, .25, .018, .014, accent);
    }
    return parent;
  }

  function pressureHatch(link, point, currentId, otherId, endpoint) {
    const axis = Math.abs(link.a.x - link.b.x) > .01 ? 'x' : 'z', ry = axis === 'x' ? Math.PI / 2 : 0;
    const group = new THREE.Group(); group.position.set(point.x, 0, point.z); group.rotation.y = ry; root.add(group);
    // Three nested collars create the thick, rounded pressure hatch profile.
    const outer = roundedFrame(2.38, 2.68, .19, .65, .18, graphite, group); outer.position.set(0, -.07, -.1);
    const middle = roundedFrame(2.22, 2.55, .125, .60, .25, hull, group); middle.position.set(0, -.015, -.125);
    const gasket = roundedFrame(1.98, 2.40, .075, .52, .16, seal, group); gasket.position.set(0, .012, -.08);
    const left = new THREE.Group(), right = new THREE.Group(); group.add(left, right);
    hatchLeaf(1, left); hatchLeaf(-1, right);
    // Tracks stay fixed above the sliding leaves; seam and handles move with them.
    solidBox(group, 0, 2.46, .18, 1.65, .055, .055, silver);
    solidBox(group, 0, 2.46, -.18, 1.65, .055, .055, silver);
    const signalMaterial = new THREE.MeshBasicMaterial({ color: LIME }); materials.add(signalMaterial);
    const signal = solidBox(group, 0, 2.55, .205, .57, .045, .03, signalMaterial);
    solidBox(group, 0, 2.55, -.205, .57, .045, .03, signalMaterial);
    const current = MODULES.find(m => m.id === currentId), currentRoom = rooms.find(r => r.id === currentId), other = rooms.find(r => r.id === otherId);
    const frontIsInside = axis === 'x' ? current.x > point.x : current.z > point.z;
    const front = frontIsInside ? other : currentRoom, back = frontIsInside ? currentRoom : other;
    textPlane(sign(front.shortName, 'AUTOMATIC PRESSURE HATCH', front.number), 1.08, .24, 0, 2.445, .215, 0, group);
    textPlane(sign(back.shortName, 'AUTOMATIC PRESSURE HATCH', back.number), 1.08, .24, 0, 2.445, -.215, Math.PI, group);
    // Collar feet define the true 1.82m clear opening inside the 2.25m tube.
    for (const side of [-1, 1]) {
      const dx = axis === 'z' ? side * 1.045 : 0, dz = axis === 'x' ? side * 1.045 : 0;
      colliders.push({ id: `jamb-${link.id}-${endpoint}-${side}`, x: point.x + dx, z: point.z + dz, w: axis === 'z' ? .24 : .34, d: axis === 'z' ? .34 : .24 });
    }
    const collider = { id: `door-${link.id}-${endpoint}`, x: point.x, z: point.z, w: axis === 'z' ? 1.85 : .18, d: axis === 'z' ? .18 : 1.85, disabled: false };
    colliders.push(collider);
    const door = { id: `${link.id}-${endpoint}`, x: point.x, z: point.z, axis, openness: 0, collider, left, right, signal, holdUntil: 0 };
    doors.push(door);
  }

  for (const link of LINKS) {
    tube(link);
    pressureHatch(link, link.a, link.from, link.to, 'a');
    pressureHatch(link, link.b, link.to, link.from, 'b');
  }

  const ambient = new THREE.HemisphereLight(0xe2ebf0, 0x4b5049, .56); root.add(ambient);
  root.add(new THREE.AmbientLight(0xe8e4d7, .18));
  const sunlight = new THREE.DirectionalLight(0xefffd4, 1.5); sunlight.position.set(5, 22, -80); root.add(sunlight);

  // The Bridge cupola frames a nearby neon star. Hulls remain opaque everywhere else.
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec3 vPosition;uniform float time;float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}void main(){vec3 p=normalize(vPosition)*10.;p.y+=time*.025;float n=noise(p)*.5+noise(p*2.3+time*.022)*.3+noise(p*6.)*.2;vec3 col=mix(vec3(.25,.38,.006),vec3(.94,1.,.22),smoothstep(.34,.68,n));gl_FragColor=vec4(col*1.45,1.);}`,
  }); materials.add(starMaterial);
  const star = addMesh(new THREE.SphereGeometry(19, 64, 40), starMaterial); star.position.set(-1, 9, -103); star.castShadow = false;
  animated.push(time => { starMaterial.uniforms.time.value = time; star.rotation.y = time * .005; });
  const coronaMap = texture(256, 256, ctx => {
    const gradient = ctx.createRadialGradient(128, 128, 50, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(230,255,99,.23)'); gradient.addColorStop(.4, 'rgba(207,255,4,.12)'); gradient.addColorStop(1, 'rgba(207,255,4,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  });
  const coronaMaterial = new THREE.SpriteMaterial({ map: coronaMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); materials.add(coronaMaterial);
  const corona = new THREE.Sprite(coronaMaterial); corona.position.copy(star.position); corona.scale.set(76, 76, 1); root.add(corona);
  const positions = [], colors = []; let seed = 18593;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 1200; i++) {
    const azimuth = random() * TAU, y = random() * 2 - 1, radius = 190 + random() * 260, planar = Math.sqrt(1 - y * y);
    positions.push(Math.cos(azimuth) * planar * radius, y * radius, Math.sin(azimuth) * planar * radius);
    const brightness = .35 + random() * .65; colors.push(brightness * .86, brightness, brightness * .96);
  }
  const starfieldGeometry = new THREE.BufferGeometry(); starfieldGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); starfieldGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometries.add(starfieldGeometry);
  const starfieldMaterial = new THREE.PointsMaterial({ size: .47, vertexColors: true, transparent: true, opacity: .86, depthWrite: false }); materials.add(starfieldMaterial);
  const stars = new THREE.Points(starfieldGeometry, starfieldMaterial); root.add(stars); animated.push(time => { stars.rotation.y = time * .0007; });
  const planet = addMesh(new THREE.SphereGeometry(9, 32, 24), mat({ color: 0x8b9a91, roughness: .9 })); planet.position.set(-51, -6, -105);
  animated.push(time => { const t = time * .0008; planet.position.x = -1 - Math.cos(t) * 50; planet.position.z = -103 - Math.sin(t) * 50; });

  for (const { material, transforms } of batches.values()) {
    const mesh = new THREE.InstancedMesh(unitBox, material, transforms.length);
    transforms.forEach((transform, i) => mesh.setMatrixAt(i, transform)); mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  }

  return {
    terminalMeshes, colliders, doors,
    animate(time, dt = 1 / 60, player) {
      for (const update of animated) update(time);
      for (const door of doors) {
        const distance = player ? Math.hypot(player.x - door.x, player.z - door.z) : Infinity;
        if (distance < 2.2) door.holdUntil = time + .9;
        const target = time < door.holdUntil ? 1 : 0;
        const speed = Math.min(Math.max(dt, 0), .08) / .7;
        door.openness = target ? Math.min(1, door.openness + speed) : Math.max(0, door.openness - speed);
        const eased = door.openness * door.openness * (3 - 2 * door.openness);
        door.left.position.x = -eased * .96; door.right.position.x = eased * .96;
        door.collider.disabled = door.openness > .82;
        door.signal.material.color.setHex(door.collider.disabled ? LIME : 0xd3ddcd);
      }
    },
    dispose() {
      scene.remove(root); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    },
  };
}
