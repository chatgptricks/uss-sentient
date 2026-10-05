import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { MODULES, moduleAt, surfaceHeight } from '../src/layout.js';
import { canWalk, createWalkable, movePlayer } from '../src/navigation.js';
import { AMENITIES, findAmenityRoute } from '../src/amenities.js';

await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await page.routeWebSocket('**',()=>{});
const errors=[],failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
const snap=()=>page.evaluate(()=>window.__SENTIENT__.snapshot());
const pose=(x,z,yaw=0,pitch=0)=>page.evaluate(p=>window.__SENTIENT__.teleport(p[0],p[1],p[2],'station',p[3]),[x,z,yaw,pitch]);
const photo=async name=>{await page.waitForTimeout(500);await page.screenshot({path:`test-results/habitation-${name}.png`});};
const records=[];
try {
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');
  await page.waitForFunction(()=>window.__SENTIENT__&&document.getElementById('loading').hidden);
  await page.getByRole('button',{name:'ENTER THE STATION'}).click();await page.waitForTimeout(2400);
  let state=await snap();const areas=createWalkable();
  assert.equal(state.meetingStats.chairs,6);assert.equal(state.meetingStats.embeddedScreens,6);
  assert.equal(state.serviceStats.bathrooms,1);assert.equal(state.serviceStats.machineRacks,1);
  assert.equal(state.habitationStats.texturesLoaded,2);assert.equal(state.habitationStats.textureFailures,0);
  assert.equal(state.habitationStats.modules,7);assert.equal(state.lighting.activePracticals,6);assert.equal(state.lighting.shadowMaps,0);
  assert.equal(state.viewportStats.windows,4);
  const openDoors=()=>state.colliders.map(c=>({...c,disabled:c.disabled||c.id?.startsWith('door-')}));
  async function use(id,approach,click=false) {
    state=await snap();const device=state.devices.find(d=>d.id===id);assert.ok(device,id);
    const at=approach||device.approach;assert.ok(at,`${id} has an approach`);
    assert.ok(canWalk(at.x,at.z,areas,openDoors()),`${id} approach does not clip furniture`);
    assert.ok(Math.hypot(device.x-at.x,device.z-at.z)<device.range,`${id} is within operating range`);
    const yaw=Math.atan2(-(device.x-at.x),-(device.z-at.z));
    const pitch=Math.atan2(device.y-(surfaceHeight(at)+1.6),Math.hypot(device.x-at.x,device.z-at.z));
    await pose(at.x,at.z,yaw,pitch);
    await page.waitForFunction(id=>window.__SENTIENT__.snapshot().focusedDevice===id,id,{timeout:5000});
    if(click)await page.mouse.click(720,500);else await page.keyboard.press('KeyE');
    await page.waitForTimeout(170);const after=(await snap()).devices.find(d=>d.id===id);
    records.push({id,before:device.state,after:after.state});return after;
  }
  assert.ok((await page.evaluate(()=>window.__SENTIENT__.viewportClearance())).every(w=>!w.blocked),'Real exterior apertures contain no opaque hull/equipment');
  for(const v of state.viewportViews) {
    const id=`viewport-${v.link}`,at={x:v.x+v.nx*.78,z:v.z+v.nz*.78};
    await use(id,at,true);await page.waitForTimeout(700);
    assert.ok((await page.evaluate(()=>window.__SENTIENT__.viewportClearance())).find(w=>w.link===v.link).blocked,'Closed shutter physically covers glass');
    await use(id,at);await page.waitForTimeout(750);
    assert.ok(!(await page.evaluate(()=>window.__SENTIENT__.viewportClearance())).find(w=>w.link===v.link).blocked,'Opening retracts both leaves');
    await pose(at.x,at.z,Math.atan2(v.nx,v.nz),.02);await photo(`window-${v.link}`);
  }
  const meeting=await use('meeting-briefing',null,true);assert.equal(meeting.state.index,1);
  assert.ok(meeting.state.presentationVersion>records.at(-1).before.presentationVersion);
  await photo('meeting-table');
  for(let i=0;i<2;i++)await use('meeting-briefing');
  assert.equal((await snap()).devices.find(d=>d.id==='meeting-briefing').state.index,0);
  await pose(3.55,-19.35,-2.31,-.20);await photo('briefing-room');
  await use('service-floor-cooling',null,true);assert.equal((await snap()).devices.find(d=>d.id==='service-floor-cooling').state.index,2);
  await pose(-11.0,-7.65,-2.03,-.10);await photo('machinery');
  await use('service-bath-door',null,true);await page.waitForTimeout(900);
  state=await snap();assert.ok(state.colliders.find(c=>c.id==='service-bath-door').disabled);
  await pose(12.5,-18.75,Math.PI,0);await page.keyboard.down('KeyW');await page.waitForTimeout(510);await page.keyboard.up('KeyW');
  state=await snap();assert.ok(state.position.z>-17.65,'Walked through the physical privacy aperture');
  await use('service-bath-door-inside');await page.waitForTimeout(900);
  state=await snap();assert.ok(!state.colliders.find(c=>c.id==='service-bath-door').disabled);
  const doorOutside=state.devices.find(d=>d.id==='service-bath-door');
  await pose(12.55,-17.35,Math.atan2(-(doorOutside.x-12.55),-(doorOutside.z+17.35)),-.2);await page.waitForTimeout(180);
  assert.notEqual((await snap()).focusedDevice,'service-bath-door','Outside control cannot be activated through partition');
  await use('service-bath-wash',null,true);assert.ok((await snap()).devices.find(d=>d.id==='service-bath-wash').state.active);
  await photo('wash-station');await page.waitForFunction(()=>!window.__SENTIENT__.snapshot().devices.find(d=>d.id==='service-bath-wash').state.active,null,{timeout:8000});
  assert.ok((await snap()).devices.find(d=>d.id==='service-bath-wash').state.reclaimedLitres>0);
  await use('service-bath-flush',null,true);assert.ok((await snap()).devices.find(d=>d.id==='service-bath-flush').state.active);
  await photo('sanitation');await page.waitForFunction(()=>!window.__SENTIENT__.snapshot().devices.find(d=>d.id==='service-bath-flush').state.active,null,{timeout:8000});
  assert.equal((await snap()).devices.find(d=>d.id==='service-bath-flush').state.phase,'READY');
  await use('service-bath-door-inside');await page.waitForTimeout(900);
  await pose(12.5,-17.35,0,0);await page.keyboard.down('KeyW');await page.waitForTimeout(610);await page.keyboard.up('KeyW');
  assert.ok((await snap()).position.z<-18.55,'Walked back to Commons');
  await use('habitat-bridge-air',{x:-3.1,z:-33.815},true);await use('habitat-bridge-air',{x:-3.1,z:-33.815});await page.waitForTimeout(950);
  assert.ok((await snap()).devices.find(d=>d.id==='habitat-bridge-air').state.filterOpen);await photo('ventilation');
  // Exercise live UI guidance in both directions around the imported editing desk.
  for(const [start,name,goal] of [
    [{x:-10.45,z:-10.3},'Machinery bay',AMENITIES.find(a=>a.id==='machinery')],
    [{x:-10.65,z:-6.45},'The Bridge',{x:-11,z:-11}],
  ]) {
    await pose(start.x,start.z);await page.keyboard.press('KeyM');await page.getByRole('button',{name:`Navigate to ${name}`,exact:true}).click();
    let position={...start};state=await snap();const blockers=openDoors();
    for(let frame=0;frame<320&&Math.hypot(position.x-goal.x,position.z-goal.z)>.10;frame++) {
      const route=(await snap()).route;assert.ok(route.length,'Guidance returns a reachable waypoint');const next=route[0];
      const dist=Math.hypot(next.x-position.x,next.z-position.z),step=Math.min(.11,dist);
      position=movePlayer(position,(next.x-position.x)/(dist||1)*step,(next.z-position.z)/(dist||1)*step,areas,blockers);
      await pose(position.x,position.z);
      if(name==='The Bridge'&&position.z<-10.9)break;
    }
    assert.ok(Math.hypot(position.x-goal.x,position.z-goal.z)<.14,`Live ${name} route clears furniture`);
  }
  // Actual colliders must also allow each newly selectable bay to be reached.
  state=await snap();for(const destination of AMENITIES) {
    const module=MODULES.find(m=>m.id===destination.roomId);
    assert.ok(findAmenityRoute(module,destination,module,areas,openDoors()).length,`${destination.name} physically reachable`);
    await pose(module.x,module.z);await page.keyboard.press('KeyM');await page.getByRole('button',{name:`Navigate to ${destination.name}`,exact:true}).click();
    assert.equal((await snap()).target,destination.id);
  }
  await page.keyboard.press('KeyM');await photo('deck-directory');await page.keyboard.press('Escape');
  const frames=await page.evaluate(()=>new Promise(resolve=>{let first;let count=0;function step(t){first??=t;if(++count===45)resolve(1000*44/(t-first));else requestAnimationFrame(step);}requestAnimationFrame(step);}));
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  await writeFile('test-results/habitation-validation.json',JSON.stringify({records,fpsDiagnostic:frames,meeting:state.meetingStats,services:state.serviceStats,habitation:state.habitationStats,errors,failures},null,2));
  console.log(`PASS: 11 new controls, four real viewports/shutters, six-seat briefing, physical washroom access, wash/flush/cooling/ventilation, and both directions of live furniture-aware guidance. ${frames.toFixed(1)} fps diagnostic.`);
} catch(error){await page.screenshot({path:'test-results/habitation-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
