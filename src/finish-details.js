import * as THREE from 'three';
import { modulePolygon } from './layout.js';

// Final close-range pass: hardware that still holds up beside a hatch or window.
export function addFinishDetails(ctx) {
  const { doors, MODULES, kit, texture, mat, addMesh, textPlane, beginModule, endSection, materials: M } = ctx;
  const panelMap = texture(512,1024,(g,w,h) => {
    g.fillStyle='#dedfd5';g.fillRect(0,0,w,h);
    const gradient=g.createLinearGradient(0,0,w,0);gradient.addColorStop(0,'#8b938977');gradient.addColorStop(.045,'#ffffff00');gradient.addColorStop(.93,'#ffffff00');gradient.addColorStop(1,'#67726a55');g.fillStyle=gradient;g.fillRect(0,0,w,h);
    for(const inset of [20,37]){g.strokeStyle=inset===20?'#7a8479':'#f2f2e8';g.lineWidth=3;g.beginPath();g.moveTo(inset+40,inset);g.lineTo(w-inset,inset);g.lineTo(w-inset,h-inset-40);g.lineTo(w-inset-40,h-inset);g.lineTo(inset,h-inset);g.lineTo(inset,inset+40);g.closePath();g.stroke();}
    g.fillStyle='#374342';g.fillRect(58,75,w-116,94);g.fillStyle='#e3ead6';g.font='500 24px Space';g.fillText('PRESSURE SEAL',77,112);g.font='400 16px Space';g.fillText('CHECK LATCH / AUTO CYCLE',77,145);
    g.strokeStyle='#858e81';g.lineWidth=3;for(let i=0;i<7;i++){g.beginPath();g.moveTo(71,240+i*25);g.lineTo(198,240+i*25);g.stroke();}
    g.fillStyle='#8a9484';g.font='400 18px Space';g.fillText('INTERNAL ACTUATOR',70,480);g.font='400 12px Space';g.fillText('SNT / H-014 / CLASS II',70,509);
    for(let y=560;y<725;y+=39){g.strokeStyle='#a3ab9d';g.strokeRect(69,y,370,26);g.fillStyle='#556252';g.fillRect(77,y+7,13,12);}
    g.fillStyle='#becb42';g.fillRect(61,830,390,40);g.fillStyle='#343c24';g.font='500 20px Space';g.fillText('KEEP APERTURE CLEAR',81,858);
    g.fillStyle='#465247';for(let i=0;i<48;i++)g.fillRect(70+i*5.8,925,1+(i%3),40-(i%4)*3);
    // Sparse rubbed edges and fastener marks, rather than uniform noise.
    g.strokeStyle='#666e6138';g.lineWidth=1;for(let i=0;i<70;i++){const x=48+(i*197)%418,y=40+(i*113)%939;g.beginPath();g.moveTo(x,y);g.lineTo(x+3+i%11,y-1);g.stroke();}
  });
  const panelMaterial=mat({map:panelMap,color:0xffffff,metalness:.28,roughness:.47});
  for(const door of doors) {
    for(const [index,leaf] of [door.left,door.right].entries()) {
      const side=index===0?1:-1, x=-.455*side;
      // The original raised inserts remain physical; each now carries a surface finish.
      for(const child of leaf.children) if(child.isMesh && Math.abs(child.scale.x-.54)<.001) child.material=panelMaterial;
      for(const face of [-1,1]) for(const sx of [-1,1]) for(const y of [.69,1.87]) kit.bolt(x+sx*.22,y,face*.10,face===1?0:Math.PI,M.silver,.018,leaf);
      for(const face of [-1,1]) {
        kit.cuboid(-.105*side,1.12,face*.112,.07,.41,.045,M.seal,0,leaf);
        kit.pipe([-.105*side,.995,face*.147],[-.105*side,1.24,face*.147],.022,M.silver,10,leaf);
      }
    }
    const group=door.left.parent;
    for(const face of [-1,1]) for(const side of [-1,1]) {
      for(const y of [.46,.88,1.76,2.06]) kit.bolt(side*1.055,y,face*.155,face===1?0:Math.PI,M.silver,.024,group);
      kit.cuboid(side*1.025,1.32,face*.18,.13,.24,.075,M.graphite,0,group);
      kit.cuboid(side*1.025,1.38,face*.227,.055,.023,.011,M.accent,0,group);
      kit.cuboid(side*.82,2.33,face*.18,.23,.095,.07,M.silver,0,group);
    }
  }

  const bridge=MODULES.find(m=>m.id==='bridge');beginModule(bridge);
  const points=modulePolygon(bridge);
  for(const index of [0,1,7]) {
    const a=points[index],b=points[(index+1)%8],ry=-Math.atan2(b.z-a.z,b.x-a.x);
    const origin={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
    const titles={0:'STELLAR TELEMETRY',1:'ORBITAL SOLUTION',7:'DEEP FIELD ARRAY'};
    const display=texture(1024,256,(g,w,h)=>{
      g.fillStyle='#07171c';g.fillRect(0,0,w,h);g.strokeStyle='#3d5956';g.lineWidth=1;
      for(let x=28;x<w;x+=42){g.beginPath();g.moveTo(x,65);g.lineTo(x,220);g.stroke();}
      for(let y=70;y<225;y+=32){g.beginPath();g.moveTo(25,y);g.lineTo(w-25,y);g.stroke();}
      g.fillStyle='#cfff04';g.font='500 24px Space';g.fillText(titles[index],27,39);g.font='400 14px Space';g.fillStyle='#b7cec9';g.fillText('USS SENTIENT / OBSERVATION DECK 07',590,38);
      g.strokeStyle='#b6d547';g.lineWidth=3;g.beginPath();for(let i=0;i<180;i++){const x=30+i*3.8,y=145+Math.sin(i*.12+index)*25+Math.sin(i*.81)*9;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();
      g.font='400 19px Space';g.fillStyle='#dce8d5';g.fillText(index===0?'SOL / SENTIENT':index===1?'STABLE ORBIT':'ARRAY SYNC',756,91);g.fillStyle='#cfff04';g.font='500 35px Space';g.fillText(index===0?'98.7%':index===1?'071.4°':'LOCKED',756,141);g.font='400 13px Space';g.fillStyle='#819f96';g.fillText('LOCAL INSTRUMENT / NOMINAL',755,181);
    });
    display.userData.emissiveDisplay = true;
    const center=kit.toWorld(origin,ry,[0,.84,.51]);
    kit.cuboid(center[0],center[1],center[2],index===0?2.75:1.50,.13,.35,M.graphite,ry);
    const screen=textPlane(display,index===0?2.6:1.35,index===0?.45:.30,center[0],.95,center[2],ry);
    screen.rotateX(-.58);
    for(const side of [-1,1]) {
      const p=kit.toWorld(origin,ry,[side*(index===0?1.42:.80),.92,.50]);
      kit.pipe([p[0],.84,p[2]],[p[0],.91,p[2]],.08,M.silver,12);
      kit.pipe([p[0],.91,p[2]],[p[0],.94,p[2]],.052,M.seal,12);
    }
  }
  endSection();
}
