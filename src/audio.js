import { MODULES } from './layout.js';

// All music shares the D-dorian pitch collection, so adjacent rooms can overlap.
// Space is silent: EVA keeps a muted score and helmet-conducted footsteps only.
const PROFILES = {
  'front-door': { chord: [50, 57, 64], motif: [74, null, 69, 76, null, 74, null, 69], pace: 1.28, cutoff: 1550, hum: 73, air: .020 },
  floor: { chord: [50, 57, 60], motif: [62, null, 69, 74, null, 65, null, 69], pace: .92, cutoff: 1180, hum: 55, air: .029 },
  archive: { chord: [50, 57, 65], motif: [74, null, null, 81, 77, null, 76, null], pace: 1.60, cutoff: 1040, hum: 65, air: .012 },
  commons: { chord: [53, 60, 67], motif: [77, 79, null, 84, 81, null, 79, null], pace: 1.35, cutoff: 2200, hum: 87, air: .024 },
  forum: { chord: [55, 62, 69], motif: [79, null, 74, 81, null, 76, 74, null], pace: 1.08, cutoff: 1760, hum: 82, air: .017 },
  lab: { chord: [52, 59, 62], motif: [76, null, 83, 86, null, 81, 79, null], pace: 1.42, cutoff: 2050, hum: 98, air: .019 },
  bridge: { chord: [50, 57, 62, 69], motif: [86, null, 81, null, 88, null, 84, null], pace: 1.82, cutoff: 2500, hum: 49, air: .015 },
  airlock: { chord: [50, 57, 60], motif: [62, null, null, 69, null, null, 65, null], pace: 1.85, cutoff: 850, hum: 61, air: .031 },
  exterior: { chord: [50, 57, 64], motif: [86, null, null, 93, null, 88, null, null], pace: 2.40, cutoff: 1450, hum: 49, air: 0 },
  cupola: { chord: [50, 57, 64, 69], motif: [86, 88, null, 93, 91, null, 88, null], pace: 1.95, cutoff: 2900, hum: 49, air: .009 },
};
const EFFECT_LIMIT = 14, MUSIC_VOICES = 8, MASTER_LEVEL = .60;
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

/**
 * Procedural station audio; constructing this object creates no AudioContext.
 * Call unlock() directly in an Enter/click/touch handler. `distance` is metres
 * moved THIS update (not total distance); position.y is the camera/ear height.
 * Zone can be a string or {id/type}; supported special zones are airlock,
 * exterior/eva and cupola. Optional door.y is the sound source's world height.
 */
export function createStationAudio() {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  let context, master, helmet, machineryBus, musicBus, noiseBuffer, disposed = false;
  let unlocked = false, muted = false, error = null, room = 'front-door', zone = 'interior';
  let profile = 'front-door', deckIndex = 0, stepDistance = 0, lastStep = -1, leftFoot = false;
  let lastMaintenance = 0, ambienceTime = 0, nextMachine = 5, lastMachineRoom;
  const nodes = [], sources = [], effects = [], decks = [], machinery = [], doorStates = new Map();
  const listenerPosition = { x: 0, y: 1.6, z: 1.3 };
  let listenerYaw = 0;
  const counts = { footsteps: 0, doorCues: 0, notes: 0, dropped: 0 };

  const node = value => { nodes.push(value); return value; };
  const source = value => { sources.push(value); return node(value); };
  function target(param, value, seconds = .15) {
    if (!param || !context) return;
    const now = context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
    param.setTargetAtTime(value, now, seconds);
  }
  function setXYZ(object, value) {
    if (object.positionX) {
      object.positionX.value = finite(value.x);
      object.positionY.value = finite(value.y, 1.2);
      object.positionZ.value = finite(value.z);
    } else object.setPosition(finite(value.x), finite(value.y, 1.2), finite(value.z));
  }
  function makePanner() {
    const pan = node(context.createPanner());
    // Equal-power positioning is inexpensive even on the phone performance mode.
    pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse';
    pan.refDistance = 1.8; pan.maxDistance = 22; pan.rolloffFactor = 1.15;
    return pan;
  }
  function makeVoice(destination, spatial = false) {
    const filter = node(context.createBiquadFilter()); filter.type = 'lowpass'; filter.Q.value = .55;
    const gain = node(context.createGain()); gain.gain.value = 0;
    const oscillator = source(context.createOscillator()); oscillator.type = 'sine';
    oscillator.connect(gain); gain.connect(filter); oscillator.start();
    const partialGain = node(context.createGain()); partialGain.gain.value = 0;
    const partial = source(context.createOscillator()); partial.type = 'sine';
    partial.connect(partialGain); partialGain.connect(filter); partial.start();
    let noiseGain;
    if (spatial) {
      noiseGain = node(context.createGain()); noiseGain.gain.value = 0;
      const noise = source(context.createBufferSource()); noise.buffer = noiseBuffer; noise.loop = true;
      noise.connect(noiseGain); noiseGain.connect(filter); noise.start();
    }
    const panner = spatial ? makePanner() : node(context.createStereoPanner());
    filter.connect(panner); panner.connect(destination);
    return { oscillator, partial, gain, partialGain, noiseGain, filter, panner, end: 0 };
  }
  function envelope(param, start, peak, attack, duration) {
    param.cancelScheduledValues(context.currentTime);
    param.setValueAtTime(0, start);
    param.linearRampToValueAtTime(peak, start + attack);
    param.exponentialRampToValueAtTime(Math.max(.00001, peak * .012), start + duration);
    param.linearRampToValueAtTime(0, start + duration + .025);
  }
  function sound(voice, { when = context.currentTime, frequency = 100, endFrequency = frequency,
    duration = .3, attack = .012, tone = .04, overtone = .12, noise = 0, cutoff = 1400, point, pan = 0 }) {
    voice.end = when + duration + .035;
    for (const [oscillator, multiplier] of [[voice.oscillator, 1], [voice.partial, 2.002]]) {
      oscillator.frequency.cancelScheduledValues(context.currentTime);
      oscillator.frequency.setValueAtTime(Math.max(12, frequency * multiplier), when);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(12, endFrequency * multiplier), when + duration);
    }
    voice.filter.frequency.value = cutoff;
    envelope(voice.gain.gain, when, tone, attack, duration);
    envelope(voice.partialGain.gain, when, tone * overtone, attack, duration * .77);
    if (voice.noiseGain) envelope(voice.noiseGain.gain, when, noise, attack, duration);
    if (voice.panner.pan) voice.panner.pan.value = pan;
    else setXYZ(voice.panner, point || listenerPosition);
  }
  function claim(list) {
    const voice = list.find(item => item.end <= context.currentTime);
    if (!voice) counts.dropped++;
    return voice;
  }
  function effect(options) {
    const voice = claim(effects);
    if (!voice) return false;
    sound(voice, options); return true;
  }
  function normalizedZone(value) {
    const key = String(typeof value === 'object' && value ? value.id || value.type || '' : value || 'interior').toLowerCase();
    if (/exterior|eva|outside|spacewalk/.test(key)) return 'exterior';
    if (/cupola/.test(key)) return 'cupola';
    if (/airlock/.test(key)) return 'airlock';
    return 'interior';
  }
  function wantedProfile() { return zone === 'interior' ? room : zone; }
  function applyProfile(force = false) {
    const next = wantedProfile();
    if (!force && next === profile) return;
    profile = next;
    if (!context || !decks.length) return;
    deckIndex = force ? 0 : 1 - deckIndex;
    const deck = decks[deckIndex]; deck.profile = next; deck.step = 0;
    deck.nextNote = context.currentTime + .08; deck.nextChord = context.currentTime + .03;
    for (const item of decks) target(item.gain.gain, item === deck ? 1 : 0, 1.9);
    const definition = PROFILES[next];
    const module = MODULES.find(item => item.id === room) || MODULES[0];
    const equipment = { x: module.x - module.hx + .32, y: module.elevation + 1.1, z: module.z + .45 };
    setXYZ(machinery[0].panner, equipment);
    setXYZ(machinery[1].panner, { x: module.x + .6, y: module.elevation + 2.6, z: module.z - module.hz + .3 });
    machinery[0].oscillator.frequency.setTargetAtTime(definition.hum, context.currentTime, 2.3);
    target(machinery[0].gain.gain, zone === 'exterior' ? 0 : .009, 1.6);
    target(machinery[1].gain.gain, definition.air, 1.8);
    // The filter also softens suit-transmitted cues; it never pretends open
    // vacuum carries nearby machinery or pneumatic door noise.
    target(helmet.frequency, zone === 'exterior' ? 1100 : zone === 'airlock' ? 3600 : 14000, .8);
    target(musicBus.gain, zone === 'exterior' ? .48 : zone === 'cupola' ? .92 : .80, 1.5);
  }
  function makeMachinery(noise) {
    const gain = node(context.createGain()); gain.gain.value = 0;
    const filter = node(context.createBiquadFilter()); filter.type = noise ? 'bandpass' : 'lowpass';
    filter.frequency.value = noise ? 440 : 200; filter.Q.value = noise ? .55 : .5;
    const oscillator = source(noise ? context.createBufferSource() : context.createOscillator());
    if (noise) { oscillator.buffer = noiseBuffer; oscillator.loop = true; }
    else { oscillator.type = 'sine'; oscillator.frequency.value = 73; }
    const panner = makePanner();
    oscillator.connect(filter); filter.connect(gain); gain.connect(panner); panner.connect(machineryBus); oscillator.start();
    return { oscillator, gain, panner };
  }
  function initialize() {
    master = node(context.createGain()); master.gain.value = 0;
    helmet = node(context.createBiquadFilter()); helmet.type = 'lowpass'; helmet.frequency.value = 14000; helmet.Q.value = .45;
    const compressor = node(context.createDynamicsCompressor());
    compressor.threshold.value = -16; compressor.knee.value = 18; compressor.ratio.value = 3;
    compressor.attack.value = .008; compressor.release.value = .22;
    helmet.connect(master); master.connect(compressor); compressor.connect(context.destination);
    machineryBus = node(context.createGain()); machineryBus.gain.value = 1; machineryBus.connect(helmet);
    musicBus = node(context.createGain()); musicBus.gain.value = .8; musicBus.connect(helmet);
    // A small, damped stereo echo gives sparse notes depth without a reverb asset.
    const echo = node(context.createDelay(1)); echo.delayTime.value = .375;
    const echoFilter = node(context.createBiquadFilter()); echoFilter.frequency.value = 1600;
    const feedback = node(context.createGain()); feedback.gain.value = .16;
    const echoLevel = node(context.createGain()); echoLevel.gain.value = .12;
    musicBus.connect(echo); echo.connect(echoFilter); echoFilter.connect(feedback); feedback.connect(echo);
    echoFilter.connect(echoLevel); echoLevel.connect(helmet);

    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let brown = 0, random = 173;
    for (let i = 0; i < data.length; i++) {
      random = (Math.imul(random, 1664525) + 1013904223) | 0;
      brown = (brown + (((random >>> 0) / 4294967296) * 2 - 1) * .035) / 1.018;
      const edge = Math.min(1, i / 512, (data.length - 1 - i) / 512);
      data[i] = brown * 3.8 * edge;
    }
    for (let i = 0; i < EFFECT_LIMIT; i++) effects.push(makeVoice(helmet, true));
    for (let i = 0; i < 2; i++) {
      const gain = node(context.createGain()); gain.gain.value = 0; gain.connect(musicBus);
      const voices = Array.from({ length: MUSIC_VOICES }, () => makeVoice(gain));
      decks.push({ gain, voices, profile: 'front-door', step: 0, nextNote: 0, nextChord: 0 });
    }
    machinery.push(makeMachinery(false), makeMachinery(true));
    applyProfile(true);
    updateListener();
  }
  function updateListener() {
    const listener = context.listener;
    setXYZ(listener, listenerPosition);
    if (listener.forwardX) {
      listener.forwardX.value = -Math.sin(listenerYaw); listener.forwardY.value = 0; listener.forwardZ.value = -Math.cos(listenerYaw);
      listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
    } else listener.setOrientation(-Math.sin(listenerYaw), 0, -Math.cos(listenerYaw), 0, 1, 0);
  }
  function unlock() {
    if (disposed || !Context) return Promise.resolve(false);
    try {
      if (!context) context = new Context({ latencyHint: 'interactive' });
      // Do not await anything before resume: Safari requires the actual gesture.
      const resumed = context.resume();
      if (!master) initialize();
      return Promise.resolve(resumed).then(() => {
        if (disposed) return false;
        unlocked = context.state === 'running';
        if (unlocked) { error = null; target(master.gain, muted ? 0 : MASTER_LEVEL, .25); }
        return unlocked;
      }).catch(reason => { error = reason?.message || 'Audio could not resume'; return false; });
    } catch (reason) { error = reason?.message || 'Audio could not initialize'; return Promise.resolve(false); }
  }
  function setMuted(value) {
    if (disposed) return;
    muted = Boolean(value); stepDistance = 0;
    if (master) target(master.gain, muted || !unlocked ? 0 : MASTER_LEVEL, .10);
  }
  function setRoom(id) {
    if (disposed) return;
    if (typeof id === 'object' && id) id = id.id;
    const next = Object.hasOwn(PROFILES, id) ? id : room;
    if (next === room) return;
    room = next; applyProfile();
  }
  function playable() { return context && unlocked && !muted && !disposed && context.state === 'running'; }

  function play(type, point) {
    if (!playable()) return false;
    const key = String(type || '').toLowerCase();
    const place = point || listenerPosition;
    if (point && Math.hypot(finite(point.x) - listenerPosition.x, finite(point.z) - listenerPosition.z) > 17) return false;
    if (zone === 'exterior' && /door|machinery|airlock/.test(key)) return false;
    if (key === 'step' || key === 'footstep') {
      counts.footsteps++;
      return effect({ point: place, frequency: zone === 'exterior' ? 82 : 124, endFrequency: 43, tone: .115,
        noise: zone === 'exterior' ? .007 : .038, duration: .17, cutoff: zone === 'exterior' ? 430 : 1050, overtone: .08 });
    }
    if (/^door/.test(key)) {
      counts.doorCues++;
      const closing = key.includes('close');
      return effect({ point: place, frequency: closing ? 108 : 72, endFrequency: closing ? 57 : 132,
        tone: .029, noise: .045, duration: .67, attack: .06, cutoff: 1300, overtone: .22 });
    }
    if (key === 'latch') return effect({ point: place, frequency: 170, endFrequency: 57, tone: .045, noise: .015, duration: .10, cutoff: 900 });
    if (key === 'airlock') return effect({ point: place, frequency: 78, endFrequency: 49, tone: .026, noise: .05, duration: 1.25, attack: .16, cutoff: 760 });
    if (key === 'machinery') return effect({ point: place, frequency: 98, endFrequency: 73, tone: .012, noise: .012, duration: .85, attack: .20, cutoff: 690 });
    if (key === 'error' || key === 'denied') return effect({ point: place, frequency: hz(62), endFrequency: hz(60), tone: .04, duration: .28, cutoff: 1300 });
    const notes = /scan|discover|success|complete/.test(key) ? [74, 81, 86] : /console|terminal/.test(key) ? [74, 81] : [81];
    let played = false;
    for (let i = 0; i < notes.length; i++) played = effect({ point: place, when: context.currentTime + i * .13,
      frequency: hz(notes[i]), tone: .035, overtone: .08, duration: .48, attack: .015, cutoff: 2400 }) || played;
    return played;
  }
  function music(now) {
    const deck = decks[deckIndex], definition = PROFILES[deck.profile];
    if (now >= deck.nextChord) {
      for (let i = 0; i < definition.chord.length; i++) {
        const voice = claim(deck.voices); if (!voice) break;
        sound(voice, { frequency: hz(definition.chord[i]), tone: .014, overtone: .09, duration: 7.8, attack: 1.5,
          cutoff: definition.cutoff * .7, pan: (i - 1.5) * .18 }); counts.notes++;
      }
      deck.nextChord = now + 9.3;
    }
    if (now >= deck.nextNote) {
      const note = definition.motif[deck.step % definition.motif.length];
      if (note !== null) {
        const voice = claim(deck.voices);
        if (voice) { sound(voice, { frequency: hz(note), tone: .022, overtone: .16, duration: 2.2, attack: .055,
          cutoff: definition.cutoff, pan: Math.sin(deck.step * 1.8) * .30 }); counts.notes++; }
      }
      deck.step++; deck.nextNote = now + definition.pace;
    }
  }
  function updateDoors(doors, now) {
    for (const door of doors || []) {
      const id = door.id || `${door.x}:${door.z}`, openness = Math.max(0, Math.min(1, finite(door.openness)));
      const previous = doorStates.get(id);
      if (!previous) { doorStates.set(id, { openness, direction: 0, time: -5, seen: now }); continue; }
      const change = openness - previous.openness;
      const direction = Math.abs(change) > .001 ? Math.sign(change) : previous.direction;
      const point = { x: door.x, y: finite(door.y, finite(door.elevation, listenerPosition.y - 1.6) + 1.2), z: door.z };
      if (direction && direction !== previous.direction && now - previous.time > .4 && Math.abs(change) > .001) {
        play(direction > 0 ? 'door-open' : 'door-close', point); previous.time = now;
      }
      if (previous.openness >= .025 && openness < .025 && previous.direction < 0) play('latch', point);
      previous.direction = (direction < 0 && openness <= 0) || (direction > 0 && openness >= 1) ? 0 : direction;
      previous.openness = openness; previous.seen = now;
    }
    if (now - lastMaintenance > 10) {
      for (const [id, value] of doorStates) if (now - value.seen > 10) doorStates.delete(id);
      lastMaintenance = now;
    }
  }
  function update({ position, yaw = listenerYaw, dt = 0, distance = 0, sprinting = false, zone: nextZone = zone, doors = [] } = {}) {
    if (disposed) return;
    if (position) {
      listenerPosition.x = finite(position.x, listenerPosition.x); listenerPosition.y = finite(position.y, listenerPosition.y);
      listenerPosition.z = finite(position.z, listenerPosition.z);
    }
    listenerYaw = finite(yaw, listenerYaw);
    const newZone = normalizedZone(nextZone);
    if (newZone !== zone) { zone = newZone; applyProfile(); }
    if (!context || !unlocked) return;
    updateListener();
    const now = context.currentTime;
    updateDoors(doors, now);
    if (!playable()) { stepDistance = 0; return; }
    music(now);
    const moved = finite(distance), frame = Math.max(0, Math.min(.1, finite(dt)));
    if (moved > 0 && moved <= Math.max(1.6, frame * 12)) {
      stepDistance += moved;
      const stride = sprinting ? 1.02 : .77;
      if (stepDistance >= stride && now - lastStep > .16) {
        stepDistance %= stride; lastStep = now; leftFoot = !leftFoot;
        const side = leftFoot ? -.12 : .12;
        play('footstep', { x: listenerPosition.x + Math.cos(listenerYaw) * side,
          y: listenerPosition.y - 1.48, z: listenerPosition.z - Math.sin(listenerYaw) * side });
      }
    } else if (moved > 1.6) stepDistance = 0; // Teleports never emit a burst of footsteps.
    ambienceTime += frame;
    if (ambienceTime >= nextMachine && zone !== 'exterior') {
      const module = MODULES.find(item => item.id === room) || MODULES[0];
      play(lastMachineRoom === room ? 'machinery' : 'console', { x: module.terminal.x, y: module.elevation + 1.2, z: module.terminal.z });
      lastMachineRoom = room; nextMachine = ambienceTime + (room === 'floor' ? 13 : 21);
    }
  }
  function visibilityChanged() {
    if (!context || !unlocked || disposed) return;
    if (globalThis.document?.hidden) context.suspend().catch(() => {});
    else context.resume().catch(() => {});
  }
  globalThis.document?.addEventListener('visibilitychange', visibilityChanged);
  function getState() {
    return { supported: Boolean(Context), unlocked, muted, disposed, contextState: context?.state || 'locked', room, zone, profile,
      activeVoices: context ? effects.filter(item => item.end > context.currentTime).length : 0,
      voiceLimit: EFFECT_LIMIT, musicVoices: MUSIC_VOICES * 2, allocatedSources: sources.length, ...counts, error };
  }
  function dispose() {
    if (disposed) return Promise.resolve();
    disposed = true; unlocked = false;
    globalThis.document?.removeEventListener('visibilitychange', visibilityChanged);
    for (const item of sources) { try { item.stop(); } catch { /* Already stopped by the browser. */ } }
    for (const item of nodes) { try { item.disconnect(); } catch { /* Partial initialization can fail safely. */ } }
    sources.length = 0; nodes.length = 0; effects.length = 0; decks.length = 0; machinery.length = 0; doorStates.clear(); noiseBuffer = null;
    return context?.state !== 'closed' && context ? context.close().catch(() => {}) : Promise.resolve();
  }
  return { unlock, setMuted, setRoom, update, play, getState, dispose };
}
