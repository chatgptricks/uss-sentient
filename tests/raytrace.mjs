import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 1 });
// Keep a frozen test page while other local modules are edited.
await page.routeWebSocket('**', () => {});
const errors = [], requests = [], states = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !/pointer.?lock/i.test(message.text())) errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) requests.push(`${response.status()} ${response.url()}`); });
const state = () => page.evaluate(() => window.__SENTIENT__.snapshot());
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden);
  await page.getByRole('button', { name: 'ENTER THE STATION' }).click();
  await page.evaluate(() => window.__SENTIENT__.teleport(0, -32.6, 0));
  await page.waitForTimeout(1200);
  const before = await state();
  await page.keyboard.press('r');
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().raytrace.state !== 'idle');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().raytrace.state === 'idle');
  assert.equal((await state()).active, true, 'Cancel while loading returns to exploration');
  console.log('PASS: ray-tracer load can be cancelled.');

  await page.keyboard.press('r');
  await page.waitForFunction(() => {
    const r = window.__SENTIENT__.snapshot().raytrace;
    return r.error || r.samples >= 4;
  }, null, { timeout: 180000 });
  const tracing = await state();
  console.log('RAY TRACE:', JSON.stringify(tracing.raytrace));
  assert.equal(tracing.raytrace.error, null, 'Real path tracer initializes without a shader or driver failure');
  assert.ok(tracing.raytrace.samples >= 4, 'Actual progressive GPU light samples accumulate');
  assert.ok(tracing.raytrace.meshes > 1000 && tracing.raytrace.instances > 1000, 'All instanced station equipment is expanded for the tracer');
  assert.equal(tracing.raytrace.bounces, 5, 'Lighting includes multiple ray bounces');
  assert.equal(tracing.active, false, 'Walking is frozen while the image accumulates');
  assert.deepEqual(tracing.position, before.position, 'Camera position stays fixed');
  await page.keyboard.press('w');
  assert.deepEqual((await state()).position, tracing.position, 'Movement keys cannot disturb the still view');
  await page.screenshot({ path: 'test-results/raytraced-bridge.png' });
  states.push(tracing.raytrace);
  await page.getByRole('button', { name: /BACK TO EXPLORATION/ }).click();
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().active);
  assert.equal((await state()).raytrace.state, 'idle');
  await page.keyboard.down('s'); await page.waitForTimeout(500); await page.keyboard.up('s');
  assert.ok((await state()).position.z > tracing.position.z + .15, 'Real keyboard movement works after the ray tracer is disposed');
  assert.equal((await state()).lighting.shadowsEnabled, before.lighting.shadowsEnabled, 'The chosen gameplay lighting quality is restored');
  await page.screenshot({ path: 'test-results/raytrace-resumed.png' });
  console.log('PASS: genuine ray-traced samples, frozen view, disposal, and resumed keyboard movement.');

  // Repeat in another room to catch retained camera/material/worker state.
  await page.evaluate(() => window.__SENTIENT__.teleport(11.5, -21.4, 0));
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: /RENDER VIEW/ }).click();
  await page.waitForFunction(() => {
    const r = window.__SENTIENT__.snapshot().raytrace;
    return r.error || r.samples >= 2;
  }, null, { timeout: 180000 });
  const again = await state();
  assert.equal(again.raytrace.error, null);
  assert.ok(again.raytrace.samples >= 2);
  await page.screenshot({ path: 'test-results/raytraced-botany.png' });
  states.push(again.raytrace);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().active);
  assert.deepEqual(errors, [], 'No browser or shader errors');
  assert.deepEqual(requests, [], 'No failed worker, module, or texture requests');
  await writeFile('test-results/raytrace-validation.json', JSON.stringify({ states, errors, requests }, null, 2));
  console.log('PASS: second-room settings entry, rendering and Escape recovery.');
} catch (error) {
  console.log('RAY TRACE DIAGNOSTIC:', await state().then(s => s.raytrace).catch(() => null), errors, requests);
  await page.screenshot({ path: 'test-results/raytrace-failure.png' }).catch(() => {});
  throw error;
} finally { await browser.close(); }
