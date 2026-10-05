import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, LINKS, modulePolygon, insidePolygon } from '../src/layout.js';
import { createWalkable, canWalk, movePlayer } from '../src/navigation.js';
import { AMENITIES, findAmenityRoute, interactionBlocked } from '../src/amenities.js';
import { corridorWindows, corridorWindowAt } from '../src/corridor-layout.js';

test('occupied annexes contain their furnishings and service approaches',()=>{
  const areas=createWalkable();
  for(const amenity of AMENITIES)assert.ok(canWalk(amenity.x,amenity.z,areas),amenity.name);
  const commons=MODULES.find(m=>m.id==='commons');
  for(const x of [11.22,14.10])for(const z of [-18.10,-14.92])
    assert.ok(insidePolygon(x,z,modulePolygon(commons)),'Bathroom enclosure is entirely inside the pressure hull');
});

test('local guidance routes around furniture and never crosses the hull',()=>{
  const m=MODULES.find(m=>m.id==='forum'),areas=createWalkable();
  const goal=AMENITIES.find(a=>a.id==='meeting');
  const blockers=[{x:5.1,z:-18.4,w:1.7,d:1.5}];
  const route=findAmenityRoute({x:m.x,z:m.z},goal,m,areas,blockers);
  assert.ok(route.length>1,'Furniture requires a real detour');
  let here={x:m.x,z:m.z};
  for(const next of route)for(let frames=0;Math.hypot(next.x-here.x,next.z-here.z)>.015;frames++){
    assert.ok(frames<500,'Guidance reaches every waypoint');
    const length=Math.hypot(next.x-here.x,next.z-here.z),step=Math.min(.07,length);
    here=movePlayer(here,(next.x-here.x)/length*step,(next.z-here.z)/length*step,areas,blockers);
    assert.ok(canWalk(here.x,here.z,areas,blockers));
  }
  assert.ok(Math.hypot(here.x-goal.x,here.z-goal.z)<.02);
});

test('solid privacy partitions stop interaction and an open door restores it',()=>{
  const wall={x:0,z:0,w:2,d:.1,occludesInteraction:true};
  assert.equal(interactionBlocked({x:0,z:-1},{x:0,z:1},[wall]),true);
  assert.equal(interactionBlocked({x:1.2,z:-1},{x:1.2,z:1},[wall]),false);
  assert.equal(interactionBlocked({x:0,z:-1},{x:0,z:1},[{...wall,disabled:true}]),false);
  assert.equal(interactionBlocked({x:0,z:-1},{x:.2,z:-.1},[wall]),false,'Same-side control remains usable');
});

test('four physical corridor viewports fit between pressure ribs and reserve their service bays',()=>{
  let count=0;
  for(const link of LINKS)for(const w of corridorWindows(link)) {
    const length=Math.hypot(link.b.x-link.a.x,link.b.z-link.a.z);
    for(let rib=-length/2+.35;rib<length/2;rib+=1.25)
      assert.ok(Math.abs(rib-w.at)>w.width/2+.195,'Frame clears the structural rib');
    assert.ok(w.centerY-w.height/2>1.0&&w.centerY+w.height/2<2.375);
    assert.equal(corridorWindowAt(link,w.side,w.at,.345),true);
    assert.equal(corridorWindowAt(link,-w.side,w.at,.345),false);
    count++;
  }
  assert.equal(count,4);
});
