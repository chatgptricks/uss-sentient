import * as THREE from 'three';
import { modulePolygon } from './layout.js';

/** Local, fictional flight instruments. Nothing contacts a Sentient service. */
export function addInteractiveDetails(ctx) {
  const { MODULES, materials: M, kit, mat, localBox, addMesh, texture, textPlane } = ctx;
  const devices = [], motions = [];
  const stats = { devices: 0, buttons: 0, movingAssemblies: 0, parts: 0, meshes: 0, textures: 0, lights: 0, colliders: 0, activations: 0 };
  const metal = mat({ color: 0x738c91, roughness: .34, metalness: .62 });
  const warm = mat({ color: 0xc29b61, roughness: .6, metalness: .17 });
  const teal = mat({ color: 0x72b9b6, emissive: 0x276e70, emissiveIntensity: .35, roughness: .38 });
  const violet = mat({ color: 0x9f99c7, emissive: 0x655a9f, emissiveIntensity: .3, roughness: .47 });
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const ring = new THREE.TorusGeometry(1, .035, 6, 32);
  const crystal = new THREE.OctahedronGeometry(1, 0);
  for (const geometry of [cube, sphere, ring, crystal]) ctx.resourceGeometries?.add(geometry);

  const specifications = {
    'front-door': { face: 5, offset: 0, title: 'EVA / OXYGEN CHECK', label: 'Run suit oxygen check', modes: ['SEALED', 'OXYGEN CHECK'], action: ['START CHECK', 'SEAL CIRCUIT'], color: '#a8d4d9', messages: ['Suit oxygen circuit sealed.', 'Suit check running. Oxygen is circulating through the test loop.'] },
    archive: { face: 2, offset: .12, title: 'ARCHIVE / DATA CORE', label: 'Query the archive core', modes: ['INDEX READY', 'QUERY RUNNING'], action: ['QUERY INDEX', 'PARK CORE'], color: '#aab9ef', messages: ['Archive core parked. Index retained locally.', 'Archive core spinning. Comparing the local evidence index.'] },
    floor: { face: 3, offset: 0, title: 'FLOOR / FABRICATION', label: 'Start fabrication arm', modes: ['TOOL PARKED', 'FABRICATING'], action: ['START TOOL', 'PARK TOOL'], color: '#e2b16d', messages: ['Fabrication tool parked.', 'Fabrication started. The toolhead is tracing a production part.'] },
    lab: { face: 3, offset: 0, title: 'LAB / SPECIMEN SCAN', label: 'Analyze contained specimen', modes: ['CONTAINED', 'ANALYZING'], action: ['ANALYZE', 'HOLD SAMPLE'], color: '#c8b9f0', messages: ['Specimen retained in its sealed capsule.', 'Analyzer engaged. The contained specimen is rotating through the scan field.'] },
    forum: { face: 3, offset: 0, title: 'FORUM / TACTICAL MODEL', label: 'Change tactical plan', modes: ['STATION OVERVIEW', 'PRODUCTION ROUTE', 'RESEARCH ROUTE'], action: ['PRODUCTION PLAN', 'RESEARCH PLAN', 'STATION OVERVIEW'], color: '#78cad8', messages: ['Tactical model reset to station overview.', 'Production strategy selected. The amber route is highlighted.', 'Research strategy selected. The violet route is highlighted.'] },
    commons: { face: 0, offset: 0, title: 'COMMONS / HYDROPONICS', label: 'Cycle hydroponics system', modes: ['REST CYCLE', 'IRRIGATION', 'GROW CYCLE'], action: ['IRRIGATE', 'GROW LIGHTS', 'REST CYCLE'], color: '#c2da80', messages: ['Hydroponics returned to its rest cycle.', 'Irrigation enabled. Nutrient solution is circulating through both racks.', 'Grow cycle enabled. Botanical light strips are energized.'] },
    bridge: { face: 2, offset: 0, title: 'BRIDGE / ORBITAL ARRAY', label: 'Cycle orbital tracker', modes: ['ATTITUDE HOLD', 'STELLAR TRACK', 'ORBIT MODEL'], action: ['TRACK STAR', 'ORBIT MODEL', 'ATTITUDE HOLD'], color: '#cfff04', messages: ['Orbital array returned to attitude hold.', 'Orbital array tracking Sol Sentient.', 'Orbital model running. Station position is shown around the lime star.'] },
  };

  function face(m, index, offset) {
    const polygon = modulePolygon(m), a = polygon[index], b = polygon[(index + 1) % 8];
    const yaw = -Math.atan2(b.z - a.z, b.x - a.x);
    return { origin: { x: (a.x + b.x) / 2 + offset * Math.cos(yaw), z: (a.z + b.z) / 2 - offset * Math.sin(yaw) }, yaw };
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const result = new THREE.Group(); result.position.set(x, y, z); parent.add(result); return result;
  }
  function mesh(parent, geometry, material, x, y, z, sx, sy = sx, sz = sx) {
    const result = addMesh(geometry, material, parent); result.position.set(x, y, z); result.scale.set(sx, sy, sz);
    stats.meshes++; return result;
  }
  function part(parent, x, y, z, w, h, d, material = M.graphite, yaw = 0) {
    kit.cuboid(x, y, z, w, h, d, material, yaw, parent); stats.parts++;
  }
  function pipe(parent, a, b, r, material = M.silver, sides = 8) {
    kit.pipe(a, b, r, material, sides, parent); stats.parts++;
  }
  function loop(parent, x, y, z, radius, material) {
    return mesh(parent, ring, material, x, y, z, radius);
  }

  function instrument(parent, id, indicator) {
    const head = group(parent, 0, 1.83, .52);
    stats.movingAssemblies++;
    if (id === 'front-door') {
      loop(head, 0, 0, 0, .205, metal);
      loop(head, 0, 0, .007, .167, M.graphite);
      const needle = group(head, 0, 0, .031);
      part(needle, 0, .074, 0, .018, .15, .018, M.accent);
      mesh(head, sphere, M.silver, 0, 0, .049, .025);
      for (const side of [-1, 1]) {
        pipe(head, [side * .32, -.20, -.035], [side * .32, .13, -.035], .045, M.enamel, 12);
        pipe(head, [side * .32, -.04, -.031], [side * .32, .035, -.031], .048, teal, 12);
        pipe(head, [side * .32, -.20, -.035], [side * .19, -.20, -.035], .017, metal);
      }
      return (time, dt, state) => { const target = state ? -.8 : 1.6; needle.rotation.z += (target - needle.rotation.z) * Math.min(1, dt * 1.4); };
    }
    if (id === 'archive') {
      const core = group(head);
      for (let i = 0; i < 5; i++) {
        pipe(core, [0, -.19 + i * .085, 0], [0, -.166 + i * .085, 0], .145, i % 2 ? metal : violet, 12);
        part(core, .125, -.179 + i * .085, 0, .058, .025, .035, M.accent);
      }
      pipe(head, [0, -.25, 0], [0, -.225, 0], .21, M.graphite, 16);
      pipe(head, [0, .225, 0], [0, .25, 0], .21, M.graphite, 16);
      for (const x of [-.25, .25]) pipe(head, [x, -.25, 0], [x, .25, 0], .016, metal);
      return (time, dt, state) => { if (state) core.rotation.y += dt * 1.25; };
    }
    if (id === 'floor') {
      for (const x of [-.29, .29]) pipe(head, [x, -.24, 0], [x, .20, 0], .024, metal);
      for (const y of [-.24, .20]) part(head, 0, y, 0, .66, .038, .12, M.enamel);
      const carriage = group(head, 0, .1, .024);
      part(carriage, 0, 0, 0, .35, .08, .13, warm);
      const wrist = group(carriage, 0, -.10, .023);
      pipe(wrist, [0, .065, 0], [0, -.03, 0], .058, M.graphite, 12);
      for (const side of [-1, 1]) {
        part(wrist, side * .052, -.067, 0, .021, .11, .045, metal);
        part(wrist, side * .036, -.117, 0, .050, .023, .047, M.graphite);
      }
      part(head, 0, -.212, .075, .27, .024, .20, M.silver);
      const tool = mesh(wrist, sphere, indicator, 0, -.139, .007, .021);
      tool.visible = false;
      return (time, dt, state) => {
        tool.visible = !!state;
        const x = state ? Math.sin(time * 1.35) * .17 : 0, y = state ? .06 + Math.sin(time * 2.7) * .033 : .13;
        carriage.position.x += (x - carriage.position.x) * Math.min(1, dt * 7);
        carriage.position.y += (y - carriage.position.y) * Math.min(1, dt * 7);
        wrist.rotation.y = state ? Math.sin(time * .8) * .4 : 0;
      };
    }
    if (id === 'lab') {
      const specimen = group(head);
      const sample = mesh(specimen, crystal, violet, 0, 0, .015, .115, .20, .10); sample.rotation.z = .3;
      for (const y of [-.26, .26]) pipe(head, [0, y - .018, 0], [0, y + .018, 0], .19, M.enamel, 16);
      for (const x of [-.19, .19]) pipe(head, [x, -.24, 0], [x, .24, 0], .014, metal);
      const scan = group(head);
      const scanRing = loop(scan, 0, 0, 0, .166, indicator); scanRing.rotation.x = Math.PI / 2;
      const clear = mat({ color: 0x9cc9d0, transparent: true, opacity: .11, roughness: .17, depthWrite: false });
      const capsule = mesh(head, new THREE.CylinderGeometry(.177, .177, .46, 16, 1, true), clear, 0, 0, 0, 1);
      capsule.castShadow = false; capsule.userData.excludeFromAO = true;
      return (time, dt, state) => { if (state) specimen.rotation.y += dt * .8; scan.position.y = state ? Math.sin(time * 1.4) * .18 : -.19; };
    }
    if (id === 'forum') {
      const model = group(head);
      const nodes = [[0, -.18], [0, -.075], [-.23, -.075], [-.23, .085], [0, .085], [.23, .085], [0, .235]];
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 4], [1, 4], [4, 5], [4, 6]]) pipe(model, [nodes[a][0], nodes[a][1], 0], [nodes[b][0], nodes[b][1], 0], .009, teal);
      const marks = nodes.map(([x, y], i) => mesh(model, cube, i === 4 ? M.accent : metal, x, y, .006, .053, .044, .028));
      loop(head, 0, .018, -.04, .29, M.graphite);
      return (time, dt, state) => {
        const yaw = state ? Math.sin(time * .6) * .42 : 0;
        model.rotation.y += (yaw - model.rotation.y) * Math.min(1, dt * 4);
        marks.forEach((mark, i) => { mark.material = state === 1 && [0, 1, 2].includes(i) ? warm : state === 2 && [1, 3, 4].includes(i) ? violet : i === 4 ? M.accent : metal; });
      };
    }
    if (id === 'commons') {
      loop(head, 0, 0, 0, .192, metal);
      const valve = group(head);
      for (let i = 0; i < 4; i++) { const angle = i * Math.PI / 2; pipe(valve, [0, 0, 0], [Math.sin(angle) * .17, Math.cos(angle) * .17, 0], .016, teal); }
      mesh(valve, sphere, M.enamel, 0, 0, .016, .041);
      for (const x of [-.32, .32]) {
        part(head, x, 0, -.02, .07, .39, .07, M.graphite);
        for (let i = 0; i < 5; i++) part(head, x, -.14 + i * .07, .018, .039, .036, .012, i > 1 ? M.accent : metal);
      }
      return (time, dt, state) => { if (state === 1) valve.rotation.z += dt * 1.45; };
    }
    const orbit = group(head);
    for (const [radius, tilt] of [[.14, .5], [.245, -.4]]) { const track = loop(orbit, 0, 0, 0, radius, metal); track.rotation.x = tilt; }
    mesh(head, sphere, M.accent, 0, 0, 0, .060);
    const satellite = mesh(orbit, cube, M.enamel, .24, 0, 0, .045, .027, .035);
    part(head, 0, -.28, -.055, .65, .06, .18, M.graphite);
    return (time, dt, state) => {
      if (state === 2) orbit.rotation.z += dt * .42;
      const target = state === 1 ? .36 : 0;
      orbit.rotation.y += (target - orbit.rotation.y) * Math.min(1, dt * 3);
      satellite.material = state ? M.accent : M.enamel;
    };
  }

  for (const module of MODULES) {
    const spec = specifications[module.id]; if (!spec) continue;
    const parent = ctx.beginModule(module), surface = face(module, spec.face, spec.offset);
    const pod = group(parent, surface.origin.x, 0, surface.origin.z); pod.rotation.y = surface.yaw;
    pod.name = `Operable ${spec.title}`;
    const indicator = mat({ color: 0x65827e, emissive: 0x3d6f69, emissiveIntensity: .20, roughness: .38 });
    // A slim accessory panel bolts onto the existing wall equipment. Its entire
    // mechanism is above counter height and within the occupied service strip.
    for (const [x, y, w, h, z, d, material] of [
      [0, 1.46, 1.05, 1.28, .37, .08, M.graphite],
      [0, 1.46, .99, 1.20, .416, .026, M.enamel],
      [0, 1.83, .77, .57, .44, .035, M.seal],
      [0, 1.19, .91, .46, .45, .035, M.seal],
      [0, .876, .76, .08, .449, .05, M.graphite],
    ]) { localBox(surface.origin, surface.yaw, x, y, z, w, h, d, material); stats.parts++; }
    for (const x of [-.46, .46]) for (const y of [.90, 2.02]) {
      kit.localBolt(surface.origin, surface.yaw, x, y, .443, M.silver, .015); stats.parts++;
    }
    for (let i = 0; i < 8; i++) part(pod, -.30 + i * .086, .876, .480, .031, .013, .012, i === 7 ? indicator : metal);
    for (const x of [-.40, .40]) pipe(pod, [x, .93, .32], [x, 2.03, .32], .012, M.seal);
    let mode = 0, activationCount = 0;
    const draw = (g, w, h) => {
      const color = spec.color;
      g.fillStyle = '#07151b'; g.fillRect(0, 0, w, h);
      g.fillStyle = color; g.fillRect(0, 0, 7, h);
      g.font = '500 21px Space, Arial'; g.fillText(spec.title, 22, 34, w - 44);
      g.fillStyle = '#e7eee1'; g.font = '500 31px Space, Arial'; g.fillText(spec.modes[mode], 22, 92, w - 44);
      g.fillStyle = '#628486'; for (let i = 0; i < 21; i++) g.fillRect(24 + i * 22, 113, 14, 5);
      g.fillStyle = mode ? color : '#668f91';
      for (let i = 0; i < (mode ? 19 : 5); i++) g.fillRect(24 + i * 22, 113, 14, 5);
      g.fillStyle = '#173235'; g.fillRect(20, 141, w - 40, 70);
      g.strokeStyle = color; g.lineWidth = 2; g.strokeRect(20, 141, w - 40, 70);
      g.fillStyle = color; g.font = '500 28px Space, Arial'; g.fillText(`▶  ${spec.action[mode]}`, 36, 185, w - 72);
      g.fillStyle = '#8ba8a6'; g.font = '400 14px Space, Arial'; g.fillText('E / CLICK  ·  LOCAL STATION CONTROL', 23, 236, w - 46);
    };
    const map = texture(512, 256, draw); map.userData.emissiveDisplay = true; stats.textures++;
    const at = kit.toWorld(surface.origin, surface.yaw, [0, 1.19, .474]);
    const screen = textPlane(map, .87, .435, ...at, surface.yaw);
    screen.name = `Interactive screen / ${module.id}`;
    screen.userData.interactiveDeviceId = `station-${module.id}`;
    stats.meshes++; stats.buttons++;
    const animate = instrument(pod, module.id, indicator);
    let growMaterial;
    if (module.id === 'commons') {
      growMaterial = mat({ color: 0x879c89, emissive: 0x87b9a5, emissiveIntensity: .12, roughness: .4 });
      for (const x of [-1.63, 1.63]) {
        part(pod, x, 2.32, .79, .98, .022, .035, growMaterial);
        pipe(pod, [x, .27, .20], [Math.sign(x) * .42, .27, .20], .016, teal);
      }
    }
    const device = {
      id: `station-${module.id}`, roomId: module.id, label: spec.label,
      x: at[0], y: at[1] + module.elevation, z: at[2], range: 1.7, mesh: screen,
      get state() { return { mode: spec.modes[mode], index: mode, active: mode !== 0, activations: activationCount }; },
      activate() {
        mode = (mode + 1) % spec.modes.length; activationCount++; stats.activations++;
        indicator.color.set(mode ? spec.color : '#65827e');
        indicator.emissive.copy(indicator.color); indicator.emissiveIntensity = mode ? .65 : .20;
        if (growMaterial) {
          growMaterial.color.set(mode === 2 ? '#cfebac' : mode === 1 ? '#81c9d1' : '#879c89');
          growMaterial.emissive.copy(growMaterial.color); growMaterial.emissiveIntensity = mode === 2 ? 2.4 : mode === 1 ? .65 : .12;
        }
        draw(map.image.getContext('2d'), 512, 256); map.needsUpdate = true;
        animate(0, 0, mode);
        return spec.messages[mode];
      },
    };
    devices.push(device); motions.push((time, dt) => animate(time, dt, mode)); stats.devices++;
    ctx.endSection();
  }
  return {
    devices, stats,
    update(time, dt = 1 / 60) {
      const step = Math.min(.05, Math.max(0, dt));
      for (const move of motions) move(time, step);
    },
  };
}
