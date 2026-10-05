import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Fixed poses also used for the original, pre-overhaul balanced captures.
const views = [
  { name: 'arrival', room: 'front-door', x: 0, z: 1.3, yaw: 0 },
  { name: 'corridor', x: 0, z: -5, yaw: 0 },
  { name: 'archive', room: 'archive', x: 0, z: -11, yaw: Math.PI * 3 / 4 },
  { name: 'lab', room: 'lab', x: -11, z: -22, yaw: Math.PI * 3 / 4 },
  { name: 'bridge', room: 'bridge', x: 0, z: -32.6, yaw: 0 },
  { name: 'bridge-console', room: 'bridge', x: 0, z: -36, yaw: 0 },
  { name: 'bridge-aft', room: 'bridge', x: 0, z: -36, yaw: Math.PI },
  { name: 'bridge-port', room: 'bridge', x: 0, z: -35, yaw: Math.PI / 2 },
];
const baseline = process.argv.includes('--baseline');
const qualities = baseline ? ['balanced'] : ['balanced', 'performance', 'high'];
const base = process.env.GAME_URL || 'http://127.0.0.1:5173';
const errors = [], assetErrors = [], results = [];
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && !/pointer.?lock/i.test(message.text())) errors.push(message.text());
});
page.on('response', response => { if (response.status() >= 400) assetErrors.push(`${response.status()} ${response.url()}`); });
const snapshot = () => page.evaluate(() => window.__SENTIENT__.snapshot());

try {
  await page.goto(base);
  await page.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden);
  await page.getByRole('button', { name: 'ENTER THE STATION' }).click();
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().active);
  for (const quality of qualities) {
    if ((await snapshot()).lighting.quality !== quality) {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !window.__SENTIENT__.snapshot().active);
      await page.getByRole('button', { name: 'Open settings' }).click();
      await page.getByLabel('Graphics quality').selectOption(quality);
      await page.getByLabel('Close dialog').click();
      await page.waitForFunction(() => window.__SENTIENT__.snapshot().active);
    }

    for (const view of views) {
      await page.evaluate(view => window.__SENTIENT__.teleport(view.x, view.z, view.yaw), view);
      await page.waitForTimeout(850);
      const state = await snapshot();
      assert.ok(state.triangles > 0 && state.calls > 0, `${quality}/${view.name} renders visible geometry`);
      if (!baseline) {
        const lighting = state.lighting;
        assert.ok(lighting, 'Development snapshot exposes actual renderer lighting state');
        assert.equal(lighting.quality, quality);
        assert.equal(lighting.shadowsEnabled, quality !== 'performance', `${quality} applies its shadow setting`);
        assert.equal(lighting.ssaoEnabled, quality !== 'performance', `${quality} applies its ambient-occlusion setting`);
        assert.equal(lighting.bloomEnabled, quality !== 'performance', `${quality} applies its bloom setting`);
        assert.ok(lighting.shadowCasters > 20 && lighting.shadowReceivers > 20, 'Hull and equipment participate in shadowing');
        assert.equal(lighting.practicals, 25, 'Room, transit and expansion practicals retain all source positions');
        assert.equal(lighting.activePracticals, 6, 'The shader evaluates a fixed pool of six practical lamps');
        assert.equal(new Set(lighting.practicalSources).size, 6, 'Practical pool slots illuminate distinct sources');
        assert.equal(lighting.screenSpills, 7, 'Every department retains its configured display illumination');
        assert.equal(lighting.activeScreenSpills, 2, 'Only two persistent screen-spill lights are evaluated');
        assert.equal(new Set(lighting.screenSpillSources).size, 2, 'The screen-spill pool follows two distinct displays');
        assert.ok(lighting.shadowLights <= lighting.shadowBudget && lighting.shadowMaps <= lighting.shadowBudget, `${quality} respects the shadow-resource budget`);
        if (quality !== 'performance') {
          assert.ok(lighting.shadowLights > 0, 'Station includes genuine shadow-casting light sources');
          assert.ok(lighting.shadowMaps > 0, `${quality}/${view.name} actually allocates shadow maps`);
          if (view.room) assert.ok(lighting.activeSources.some(name => name.startsWith(`${view.room} /`)), `${quality}/${view.name} uses a light in the current room instead of stale sources`);
        } else {
          assert.equal(lighting.shadowLights, 0, 'Performance keeps every shadow light disabled');
          assert.equal(lighting.shadowMaps, 0, 'Returning to Performance releases allocated shadow maps');
        }
        results.push({ quality, view: view.name, lighting, calls: state.calls, triangles: state.triangles });
      }
      const file = baseline ? `lighting-before-${view.name}.png` : `lighting-${quality}-${view.name}.png`;
      await page.screenshot({ path: `test-results/${file}` });
    }

    // A short headless-browser cadence sample is diagnostic, not a hardware guarantee.
    const timing = await page.evaluate(() => new Promise(resolve => {
      const times = [];
      const sample = time => {
        times.push(time);
        if (times.length < 31) return requestAnimationFrame(sample);
        const frames = times.slice(1).map((time, i) => time - times[i]).sort((a, b) => a - b);
        resolve({ fps: Math.round(30000 / (times.at(-1) - times[0])), medianFrameMs: +frames[15].toFixed(2), p95FrameMs: +frames[28].toFixed(2) });
      };
      requestAnimationFrame(sample);
    }));
    results.push({ quality, timing });
    console.log(`PASS: ${quality}, ${views.length} matched lighting views; diagnostic ${timing.fps} fps, p95 ${timing.p95FrameMs} ms.`);
  }
  assert.deepEqual(errors, [], 'No JavaScript or WebGL errors during lighting/quality changes');
  assert.deepEqual(assetErrors, [], 'No failed asset requests');
  await writeFile(`test-results/lighting-${baseline ? 'before' : 'validation'}.json`, JSON.stringify({ views, results, errors, assetErrors }, null, 2));
  console.log(`PASS: ${baseline ? 'baseline' : 'lighting'} captures complete; no browser, shader, or asset errors.`);
} catch (error) {
  await page.screenshot({ path: 'test-results/lighting-failure.png' }).catch(() => {});
  console.error('Lighting browser errors:', errors);
  throw error;
} finally {
  await browser.close();
}
