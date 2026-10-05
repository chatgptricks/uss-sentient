import * as THREE from 'three';
import { moduleFacet } from './layout.js';

/** Shared exterior batches: thermal blankets, EVA hardware and utility structure. */
export function addExteriorDetails(ctx) {
  const { root, MODULES, LINKS, rooms, materials: M, kit, mat, texture, textPlane, resourceGeometries } = ctx;
  const stats = { parts:0, blanketPanels:0, handholds:0, tanks:0, hullNames:0, umbilicals:0, radiatorMounts:0, decoratedFacets:0, addedDrawCallUpperBound:25 };
  const B=(x,y,z,w,h,d,material,ry=0)=>{stats.parts++;kit.cuboid(x,y,z,w,h,d,material,ry,root);};
  const P=(a,b,r,material,sides=10)=>{stats.parts++;kit.pipe(a,b,r,material,sides,root);};
  const point=(f,x,y,z)=>kit.toWorld(f.origin,f.ry,[x,y+f.elevation,z]);
  const L=(f,x,y,z,w,h,d,material)=>B(...point(f,x,y,z),w,h,d,material,f.ry);
  const LP=(f,a,b,r,material,sides=10)=>P(point(f,...a),point(f,...b),r,material,sides);
  const bolt=(f,x,y,z)=>{kit.bolt(...point(f,x,y,z),f.ry,M.silver,.017,root);stats.parts++;};
  const blanketMap=texture(512,512,g=>{
    g.fillStyle='#cfcec0';g.fillRect(0,0,512,512);
    // Fixed restrained folds read as sewn insulation, without noisy glossy grain.
    for(let y=0;y<512;y+=64)for(let x=0;x<512;x+=64) {
      g.fillStyle=((x+y)/64)%3?'rgba(247,245,225,.08)':'rgba(88,96,86,.06)';
      g.beginPath();g.moveTo(x,y);g.lineTo(x+64,y+64);g.lineTo(x,y+64);g.fill();
      g.strokeStyle='rgba(72,82,73,.12)';g.lineWidth=1;g.beginPath();g.moveTo(x+2,y+2);g.lineTo(x+62,y+62);g.stroke();
    }
    g.strokeStyle='#989f94';g.lineWidth=3;g.strokeRect(12,12,488,488);
    g.setLineDash([3,7]);g.lineWidth=1;g.strokeStyle='#eae9da';g.strokeRect(18,18,476,476);g.setLineDash([]);
    for(const x of [22,480])for(const y of [22,480]){g.fillStyle='#7b8379';g.fillRect(x-3,y-3,6,6);}
    g.fillStyle='#acb0a3';g.fillRect(336,431,143,47);
    g.fillStyle='#505b54';g.font='500 14px Space, Arial';g.fillText('MLI / SERVICE',344,450);g.font='11px Space, Arial';g.fillText('NO STEP · 0.4 BAR',344,467);
  });
  const blanket=mat({map:blanketMap,bumpMap:blanketMap,bumpScale:.0025,color:0xe6e3d2,roughness:.82,metalness:.12});
  blanket.name='Exterior / stitched thermal blankets';
  const foil=mat({color:0x9f926c,roughness:.58,metalness:.43});foil.name='Exterior / muted multilayer foil';
  const reserved={0:'N',2:'E',4:'S',6:'W'};
  function facet(m,index) {
    const {a,b}=moduleFacet(m,index);
    return {origin:{x:(a.x+b.x)/2,z:(a.z+b.z)/2},ry:-Math.atan2(b.z-a.z,b.x-a.x)+Math.PI,elevation:m.elevation,length:Math.hypot(b.x-a.x,b.z-a.z),index};
  }
  function available(m,index) {
    return index!==7 && !(m.id==='bridge'&&[0,1,2].includes(index))
      && !(m.id==='front-door'&&index===2) && !(reserved[index]&&m.ports.includes(reserved[index]));
  }
  const decorated=new Map();
  for(const m of MODULES) {
    const facets=[];
    for(let index=0;index<8;index++) {
      if(!available(m,index))continue;
      const f=facet(m,index);facets.push(f);stats.decoratedFacets++;
      const width=f.length-.16, columns=Math.max(1,Math.floor(width/.85)), panelWidth=width/columns-.045;
      for(let column=0;column<columns;column++) {
        const x=-width/2+(column+.5)*width/columns;
        for(const y of [.68,1.88]) {
          L(f,x,y,.215,panelWidth,1.04,.054,blanket);stats.blanketPanels++;
          for(const sx of [-1,1])for(const sy of [-1,1])bolt(f,x+sx*(panelWidth/2-.055),y+sy*.455,.250);
          // Small closures reinforce the stitched blanket rather than flat siding.
          L(f,x,y-.49,.263,.12,.035,.025,M.graphite);
        }
      }
      for(const y of [.10,1.28,2.48])L(f,0,y,.222,width+.04,.045,.070,M.silver);
      for(const x of [-width/2,width/2])L(f,x,1.30,.222,.037,2.37,.072,M.graphite);
      // Raised handholds and their standoffs cast a human-scale silhouette.
      const handWidth=Math.min(.86,width-.20);
      LP(f,[-handWidth/2,1.68,.33],[handWidth/2,1.68,.33],.029,M.silver);
      for(const x of [-handWidth/2,handWidth/2]) {
        LP(f,[x,1.68,.23],[x,1.68,.36],.030,M.silver);
        L(f,x,1.68,.254,.095,.13,.038,foil);
      }
      stats.handholds++;
      // Exposed service harness stays below the windows/pressure shoulder.
      for(const y of [.30,.38])LP(f,[-width/2+.04,y,.29],[width/2-.04,y,.29],.018,M.seal);
      for(let x=-width/2+.17;x<width/2;x+=.54)L(f,x,.34,.305,.045,.145,.055,M.silver);
      const junctionX=Math.max(0,width/2-.30);
      L(f,junctionX,.74,.29,.30,.32,.14,M.graphite);
      L(f,junctionX,.74,.37,.255,.265,.025,foil);
      LP(f,[junctionX,.57,.34],[junctionX,.36,.34],.025,M.seal);
      // Physical hazard ticks use existing batch materials, not decal draw calls.
      for(let tick=0;tick<3;tick++)L(f,-.15+tick*.10,2.37,.253,.055,.052,.016,tick%2?M.graphite:M.accent);
    }
    decorated.set(m.id,facets);
    const preferred={'front-door':4,archive:2,floor:4,lab:6,forum:3,commons:2,bridge:3}[m.id];
    const f=facets.find(f=>f.index===preferred)||facets[0], room=rooms.find(room=>room.id===m.id);
    if(f) {
      const width=Math.min(1.85,f.length-.23), map=texture(768,192,g=>{
        g.fillStyle='#d8d8ca';g.fillRect(0,0,768,192);g.fillStyle='#223034';g.fillRect(0,0,110,192);
        g.fillStyle='#cfff04';g.font='500 68px Space, Arial';g.fillText(room.number,13,95);
        g.font='500 41px Space, Arial';g.fillStyle='#243336';g.fillText('USS SENTIENT',137,55);
        g.font='500 31px Space, Arial';g.fillText(room.shortName.toUpperCase(),140,105,596);
        g.font='400 16px Space, Arial';g.fillStyle='#5f6b61';g.fillText('PRESSURE MODULE / EXTERNAL SERVICE ACCESS',141,144);
        g.fillStyle='#90998b';for(let x=144;x<736;x+=8)g.fillRect(x,165,x%3?3:5,14);
      });
      L(f,0,2.20,.266,width+.075,width/4+.06,.075,M.graphite);
      const plaque=textPlane(map,width,width/4,...point(f,0,2.20,.307),f.ry,root);
      plaque.name=`Exterior module identification / ${room.number} ${room.shortName}`;stats.hullNames++;
    }
  }

  // Compact pressure vessels mount against unused solid facets. No tank lies
  // beside the Arrival EVA bay or the east gantry at x=17.
  const caps=[];
  for(const [id,index] of [['front-door',6],['floor',4],['lab',6],['commons',4]]) {
    const f=decorated.get(id)?.find(f=>f.index===index);if(!f||f.length<1.6)continue;
    L(f,0,1.14,.38,1.55,1.70,.095,M.graphite);
    for(const x of [-.47,0,.47]) {
      const radius=.185;
      LP(f,[x,.62,.62],[x,1.66,.62],radius,M.enamel,16);
      caps.push({point:point(f,x,.62,.62),radius},{point:point(f,x,1.66,.62),radius});
      for(const y of [.82,1.44]) {
        LP(f,[x,y-.04,.62],[x,y+.04,.62],radius+.017,M.silver,16);
        L(f,x,y,.44,.32,.09,.16,M.silver);
      }
      LP(f,[x,1.75,.62],[x,1.90,.62],.038,M.graphite);
      LP(f,[x,1.90,.62],[x,1.90,.38],.025,M.silver);
      L(f,x,1.09,.810,.12,.09,.019,foil);stats.tanks++;
    }
    LP(f,[-.59,1.91,.37],[.59,1.91,.37],.034,M.silver);
  }
  if(caps.length) {
    const geometry=new THREE.SphereGeometry(1,16,10);resourceGeometries.add(geometry);
    const mesh=new THREE.InstancedMesh(geometry,M.enamel,caps.length), matrix=new THREE.Matrix4(), q=new THREE.Quaternion();
    caps.forEach((cap,index)=>{matrix.compose(new THREE.Vector3(...cap.point),q,new THREE.Vector3(cap.radius,.12,cap.radius));mesh.setMatrixAt(index,matrix);});
    mesh.name='Exterior / pressure-vessel rounded end caps';mesh.castShadow=mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);stats.parts+=caps.length;
  }

  for(const link of LINKS) {
    const dx=link.b.x-link.a.x,dz=link.b.z-link.a.z,length=Math.hypot(dx,dz),px=-dz/length,pz=dx/length;
    for(const offset of [-.25,.25]) {
      const a=[link.a.x+px*offset,link.elevationA+2.98,link.a.z+pz*offset];
      const b=[link.b.x+px*offset,link.elevationB+2.98,link.b.z+pz*offset];
      P(a,b,.034,offset<0?M.seal:M.silver);stats.umbilicals++;
      for(const [point,elevation] of [[a,link.elevationA],[b,link.elevationB]])P([point[0],elevation+2.55,point[2]],point,.027,M.silver);
      for(let step=1;step<length;step+=1.25){const t=step/length;B(a[0]+dx*t,a[1]+(b[1]-a[1])*t,a[2]+dz*t,.14,.10,.12,foil,Math.atan2(dx,dz));}
    }
  }

  // Existing radiator leaves sit at y=3.8 above the Archive/Floor connection.
  // Add hinge bearings, load paths and braces all the way back to pressure hull.
  for(const side of [-1,1]) {
    const hinge=side*4.80;
    for(const z of [-12.35,-9.65]) {
      B(side*1.62,3.15,z,.38,.12,.34,M.graphite);
      P([side*1.62,3.19,z],[hinge,3.60,z],.064,M.silver);
      P([side*2.23,2.70,z],[hinge,3.60,z],.048,M.silver);
      P([hinge,3.60,z],[side*8.02,3.69,z],.055,M.silver);
      P([side*2.05,3.23,z],[hinge,3.60,z===-12.35?-9.65:-12.35],.030,M.graphite);
      P([hinge,3.62,z-.13],[hinge,3.62,z+.13],.14,M.graphite,16);
      B(hinge,3.46,z,.30,.20,.31,foil);
    }
    P([hinge,3.62,-13.26],[hinge,3.62,-8.74],.076,M.silver);
    for(let i=0;i<6;i++) {
      const x=side*(5+i*.54);
      P([x,3.66,-12.35],[x,3.75,-11],.031,M.silver);
      P([x,3.66,-9.65],[x,3.75,-11],.031,M.silver);
    }
    stats.radiatorMounts++;
  }
  for(const z of [-12.35,-9.65]) {
    B(-8.60,2.11,z,.38,.12,.34,M.graphite);
    P([-8.60,2.17,z],[-7.70,3.69,z],.064,M.silver);
    P([-9.25,2.07,z],[-7.70,3.69,z],.043,M.silver);
  }
  return stats;
}
