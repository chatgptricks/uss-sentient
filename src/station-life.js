import * as THREE from 'three';
import { moduleAt } from './layout.js';

// Station clock: one 24-hour day passes every 12 real minutes, starting 07:00.
export const DAY_SECONDS = 720;
const START_HOUR = 7;

/** Named Pelagia sites in the planet's own frame (pole on local Z). */
export const PELAGIA_FEATURES = [
  { id: 'copper-terraces', name: 'Copper Terraces', note: 'Stepped mineral shelves, kilometres wide, catching the low sun.', lat: -12, lon: 96 },
  { id: 'luminous-rift', name: 'Luminous Rift', note: 'A fault system whose deepest basins fluoresce through the night.', lat: -4, lon: 152 },
  { id: 'glass-craters', name: 'Glass Crater Field', note: 'Impact scars with fused, glassy floors and bright ejecta rays.', lat: -20, lon: 214 },
  { id: 'sulfur-storm', name: 'Sulfur Storm', note: 'A slow cyclone of sulfur and pearl haze over the plates.', lat: 6, lon: 268 },
  { id: 'obsidian-plateau', name: 'Obsidian Plateau', note: 'A dark, smooth slab bounded by copper-lipped canyons.', lat: -16, lon: 322 },
  { id: 'pearl-basin', name: 'Pearl Haze Basin', note: 'A low basin where mineral mist pools and glows at dusk.', lat: 2, lon: 30 },
];

const CHATTER = [
  ['BRIDGE', 'Floor, Bridge. Fabrication run fourteen is cleared to proceed.'],
  ['FLOOR', 'Bridge, Floor. Copy. Compressor two is back on line.'],
  ['LAB', 'Lab to all decks: specimen centrifuge spinning up. Expect a low hum.'],
  ['BRIDGE', 'Orbit trim complete. Pelagia ground track nominal.'],
  ['COMMONS', 'Commons. Hydroponic cycle B is watering. Mind the drip trays.'],
  ['ARCHIVE', 'Archive core sync at ninety eight percent.'],
  ['BRIDGE', 'Attitude hold good. Star tracker locked on the primary.'],
  ['FORUM', 'Forum. Strategy review in ten minutes, all leads welcome.'],
  ['FLOOR', 'Thermal loop three reading warm. Watching it.'],
  ['BRIDGE', 'Comms window with the relay opens in four minutes.'],
  ['LAB', 'Spectrometer calibration done. Thanks for the quiet.'],
  ['COMMONS', 'Water recovery at ninety three percent. Nicely done, crew.'],
];

export function createStationLife({ world, audio, camera, rooms, storage, notify, setTarget, getTarget, getPlayer }) {
  const planet = world.root.getObjectByName('Pelagia / alien mineral planet beneath USS Sentient');
  const $ = id => document.getElementById(id);
  const automated = !!navigator.webdriver;

  // ---- Intercom: radio chirp, caption and (when available) a spoken line.
  const queue = []; let speaking = null, chatterAt = 95, chatterOrder = [...CHATTER.keys()].sort(() => Math.random() - .5), chatterIndex = 0;
  const voices = () => (window.speechSynthesis?.getVoices?.() || []).filter(v => /^en/i.test(v.lang));
  function say(speaker, text, priority = false) {
    const line = { speaker, text };
    if (priority) queue.unshift(line); else queue.push(line);
    if (queue.length > 4) queue.length = 4;
  }
  function startLine(line, now) {
    const caption = $('intercom');
    caption.hidden = false; $('intercom-speaker').textContent = line.speaker; $('intercom-text').textContent = line.text;
    audio.play('radio');
    const duration = 1.4 + line.text.length * .062;
    speaking = { ...line, until: now + duration };
    if (!audio.getState().muted && window.speechSynthesis && !automated) {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(line.text), list = voices();
        u.voice = list.find(v => /Samantha|Daniel|Google UK|Karen|Serena/.test(v.name)) || list[0] || null;
        u.rate = 1.04; u.pitch = line.speaker === 'BRIDGE' ? .92 : 1.02; u.volume = .75;
        speechSynthesis.speak(u);
      } catch { /* captions remain */ }
    }
  }

  // ---- Ship clock and day/night.
  const clock = { hour: START_HOUR, night: 0 };
  let lastNight = null;
  function updateClock(time) {
    const hours = (START_HOUR + time / DAY_SECONDS * 24) % 24;
    clock.hour = hours;
    // Lights fade over ~40 real seconds either side of 22:00 and 06:00.
    const ramp = 24 * 40 / DAY_SECONDS, dusk = THREE.MathUtils.smoothstep(hours, 22 - ramp, 22) , dawn = 1 - THREE.MathUtils.smoothstep(hours, 6 - ramp, 6);
    clock.night = hours >= 12 ? dusk : dawn;
    const isNight = clock.night > .5;
    if (lastNight !== null && isNight !== lastNight) say('BRIDGE', isNight ? 'Good evening, crew. Cabin lighting to night cycle.' : 'Good morning, Sentient. Cabin lighting to day cycle.');
    lastNight = isNight;
    return clock;
  }
  const clockText = () => { const h = Math.floor(clock.hour), m = Math.floor((clock.hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

  // ---- Emergency drills: red light, klaxon, and a timed walk to a safe haven.
  const drill = { active: false, startedAt: 0, safe: null, from: null, previousTarget: null, completed: 0, best: null, nextAt: automated ? Infinity : 330 };
  function startDrill(now = drill.clock || 0) {
    const player = getPlayer(), here = moduleAt(player)?.id;
    if (drill.active || player.layer !== 'station' || player.zone !== 'station') return false;
    const safe = here === 'commons' ? 'archive' : 'commons', room = rooms.find(r => r.id === safe), leak = rooms.find(r => r.id === here) || rooms[0];
    Object.assign(drill, { active: true, startedAt: now, safe, from: leak.id, previousTarget: getTarget() });
    setTarget(safe);
    say('BRIDGE', `This is a drill. Simulated pressure leak in ${leak.name}. All crew to the safe haven in ${room.name}.`, true);
    $('alert').hidden = false; $('alert-title').textContent = 'DRILL · PRESSURE LEAK';
    $('alert-detail').textContent = `${leak.shortName.toUpperCase()} · PROCEED TO ${room.shortName.toUpperCase()}`;
    return true;
  }
  function endDrill(now, success) {
    const seconds = Math.round(now - drill.startedAt);
    drill.active = false; drill.nextAt = now + 600; $('alert').hidden = true;
    if (success) {
      drill.completed++; drill.best = drill.best === null ? seconds : Math.min(drill.best, seconds);
      say('BRIDGE', `Drill complete. You reached the safe haven in ${seconds} seconds. Secure from drill.`, true);
      notify(`Drill complete in ${seconds} s. Best time ${drill.best} s.`);
    } else say('BRIDGE', 'Drill time expired. Secure from drill. We will run it again later.', true);
    setTarget(drill.previousTarget);
  }

  // ---- Telescope and survey log.
  let survey = new Set();
  try { survey = new Set(JSON.parse(storage?.getItem('uss-sentient-survey-v1') || '[]')); } catch { /* fresh log */ }
  const featureDirs = PELAGIA_FEATURES.map(f => {
    const lat = THREE.MathUtils.degToRad(f.lat), lon = THREE.MathUtils.degToRad(f.lon);
    return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
  });
  const scope = { on: false, fov: camera.fov, baseFov: camera.fov, locked: null, markers: [] };
  const world3 = new THREE.Vector3(), normal = new THREE.Vector3(), toCam = new THREE.Vector3(), forward = new THREE.Vector3(), ndc = new THREE.Vector3();
  function featureView() {
    // Screen positions of features on the camera-facing hemisphere.
    camera.getWorldDirection(forward);
    const radius = planet?.geometry?.parameters?.radius || 92, out = [];
    PELAGIA_FEATURES.forEach((f, i) => {
      world3.copy(featureDirs[i]).multiplyScalar(radius); planet.localToWorld(world3);
      normal.copy(world3).sub(planet.position).normalize(); toCam.copy(camera.position).sub(world3).normalize();
      if (normal.dot(toCam) < .08) return;
      const angle = forward.angleTo(world3.clone().sub(camera.position));
      ndc.copy(world3).project(camera);
      out.push({ f, angle, x: ndc.x, y: ndc.y, onScreen: ndc.z < 1 && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 });
    });
    return out;
  }
  function enterScope() { scope.on = true; document.body.classList.add('telescope-mode'); $('telescope').hidden = false; }
  function exitScope() { scope.on = false; document.body.classList.remove('telescope-mode'); $('telescope').hidden = true; scope.locked = null; }
  function tag() {
    const f = scope.locked;
    if (!f || survey.has(f.id)) { exitScope(); return f ? `${f.name} is already logged. Telescope stowed.` : 'Telescope stowed.'; }
    survey.add(f.id);
    try { storage?.setItem('uss-sentient-survey-v1', JSON.stringify([...survey])); } catch { /* session only */ }
    audio.play('discover');
    say('LAB', `Lab copies. ${f.name} logged. ${survey.size} of ${PELAGIA_FEATURES.length} survey sites.`);
    return `Tagged ${f.name}. ${f.note}`;
  }
  function updateScope(dt) {
    if (scope.on && getPlayer().layer !== 'cupola') exitScope();
    const target = scope.on ? 9 : scope.baseFov;
    scope.fov += (target - scope.fov) * (1 - Math.exp(-dt * 6));
    if (Math.abs(camera.fov - scope.fov) > .01) { camera.fov = scope.fov; camera.updateProjectionMatrix(); }
    if (!scope.on || !planet) return;
    const view = featureView(), locked = view.filter(v => v.angle < THREE.MathUtils.degToRad(1.6)).sort((a, b) => a.angle - b.angle)[0];
    scope.locked = locked?.f || null;
    const markers = $('telescope-markers');
    markers.innerHTML = view.filter(v => v.onScreen).map(v => `<span class="scope-mark ${survey.has(v.f.id) ? 'tagged' : ''} ${locked?.f === v.f ? 'locked' : ''}" style="left:${(v.x * .5 + .5) * 100}%;top:${(-v.y * .5 + .5) * 100}%"><i></i><b>${v.f.name.toUpperCase()}</b></span>`).join('');
    $('telescope-status').textContent = locked ? (survey.has(locked.f.id) ? `${locked.f.name.toUpperCase()} · LOGGED` : `LOCKED · ${locked.f.name.toUpperCase()} · E TO TAG`) : view.some(v => v.onScreen) ? 'CENTRE A SITE IN THE RETICLE' : 'NO SURVEY SITE IN VIEW · THE PLANET IS TURNING';
    $('telescope-count').textContent = `${survey.size} / ${PELAGIA_FEATURES.length} SITES LOGGED`;
  }

  // ---- Docking and spacewalk announcements.
  world.docking?.onPhase(phase => {
    const lines = { approach: 'Tender zero two inbound. Watch the prow for traffic.', final: 'Tender zero two on final approach to the Front Door port.', docked: 'Hard dock confirmed. Port one south is latched and pressure equal.', undock: 'Tender zero two, you are clear to undock.', depart: 'Tender departing. Safe travels, zero two.' };
    if (lines[phase]) say(phase === 'docked' ? 'FRONT DOOR' : 'BRIDGE', lines[phase]);
  });
  world.evaTask?.onComplete(() => say('BRIDGE', 'Bridge copies. Radiator loop three is nominal. Nice work out there.', true));

  return {
    clock, drill, scope, survey, features: PELAGIA_FEATURES, say, startDrill, tag, enterScope, exitScope, clockText,
    /** World position of the visible survey site closest to the view centre. */
    nearestSite() { const v = featureView().sort((a, b) => a.angle - b.angle)[0]; if (!v) return null; const i = PELAGIA_FEATURES.indexOf(v.f); world3.copy(featureDirs[i]).multiplyScalar(planet.geometry.parameters.radius); return { id: v.f.id, point: planet.localToWorld(world3).clone() }; },
    update(time, dt) {
      drill.clock = time;
      const player = getPlayer();
      const c = updateClock(time);
      const pulse = drill.active ? .5 + .5 * Math.sin(time * 5.5) : 0;
      world.setCabin({ brightness: 1 - c.night * .66, warmth: c.night * .7, alert: drill.active ? .55 + .45 * pulse : 0 });
      if (drill.active) {
        if (Math.floor(time * 1.1) !== Math.floor((time - dt) * 1.1)) audio.play('klaxon');
        $('alert-time').textContent = `${Math.round(time - drill.startedAt)} s`;
        if (moduleAt(player)?.id === drill.safe && player.layer === 'station') endDrill(time, true);
        else if (time - drill.startedAt > 150) endDrill(time, false);
      } else if (time > drill.nextAt) { if (!startDrill(time)) drill.nextAt = time + 30; }
      if (!automated && !drill.active && time > chatterAt && player.layer === 'station') {
        const [speaker, text] = CHATTER[chatterOrder[chatterIndex++ % CHATTER.length]]; say(speaker, text);
        chatterAt = time + 75 + Math.random() * 60;
      }
      if (speaking && time > speaking.until) { speaking = null; $('intercom').hidden = true; }
      if (!speaking && queue.length) startLine(queue.shift(), time);
      updateScope(dt);
    },
    stats: () => ({ clock: clockText(), night: +clock.night.toFixed(2), drill: { active: drill.active, safe: drill.safe, completed: drill.completed, best: drill.best }, telescope: scope.on, locked: scope.locked?.id || null, survey: [...survey], intercom: speaking?.text || null, queued: queue.length }),
  };
}
