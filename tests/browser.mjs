import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { canWalk, createWalkable, START } from '../src/navigation.js';
import { rooms } from '../src/rooms.js';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const failures = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.on('pageerror', error => failures.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('pointer lock')) failures.push(message.text()); });
const base = process.env.GAME_URL || 'http://127.0.0.1:5173';
const snapshot = () => page.evaluate(() => window.__SENTIENT__.snapshot());

try {
  await page.goto(base);
  await page.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/arrival-desktop.png' });
  const initial = await snapshot();
  assert.equal(initial.rooms.length, 7);
  assert.equal(initial.visited.length, 0);

  // Independently flood-fill actual walkable space with the rendered world's props.
  const areas = createWalkable(rooms), colliders = initial.colliders;
  const step = .5, queue = [{ ...START }], seen = new Set([`${START.x},${START.z}`]);
  for (let i = 0; i < queue.length; i++) {
    const here = queue[i];
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const x = here.x + dx, z = here.z + dz, key = `${x},${z}`;
      if (!seen.has(key) && canWalk(x, z, areas, colliders)) { seen.add(key); queue.push({ x, z }); }
    }
  }
  for (const room of rooms) assert(seen.has(`${room.x},${room.z}`), `${room.name} is reachable around real props`);
  console.log(`PASS: ${seen.size} walkable cells; every room reachable with real prop collisions.`);

  await page.getByRole('button', { name: /ENTER THE STATION/ }).click();
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().active);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(z => window.__SENTIENT__.snapshot().position.z < z + .2, rooms[0].z);
  await page.keyboard.up('KeyW');
  assert((await snapshot()).position.z > rooms[0].z - 2.2, 'Physical walk stops before terminal');
  await page.keyboard.press('KeyE');
  await page.getByRole('dialog').waitFor();
  assert.equal((await snapshot()).visited[0], 'front-door');
  await page.screenshot({ path: 'test-results/terminal-desktop.png' });
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION' }).click();

  // Walk physically through the first doorway, validating keyboard + collider integration.
  await page.evaluate(z => window.__SENTIENT__.teleport(0, z, 0), rooms[1].z);
  await page.keyboard.down('KeyA');
  await page.waitForFunction(x => window.__SENTIENT__.snapshot().position.x < x + .3, rooms[1].x);
  await page.keyboard.up('KeyA');
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().nearRoom === 'floor');
  await page.screenshot({ path: 'test-results/production-module.png' });
  await page.keyboard.press('KeyE');
  await page.getByRole('dialog').waitFor();
  assert((await snapshot()).visited.includes('floor'));
  assert.equal(await page.locator('.tool-card').count(), rooms[1].tools.length);
  await page.getByRole('button', { name: 'CONTINUE EXPEDITION' }).click();

  // Test each remaining room's game interaction and source-backed terminal content.
  for (const room of rooms.slice(2)) {
    await page.evaluate(({ x, z }) => window.__SENTIENT__.teleport(x, z, 0), room);
    await page.waitForFunction(id => window.__SENTIENT__.snapshot().nearRoom === id, room.id);
    await page.keyboard.press('KeyE');
    await page.getByRole('dialog').waitFor();
    await page.getByRole('heading', { name: room.name, exact: true }).waitFor();
    assert.equal(await page.locator('.tool-card').count(), room.tools.length);
    await page.getByRole('button', { name: /CONTINUE EXPEDITION|KEEP EXPLORING/ }).click();
  }
  assert.equal((await snapshot()).visited.length, 7);
  assert.match(await page.locator('#mission-title').textContent(), /Constellation connected/);
  await page.keyboard.press('KeyM');
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: 'test-results/deck-map-desktop.png' });
  await page.getByRole('button', { name: 'Navigate to The Archive', exact: true }).click();
  assert.equal((await snapshot()).target, 'archive');
  await page.keyboard.press('KeyJ');
  assert.equal(await page.locator('[data-log]:not(:disabled)').count(), 7);
  await page.getByRole('button', { name: /03.*The Archive/ }).click();
  await page.getByRole('heading', { name: 'The Archive', exact: true }).waitFor();
  await page.getByRole('button', { name: 'KEEP EXPLORING' }).click();

  await page.reload();
  await page.waitForFunction(() => window.__SENTIENT__);
  assert.equal((await snapshot()).visited.length, 7, 'Progress survives reload');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('Graphics quality').selectOption('performance');
  await page.getByLabel('Close dialog').click();
  await page.getByRole('button', { name: 'Start a new expedition' }).click();
  assert.equal((await snapshot()).visited.length, 0, 'New expedition clears progress');
  console.log('PASS: physical movement, real doorway, all terminals, completion, map, log, persistence, reset, graphics controls.');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  mobile.on('pageerror', error => failures.push(error.message));
  await mobile.goto(base);
  await mobile.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden);
  await mobile.screenshot({ path: 'test-results/arrival-mobile.png' });
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'No horizontal mobile overflow');
  await mobile.getByRole('button', { name: 'ENTER THE STATION' }).tap();
  await mobile.locator('#joystick').waitFor({ state: 'visible' });
  const before = await mobile.evaluate(() => window.__SENTIENT__.snapshot().position.z);
  const joystick = await mobile.locator('#joystick').boundingBox();
  await mobile.locator('#joystick').dispatchEvent('pointerdown', { pointerId: 1, clientX: joystick.x + joystick.width / 2, clientY: joystick.y + 5 });
  await mobile.waitForTimeout(800);
  await mobile.locator('#joystick').dispatchEvent('pointerup', { pointerId: 1 });
  const after = await mobile.evaluate(() => window.__SENTIENT__.snapshot().position.z);
  assert(after < before, 'Touch joystick moves forward');
  await mobile.evaluate(z => window.__SENTIENT__.teleport(0, z), rooms[0].z);
  await mobile.waitForFunction(() => window.__SENTIENT__.snapshot().nearRoom === 'front-door');
  await mobile.getByRole('button', { name: 'Interact with terminal', exact: true }).tap();
  await mobile.getByRole('heading', { name: 'The Front Door', exact: true }).waitFor();
  console.log('PASS: mobile layout, joystick, touch scanning.');
  await mobile.close();
  assert.deepEqual(failures, [], 'No browser or WebGL errors');
  console.log('PASS: no browser / WebGL errors.');
} finally { await browser.close(); }
