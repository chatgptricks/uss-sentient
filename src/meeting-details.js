import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Six-place Forum conference furniture, entirely within the enlarged SE bay. */
export function addMeetingDetails(ctx) {
  const { MODULES, materials: M, kit, mat, texture, addMesh, colliders } = ctx;
  const module = MODULES.find(item => item.id === 'forum');
  const stats = { tables: 0, chairs: 0, chairComponents: 0, embeddedScreens: 0, briefingDisplays: 0,
    tablets: 0, cups: 0, documents: 0, pens: 0, restraints: 0, fixtures: 0, devices: 0,
    parts: 0, meshes: 0, colliders: 0, lights: 0, activations: 0, mode: 'STATION BRIEFING' };
  if (!module) return { stats, devices: [], update() {} };
  const parent = ctx.beginModule(module);
  const yaw = Math.PI / 4, origin = { x: 2.775 + 3.9 / Math.sqrt(2), z: -20.075 + 3.9 / Math.sqrt(2) };
  const assembly = new THREE.Group(); assembly.name = 'Forum / six-seat conference suite';
  assembly.position.set(origin.x, 0, origin.z); assembly.rotation.y = yaw; parent.add(assembly);
  const merged = new Map(), sourceGeometries = new Map();
  const transform = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const fabric = mat({ color: 0x6c7973, roughness: .94, metalness: .015, bumpMap: M.padding.bumpMap || null, bumpScale: .002 });
  const ceramic = mat({ color: 0xcdd2c7, roughness: .34, metalness: .20 });
  const status = mat({ color: 0xcfff04, emissive: 0xcfff04, emissiveIntensity: .48, roughness: .44 });

  function cached(key, make) { if (!sourceGeometries.has(key)) sourceGeometries.set(key, make()); return sourceGeometries.get(key); }
  function roundedShape(w, h, radius) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2, r = Math.min(radius, w / 2, h / 2);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  function rounded(w, h, d, r = .045, bevel = .008) {
    return cached(`round:${w}:${h}:${d}:${r}:${bevel}`, () => {
      const geometry = new THREE.ExtrudeGeometry(roundedShape(w - bevel * 2, h - bevel * 2, r),
        { depth: d - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 5, steps: 1 });
      return geometry.translate(0, 0, -(d - bevel * 2) / 2);
    });
  }
  function plate(w, d, h, r = .15) {
    return cached(`plate:${w}:${d}:${h}:${r}`, () => rounded(w, d, h, r, Math.min(.015, h / 4)).clone().rotateX(-Math.PI / 2));
  }
  function shaped(geometry, material, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    let copy = geometry.clone();
    if (copy.index) { const indexed = copy; copy = copy.toNonIndexed(); indexed.dispose(); }
    rotation.setFromEuler(new THREE.Euler(rx, ry, rz));
    transform.compose(new THREE.Vector3(x, y, z), rotation, new THREE.Vector3(sx, sy, sz)); copy.applyMatrix4(transform);
    if (!merged.has(material)) merged.set(material, []); merged.get(material).push(copy); stats.parts++;
  }
  function box(x, y, z, w, h, d, material = M.graphite, ry = 0) { kit.cuboid(x, y, z, w, h, d, material, ry, assembly); stats.parts++; }
  function pipe(a, b, radius, material = M.silver, sides = 12) { kit.pipe(a, b, radius, material, sides, assembly); stats.parts++; }
  function world(x, y, z) { return [origin.x + x * Math.cos(yaw) + z * Math.sin(yaw), y + module.elevation, origin.z - x * Math.sin(yaw) + z * Math.cos(yaw)]; }
  function screen(map, width, height, x, y, z, rx = 0, ry = 0, rz = 0, material) {
    const surface = material || mat({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: .44, color: 0xffffff, roughness: .39, metalness: .07 });
    const mesh = addMesh(new THREE.PlaneGeometry(width, height), surface, assembly);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.castShadow = false; mesh.userData.excludeFromAO = true; stats.meshes++;
    return mesh;
  }
  // Tiled bounds follow the real rotated footprint. A single broad AABB would
  // incorrectly close both side aisles in this diagonal room.
  function footprint(id, x, z, width, depth, columns, rows = 1, angle = 0) {
    const fullYaw = yaw + angle, c = Math.abs(Math.cos(fullYaw)), s = Math.abs(Math.sin(fullYaw));
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const w = width / columns, d = depth / rows;
      const u = -width / 2 + w * (column + .5), v = -depth / 2 + d * (row + .5);
      const [px, , pz] = world(x + u * Math.cos(angle) + v * Math.sin(angle), 0, z - u * Math.sin(angle) + v * Math.cos(angle));
      colliders.push({ id: `meeting-${id}-${row}-${column}`, x: px, z: pz, w: w * c + d * s + .006, d: w * s + d * c + .006 });
      stats.colliders++;
    }
  }

  // Layered ceramic/composite table with a rolled edge, dark inlay, undercut
  // structural skirt and two shaped pedestals. The outline is rounded throughout.
  shaped(plate(2.90, .96, .105, .22), M.enamel, 0, .805, 0);
  shaped(plate(2.81, .895, .029, .19), ceramic, 0, .871, 0);
  shaped(plate(2.64, .815, .018, .15), M.graphite, 0, .890, 0);
  shaped(plate(2.71, .77, .105, .17), M.seal, 0, .733, 0);
  for (const side of [-1, 1]) {
    const x = side * .79;
    shaped(plate(.58, .53, .052, .095), M.silver, x, .054, 0);
    shaped(rounded(.40, .55, .35, .095, .018), M.graphite, x, .362, 0);
    shaped(rounded(.31, .46, .367, .065, .014), M.enamel, x, .36, 0);
    for (const z of [-.193, .193]) {
      box(x, .33, z, .12, .30, .016, M.seal);
      for (let vent = 0; vent < 5; vent++) box(x, .235 + vent * .047, z * 1.025, .108, .012, .009, M.silver);
    }
    pipe([x - .20, .075, -.17], [x + .20, .075, -.17], .012, M.seal, 8);
  }
  for (const z of [-.36, .36]) {
    pipe([-1.27, .725, z], [1.27, .725, z], .024, M.silver, 12);
    for (const x of [-.94, 0, .94]) box(x, .726, z, .072, .063, .071, M.graphite);
  }
  box(0, .668, 0, 1.31, .066, .23, M.seal);
  for (let port = 0; port < 6; port++) {
    box(-.45 + port * .18, .675, -.133, .072, .027, .013, M.silver);
    box(-.45 + port * .18, .675, -.144, .045, .013, .01, M.seal);
  }
  footprint('table', 0, 0, 2.92, .98, 8, 3); stats.tables++;

  const chairCenters = [];
  function chair(x, z, angle, number) {
    const transformPoint = ([u, y, v]) => [x + u * Math.cos(angle) + v * Math.sin(angle), y, z - u * Math.sin(angle) + v * Math.cos(angle)];
    const C = (u, y, v, w, h, d, material = M.graphite) => { box(...transformPoint([u, y, v]), w, h, d, material, angle); stats.chairComponents++; };
    const CP = (a, b, radius, material = M.silver, sides = 12) => { pipe(transformPoint(a), transformPoint(b), radius, material, sides); stats.chairComponents++; };
    const CS = (geometry, material, u, y, v, rx = 0, rz = 0) => {
      // Parent yaw is applied after the cushion/back's local tilt.
      let copy = geometry.clone(); copy.rotateX(rx); copy.rotateZ(rz);
      shaped(copy, material, ...transformPoint([u, y, v]), 0, angle); copy.dispose(); stats.chairComponents++;
    };
    CS(plate(.635, .575, .11, .11), M.enamel, 0, .444, 0);
    CS(plate(.548, .50, .10, .12), fabric, 0, .528, -.013);
    for (const side of [-1, 1]) {
      CS(plate(.085, .425, .067, .035), M.padding, side * .235, .574, -.012);
      CS(rounded(.081, .43, .046, .023), M.padding, side * .201, .90, -.127, .10);
    }
    CS(rounded(.596, .677, .111, .10, .012), M.graphite, 0, .937, -.222, .10);
    CS(rounded(.495, .553, .080, .094, .012), fabric, 0, .935, -.151, .10);
    CS(rounded(.387, .167, .115, .055, .01), M.padding, 0, 1.257, -.235, .10);
    C(0, .806, -.308, .33, .070, .031, M.enamel);
    C(0, .972, -.308, .265, .15, .017, M.enamel);
    for (let vent = 0; vent < 4; vent++) C(-.078 + vent * .052, .975, -.32, .018, .099, .011, M.seal);
    CP([0, .112, 0], [0, .394, 0], .089, M.silver, 16);
    CP([0, .265, 0], [0, .36, 0], .102, M.graphite, 16);
    for (let spoke = 0; spoke < 5; spoke++) {
      const a = spoke * Math.PI * 2 / 5, sx = Math.sin(a) * .24, sz = Math.cos(a) * .24;
      CP([0, .111, 0], [sx, .066, sz], .027, M.silver, 10);
      C(sx, .038, sz, .069, .055, .086, M.seal);
      CP([sx, .023, sz], [sx, .04, sz], .048, M.graphite, 12);
    }
    for (const side of [-1, 1]) {
      CP([side * .265, .445, -.14], [side * .288, .697, -.12], .025);
      CP([side * .286, .676, -.16], [side * .286, .676, .15], .026, M.graphite);
      CS(plate(.09, .357, .065, .036), fabric, side * .285, .713, -.015);
      // Webbing rests against the cushions; metal keepers hold loose ends.
      C(side * .130, .589, .015, .042, .011, .294, M.seal);
      C(side * .135, .965, -.100, .043, .31, .012, M.seal);
      C(side * .132, .589, .053, .068, .024, .056, M.silver);
      stats.restraints++;
    }
    CP([-.19, .202, .08], [-.19, .173, .273], .019);
    CP([.19, .202, .08], [.19, .173, .273], .019);
    CP([-.205, .173, .273], [.205, .173, .273], .021, M.graphite);
    for (let groove = 0; groove < 5; groove++) C(-.12 + groove * .06, .19, .272, .008, .007, .034, M.silver);
    C(.283, .575, -.142, .042, .083, .055, M.enamel);
    C(.308, .598, -.142, .01, .029, .027, number === 1 ? status : M.silver);
    footprint(`chair-${number}`, x, z, .68, .70, 3, 1, angle);
    chairCenters.push({ number, ...Object.fromEntries(['x', 'y', 'z'].map((key, i) => [key, world(x, .52, z)[i]])), yaw: yaw + angle });
    stats.chairs++;
  }
  let chairNumber = 0;
  for (const side of [-1, 1]) for (const x of [-.90, 0, .90]) chair(x, side * .79, side < 0 ? 0 : Math.PI, ++chairNumber);

  // Suspended conference lighting: visible diffusers and louvers, no extra lights.
  function ringPlate(w, d, thickness) {
    const shape = roundedShape(w, d, .20), holeShape = roundedShape(w - .17, d - .17, .135);
    const hole = new THREE.Path(holeShape.getPoints(18)); shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 2, curveSegments: 6 })
      .translate(0, 0, -thickness / 2).rotateX(-Math.PI / 2);
  }
  const housing = ringPlate(2.31, .98, .078), diffuser = ringPlate(2.24, .91, .015);
  shaped(housing, M.enamel, 0, 2.49, 0); shaped(diffuser, M.whiteLight, 0, 2.439, 0); housing.dispose(); diffuser.dispose();
  for (const x of [-.93, .93]) for (const z of [-.30, .30]) {
    pipe([x, 2.535, z], [x, 2.91, z], .014, M.silver, 10);
    box(x, 2.90, z, .094, .056, .09, M.graphite);
  }
  for (let fin = 0; fin < 11; fin++) for (const side of [-1, 1]) box(-.97 + fin * .194, 2.423, side * .417, .016, .031, .075, M.silver);
  // Keep the centre aperture clear for the shared ceiling light at y=2.67.
  box(.70, 2.493, 0, .28, .068, .12, M.graphite); stats.fixtures++;

  const modes = [
    { title: 'STATION BRIEFING', short: 'OVERVIEW', color: '#cfff04', note: 'Seven departments. One connected station.', next: 'PRODUCTION PLAN' },
    { title: 'PRODUCTION PLAN', short: 'PRODUCTION', color: '#e8b66f', note: 'Source → create → review → publish.', next: 'RESEARCH REVIEW' },
    { title: 'RESEARCH REVIEW', short: 'RESEARCH', color: '#93d8ed', note: 'Collect → analyze → compare → learn.', next: 'STATION BRIEFING' },
  ];
  let mode = 0, activations = 0, press = 0, disposed = false;
  function paintBriefing(g, w, h) {
    const selected = modes[mode];
    g.fillStyle = '#0a171c'; g.fillRect(0, 0, w, h);
    g.fillStyle = selected.color; g.fillRect(30, 29, 89, 6);
    g.font = '500 44px Space, Arial'; g.fillStyle = '#eef1e3'; g.fillText(selected.title, 31, 91, w - 62);
    g.font = '400 21px Space, Arial'; g.fillStyle = '#94adae'; g.fillText('USS SENTIENT / FORUM / MISSION CONFERENCE', 33, 129);
    g.strokeStyle = '#28444b'; g.lineWidth = 1;
    for (let x = 36; x < w - 30; x += 45) { g.beginPath(); g.moveTo(x, 160); g.lineTo(x, h - 88); g.stroke(); }
    for (let y = 169; y < h - 74; y += 45) { g.beginPath(); g.moveTo(33, y); g.lineTo(w - 33, y); g.stroke(); }
    const nodes = [[190, 424], [340, 338], [184, 255], [417, 205], [579, 321], [772, 412], [920, 228]];
    const paths = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 4], [4, 5], [4, 6]];
    paths.forEach(([a, b], index) => {
      g.strokeStyle = mode === 0 || (mode === 1 ? [0, 1, 4, 6] : [2, 3, 4, 5]).includes(index) ? selected.color : '#354e57';
      g.lineWidth = 6; g.beginPath(); g.moveTo(...nodes[a]); g.lineTo(...nodes[b]); g.stroke();
    });
    nodes.forEach(([x, y], index) => {
      g.fillStyle = index === 4 ? selected.color : '#1d3941'; g.fillRect(x - 39, y - 28, 78, 56);
      g.strokeStyle = '#bdcfce'; g.lineWidth = 2; g.strokeRect(x - 39, y - 28, 78, 56);
      g.fillStyle = index === 4 ? '#16231f' : '#e2eade'; g.font = '500 28px Space, Arial'; g.fillText(['01', '03', '02', '06', '05', '04', '07'][index], x - 18, y + 10);
    });
    g.fillStyle = '#13282d'; g.fillRect(28, h - 109, w - 56, 74);
    g.fillStyle = selected.color; g.font = '500 28px Space, Arial'; g.fillText(selected.note, 46, h - 64, w - 92);
    g.font = '400 15px Space, Arial'; g.fillStyle = '#9ab3b1'; g.fillText(`BRIEFING ${String(activations + 1).padStart(2, '0')}  /  SIX PLACES CONNECTED  /  LOCAL SIMULATION`, 33, h - 13);
  }
  function paintConference(g, w, h) {
    const selected = modes[mode]; g.fillStyle = '#08171c'; g.fillRect(0, 0, w, h);
    g.fillStyle = selected.color; g.fillRect(17, 17, 8, h - 34);
    g.font = '500 40px Space, Arial'; g.fillText(selected.short, 47, 68, w - 80);
    g.fillStyle = '#a2b9b5'; g.font = '400 22px Space, Arial'; g.fillText('FORUM / SHARED PRESENTATION', 49, 103);
    for (let i = 0; i < 11; i++) {
      const height = 21 + ((i * 3 + mode * 5) % 8) * 11;
      g.fillStyle = i % 4 === mode ? selected.color : '#3a6971'; g.fillRect(51 + i * 58, h - 39 - height, 37, height);
    }
    g.fillStyle = '#92aead'; g.font = '400 16px Space, Arial'; g.fillText('LINK ACTIVE', 49, h - 14);
  }
  function paintControl(g, w, h) {
    const selected = modes[mode]; g.fillStyle = '#0a171c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8daeb2'; g.font = '500 26px Space, Arial'; g.fillText('MEETING / PRESENTATION', 24, 39, w - 48);
    g.fillStyle = '#edf0df'; g.font = '500 37px Space, Arial'; g.fillText(selected.short, 24, 109, w - 48);
    g.fillStyle = '#21393e'; g.fillRect(22, 144, w - 44, 93);
    g.strokeStyle = selected.color; g.lineWidth = 3; g.strokeRect(22, 144, w - 44, 93);
    g.fillStyle = selected.color; g.font = '500 25px Space, Arial'; g.fillText('NEXT BRIEFING  →', 39, 185, w - 78);
    g.font = '400 18px Space, Arial'; g.fillText(selected.next, 40, 216, w - 80);
    g.fillStyle = '#9cb1ac'; g.font = '400 18px Space, Arial'; g.fillText('E / CLICK TO PRESENT', 26, 277, w - 52);
  }
  const briefingMap = texture(1152, 648, paintBriefing), conferenceMap = texture(768, 288, paintConference), controlMap = texture(512, 320, paintControl);
  const presentationMaterial = mat({ map: briefingMap, emissiveMap: briefingMap, emissive: 0xffffff, emissiveIntensity: .57, roughness: .39, metalness: .06 });
  const conferenceMaterial = mat({ map: conferenceMap, emissiveMap: conferenceMap, emissive: 0xffffff, emissiveIntensity: .40, roughness: .34, metalness: .11 });
  for (const side of [-1, 1]) for (const x of [-.89, 0, .89]) {
    shaped(plate(.68, .25, .014, .032), M.enamel, x, .903, side * .232);
    screen(conferenceMap, .63, .219, x, .913, side * .232, -Math.PI / 2, 0, side < 0 ? 0 : Math.PI, conferenceMaterial);
    for (let indicator = 0; indicator < 3; indicator++) box(x - .035 + indicator * .035, .919, side * .352, .011, .004, .008, indicator === mode ? status : M.silver);
    stats.embeddedScreens++;
  }

  // The main display floats above the outer row's headrests. Its fine collision
  // strips overlap that occupied row and preserve the outer return walkway.
  shaped(rounded(1.99, 1.075, .13, .071, .014), M.enamel, 0, 1.96, .984);
  shaped(rounded(1.885, 1.035, .044, .047), M.seal, 0, 1.96, .900);
  screen(briefingMap, 1.80, 1.013, 0, 1.96, .873, 0, Math.PI, 0, presentationMaterial);
  for (const x of [-.76, .76]) {
    pipe([x, 2.43, 1.013], [x, 2.88, 1.013], .020, M.silver);
    box(x, 2.84, 1.013, .126, .16, .12, M.graphite);
    box(x, 1.48, .881, .054, .031, .017, status);
  }
  box(0, 1.391, .936, .37, .031, .032, M.graphite);
  for (let mic = 0; mic < 5; mic++) box(-.086 + mic * .043, 1.391, .911, .012, .010, .009, M.silver);
  footprint('briefing-display', 0, .984, 2.01, .15, 7); stats.briefingDisplays++;

  const control = new THREE.Group(); control.name = 'Operable meeting briefing controller';
  control.position.set(1.235, 1.015, 0);
  const normal = new THREE.Vector3(.56, .828492607, 0).normalize(), right = new THREE.Vector3(0, 0, -1), up = new THREE.Vector3().crossVectors(normal, right).normalize();
  control.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal)); assembly.add(control);
  const controlCase = addMesh(rounded(.45, .318, .045, .037).clone(), M.graphite, control); stats.meshes++;
  const controlMaterial = mat({ map: controlMap, emissiveMap: controlMap, emissive: 0xffffff, emissiveIntensity: .60, roughness: .30, metalness: .04 });
  const controlScreen = addMesh(new THREE.PlaneGeometry(.408, .255), controlMaterial, control);
  controlScreen.position.set(0, .014, .024); controlScreen.castShadow = false; controlScreen.userData.excludeFromAO = true;
  controlScreen.userData.interactiveDeviceId = 'meeting-briefing'; stats.meshes++;
  const button = addMesh(new THREE.CylinderGeometry(.020, .022, .010, 20), status, control);
  button.rotation.x = Math.PI / 2; button.position.set(.151, -.137, .030); stats.meshes++;
  const buttonRim = addMesh(new THREE.TorusGeometry(.026, .004, 6, 24), M.silver, control); buttonRim.position.set(.151, -.137, .025); stats.meshes++;

  // Secured items retain the realism of a working conference area: tablets in
  // shallow docks, paper under clips, pens tethered beside notes, lidded mugs.
  const propsMap = texture(1024, 512, (g, w, h) => {
    g.fillStyle = '#d6d8c7'; g.fillRect(0, 0, w, h);
    for (let page = 0; page < 2; page++) {
      const x = page * 512; g.fillStyle = '#1e363c'; g.font = '500 34px Space, Arial'; g.fillText(page ? 'ACTION NOTES' : 'MISSION 05', x + 32, 52);
      g.fillStyle = '#697967'; g.font = '400 20px Space, Arial'; g.fillText('SENTIENT / FLIGHT CONFERENCE', x + 33, 88);
      for (let line = 0; line < 9; line++) { g.fillStyle = '#6a7b75'; g.fillRect(x + 36, 122 + line * 36, 19, 17); g.fillRect(x + 73, 126 + line * 36, 348 - line % 4 * 46, 5); }
      g.strokeStyle = '#8b986c'; g.lineWidth = 2; g.strokeRect(x + 27, 453, 457, 34); g.font = '400 15px Space, Arial'; g.fillText('LOCAL BRIEF / CREW COPY / 07:24', x + 38, 477);
    }
  });
  const paper = mat({ map: propsMap, color: 0xffffff, roughness: .96, metalness: 0 });
  function document(x, z, angle, half) {
    shaped(plate(.225, .165, .007, .009), M.enamel, x, .921, z, 0, angle);
    const geometry = new THREE.PlaneGeometry(.207, .149), uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, (half + uv.getX(i)) / 2);
    const sheet = addMesh(geometry, paper, assembly); sheet.position.set(x, .926, z); sheet.rotation.set(-Math.PI / 2, 0, angle); sheet.castShadow = false; stats.meshes++;
    box(x, .933, z - .065, .052, .012, .024, M.silver, angle);
    pipe([x + .145, .929, z - .074], [x + .146, .929, z + .065], .0045, M.silver, 8);
    pipe([x + .146, .929, z + .065], [x + .146, .929, z + .083], .003, M.seal, 8);
    stats.documents++; stats.pens++;
  }
  document(-1.035, .037, .07, 0); document(.23, -.014, -.08, 1); document(-.38, .007, -.10, 0);
  for (const [x, z, angle] of [[.73, .012, .075], [-.65, .047, -.11]]) {
    shaped(plate(.325, .183, .016, .024), M.seal, x, .926, z, 0, angle);
    screen(conferenceMap, .285, .146, x, .936, z, -Math.PI / 2, 0, angle, conferenceMaterial);
    stats.tablets++;
  }
  const cupGeometry = cached('cup', () => new THREE.CylinderGeometry(.041, .034, .096, 20, 1, true));
  const lidGeometry = cached('lid', () => new THREE.CylinderGeometry(.043, .042, .013, 20));
  const handleGeometry = cached('handle', () => new THREE.TorusGeometry(.029, .0065, 6, 18));
  for (const [x, z] of [[-1.25, -.286], [.42, .29], [1.33, .288]]) {
    shaped(cupGeometry, M.enamel, x, .959, z); shaped(lidGeometry, M.seal, x, 1.015, z);
    shaped(handleGeometry, M.enamel, x + .049, .963, z);
    pipe([x, .907, z], [x, .918, z], .046, M.silver, 16);
    box(x + .013, 1.023, z, .019, .004, .008, M.graphite); stats.cups++;
  }
  // Flush conferencing microphones rise just enough to read as real hardware.
  for (const x of [-1.18, .98]) {
    pipe([x, .914, 0], [x, .952, 0], .027, M.seal, 12);
    pipe([x, .946, 0], [x + .028, 1.030, 0], .0045, M.silver, 8);
    pipe([x + .028, 1.026, 0], [x + .045, 1.038, 0], .010, M.graphite, 10);
  }

  for (const [material, list] of merged) {
    const geometry = mergeGeometries(list, false);
    if (!geometry) throw new Error('Meeting geometry could not be merged');
    addMesh(geometry, material, assembly); stats.meshes++;
    list.forEach(item => item.dispose());
  }
  sourceGeometries.forEach(geometry => geometry.dispose());
  const controlAt = world(control.position.x, control.position.y, control.position.z);
  const device = {
    id: 'meeting-briefing', roomId: 'forum', label: 'Cycle conference briefing',
    x: controlAt[0], y: controlAt[1], z: controlAt[2], range: 1.75, mesh: control,
    approach: { x: world(2.10, 0, 0)[0], z: world(2.10, 0, 0)[2], yaw: Math.PI * .75, pitch: -.55 },
    get state() { return { mode: modes[mode].title, index: mode, active: mode !== 0, activations, presentationVersion: briefingMap.version }; },
    activate() {
      if (disposed) return 'The conference system is offline.';
      mode = (mode + 1) % modes.length; activations++; stats.activations = activations; stats.mode = modes[mode].title; press = 1;
      status.color.set(modes[mode].color); status.emissive.copy(status.color);
      for (const [map, painter, w, h] of [[briefingMap, paintBriefing, 1152, 648], [conferenceMap, paintConference, 768, 288], [controlMap, paintControl, 512, 320]]) {
        painter(map.image.getContext('2d'), w, h); map.needsUpdate = true;
      }
      return `${modes[mode].title.toLowerCase().replace(/^./, value => value.toUpperCase())} presented. All six conference screens are synchronized.`;
    },
  };
  stats.devices = 1;
  const approach = world(2.10, 1.6, 0), overview = world(0, 1.6, -2.05);
  stats.layout = { center: { x: origin.x, z: origin.z }, yaw, table: { width: 2.90, depth: .96, top: .913 }, chairs: chairCenters,
    consoleApproach: { x: approach[0], y: approach[1], z: approach[2], yaw: Math.PI * .75, pitch: -.55 },
    overview: { x: overview[0], y: overview[1], z: overview[2], yaw: -Math.PI * .75, pitch: -.08 } };
  ctx.endSection();
  return {
    stats, devices: [device],
    update(time, dt = 1 / 60) { if (disposed) return; press = Math.max(0, press - Math.max(0, Math.min(.10, dt)) * 5); button.position.z = .030 - Math.sin(press * Math.PI) * .006; },
    dispose() { disposed = true; }, // Shared materials/textures/geometry belong to world disposal.
  };
}
