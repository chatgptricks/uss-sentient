import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { canWalk, createWalkable, movePlayer } from '../src/navigation.js';
import { MODULES, LINKS, routeTo, surfaceHeight } from '../src/layout.js';
import { rooms } from '../src/rooms.js';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const failures = [];
const assetFailures = [];
const loadedModelURLs = new Set();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(12000);
const observeErrors = target => {
  target.on('pageerror', error => failures.push(error.message));
  target.on('console', message => {
    if (message.type() === 'error' && !/pointer.?lock/i.test(message.text())) failures.push(message.text());
  });
  target.on('response', response => {
    if (response.status() >= 400) assetFailures.push(`${response.status()} ${response.url()}`);
    if (/\/models\/.+\.glb(?:\?|$)/.test(response.url()) && response.ok()) loadedModelURLs.add(response.url());
  });
};
observeErrors(page);
const base = process.env.GAME_URL || 'http://127.0.0.1:5173';
const snapshot = () => page.evaluate(() => window.__SENTIENT__.snapshot());
const teleport = (x, z, facing = 0) => page.evaluate(({ x, z, facing }) => window.__SENTIENT__.teleport(x, z, facing), { x, z, facing });
const waitDoor = (id, min, max = 1) => page.waitForFunction(({ id, min, max }) => {
  const door = window.__SENTIENT__.snapshot().doors.find(door => door.id === id);
  return door && door.openness >= min && door.openness <= max;
}, { id, min, max }, { timeout: 12000 });
const areas = createWalkable(rooms);

try {
  await page.goto(base);
  await page.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden);
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().doors.length > 0);
  const initial = await snapshot();
  assert.equal(initial.rooms.length, 7);
  assert.equal(initial.visited.length, 0);
  assert.equal(initial.doors.length, LINKS.length * 2, 'Every connector has two automatic pressure hatches');
  assert.ok(initial.triangles > 0, 'WebGL renders the pressure hull');
  assert.equal(initial.sky.backgroundType, 'CubeTexture', 'Distant stars use a translation-independent sky');
  assert.equal(initial.sky.pointClouds, 0, 'No nearby point-cloud stars can appear at the windows');
  assert.equal(initial.lighting.quality, 'performance', 'Fresh desktop sessions use Performance by default');
  assert.equal(initial.lighting.shadowsEnabled, false, 'Default exploration disables shadow rendering');
  assert.equal(initial.lighting.ssaoEnabled, false, 'Default exploration disables ambient-occlusion passes');
  assert.equal(initial.lighting.bloomEnabled, false, 'Default exploration disables bloom passes');
  assert.equal(initial.lighting.shadowLights, 0, 'No default light requests shadow rendering');
  assert.equal(initial.lighting.shadowMaps, 0, 'Default exploration allocates no shadow maps');
  assert.ok(initial.lighting.shadowCasters > 20 && initial.lighting.shadowReceivers > 20, 'Hull and authored props support optional shadow quality');
  assert.equal(initial.importedStats.modelsLoaded, 19, 'Every authored GLB model loaded');
  assert.equal(loadedModelURLs.size, 19, 'The browser successfully fetched all 19 local GLBs');
  assert.equal(Object.keys(initial.importedStats.types).length, 19, 'All 19 model types are placed in the station');
  assert.ok(Object.values(initial.importedStats.types).every(count => count > 0), 'Every model type has visible instances');
  assert.equal(initial.importedStats.instances, initial.importedStats.placements.length);
  assert.equal(initial.importedStats.instances, Object.values(initial.importedStats.types).reduce((sum, count) => sum + count, 0));
  assert.ok(initial.importedStats.instances >= 35 && initial.importedStats.drawBatches > 0, 'Imported props are instantiated throughout the station');
  assert.equal(new Set(initial.importedStats.placements.map(prop => prop.room)).size, 7, 'Every department contains authored props');
  assert.equal(initial.importedStats.floorColliders, initial.colliders.filter(collider => collider.id?.startsWith('imported-')).length, 'Imported floor props have physical collision footprints');
  assert.ok(initial.screenStats.banks >= 6 && initial.screenStats.screens >= 15, 'Real avionics screen banks populate the rooms');
  assert.ok(initial.screenStats.buttons > 25 && initial.screenStats.gauges > 5 && initial.screenStats.parts > 100, 'Control banks include dimensional instruments');
  assert.deepEqual(assetFailures, [], 'No missing models, textures, or other HTTP assets');
  console.log(`PASS: all 19 GLBs loaded and used in ${initial.importedStats.instances} placements; ${initial.screenStats.screens} screens and ${initial.screenStats.buttons} physical controls.`);
  await page.screenshot({ path: 'test-results/arrival-desktop.png' });

  // Independently traverse the visible floor plan with physical props retained.
  // Hatches are traversable when open; their closed state is tested below.
  const openColliders = initial.colliders.map(collider => ({ ...collider, disabled: collider.disabled || initial.doors.some(door => Math.hypot(door.x - collider.x, door.z - collider.z) < 0.1) }));
  const step = 0.25, queue = [{ x: 0, z: 0 }], seen = new Set(['0,0']);
  for (let i = 0; i < queue.length; i++) {
    const here = queue[i];
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const x = here.x + dx, z = here.z + dz, key = `${x},${z}`;
      if (!seen.has(key) && canWalk(x, z, areas, openColliders)) {
        seen.add(key); queue.push({ x, z });
        assert.ok(queue.length < 15000, 'The floor plan cannot leak into space');
      }
    }
  }
  for (const room of rooms) {
    assert.ok(seen.has(`${room.x},${room.z}`), `${room.name} is reachable around real props`);
    assert.ok(canWalk(room.approach.x, room.approach.z, areas, openColliders), `${room.name} terminal approach is clear`);
  }
  // Continuously recomputed guidance must also avoid the actual console props.
  for (const origin of rooms) for (const goal of rooms) {
    let position = { ...origin.approach };
    for (let frame = 0; frame < 2400 && Math.hypot(position.x - goal.approach.x, position.z - goal.approach.z) > 0.02; frame++) {
      const waypoint = routeTo(position, goal.id)[0];
      assert.ok(waypoint, `${origin.id} → ${goal.id} provides a next waypoint`);
      const dx = waypoint.x - position.x, dz = waypoint.z - position.z, distance = Math.hypot(dx, dz);
      const step = Math.min(0.08, distance);
      position = movePlayer(position, dx / distance * step, dz / distance * step, areas, openColliders);
      assert.ok(canWalk(position.x, position.z, areas, openColliders));
    }
    assert.ok(Math.hypot(position.x - goal.approach.x, position.z - goal.approach.z) <= 0.02, `${origin.id} → ${goal.id} avoids rendered props`);
  }
  console.log(`PASS: ${seen.size} walkable cells; all seven module centers and terminal approaches accessible.`);
  console.log('PASS: all 49 live guidance routes avoid the rendered console props.');

  await page.getByRole('button', { name: /ENTER THE STATION/ }).click();
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().active);

  // Make the main architectural views available for review before long hatch checks.
  for (const view of [
    { x: 0, z: 1.3, yaw: 0, file: 'compact-arrival.png' },
    { x: 0, z: -5, yaw: 0, file: 'pressure-tunnel.png' },
    { x: -6.6, z: -11, yaw: -Math.PI / 2, file: 'lower-deck-stairs.png' },
    { x: 0, z: -25.4, yaw: 0, file: 'bridge-ascending-stairs.png' },
    { x: 0, z: -36, yaw: 0, file: 'bridge-cupola.png' },
    { x: 0, z: -32.6, yaw: 0, file: 'bridge-control-room.png' },
    ...MODULES.map(module => ({ x: module.x, z: module.z, yaw: module.id === 'bridge' ? -Math.PI * 3 / 4 : Math.PI * 3 / 4, file: `department-${module.id}.png` })),
  ]) {
    await teleport(view.x, view.z, view.yaw);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `test-results/${view.file}` });
  }
  console.log('CAPTURED: arrival, pressure corridor, lower stairs, Bridge stairs, Bridge window, and seven department views.');

  // Exercise both sides of every hatch and its physical collider, not only its animation.
  for (const door of initial.doors) {
    const far = [...MODULES].sort((a, b) => Math.hypot(b.x - door.x, b.z - door.z) - Math.hypot(a.x - door.x, a.z - door.z))[0];
    const normal = door.axis === 'x' ? { x: 1, z: 0 } : { x: 0, z: 1 };
    for (const side of [-1, 1]) {
      await teleport(far.x, far.z);
      await waitDoor(door.id, 0, 0.06);
      assert.equal(canWalk(door.x, door.z, areas, (await snapshot()).colliders), false, `${door.id} closes its physical aperture`);
      await teleport(door.x + normal.x * side * 1.1, door.z + normal.z * side * 1.1);
      await waitDoor(door.id, 0.9);
      assert.ok(canWalk(door.x, door.z, areas, (await snapshot()).colliders), `${door.id} opens from side ${side}`);
    }
    await teleport(door.x, door.z);
    await page.waitForTimeout(450);
    assert.ok((await snapshot()).doors.find(item => item.id === door.id).openness > 0.9, `${door.id} stays open while occupied`);
    await teleport(far.x, far.z);
    await waitDoor(door.id, 0, 0.06);
  }
  console.log(`PASS: all ${initial.doors.length} hatches open from both sides, close when clear, and never close on the player.`);

  // Real keyboard input must pass through both orientations of hatch.
  for (const axis of ['z', 'x']) {
    const door = initial.doors.find(door => door.axis === axis);
    assert.ok(door, `Station includes a ${axis}-normal hatch`);
    const normal = axis === 'x' ? { x: 1, z: 0 } : { x: 0, z: 1 };
    await teleport(door.x - normal.x * 1.15, door.z - normal.z * 1.15, axis === 'x' ? -Math.PI / 2 : Math.PI);
    await page.keyboard.down('KeyW');
    try {
      await page.waitForFunction(({ door, axis }) => window.__SENTIENT__.snapshot().position[axis] > door[axis] + 0.85, { door, axis });
    } finally { await page.keyboard.up('KeyW'); }
    const current = await snapshot();
    assert.ok(canWalk(current.position.x, current.position.z, areas, current.colliders));
  }
  await page.screenshot({ path: 'test-results/automatic-hatch.png' });
  console.log('PASS: physical keyboard movement crosses automatic hatches in both orientations.');

  // Walk each staircase in both directions with real keyboard input. Samples
  // verify the displayed camera follows the floor, not merely an elevation label.
  const stairs = LINKS.filter(link => link.kind === 'stairs');
  assert.equal(stairs.length, 3);
  for (const link of [...stairs, ...LINKS.filter(link => link.kind === 'ramp')]) {
    for (const reverse of [false, true]) {
      const from = reverse ? link.b : link.a, to = reverse ? link.a : link.b;
      const fromElevation = reverse ? link.elevationB : link.elevationA;
      const toElevation = reverse ? link.elevationA : link.elevationB;
      const length = Math.hypot(to.x - from.x, to.z - from.z);
      const dx = (to.x - from.x) / length, dz = (to.z - from.z) / length;
      const facing = Math.atan2(-dx, -dz);
      await teleport(from.x - dx * .8, from.z - dz * .8, facing);
      await page.waitForFunction(expected => Math.abs(window.__SENTIENT__.snapshot().cameraY - expected) < .03, fromElevation + 1.6);
      const samples = [await snapshot()];
      await page.keyboard.down('KeyW');
      try {
        const deadline = Date.now() + 14000;
        while (true) {
          await page.waitForTimeout(85);
          const state = await snapshot();
          samples.push(state);
          const along = (state.position.x - from.x) * dx + (state.position.z - from.z) * dz;
          if (along > length + .5) break;
          assert.ok(Date.now() < deadline, `${link.id} ${reverse ? 'return' : 'outbound'} traversal must reach the next deck`);
          assert.ok(state.active, 'Keyboard climbing remains active');
        }
      } finally { await page.keyboard.up('KeyW'); }
      assert.ok(samples.length > 4, `${link.id} records actual climbing frames`);
      const sign = Math.sign(toElevation - fromElevation);
      for (let index = 0; index < samples.length; index++) {
        const state = samples[index];
        assert.ok(Math.abs(state.elevation - surfaceHeight(state.position)) < 1e-8, `${link.id} reports the floor underfoot`);
        assert.ok(Math.abs(state.cameraY - state.elevation - 1.6) < .23, `${link.id} camera stays at walking height`);
        assert.ok(canWalk(state.position.x, state.position.z, areas, state.colliders), `${link.id} stays inside its physical passage`);
        if (index) assert.ok(sign * (state.elevation - samples[index - 1].elevation) >= -1e-8, `${link.id} elevation is monotonic during traversal`);
      }
      assert.ok(samples.some(state => sign * (state.elevation - fromElevation) > .2 && sign * (toElevation - state.elevation) > .2), `${link.id} crosses intermediate elevations`);
      await page.waitForFunction(expected => Math.abs(window.__SENTIENT__.snapshot().cameraY - expected) < .035, toElevation + 1.6);
      assert.ok(Math.abs((await snapshot()).elevation - toElevation) < 1e-8, `${link.id} reaches its destination deck`);
    }
  }
  console.log('PASS: three staircases and the habitat ramp physically climbed and descended; camera height follows every deck.');

  // Approach each real terminal and inspect its complete source-backed content.
  for (const room of rooms) {
    await teleport(room.approach.x, room.approach.z);
    await page.waitForFunction(id => window.__SENTIENT__.snapshot().nearRoom === id, room.id);
    await page.keyboard.press('KeyE');
    await page.getByRole('heading', { name: room.name, exact: true }).waitFor();
    assert.ok((await snapshot()).visited.includes(room.id));
    assert.equal(await page.locator('.tool-card').count(), room.tools.length);
    if (room.id === 'front-door') await page.screenshot({ path: 'test-results/terminal-desktop.png' });
    await page.getByRole('button', { name: /CONTINUE EXPEDITION|KEEP EXPLORING/ }).click();
  }
  assert.equal((await snapshot()).visited.length, 7);
  assert.match(await page.locator('#mission-title').textContent(), /Constellation connected/);

  const routeStart = { ...rooms.find(room => room.id === 'floor').approach };
  await teleport(routeStart.x, routeStart.z);
  await page.keyboard.press('KeyM');
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: 'test-results/deck-map-desktop.png' });
  await page.getByRole('button', { name: 'Navigate to The Bridge', exact: true }).click();
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().target === 'bridge');
  const selected = await snapshot();
  assert.deepEqual(selected.route, routeTo(selected.position, 'bridge'), 'Map selection creates the actual connecting-module route');
  assert.ok(selected.route.length >= 3, 'Guidance includes corridor turns instead of pointing through walls');
  await page.keyboard.press('KeyJ');
  assert.equal(await page.locator('[data-log]:not(:disabled)').count(), 7);
  await page.getByRole('button', { name: /03.*The Archive/ }).click();
  await page.getByRole('heading', { name: 'The Archive', exact: true }).waitFor();
  await page.getByRole('button', { name: 'KEEP EXPLORING' }).click();

  await page.reload();
  await page.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden);
  assert.equal((await snapshot()).visited.length, 7, 'Progress survives reload');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('Graphics quality').selectOption('performance');
  await page.getByLabel('Close dialog').click();
  await page.getByRole('button', { name: 'Start a new expedition' }).click();
  assert.equal((await snapshot()).visited.length, 0, 'New expedition clears progress');
  console.log('PASS: all terminals, completion, routed map, journal, persistence, reset and graphics controls.');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__SENTIENT__.snapshot().active);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('Graphics quality').selectOption('balanced');
  await page.getByLabel('Close dialog').click();
  await page.waitForFunction(() => window.__SENTIENT__.snapshot().lighting.shadowMaps > 0);
  const balanced = (await snapshot()).lighting;
  assert.equal(balanced.quality, 'balanced');
  assert.ok(balanced.shadowsEnabled && balanced.ssaoEnabled && balanced.bloomEnabled, 'Balanced quality remains available with optional effects');
  assert.ok(balanced.shadowMaps <= balanced.shadowBudget, 'Opting into Balanced respects its shadow budget');
  await page.waitForFunction(() => !document.getElementById('toast').classList.contains('show'));

  for (const view of [
    { x: 0, z: 1.3, yaw: 0, file: 'compact-arrival.png' },
    { x: 0, z: -5, yaw: 0, file: 'pressure-tunnel.png' },
    { x: -6.6, z: -11, yaw: -Math.PI / 2, file: 'lower-deck-stairs.png' },
    { x: 0, z: -25.4, yaw: 0, file: 'bridge-ascending-stairs.png' },
    { x: 0, z: -36, yaw: 0, file: 'bridge-cupola.png' },
    { x: 0, z: -32.6, yaw: 0, file: 'bridge-control-room.png' },
    { x: 0, z: -20, yaw: 0.7, file: 'module-junction.png' },
    ...MODULES.map(module => ({ x: module.x, z: module.z, yaw: module.id === 'bridge' ? -Math.PI * 3 / 4 : Math.PI * 3 / 4, file: `department-${module.id}.png` })),
  ]) {
    await teleport(view.x, view.z, view.yaw);
    await page.waitForTimeout(700);
    const viewState = await snapshot();
    assert.ok(Math.abs(viewState.cameraY - surfaceHeight(viewState.position) - 1.6) < .035, `${view.file} shows the correct deck elevation`);
    await page.screenshot({ path: `test-results/${view.file}` });
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  observeErrors(mobile);
  await mobile.goto(base);
  await mobile.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden);
  const mobileLighting = await mobile.evaluate(() => window.__SENTIENT__.snapshot().lighting);
  assert.equal(mobileLighting.quality, 'performance', 'Fresh mobile sessions also default to Performance');
  assert.equal(mobileLighting.shadowMaps, 0);
  await mobile.screenshot({ path: 'test-results/arrival-mobile.png' });
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'No horizontal mobile overflow');
  await mobile.getByRole('button', { name: 'ENTER THE STATION' }).tap();
  await mobile.locator('#joystick').waitFor({ state: 'visible' });
  const before = await mobile.evaluate(() => window.__SENTIENT__.snapshot().position.z);
  const joystick = await mobile.locator('#joystick').boundingBox();
  // Real pointer input preserves pointer-capture behavior in the production control.
  await mobile.mouse.move(joystick.x + joystick.width / 2, joystick.y + joystick.height / 2);
  await mobile.mouse.down();
  await mobile.mouse.move(joystick.x + joystick.width / 2, joystick.y + 5);
  await mobile.waitForFunction(before => window.__SENTIENT__.snapshot().position.z < before - 0.3, before);
  await mobile.mouse.up();
  const approach = rooms.find(room => room.id === 'front-door').approach;
  await mobile.evaluate(({ x, z }) => window.__SENTIENT__.teleport(x, z), approach);
  await mobile.waitForFunction(() => window.__SENTIENT__.snapshot().nearRoom === 'front-door');
  await mobile.getByRole('button', { name: 'Interact with terminal', exact: true }).tap();
  await mobile.getByRole('heading', { name: 'The Front Door', exact: true }).waitFor();
  await mobile.getByRole('button', { name: 'CONTINUE EXPEDITION' }).tap();
  await mobile.getByRole('button', { name: 'Open deck map', exact: true }).tap();
  await mobile.locator('#deck-canvas').waitFor({ state: 'visible' });
  const mobileMap = await mobile.locator('#deck-canvas').boundingBox();
  assert.ok(mobileMap.width > 150 && mobileMap.height > 150, 'Mobile map remains large enough to inspect');
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'Open map stays inside the mobile viewport');
  await mobile.screenshot({ path: 'test-results/deck-map-mobile.png' });
  await mobile.getByRole('button', { name: 'Navigate to The Lab', exact: true }).tap();
  await mobile.waitForFunction(() => window.__SENTIENT__.snapshot().target === 'lab');
  assert.ok((await mobile.evaluate(() => window.__SENTIENT__.snapshot().route)).length > 1);
  const reducedDoor = initial.doors[0];
  const normal = reducedDoor.axis === 'x' ? { x: 1, z: 0 } : { x: 0, z: 1 };
  await mobile.evaluate(({ door, normal }) => window.__SENTIENT__.teleport(door.x + normal.x * 1.1, door.z + normal.z * 1.1), { door: reducedDoor, normal });
  await mobile.waitForFunction(id => window.__SENTIENT__.snapshot().doors.find(door => door.id === id).openness > .9, reducedDoor.id, { timeout: 5500 });
  const far = [...MODULES].sort((a, b) => Math.hypot(b.x - reducedDoor.x, b.z - reducedDoor.z) - Math.hypot(a.x - reducedDoor.x, a.z - reducedDoor.z))[0];
  await mobile.evaluate(({ x, z }) => window.__SENTIENT__.teleport(x, z), far);
  await mobile.waitForFunction(id => window.__SENTIENT__.snapshot().doors.find(door => door.id === id).openness < .06, reducedDoor.id, { timeout: 5500 });
  assert.equal(await mobile.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  await mobile.close();
  console.log('PASS: mobile layout, joystick, touch terminal scanning and usable routed map.');
  console.log('PASS: reduced-motion preference preserves real-time hatch opening and closing.');
  assert.deepEqual(failures, [], 'No browser or WebGL errors');
  assert.deepEqual(assetFailures, [], 'No HTTP asset failures on desktop, reload, or mobile');
  console.log('PASS: no browser / WebGL errors.');
} catch (error) {
  await page.screenshot({ path: 'test-results/failure.png' }).catch(() => {});
  console.error('Browser errors:', failures);
  throw error;
} finally { await browser.close(); }
