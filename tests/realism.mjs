import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { MODULES } from '../src/layout.js';

// Crew realism layer: every module is dressed, safety kit is complete, the
// layer stays against the hull and the game still renders and moves normally.
const views = [
  { name: 'commons-stowage', x: 11.5, z: -21.5, yaw: 2.6, pitch: -.1 },
  { name: 'arrival-fire-kit', x: 0, z: 0, yaw: 1.57, pitch: -.05 },
  { name: 'forum-hatch-wall', x: 1, z: -22.5, yaw: 1.57, pitch: -.05 },
  { name: 'lab-procedures', x: -11, z: -21, yaw: 3.14, pitch: -.05 },
  { name: 'pressure-tunnel', x: 0, z: -5.5, yaw: 0, pitch: 0 },
];
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !/pointer.?lock/i.test(message.text())) errors.push(message.text()); });
const snapshot = () => page.evaluate(() => window.__SENTIENT__.snapshot());
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden, null, { timeout: 90000 });
  const stats = (await snapshot()).realismStats;
  for (const m of MODULES) assert.ok(stats.perModule[m.id] >= 25, `${m.id} carries crew equipment (${stats.perModule[m.id]})`);
  for (const key of ['fireKits', 'intercoms', 'smokeDetectors', 'firePorts', 'egressMarkers']) assert.equal(stats[key], MODULES.length, `one ${key} per module`);
  assert.ok(stats.bags >= 30 && stats.cableRuns >= 10 && stats.vents >= 10 && stats.procedures >= 30, 'stowage, cables, vents and procedures are present');
  assert.ok(stats.labels >= 60 && stats.grime >= 60 && stats.floorWear >= 30, 'labels and wear dress the walls and decks');
  assert.ok(stats.wallInsetMax <= .15, `wall equipment stays within 15 cm of the hull (${stats.wallInsetMax})`);
  assert.ok(stats.drawCalls <= 60, `the layer stays batched (${stats.drawCalls} draw calls)`);
  await page.getByRole('button', { name: 'ENTER THE STATION' }).click();
  const captures = [];
  for (const view of views) {
    await page.evaluate(v => window.__SENTIENT__.teleport(v.x, v.z, v.yaw, 'station', v.pitch), view);
    await page.waitForTimeout(600);
    const path = `test-results/realism-${view.name}.png`;
    await page.screenshot({ path });
    const state = await snapshot();
    assert.ok(state.calls > 0 && state.triangles > 0, `${view.name} renders`);
    captures.push({ ...view, path, calls: state.calls });
  }
  // Walking still works through a dressed tube.
  await page.evaluate(() => window.__SENTIENT__.teleport(0, -4, 0));
  const before = (await snapshot()).position;
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  assert.ok((await snapshot()).position.z < before.z - .4, 'keyboard movement continues through the dressed tube');
  assert.deepEqual(errors, []);
  await writeFile('test-results/realism-validation.json', JSON.stringify({ stats, captures }, null, 2));
  console.log(`Realism layer verified: ${stats.items} parts, ${stats.leds} LEDs, ${stats.streamers} streamers, ${stats.drawCalls} draw calls.`);
} finally { await browser.close(); }
