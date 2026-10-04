import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Production smoke: public DOM, real keyboard input, and actual network/GPU work.
// Deliberately does not depend on development instrumentation or teleportation.
const base = process.env.GAME_URL || 'http://127.0.0.1:4183/uss-sentient/';
const origin = new URL(base), startedAt = Date.now();
const errors = [], failedAssets = [], models = new Set(), fonts = new Set(), brand = new Set(), workers = new Set(), workerResponses = new Set();
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && !/pointer.?lock/i.test(message.text())) errors.push(message.text());
});
page.on('worker', worker => workers.add(worker.url()));
context.on('response', response => {
  const url = response.url(), path = new URL(url).pathname;
  if (response.status() >= 400) failedAssets.push(`${response.status()} ${url}`);
  if (!response.ok()) return;
  if (/\/models\/.+\.glb$/.test(path)) models.add(url);
  if (/\/brand\/.+\.(?:ttf|woff2?)$/.test(path)) fonts.add(url);
  if (/\/brand\/.+\.svg$/.test(path)) brand.add(url);
  if (/generateMeshBVH\.worker[^/]*\.js$/.test(path)) workerResponses.add(url);
});
const playing = () => page.waitForFunction(() => document.body.classList.contains('playing'));

try {
  const response = await page.goto(base);
  assert.ok(response?.ok(), 'The deployed document loads');
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(models.size, 19, 'All 19 production GLBs load');
  assert.equal(fonts.size, 2, 'Both bundled brand fonts load');
  assert.ok([...brand].some(url => url.endsWith('/sentient-logo.svg')), 'The Sentient logo loads');
  for (const url of [...models, ...fonts, ...brand]) {
    const asset = new URL(url);
    assert.equal(asset.origin, origin.origin, 'Game assets stay on the deployment origin');
    assert.ok(asset.pathname.startsWith(origin.pathname), 'Game assets retain the repository base path');
  }

  await page.getByRole('button', { name: 'Open settings' }).click();
  assert.equal(await page.getByLabel('Graphics quality').inputValue(), 'performance', 'Production defaults to Performance');
  await page.getByLabel('Close dialog').click();
  await page.getByRole('button', { name: 'ENTER THE STATION' }).click();
  await playing();
  assert.equal(await page.locator('#location-name').textContent(), 'The Front Door');

  const frame = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const canvas = document.getElementById('world'), gl = canvas.getContext('webgl2');
    const pixels = new Uint8Array(64 * 64 * 4);
    gl.readPixels(Math.floor(canvas.width / 2) - 32, Math.floor(canvas.height / 2) - 32, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    resolve({ width: canvas.width, height: canvas.height, colors: colors.size, error: gl.getError() });
  })));
  assert.equal(frame.error, 0, 'Reading the actual WebGL frame succeeds');
  assert.ok(frame.colors > 8 && frame.width >= 1000, 'The production canvas contains rendered station geometry');
  console.log('PASS: production initialization, 19 models, bundled fonts/brand, Performance default, and actual WebGL frame.');

  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(() => document.getElementById('location-name').textContent === 'The Archive');
  } finally { await page.keyboard.up('KeyW'); }
  await page.screenshot({ path: 'test-results/deployment-game.png' });
  await page.keyboard.press('KeyM');
  await page.getByRole('button', { name: 'Navigate to The Bridge', exact: true }).click();
  await playing();
  await page.waitForFunction(() => /BRIDGE/.test(document.getElementById('route-destination').textContent));
  console.log('PASS: real keyboard movement traverses the automatic hatches into Archive; map selection activates Bridge guidance.');

  await page.keyboard.press('KeyR');
  await page.locator('#photo-panel').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const status = document.getElementById('photo-status').textContent;
    const samples = status.match(/^(\d+) light samples/);
    return samples && Number(samples[1]) >= 1;
  }, null, { timeout: 60000 });
  const photoStatus = await page.locator('#photo-status').textContent();
  assert.ok([...workers].some(url => /generateMeshBVH\.worker/.test(url)), 'The deployed BVH worker actually starts');
  assert.ok(workerResponses.size > 0, 'The bundled BVH worker URL returns a successful HTTP response');
  for (const url of workerResponses) assert.ok(new URL(url).pathname.startsWith(origin.pathname), 'The worker resolves under the Pages repository base');
  await page.keyboard.press('Escape');
  await page.locator('#photo-panel').waitFor({ state: 'hidden' });
  await playing();
  await page.keyboard.down('KeyS');
  try {
    await page.waitForFunction(() => document.getElementById('location-name').textContent === 'Pressure tunnel');
  } finally { await page.keyboard.up('KeyS'); }
  assert.deepEqual(errors, [], 'No JavaScript or WebGL errors');
  assert.deepEqual(failedAssets, [], 'No failed production asset or worker requests');
  await writeFile('test-results/deployment-validation.json', JSON.stringify({ url: base, elapsedSeconds: +(Date.now() - startedAt).toFixed(0) / 1000, frame, models: [...models], fonts: [...fonts], brand: [...brand], workers: [...workers], workerResponses: [...workerResponses], photoStatus, errors, failedAssets }, null, 2));
  console.log(`PASS: production ray tracer accumulated ${photoStatus}; Escape restored real movement. No browser, shader, or HTTP errors. ${(Date.now() - startedAt) / 1000}s total.`);
} catch (error) {
  console.error('Production diagnostics:', { errors, failedAssets, models: models.size, workers: [...workers], photoStatus: await page.locator('#photo-status').textContent().catch(() => null) });
  await page.screenshot({ path: 'test-results/deployment-failure.png' }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
