import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { MODULES, insidePolygon, modulePolygon, routeTo } from '../src/layout.js';
import { canWalk, createWalkable, movePlayer } from '../src/navigation.js';

const views = [
  { name: 'commons-plants', room: 'commons', x: 11.5, z: -21.2, yaw: 0 },
  { name: 'lab-bench', room: 'lab', x: -11.7, z: -23.0, yaw: .73 },
  { name: 'forum-strategy', room: 'forum', x: 0, z: -22, yaw: 2.14 },
  { name: 'fabrication-arm', room: 'floor', x: -10.65, z: -11.1, yaw: 2.24 },
  { name: 'bridge-seats', room: 'bridge', x: 0, z: -35.25, yaw: 0 },
  { name: 'arrival-eva', room: 'front-door', x: 0, z: .10, yaw: -2.10 },
  { name: 'archive-racks', room: 'archive', x: 0, z: -11.8, yaw: Math.PI },
];

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(20000);
const errors = [], assetErrors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !/pointer.?lock/i.test(message.text())) errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) assetErrors.push(`${response.status()} ${response.url()}`); });
const snapshot = () => page.evaluate(() => window.__SENTIENT__.snapshot());

try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden);
  const initial = await snapshot(), quarter = initial.quarterStats, life = initial.lifeScienceStats;
  assert.ok(quarter && life, 'Both department equipment builders are integrated');
  assert.ok(quarter.parts >= 200 && quarter.displays >= 1 && quarter.seats >= 4, 'Forum and Bridge have solid meeting and pilot equipment');
  assert.ok(quarter.robotArms >= 1 && quarter.lockers >= 3 && quarter.racks >= 2, 'Production, Arrival and Archive contain distinct equipment');
  assert.ok(life.growRacks >= 2 && life.seedTrays >= 6 && life.plants >= 30 && life.leaves >= 200, 'Commons contains dimensional hydroponic plants');
  assert.ok(life.microscopes >= 1 && life.centrifuges >= 1 && life.specimens >= 5, 'Lab has recognizable scientific instruments');
  const propBounds = initial.colliders.filter(c => c.id?.startsWith('quarter-'));
  assert.equal(propBounds.length, quarter.floorColliders, 'New furniture exposes physical collision bounds');
  assert.equal(initial.colliders.filter(c => c.id?.startsWith('life-science-')).length, life.colliders, 'Garden and bench footprints are physical');
  for (const c of propBounds) {
    const module = MODULES.find(m => c.id.startsWith(`quarter-${m.id}-`));
    assert.ok(module, `${c.id} belongs to a real module`);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      assert.ok(insidePolygon(c.x + dx * c.w / 2, c.z + dz * c.d / 2, modulePolygon(module)), `${c.id} remains inside the hull`);
    }
  }

  // Recompute every guidance route with the rendered equipment's real bounds.
  const areas = createWalkable();
  const openColliders = initial.colliders.map(c => ({ ...c, disabled: c.disabled || initial.doors.some(d => Math.hypot(d.x - c.x, d.z - c.z) < .1) }));
  for (const from of MODULES) for (const goal of MODULES) {
    let position = { ...from.approach };
    for (let step = 0; step < 2500 && Math.hypot(position.x - goal.approach.x, position.z - goal.approach.z) > .03; step++) {
      const next = routeTo(position, goal.id)[0];
      assert.ok(next, `${from.id} → ${goal.id} provides guidance`);
      const dx = next.x - position.x, dz = next.z - position.z, distance = Math.hypot(dx, dz), stride = Math.min(.08, distance);
      position = movePlayer(position, dx / distance * stride, dz / distance * stride, areas, openColliders);
    }
    assert.ok(Math.hypot(position.x - goal.approach.x, position.z - goal.approach.z) <= .03, `${from.id} → ${goal.id} remains reachable around new furniture`);
  }
  console.log('PASS: all 49 department routes remain clear with quarters, garden and laboratory furniture.');

  await page.getByRole('button', { name: /ENTER THE STATION/ }).click();
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().active);
  const captures = [];
  for (const view of views) {
    assert.ok(canWalk(view.x, view.z, areas, openColliders), `${view.name} is captured from a reachable standing position`);
    await page.evaluate(view => window.__SENTIENT__.teleport(view.x, view.z, view.yaw), view);
    await page.waitForTimeout(850);
    const state = await snapshot();
    assert.ok(state.calls > 0 && state.triangles > 0, `${view.name} renders`);
    assert.ok(state.lighting.practicalSources.some(name => name.startsWith(`${view.room} /`)), `${view.name} uses local practical lighting`);
    const path = `test-results/quarters-${view.name}.png`;
    await page.screenshot({ path });
    captures.push({ ...view, path, calls: state.calls, triangles: state.triangles });
  }
  assert.deepEqual(errors, [], 'No JavaScript or WebGL errors');
  assert.deepEqual(assetErrors, [], 'No missing assets');
  await writeFile('test-results/quarters-validation.json', JSON.stringify({ quarter, life, routes: 49, captures, errors, assetErrors }, null, 2));
  console.log(`PASS: ${views.length} readable equipment views captured; equipment statistics, physical bounds and assets verified.`);
} catch (error) {
  await page.screenshot({ path: 'test-results/quarters-failure.png' }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
