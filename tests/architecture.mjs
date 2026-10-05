import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { MODULES, LINKS, HULL_PROFILES, moduleFacet, modulePolygon, insidePolygon } from '../src/layout.js';
import { createWalkable, canWalk, movePlayer } from '../src/navigation.js';

await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await page.routeWebSocket('**',()=>{});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!/pointer.?lock/i.test(m.text()))errors.push(m.text());});
const snapshot=()=>page.evaluate(()=>window.__SENTIENT__.snapshot());
const pose=(x,z,yaw)=>page.evaluate(p=>window.__SENTIENT__.teleport(...p),[x,z,yaw]);
try {
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');
  await page.waitForFunction(()=>window.__SENTIENT__&&document.getElementById('loading').hidden);
  const state=await snapshot(),areas=createWalkable();
  const blockers=state.colliders.map(c=>({...c,disabled:c.disabled||c.id?.startsWith('door-')}));
  assert.equal(state.roomCharacterStats.profiles.length,7);assert.ok(state.roomCharacterStats.parts>=550);
  assert.equal(state.corridorStats.links,7);assert.ok(state.corridorStats.parts>=500);
  assert.equal(state.corridorStats.panels,7);assert.ok(state.corridorStats.maxWallInset<=.15);
  assert.equal(state.lighting.activePracticals,6);assert.equal(state.lighting.shadowMaps,0);
  assert.ok(state.spaceStats.planetaryRings.outerRadius>state.spaceStats.planetaryRings.innerRadius, 'Alien planet has a finite tilted dust ring');
  const captures=[];
  await page.getByRole('button',{name:'ENTER THE STATION'}).click();
  for(const m of MODULES) {
    const {a,b}=moduleFacet(m,HULL_PROFILES[m.id].face),goal={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
    // Follow real walkable cells and rendered furniture, rather than teleporting
    // into an attractive but unreachable bay just for a screenshot.
    const step=.16,queue=[{x:m.x,z:m.z}],seen=new Set(['0,0']);let bay;
    for(let i=0;i<queue.length;i++) {
      const here=queue[i];
      if((Math.abs(here.x-m.x)>m.hx+.2||Math.abs(here.z-m.z)>m.hz+.2)&&Math.hypot(here.x-goal.x,here.z-goal.z)<(m.id==='bridge'?2:1.5))bay=here;
      for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]) {
        const x=here.x+dx,z=here.z+dz,key=`${Math.round((x-m.x)/step)},${Math.round((z-m.z)/step)}`;
        if(seen.has(key)||!insidePolygon(x,z,modulePolygon(m))||!canWalk(x,z,areas,blockers))continue;
        const next=movePlayer(here,dx,dz,areas,blockers);
        if(Math.hypot(next.x-x,next.z-z)>.01)continue;
        queue.push({x,z});seen.add(key);
      }
    }
    assert.ok(bay,`${m.id} irregular expansion is physically reachable around all rendered furniture`);
    const yaw=Math.atan2(-(goal.x-m.x),-(goal.z-m.z));
    await pose(m.x,m.z,yaw);await page.waitForTimeout(450);
    const shot=await snapshot();assert.ok(shot.calls>0&&shot.triangles>0);
    const path=`test-results/architecture-${m.id}.png`;await page.screenshot({path});
    captures.push({id:m.id,profile:HULL_PROFILES[m.id].name,vertices:modulePolygon(m).length,bay,path,calls:shot.calls,triangles:shot.triangles});
  }
  for(const link of LINKS) {
    const x=(link.a.x+link.b.x)/2,z=(link.a.z+link.b.z)/2;
    assert.ok(canWalk(x,z,areas,blockers),`${link.id} equipment leaves its aisle clear`);
    await pose(x,z,link.a.x===link.b.x?.55:Math.PI/2+.55);await page.waitForTimeout(250);
    await page.screenshot({path:`test-results/architecture-hall-${link.id}.png`});
  }
  await page.keyboard.press('KeyM');await page.screenshot({path:'test-results/architecture-map.png'});
  assert.deepEqual(errors,[]);
  await writeFile('test-results/architecture-validation.json',JSON.stringify({captures,corridors:state.corridorStats,planet:state.spaceStats,errors},null,2));
  console.log('PASS: all seven irregular extensions reachable; seven equipped halls, map, alien planet and bounded lighting render without errors.');
} catch(error){await page.screenshot({path:'test-results/architecture-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
