import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { MODULES, LINKS, moduleAt } from '../src/layout.js';
import { rooms } from '../src/rooms.js';

// Closed-door visual inspection complements the full movement/hatch regression.
await mkdir('test-results', { recursive: true });
const errors = [], assets = [], captures = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(12000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && !/pointer.?lock/i.test(message.text())) errors.push(message.text());
});
page.on('response', response => { if (response.status() >= 400) assets.push(`${response.status()} ${response.url()}`); });

try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden);
  await page.getByRole('button', { name: 'ENTER THE STATION' }).click();
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().active);
  const state = await page.evaluate(() => window.__SENTIENT__.snapshot());
  assert.equal(state.lighting.quality, 'performance', 'Closed hatches are reviewed in the default exploration mode');
  assert.equal(state.doors.length, 14);
  assert.equal(new Set(state.doors.map(door => door.variant)).size, 7, 'All seven mechanical hatch designs are instantiated');
  for (const module of MODULES) {
    const matching = state.doors.filter(door => door.variant === module.id);
    // The command design appears at both ends of its corridor; prefer the Bridge interior.
    const door = matching.find(door => door.id === 'forum--bridge-b') || matching[0];
    assert.ok(door, `${module.id} has its own hatch design`);
    assert.equal(door.number, rooms.find(room => room.id === module.id).number);
    const link = LINKS.find(link => door.id === `${link.id}-a` || door.id === `${link.id}-b`);
    const current = MODULES.find(room => room.id === (door.id.endsWith('-a') ? link.from : link.to));
    const dx = Math.sign(current.x - door.x), dz = Math.sign(current.z - door.z);
    const pose = { x: door.x + dx * 2.7, z: door.z + dz * 2.7, yaw: Math.atan2(dx, dz) };
    assert.equal(moduleAt(pose)?.id, current.id, 'Inspection camera remains inside the correct pressure module');
    assert.ok(Math.hypot(pose.x - door.x, pose.z - door.z) > 2.65, 'Camera stays beyond the automatic-open threshold');
    for (const angle of module.id === 'bridge' ? [0, .65] : [0]) {
      const view = { ...pose, x: pose.x + dz * angle, z: pose.z - dx * angle };
      view.yaw = Math.atan2(view.x - door.x, view.z - door.z);
      await page.evaluate(view => window.__SENTIENT__.teleport(view.x, view.z, view.yaw), view);
      await page.waitForFunction(id => window.__SENTIENT__.snapshot().doors.find(door => door.id === id).openness < .025, door.id);
      await page.waitForTimeout(200);
      const file = `hatch-${door.number}-${door.variant}${angle ? '-angled' : ''}.png`;
      await page.screenshot({ path: `test-results/${file}` });
      captures.push({ file, door: door.id, variant: door.variant, number: door.number, pose: view });
    }
  }
  assert.deepEqual(errors, [], 'No JavaScript or WebGL errors while reviewing the seven hatch designs');
  assert.deepEqual(assets, [], 'Every hatch asset loads');
  const timing = await page.evaluate(() => new Promise(resolve => {
    const frames = [];
    const sample = time => {
      frames.push(time);
      if (frames.length < 31) return requestAnimationFrame(sample);
      const intervals = frames.slice(1).map((time, index) => time - frames[index]).sort((a, b) => a - b);
      resolve({ fps: Math.round(30000 / (frames.at(-1) - frames[0])), p95FrameMs: +intervals[28].toFixed(2) });
    };
    requestAnimationFrame(sample);
  }));
  await writeFile('test-results/hatches-validation.json', JSON.stringify({ captures, timing, errors, assets }, null, 2));
  console.log(`PASS: all seven closed hatch designs captured, including the command hatch from two angles; no browser or asset errors. Default Performance diagnostic: ${timing.fps} fps, p95 ${timing.p95FrameMs} ms.`);
} finally {
  await browser.close();
}
