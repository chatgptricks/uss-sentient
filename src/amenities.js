import { modulePolygon, insidePolygon } from './layout.js';
import { canWalk } from './navigation.js';

export const AMENITIES = [
  {id:'meeting',roomId:'forum',number:'05·B',name:'Briefing room',shortName:'Briefing',function:'Six-seat strategy table · working presentation',x:7.00,z:-18.80,elevation:0},
  {id:'sanitation',roomId:'commons',number:'04·S',name:'Bathroom',shortName:'Bathroom',function:'Privacy door · wash station · vacuum sanitation',x:12.5,z:-18.75,elevation:.75},
  {id:'machinery',roomId:'floor',number:'02·M',name:'Machinery bay',shortName:'Machinery',function:'Coolant pumps · air handling · service controls',x:-10.65,z:-6.45,elevation:-1.05},
].map(a=>({...a,approach:{x:a.x,z:a.z}}));

export function clearSegment(a,b,areas,colliders) {
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.09));
  for(let i=1;i<=steps;i++)if(!canWalk(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,areas,colliders))return false;
  return true;
}

/** In-room guidance goes around real chair/table/partition collision footprints. */
export function findAmenityRoute(start, goal, module, areas, colliders) {
  if(clearSegment(start,goal,areas,colliders))return [{x:goal.x,z:goal.z}];
  const step=.18,polygon=modulePolygon(module),key=(x,z)=>`${x},${z}`;
  const first={x:start.x,z:start.z,g:0,ix:0,iz:0,parent:null};
  const pending=[first],costs=new Map([[key(0,0),0]]);let last;
  const distance=p=>Math.hypot(goal.x-p.x,goal.z-p.z);
  for(let count=0;pending.length&&count<12000;count++) {
    let best=0;
    for(let i=1;i<pending.length;i++)if(pending[i].g+distance(pending[i])<pending[best].g+distance(pending[best]))best=i;
    const current=pending.splice(best,1)[0];
    if(current.g>costs.get(key(current.ix,current.iz)))continue;
    if(distance(current)<step*1.5&&clearSegment(current,goal,areas,colliders)){last=current;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const ix=current.ix+dx,iz=current.iz+dz,x=start.x+ix*step,z=start.z+iz*step,g=current.g+step,k=key(ix,iz);
      if(g>=(costs.get(k)??Infinity)||!insidePolygon(x,z,polygon)||!canWalk(x,z,areas,colliders))continue;
      costs.set(k,g);pending.push({ix,iz,x,z,g,parent:current});
    }
  }
  if(!last)return [];
  const chain=[{x:goal.x,z:goal.z}];
  for(let node=last;node;node=node.parent)chain.unshift({x:node.x,z:node.z});
  const route=[];let anchor=0;
  while(anchor<chain.length-1) {
    let next=anchor+1;
    while(next+1<chain.length&&clearSegment(chain[anchor],chain[next+1],areas,colliders))next++;
    route.push(chain[next]);anchor=next;
  }
  return route;
}

// A cabinet-mounted switch must not be usable through the bathroom partition.
export function interactionBlocked(from,to,colliders) {
  return colliders.some(c=>{
    if(!c.occludesInteraction||c.disabled)return false;
    let lo=0,hi=.96;
    for(const [axis,size] of [['x','w'],['z','d']]) {
      const delta=to[axis]-from[axis],min=c[axis]-c[size]/2,max=c[axis]+c[size]/2;
      if(Math.abs(delta)<1e-8){if(from[axis]<min||from[axis]>max)return false;continue;}
      const a=(min-from[axis])/delta,b=(max-from[axis])/delta;
      lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return false;
    }
    return lo<=hi;
  });
}
