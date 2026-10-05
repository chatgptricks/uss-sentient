import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { moduleFacet } from './layout.js';

/** Secured, human-scale possessions and maintainable life-support hardware. */
export function addHabitationProps(ctx) {
  const { root, MODULES, materials: M, mat, texture, addMesh } = ctx;
  const stats = { modules: 0, parts: 0, fabricPacks: 0, straps: 0, carabiners: 0,
    handrails: 0, safetyKits: 0, personalItems: 0, ventilationUnits: 0, devices: 0,
    batches: 0, triangles: 0, textureBytes: 1316815, externalTextures: 2,
    texturesLoaded: 0, textureFailures: 0, lights: 0, colliders: 0, activations: 0,
    maxWallInset: .20, minimumDeckHeight: 1.80, placements: [] };
  const collected = new Map(), devices = [], ownedBases = [];
  const own = geometry => { ownedBases.push(geometry); return geometry; };
  const block = own(new THREE.BoxGeometry(1, 1, 1));
  const molded = own(new RoundedBoxGeometry(1, 1, 1, 2, .13));
  const orb = own(new THREE.SphereGeometry(1, 12, 8));
  const cylinder = own(new THREE.CylinderGeometry(1, 1, 1, 16));
  const ring = own(new THREE.TorusGeometry(1, .11, 6, 20));
  const panel = own(new THREE.PlaneGeometry(1, 1));
  const identity = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  const cloth = mat({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0,
    normalScale: new THREE.Vector2(.28, .28) });
  const painted = mat({ color: 0xffffff, vertexColors: true, roughness: .63, metalness: .11 });
  const red = 0xa95143, khaki = 0xb2af90, sage = 0x87928c, ivory = 0xd3d0ba;
  let disposed = false, updateVentilation;
  // Two small shared, locally hosted CC0 maps. Plain cloth remains usable if a
  // texture fails; asynchronous completion cannot mutate disposed resources.
  const loader = new THREE.TextureLoader();
  const ready = Promise.all(['nor_gl', 'rough'].map((kind, i) => new Promise(resolve => {
    const map = loader.load(`${import.meta.env?.BASE_URL || '/'}textures/habitation/fabric_pattern_07_${kind}_1k.jpg`, () => {
      if (!disposed) stats.texturesLoaded++;
      resolve(!disposed);
    }, undefined, () => { if (!disposed) stats.textureFailures++; resolve(false); });
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1.8, 1.8);
    map.colorSpace = THREE.NoColorSpace; map.anisotropy = 4;
    ctx.resourceTextures?.add(map);
    cloth[i ? 'roughnessMap' : 'normalMap'] = map;
  })));

  const labels = ['DOCK / CREW KIT', 'ARCHIVE / CLEAN HANDS', 'FLOOR / TOOL ROLL', 'LAB / RESPIRATOR',
    'FORUM / FLIGHT NOTES', 'COMMONS / PERSONAL', 'BRIDGE / AIR SYSTEM', 'PULL / FIRE SUPPRESSION',
    'SECURE BEFORE TRANSIT', 'CLEAN FILTER / NO LIQUID', 'CREW / 07', 'WATER / LOCK CAP',
    'REMOVE / CHECK SEAL', 'INSPECT TETHER', 'HEPA / 02', 'RETURN TO STOWAGE'];
  const printMap = texture(1024, 512, g => {
    g.fillStyle = '#d3d4c4'; g.fillRect(0, 0, 1024, 512);
    labels.forEach((label, i) => {
      const x = i % 4 * 256, y = Math.floor(i / 4) * 128;
      g.fillStyle = i === 7 ? '#9d4a3d' : '#283936'; g.fillRect(x + 9, y + 10, 238, 8);
      g.font = '500 17px Space, Arial'; g.fillText(label, x + 12, y + 45, 231);
      g.font = '400 12px Space, Arial'; g.fillText('USS SENTIENT / FLIGHT HARDWARE', x + 12, y + 69, 230);
      for (let bar = 0; bar < 32; bar++) g.fillRect(x + 13 + bar * 4, y + 82, bar % 3 ? 2 : 3, 20);
      g.font = '500 13px monospace'; g.fillText(`HAB-${String(i + 1).padStart(3, '0')}`, x + 155, y + 99);
    });
  });
  const print = mat({ color: 0xffffff, map: printMap, roughness: .9, metalness: 0 });

  function face(module, index, offset = 0) {
    const edge = moduleFacet(module, index), { a, b } = edge;
    const yaw = -Math.atan2(b.z - a.z, b.x - a.x);
    const origin = new THREE.Vector3((a.x + b.x) / 2 + Math.cos(yaw) * offset,
      module.elevation, (a.z + b.z) / 2 - Math.sin(yaw) * offset);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
    return { module, index, origin, yaw, rotation,
      transform: new THREE.Matrix4().compose(origin, rotation, new THREE.Vector3(1, 1, 1)),
      length: Math.hypot(b.x - a.x, b.z - a.z) };
  }
  function at(f, x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(f.transform); }
  function record(f, name, x, y, z) {
    stats.placements.push({ module: f.module.id, face: f.index, name,
      position: at(f, x, y, z).toArray().map(v => +v.toFixed(3)) });
  }
  function add(f, geometry, material, x, y, z, w, h = w, d = w, q = identity, tint) {
    const copy = geometry.clone();
    if (copy.index) { const flat = copy.toNonIndexed(); copy.dispose(); geometry = flat; } else geometry = copy;
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, d)).premultiply(f.transform));
    if (material.vertexColors) {
      const color = new THREE.Color(tint ?? 0xffffff), data = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let i = 0; i < data.length; i += 3) { data[i] = color.r; data[i + 1] = color.g; data[i + 2] = color.b; }
      geometry.setAttribute('color', new THREE.BufferAttribute(data, 3));
    }
    if (!collected.has(material)) collected.set(material, []);
    collected.get(material).push(geometry); stats.parts++;
  }
  const B = (f, x, y, z, w, h, d, material = M.enamel, tint) => add(f, block, material, x, y, z, w, h, d, identity, tint);
  const R = (f, x, y, z, w, h, d, material = painted, tint = ivory) => add(f, molded, material, x, y, z, w, h, d, identity, tint);
  function tube(f, a, b, radius = .009, material = M.silver) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start), middle = start.add(end).multiplyScalar(.5);
    add(f, cylinder, material, ...middle.toArray(), radius, delta.length(), radius,
      new THREE.Quaternion().setFromUnitVectors(yAxis, delta.normalize()));
  }
  function curve(f, points, radius, material = M.seal) {
    for (let i = 0; i < points.length - 1; i++) tube(f, points[i], points[i + 1], radius, material);
  }
  function label(f, tile, x, y, z, w, h) {
    const geometry = panel.clone(), uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (tile % 4 + .018 + uv.getX(i) * .964) / 4,
      (3 - Math.floor(tile / 4) + .025 + uv.getY(i) * .95) / 4);
    add(f, geometry, print, x, y, z, w, h, 1); geometry.dispose();
  }
  function buckle(f, x, y, z, width = .043) {
    const r = width / 2;
    for (const dx of [-r, r]) tube(f, [x + dx, y - .026, z], [x + dx, y + .026, z], .0045);
    for (const dy of [-.026, 0, .026]) tube(f, [x - r, y + dy, z], [x + r, y + dy, z], .0045);
  }
  function carabiner(f, x, y, z) {
    const points = [[-.015, -.032], [-.028, -.01], [-.022, .032], [.007, .040], [.026, .016], [.015, -.028], [-.015, -.032]];
    curve(f, points.map(([dx, dy]) => [x + dx, y + dy, z]), .0055, M.silver);
    tube(f, [x + .021, y + .011, z], [x + .015, y - .025, z], .0065, M.graphite); stats.carabiners++;
  }
  function rail(f, x, y, width) {
    for (const side of [-1, 1]) {
      R(f, x + side * width / 2, y, .052, .075, .085, .045, painted, sage);
      tube(f, [x + side * width / 2, y, .065], [x + side * width / 2, y, .148], .014);
    }
    tube(f, [x - width / 2, y, .148], [x + width / 2, y, .148], .015);
    for (const side of [-1, 1]) tube(f, [x + side * width * .18, y, .148], [x + side * width * .43, y, .148], .018, M.seal);
    stats.handrails++;
  }
  function bag(f, x, y, w, h, tile, color = ivory) {
    // Soft bulges have a restrained uneven silhouette instead of a box-shaped
    // equipment cabinet. Twin webbing bands compress the middle of the pack.
    const geometry = molded.clone(), positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
      const tension = Math.exp(-(((Math.abs(px) - .28) / .065) ** 2));
      positions.setXYZ(i, px + .012 * Math.sin(py * 17) * Math.cos(pz * 9), py,
        pz * (1 - tension * .16) + .009 * Math.sin(px * 25 + py * 12));
    }
    geometry.computeVertexNormals();
    add(f, geometry, cloth, x, y, .112, w, h, .13, identity, color); geometry.dispose();
    for (const side of [-1, 1]) {
      const sx = x + side * w * .28;
      B(f, sx, y, .182, .025, h + .028, .012, M.seal);
      buckle(f, sx, y - h * .18, .193);
      const loopY = y + h / 2 + .045;
      curve(f, [[sx, y + h / 2, .14], [sx + side * .015, loopY, .12], [sx + side * .028, loopY + .008, .086]], .0045, M.seal);
      carabiner(f, sx + side * .023, loopY, .09); stats.straps++;
    }
    // Stitched edge piping and a real zipper pull sit proud of the cloth.
    const rim = [[-.43,-.42], [.43,-.42], [.47,-.33], [.47,.33], [.43,.42], [-.43,.42], [-.47,.33], [-.47,-.33], [-.43,-.42]];
    curve(f, rim.map(([dx, dy]) => [x + dx * w, y + dy * h, .165]), .0029, M.padding);
    tube(f, [x - w * .35, y + h * .29, .183], [x + w * .35, y + h * .29, .183], .0035, M.graphite);
    carabiner(f, x + w * .34, y + h * .29, .186);
    label(f, tile, x, y + .003, .184, Math.min(.28, w * .42), Math.min(.085, h * .27));
    stats.fabricPacks++; record(f, labels[tile], x, y, .112);
  }
  function fireKit(f, x, y) {
    R(f, x, y, .045, .17, .48, .045, painted, sage);
    const geometry = own(new THREE.CapsuleGeometry(.073, .23, 4, 12));
    add(f, geometry, painted, x, y, .122, 1, 1, .85, identity, red);
    for (const dy of [-.105, .105]) {
      B(f, x, y + dy, .190, .16, .023, .012, M.seal);
      buckle(f, x + .047, y + dy, .195, .026);
    }
    tube(f, [x, y + .184, .121], [x, y + .225, .121], .018);
    B(f, x + .033, y + .226, .133, .12, .022, .027, M.graphite);
    curve(f, [[x + .037, y + .198, .135], [x + .097, y + .18, .13], [x + .115, y + .025, .115], [x + .09, y - .12, .13]], .0075);
    label(f, 7, x, y + .006, .195, .114, .081);
    stats.safetyKits++; record(f, 'Tethered suppression canister', x, y, .122);
  }
  function respirator(f, x, y) {
    add(f, orb, painted, x, y, .112, .075, .095, .071, identity, sage);
    for (const side of [-1, 1]) {
      tube(f, [x + side * .085, y - .016, .10], [x + side * .085, y - .016, .167], .048, M.graphite);
      tube(f, [x + side * .085, y - .016, .172], [x + side * .085, y - .016, .180], .039, M.padding);
      for (let i = -2; i <= 2; i++) tube(f, [x + side * .085 - .027, y - .016 + i * .011, .188], [x + side * .085 + .027, y - .016 + i * .011, .188], .0025, M.seal);
    }
    curve(f, [[x - .11, y + .02, .107], [x - .10, y + .13, .10], [x, y + .17, .09], [x + .10, y + .13, .10], [x + .11, y + .02, .107]], .006, M.seal);
    carabiner(f, x, y + .18, .082); stats.safetyKits++;
  }
  function toolRoll(f, x, y) {
    bag(f, x, y, .74, .17, 2, khaki);
    for (let i = 0; i < 4; i++) {
      const px = x - .255 + i * .17;
      tube(f, [px, y + .08, .135], [px, y + .16, .135], .0085, M.silver);
      R(f, px, y + .07, .148, .035, .085, .039, painted, i % 2 ? sage : red);
      if (i < 2) tube(f, [px - .020, y + .16, .135], [px + .020, y + .16, .135], .0075);
    }
    stats.personalItems += 4;
  }

  // Faces 1/7 are viewports/terminals; cardinal hatches stay untouched. The
  // shallow high strip also clears existing instruments, tables and seats.
  for (const module of MODULES) {
    const f = face(module, module.id === 'front-door' || module.id === 'commons' ? 3 : 5);
    stats.modules++;
    if (module.id === 'bridge') continue;
    if (module.id === 'forum') {
      bag(f, 0, 2.38, .79, .18, 4, khaki);
      rail(f, 0, 2.50, .93);
      // A pencil is tethered to the clipped flight notes, not left floating.
      tube(f, [.27, 2.36, .192], [.34, 2.48, .192], .0045, M.graphite);
      curve(f, [[.27, 2.36, .187], [.17, 2.30, .19], [.10, 2.32, .18]], .0025);
      stats.personalItems++; continue;
    }
    if (module.id === 'floor') {
      toolRoll(f, 0, 2.375); fireKit(face(module, 6, -.89), 0, 2.055); rail(f, 0, 2.50, .80);
    } else if (module.id === 'lab') {
      bag(f, -.38, 2.39, .68, .19, 3, ivory);
      const safety = face(module, 5, .86);
      respirator(safety, 0, 2.34); label(safety, 12, 0, 2.21, .196, .22, .05);
      rail(f, -.36, 2.51, .73);
    } else if (module.id === 'commons') {
      bag(f, -.39, 2.39, .59, .19, 5, sage); bag(f, .31, 2.39, .57, .19, 10, ivory);
      // Collapsible capped drinking flask, captured in a mounting strap.
      add(f, orb, painted, .79, 2.35, .119, .044, .08, .060, identity, khaki);
      tube(f, [.79, 2.425, .119], [.79, 2.455, .119], .023, M.graphite);
      B(f, .79, 2.35, .183, .063, .026, .009, M.seal);
      curve(f, [[.80, 2.45, .126], [.87, 2.47, .12], [.88, 2.50, .09]], .0035);
      carabiner(f, .88, 2.50, .08); rail(f, -.06, 2.52, 1.10); stats.personalItems++;
    } else if (module.id === 'archive') {
      bag(f, -.24, 2.39, .61, .19, 1, sage);
      // Nested lens-cleaning bottles held in a molded three-point cradle.
      for (const dx of [0, .12]) {
        R(f, .33 + dx, 2.365, .125, .067, .15, .08, painted, ivory);
        B(f, .33 + dx, 2.455, .125, .043, .030, .050, M.graphite);
        B(f, .33 + dx, 2.34, .175, .08, .024, .013, M.seal);
      }
      rail(f, -.20, 2.51, .77); stats.personalItems += 2;
    } else {
      bag(f, 0, 2.39, .77, .19, 0, ivory); fireKit(face(module, 6, -1.28), 0, 2.055);
      rail(f, 0, 2.51, .88);
    }
  }

  // Bridge air handler: a shallow circular inlet, real swept impeller, fixed
  // guard, removable filter cassette, exhaust fins and service switch.
  const bridge = MODULES.find(module => module.id === 'bridge');
  if (bridge) {
    const f = face(bridge, 6, -1.55), cy = 2.105, cx = -.31;
    R(f, 0, cy, .061, 1.56, .58, .085, painted, sage);
    R(f, 0, cy, .104, 1.48, .53, .055, painted, ivory);
    tube(f, [cx, cy, .129], [cx, cy, .149], .249, M.seal);
    add(f, ring, M.silver, cx, cy, .171, .235, .235, .13);
    for (let i = 0; i < 7; i++) B(f, .35 + i * .047, cy + .125, .164, .018, .18, .037, M.graphite);
    for (const x of [-.70, .70]) for (const dy of [-.222, .222]) tube(f, [x, cy + dy, .13], [x, cy + dy, .151], .014, M.silver);
    for (let i = 0; i < 7; i++) B(f, -.66 + i * .095, cy + .244, .145, .028, .007, .007, M.graphite);
    label(f, 6, .27, cy + .235, .145, .55, .051);
    label(f, 14, cx, cy - .239, .145, .30, .044);
    rail(f, 0, 1.846, 1.27);
    record(f, 'Serviceable ventilation impeller and filter cassette', 0, cy, .10);
    stats.ventilationUnits++;

    const fan = new THREE.Group(); fan.name = 'Bridge ventilation impeller';
    fan.position.copy(at(f, cx, cy, .162)); fan.quaternion.copy(f.rotation); root.add(fan);
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(.029, -.020); bladeShape.bezierCurveTo(.085, -.092, .189, -.080, .221, -.013);
    bladeShape.lineTo(.169, .025); bladeShape.bezierCurveTo(.117, -.005, .075, .016, .040, .030); bladeShape.closePath();
    const blade = new THREE.ExtrudeGeometry(bladeShape, { depth: .006, bevelEnabled: true, bevelThickness: .002, bevelSize: .002, bevelSegments: 1, steps: 1, curveSegments: 5 });
    const blades = [];
    for (let i = 0; i < 7; i++) { const geometry = blade.clone(); geometry.rotateZ(i * Math.PI * 2 / 7); blades.push(geometry); }
    const fanGeometry = mergeGeometries(blades); blades.forEach(geometry => geometry.dispose()); blade.dispose();
    addMesh(fanGeometry, M.silver, fan).name = 'Seven swept aluminum fan blades';
    const hubGeometry = new THREE.SphereGeometry(.044, 12, 8); hubGeometry.scale(1, 1, .30); hubGeometry.translate(0, 0, .008);
    const hub = addMesh(hubGeometry, M.graphite, fan); hub.name = 'Molded fan motor hub';
    // The filter slides sideways within the wall plane, avoiding an opening
    // panel or animation projecting into the walking route.
    const filter = new THREE.Group(); filter.name = 'Removable ventilation filter';
    filter.position.copy(at(f, cx, cy, .192)); filter.quaternion.copy(f.rotation); root.add(filter);
    const filterParts = [];
    function filterBar(x, y, w, h, d) {
      const geometry = block.clone().scale(w, h, d).translate(x, y, 0).toNonIndexed(); filterParts.push(geometry);
    }
    for (const x of [-.231, .231]) filterBar(x, 0, .014, .48, .009);
    for (const y of [-.231, .231]) filterBar(0, y, .48, .014, .009);
    for (let i = -4; i <= 4; i++) filterBar(i * .046, 0, .004, .448, .007);
    for (const y of [-.15, 0, .15]) filterBar(0, y, .448, .004, .007);
    const filterGeometry = mergeGeometries(filterParts); filterParts.forEach(geometry => geometry.dispose());
    addMesh(filterGeometry, M.padding, filter).name = 'Reusable HEPA filter guard and pull frame';

    let mode = 0, activations = 0, fanSpeed = .85, serviceTravel = 0;
    const states = ['NORMAL FLOW', 'BOOST FLOW', 'FILTER SERVICE'];
    const draw = (g, w, h) => {
      g.fillStyle = '#132327'; g.fillRect(0, 0, w, h);
      g.fillStyle = mode === 2 ? '#e1b37a' : '#c7d891'; g.fillRect(12, 13, 5, h - 26);
      g.font = '500 27px Space, Arial'; g.fillText(states[mode], 27, 43, w - 40);
      g.font = '400 18px Space, Arial'; g.fillStyle = '#c9d6c7';
      g.fillText(mode === 2 ? 'FAN ISOLATED / FILTER OPEN' : mode === 1 ? 'HIGH VOLUME / 100%' : 'CABIN RETURN / 35%', 27, 75, w - 40);
      g.fillStyle = '#b0b8a4'; g.font = '400 16px Space, Arial'; g.fillText('E / CLICK  ·  CYCLE AIR SYSTEM', 27, 109, w - 40);
    };
    const screenMap = texture(512, 128, draw); screenMap.userData.emissiveDisplay = true;
    const screenMaterial = mat({ map: screenMap, color: 0xffffff, roughness: .6,
      emissive: 0xffffff, emissiveMap: screenMap, emissiveIntensity: .18 });
    const screen = addMesh(new THREE.PlaneGeometry(.61, .153), screenMaterial, root);
    screen.name = 'Air handler service switch'; screen.position.copy(at(f, .365, cy - .115, .173)); screen.quaternion.copy(f.rotation);
    screen.userData.interactiveDeviceId = 'habitat-bridge-air'; screen.castShadow = false;
    devices.push({ id: 'habitat-bridge-air', roomId: bridge.id, label: 'Cycle ventilation / service filter',
      x: screen.position.x, y: screen.position.y, z: screen.position.z, range: 2.25, mesh: screen,
      get state() { return { mode: states[mode], index: mode, active: mode !== 2, activations,
        fanSpeed: +fanSpeed.toFixed(2), filterOpen: mode === 2 }; },
      activate() {
        mode = (mode + 1) % 3; activations++; stats.activations++;
        draw(screenMap.image.getContext('2d'), 512, 128); screenMap.needsUpdate = true;
        return ['Cabin ventilation restored. Filter cassette seated and latched.',
          'Ventilation boosted. The inlet impeller is accelerating.',
          'Ventilation isolated. Fan stopped and filter cassette released for inspection.'][mode];
      },
    });
    stats.devices++;
    ctx.endSection();
    updateVentilation = (_time, dt = 1 / 60) => {
      const step = Math.min(.05, Math.max(0, dt));
      fanSpeed += ((mode === 2 ? 0 : mode === 1 ? 4.3 : .85) - fanSpeed) * Math.min(1, step * 5);
      fan.rotateZ(fanSpeed * step);
      serviceTravel += ((mode === 2 ? .535 : 0) - serviceTravel) * Math.min(1, step * 6);
      filter.position.copy(at(f, cx + serviceTravel, cy, .192));
    };
    stats.batches += 4;
    stats.triangles += (fanGeometry.index?.count || fanGeometry.getAttribute('position').count) / 3
      + (hubGeometry.index?.count || hubGeometry.getAttribute('position').count) / 3
      + filterGeometry.getAttribute('position').count / 3 + 2;
  }

  for (const [material, geometries] of collected) {
    const geometry = mergeGeometries(geometries); geometries.forEach(part => part.dispose());
    const mesh = addMesh(geometry, material, root); mesh.name = 'Batched secured habitation hardware';
    stats.batches++; stats.triangles += geometry.getAttribute('position').count / 3;
  }
  ownedBases.forEach(geometry => geometry.dispose());
  return { stats, devices, ready,
    update(time, dt) { updateVentilation?.(time, dt); },
    dispose() { disposed = true; },
  };
}
