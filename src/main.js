import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { StationSSAOPass } from './contact-shading.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rooms } from './rooms.js';
import { createWorld } from './world.js';
import { START, createWalkable, movePlayer, readProgress } from './navigation.js';
import { LINKS, modulePolygon, moduleAt, routeTo, surfaceHeight, insidePolygon } from './layout.js';
import { createStationAudio } from './audio.js';
import { CUPOLA, EXTENSION_AREAS, CUPOLA_AREAS, EXTENSION_DESTINATIONS, expansionZone } from './expansion-layout.js';
import { AMENITIES, findAmenityRoute, interactionBlocked, clearSegment } from './amenities.js';
import './style.css';

const icons = {
  arrow: '<path d="M4 12h15M13 5l7 7-7 7"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  settings: '<path d="M4 7h16M4 17h16M8 4v6m8 4v6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  book: '<path d="M4 3h13a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm-1 14h14M8 7h8M8 11h5"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.arrow}</svg>`;
const esc = str => String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const coarse = matchMedia('(pointer: coarse)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let storage;
try { storage = window.localStorage; } catch { /* Private contexts may block access. */ }
const visited = readProgress(storage, rooms);
let active = false, started = false, modal = null, target = rooms.find(r => !visited.has(r.id)) || rooms[0];
let nearRoom = null, yaw = 0, pitch = 0, sensitivity = 1, elapsed = 0, bobTime = 0;
let muted = false, toastTimer, lastSaveWarning = false;
try { muted = storage?.getItem('uss-sentient-muted') === 'true'; } catch {}
const audio = createStationAudio();
audio.setMuted(muted);
let layer = 'station', transition = null, focusedDevice = null, movedDistance = 0;
const interactionRay = new THREE.Raycaster(), pointer = new THREE.Vector2();
const destinations = [...rooms,...EXTENSION_DESTINATIONS,...AMENITIES];
let amenityGuidance = null;
let exitGuidance = null;
let quality = 'performance';
let eyeHeight = surfaceHeight(START) + 1.6;
let position = { ...START }, keys = new Set(), drag = null, moveTouch = { x: 0, y: 0 };
const walkable = [...createWalkable(rooms),...EXTENSION_AREAS];
const currentZone = () => expansionZone(position,layer);
const floorHeight = (p=position) => layer==='cupola'?CUPOLA.elevation:expansionZone(p)==='station'?surfaceHeight(p):0;

$('app').innerHTML = `
  <header class="topbar">
    <div class="brand"><img src="${import.meta.env.BASE_URL}brand/sentient-logo.svg" alt="Sentient"/><span class="brand-rule"></span><div class="brand-caption"><strong>USS SENTIENT</strong><span>ORBITAL STATION / 0.6</span></div></div>
    <div class="top-actions"><div class="live-status"><i class="status-dot"></i> ALL SYSTEMS NOMINAL</div><button id="map-btn" class="icon-button" title="Deck map (M)" aria-label="Open deck map">${svg('map')}<span class="nav-label">DECK MAP</span><kbd>M</kbd></button><button id="journal-btn" class="icon-button" title="Expedition log (J)" aria-label="Open expedition log">${svg('book')}</button><button id="sound-btn" class="icon-button" title="Enable ambient audio" aria-label="Enable ambient audio" aria-pressed="false">${svg('mute')}</button><button id="settings-btn" class="icon-button" title="Settings" aria-label="Open settings">${svg('settings')}</button><button id="fullscreen-btn" class="icon-button" title="Fullscreen" aria-label="Toggle fullscreen">${svg('expand')}</button></div>
  </header>
  <div class="coordinates"><span>SECTOR 07</span><span class="slash">/</span><span>SENTIENT SYSTEM</span></div>
  <div class="compass" aria-hidden="true"><span>NW</span><i></i><i></i><b id="heading">000° N</b><i></i><i></i><span>NE</span></div>
  <aside id="welcome" class="welcome"><div class="eyebrow" id="welcome-label">WELCOME ABOARD</div><h1>USS<span>SENTIENT.</span></h1><p id="welcome-copy">Seven living departments. A planet below. Step aboard, operate the station, and venture beyond the hull.</p><button id="start-btn" class="primary">${visited.size ? 'CONTINUE EXPEDITION' : 'ENTER THE STATION'}${svg('arrow')}</button><div class="play-note">${coarse ? 'LEFT THUMB TO MOVE · DRAG TO LOOK' : 'WASD TO MOVE · MOUSE TO LOOK · E / CLICK TO INTERACT'}</div><button id="reset-btn" class="tiny-btn" ${visited.size ? '' : 'hidden'}>Start a new expedition</button></aside>
  <aside class="stellar"><div class="eyebrow">CURRENT ORBIT</div><h3>Pelagia orbit</h3><p>PRIMARY STAR <span>SOL SENTIENT / LIME</span></p><p>ORBIT <span>STABLE</span></p><p>LOCAL CYCLE <span id="cycle">07:24:00</span></p><div class="bar"></div></aside>
  <aside id="mission" class="mission" hidden><div class="eyebrow">EXPEDITION 001</div><h2 id="mission-title">Connect the constellation</h2><p id="mission-copy">Find the department terminals. Collect seven signals to synchronize the station.</p><div class="progress-track"><span id="progress"></span></div><div class="mission-bottom"><span>STATION SYNCHRONIZATION</span><b id="progress-label">0 / 7</b></div></aside>
  <div id="crosshair" class="crosshair" hidden></div><button id="interact" class="interact" hidden><kbd>E</kbd><span id="interact-label">ACCESS TERMINAL</span></button><div id="waypoint" class="waypoint" hidden><div class="diamond"></div><span id="waypoint-label"></span></div>
  <div class="route-guidance"><span id="route-arrow">↑</span><div><small id="route-step">FOLLOW THE HATCHES</small><b id="route-destination">FRONT DOOR</b></div><kbd>M</kbd></div>
  <div class="location"><div class="eyebrow">YOU ARE HERE <span id="location-deck">/ DECK 01</span></div><h2><span id="location-number">01</span><span id="location-name" style="font:inherit;color:inherit;margin:0">The Front Door</span></h2><p id="location-function">Arrival & network observatory</p></div>
  <aside class="minimap-wrap"><div class="mini-heading"><span>STATION OVERVIEW</span><span>01—07</span></div><div class="mini-frame"><canvas id="minimap" width="350" height="350"></canvas><button class="map-open" id="mini-map-btn" aria-label="Open station map"></button></div><div class="mini-footer"><span><b>●</b> YOU</span><span id="discovered-label">0 / 7 CONNECTED</span></div></aside>
  <footer class="bottom-bar"><div class="controls"><div class="control"><span class="keygroup"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> MOVE</div><div class="control desktop-only"><kbd>↗</kbd> LOOK</div><div class="control desktop-only"><kbd>SHIFT</kbd> SPRINT</div><div class="control"><kbd>E</kbd> INTERACT</div><div class="control desktop-only"><kbd>ESC</kbd> PAUSE</div></div><div class="expedition-id"><span>NO SIGNAL TOO SMALL.</span><b>EXP. 001</b></div></footer>
  <div id="touch-controls" class="touch-controls"><div id="joystick" class="joystick" aria-label="Movement joystick"><span id="joystick-knob"></span></div><button id="touch-interact" class="touch-interact" aria-label="Use nearby control or terminal">USE</button></div>
  <aside id="photo-panel" class="photo-panel" hidden aria-label="Ray-traced still view"><div><div class="eyebrow">RAY-TRACED STILL VIEW</div><p id="photo-status" role="status">Preparing light paths</p><small>Camera paused · The image refines as light samples accumulate.</small></div><button id="photo-exit" class="primary">BACK TO EXPLORATION <kbd>ESC</kbd></button></aside>
  <aside id="environment-status" class="environment-status"><span id="environment-label">CABIN ATMOSPHERE</span><b id="environment-value">101.3 kPa · SEALED</b><small id="environment-hint">E / CLICK · OPERATE CONTROLS</small></aside>
  <div id="toast" class="toast" role="status" aria-live="polite"></div><div id="modal-root" hidden></div>
  <div id="loading" class="loading"><img src="${import.meta.env.BASE_URL}brand/sentient-logo.svg" alt="Sentient"/><div class="loading-track"></div><span>ESTABLISHING ORBIT</span></div>
`;

let renderer, scene, camera, composer, bloom, ambientOcclusion, world;
let photoState = 'idle', photoController, photoAbort, photoError = null, photoSession = 0;
await Promise.all([document.fonts.load('400 16px Space'), document.fonts.load('500 16px Space')]).catch(() => {});
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'performance' ? 1 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#02080c');
  const lightingRoom = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(lightingRoom, .04).texture;
  scene.environmentIntensity = .10;
  lightingRoom.dispose(); pmrem.dispose();
  camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, .08, 1800);
  camera.rotation.order = 'YXZ';
  world = await createWorld(scene, rooms);
  applyQuality();
  requestAnimationFrame(() => { $('loading').hidden = true; });
} catch (error) {
  const recovery = renderer ? 'Some station resources could not load. Reload to reconnect.' : 'A WebGL 2 capable browser is needed to explore. Enable hardware acceleration, then reload.';
  $('loading').innerHTML = `<img src="${import.meta.env.BASE_URL}brand/sentient-logo.svg" alt="Sentient"/><span>THE STATION COULD NOT INITIALIZE</span><p style="max-width:360px;text-align:center;line-height:1.7;letter-spacing:0">${recovery}</p><button class="primary" onclick="location.reload()">RETRY CONNECTION</button>`;
  console.error('Station initialization failed', error);
  throw error;
}

function applyQuality() {
  const detailed = quality !== 'performance';
  const ratios = { performance: 1, balanced: 1.25, high: 1.5 };
  renderer.setPixelRatio(Math.min(devicePixelRatio, ratios[quality]));
  renderer.shadowMap.enabled = detailed;
  world.setQuality(quality);
  renderer.setSize(innerWidth, innerHeight);
  // The default mode allocates no bloom/AO render targets and draws the scene
  // directly. Higher quality remains available when the hardware can afford it.
  if (!detailed && composer) {
    composer.passes.forEach(pass => pass.dispose?.()); composer.dispose();
    composer = ambientOcclusion = bloom = null;
  }
  if (detailed && !composer) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    ambientOcclusion = new StationSSAOPass(scene, camera, innerWidth, innerHeight, 32);
    composer.addPass(ambientOcclusion);
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .15, .32, 1.35);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  if (composer) {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
    const aoScale = quality === 'high' ? .85 : .55;
    ambientOcclusion.setSize(Math.ceil(innerWidth*aoScale), Math.ceil(innerHeight*aoScale));
  }
}
function renderGame() {
  if (composer) composer.render(); else renderer.render(scene, camera);
}

function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200);
}

function updateProgress() {
  $('progress').style.width = `${visited.size / rooms.length * 100}%`;
  $('progress-label').textContent = `${visited.size} / ${rooms.length}`;
  $('discovered-label').textContent = `${visited.size} / 7 CONNECTED`;
  $('reset-btn').hidden = !visited.size;
  const complete = visited.size === rooms.length;
  $('mission-title').textContent = complete ? 'Constellation connected' : 'Connect the constellation';
  $('mission-copy').textContent = complete ? 'Seven signals. One Sentient. Your expedition is complete. The station is yours to explore.' : 'Find the department terminals. Collect seven signals to synchronize the station.';
  world.terminalMeshes?.forEach(mesh => {
    const id = mesh.userData.roomId || mesh.userData.room?.id;
    if (id) mesh.userData.connected = visited.has(id);
  });
}

function setActive(value) {
  active = value;
  document.body.classList.toggle('playing', active);
  $('welcome').hidden = active || !!modal;
  $('mission').hidden = !started;
  $('crosshair').hidden = !active;
  if (!active) {
    keys.clear(); moveTouch = { x: 0, y: 0 }; drag = null;
    $('joystick-knob').style.transform = '';
    $('interact').hidden = true; $('waypoint').hidden = true;
  }
}

function enter() {
  if (modal) closeModal(false);
  started = true;
  setActive(true);
  $('welcome-label').textContent = 'EXPEDITION PAUSED';
  $('welcome-copy').textContent = 'Take a breath. Your discoveries are saved. The rest of the station is waiting.';
  $('start-btn').innerHTML = `RESUME EXPLORATION${svg('arrow')}`;
  if (!coarse && !document.pointerLockElement) {
    try {
      const result = $('world').requestPointerLock();
      result?.catch(() => notify('Drag to look around. WASD moves; E accesses a terminal.'));
    } catch { notify('Drag to look around. WASD moves; E accesses a terminal.'); }
  }
  if (!muted) enableAudio();
}

function pause() {
  setActive(false);
  if (document.pointerLockElement) document.exitPointerLock();
}

function openModal(type, title, subtitle, content, footer = '') {
  modal = type;
  setActive(false);
  if (document.pointerLockElement) document.exitPointerLock();
  $('modal-root').hidden = false;
  $('modal-root').className = 'modal-backdrop';
  $('modal-root').innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><div class="eyebrow">${subtitle}</div><h2 id="modal-title">${title}</h2></div><button class="icon-button" id="modal-close" aria-label="Close dialog">${svg('close')}</button></header><div class="modal-content">${content}</div>${footer ? `<footer class="modal-bottom">${footer}</footer>` : ''}</section>`;
  $('modal-close').onclick = () => closeModal();
  $('modal-close').focus();
}

function closeModal(resume = true) {
  modal = null;
  $('modal-root').hidden = true;
  $('modal-root').innerHTML = '';
  if (resume && started) enter();
  else setActive(false);
}

function scan(room) {
  const isNew = !visited.has(room.id);
  visited.add(room.id);
  try { localStorage.setItem('uss-sentient-expedition-v1', JSON.stringify([...visited])); }
  catch { if (!lastSaveWarning) { notify('Storage is unavailable. Discoveries will last for this session.'); lastSaveWarning = true; } }
  updateProgress();
  if (isNew) playChime();
  target = rooms.find(r => !visited.has(r.id)) || room;
  openTerminal(room, isNew);
}

function openTerminal(room, isNew = false) {
  const complete = visited.size === rooms.length;
  openModal('terminal', esc(room.name), `DEPARTMENT ${room.number} / ${esc(room.designation)}`,
    `<div class="signal-banner">${svg('check')} ${complete ? 'ALL SEVEN SIGNALS CONNECTED · STATION SYNCHRONIZED' : `${isNew ? 'SIGNAL ACQUIRED' : 'SIGNAL CONNECTED'} · ${esc(room.signal).toUpperCase()} · ${visited.size}/7`}</div><p class="modal-intro">${esc(room.description)}</p><div class="eyebrow" style="margin-bottom:13px">${esc(room.function)}</div><div class="tools-grid">${room.tools.map(t => `<article class="tool-card"><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p></article>`).join('')}</div>`,
    `<span class="eyebrow">SENTIENT KNOWLEDGE TERMINAL / ${room.number}</span><button id="terminal-continue" class="primary">${complete ? 'KEEP EXPLORING' : 'CONTINUE EXPEDITION'}${svg('arrow')}</button>`);
  $('terminal-continue').onclick = () => closeModal();
}

function interact() {
  if (!active) return;
  if (transition) return;
  const device = pickDevice();
  if (device) operate(device);
  else if (nearRoom) scan(nearRoom);
  else notify('Approach a lit control and press E, or aim at its screen and click. M opens the deck map.');
}

function openMap() {
  openModal('map', 'Find your next discovery.', 'USS SENTIENT / DECK DIRECTORY',
    `<p class="modal-intro">Choose a destination. The Forum has a six-seat briefing bay; the Commons has a bathroom, and the Floor has a machinery annex. Automatic hatches connect the departments. Open the Forum floor hatch for the lower cupola; cycle the Arrival airlock for EVA.</p><div class="deck-layout"><div class="deck-visual"><canvas id="deck-canvas" width="560" height="720" aria-label="Station floor plan with your position and route"></canvas></div><div class="room-list">${destinations.map(r => `<button class="room-row ${target.id === r.id ? 'selected' : ''}" data-destination="${r.id}" aria-label="Navigate to ${esc(r.name)}"><span class="num">${r.number}</span><span><span class="name">${esc(r.name)}</span><small>${esc(r.function)}</small></span><span class="room-state">${visited.has(r.id) ? '✓' : '↗'}</span></button>`).join('')}</div></div>`, `<span class="eyebrow">${visited.size} OF 7 SIGNALS CONNECTED</span><span class="eyebrow" style="color:#cfff04">● YOU &nbsp; ━ ROUTE &nbsp; ◇ DESTINATION</span>`);
  renderMap($('deck-canvas'), true);
  $('deck-canvas').onclick = event => {
    const canvas = event.currentTarget, bounds = canvas.getBoundingClientRect();
    const scale = Math.min((canvas.width-35)/43,(canvas.height-40)/52);
    const x = ((event.clientX-bounds.left)/bounds.width*canvas.width-canvas.width/2)/scale+2;
    const z = ((event.clientY-bounds.top)/bounds.height*canvas.height-canvas.height/2)/scale-18.9;
    const module = moduleAt({x,z});
    if (module) { target = rooms.find(r => r.id===module.id); notify(`Route set: ${target.name}. Follow the lime arrow.`); closeModal(); }
  };
  document.querySelectorAll('[data-destination]').forEach(button => {
    button.onclick = () => {
      target = destinations.find(r => r.id === button.dataset.destination);
      notify(`Route set: ${target.name}. Follow the lime arrow.`);
      closeModal();
    };
  });
}

function openJournal() {
  openModal('journal', 'The expedition log.', 'YOUR DISCOVERIES / SAVED ON THIS DEVICE',
    `<p class="modal-intro">${visited.size ? 'Revisit the people, systems and ideas behind every signal you have connected.' : 'Your story starts at the Front Door. Walk to its glowing terminal and press E to make your first discovery.'}</p><div class="room-list">${rooms.map(r => `<button class="room-row" data-log="${r.id}" ${visited.has(r.id) ? '' : 'disabled'}><span class="num">${r.number}</span><span><span class="name">${esc(r.name)}</span><small>${visited.has(r.id) ? `${esc(r.signal)} signal connected · Open entry` : 'Undiscovered · Find this department terminal'}</small></span><span class="room-state">${visited.has(r.id) ? '✓' : '—'}</span></button>`).join('')}</div>`);
  document.querySelectorAll('[data-log]').forEach(button => { button.onclick = () => openTerminal(rooms.find(r => r.id === button.dataset.log)); });
}

function stopPhoto(resume = true) {
  if (photoState === 'idle') return;
  photoSession++;
  photoAbort?.abort(); photoAbort = null;
  photoController?.dispose(); photoController = null;
  photoState = 'idle';
  document.body.classList.remove('photo-mode'); $('photo-panel').hidden = true;
  if (resume) enter(); else setActive(false);
}

async function startPhoto() {
  if (photoState !== 'idle') return;
  const session = ++photoSession;
  if (modal) closeModal(false);
  pause();
  photoError = null; photoState = 'loading';
  photoAbort = new AbortController();
  const abort = photoAbort;
  document.body.classList.add('photo-mode'); $('photo-panel').hidden = false;
  $('photo-status').textContent = 'Loading ray tracer'; $('photo-exit').focus();
  try {
    const { createRaytracedView } = await import('./raytraced-view.js');
    if (session !== photoSession) return;
    const controller = await createRaytracedView({ renderer, scene, camera, signal: abort.signal,
      onStatus: status => { if (session === photoSession) $('photo-status').textContent = status; },
      rasterize: renderGame,
    });
    if (session !== photoSession) { controller.dispose(); return; }
    photoController = controller; photoState = 'rendering';
  } catch (error) {
    if (session !== photoSession || error.name === 'AbortError') return;
    photoError = error.message;
    stopPhoto(false);
    notify(`Ray-traced view unavailable: ${error.message} Exploration is ready.`);
  }
}

function openSettings() {
  openModal('settings', 'Make yourself at home.', 'EXPEDITION SETTINGS',
    `<div class="settings-row"><div>Graphics quality<small>Performance is the default: direct rendering with no shadow maps, bloom or contact shading.</small></div><select id="quality" aria-label="Graphics quality"><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="high">High</option></select></div><div class="settings-row"><div>Look sensitivity<small>Mouse and touch camera speed.</small></div><input id="sensitivity" type="range" min="0.35" max="2" step="0.05" value="${sensitivity}" aria-label="Look sensitivity"/></div><div class="settings-row"><div>Ambient audio<small>Spatial footsteps, pressure doors, working machinery, and an evolving procedural score for each room.</small></div><button id="settings-sound" class="icon-button">${muted ? 'OFF' : 'ON'}</button></div><div class="settings-row"><div>Ray-traced still view<small>Pause here to render soft shadows, reflections and bounced light. Refines over time.</small></div><button id="photo-start" class="icon-button">RENDER VIEW <kbd>R</kbd></button></div><div class="eyebrow" style="margin-top:27px">FLIGHT MANUAL</div><div class="help-list"><div><span>Move</span><b>W A S D / Arrows</b></div><div><span>Look around</span><b>Mouse / Drag</b></div><div><span>Sprint</span><b>Shift</b></div><div><span>Operate control / hatch</span><b>E / Click</b></div><div><span>Deck map / Log</span><b>M / J</b></div><div><span>Pause / Close</span><b>Esc</b></div></div><p class="modal-intro" style="font-size:11px;margin:24px 0 0">On touch screens, use the left joystick to move, drag the scene to look, and tap USE near a terminal or control. This fictional station is based on Sentient's documented seven functional zones.</p>`);
  $('photo-start').onclick = startPhoto;
  $('quality').value = quality;
  $('quality').onchange = event => { quality = event.target.value; applyQuality(); };
  $('sensitivity').oninput = event => { sensitivity = Number(event.target.value); };
  $('settings-sound').onclick = () => { toggleAudio(); $('settings-sound').textContent = muted ? 'OFF' : 'ON'; };
}

function enableAudio() {
  audio.unlock().then(ok=>{if(!ok)notify('Audio is unavailable in this browser.');}).catch(() => notify('Audio is unavailable in this browser.'));
  audio.setMuted(muted); updateAudioButton();
}
function updateAudioButton() {
  $('sound-btn').innerHTML = svg(muted ? 'mute' : 'sound');
  $('sound-btn').classList.toggle('active', !muted);
  $('sound-btn').setAttribute('aria-pressed', String(!muted));
  $('sound-btn').setAttribute('aria-label', muted ? 'Enable station audio' : 'Mute station audio');
  $('sound-btn').title = muted ? 'Enable station audio' : 'Mute station audio';
}
function toggleAudio() {
  muted = !muted;
  try { storage?.setItem('uss-sentient-muted',String(muted)); } catch {}
  enableAudio();
}
function playChime() { audio.play('scan'); }

function eligibleDevices() {
  const room = layer==='station' ? moduleAt(position)?.id : null;
  const zone = currentZone();
  return world.devices.filter(d => (!d.zone || d.zone===zone) && (!d.roomId || d.roomId===room) &&
    Math.hypot(position.x-d.x,position.z-d.z)<d.range && Math.abs(camera.position.y-d.y)<2.8 &&
    !interactionBlocked(position,d,world.colliders));
}
function pickDevice(ndc = null, aimedOnly = false) {
  if (transition) return null;
  const nearby = eligibleDevices();
  interactionRay.setFromCamera(ndc || pointer.set(0,0),camera);
  const hits = interactionRay.intersectObjects(nearby.map(d=>d.mesh),true);
  const hit = hits[0];
  if (hit) return nearby.find(d=>{for(let object=hit.object;object;object=object.parent)if(object===d.mesh)return true;return false;});
  if (aimedOnly || nearRoom) return null;
  const forward=camera.getWorldDirection(new THREE.Vector3());
  return nearby.filter(d=>d.action || ((d.x-position.x)*forward.x+(d.z-position.z)*forward.z)>.15)
    .sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0] || null;
}
function operate(device) {
  if (!device || transition) return;
  audio.play(device.sound || (device.id.startsWith('airlock')?'airlock':device.action?'door-open':'console'),device);
  notify(device.activate());
  if (device.action) {
    const descending=device.action==='descend';
    transition={descending,time:0,duration:3.6,from:{...position,y:eyeHeight},
      to:{x:CUPOLA.hatch.x,z:CUPOLA.hatch.z,y:(descending?CUPOLA.elevation:0)+1.6}};
    keys.clear(); moveTouch={x:0,y:0};
  }
}
function updateTransition(dt) {
  transition.time+=dt;
  const t=Math.min(1,transition.time/transition.duration), vertical=THREE.MathUtils.clamp((transition.time-.72)/(transition.duration-.72),0,1), smooth=vertical*vertical*(3-2*vertical), travel=Math.min(1,transition.time/.72);
  position={x:THREE.MathUtils.lerp(transition.from.x,transition.to.x,travel),z:THREE.MathUtils.lerp(transition.from.z,transition.to.z,travel)};
  eyeHeight=THREE.MathUtils.lerp(transition.from.y,transition.to.y,smooth);
  camera.position.set(position.x,eyeHeight,position.z);
  if(t===1){layer=transition.descending?'cupola':'station';transition=null;world.expansion.hatch.open=false;audio.play('latch');pitch=layer==='cupola'?-.85:0;if(layer==='cupola')yaw=-2.12;notify(layer==='cupola'?'Nadir cupola. Glass beneath your feet; Pelagia below. Use the ladder to return.':'Back aboard the Forum. Hatch secured.');}
}
function directGuidanceRoute() {
  if(layer==='cupola') return target.id==='cupola'?[{x:1.0,z:-20.8}]:[{x:0,z:-22.2}];
  const zone=currentZone();
  if(target.roomId && layer==='station' && zone==='station') {
    const room=moduleAt(position);
    if(room?.id!==target.roomId)return [...routeTo(position,target.roomId).slice(0,-1),rooms.find(r=>r.id===target.roomId)];
    const cacheId=`${target.id}:${world.services.doors.map(d=>+d.collider.disabled).join('')}`;
    if(!amenityGuidance || amenityGuidance.id!==cacheId ||
      Math.min(...amenityGuidance.points.map(p=>Math.hypot(position.x-p.x,position.z-p.z)),Math.hypot(position.x-amenityGuidance.origin.x,position.z-amenityGuidance.origin.z))>1.25) {
      amenityGuidance={id:cacheId,origin:{...position},points:findAmenityRoute(position,target.approach,room,walkable,world.colliders)};
    }
    while(amenityGuidance.points.length>1&&Math.hypot(position.x-amenityGuidance.points[0].x,position.z-amenityGuidance.points[0].z)<.33&&
      clearSegment(position,amenityGuidance.points[1],walkable,world.colliders))amenityGuidance.points.shift();
    return amenityGuidance.points;
  }
  if(target.id==='cupola') {
    if(zone==='airlock'||zone==='exterior') return returnRoute();
    return [...routeTo(position,'forum').slice(0,-1),CUPOLA.hatch];
  }
  if(target.id==='airlock'||target.id==='exterior') {
    const route=[];
    if(zone==='station') route.push(...routeTo(position,'front-door').slice(0,-1),{x:0,z:0},{x:6.4,z:0});
    if(target.id==='airlock') {if(zone==='exterior')return returnRoute();if(!route.length)route.push({x:6.4,z:0});}
    else {if(zone==='exterior'&&position.z<-1&&Math.abs(position.x-17)>.45)route.push({x:17,z:position.z});else if(position.x<16.4)route.push({x:17,z:0});route.push({x:17,z:-12});}
    return route.filter((p,i)=>i===route.length-1||Math.hypot(p.x-position.x,p.z-position.z)>.65);
  }
  if(zone==='airlock'||zone==='exterior')return returnRoute();
  return routeTo(position,target.id);
}

function guidanceRoute() {
  const route=directGuidanceRoute(),room=layer==='station'?moduleAt(position):null;
  if(!room||!route.length||!insidePolygon(route[0].x,route[0].z,modulePolygon(room)))return route;
  const goal=route[0];
  if(clearSegment(position,goal,walkable,world.colliders))return route;
  const id=`${target.id}:${room.id}:${goal.x}:${goal.z}:${world.services.doors.map(d=>+d.collider.disabled).join('')}`;
  if(!exitGuidance||exitGuidance.id!==id||Math.min(...exitGuidance.points.map(p=>Math.hypot(position.x-p.x,position.z-p.z)),Math.hypot(position.x-exitGuidance.origin.x,position.z-exitGuidance.origin.z))>1.25)
    exitGuidance={id,origin:{...position},points:findAmenityRoute(position,goal,room,walkable,world.colliders)};
  while(exitGuidance.points.length>1&&Math.hypot(position.x-exitGuidance.points[0].x,position.z-exitGuidance.points[0].z)<.33&&
    clearSegment(position,exitGuidance.points[1],walkable,world.colliders))exitGuidance.points.shift();
  return exitGuidance.points.length?[...exitGuidance.points,...route.slice(1)]:route;
}
function returnRoute() {
  if(currentZone()==='exterior'&&position.z<-.6)return[...(Math.abs(position.x-17)>.45?[{x:17,z:position.z}]:[]),{x:17,z:0},{x:6.4,z:0},{x:0,z:0}];
  if(position.x>7)return[{x:6.4,z:0},{x:0,z:0}];
  return[{x:0,z:0}];
}

function renderMap(canvas, large = false) {
  const ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const scale = Math.min((width - 35) / 43, (height - 40) / 52);
  const px = x => width / 2 + (x-2) * scale;
  const pz = z => height / 2 + (z + 18.9) * scale;
  ctx.strokeStyle = '#63855820'; ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y < height; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  ctx.lineCap = 'butt';
  for (const link of LINKS) {
    ctx.beginPath(); ctx.moveTo(px(link.a.x),pz(link.a.z)); ctx.lineTo(px(link.b.x),pz(link.b.z));
    ctx.strokeStyle = '#78978165'; ctx.lineWidth = link.width * scale; ctx.stroke();
    ctx.strokeStyle = '#152922'; ctx.lineWidth = (link.width-.2) * scale; ctx.stroke();
    if (link.kind !== 'level') {
      ctx.strokeStyle = link.kind === 'stairs' ? '#d8e2ce' : '#8cafb6'; ctx.lineWidth = 1;
      for(let i=1;i<6;i++) { const x=px(link.a.x+(link.b.x-link.a.x)*i/6), z=pz(link.a.z+(link.b.z-link.a.z)*i/6); const dx=link.a.x===link.b.x?link.width*scale*.4:0, dz=link.a.z===link.b.z?link.width*scale*.4:0; ctx.beginPath();ctx.moveTo(x-dx,z-dz);ctx.lineTo(x+dx,z+dz);ctx.stroke(); }
    }
  }
  for (const room of rooms) {
    const points = modulePolygon(room);
    ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(px(p.x),pz(p.z)) : ctx.moveTo(px(p.x),pz(p.z))); ctx.closePath();
    ctx.fillStyle = visited.has(room.id) ? '#2c3820' : '#101d19'; ctx.strokeStyle = target.id === room.id ? '#cfff04' : '#789781'; ctx.lineWidth = target.id === room.id ? 2 : 1;
    ctx.fill(); ctx.stroke();
  }
  // Exterior gantry and the lower layer share the station's navigational map.
  ctx.strokeStyle='#789ba1';ctx.lineWidth=1;ctx.fillStyle='#18313a';
  ctx.fillRect(px(2.55),pz(-1.2),6.25*scale,2.4*scale);ctx.strokeRect(px(2.55),pz(-1.2),6.25*scale,2.4*scale);
  ctx.beginPath();ctx.moveTo(px(8.8),pz(0));ctx.lineTo(px(17),pz(0));ctx.lineTo(px(17),pz(-35.5));ctx.strokeStyle='#b7a570';ctx.lineWidth=2;ctx.stroke();
  ctx.font='11px Space';ctx.fillStyle='#b9dbe0';ctx.textAlign='center';ctx.fillText('A1',px(6.7),pz(.4));ctx.fillText('EVA',px(19),pz(-13));
  ctx.beginPath();ctx.arc(px(0),pz(-22),3.0*scale,0,Math.PI*2);ctx.strokeStyle=layer==='cupola'?'#cfff04':'#8fcbe177';ctx.setLineDash([2,3]);ctx.stroke();ctx.setLineDash([]);
  ctx.fillText('05↓',px(0),pz(-18.6));
  const route = [position, ...guidanceRoute()];
  ctx.beginPath(); route.forEach((p,i) => i ? ctx.lineTo(px(p.x),pz(p.z)) : ctx.moveTo(px(p.x),pz(p.z)));
  ctx.strokeStyle = '#cfff04'; ctx.lineWidth = large ? 2.5 : 2; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
  for (const link of LINKS) for (const p of [link.a,link.b]) {
    ctx.fillStyle = '#d9ddd0';
    ctx.fillRect(px(p.x)-(link.a.x===link.b.x?3:1),pz(p.z)-(link.a.x===link.b.x?1:3),link.a.x===link.b.x?6:2,link.a.x===link.b.x?2:6);
  }
  for (const room of rooms) {
    ctx.textAlign = 'center'; ctx.font = `${large ? 22 : 19}px Space, sans-serif`;
    ctx.fillStyle = target.id === room.id ? '#cfff04' : '#f5f5ef';
    ctx.fillText(room.number,px(room.x),pz(room.z)-3);
    ctx.font = `${large ? 15 : 10}px Space, sans-serif`; ctx.fillStyle = '#c7d0c9';
    if (large) { ctx.fillText(room.shortName.toUpperCase(),px(room.x),pz(room.z)+16); ctx.font='11px Space';ctx.fillStyle='#819b91';ctx.fillText(`${room.elevation>0?'+':''}${room.elevation.toFixed(2)} m`,px(room.x),pz(room.z)+31); }
  }
  for(const amenity of AMENITIES) {
    ctx.fillStyle=target.id===amenity.id?'#cfff04':'#91b9c2';
    ctx.beginPath();ctx.arc(px(amenity.x),pz(amenity.z),large?3:2,0,Math.PI*2);ctx.fill();
    if(large){ctx.font='9px Space';ctx.textAlign='center';ctx.fillText(amenity.shortName.toUpperCase(),px(amenity.x),pz(amenity.z)+12);}
  }
  ctx.save(); ctx.translate(px(position.x), pz(position.z)); ctx.rotate(-yaw);
  ctx.fillStyle = '#cfff0428'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 23, -Math.PI / 2 - .5, -Math.PI / 2 + .5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#cfff04'; ctx.shadowBlur = 9; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
}

function updatePlayer(dt) {
  const inputX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + moveTouch.x;
  const inputZ = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + moveTouch.y;
  const length = Math.max(1, Math.hypot(inputX, inputZ));
  const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4.2 : 2.5) * dt;
  const dx = (inputX * Math.cos(yaw) + inputZ * Math.sin(yaw)) / length * speed;
  const dz = (-inputX * Math.sin(yaw) + inputZ * Math.cos(yaw)) / length * speed;
  const before=position;
  position = movePlayer(position, dx, dz, layer==='cupola'?CUPOLA_AREAS:walkable, layer==='cupola'?(world.expansion.cupolaColliders||[]):[...world.colliders,...world.expansion.colliders]);
  movedDistance=Math.hypot(position.x-before.x,position.z-before.z);
  if (Math.abs(dx) + Math.abs(dz) > .001) bobTime += dt * 9;
  const bob = reduced ? 0 : Math.sin(bobTime) * .022 * Math.min(1, Math.hypot(inputX, inputZ));
  eyeHeight += (floorHeight() + 1.6 - eyeHeight) * (1-Math.exp(-dt*12));
  camera.position.set(position.x, eyeHeight + bob, position.z);
}

const markerPoint = new THREE.Vector3(), direction = new THREE.Vector3();
function updateHUD() {
  const zone=currentZone();
  const module = layer==='station'?moduleAt(position):null;
  const room = rooms.find(r => r.id === module?.id);
  $('location-deck').textContent = `/ ${surfaceHeight(position)>1?'OBSERVATION DECK':surfaceHeight(position)<-.5?'LOWER DECK':surfaceHeight(position)>.4?'HABITAT DECK':'MAIN DECK'}`;
  $('location-name').textContent = room ? room.name : 'Pressure tunnel';
  $('location-number').textContent = room ? room.number : '↗';
  $('location-function').textContent = room ? room.designation : 'Module transit / automatic hatches';
  const degrees = (Math.round(-yaw * 180 / Math.PI) % 360 + 360) % 360;
  const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
  $('heading').textContent = `${String(degrees).padStart(3, '0')}° ${cardinal}`;
  nearRoom = layer==='station' && zone==='station' ? rooms.find(r => Math.hypot(position.x - r.terminal.x, position.z - r.terminal.z) < 1.5) || null : null;
  focusedDevice=pickDevice();
  $('interact').hidden = !active || !!transition || (!nearRoom&&!focusedDevice);
  $('crosshair').classList.toggle('near', !!nearRoom||!!focusedDevice);
  if (nearRoom) $('interact-label').textContent = `${visited.has(nearRoom.id) ? 'REVISIT' : 'SCAN'} ${nearRoom.shortName.toUpperCase()}`;
  if(focusedDevice) $('interact-label').textContent=focusedDevice.label.toUpperCase();
  const extra=EXTENSION_DESTINATIONS.find(d=>d.id===zone);
  if(extra){$('location-name').textContent=extra.name;$('location-number').textContent=extra.number;$('location-function').textContent=extra.function;$('location-deck').textContent=zone==='cupola'?'/ LOWER OBSERVATORY':zone==='exterior'?'/ EXTRAVEHICULAR':'/ PRESSURE LOCK';}
  const state=world.expansion.airlock;
  $('environment-label').textContent=transition?'VERTICAL TRANSFER':zone==='exterior'?'EVA / MAGNETIC BOOTS':zone==='cupola'?'NADIR / PLANET OBSERVATION':zone==='airlock'?'AIRLOCK ATMOSPHERE':'CABIN ATMOSPHERE';
  $('environment-value').textContent=transition?'LADDER TRANSIT':zone==='exterior'?'SUIT SEALED · TETHER ATTACHED':zone==='airlock'?`${state.pressure.toFixed(1)} kPa · ${state.mode.toUpperCase()}`:zone==='cupola'?'PELAGIA · MINERAL WORLD':'101.3 kPa · SEALED';
  $('environment-hint').textContent=zone==='airlock'?'USE THE PRESSURE CONTROL TO OPEN THE OUTER HATCH':zone==='cupola'?'E AT THE LADDER · RETURN TO FORUM':zone==='exterior'?'FOLLOW THE GOLD HANDRAILS BACK TO A1':muted?'AUDIO MUTED · TOP RIGHT TO ENABLE':'PROCEDURAL SCORE · '+(room?.shortName||'TRANSIT').toUpperCase();
  const route = guidanceRoute();
  const next = route[0] || target.approach;
  const distance = [position,...route].reduce((sum,p,i,all) => i ? sum + Math.hypot(p.x-all[i-1].x,p.z-all[i-1].z) : 0, 0);
  const bearing = Math.atan2(next.x-position.x, -(next.z-position.z)) + yaw;
  $('route-arrow').style.transform = `rotate(${bearing}rad)`;
  $('route-destination').textContent = `${target.shortName.toUpperCase()} · ${Math.ceil(distance)} m`;
  $('route-step').textContent = nearRoom?.id === target.id ? 'PRESS E TO CONNECT' : room?.id === target.id ? 'DEPARTMENT TERMINAL' : 'FOLLOW THE HATCHES';
  if(layer==='cupola') $('route-step').textContent=target.id==='cupola'?'OBSERVATION DECK':'CLIMB THE LADDER TO RETURN';
  else if(zone==='airlock') $('route-step').textContent='E / CYCLE AIRLOCK PRESSURE';
  else if(zone==='exterior') $('route-step').textContent='FOLLOW THE EVA GANTRY';
  else if(target.id==='cupola'&&room?.id==='forum') $('route-step').textContent='E / OPEN FLOOR HATCH';
  markerPoint.set(next.x, floorHeight(next)+1.5, next.z);
  direction.copy(markerPoint).sub(camera.position);
  const inFront = direction.dot(camera.getWorldDirection(new THREE.Vector3())) > 0;
  markerPoint.project(camera);
  const onScreen = inFront && Math.abs(markerPoint.x) < .87 && Math.abs(markerPoint.y) < .72;
  $('waypoint').hidden = !active || !!nearRoom || !!focusedDevice || !!transition || !onScreen || distance < 2;
  if (onScreen) { $('waypoint').style.left = `${(markerPoint.x * .5 + .5) * innerWidth}px`; $('waypoint').style.top = `${(-markerPoint.y * .5 + .5) * innerHeight}px`; $('waypoint-label').textContent = `${target.shortName.toUpperCase()} · ${Math.round(distance)} m`; }
  renderMap($('minimap'));
  if (modal === 'map' && $('deck-canvas')) renderMap($('deck-canvas'), true);
}

$('photo-exit').onclick = () => stopPhoto();
$('start-btn').onclick = enter;
$('reset-btn').onclick = () => {
  visited.clear(); layer='station';transition=null;world.expansion.hatch.open=false; position = { ...START }; yaw = 0; pitch = 0; target = rooms[0];
  try { localStorage.removeItem('uss-sentient-expedition-v1'); } catch { /* Session still resets. */ }
  updateProgress(); enter(); notify('New expedition started. First stop: the Front Door.');
};
$('map-btn').onclick = openMap; $('mini-map-btn').onclick = openMap;
$('journal-btn').onclick = openJournal; $('settings-btn').onclick = openSettings;
$('sound-btn').onclick = toggleAudio; $('interact').onclick = interact; $('touch-interact').onclick = interact;
$('fullscreen-btn').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { notify('Fullscreen is unavailable here. Open the game in a browser tab.'); }
};

document.addEventListener('keydown', event => {
  if (photoState !== 'idle') {
    if (event.code === 'Tab') { event.preventDefault(); $('photo-exit').focus(); }
    if (event.code === 'Escape' || event.code === 'KeyR') { event.preventDefault(); if (!event.repeat) stopPhoto(); }
    return;
  }
  if (!transition && event.code === 'KeyR' && !event.repeat && !['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) { event.preventDefault(); startPhoto(); return; }

  if (event.code === 'Tab' && modal) {
    const focusable = [...$('modal-root').querySelectorAll('button:not(:disabled),select,input')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    return;
  }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) { if (event.code === 'Escape') closeModal(); return; }
  if (event.code === 'Escape') { if (modal) closeModal(); else if (active) pause(); return; }
  if (event.repeat && ['KeyE', 'KeyM', 'KeyJ'].includes(event.code)) return;
  if (event.code === 'KeyM') { event.preventDefault(); modal === 'map' ? closeModal() : openMap(); return; }
  if (event.code === 'KeyJ') { event.preventDefault(); modal === 'journal' ? closeModal() : openJournal(); return; }
  if (!active) return;
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'KeyE') { interact(); return; }
  keys.add(event.code);
});
document.addEventListener('keyup', event => keys.delete(event.code));
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && active && !modal) pause(); });
document.addEventListener('pointerlockerror', () => { if (active) notify('Mouse capture unavailable. Hold and drag to look around.'); });
window.addEventListener('blur', () => { keys.clear(); if (active) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); if (active) pause(); } });

function look(dx, dy) { yaw -= dx * .002 * sensitivity; pitch = THREE.MathUtils.clamp(pitch - dy * .002 * sensitivity, -1.48, 1.48); }
document.addEventListener('mousemove', event => { if (active && document.pointerLockElement) look(event.movementX, event.movementY); });
$('world').addEventListener('pointerdown', event => {
  if (!active) return;
  if(document.pointerLockElement){const hit=pickDevice(null,true);if(hit)operate(hit);return;}
  drag = { startX:event.clientX,startY:event.clientY,  id: event.pointerId, x: event.clientX, y: event.clientY };
  $('world').setPointerCapture(event.pointerId);
});
$('world').addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id || !active || document.pointerLockElement) return;
  look(event.clientX - drag.x, event.clientY - drag.y); drag.x = event.clientX; drag.y = event.clientY;
});
$('world').addEventListener('pointerup', event => {
  if(active&&drag&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6){
    const bounds=$('world').getBoundingClientRect();
    const hit=pickDevice(new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1),true);if(hit)operate(hit);
  }drag=null;
});
$('world').addEventListener('pointercancel', () => { drag = null; });
let stickId = null;
function updateStick(event) {
  const bounds = $('joystick').getBoundingClientRect();
  const dx = event.clientX - bounds.left - bounds.width / 2, dy = event.clientY - bounds.top - bounds.height / 2;
  const length = Math.max(32, Math.hypot(dx, dy));
  moveTouch = { x: dx / length, y: dy / length };
  $('joystick-knob').style.transform = `translate(${moveTouch.x * 31}px,${moveTouch.y * 31}px)`;
}
$('joystick').addEventListener('pointerdown', event => { stickId = event.pointerId; $('joystick').setPointerCapture(stickId); updateStick(event); });
$('joystick').addEventListener('pointermove', event => { if (event.pointerId === stickId) updateStick(event); });
function releaseStick() { stickId = null; moveTouch = { x: 0, y: 0 }; $('joystick-knob').style.transform = ''; }
$('joystick').addEventListener('pointerup', releaseStick); $('joystick').addEventListener('pointercancel', releaseStick);

window.addEventListener('resize', () => { if (photoState !== 'idle') stopPhoto(false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); applyQuality(); });
updateProgress(); updateAudioButton();
let previous = performance.now(), hudTime = 0;
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - previous) / 1000, .05); previous = now;
  if (document.hidden) return;
  if (photoState !== 'idle') {
    if (photoController) {
      try {
        photoController.render();
        const stats = photoController.stats();
        $('photo-status').textContent = stats.compiling ? 'Compiling ray tracer' : `${Math.floor(stats.samples)} light samples · ${stats.bounces} bounces`;
      } catch (error) {
        photoError = error.message; stopPhoto(false);
        notify(`Ray-traced view unavailable: ${error.message} Exploration is ready.`);
      }
    } else renderGame();
    return;
  }
  elapsed += dt;
  movedDistance=0;
  if (transition) { if(active)updateTransition(dt); }
  else if (active) updatePlayer(dt);
  else { eyeHeight = floorHeight()+1.6; camera.position.set(position.x, eyeHeight, position.z); }
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const zone=currentZone();
  world.animate?.(elapsed, dt, {...position,y:camera.position.y,layer,zone}, reduced ? .15 : 1);
  audio.setRoom(zone==='station'?moduleAt(position)?.id:zone);
  audio.update({position:{...position,y:camera.position.y},yaw,dt,distance:movedDistance,sprinting:keys.has('ShiftLeft')||keys.has('ShiftRight'),zone,doors:[...world.doors,...world.expansion.doors,...world.services.doors]});
  hudTime += dt;
  if (hudTime > .065) { updateHUD(); hudTime = 0; }
  $('cycle').textContent = `07:${String(24 + Math.floor(elapsed / 60) % 36).padStart(2,'0')}:${String(Math.floor(elapsed) % 60).padStart(2,'0')}`;
  renderer.info.reset();
  renderGame();
});

if (import.meta.env.DEV) {
  // Cabin dust is an interior point cloud, not a star field; only star clouds count.
  let pointClouds = 0; scene.traverse(object => { if (object.isPoints && !object.userData.cabinDust) pointClouds++; });
  window.__SENTIENT__ = {
    snapshot: () => ({ layer, zone:currentZone(), transition:transition?{time:transition.time,descending:transition.descending}:null, audio:audio.getState(), expansion:world.expansion.getState(), expansionStats:world.expansion.stats, interactiveStats:world.interactive.stats, spaceStats:world.spaceStats, exteriorStats:world.exteriorStats, corridorStats:world.corridorStats, viewportStats:world.corridorViewports.stats, viewportViews:world.corridorViewports.views, meetingStats:world.meeting.stats, serviceStats:world.services.stats, habitationStats:world.habitation.stats, roomCharacterStats:world.roomCharacterStats, realismStats:world.realismStats, focusedDevice:focusedDevice?.id, devices:world.devices.map(d=>({id:d.id,roomId:d.roomId,zone:d.zone,label:d.label,x:d.x,y:d.y,z:d.z,range:d.range,approach:d.approach,state:typeof d.state==='function'?d.state():d.state})), raytrace: {state:photoState,error:photoError,...photoController?.stats()}, active, started, modal, position: { ...position }, elevation: floorHeight(), cameraY: camera.position.y, sky: { backgroundType: scene.background?.isCubeTexture ? 'CubeTexture' : scene.background?.type, pointClouds }, lighting: {quality,shadowsEnabled:renderer.shadowMap.enabled,shadowMapType:renderer.shadowMap.type,ssaoEnabled:!!ambientOcclusion?.enabled,bloomEnabled:!!bloom?.enabled,...world.lightingStats()}, lifeScienceStats:world.lifeScienceStats, quarterStats:world.quarterStats, fixtureStats:world.fixtureStats, detailStats: world.detailStats, screenStats: world.screenStats, importedStats: world.importedStats, yaw, pitch, visited: [...visited], target: target.id, nearRoom: nearRoom?.id, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, rooms, route: guidanceRoute(), doors: (world.doors || []).map(d => ({ id: d.id, variant:d.variant, number:d.number, x: d.x, z: d.z, axis: d.axis, openness: d.openness })), colliders: world.colliders || [] }),
    // Development-only positioning lets the browser test inspect every terminal.
    teleport: (x, z, facing = 0, deck = 'station', tilt = 0) => { layer=deck;transition=null;position = { x, z }; eyeHeight = floorHeight()+1.6; yaw = facing; pitch = tilt; },
    renderInfo: () => renderer.info,
    viewportClearance: () => world.corridorViewports.checkSightlines(world.root),
  };
}
