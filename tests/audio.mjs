import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Real Web Audio without loading the Three.js world or competing for its GPU.
// Optional AUDIO_GAME_URL also tests the actual game's persisted mute UI.
const modules = new Map(await Promise.all(['audio', 'layout'].map(async name =>
  [`/${name}.js`, await readFile(new URL(`../src/${name}.js`, import.meta.url), 'utf8')])));
const html = `<!doctype html><meta charset="utf-8"><title>Station audio test</title>
<button id="unlock">Unlock audio</button><button id="unmute">Unmute</button>
<script type="module">
  const NativeContext = window.AudioContext;
  window.createdNodes = 0;
  window.AudioContext = class extends NativeContext {
    constructor(...args) {
      super(...args); window.testContext = this;
      for (const method of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter',
        'createPanner', 'createStereoPanner', 'createDynamicsCompressor', 'createDelay']) {
        const original = this[method].bind(this);
        this[method] = (...values) => {
          window.createdNodes++;
          const value = original(...values);
          if (method === 'createDynamicsCompressor') window.outputNode = value;
          return value;
        };
      }
    }
  };
  const { createStationAudio } = await import('/audio.js');
  window.createStationAudio = createStationAudio;
  window.engine = createStationAudio();
  document.getElementById('unlock').onclick = () => { window.unlockResult = engine.unlock(); };
  document.getElementById('unmute').onclick = () => engine.setMuted(false);
  window.sampleRMS = () => {
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  };
</script>`;
const server = createServer((request, response) => {
  if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  const content = request.url === '/' ? html : modules.get(request.url);
  response.writeHead(content ? 200 : 404, { 'Content-Type': request.url.endsWith('.js') ? 'text/javascript' : 'text/html' });
  response.end(content || 'Not found');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
let browser;
const errors = [], assetErrors = [], report = { checks: [], integration: null };
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) assetErrors.push(`${response.status()} ${response.url()}`); });
  const state = () => page.evaluate(() => engine.getState());
  const pass = description => { report.checks.push(description); console.log(`PASS: ${description}`); };

  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.engine);
  assert.equal(await page.evaluate(() => Boolean(window.testContext)), false, 'Constructing audio never creates an AudioContext');
  assert.equal(await page.evaluate(() => engine.play('scan')), false, 'Locked effects are silent');
  await page.evaluate(() => { engine.setMuted(true); engine.setRoom('archive'); engine.update({ zone: 'interior' }); });
  assert.equal(await page.evaluate(() => Boolean(window.testContext)), false, 'Configuration before Enter never opens audio');
  await page.getByRole('button', { name: 'Unlock audio', exact: true }).click();
  assert.equal(await page.evaluate(() => unlockResult), true, 'A trusted gesture resumes the real browser AudioContext');
  assert.equal((await state()).muted, true, 'A mute preference supplied before Enter survives unlock');
  await page.evaluate(() => {
    window.analyser = testContext.createAnalyser(); analyser.fftSize = 2048;
    // Insert the analyser inline: an unconsumed analyser branch may not be pulled.
    outputNode.disconnect(testContext.destination); outputNode.connect(analyser); analyser.connect(testContext.destination);
  });
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(() => sampleRMS()), 0, 'Muted startup emits no samples');
  const allocated = await page.evaluate(() => createdNodes);
  pass('Gesture-only context creation, configuration while locked, and silent muted startup.');

  await page.getByRole('button', { name: 'Unmute', exact: true }).click();
  await page.evaluate(() => {
    engine.setRoom('front-door');
    engine.update({ position: { x: 0, y: 1.6, z: 1 }, dt: .016, doors: [{ id: 'hatch', x: 0, z: -1, openness: 0 }] });
    engine.update({ distance: .80, dt: .016, doors: [{ id: 'hatch', x: 0, z: -1, openness: .006 }] });
    engine.play('scan');
  });
  await page.waitForTimeout(180);
  report.audibleRMS = await page.evaluate(() => sampleRMS());
  assert.ok(report.audibleRMS > .00002, 'The real synth graph emits audible samples');
  assert.equal((await state()).footsteps, 1, 'One stride emits one footstep');
  assert.equal((await state()).doorCues, 1, 'Very slow hatch startup emits its opening cue');
  await page.evaluate(() => {
    for (const openness of [.014, .027, .2, .7, 1]) engine.update({ doors: [{ id: 'hatch', x: 0, z: -1, openness }] });
    engine.update({ distance: 80, dt: .016 });
    engine.update({ distance: NaN, dt: .016 });
  });
  assert.equal((await state()).doorCues, 1, 'Opening one hatch never repeats a cue near an endpoint');
  assert.equal((await state()).footsteps, 1, 'Teleport and invalid distances never create step bursts');
  await page.waitForTimeout(450);
  await page.evaluate(() => {
    for (const openness of [.994, .98, .2, .02, 0, 0]) engine.update({ doors: [{ id: 'hatch', x: 0, z: -1, openness }] });
  });
  assert.equal((await state()).doorCues, 2, 'One closing motion emits exactly one sliding cue');
  assert.equal(await page.evaluate(() => engine.play('console', { x: 500, y: 1, z: 500 })), false, 'Distant equipment is culled');
  pass('Real signal, distance footsteps, teleport suppression, spatial range and one cue per hatch motion.');

  report.profiles = await page.evaluate(() => ['front-door', 'archive', 'floor', 'lab', 'commons', 'forum', 'bridge'].map(id => {
    engine.setRoom(id); engine.update({ dt: .016 }); return engine.getState().profile;
  }));
  assert.deepEqual(report.profiles, ['front-door', 'archive', 'floor', 'lab', 'commons', 'forum', 'bridge']);
  await page.evaluate(() => engine.setRoom(null));
  assert.equal((await state()).profile, 'bridge', 'Corridors retain the last room score');
  for (const [input, expected] of [['eva', 'exterior'], ['cupola', 'cupola'], ['airlock', 'airlock']]) {
    await page.evaluate(zone => engine.update({ zone }), input);
    assert.equal((await state()).profile, expected);
    if (expected === 'exterior') {
      assert.equal(await page.evaluate(() => engine.play('door-open', { x: 0, y: 1, z: 0 })), false, 'Vacuum suppresses pneumatic door audio');
      assert.equal(await page.evaluate(() => engine.play('machinery')), false, 'Vacuum suppresses external machinery');
    }
  }
  await page.evaluate(() => engine.update({ zone: 'interior', position: { x: 2, y: 3.1, z: -7 }, yaw: Math.PI / 2 }));
  assert.equal((await state()).profile, 'bridge', 'Leaving a special zone restores the room score');
  const listener = await page.evaluate(() => ({ x: testContext.listener.positionX.value, y: testContext.listener.positionY.value,
    z: testContext.listener.positionZ.value, forwardX: testContext.listener.forwardX.value, forwardZ: testContext.listener.forwardZ.value }));
  assert.deepEqual([listener.x, listener.y, listener.z], [2, Math.fround(3.1), -7]);
  assert.ok(Math.abs(listener.forwardX + 1) < .0001 && Math.abs(listener.forwardZ) < .0001, 'Listener orientation matches the camera yaw');
  pass('Seven room profiles, airlock/EVA/cupola transitions, vacuum filtering and spatial listener updates.');

  // Exercise actual suspend/resume while deterministically driving the visibility
  // handler. Headless browsers do not expose tab visibility like interactive ones.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => engine.getState().contextState === 'suspended');
  assert.equal(await page.evaluate(() => engine.play('scan')), false, 'Hidden-tab audio is suspended');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => engine.getState().contextState === 'running');
  await page.evaluate(() => delete document.hidden);
  pass('Visibility changes suspend and resume the actual AudioContext.');

  report.stress = await page.evaluate(() => {
    for (let i = 0; i < 400; i++) {
      engine.play('scan'); engine.update({ position: { x: 0, y: 1.6, z: 0 }, yaw: i * .01, dt: .016, distance: .06 });
    }
    return { nodes: createdNodes, state: engine.getState() };
  });
  assert.equal(report.stress.nodes, allocated, 'Effects, movement, room changes and visibility allocate no new graph nodes');
  assert.ok(report.stress.state.activeVoices <= report.stress.state.voiceLimit, 'Effects stay within the fixed voice cap');
  assert.ok(report.stress.state.dropped > 0, 'Excess cues are dropped rather than expanding the graph');
  await page.evaluate(() => engine.setMuted(true));
  await page.waitForTimeout(1000);
  report.mutedRMS = await page.evaluate(() => sampleRMS());
  assert.ok(report.mutedRMS < .00002, 'Mute fades the entire output to silence');
  assert.equal(await page.evaluate(() => engine.play('scan')), false, 'Muted input cannot schedule effects');
  await page.getByRole('button', { name: 'Unmute', exact: true }).click();
  await page.evaluate(() => engine.play('scan'));
  await page.waitForTimeout(180);
  assert.ok(await page.evaluate(() => sampleRMS()) > .00002, 'Sound returns after unmuting');
  pass('400-cue stress uses a fixed graph, caps voices, mutes to silence and resumes sound.');

  await page.evaluate(() => engine.dispose());
  assert.equal((await state()).contextState, 'closed');
  assert.equal((await state()).allocatedSources, 0);
  assert.equal(await page.evaluate(() => engine.unlock()), false, 'Disposed audio cannot be revived');
  await page.evaluate(() => engine.dispose());
  const unsupported = await page.evaluate(async () => {
    const standard = window.AudioContext, legacy = window.webkitAudioContext;
    window.AudioContext = undefined; window.webkitAudioContext = undefined;
    const unavailable = createStationAudio();
    const result = { supported: unavailable.getState().supported, unlocked: await unavailable.unlock(), played: unavailable.play('scan') };
    await unavailable.dispose(); window.AudioContext = standard; window.webkitAudioContext = legacy;
    return result;
  });
  assert.deepEqual(unsupported, { supported: false, unlocked: false, played: false });
  pass('Idempotent disposal releases sources; unsupported browsers fail silently and safely.');

  if (process.env.AUDIO_GAME_URL) {
    // Explicit opt-in: this block loads the actual GPU game. The default test
    // above remains safe to run alongside graphics validation.
    const game = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    game.on('pageerror', error => errors.push(error.message));
    await game.goto(process.env.AUDIO_GAME_URL);
    await game.locator('#loading').waitFor({ state: 'hidden', timeout: 45000 });
    await game.evaluate(() => localStorage.setItem('uss-sentient-muted', 'true'));
    await game.reload();
    await game.locator('#loading').waitFor({ state: 'hidden', timeout: 45000 });
    assert.equal(await game.locator('#sound-btn').getAttribute('aria-pressed'), 'false');
    await game.getByRole('button', { name: 'ENTER THE STATION' }).click();
    await game.waitForFunction(() => document.body.classList.contains('playing'));
    await game.keyboard.press('Escape');
    await game.getByRole('button', { name: 'Enable station audio', exact: true }).click();
    assert.equal(await game.evaluate(() => localStorage.getItem('uss-sentient-muted')), 'false');
    await game.reload();
    await game.locator('#loading').waitFor({ state: 'hidden', timeout: 45000 });
    assert.equal(await game.locator('#sound-btn').getAttribute('aria-pressed'), 'true');
    await game.getByRole('button', { name: 'Mute station audio', exact: true }).click();
    assert.equal(await game.evaluate(() => localStorage.getItem('uss-sentient-muted')), 'true');
    report.integration = { url: process.env.AUDIO_GAME_URL, persistedMute: true, persistedUnmute: true };
    await game.close();
    pass('Actual game mute/unmute controls persist across reloads.');
  }
  assert.deepEqual(errors, [], 'No browser errors');
  assert.deepEqual(assetErrors, [], 'No module request failures');
  report.allocatedNodes = allocated; report.errors = errors; report.assetErrors = assetErrors;
  await writeFile(new URL('../test-results/audio-validation.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(`PASS: all audio checks; ${allocated} fixed nodes and ${report.stress.state.allocatedSources} sources.`);
} catch (error) {
  console.error('Audio diagnostics:', { ...report, errors, assetErrors });
  throw error;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
