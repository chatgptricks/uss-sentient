// Separate deck layers let the Forum and its cupola share a real vertical shaft.
export const CUPOLA = { x: 0, z: -22, elevation: -4.8, radius: 2.72, hatch: { x: 0, z: -21.8, radius: .7 } };
export const AIRLOCK = { x: 6.65, z: 0, innerX: 4.5, outerX: 8.8 };
export const EXTENSION_DESTINATIONS = [
  { id: 'airlock', number: 'A1', name: 'EVA airlock', shortName: 'Airlock', function: 'Suit up · cycle pressure · go outside', approach: {x:6.4,z:0} },
  { id: 'exterior', number: 'EVA', name: 'Exterior walkway', shortName: 'Exterior', function: 'Magnetic boots · solar arrays · orbital panorama', approach: {x:17,z:-12} },
  { id: 'cupola', number: '05↓', name: 'Nadir observation cupola', shortName: 'Cupola', function: 'Below Forum · open the hatch and descend', approach: CUPOLA.hatch },
];
export const EXTENSION_AREAS = [
  {id:'airlock-connector',x:3.5,z:0,w:2.1,d:1.85},
  {id:'airlock',x:6.65,z:0,w:4.4,d:2.4},
  {id:'eva-outbound',x:12.9,z:0,w:8.3,d:1.8},
  {id:'eva-spine',x:17,z:-17.5,w:1.8,d:36.8},
  {id:'eva-lookout',x:17,z:-31,w:4.6,d:4.2},
];
export const CUPOLA_AREAS = [{id:'cupola',points:Array.from({length:32},(_,i)=>({x:CUPOLA.x+Math.cos(i*Math.PI/16)*CUPOLA.radius,z:CUPOLA.z+Math.sin(i*Math.PI/16)*CUPOLA.radius}))}];
export function expansionZone(position, layer = 'station') {
  if (layer === 'cupola') return 'cupola';
  if (position.x > 8.83 && EXTENSION_AREAS.some(a=>a.id.startsWith('eva-') && Math.abs(position.x-a.x)<=a.w/2 && Math.abs(position.z-a.z)<=a.d/2)) return 'exterior';
  if (position.x > 3.05 && Math.abs(position.z)<1.4) return 'airlock';
  return 'station';
}
