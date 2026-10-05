import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { MODULES, LINKS, moduleFacet, facetInset } from './layout.js';

/** Local practical lamps, a hull-masked star, and a bounded shadow budget. */
export function createStationLighting(root) {
  RectAreaLightUniformsLib.init();
  const practicalSources = [], practicals = [], assignments = new Map();
  const spillSources = [], spillLights = [];
  let quality = 'balanced', active = [], lastSelection = -Infinity, time = 0, lastLabRefresh = 0;
  const lastPosition = new THREE.Vector2(Infinity,Infinity);
  const bounce = new THREE.HemisphereLight(0xd1deec, 0x34382c, .24);
  bounce.name = 'Low indirect cabin bounce'; root.add(bounce);

  function spot(name, color, intensity, source, aim, reach, angle = 1.10) {
    practicalSources.push({name,color:new THREE.Color(color),intensity,position:new THREE.Vector3(...source),
      aim:new THREE.Vector3(...aim),reach,angle});
  }
  for (const m of MODULES) {
    const lampPosition=index=>{
      const edge=moduleFacet(m,index),{a,b}=edge,ry=-Math.atan2(b.z-a.z,b.x-a.x),inset=facetInset(m,edge);
      return [(a.x+b.x)/2+Math.sin(ry)*inset,m.elevation+2.73,(a.z+b.z)/2+Math.cos(ry)*inset];
    };
    const color = m.id === 'lab' || m.id === 'archive' ? 0xe2ecff : m.id === 'commons' ? 0xffe5c2 : 0xffecd6;
    const power = {bridge:64,lab:38,archive:32,commons:36,floor:40,forum:36,'front-door':34}[m.id];
    spot(`${m.id} / west ceiling practical`, color, power,
      lampPosition(6), [m.x+.4,m.elevation+.45,m.z-.35], Math.max(7,m.hx*2));
    spot(`${m.id} / north ceiling practical`, 0xdceaff, power*.48,
      lampPosition(0), [m.x-.2,m.elevation+.30,m.z+.5], Math.max(7,m.hz*2));
    // A display is a luminous rectangle: light leaves its face, so it cannot
    // reflect a fictitious point bulb back into the display itself.
    const normal = {x:Math.sin(m.terminalYaw),z:Math.cos(m.terminalYaw)};
    const face = new THREE.Object3D();
    face.position.set(m.terminal.x+normal.x*.235,m.elevation+1.48,m.terminal.z+normal.z*.235);
    // Lights face their local -Z axis, unlike a plain Object3D's lookAt().
    face.lookAt(face.position.x-normal.x,face.position.y,face.position.z-normal.z);
    spillSources.push({name:`${m.id} / instrument spill`,position:face.position,quaternion:face.quaternion});
  }
  // Keep the shader's area-light count fixed while following the player. The
  // distant instrument panels remain emissive without evaluating seven LTCs
  // for every cabin pixel. Reassigning a slot changes only light uniforms.
  for (let i=0;i<2;i++) {
    const glow = new THREE.RectAreaLight(0xbddc80,1.35,.75,.55);
    const source = spillSources[i];
    glow.name=source.name; glow.position.copy(source.position); glow.quaternion.copy(source.quaternion);
    glow.userData.source=source; root.add(glow); spillLights.push(glow);
  }
  for (const link of LINKS) {
    const length = Math.hypot(link.b.x-link.a.x,link.b.z-link.a.z);
    // Match the middle real luminaire in tube(), including the corridor incline.
    const offsets = [];
    for (let offset=-length*.5+.35;offset<length*.5;offset+=1.25) offsets.push(offset+.33);
    const offset = offsets.reduce((best,value)=>Math.abs(value)<Math.abs(best)?value:best);
    const x = (link.a.x+link.b.x)/2 + (link.a.x===link.b.x?0:offset);
    const z = (link.a.z+link.b.z)/2 + (link.a.x===link.b.x?offset:0);
    const t = ((x-link.a.x)*(link.b.x-link.a.x)+(z-link.a.z)*(link.b.z-link.a.z))/(length*length);
    const floor = link.elevationA+(link.elevationB-link.elevationA)*t;
    spot(`${link.id} / transit luminaire`, 0xe2edff, 19,
      [x,floor+2.42,z], [x,floor,z], Math.max(5,length), 1.12);
  }
  spot('airlock / ceiling practical',0xdceaff,32,[6.5,2.57,0],[6.5,.5,0],7);
  spot('airlock / transfer tunnel',0xdceaff,16,[3.5,2.5,0],[3.5,0,0],4);
  spot('cupola / nadir ceiling practical',0xdaeaff,32,[-.75,-1.8,-22],[0,-4.5,-22],7);
  spot('cupola / instrument fill',0xd5efc5,16,[.75,-1.8,-22],[1,-4.2,-20],6);
  // These are fixture positions, not additional GPU lights. The same six-light
  // pool follows the player into the larger occupied bays.
  spot('forum / conference pendant',0xffe8cc,44,[5.533,2.67,-17.317],[5.533,.7,-17.317],6,1.22);
  spot('commons / sanitation luminaire',0xdceaff,25,[12.55,3.20,-16.65],[12.55,1.1,-16.65],4.2,1.15);
  spot('floor / machinery luminaire',0xffe4c9,28,[-10.40,1.69,-6.25],[-10.20,-.4,-6.25],5.3,1.18);
  function assignPractical(light, source) {
    if (assignments.get(light)===source) return;
    light.name=source.name; light.color.copy(source.color); light.intensity=source.intensity;
    light.position.copy(source.position); light.target.position.copy(source.aim);
    light.distance=source.reach; light.angle=source.angle;
    light.shadow.needsUpdate=true; assignments.set(light,source);
  }
  // Six persistent lamps cover the cabin and connecting hatches. Pool slots
  // retain their shadow role, avoiding new shader variants as the player walks.
  for (let i=0;i<6;i++) {
    const light=new THREE.SpotLight(0xffffff,0,7,1.10,.83,2);
    light.shadow.camera.near=.30; light.shadow.mapSize.set(1024,1024);
    light.shadow.bias=-.0005; light.shadow.normalBias=.045;
    light.shadow.radius=2.5; light.shadow.autoUpdate=false;
    assignPractical(light,practicalSources[i]); root.add(light,light.target); practicals.push(light);
  }
  function assignGroup(lights, sources) {
    const available=sources.filter(source=>!lights.some(light=>assignments.get(light)===source));
    for (const light of lights) if (!sources.includes(assignments.get(light))) assignPractical(light,available.shift());
  }

  // Parallel light arrives from the visible star. Fit the entire pressure hull:
  // geometry outside a directional shadow camera would otherwise leak sunlight.
  const sun = new THREE.DirectionalLight(0xe4f5ac, 2.5);
  sun.name = 'Sol Sentient / shadowed window light';
  const direction = new THREE.Vector3(-1,6,-68).normalize();
  sun.target.position.set(0,1.4,-18);
  sun.position.copy(sun.target.position).addScaledVector(direction,80);
  sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
  sun.shadow.bias = -.00006; sun.shadow.normalBias = .018; sun.shadow.radius = 3;
  sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
  root.add(sun,sun.target); root.updateMatrixWorld(true); sun.shadow.updateMatrices(sun);
  const bounds = new THREE.Box3();
  for (const x of [-30,30]) for (const y of [-7,6]) for (const z of [-44,6]) {
    bounds.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(sun.shadow.camera.matrixWorldInverse));
  }
  Object.assign(sun.shadow.camera,{left:bounds.min.x-.4,right:bounds.max.x+.4,bottom:bounds.min.y-.4,top:bounds.max.y+.4,near:Math.max(.1,-bounds.max.z-1),far:-bounds.min.z+1});
  sun.shadow.camera.updateProjectionMatrix(); sun.shadow.updateMatrices(sun);

  function releaseMap(light) {
    light.shadow.map?.dispose(); light.shadow.map = null;
    light.shadow.mapPass?.dispose(); light.shadow.mapPass = null;
  }
  function setQuality(value) {
    quality = value;
    for (const light of [...practicals,sun]) {
      releaseMap(light); light.castShadow = false;
      light.shadow.mapSize.setScalar(light===sun ? (quality==='high'?4096:2048) : (quality==='high'?2048:1024));
      light.shadow.needsUpdate = true;
    }
    active = []; lastSelection = -Infinity;
    // Never turn an unoccluded directional lamp on inside a sealed hull.
    sun.intensity = quality==='performance' ? 0 : 2.5;
    sun.castShadow = quality!=='performance';
    bounce.intensity = quality==='performance' ? .26 : .24;
  }
  function update(player, dt, movingHatch) {
    time += dt;
    if (quality==='performance') sun.intensity=player.zone==='exterior'||player.layer==='cupola'?1.7:0;
    if (time-lastSelection>.20 || Math.hypot(player.x-lastPosition.x,player.z-lastPosition.y)>1) {
      lastSelection = time;
      lastPosition.set(player.x,player.z);
      const closestSpills = [...spillSources].sort((a,b)=>
        Math.hypot(a.position.x-player.x,a.position.z-player.z)-Math.hypot(b.position.x-player.x,b.position.z-player.z)).slice(0,spillLights.length);
      // Preserve the slot of a source that is still nearby when its rank swaps.
      const available = closestSpills.filter(source=>!spillLights.some(light=>light.userData.source===source));
      for (const glow of spillLights) if (!closestSpills.includes(glow.userData.source)) {
        const source=available.shift();
        glow.name=source.name; glow.position.copy(source.position); glow.quaternion.copy(source.quaternion); glow.userData.source=source;
      }
      const budget = quality==='high'?3:quality==='performance'?0:2;
      const distance=source=>Math.hypot(source.position.x-player.x,source.position.y-(player.y??1.6),source.position.z-player.z)+(player.layer==='cupola'&&!source.name.startsWith('cupola')?30:player.layer!=='cupola'&&source.name.startsWith('cupola')?30:0);
      const previousShadowSources=active.map(light=>assignments.get(light));
      const shadowScore=source=>distance(source)*(previousShadowSources.includes(source)?.85:1);
      const shadowSources=[...practicalSources].sort((a,b)=>shadowScore(a)-shadowScore(b)).slice(0,budget);
      const otherSources=practicalSources.filter(source=>!shadowSources.includes(source))
        .sort((a,b)=>distance(a)-distance(b)).slice(0,practicals.length-budget);
      assignGroup(practicals.slice(0,budget),shadowSources);
      assignGroup(practicals.slice(budget),otherSources);
      for (let i=0;i<practicals.length;i++) {
        const light=practicals[i], castShadow=i<budget;
        if (light.castShadow!==castShadow) {
          light.castShadow=castShadow; light.shadow.needsUpdate=true;
          if (!castShadow) releaseMap(light);
        }
      }
      active=practicals.slice(0,budget);
    }
    if (movingHatch) for (const light of [...active,sun]) if (light.castShadow) light.shadow.needsUpdate=true;
    // The laboratory's slow sample animation also changes its projected shadow.
    if (time-lastLabRefresh>.12 && active.some(light=>light.name.startsWith('lab /'))) {
      for (const light of active) if (light.name.startsWith('lab /')) light.shadow.needsUpdate=true;
      lastLabRefresh=time;
    }
  }
  function stats() {
    const shadowLights = [...active,sun].filter(light=>light.castShadow);
    return {practicals:practicalSources.length,activePracticals:practicals.length,practicalSources:practicals.map(light=>light.name),
      screenSpills:spillSources.length,activeScreenSpills:spillLights.length,
      screenSpillSources:spillLights.map(light=>light.name),shadowLights:shadowLights.length,
      shadowMaps:shadowLights.filter(light=>light.shadow.map).length,
      activeSources:shadowLights.map(light=>light.name),starIntensity:sun.intensity,shadowBudget:quality==='high'?4:quality==='performance'?0:3};
  }
  return {setQuality,update,stats,dispose:()=>[...practicals,sun].forEach(releaseMap)};
}
