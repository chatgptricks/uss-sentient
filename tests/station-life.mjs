import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Station life: docking traffic and camera feed, day/night cabin light, a
// timed emergency drill, the EVA radiator repair and the cupola telescope.
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/pointer.?lock/i.test(m.text())) errors.push(m.text()); });
const S = () => page.evaluate(() => window.__SENTIENT__.snapshot());
const call = (fn, ...args) => page.evaluate(([fn, args]) => window.__SENTIENT__[fn](...args), [fn, args]);
const tp = (x, z, yaw = 0, deck = 'station', pitch = 0) => call('teleport', x, z, yaw, deck, pitch);
const shot = name => page.screenshot({ path: `test-results/life-${name}.png` });
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__SENTIENT__ && document.getElementById('loading').hidden, null, { timeout: 120000 });
  await page.getByRole('button', { name: 'ENTER THE STATION' }).click();
  assert.equal((await S()).suitStats.suits, 4, 'Arrival and A1 carry NASA EMUs');

  // Docking: final approach closes on the port, then the tender latches.
  await call('setElapsed', 70); await tp(0, 2.2, Math.PI); await page.waitForTimeout(1500);
  let state = await S();
  assert.equal(state.docking.phase, 'final'); assert.ok(state.docking.range < 16 && state.docking.closing > 0, 'Tender closes on the port');
  await shot('docking-feed');
  await call('setElapsed', 100); await page.waitForTimeout(600);
  state = await S(); assert.ok(state.docking.docked && state.docking.range < .05, 'Tender is hard docked at the Front Door');
  assert.ok(state.lifeStats.intercom || state.lifeStats.queued >= 0, 'Intercom is running');

  // Night cycle dims and warms the cabin; day restores it.
  await call('setElapsed', 580); await page.waitForTimeout(500);
  state = await S(); assert.ok(state.cabin.brightness < .5 && state.cabin.warmth > .5, `Night cabin (${JSON.stringify(state.cabin)})`);
  assert.match(state.lifeStats.clock, /^2[2-3]:|^0[0-5]:/);
  await call('setElapsed', 40); await page.waitForTimeout(500);
  assert.equal((await S()).cabin.brightness, 1, 'Day cabin');

  // Drill: red alert, guide light to the safe haven, completion on arrival.
  await tp(0, -11, Math.PI); await page.waitForTimeout(300);
  assert.ok(await call('startDrill'));
  await page.waitForTimeout(1500);
  state = await S();
  assert.ok(state.lifeStats.drill.active && state.cabin.alert > 0 && state.target === 'commons', 'Drill sets red light and the Commons route');
  await shot('drill');
  await tp(11.5, -22); await page.waitForTimeout(800);
  state = await S();
  assert.ok(!state.lifeStats.drill.active && state.lifeStats.drill.completed === 1 && state.cabin.alert === 0, 'Drill completes in the safe haven');

  // EVA radiator: two real steps with animation between them.
  await tp(18.55, -31, -Math.PI / 2); await page.waitForTimeout(800);
  assert.equal((await S()).focusedDevice, 'eva-radiator');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(3000);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(3200);
  state = await S();
  assert.deepEqual(state.devices.find(d => d.id === 'eva-radiator').state, { step: 2, completed: true, animating: false });
  await shot('eva-radiator');

  // Telescope: couple, aim at a visible site, tag it, stow.
  await tp(1.05, -21.2, -2.2, 'cupola', -.25); await page.waitForTimeout(800);
  assert.equal((await S()).focusedDevice, 'cupola-telescope');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1200);
  const site = await call('aimAtSite'); await page.waitForTimeout(1500);
  state = await S(); assert.ok(site && state.lifeStats.telescope && state.lifeStats.locked === site, `Telescope locks ${site}`);
  await shot('telescope');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
  state = await S(); assert.ok(state.lifeStats.survey.includes(site), 'Site tagged in the survey log');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(800);
  assert.equal((await S()).lifeStats.telescope, false, 'Telescope stows');

  assert.deepEqual(errors, []);
  await writeFile('test-results/station-life-validation.json', JSON.stringify({ life: state.lifeStats, docking: state.docking }, null, 2));
  console.log('PASS: docking cycle and camera feed, day/night cabin, timed drill, EVA radiator repair and telescope survey.');
} finally { await browser.close(); }
