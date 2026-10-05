import * as THREE from 'three';
import { corridorWindows } from './corridor-layout.js';

/** Small pressure-rated observation ports, looking into the actual exterior. */
export function addCorridorWindows(ctx) {
  const { LINKS, kit, addMesh, roundedFrame, texture, textPlane, materials:M }=ctx;
  const devices=[], windows=[], stats={windows:0,shutters:0,parts:0,lights:0};
  for (const link of LINKS) for (const spec of corridorWindows(link)) {
    const parent=ctx.beginLink(link), ry=link.a.x===link.b.x?0:Math.PI/2;
    const origin={x:(link.a.x+link.b.x)/2,z:(link.a.z+link.b.z)/2};
    const point=kit.toWorld(origin,ry,[spec.side*link.width/2,0,spec.at]);
    const mount=new THREE.Group(); mount.position.set(...point);mount.rotation.y=ry-spec.side*Math.PI/2;parent.add(mount);
    const part=(parent,x,y,z,w,h,d,material)=>{kit.cuboid(x,y,z,w,h,d,material,0,parent);stats.parts++;};
    const cy=spec.centerY,w=spec.width,h=spec.height;
    for (const [width,height,border,radius,depth,z,material] of [
      [w+.25,h+.25,.11,.22,.12,.025,M.seal],
      [w+.39,h+.39,.08,.27,.075,.085,M.enamel],
      [w+.13,h+.13,.04,.19,.055,.106,M.silver],
    ]) {
      const ring=roundedFrame(width,height,border,radius,depth,material,mount);
      ring.position.set(0,cy-height/2,z); stats.parts++;
    }
    const pane=addMesh(new THREE.PlaneGeometry(w+.01,h+.01),M.viewportGlass,mount);
    pane.position.set(0,cy,-.015);pane.castShadow=false;pane.userData.excludeFromAO=true;
    pane.name=`Clear exterior viewport ${link.id}`;
    for (const side of [-1,1]) {
      kit.pipe([side*(w/2+.135),cy-.20,.16],[side*(w/2+.135),cy+.20,.16],.016,M.silver,10,mount);
      for (const yy of [-.25,.25]) part(mount,side*(w/2+.135),cy+yy,.106,.056,.055,.08,M.graphite);
      for (const yy of [-1,1]) kit.bolt(side*(w/2+.074),cy+yy*(h/2+.074),.165,0,M.silver,.016,mount);
    }
    // Two rigid leaves retract sideways into pockets within the hull wall.
    const leaves=[-1,1].map(side=>{
      const leaf=new THREE.Group();mount.add(leaf);
      part(leaf,side*w/4,cy,-.075,w/2+.012,h+.012,.045,M.enamel);
      part(leaf,side*w/4,cy,-.047,w/2-.055,h-.065,.018,M.graphite);
      for(let row=0;row<7;row++)part(leaf,side*w/4,cy-.33+row*.11,-.033,w/2-.076,.018,.009,M.silver);
      part(leaf,side*.025,cy,-.018,.022,h-.09,.028,M.seal);
      return leaf;
    });
    let target=1, openness=1, activations=0;
    const map=texture(512,160,g=>draw(g));
    function draw(g) {
      g.fillStyle='#152329';g.fillRect(0,0,512,160);
      g.fillStyle=target?'#cfff04':'#e8b67b';g.fillRect(15,15,7,130);
      g.font='500 30px Space, Arial';g.fillStyle='#edf0e4';g.fillText('VIEWPORT / '+(target?'OPEN':'SEALED'),40,55);
      g.font='400 22px Space, Arial';g.fillStyle='#adbfba';g.fillText(target?'PRESS TO CLOSE SHUTTER':'PRESS TO OPEN SHUTTER',40,96);
      g.font='400 15px Space, Arial';g.fillText('PRESSURE GLASS · IMPACT GUARD · MANUAL OVERRIDE',40,132,448);
    }
    map.userData.emissiveDisplay=true;
    part(mount,0,.875,.08,.55,.19,.09,M.graphite);
    const button=textPlane(map,.49,.153,0,.875,.132,0,mount);
    const id=`viewport-${link.id}`;button.userData.interactiveDeviceId=id;
    parent.updateWorldMatrix(true,true);
    const center=button.getWorldPosition(new THREE.Vector3());
    const device={id,label:'Open / close observation shutter',zone:'station',x:center.x,y:center.y,z:center.z,range:1.65,mesh:button,
      state:()=>({open:!!target,openness,activations}),activate(){target=target?0:1;activations++;draw(map.image.getContext('2d'));map.needsUpdate=true;return target?'Protective shutter opening. Pressure glass remains sealed.':'Protective shutter closing.';}};
    devices.push(device);
    const aim=new THREE.Vector3(0,cy,0);mount.localToWorld(aim);
    const inward=new THREE.Vector3(0,0,1).transformDirection(mount.matrixWorld);
    const view={link:link.id,x:aim.x,y:aim.y,z:aim.z,nx:inward.x,nz:inward.z};
    windows.push({view,update(dt){const before=openness;openness=THREE.MathUtils.damp(openness,target,7,dt);leaves.forEach((leaf,i)=>leaf.position.x=(i?1:-1)*openness*(w/2+.075));return Math.abs(before-openness)>.0001;}});
    windows.at(-1).update(0);
    stats.windows++;stats.shutters++;ctx.endSection();
  }
  return {stats,devices,views:windows.map(w=>w.view),
    checkSightlines(root) {
      root.updateWorldMatrix(true,true);
      const solids=[];root.traverse(object=>{if(object.isMesh)solids.push(object);});
      return windows.map(({view})=>{
        const origin=new THREE.Vector3(view.x+view.nx*.32,view.y,view.z+view.nz*.32);
        const ray=new THREE.Raycaster(origin,new THREE.Vector3(-view.nx,0,-view.nz),0,.62);
        const hits=ray.intersectObjects(solids,false).filter(hit=>{
          const list=Array.isArray(hit.object.material)?hit.object.material:[hit.object.material];
          return list.some(material=>!material.transparent||material.opacity>=.5);
        });
        return {link:view.link,blocked:hits.length>0,nearest:hits[0]?.distance};
      });
    },
    update(time,dt){let moving=false;for(const window of windows)moving=window.update(dt)||moving;return moving;}};
}
