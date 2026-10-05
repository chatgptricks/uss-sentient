import * as THREE from 'three';
import { AIRLOCK, CUPOLA, EXTENSION_AREAS } from './expansion-layout.js';

/** Pressure-cycled EVA bay, structural exterior, and a separate lower glass deck. */
export function addExpansion(ctx) {
  const {root,kit,box,mat,texture,addMesh,textPlane,roundedFrame,endSection,materials:M} = ctx;
  endSection();
  const devices = [], colliders = [];
  const metal = mat({color:0xc4cbc6,roughness:.64,metalness:.48,emissive:0x28343e,emissiveIntensity:.25});
  const dark = mat({color:0x202e39,roughness:.64,metalness:.45,emissive:0x101c2b,emissiveIntensity:.4});
  const amber = mat({color:0xe9b75c,emissive:0xeba84a,emissiveIntensity:.5});
  const glazing = mat({color:0x9dcee5,transparent:true,opacity:.045,roughness:.06,metalness:.1,side:THREE.DoubleSide,depthWrite:false});
  const shaftEnamel = mat({color:M.enamel.color,roughness:M.enamel.roughness,metalness:M.enamel.metalness,bumpMap:M.enamel.bumpMap,bumpScale:M.enamel.bumpScale,side:THREE.DoubleSide});
  const ringGeometry = (radius,tube=.05) => new THREE.TorusGeometry(radius,tube,6,64);
  const ring = (radius,x,y,z,material=M.silver,rx=Math.PI/2,tube=.05) => {
    const mesh=addMesh(ringGeometry(radius,tube),material);mesh.position.set(x,y,z);mesh.rotation.x=rx;return mesh;
  };
  function label(title,sub,x,y,z,yaw=0,width=1.2) {
    const map=texture(768,224,g=>{
      g.fillStyle='#101d24';g.fillRect(0,0,768,224);g.fillStyle='#cfff04';g.fillRect(0,0,7,224);
      g.font='500 47px Space, Arial';g.fillStyle='#f0f1e4';g.fillText(title,30,88,707);
      g.font='26px Space, Arial';g.fillStyle='#acc1c3';g.fillText(sub,30,154,707);
    });map.userData.emissiveDisplay=true;
    return textPlane(map,width,width*224/768,x,y,z,yaw);
  }
  function button(id,labelText,x,y,z,yaw,zone,activate) {
    box(x,y,z,.54,.42,.12,M.graphite,yaw);
    const mesh=label(labelText,'[ E / CLICK ]',x+Math.sin(yaw)*.075,y,z+Math.cos(yaw)*.075,yaw,.48);
    const device={id,label:labelText,x,y,z,zone,range:1.85,mesh,activate};devices.push(device);return device;
  }
  // The Arrival side aperture joins a compact, visibly octagonal docking tube.
  for(const [start,end,width] of [[2.55,4.5,2.08],[4.5,8.8,2.75]]) {
    const length=end-start,center=(start+end)/2;
    box(center,-.12,0,length,.24,width,M.graphite);
    for(const s of [-1,1]) {
      box(center,1.25,s*width/2,length,2.5,.15,M.enamel);
      box(center,2.45,s*(width/2-.18),length,.16,.6,M.hull,0,0,s*Math.PI/4);
      kit.pipe([start,.95,s*(width/2-.14)],[end,.95,s*(width/2-.14)],.033,M.silver);
      box(center,.12,s*(width/2-.18),length,.026,.035,M.accent);
      for(let x=start+.3;x<end;x+=.64) {
        box(x,1.22,s*(width/2-.11),.05,2.36,.07,M.graphite);
        for(let i=0;i<5;i++) kit.bolt(x,.4+i*.43,s*(width/2-.15),s>0?Math.PI:0,M.silver,.022);
      }
    }
    box(center,2.74,0,length,.18,width-.55,M.hull);
    for(let x=start+.35;x<end;x+=1.05) {
      box(x,2.62,0,.46,.04,.36,M.whiteLight);
      box(x,.015,0,.035,.018,width-.15,metal);
    }
  }
  label('EVA / EXIT BAY','PRESSURE INTERLOCK · A1',2.7,2.18,0,-Math.PI/2,1.4);
  // Suit packs, oxygen canisters, service cabinet, hoses and handholds.
  for(let i=0;i<3;i++) {
    const x=5.2+i*1.05;
    box(x,1.29,1.22,.74,1.74,.20,M.graphite);
    box(x,1.45,1.04,.44,.75,.23,M.padding);
    const helmet=addMesh(new THREE.SphereGeometry(.23,16,12),M.enamel);helmet.position.set(x,2.00,1.03);
    const visor=addMesh(new THREE.SphereGeometry(.235,16,8,0,Math.PI),dark);visor.rotation.y=Math.PI;visor.position.copy(helmet.position);
    for(const s of [-1,1]) {
      kit.pipe([x+s*.27,.8,1.05],[x+s*.27,1.65,1.05],.092,metal,12);
      kit.pipe([x+s*.26,1.8,1.20],[x+s*.26,2.15,1.20],.023,M.accent);
    }
    for(let j=0;j<5;j++)box(x-.22+j*.11,.62,1.07,.035,.10,.08,j%2?M.silver:M.accent);
    label(`SUIT 0${i+1}`,'O₂ / READY',x,.42,1.08,Math.PI,.60);
    colliders.push({id:`airlock-suit-${i+1}`,x,z:1.07,w:.86,d:.42});
  }
  const airlock = {mode:'pressurized',phase:0,inner:1,outer:0,pressure:101.3};
  const pressureMap=texture(512,320,()=>{});pressureMap.userData.emissiveDisplay=true;
  const pressureScreen=textPlane(pressureMap,1.07,.669,6.55,1.72,-1.12);
  let previousPressure='';
  function paintPressure() {
    const display=`${airlock.mode}:${Math.round(airlock.pressure)}`;if(display===previousPressure)return;previousPressure=display;
    const g=pressureMap.image.getContext('2d');g.fillStyle='#0a1821';g.fillRect(0,0,512,320);
    g.fillStyle='#9bb7b9';g.font='24px Space,Arial';g.fillText('A1 / ATMOSPHERE CONTROL',22,40);
    g.fillStyle=airlock.mode==='pressurized'?'#cfff04':'#ffd083';g.font='54px Space,Arial';g.fillText(`${airlock.pressure.toFixed(1)} kPa`,22,124);
    g.font='25px Space,Arial';g.fillText(airlock.mode.toUpperCase(),22,186);
    g.fillStyle='#bdcec8';g.font='18px Space,Arial';g.fillText('SUIT SEAL VERIFIED · TETHER SECURED',22,235);
    g.fillStyle='#314750';g.fillRect(22,266,465,15);g.fillStyle='#cfff04';g.fillRect(22,266,465*airlock.pressure/101.3,15);pressureMap.needsUpdate=true;
  }
  function cycle() {
    if(airlock.mode==='cycling-out'||airlock.mode==='cycling-in')return 'Pressure cycle in progress. Both hatches are sealed.';
    airlock.mode=airlock.mode==='pressurized'?'cycling-out':'cycling-in';airlock.phase=0;
    return airlock.mode==='cycling-out'?'Suit sealed. Equalizing the bay for EVA.':'Closing the outer hatch. Restoring cabin pressure.';
  }
  const bayControl=button('airlock-cycle','CYCLE AIRLOCK',6.55,1.09,-1.10,0,'airlock',cycle);
  bayControl.mesh=pressureScreen;
  bayControl.x=pressureScreen.position.x;bayControl.y=pressureScreen.position.y;bayControl.z=pressureScreen.position.z;
  button('airlock-call','CALL AIRLOCK',3.8,1.3,-.85,0,'airlock',()=>{
    if(airlock.mode==='pressurized')return 'Inner hatch is open. Enter the pressurized bay.';
    if(airlock.mode==='cycling-in')return 'Restoring cabin pressure. Wait for the inner hatch.';
    // Reversing an interrupted outbound cycle resumes from the actual pressure,
    // rather than abruptly replacing the partially pressurized atmosphere.
    airlock.mode='cycling-in';airlock.phase=.9+3*airlock.pressure/101.3;
    return 'Airlock called. Sealing exterior access and restoring cabin pressure.';
  });
  button('airlock-return','RETURN TO SHIP',9.6,1.15,-.72,Math.PI/2,'exterior',()=>{
    if(airlock.mode==='pressurized'){airlock.mode='cycling-out';airlock.phase=0;return 'Opening exterior access. Wait for the green hatch.';}
    return 'Enter the bay, then use CYCLE AIRLOCK to restore cabin pressure.';
  });
  const airDoors=[];
  for(const [index,x] of [AIRLOCK.innerX,AIRLOCK.outerX].entries()) {
    const group=new THREE.Group();group.position.x=x;group.rotation.y=Math.PI/2;root.add(group);
    roundedFrame(2.45,2.6,.23,.57,.22,M.graphite,group);
    const leaves=[];
    for(const s of [-1,1]) {
      const leaf=new THREE.Group();group.add(leaf);
      kit.cuboid(s*.52,1.18,0,1.0,2.3,.16,M.enamel,0,leaf);
      kit.cuboid(s*.49,1.17,-.09,.18,1.8,.055,index?amber:M.accent,0,leaf);
      for(let j=0;j<7;j++)kit.cuboid(s*.52,.40+j*.26,-.105,.67,.02,.014,M.graphite,0,leaf);
      leaves.push(leaf);
    }
    const collider={id:`airlock-${index?'outer':'inner'}`,x,z:0,w:.24,d:2.7,disabled:!index};colliders.push(collider);
    airDoors.push({id:collider.id,x,z:0,openness:index?0:1,left:leaves[0],right:leaves[1],collider});
  }
  // Hull-side EVA gantry. Decks follow the same rectangles as collision. Rails
  // follow their union perimeter, so neither T-junction nor lookout has a bar
  // crossing a valid walking route.
  function catwalk(ax,az,bx,bz,width=1.8) {
    const length=Math.hypot(bx-ax,bz-az),alongX=ax!==bx;
    box((ax+bx)/2,-.18,(az+bz)/2,alongX?length:width,.28,alongX?width:length,dark);
    for(let d=.10;d<length;d+=.22) {
      const x=ax+(bx-ax)*d/length,z=az+(bz-az)*d/length;
      box(x,.005,z,alongX?.04:width-.12,.032,alongX?width-.12:.04,metal);
    }
    for(let d=.3;d+1.2<length;d+=1.2)for(const s of [-1,1]) {
      const x=ax+(bx-ax)*d/length+(alongX?0:s*width/2),z=az+(bz-az)*d/length+(alongX?s*width/2:0);
      kit.pipe([x,-.28,z],[x+(bx-ax)*1.2/length,-.88,z+(bz-az)*1.2/length],.044,dark);
    }
  }
  const outbound=EXTENSION_AREAS.find(a=>a.id==='eva-outbound'),spine=EXTENSION_AREAS.find(a=>a.id==='eva-spine'),lookout=EXTENSION_AREAS.find(a=>a.id==='eva-lookout');
  catwalk(outbound.x-outbound.w/2,outbound.z,outbound.x+outbound.w/2,outbound.z,outbound.d);
  catwalk(spine.x,spine.z+spine.d/2,spine.x,spine.z-spine.d/2,spine.w);
  box(lookout.x,-.12,lookout.z,lookout.w,.24,lookout.d,dark);
  const railKeys=new Set(),postKeys=new Set();
  for(const area of [outbound,spine,lookout]) {
    const minX=area.x-area.w/2,maxX=area.x+area.w/2,minZ=area.z-area.d/2,maxZ=area.z+area.d/2;
    for(const edge of [
      {horizontal:true,fixed:minZ,lo:minX,hi:maxX,nx:0,nz:-1},
      {horizontal:true,fixed:maxZ,lo:minX,hi:maxX,nx:0,nz:1},
      {horizontal:false,fixed:minX,lo:minZ,hi:maxZ,nx:-1,nz:0},
      {horizontal:false,fixed:maxX,lo:minZ,hi:maxZ,nx:1,nz:0},
    ]) {
      const cuts=[edge.lo,edge.hi];
      for(const other of EXTENSION_AREAS) {
        const lo=edge.horizontal?other.x-other.w/2:other.z-other.d/2,hi=edge.horizontal?other.x+other.w/2:other.z+other.d/2;
        if(lo>edge.lo&&lo<edge.hi)cuts.push(lo);
        if(hi>edge.lo&&hi<edge.hi)cuts.push(hi);
      }
      cuts.sort((a,b)=>a-b);
      for(let i=0;i<cuts.length-1;i++) {
        const lo=cuts[i],hi=cuts[i+1];if(hi-lo<.001)continue;
        const middle=(lo+hi)/2,x=(edge.horizontal?middle:edge.fixed)+edge.nx*.01,z=(edge.horizontal?edge.fixed:middle)+edge.nz*.01;
        if(EXTENSION_AREAS.some(other=>other!==area&&Math.abs(x-other.x)<other.w/2&&Math.abs(z-other.z)<other.d/2))continue;
        const a=edge.horizontal?[lo,edge.fixed]:[edge.fixed,lo],b=edge.horizontal?[hi,edge.fixed]:[edge.fixed,hi];
        const key=[...a,...b].map(v=>v.toFixed(3)).join(',');if(railKeys.has(key))continue;railKeys.add(key);
        kit.pipe([a[0],1.02,a[1]],[b[0],1.02,b[1]],.035,amber);
        kit.pipe([a[0],.20,a[1]],[b[0],.20,b[1]],.027,metal);
        const count=Math.max(1,Math.ceil((hi-lo)/1.2));
        for(let j=0;j<=count;j++) {
          const t=j/count,px=a[0]+(b[0]-a[0])*t,pz=a[1]+(b[1]-a[1])*t,postKey=`${px.toFixed(3)},${pz.toFixed(3)}`;
          if(postKeys.has(postKey))continue;postKeys.add(postKey);
          kit.pipe([px,-.25,pz],[px,1.02,pz],.033,metal);
        }
      }
    }
  }
  label('USS SENTIENT','EVA GANTRY / MAGNETIC BOOTS',16.92,1.55,-5,Math.PI/2,1.9);
  // External utility spars and deployable solar wings are recognisable at station scale.
  const solarMap=texture(512,512,g=>{
    g.fillStyle='#142c57';g.fillRect(0,0,512,512);
    for(let y=0;y<512;y+=32)for(let x=0;x<512;x+=64){g.fillStyle=(x+y)%96?'#213d69':'#2c4477';g.fillRect(x+2,y+2,59,27);g.fillStyle='#667d95';g.fillRect(x+4,y+14,55,1);}
  });solarMap.wrapS=solarMap.wrapT=THREE.RepeatWrapping;solarMap.repeat.set(3,5);
  const solar=mat({map:solarMap,color:0xa2b5df,metalness:.48,roughness:.48,emissive:0x3d5d8c,emissiveMap:solarMap,emissiveIntensity:.6,side:THREE.DoubleSide});
  for(const side of [-1,1]) {
    for(const y of [-.9,-1.65])kit.pipe([side*3,y,-16],[side*25,y,-16],.09,metal);
    for(let i=4;i<25;i+=1.5) {
      kit.pipe([side*i,-.9,-16],[side*(i+1.5),-1.65,-16],.045,metal);
      kit.pipe([side*i,-1.65,-16],[side*(i+1.5),-.9,-16],.045,metal);
    }
    for(const offset of [-5.6,5.6]) {
      const wing=addMesh(new THREE.BoxGeometry(7.8,.085,9.8),solar);wing.position.set(side*25,-.8,-16+offset);wing.rotation.z=side*.16;
      for(let x=21.2;x<29;x+=1.3)kit.pipe([side*x,-.62,-20.7+offset],[side*x,-.62,-11.3+offset],.028,metal);
    }
    for(let i=0;i<6;i++) {
      const x=side*(5+i*.54);box(x,3.8,-11,.42,.08,4.5,M.enamel);
      kit.pipe([x,3.75,-13.3],[x,2.9,-11],.032,metal);
    }
  }
  for(const m of ctx.MODULES) {
    // External ribs and thermal blankets stop the outboard view reading as loose interior rooms.
    for(const dz of [-m.hz*.53,m.hz*.53]) {
      kit.pipe([m.x-m.hx*.73,m.elevation+3.3,m.z+dz],[m.x+m.hx*.73,m.elevation+3.3,m.z+dz],.065,metal);
      for(const s of [-1,1])kit.pipe([m.x+s*m.hx*.73,m.elevation+3.3,m.z+dz],[m.x+s*m.hx,m.elevation+2.58,m.z+dz],.065,metal);
    }
    for(let i=0;i<3;i++)box(m.x-.48+i*.48,m.elevation+3.32,m.z,.40,.08,.94,metal);
  }
  const dish=addMesh(new THREE.SphereGeometry(.92,24,12,0,Math.PI*2,0,Math.PI/2),metal);
  dish.position.set(1.5,4.4,-11);dish.rotation.x=-.65;dish.material.side=THREE.DoubleSide;
  kit.pipe([1.5,3.2,-11],[1.5,4.4,-11],.10,dark);
  kit.pipe([1.5,4.4,-11],[1.5,5.45,-11.4],.027,M.silver);

  // Forum hatch: genuine cut-out floor, hinged lid, shaft rungs and two-way ladder.
  const h=CUPOLA.hatch;
  ring(.76,h.x,.045,h.z,M.silver,Math.PI/2,.085);
  ring(.64,h.x,-.08,h.z,M.graphite,Math.PI/2,.08);
  const lidPivot=new THREE.Group();lidPivot.position.set(h.x,.035,h.z-.70);root.add(lidPivot);
  const lid=addMesh(new THREE.CylinderGeometry(.66,.66,.08,40),M.enamel,lidPivot);lid.position.z=.70;
  kit.cuboid(0,.063,.70,.45,.045,.04,M.graphite,0,lidPivot);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;kit.cuboid(Math.cos(a)*.53,.06,.70+Math.sin(a)*.53,.07,.022,.04,M.silver,a,lidPivot);}
  const hatch={open:false,amount:0};
  const hatchDevice={id:'cupola-hatch',label:'OPEN HATCH · DESCEND TO CUPOLA',x:h.x,y:0,z:h.z,range:1.7,zone:'station',roomId:'forum',mesh:lid,action:'descend',activate:()=>{hatch.open=true;return 'Hatch open. Descending to the Nadir cupola.';}};devices.push(hatchDevice);
  label('05 ↓ NADIR CUPOLA','[ E ] OPEN HATCH / DESCEND',0,2.37,-24.33,0,1.1);
  const shaft=addMesh(new THREE.CylinderGeometry(.81,.81,1.64,32,1,true),shaftEnamel);shaft.position.set(h.x,-.93,h.z);
  for(const side of [-1,1])kit.pipe([h.x+side*.40,-4.65,h.z-.50],[h.x+side*.40,-.05,h.z-.50],.034,M.silver);
  for(let y=-4.5;y<0;y+=.30)kit.pipe([h.x-.4,y,h.z-.5],[h.x+.4,y,h.z-.5],.029,amber);
  const y=CUPOLA.elevation,cz=CUPOLA.z;
  const cupolaStats={arches:8,windowFasteners:0,serviceCovers:16,perches:2,consoles:1,displays:2,lights:0};
  const cupolaColliders=[];
  const upholstery=mat({color:0x849b96,roughness:.96,metalness:0});
  const instrumentGlow=mat({color:0x9fbeb6,emissive:0x79b8b4,emissiveIntensity:.7,roughness:.4});
  const point=(angle,radius,height)=>[Math.cos(angle)*radius,height,cz+Math.sin(angle)*radius];
  const facing=angle=>-angle-Math.PI/2;
  function cupolaPart(origin,yaw,x,height,z,w,h,d,material,rz=0) {
    const c=Math.cos(yaw),s=Math.sin(yaw);
    box(origin.x+x*c+z*s,height,origin.z-x*s+z*c,w,h,d,material,yaw,rz);
  }
  function hoop(radius,height,thickness,material,segments=64) {
    for(let i=0;i<segments;i++)kit.pipe(point(i*Math.PI*2/segments,radius,height),point((i+1)*Math.PI*2/segments,radius,height),thickness,material,8);
  }
  // The Forum underside caps the top of the vessel. Leave the real ladder
  // aperture open; a complete sphere would put glazing across the floor hatch.
  const capY=-.22,capAngle=Math.acos((capY+3.35)/3.48);
  const sphere=addMesh(new THREE.SphereGeometry(3.48,48,32,0,Math.PI*2,capAngle,Math.PI-capAngle),glazing);sphere.position.set(0,-3.35,cz);sphere.name='Nadir cupola panoramic spherical pressure glazing';
  ring(Math.sin(capAngle)*3.48,0,capY,cz,M.enamel,Math.PI/2,.065);
  // Tapered rectangular pressure arches have broad enamel faces, narrow edges,
  // and separate dark glazing seals. One merged mesh replaces the wire cage.
  const archVertices=[];
  const quad=(a,b,c,d)=>{for(const p of [a,c,b,a,d,c])archVertices.push(...p);};
  function archPoint(angle,polar,side,depth) {
    const halfWidth=.098+.065*Math.abs(Math.cos(polar)),radius=3.48+depth;
    return [Math.sin(polar)*radius*Math.cos(angle)-Math.sin(angle)*side*halfWidth,
      -3.35+Math.cos(polar)*radius,cz+Math.sin(polar)*radius*Math.sin(angle)+Math.cos(angle)*side*halfWidth];
  }
  for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4;
    for(let j=0;j<36;j++) {
      const p=capAngle+j*(Math.PI-capAngle)/36,q=capAngle+(j+1)*(Math.PI-capAngle)/36;
      const a=archPoint(angle,p,-1,-.11),b=archPoint(angle,p,1,-.11),c=archPoint(angle,q,1,-.11),d=archPoint(angle,q,-1,-.11);
      const e=archPoint(angle,p,-1,.04),f=archPoint(angle,p,1,.04),g=archPoint(angle,q,1,.04),k=archPoint(angle,q,-1,.04);
      quad(a,b,c,d);quad(f,e,k,g);quad(e,a,d,k);quad(b,f,g,c);
      for(const side of [-1,1])kit.pipe(archPoint(angle,p,side,-.032),archPoint(angle,q,side,-.032),.037,M.graphite,8);
    }
    // Glazing corners are clamped where each arch meets a pressure hoop.
    for(const height of [y+.22,y+2.30,-5.4]) {
      const radius=Math.sqrt(3.48**2-(height+3.35)**2)-.12,yaw=facing(angle);
      for(const side of [-1,1])for(const dy of [-.074,.074]) {
        const x=Math.cos(angle)*radius-Math.sin(angle)*side*.065,z=cz+Math.sin(angle)*radius+Math.cos(angle)*side*.065;
        kit.bolt(x,height+dy,z,yaw,M.silver,.025);cupolaStats.windowFasteners++;
      }
    }
  }
  const archGeometry=new THREE.BufferGeometry();archGeometry.setAttribute('position',new THREE.Float32BufferAttribute(archVertices,3));archGeometry.computeVertexNormals();
  const arches=addMesh(archGeometry,shaftEnamel);arches.name='Cupola / tapered pressure arches';
  for(const height of [-5.4,y+.22,y+2.30]) {
    const radius=Math.sqrt(3.48**2-(height+3.35)**2);
    hoop(radius-.023,height,.063,M.graphite);
    hoop(radius-.081,height,.033,M.silver);
  }
  // A circumferential service ring is fastened to the actual pressure shell.
  // Its covers, ducts and warm diffusers remain above the panoramic eye line.
  const serviceY=y+2.31,serviceR=Math.sqrt(3.48**2-(serviceY+3.35)**2)-.12;
  for(let i=0;i<48;i++) {
    const angle=(i+.5)*Math.PI/24,yaw=facing(angle),p=point(angle,serviceR,serviceY);
    box(...p,2*serviceR*Math.sin(Math.PI/48)+.012,.20,.21,M.enamel,yaw);
    const trim=point(angle,serviceR-.118,serviceY-.045);
    box(...trim,.34,.022,.02,M.graphite,yaw);
  }
  for(let i=0;i<16;i++) {
    const angle=(i+.5)*Math.PI/8,yaw=facing(angle),origin={x:Math.cos(angle)*serviceR,z:cz+Math.sin(angle)*serviceR};
    cupolaPart(origin,yaw,0,serviceY,.124,.49,.132,.029,i%2?M.padding:M.graphite);
    for(const dx of [-.208,.208]) {
      const p=kit.toWorld(origin,yaw,[dx,serviceY,.148]);kit.bolt(...p,yaw,M.silver,.017);
    }
    if(i%2===0)cupolaPart(origin,yaw,0,serviceY-.121,.087,.50,.022,.08,M.whiteLight);
    else for(let j=0;j<6;j++)cupolaPart(origin,yaw,-.15+j*.06,serviceY,.145,.020,.08,.01,M.silver);
  }
  const deck=addMesh(new THREE.CircleGeometry(2.76,64),glazing);deck.rotation.x=-Math.PI/2;deck.position.set(0,y,cz);
  ring(2.75,0,y-.02,cz,M.silver,Math.PI/2,.075);
  const centerDeck=addMesh(new THREE.CylinderGeometry(.9,.9,.12,40),M.graphite);centerDeck.position.set(0,y-.08,cz);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,dx=Math.cos(a),dz=Math.sin(a),yaw=facing(a),origin={x:dx*2.72,z:cz+dz*2.72};
    kit.pipe([dx*.85,y-.08,cz+dz*.85],[dx*2.75,y-.08,cz+dz*2.75],.045,M.graphite);
    kit.pipe([dx*2.75,y-.08,cz+dz*2.75],[dx*3.12,y-.08,cz+dz*3.12],.071,M.silver);
    cupolaPart(origin,yaw,0,y+.17,0,1.10,.25,.15,M.enamel);
    cupolaPart(origin,yaw,0,y+.18,.085,.89,.14,.020,M.padding);
    for(const side of [-1,1])cupolaPart(origin,yaw,side*.42,y+.18,.103,.032,.15,.025,M.graphite);
    cupolaPart(origin,yaw,0,y+.06,.085,.20,.018,.01,M.accent);
    for(const side of [-1,1]){
      const p=kit.toWorld(origin,yaw,[side*.50,y+.20,.086]);kit.bolt(...p,yaw,M.silver,.019);
    }
  }
  hoop(2.75,y+.315,.042,M.silver);
  for(const x of [-.75,.75])box(x,-1.77,cz,.32,.04,.32,M.whiteLight);
  // The ascent control is bolted to the ladder stringer, with a protected cable
  // and a short angled support, rather than hanging in the room.
  kit.pipe([.40,y+.20,cz-.50],[.65,y+.82,cz-.55],.032,M.silver);
  kit.pipe([.40,y+1.35,cz-.50],[.65,y+1.26,cz-.55],.023,M.silver);
  box(.65,y+1.05,cz-.60,.59,.47,.08,M.enamel);
  kit.pipe([.40,y+.25,cz-.49],[.40,y+1.43,cz-.49],.014,M.graphite);
  const up=button('cupola-ascent','CLIMB TO FORUM',.65,y+1.05,cz-.55,0,'cupola',()=>{hatch.open=true;return 'Climbing to the Forum. Hatch secured behind you.';});up.action='ascend';up.range=2.2;
  // A small asymmetric survey desk occupies one edge; the central glass deck
  // and the (1,-20.8) observation waypoint remain unobstructed.
  const desk={x:1.05,z:cz+2.00},deskYaw=Math.PI;
  cupolaPart(desk,deskYaw,0,y+.50,0,.70,.87,.34,M.graphite);
  cupolaPart(desk,deskYaw,0,y+.085,0,.86,.13,.41,M.enamel);
  cupolaPart(desk,deskYaw,0,y+.96,0,1.02,.11,.46,M.enamel);
  cupolaPart(desk,deskYaw,0,y+1.26,-.025,1.01,.55,.10,M.graphite);
  cupolaPart(desk,deskYaw,0,y+1.26,.034,.95,.48,.026,M.enamel);
  cupolaPart(desk,deskYaw,0,y+.62,.185,.59,.39,.025,M.padding);
  for(const side of [-1,1]) {
    cupolaPart(desk,deskYaw,side*.29,y+.62,.208,.036,.40,.025,M.graphite);
    cupolaPart(desk,deskYaw,side*.40,y+1.034,.125,.072,.022,.058,M.silver);
  }
  for(let row=0;row<2;row++)for(let column=0;column<6;column++)cupolaPart(desk,deskYaw,-.27+column*.108,y+1.031,.09+row*.10,.076,.016,.068,column===5?instrumentGlow:M.graphite);
  for(const side of [-1,1])kit.pipe([desk.x+side*.37,y+.1,desk.z],[desk.x+side*.37,y+.87,desk.z],.026,M.silver);
  cupolaColliders.push({id:'cupola-survey-console',x:desk.x,z:desk.z,w:1.04,d:.48});
  const scope=new THREE.Group();scope.position.set(1.77,y+1.17,cz+1.31);root.add(scope);
  kit.pipe([desk.x+.31,y+.82,desk.z-.03],[1.77,y+.82,cz+1.31],.045,M.silver);
  kit.pipe([1.77,y+.82,cz+1.31],[1.77,y+1.17,cz+1.31],.040,M.graphite);
  const scopeBody=addMesh(new THREE.CylinderGeometry(.13,.16,.48,12),M.enamel,scope);scopeBody.rotation.x=1.11;
  const scopeLens=addMesh(new THREE.CylinderGeometry(.112,.112,.025,16),instrumentGlow,scope);scopeLens.rotation.x=1.11;scopeLens.position.set(0,.108,.218);
  kit.cuboid(0,0,-.17,.18,.12,.19,M.graphite,0,scope);
  cupolaColliders.push({id:'cupola-scope-arm',x:1.73,z:cz+1.37,w:.27,d:.35});
  const pointers=[];
  for(let i=0;i<2;i++) {
    const origin={x:desk.x-.58,z:desk.z+.015},height=y+1.08+i*.25;
    cupolaPart(origin,Math.PI,0,height,0,.22,.215,.085,M.enamel);
    kit.pipe([origin.x,height,origin.z-.07],[origin.x,height,origin.z-.084],.084,M.graphite,16);
    const pointer=new THREE.Group();pointer.position.set(origin.x,height,origin.z-.10);root.add(pointer);
    kit.cuboid(0,.029,0,.012,.07,.013,i?amber:instrumentGlow,0,pointer);pointers.push(pointer);
  }
  // Peripheral observer perches have real brackets, foot restraints and harness
  // webbing. They leave the ladder and the large forward window bays open.
  for(const [index,zOffset] of [-.90,.90].entries()) {
    const origin={x:-2.06,z:cz+zOffset},yaw=Math.PI/2;
    cupolaPart(origin,yaw,0,y+.075,0,.42,.10,.43,M.graphite);
    cupolaPart(origin,yaw,0,y+.32,0,.12,.47,.15,M.silver);
    cupolaPart(origin,yaw,0,y+.54,.02,.48,.095,.42,M.enamel);
    cupolaPart(origin,yaw,0,y+.598,.04,.43,.057,.36,upholstery);
    cupolaPart(origin,yaw,0,y+.83,-.155,.48,.51,.09,M.enamel);
    cupolaPart(origin,yaw,0,y+.835,-.099,.40,.44,.045,upholstery);
    for(const side of [-1,1]) {
      cupolaPart(origin,yaw,side*.09,y+.84,-.065,.035,.39,.021,M.graphite,side*.18);
      cupolaPart(origin,yaw,side*.09,y+.624,.13,.13,.023,.031,M.graphite);
      const a=kit.toWorld(origin,yaw,[side*.17,y+.25,.15]),b=kit.toWorld(origin,yaw,[side*.17,y+.20,.38]);kit.pipe(a,b,.023,M.silver);
    }
    cupolaPart(origin,yaw,0,y+.64,.14,.067,.027,.043,M.silver);
    cupolaPart(origin,yaw,0,y+.21,.34,.40,.045,.10,M.graphite);
    cupolaColliders.push({id:`cupola-perch-${index+1}`,x:origin.x+.075,z:origin.z,w:.59,d:.52});
  }
  const surveyModes=[
    {name:'MINERAL SPECTRUM',color:'#cfff04',result:'Pelagia spectral survey: layered mineral deposits and glassy impact basins.',values:[.15,.28,.76,.31,.44,.92,.39,.21,.63,.41,.18,.32]},
    {name:'THERMAL FIELD',color:'#edb176',result:'Pelagia thermal survey: warm fracture networks crossing a cooler crystalline crust.',values:[.22,.27,.31,.58,.89,.75,.41,.36,.62,.81,.47,.30]},
    {name:'ATMOSPHERIC HAZE',color:'#a7b8e8',result:'Pelagia limb survey: suspended mineral haze and broad upper-atmosphere bands.',values:[.81,.74,.66,.58,.54,.41,.37,.31,.25,.23,.19,.16]},
  ];
  let surveyMode=0,surveyCount=0,surveyRevision=0;
  function paintSurvey(g,w,h) {
    const state=surveyModes[surveyMode];g.fillStyle='#081a20';g.fillRect(0,0,w,h);
    g.fillStyle='#90aaa8';g.font='500 22px Space, Arial';g.fillText('PELAGIA / NADIR OBSERVATORY',28,36);
    g.fillStyle=state.color;g.font='500 33px Space, Arial';g.fillText(state.name,28,84,w-56);
    g.strokeStyle='#2a4850';g.lineWidth=1;
    for(let row=0;row<4;row++){g.beginPath();g.moveTo(28,121+row*44);g.lineTo(w-28,121+row*44);g.stroke();}
    state.values.forEach((value,i)=>{g.fillStyle=i%3?state.color:'#e4e8d5';g.fillRect(32+i*57,287-value*167,34,value*167);});
    g.fillStyle='#bbd0c5';g.font='20px Space, Arial';g.fillText(`LOCAL RECORD ${String(surveyCount).padStart(3,'0')}  /  INSTRUMENT ${surveyMode+1} OF 3`,28,327);
    g.fillStyle='#223c3e';g.fillRect(25,346,w-50,57);g.fillStyle=state.color;g.font='500 27px Space, Arial';g.fillText('E / CLICK  →  NEXT SURVEY CHANNEL',40,384,w-80);
  }
  const surveyMap=texture(768,432,paintSurvey);surveyMap.userData.emissiveDisplay=true;
  const surveyScreen=textPlane(surveyMap,.89,.50,desk.x,y+1.275,desk.z-.065,Math.PI);
  surveyScreen.name='Cupola / mineral survey console';
  const survey={id:'cupola-survey',label:'CYCLE PLANET SURVEY',x:surveyScreen.position.x,y:surveyScreen.position.y,z:surveyScreen.position.z,zone:'cupola',range:1.85,mesh:surveyScreen,
    activate:()=>{
      surveyMode=(surveyMode+1)%surveyModes.length;surveyCount++;surveyRevision++;
      paintSurvey(surveyMap.image.getContext('2d'),768,432);surveyMap.needsUpdate=true;
      instrumentGlow.color.set(surveyModes[surveyMode].color);instrumentGlow.emissive.copy(instrumentGlow.color);
      return surveyModes[surveyMode].result;
    },
    state:()=>({mode:surveyModes[surveyMode].name,channel:surveyMode+1,count:surveyCount,canvasState:surveyMode,canvasRevision:surveyRevision,heading:scope.rotation.y}),
  };devices.push(survey);
  function updateSurvey(dt) {
    const blend=1-Math.exp(-Math.max(0,dt)*4),heading=[.24,.81,-.36][surveyMode];
    scope.rotation.y+=(heading-scope.rotation.y)*blend;
    pointers.forEach((pointer,i)=>{const target=[[-.7,.8],[.5,-.4],[-1.1,-.2]][surveyMode][i];pointer.rotation.z+=(target-pointer.rotation.z)*blend;});
  }
  const badge=label('PELAGIA','MINERAL WORLD / SPECTRAL SURVEY',0,serviceY,cz+serviceR-.15,Math.PI,1.55);
  badge.name='Cupola / mounted observation fascia';
  paintPressure();
  return {devices,colliders,cupolaColliders,doors:airDoors,stats:{decks:2,airlock:true,exteriorWalkwayMetres:43.7,solarWings:4,cupolaGlazingRadius:3.48,cupola:cupolaStats},
    hatch,airlock,
    getState:()=>({airlock:{...airlock},hatch:{...hatch},surveys:surveyCount,doors:airDoors.map(d=>({id:d.id,x:d.x,z:d.z,openness:d.openness}))}),
    update(time,dt,player) {
      updateSurvey(dt);
      hatch.amount=THREE.MathUtils.damp(hatch.amount,hatch.open?1:0,5,dt);lidPivot.rotation.x=-hatch.amount*Math.PI*.52;
      if(airlock.mode.startsWith('cycling')) {
        // Do not close a hatch on a player crossing its sill.
        const onSill=airDoors.some(d=>Math.abs(player.x-d.x)<.52&&Math.abs(player.z)<1.15);
        if(!onSill)airlock.phase+=dt;
        const out=airlock.mode==='cycling-out';
        const progress=THREE.MathUtils.clamp((airlock.phase-.9)/3,0,1);
        airlock.pressure=101.3*(out?1-progress:progress);
        if(airlock.phase>4.1)airlock.mode=out?'vacuum':'pressurized';
      }
      const inner=airlock.mode==='pressurized'?1:0,outer=airlock.mode==='vacuum'?1:0;
      for(const [i,d]of airDoors.entries()) {
        let target=i?outer:inner;
        if(Math.abs(player.x-d.x)<.52&&Math.abs(player.z)<1.15)target=Math.max(target,d.openness);
        d.openness=THREE.MathUtils.damp(d.openness,target,6,dt);
        d.left.position.x=-d.openness*1.05;d.right.position.x=d.openness*1.05;d.collider.disabled=d.openness>.87;
      }
      airlock.inner=airDoors[0].openness;airlock.outer=airDoors[1].openness;paintPressure();
    },
  };
}
