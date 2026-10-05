import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await page.routeWebSocket('**',()=>{});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/pointer.?lock/i.test(m.text()))errors.push(m.text());});
const snap=()=>page.evaluate(()=>window.__SENTIENT__.snapshot());
const pose=(x,z,yaw=0,layer='station',pitch=0)=>page.evaluate(p=>window.__SENTIENT__.teleport(...p),[x,z,yaw,layer,pitch]);
const capture=async name=>{await page.waitForTimeout(400);await page.screenshot({path:`test-results/expansion-${name}.png`});};
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__SENTIENT__&&document.getElementById('loading').hidden);
 assert.equal((await snap()).audio.unlocked,false,'No audio before a user gesture');
 await page.getByRole('button',{name:'ENTER THE STATION'}).click();
 await page.waitForFunction(()=>window.__SENTIENT__.snapshot().active);
 await page.waitForFunction(()=>window.__SENTIENT__.snapshot().audio.contextState==='running');
 const initial=await snap();assert.equal(initial.interactiveStats.devices,7);assert.ok(initial.spaceStats);
 await capture('arrival');
 // Move through Arrival's new side port and the inner lock using actual input.
 await pose(0,0,-Math.PI/2);
 await page.keyboard.down('KeyW');await page.waitForTimeout(2600);await page.keyboard.up('KeyW');
 let state=await snap();console.log('Airlock entry',state.position,state.zone);
 assert.ok(state.position.x>5.7,'Arrival is physically connected to the exit bay');
 await pose(6.5,0,0);await page.waitForTimeout(150);await capture('airlock');
 await page.keyboard.press('KeyE');await page.waitForTimeout(150);
 assert.equal((await snap()).expansion.airlock.mode,'cycling-out');
 await page.waitForFunction(()=>window.__SENTIENT__.snapshot().expansion.airlock.mode==='vacuum');
 state=await snap();assert.ok(state.expansion.airlock.inner<.01,'Inner hatch closes before exterior opens');
 await pose(6.5,0,-Math.PI/2);await page.keyboard.down('KeyW');await page.waitForTimeout(2300);await page.keyboard.up('KeyW');
 assert.equal((await snap()).zone,'exterior');await capture('eva-exit');
 await pose(17,-13,Math.PI/2);await capture('exterior-hull');
 await pose(17,-31,-2.6,'station',-.45);await capture('eva-planet');
 assert.equal((await snap()).audio.profile,'exterior');
 // Return through an open exterior hatch, repressurize, then walk back aboard.
 await pose(10,0,Math.PI/2);await page.keyboard.down('KeyW');await page.waitForTimeout(1250);await page.keyboard.up('KeyW');
 await pose(6.5,0,0);await page.waitForTimeout(150);await page.keyboard.press('KeyE');
 await page.waitForFunction(()=>window.__SENTIENT__.snapshot().expansion.airlock.mode==='pressurized');
 await pose(6.5,0,Math.PI/2);await page.keyboard.down('KeyW');await page.waitForTimeout(2300);await page.keyboard.up('KeyW');
 assert.equal((await snap()).zone,'station');
 // Open the real Forum floor hatch, descend and come back through the same ladder.
 await pose(0,-21.2,0,'station',-.65);await page.waitForTimeout(200);await capture('forum-hatch');
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>!!window.__SENTIENT__.snapshot().transition);
 await page.waitForTimeout(1700);let midway=await snap();assert.ok(midway.cameraY<1.1&&midway.cameraY>-2.8,'Descent moves continuously between decks');
 await page.waitForFunction(()=>window.__SENTIENT__.snapshot().layer==='cupola'&&!window.__SENTIENT__.snapshot().transition);
 assert.equal((await snap()).elevation,-4.8);
 await pose(0,-22,-2.8,'cupola',-.63);await capture('cupola-planet');
 await pose(0,-22,0,'cupola',.25);await capture('cupola-ladder');
 assert.equal((await snap()).audio.profile,'cupola');
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__SENTIENT__.snapshot().layer==='station'&&!window.__SENTIENT__.snapshot().transition);
 assert.equal((await snap()).elevation,0);
 // Every department accessory can be operated from the actual open aisle.
 const devices=(await snap()).devices.filter(d=>d.id.startsWith('station-'));
 const rooms=(await snap()).rooms;
 for(const d of devices){
   const r=rooms.find(r=>r.id===d.roomId),vx=r.x-d.x,vz=r.z-d.z,len=Math.hypot(vx,vz),x=d.x+vx/len*1.18,z=d.z+vz/len*1.18;
   const yaw=Math.atan2(-(d.x-x),-(d.z-z));const floor=r.elevation;
   const pitch=Math.atan2(d.y-(floor+1.6),1.18);
   await pose(x,z,yaw,'station',pitch);await page.waitForTimeout(200);
   await page.mouse.click(720,500);await page.waitForTimeout(120);
   const after=(await snap()).devices.find(item=>item.id===d.id);
   assert.equal(after.state.activations,1,`${d.id} responds to a aimed click`);
   await capture(d.id);
 }
 await page.keyboard.press('KeyM');await page.getByRole('button',{name:'Navigate to Nadir observation cupola'}).click();
 assert.equal((await snap()).target,'cupola');
 const timing=await page.evaluate(()=>new Promise(resolve=>{const t=[];function frame(n){t.push(n);if(t.length<61)requestAnimationFrame(frame);else resolve({fps:Math.round(60000/(t.at(-1)-t[0]))});}requestAnimationFrame(frame);}));
 assert.deepEqual(errors,[]);
 await writeFile('test-results/expansion-validation.json',JSON.stringify({initial,final:await snap(),timing,errors},null,2));
 console.log('PASS: EVA pressure cycle/outbound/return, continuous two-way cupola transfer, seven clickable controls, room audio, map, render.',timing);
} catch(error) {await capture('failure');console.error('Errors:',errors);console.error('Snapshot:',await snap().catch(()=>null));throw error;}finally{await browser.close();}
