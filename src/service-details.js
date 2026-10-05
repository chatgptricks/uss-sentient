import * as THREE from 'three';

/** Fictional spacecraft sanitation and environmental-service equipment. */
export function addServiceDetails(ctx) {
  const { MODULES, materials: M, kit, box, localBox, mat, texture, textPlane, addMesh, colliders } = ctx;
  const stats = { bathrooms: 1, toilets: 1, sinks: 1, privacyDoors: 1, machineRacks: 1,
    compressors: 2, pumps: 2, fans: 2, devices: 0, parts: 0, meshes: 0, colliders: 0, activations: 0 };
  const devices = [], doors = [];
  const ceramic = mat({ color: 0xe4e6dd, roughness: .23, metalness: .02 });
  const rubber = mat({ color: 0x293633, roughness: .92, metalness: .02 });
  const textile = mat({ color: 0x8b9f95, roughness: .96, metalness: 0 });
  const coolant = mat({ color: 0x688d95, roughness: .35, metalness: .47 });
  const caution = mat({ color: 0xc4a674, roughness: .53, metalness: .25 });
  const polished = mat({ color: 0xafbfbd, metalness: .92, roughness: .14 });
  const water = mat({ color: 0xa3d9e4, transparent: true, opacity: .48, roughness: .08, metalness: .04, depthWrite: false });
  const flushSignal = mat({ color: 0x76a1a4, emissive: 0x497b80, emissiveIntensity: .12, roughness: .3 });
  const fanSignal = mat({ color: 0x87baba, emissive: 0x46888a, emissiveIntensity: .16, roughness: .32 });
  const B = (...args) => { stats.parts++; box(...args); };
  const L = (frame, ...args) => { stats.parts++; localBox(frame.origin, frame.yaw, ...args); };
  const P = (...args) => { stats.parts++; kit.pipe(...args); };
  const LP = (frame, ...args) => { stats.parts++; kit.localPipe(frame.origin, frame.yaw, ...args); };
  const point = (frame, x, y, z) => kit.toWorld(frame.origin, frame.yaw, [x, y, z]);
  const group = (parent, x = 0, y = 0, z = 0) => {
    const result = new THREE.Group(); result.position.set(x, y, z); parent.add(result); return result;
  };
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const result = addMesh(geometry, material, parent); result.position.set(x, y, z); stats.meshes++; return result;
  }
  function blocker(id, x, z, w, d, occludesInteraction = false) {
    const collider = { id, x, z, w, d, occludesInteraction };
    colliders.push(collider); stats.colliders++; return collider;
  }
  function fasteners(frame, width, height, y, z) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      kit.localBolt(frame.origin, frame.yaw, sx * width / 2, y + sy * height / 2, z, M.silver, .017); stats.parts++;
    }
  }
  function placard(frame, title, subtitle, x, y, z, width = .55) {
    const map = texture(512, 128, g => {
      g.fillStyle = '#dce1d5'; g.fillRect(0, 0, 512, 128);
      g.fillStyle = '#233831'; g.font = '500 32px Space, Arial'; g.fillText(title, 22, 47, 470);
      g.fillStyle = '#557067'; g.font = '21px Space, Arial'; g.fillText(subtitle, 22, 94, 470);
    });
    return textPlane(map, width, width / 4, ...point(frame, x, y, z), frame.yaw);
  }
  function display(frame, title, x, y, z, width, getLines, parent) {
    const draw = (g, w, h) => {
      const [status, line, footer] = getLines();
      g.fillStyle = '#091b20'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7ba7a3'; g.font = '500 21px Space, Arial'; g.fillText(title, 22, 32, w - 44);
      g.fillStyle = '#d5e4cf'; g.font = '500 34px Space, Arial'; g.fillText(status, 22, 85, w - 44);
      g.strokeStyle = '#365b58'; g.lineWidth = 2; g.beginPath(); g.moveTo(22, 105); g.lineTo(w - 22, 105); g.stroke();
      g.fillStyle = '#9dbfb6'; g.font = '23px Space, Arial'; g.fillText(line, 22, 143, w - 44);
      g.fillStyle = '#cfff04'; g.font = '500 22px Space, Arial'; g.fillText(footer, 22, 194, w - 44);
    };
    const map = texture(512, 224, draw); map.userData.emissiveDisplay = true;
    L(frame, x, y, z - .027, width + .055, width * 224 / 512 + .055, .048, M.graphite);
    const screen = textPlane(map, width, width * 224 / 512, ...point(frame, x, y, z), frame.yaw, parent);
    const repaint = () => { draw(map.image.getContext('2d'), 512, 224); map.needsUpdate = true; };
    return { screen, repaint, map };
  }
  function device(id, module, label, target, approach, activate, state) {
    const center = target.position;
    const result = { id, roomId: module.id, zone: 'station', label,
      x: center.x, y: center.y + module.elevation, z: center.z, range: 1.65,
      mesh: target, approach: { ...approach,
        yaw: Math.atan2(-(center.x - approach.x), -(center.z - approach.z)),
        pitch: Math.atan2(center.y - 1.6, Math.hypot(center.x - approach.x, center.z - approach.z)) },
      activate() { stats.activations++; return activate(); }, get state() { return state(); } };
    target.userData.interactiveDeviceId = id; devices.push(result); stats.devices++; return result;
  }
  function roundedPanel(width, height, depth, radius = .12) {
    const x = -width / 2, y = -height / 2, shape = new THREE.Shape();
    shape.moveTo(x + radius, y); shape.lineTo(x + width - radius, y); shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius); shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .015, bevelThickness: .012, bevelSegments: 2, curveSegments: 6 });
    geometry.translate(0, 0, -depth / 2); return geometry;
  }

  const commons = MODULES.find(m => m.id === 'commons'), bathroomParent = ctx.beginModule(commons);
  const bath = { minX: 11.22, maxX: 14.10, front: -18.10, rear: -14.92, doorX: 12.50 };
  const centerZ = (bath.front + bath.rear) / 2, wallHeight = 2.38;
  // Partition skins are placed entirely inside the agreed hull footprint.
  for (const x of [bath.minX + .05, bath.maxX - .05]) {
    B(x, wallHeight / 2, centerZ, .10, wallHeight, bath.rear - bath.front, M.enamel);
    B(x + (x < 12 ? .06 : -.06), .28, centerZ, .03, .36, bath.rear - bath.front - .20, M.graphite);
    blocker(`service-bath-wall-${x < 12 ? 'west' : 'east'}`, x, centerZ, .10, bath.rear - bath.front, true);
    for (const z of [bath.front + .12, centerZ, bath.rear - .12]) {
      P([x, .09, z], [x, 2.35, z], .027, M.silver);
      B(x + (x < 12 ? .061 : -.061), 2.20, z, .034, .16, .045, M.graphite);
    }
  }
  B((bath.minX + bath.maxX) / 2, wallHeight / 2, bath.rear - .05, bath.maxX - bath.minX - .10, wallHeight, .10, M.enamel);
  blocker('service-bath-wall-rear', (bath.minX + bath.maxX) / 2, bath.rear - .05, bath.maxX - bath.minX - .10, .10, true);
  for (const [left, right] of [[bath.minX, bath.doorX - .54], [bath.doorX + .54, bath.maxX]]) {
    B((left + right) / 2, wallHeight / 2, bath.front + .07, right - left, wallHeight, .14, M.enamel);
    blocker(`service-bath-wall-front-${left < bath.doorX ? 'left' : 'right'}`, (left + right) / 2, bath.front + .07, right - left, .14, true);
  }
  B(bath.doorX, 2.29, bath.front + .07, 1.08, .18, .14, M.enamel);
  for (const z of [bath.front + .10, bath.rear - .12]) {
    B(12.65, 2.34, z, 2.76, .10, .15, M.graphite);
    B(12.65, 2.285, z, 2.51, .014, .10, M.whiteLight);
  }
  // The visible diffuser sits just above the lighting rig's fixed pooled source.
  B(12.55, 2.54, -16.65, 1.15, .12, .30, M.enamel);
  B(12.55, 2.473, -16.65, 1.01, .018, .21, M.whiteLight);
  for (const side of [-1, 1]) {
    B(12.55, 2.463, -16.65 + side * .127, 1.10, .034, .026, M.graphite);
    P([12.55 + side * .47, 2.58, -16.65], [12.55 + side * .47, 3.04, -16.65], .017, M.silver);
  }
  // Folded pressure-corner armor bridges the panel seams. Its narrow inward
  // face stays within the existing wall margin below shoulder height.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const corner = { origin: { x: sx > 0 ? bath.minX + .115 : bath.maxX - .115,
      z: sz > 0 ? bath.front + .115 : bath.rear - .115 }, yaw: Math.atan2(sx, sz) };
    L(corner, 0, 1.20, 0, .25, 2.26, .054, M.graphite);
    L(corner, 0, 1.20, .014, .22, 2.23, .030, M.enamel);
    L(corner, 0, 1.20, .031, .028, 2.12, .013, M.seal);
    for (const y of [.26, .97, 1.73, 2.24]) {
      L(corner, 0, y, .029, .19, .063, .015, M.silver);
      kit.localBolt(corner.origin, corner.yaw, 0, y, .039, M.silver, .018); stats.parts++;
    }
  }
  // Shallow east-side access cassettes provide readable maintenance surfaces
  // without consuming circulation or crossing any interactive display.
  const serviceWall = { origin: { x: bath.maxX - .082, z: centerZ }, yaw: -Math.PI / 2 };
  for (const offset of [-.87, 0, .87]) {
    L(serviceWall, offset, 1.31, .008, .76, 1.09, .033, M.seal);
    L(serviceWall, offset, 1.31, .028, .71, 1.035, .014, M.padding);
    L(serviceWall, offset, 1.31, .038, .64, .014, .009, M.silver);
    for (const side of [-1, 1]) {
      L(serviceWall, offset + side * .284, 1.32, .049, .025, .17, .022, M.graphite);
      L(serviceWall, offset + side * .284, 1.32, .062, .034, .036, .010, M.silver);
      for (const y of [.847, 1.773]) {
        kit.localBolt(serviceWall.origin, serviceWall.yaw, offset + side * .294, y, .041, M.silver, .017); stats.parts++;
        L(serviceWall, offset + side * .294, y, .052, .011, .003, .004, M.graphite);
      }
    }
    for (let mark = 0; mark < 3; mark++) L(serviceWall, offset - .19 + mark * .046, 1.67, .041, .026, .039, .012, mark ? M.silver : M.accent);
  }
  placard(serviceWall, 'AIR / WATER RECOVERY', 'ISOLATE BEFORE SERVICE', 0, 1.94, .047, .70);
  // Raised return-air plenum, angled louvers and a restrained ceiling conduit.
  L(serviceWall, 0, 2.19, .060, 1.64, .28, .11, M.enamel);
  L(serviceWall, 0, 2.19, .124, 1.52, .20, .028, M.seal);
  for (let fin = 0; fin < 18; fin++) L(serviceWall, -.709 + fin * .0834, 2.19, .151, .032, .16, .039, M.silver, -.20);
  for (const side of [-1, 1]) kit.localBolt(serviceWall.origin, serviceWall.yaw, side * .765, 2.19, .134, M.silver, .019);
  for (const [x, direction] of [[bath.minX + .16, 1], [bath.maxX - .16, -1]]) {
    P([x, 2.30, bath.front + .23], [x, 2.30, bath.rear - .23], .021, M.silver);
    P([x + direction * .045, 2.35, bath.front + .23], [x + direction * .045, 2.35, bath.rear - .23], .013, M.seal);
    for (const z of [bath.front + .36, centerZ, bath.rear - .36]) {
      B(x, 2.30, z, .085, .070, .033, M.graphite);
      B(x + direction * .040, 2.30, z, .015, .037, .023, M.silver);
    }
  }
  P([bath.minX + .16, 2.30, bath.rear - .23], [bath.maxX - .16, 2.30, bath.rear - .23], .021, M.silver);
  // Fine joints sit almost flush with the skins and continue behind equipment.
  for (const y of [.58, 1.01]) {
    B(bath.minX + .106, y, centerZ, .009, .008, 2.78, M.seal);
    B(bath.maxX - .106, y, centerZ, .009, .008, 2.78, M.seal);
    B(12.65, y, bath.rear - .105, 2.47, .008, .009, M.seal);
  }
  // A restrained dark floor inset and removable grates give the bay a wet-room finish.
  B(12.65, .009, centerZ, 2.60, .012, 2.91, M.padding);
  for (const z of [-17.56, -15.20]) {
    B(12.63, .022, z, 1.75, .014, .14, M.graphite);
    for (let slot = 0; slot < 22; slot++) B(11.82 + slot * .077, .033, z, .045, .012, .10, M.silver);
  }
  const doorFrame = group(bathroomParent, bath.doorX, .025, bath.front);
  ctx.roundedFrame(1.24, 2.24, .074, .17, .14, M.graphite, doorFrame);
  const leaf = group(bathroomParent, bath.doorX, 1.12, bath.front + .025);
  const leafSkin = mesh(roundedPanel(1.065, 2.08, .085, .13), M.enamel, leaf);
  leafSkin.name = 'Commons / rounded sliding privacy leaf';
  for (const side of [-1, 1]) {
    kit.cuboid(0, .72, side * .058, .75, .018, .012, M.silver, 0, leaf);
    kit.cuboid(-.30, -.10, side * .061, .034, .34, .031, M.graphite, 0, leaf);
    kit.pipe([-.28, -.22, side * .098], [-.28, .07, side * .098], .018, M.silver, 10, leaf);
    for (let line = 0; line < 6; line++) kit.cuboid(0, -.66 + line * .039, side * .055, .63, .015, .019, M.graphite, 0, leaf);
  }
  B(13.12, 2.27, bath.front + .012, 2.24, .062, .12, M.silver);
  const doorCollider = blocker('service-bath-door', bath.doorX, bath.front + .025, 1.08, .15, true);
  let doorTarget = 0, doorAmount = 0, doorCycles = 0;
  const privacyScreens = group(bathroomParent);
  const front = { origin: { x: 11.72, z: bath.front - .024 }, yaw: Math.PI };
  const inside = { origin: { x: 11.72, z: bath.front + .18 }, yaw: 0 };
  const privacyLines = () => [doorTarget ? 'OPEN' : 'PRIVACY', doorTarget ? 'ENTRY CLEAR' : 'PLEASE KNOCK', 'E / CLICK · SLIDE DOOR'];
  const frontControl = display(front, 'COMMONS / WASHROOM', 0, 1.39, 0, .45, privacyLines, privacyScreens);
  const innerControl = display(inside, 'PRIVACY CONTROL', 0, 1.39, 0, .45, privacyLines, privacyScreens);
  privacyScreens.position.set(0, 0, 0);
  // Each side has its own hit point, so a solid privacy partition never makes
  // the inside controller appear to be on the far side of an occluding wall.
  const togglePrivacy = () => { doorTarget = doorTarget ? 0 : 1; doorCycles++; frontControl.repaint(); innerControl.repaint(); return doorTarget ? 'Washroom privacy door opening.' : 'Privacy door closing. The safety sensor keeps the doorway clear.'; };
  const privacyState = () => ({ open: doorTarget === 1, openness: doorAmount, cycles: doorCycles });
  device('service-bath-door', commons, 'Open / close privacy door', frontControl.screen,
    { x: 12.28, z: -18.95 }, togglePrivacy, privacyState).sound = 'door-open';
  device('service-bath-door-inside', commons, 'Open / close privacy door', innerControl.screen,
    { x: 12.55, z: -17.35 }, togglePrivacy, privacyState).sound = 'door-open';
  doors.push({ id: doorCollider.id, x: bath.doorX, z: bath.front, collider: doorCollider, get openness() { return doorAmount; } });
  placard({ origin: { x: 13.53, z: bath.front - .015 }, yaw: Math.PI }, 'WASHROOM', 'VACUUM / RECYCLED WATER', 0, 1.76, 0, .82);

  // Basin: a hollow rolled ceramic profile, rather than a solid countertop cube.
  const sinkFrame = { origin: { x: bath.minX + .135, z: -16.52 }, yaw: Math.PI / 2 };
  L(sinkFrame, 0, .43, .29, .81, .78, .52, M.enamel);
  L(sinkFrame, 0, .072, .29, .87, .09, .57, M.graphite);
  L(sinkFrame, 0, .69, .557, .54, .031, .019, M.silver);
  L(sinkFrame, 0, .84, .37, .93, .07, .69, M.enamel);
  const basinProfile = [[0, -.06], [.09, -.055], [.20, 0], [.285, .10], [.292, .14], [.316, .145], [.326, .11], [.24, -.09], [.12, -.11], [0, -.11]].map(p => new THREE.Vector2(...p));
  const basin = mesh(new THREE.LatheGeometry(basinProfile.reverse(), 28), ceramic, bathroomParent, ...point(sinkFrame, 0, .86, .40));
  basin.rotation.y = sinkFrame.yaw; basin.scale.set(1.16, 1, .82);
  LP(sinkFrame, [-.26, .88, .17], [-.26, 1.22, .17], .020, polished, 12);
  LP(sinkFrame, [-.26, 1.22, .17], [-.03, 1.22, .46], .020, polished, 12);
  LP(sinkFrame, [-.03, 1.22, .46], [-.03, 1.14, .46], .025, polished, 12);
  L(sinkFrame, .27, 1.014, .20, .095, .035, .16, M.silver);
  L(sinkFrame, .27, 1.035, .22, .025, .015, .075, coolant);
  const stream = mesh(new THREE.CylinderGeometry(.007, .011, .23, 8), water, bathroomParent, ...point(sinkFrame, -.03, 1.022, .46));
  stream.visible = false; stream.castShadow = false; stream.userData.excludeFromAO = true;
  const drain = mesh(new THREE.CylinderGeometry(.038, .038, .010, 16), M.graphite, bathroomParent, ...point(sinkFrame, 0, .805, .40));
  for (let slot = 0; slot < 4; slot++) L(sinkFrame, (slot - 1.5) * .012, .812, .40, .005, .004, .042, M.silver);
  L(sinkFrame, 0, 1.70, .042, .87, .98, .045, M.graphite);
  // Polished metal mirror: physically shaded, without a second scene-render pass.
  L(sinkFrame, 0, 1.70, .072, .79, .89, .013, polished);
  for (const side of [-1, 1]) L(sinkFrame, side * .424, 1.70, .078, .026, .94, .045, M.enamel);
  L(sinkFrame, -.63, 1.26, .145, .19, .33, .22, M.enamel);
  L(sinkFrame, -.63, 1.40, .262, .11, .028, .045, M.graphite);
  L(sinkFrame, -.63, 1.10, .24, .06, .04, .065, M.silver);
  placard(sinkFrame, 'HAND WASH', 'METERED DISPENSER', -.63, 1.27, .262, .16);
  LP(sinkFrame, [-.34, .61, .655], [.34, .61, .655], .020, M.silver);
  L(sinkFrame, .03, .37, .667, .40, .42, .029, textile);
  for (let fold = 0; fold < 7; fold++) L(sinkFrame, -.14 + fold * .055, .37, .687, .015, .40, .014, M.padding);
  fasteners(sinkFrame, .77, .88, 1.70, .099);
  blocker('service-bath-basin', 11.70, -16.52, .81, 1.00);
  let washTimer = 0, washCycles = 0, reclaimed = 0;
  const washFrame = { origin: { x: bath.minX + .18, z: -17.40 }, yaw: Math.PI / 2 };
  const washControl = display(washFrame, 'WATER RECOVERY', 0, 1.24, .022, .49,
    () => [washTimer > 0 ? 'METERED FLOW' : 'WATER READY', `RECOVERED ${reclaimed.toFixed(2)} L`, 'E / CLICK · WASH HANDS']);
  device('service-bath-wash', commons, 'Run metered hand wash', washControl.screen,
    { x: 12.47, z: -17.35, yaw: Math.PI / 2, pitch: -.30 },
    () => { if (washTimer > 0) return 'Hand wash is running. Water returns to the recovery loop.'; washTimer = 5; washCycles++; stream.visible = true; washControl.repaint(); return 'Metered hand wash started. Reclaimed-water loop active.'; },
    () => ({ active: washTimer > 0, cycles: washCycles, reclaimedLitres: reclaimed, remainingSeconds: washTimer }));

  // Vacuum toilet: hollow bowl, padded ring, hinged lid, suction connection,
  // thigh restraints and a rigid foot bar suitable for the station's deck.
  const toiletFrame = { origin: { x: 13.23, z: -15.62 }, yaw: Math.PI };
  const toiletParent = group(bathroomParent, toiletFrame.origin.x, 0, toiletFrame.origin.z); toiletParent.rotation.y = toiletFrame.yaw;
  const bowlProfile = [[.07, .30], [.105, .34], [.18, .44], [.225, .49], [.252, .49], [.255, .44], [.19, .24], [.145, .14], [.09, .14]].map(p => new THREE.Vector2(...p));
  const bowl = mesh(new THREE.LatheGeometry(bowlProfile.reverse(), 32), ceramic, toiletParent); bowl.scale.z = 1.23;
  const seat = mesh(new THREE.TorusGeometry(.237, .031, 10, 40), M.padding, toiletParent, 0, .512, 0); seat.rotation.x = Math.PI / 2; seat.scale.y = 1.23;
  const bowlDrain = mesh(new THREE.CylinderGeometry(.074, .058, .065, 16), M.graphite, toiletParent, 0, .285, 0);
  L(toiletFrame, 0, .135, 0, .41, .23, .47, M.enamel);
  L(toiletFrame, 0, .045, 0, .51, .085, .60, M.graphite);
  L(toiletFrame, 0, .82, -.35, .54, 1.48, .24, M.enamel);
  L(toiletFrame, 0, 1.32, -.215, .40, .34, .035, M.graphite);
  L(toiletFrame, 0, 1.42, -.192, .27, .025, .022, flushSignal);
  LP(toiletFrame, [-.18, .56, -.15], [.18, .56, -.15], .030, M.silver);
  const lidPivot = group(toiletParent, 0, .565, -.19);
  const lid = mesh(new THREE.SphereGeometry(1, 24, 12), M.enamel, lidPivot, 0, 0, .19); lid.scale.set(.262, .033, .326); lidPivot.rotation.x = -1.32;
  for (const side of [-1, 1]) {
    LP(toiletFrame, [side * .22, .48, -.17], [side * .32, .54, .08], .029, M.silver);
    L(toiletFrame, side * .285, .555, .15, .075, .043, .26, rubber);
    LP(toiletFrame, [side * .26, .10, .26], [side * .26, .13, .48], .023, M.silver);
    L(toiletFrame, side * .21, .117, .48, .21, .09, .21, rubber);
    L(toiletFrame, side * .21, .172, .48, .18, .023, .095, M.silver);
  }
  LP(toiletFrame, [-.21, .245, -.05], [-.39, .245, -.15], .052, rubber, 12);
  LP(toiletFrame, [-.39, .245, -.15], [-.39, .78, -.27], .052, rubber, 12);
  for (let rib = 0; rib < 10; rib++) LP(toiletFrame, [-.39, .28 + rib * .047, -.158 - rib * .01], [-.39, .294 + rib * .047, -.161 - rib * .01], .061, M.graphite, 10);
  LP(toiletFrame, [-.39, .78, -.27], [-.39, 1.02, -.27], .067, M.enamel, 12);
  L(toiletFrame, .48, .86, -.16, .24, .31, .23, M.enamel);
  L(toiletFrame, .48, .693, -.035, .13, .018, .035, M.padding);
  placard(toiletFrame, 'VACUUM TOILET', 'SECURE RESTRAINTS / CLOSE LID', 0, 1.10, -.218, .41);
  blocker('service-bath-toilet', 13.23, -15.75, .98, 1.20);
  let flushTimer = 0, flushCount = 0, flushPhase = 'READY';
  const flushFrame = { origin: { x: 13.66, z: bath.rear - .12 }, yaw: Math.PI };
  const flushControl = display(flushFrame, 'SANITATION / 04', 0, 1.48, .035, .51,
    () => [flushPhase, `SEALED CYCLES ${String(flushCount).padStart(3, '0')}`, 'E / CLICK · VACUUM CYCLE']);
  const flushDevice = device('service-bath-flush', commons, 'Cycle vacuum toilet', flushControl.screen,
    { x: 13.20, z: -16.77, yaw: Math.PI, pitch: -.09 },
    () => { if (flushTimer > 0) return 'Vacuum transfer is already running.'; flushTimer = 3.6; flushCount++; flushPhase = 'SEALING LID'; flushControl.repaint(); flushSignal.emissiveIntensity = .65; return 'Toilet lid closing. Sealed vacuum transfer started.'; },
    () => ({ phase: flushPhase, active: flushTimer > 0, cycles: flushCount, lidAngle: lidPivot.rotation.x }));
  flushDevice.range = 1.90;
  // Rear storage remains shallow and leaves the basin-to-toilet turning space.
  const storageFrame = { origin: { x: 12.04, z: bath.rear - .11 }, yaw: Math.PI };
  L(storageFrame, 0, 1.62, .13, .85, .95, .21, M.enamel);
  for (const side of [-1, 1]) {
    L(storageFrame, side * .211, 1.62, .251, .398, .87, .033, M.padding);
    L(storageFrame, side * .065, 1.59, .28, .033, .18, .04, M.graphite);
  }
  placard(storageFrame, 'PERSONAL STORES', 'RETURN ITEMS / LEAVE READY', 0, 2.16, .066, .76);
  ctx.endSection();

  // Floor service machinery is in its own bay: front faces west toward a clear aisle.
  const floor = MODULES.find(m => m.id === 'floor'), machineryParent = ctx.beginModule(floor);
  const machineFrame = { origin: { x: -9.65, z: -6.45 }, yaw: -Math.PI / 2 };
  const rack = group(machineryParent, machineFrame.origin.x, 0, machineFrame.origin.z); rack.rotation.y = machineFrame.yaw;
  L(machineFrame, 0, .085, 0, 1.57, .15, 1.01, M.graphite);
  for (const side of [-1, 1]) for (const back of [-1, 1]) {
    LP(machineFrame, [side * .72, .12, back * .44], [side * .72, 2.37, back * .44], .034, M.silver);
    L(machineFrame, side * .72, .055, back * .43, .16, .10, .16, M.enamel);
    for (const height of [.25, 1.0, 1.80, 2.32]) L(machineFrame, side * .72, height, back * .44, .087, .045, .087, M.graphite);
  }
  L(machineFrame, 0, 1.22, -.44, 1.43, 2.25, .08, M.enamel);
  for (const y of [.19, .92, 1.71, 2.38]) L(machineFrame, 0, y, 0, 1.47, .066, .91, M.graphite);
  const fans = [];
  for (const side of [-1, 1]) {
    const x = side * .35;
    const compressor = mesh(new THREE.CylinderGeometry(.205, .205, .63, 24), M.enamel, rack, x, .56, -.11); compressor.rotation.x = Math.PI / 2;
    for (const z of [-.34, .10]) kit.pipe([x, .56, z - .025], [x, .56, z + .025], .22, M.silver, 20, rack);
    kit.cuboid(x, .277, -.10, .44, .10, .56, M.silver, 0, rack);
    kit.pipe([x, .55, .20], [x, .55, .39], .065, coolant, 12, rack);
    kit.pipe([x, .55, .35], [x, 1.17, .35], .047, coolant, 12, rack);
    kit.cuboid(x, 1.19, .11, .47, .46, .42, M.enamel, 0, rack);
    kit.cuboid(x, 1.19, .338, .41, .37, .035, M.graphite, 0, rack);
    for (let fin = 0; fin < 8; fin++) kit.cuboid(x - .164 + fin * .047, 1.19, .368, .023, .34, .045, M.silver, 0, rack);
    kit.pipe([x, 1.41, -.11], [x, 1.65, -.11], .080, M.silver, 12, rack);
    kit.pipe([x, 1.55, -.11], [x, 1.55, .27], .05, coolant, 12, rack);
    const wheel = mesh(new THREE.TorusGeometry(.10, .016, 8, 18), caution, rack, x, 1.56, .31);
    for (let spoke = 0; spoke < 3; spoke++) {
      const a = spoke * Math.PI * 2 / 3; kit.pipe([x, 1.56, .31], [x + Math.cos(a) * .10, 1.56 + Math.sin(a) * .10, .31], .009, M.silver, 8, rack);
    }
    kit.cuboid(x, 2.04, .14, .59, .52, .43, M.enamel, 0, rack);
    const shroud = mesh(new THREE.TorusGeometry(.202, .035, 10, 28), M.graphite, rack, x, 2.04, .387);
    const fan = group(rack, x, 2.04, .405); fans.push(fan);
    mesh(new THREE.CylinderGeometry(.055, .055, .035, 12), M.silver, fan).rotation.x = Math.PI / 2;
    for (let blade = 0; blade < 6; blade++) {
      const angle = blade * Math.PI / 3;
      kit.cuboid(Math.cos(angle) * .116, Math.sin(angle) * .116, 0, .155, .063, .019, M.silver, 0, fan);
    }
    // A spaced wire guard leaves the actual moving blades visible.
    for (const offset of [-.115, 0, .115]) {
      kit.pipe([x - .188, 2.04 + offset, .441], [x + .188, 2.04 + offset, .441], .008, M.graphite, 6, rack);
      kit.pipe([x + offset, 1.852, .442], [x + offset, 2.228, .442], .008, M.graphite, 6, rack);
    }
    kit.cuboid(x + .247, 2.22, .378, .035, .055, .035, fanSignal, 0, rack);
  }
  for (const x of [-.61, .61]) {
    LP(machineFrame, [x, .31, -.27], [x, 2.30, -.27], .018, caution, 10);
    for (let clamp = 0; clamp < 7; clamp++) L(machineFrame, x, .42 + clamp * .29, -.25, .082, .029, .072, M.silver);
  }
  // The return plenum connects the compressor assembly to overhead service ducting.
  L(machineFrame, 0, 2.47, -.04, 1.14, .17, .63, M.enamel);
  LP(machineFrame, [-.40, 2.51, -.06], [-.40, 2.76, -.06], .11, M.silver, 16);
  LP(machineFrame, [.40, 2.51, -.06], [.40, 2.76, -.06], .11, M.silver, 16);
  L(machineFrame, 0, 2.80, -.06, 1.12, .12, .30, M.graphite);
  B(-10.40, 2.835, -6.25, .34, .105, .85, M.enamel);
  B(-10.40, 2.771, -6.25, .23, .018, .73, M.whiteLight);
  P([-9.65, 2.84, -6.25], [-10.40, 2.84, -6.25], .026, M.silver);
  fasteners(machineFrame, 1.35, 2.08, 1.22, .482);
  blocker('service-floor-cooling-rack', -9.65, -6.45, 1.10, 1.65);
  let coolingMode = 1, coolingCycles = 0;
  const coolingNames = ['STANDBY', 'CABIN COOLING', 'FILTER PURGE'];
  const machineControl = display(machineFrame, 'ENVIRONMENT / APU 02', 0, 1.69, .497, .60,
    () => [coolingNames[coolingMode], ['LOAD 00% / ISOLATED', 'LOAD 42% / 21.4 C', 'LOAD 78% / SERVICE'][coolingMode], 'E / CLICK · CHANGE MODE']);
  device('service-floor-cooling', floor, 'Cycle environmental plant', machineControl.screen,
    { x: -10.75, z: -6.45, yaw: -Math.PI / 2, pitch: .06 },
    () => { coolingMode = (coolingMode + 1) % 3; coolingCycles++; machineControl.repaint(); fanSignal.emissiveIntensity = coolingMode ? .5 : .08; return ['Environmental plant on standby. Service valves remain isolated.', 'Cabin cooling active. Twin fans and coolant pumps are running.', 'Filter purge started. The service fans are clearing the recovery loop.'][coolingMode]; },
    () => ({ mode: coolingNames[coolingMode], index: coolingMode, activations: coolingCycles, fanSpeed: coolingMode ? coolingMode === 1 ? 2.8 : 5.2 : 0 }));
  placard(machineFrame, 'THERMAL / AIR LOOP', 'TWIN PUMP · SERVICE FROM AISLE', 0, .16, .492, .90);
  ctx.endSection();

  return { stats, devices, doors, bounds: { bathroom: bath, machinery: { x: -9.65, z: -6.45, w: 1.1, d: 1.65 } },
    update(time, dt, player, motionScale = 1) {
      const delta = Math.min(Math.max(dt, 0), .1), previousDoor = doorAmount, previousLid = lidPivot.rotation.x;
      const occupied = player?.layer !== 'cupola' && player && Math.abs(player.x - bath.doorX) < .84 && Math.abs(player.z - bath.front) < .46;
      const target = occupied && doorAmount > .02 ? 1 : doorTarget;
      doorAmount = THREE.MathUtils.damp(doorAmount, target, 5.5, delta);
      leaf.position.x = bath.doorX + doorAmount * 1.095;
      doorCollider.disabled = doorAmount > .91;
      if (washTimer > 0) {
        washTimer = Math.max(0, washTimer - delta);
        stream.scale.x = stream.scale.z = .92 + Math.sin(time * 14) * .08 * motionScale;
        if (!washTimer) { stream.visible = false; reclaimed += .18; washControl.repaint(); }
      }
      if (flushTimer > 0) {
        flushTimer = Math.max(0, flushTimer - delta);
        const next = flushTimer > 2.75 ? 'SEALING LID' : flushTimer > 1.0 ? 'VACUUM TRANSFER' : flushTimer > 0 ? 'AIR PURGE' : 'READY';
        if (next !== flushPhase) { flushPhase = next; flushControl.repaint(); }
        if (!flushTimer) flushSignal.emissiveIntensity = .12;
      }
      lidPivot.rotation.x = THREE.MathUtils.damp(lidPivot.rotation.x, flushTimer > 0 ? 0 : -1.32, 6, delta);
      const speed = coolingMode === 1 ? 2.8 : coolingMode === 2 ? 5.2 : 0;
      for (let i = 0; i < fans.length; i++) fans[i].rotation.z += delta * speed * motionScale * (i ? -1 : 1);
      return Math.abs(previousDoor - doorAmount) > .00001 || Math.abs(previousLid - lidPivot.rotation.x) > .00001;
    },
  };
}
