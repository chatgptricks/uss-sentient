// Public UI journey shared by local-preview and live Pages deployment smoke.
// No development globals, teleportation, or direct activation calls.
import assert from 'node:assert/strict';
export async function publicExpansionJourney(page,base) {
  await page.goto(base);
  await page.locator('#loading').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'ENTER THE STATION'}).click();
  const walk=async(key,until,extra=0)=>{
    await page.keyboard.down(key);
    try {if(typeof until==='number')await page.waitForTimeout(until);else await page.waitForFunction(name=>document.getElementById('location-name').textContent===name,until);if(extra)await page.waitForTimeout(extra);}
    finally {await page.keyboard.up(key);}
  };
  await walk('KeyW',520);
  await walk('KeyD','EVA airlock',1250);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>/0.0 kPa · VACUUM/.test(document.getElementById('environment-value').textContent));
  await walk('KeyD','Exterior walkway');
  assert.match(await page.locator('#environment-value').textContent(),/SUIT SEALED/);
  await page.screenshot({path:'test-results/deployment-eva.png'});
  await walk('KeyA','EVA airlock',900);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>/101.3 kPa · PRESSURIZED/.test(document.getElementById('environment-value').textContent));
  await walk('KeyA','The Front Door',970);
  await walk('KeyW','The Forum',900);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>document.getElementById('location-name').textContent==='Nadir observation cupola');
  await page.screenshot({path:'test-results/deployment-cupola.png'});
  assert.match(await page.locator('#environment-value').textContent(),/PELAGIA/);
  await page.keyboard.press('KeyM');
  await page.getByRole('button',{name:'Navigate to EVA airlock',exact:true}).click();
  await page.waitForFunction(()=>/CLIMB THE LADDER/.test(document.getElementById('route-step').textContent));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>document.getElementById('location-name').textContent==='The Forum');
  console.log('PASS: public-UI pressure cycle, EVA exit/return, Forum hatch descent, planet cupola, map and ladder return.');
}
