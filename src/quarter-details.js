import * as THREE from 'three';
import { moduleFacet } from './layout.js';

/** Department-specific spacecraft equipment, authored around the central aisles. */
export function addQuarterDetails(ctx) {
  const { MODULES, materials: M, kit, box, localBox, mat, texture, textPlane, colliders } = ctx;
  const stats = { parts: 0, displays: 0, seats: 0, robotArms: 0, lockers: 0, racks: 0, floorColliders: 0 };
  const fabric = mat({ color: 0x88928b, roughness: .96, metalness: 0 });
  const ochre = mat({ color: 0xbd9b55, roughness: .61, metalness: .12 });
  const visor = mat({ color: 0x23343d, roughness: .18, metalness: .64 });
  const B = (...args) => { stats.parts++; box(...args); };
  const L = (f, ...args) => { stats.parts++; localBox(f.origin, f.ry, ...args); };
  const P = (...args) => { stats.parts++; kit.pipe(...args); };
  const LP = (f, ...args) => { stats.parts++; kit.localPipe(f.origin, f.ry, ...args); };
  const point = (f, x, y, z) => kit.toWorld(f.origin, f.ry, [x, y, z]);
  function facet(m, index) {
    const { a, b } = moduleFacet(m, index);
    return { origin: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, ry: -Math.atan2(b.z - a.z, b.x - a.x) };
  }
  function frame(m, x, z, ry = 0) { return { origin: { x: m.x + x, z: m.z + z }, ry }; }
  function blocker(m, name, x, z, w, d) {
    colliders.push({ id: `quarter-${m.id}-${name}`, x: m.x + x, z: m.z + z, w, d });
    stats.floorColliders++;
  }
  function localBlocker(m, f, name, x, z, w, d) {
    const p = point(f, x, 0, z), c = Math.abs(Math.cos(f.ry)), s = Math.abs(Math.sin(f.ry));
    blocker(m, name, p[0] - m.x, p[2] - m.z, w * c + d * s, w * s + d * c);
  }
  function placard(f, title, subtitle, x, y, z, width = .48) {
    const map = texture(512, 128, (g, w, h) => {
      g.fillStyle = '#c9cec2'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#263338'; g.fillRect(0, 0, 12, h);
      g.font = '500 36px Space, Arial'; g.fillText(title, 26, 52, w - 48);
      g.fillStyle = '#56605b'; g.font = '400 21px Space, Arial'; g.fillText(subtitle, 27, 95, w - 49);
    });
    return textPlane(map, width, width / 4, ...point(f, x, y, z), f.ry);
  }
  function fasteners(f, x, y, z, width, height) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const p = point(f, x + sx * width / 2, y + sy * height / 2, z);
      kit.bolt(...p, f.ry, M.silver, .015); stats.parts++;
    }
  }

  function forum(m) {
    const f = facet(m, 5);
    // A workstation mounts in front of the existing service cabinet. Both
    // neighboring pressure-hatch approach lines remain unobstructed.
    L(f, 0, 1.67, .355, 1.61, 1.01, .09, M.graphite);
    L(f, 0, 1.67, .408, 1.51, .91, .028, M.seal);
    const map = texture(1200, 720, (g, w, h) => {
      g.fillStyle = '#08191c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#274747'; g.lineWidth = 1;
      for (let x = 40; x < w; x += 48) { g.beginPath(); g.moveTo(x, 100); g.lineTo(x, h - 50); g.stroke(); }
      for (let y = 110; y < h - 20; y += 48) { g.beginPath(); g.moveTo(35, y); g.lineTo(w - 35, y); g.stroke(); }
      g.font = '500 42px Space, Arial'; g.fillStyle = '#e4e8d8'; g.fillText('THE FORUM / STRATEGY', 40, 66);
      g.font = '400 24px Space, Arial'; g.fillStyle = '#99bdb7'; g.fillText('SHARED MISSION REVIEW  /  LOCAL SIMULATION', 43, 111);
      const nodes = [[150, 343], [370, 215], [391, 481], [628, 344], [863, 212], [942, 478]];
      g.strokeStyle = '#759f9b'; g.lineWidth = 5;
      for (const [a, b] of [[0,1],[0,2],[1,3],[2,3],[3,4],[3,5]]) { g.beginPath(); g.moveTo(...nodes[a]); g.lineTo(...nodes[b]); g.stroke(); }
      nodes.forEach(([x,y], i) => {
        g.fillStyle = i === 3 ? '#a1b93e' : '#204b54'; g.fillRect(x-55,y-33,110,66);
        g.strokeStyle = '#b5d1c7'; g.lineWidth = 2; g.strokeRect(x-55,y-33,110,66);
        g.fillStyle = '#e4edda'; g.font = '500 24px Space, Arial'; g.fillText(['SIGNAL','RESEARCH','CREATION','REVIEW','PLAN','LAUNCH'][i],x-48,y+9,96);
      });
      g.fillStyle = '#cfff04'; g.font = '500 25px Space, Arial'; g.fillText('DISCUSS  →  DECIDE  →  COORDINATE', 40, 658);
    });
    map.userData.emissiveDisplay = true;
    textPlane(map, 1.45, .87, ...point(f, 0, 1.67, .428), f.ry); stats.displays++;
    fasteners(f, 0, 1.67, .423, 1.55, .95);
    // Fold-down counter with pivot arms and separate secured briefing cards.
    L(f, 0, .91, .63, 1.45, .065, .51, M.enamel);
    L(f, 0, .946, .63, 1.34, .010, .42, M.graphite);
    LP(f, [-.71,.85,.39], [.71,.85,.39], .038, M.silver);
    for (const side of [-1,1]) {
      LP(f, [side*.53,.59,.34], [side*.53,.87,.77], .025, M.silver);
      L(f, side*.43, .50, 1.035, .38, .085, .38, fabric);
      L(f, side*.43, .555, .94, .34, .038, .13, M.padding);
      LP(f, [side*.43,.19,.76], [side*.43,.46,1.08], .032, M.silver);
      L(f, side*.43, .175, .79, .33, .07, .25, M.graphite);
      localBlocker(m, f, `fold-seat-${side}`, side*.43, .92, .40, .63);
      stats.seats++;
    }
    // Three shallow bounds follow the diagonal counter without an oversized
    // axis-aligned box protruding beyond the octagonal pressure hull.
    for (const x of [-.48,0,.48]) localBlocker(m, f, `meeting-counter-${x}`, x, .63, .50, .52);
    for (let i=0;i<3;i++) {
      L(f, -.43+i*.43, .964, .61, .29, .018, .24, i===1?ochre:M.padding);
      const card = texture(384, 256, g => {
        g.fillStyle = i===1?'#c5b17e':'#d7dbce'; g.fillRect(0,0,384,256);
        g.fillStyle = '#283d3f'; g.font='500 33px Space, Arial';g.fillText(['01 / DISCUSS','02 / DECIDE','03 / ASSIGN'][i],18,46);
        g.font='400 18px Space, Arial';g.fillText('FORUM / MISSION REVIEW',18,78);
        for(let line=0;line<5;line++){g.strokeStyle='#6d7f77';g.lineWidth=3;g.strokeRect(20,104+line*25,12,12);g.fillRect(46,107+line*25,270-line*25,3);}
      });
      const sheet=textPlane(card,.26,.19,...point(f,-.43+i*.43,.978,.61),f.ry);
      sheet.rotateX(-Math.PI/2);
      L(f, -.43+i*.43, .983, .61, .023, .012, .20, M.seal);
    }
    placard(f, 'BRIEFING 05', 'FOLD COUNTER / LOCK BEFORE TRANSIT', 0, 1.08, .44, .89);
  }

  function fabrication(m) {
    const f = frame(m, -1.75, 3.3, Math.PI);
    L(f, 0, .86, 0, 1.23, .105, .69, M.enamel);
    L(f, 0, .918, 0, 1.10, .018, .59, M.graphite);
    for (const x of [-.49,.49]) {
      L(f, x, .43, 0, .115, .79, .47, M.silver);
      L(f, x, .055, 0, .30, .07, .53, M.graphite);
    }
    blocker(m, 'fabrication-bench', -1.75, 3.3, 1.25, .71);
    // Fixed articulated tool arm: shoulder, elbow, wrist and parallel gripper.
    const joints = [[.32,1.01,-.09],[.32,1.45,-.09],[-.03,1.80,-.03],[-.35,1.46,.13]];
    LP(f, [.32,.94,-.09], [.32,1.12,-.09], .14, M.graphite, 16);
    for (let i=0;i<joints.length-1;i++) {
      LP(f, joints[i], joints[i+1], i===0?.083:.065, ochre, 12);
      const [x,y,z] = joints[i+1];
      LP(f, [x,y,z-.10], [x,y,z+.10], .105, M.silver, 16);
      LP(f, [x,y,z-.112], [x,y,z-.118], .060, M.seal, 12);
    }
    LP(f, [.30,1.14,.055], [-.04,1.76,.105], .019, M.seal, 8);
    LP(f, [-.04,1.76,.105], [-.37,1.46,.27], .019, M.seal, 8);
    for (const side of [-1,1]) {
      LP(f, [-.35+side*.09,1.43,.13], [-.35+side*.09,1.23,.13], .022, M.silver, 8);
      L(f, -.35+side*.058, 1.225, .13, .088, .035, .046, M.graphite);
    }
    L(f, -.32, .97, .09, .27, .065, .23, M.silver);
    for (let i=0;i<5;i++) L(f, -.39+i*.18, .945, -.22, .075, .035, .11, i%2?ochre:M.silver);
    for (const x of [-.48,.49]) fasteners(f, x, .854, .354, .055, .055);
    placard(f, 'THE FLOOR', 'FABRICATION / TOOL ARM 02', 0, .84, .362, .70);
    stats.robotArms++;
  }

  function archive(m) {
    for (const side of [-1,1]) {
      const f = frame(m, side*1.55, 2.03, Math.PI);
      L(f, 0, .86, 0, .58, 1.60, .48, M.graphite);
      L(f, 0, .085, 0, .63, .11, .53, M.silver);
      L(f, 0, 1.68, 0, .64, .095, .54, M.enamel);
      for (const x of [-.255,.255]) L(f, x, .89, .258, .045, 1.49, .055, M.silver);
      for (let row=0;row<7;row++) {
        const y=.24+row*.20;
        L(f, 0, y, .262, .43, .16, .065, row%2?M.seal:M.enamel);
        L(f, -.15, y, .304, .033, .115, .027, M.graphite);
        L(f, .136, y+.034, .300, .057, .018, .015, (row+side)%3?M.blueLight:M.accent);
        for (let i=0;i<5;i++) L(f, -.06+i*.035, y-.017, .303, .012, .061, .013, M.graphite);
      }
      for (let i=0;i<3;i++) LP(f, [-.17+i*.17,1.73,-.10], [-.17+i*.17,1.95,-.10], .022, i%2?M.silver:M.seal, 8);
      placard(f, side<0?'INDEX / A':'EVIDENCE / B', 'THE ARCHIVE / DATA CASSETTES', 0, 1.58, .307, .46);
      blocker(m, `data-tower-${side}`, side*1.55, 2.03, .66, .65);
      stats.racks++;
    }
  }

  function arrival(m) {
    const f = frame(m, m.hx-.34, 1.33, -Math.PI/2);
    L(f, 0, 1.06, -.05, .62, 1.88, .20, M.graphite);
    for (const side of [-1,1]) L(f, side*.31, 1.06, .055, .05, 1.96, .14, M.enamel);
    L(f, 0, 1.31, .14, .36, .54, .21, M.padding);
    for (const side of [-1,1]) {
      LP(f, [side*.21,1.52,.13], [side*.29,1.13,.17], .080, M.padding, 10);
      LP(f, [side*.095,1.10,.13], [side*.095,.62,.15], .084, M.padding, 10);
      L(f, side*.10, .56, .19, .17, .11, .27, M.graphite);
      L(f, side*.30, 1.095, .18, .12, .14, .13, ochre);
      L(f, side*.10, 1.33, .265, .043, .47, .028, M.seal);
    }
    L(f, 0, 1.37, .282, .26, .17, .06, M.enamel);
    for (const x of [-.07,.07]) L(f, x, 1.40, .318, .043, .024, .013, M.accent);
    const helmet = ctx.addMesh(new THREE.SphereGeometry(.213,18,12), M.enamel);
    helmet.position.set(...point(f,0,1.84,.13)); helmet.scale.set(1,1.03,1);
    const shield = ctx.addMesh(new THREE.SphereGeometry(.217,18,10,0,Math.PI*.70,Math.PI*.28,Math.PI*.44), visor);
    shield.position.copy(helmet.position); shield.rotation.y=f.ry+Math.PI*.15; shield.scale.set(1,1.03,1);
    LP(f, [-.14,1.55,.18], [-.14,1.64,.18], .035, M.silver, 10);
    LP(f, [.14,1.55,.18], [.14,1.64,.18], .035, M.silver, 10);
    placard(f, 'EVA / STOWED', 'ARRIVAL EQUIPMENT / SECURED', 0, .28, .083, .53);
    localBlocker(m,f,'eva-gear',0,.12,.67,.46);
    const south = facet(m,4);
    for (let i=0;i<3;i++) {
      const x=(i-1)*.69;
      L(south,x,2.30,.19,.62,.36,.27,M.enamel);
      L(south,x,2.30,.333,.55,.29,.033,M.seal);
      L(south,x,2.30,.356,.50,.25,.026,M.padding);
      L(south,x,2.29,.386,.19,.034,.025,M.silver);
      for(const sign of [-1,1])L(south,x+sign*.22,2.40,.377,.022,.044,.014,ochre);
      stats.lockers++;
    }
    placard(south,'SUPPLY / 01','EQUIPMENT RESERVE',0,2.32,.383,.33);
  }

  function bridge(m) {
    // Outer pilot seats leave the central console and the room's through-route free.
    for (const side of [-1,1]) {
      const f=frame(m,side*1.35,-3.11,Math.PI);
      L(f,0,.074,0,.62,.12,.64,M.graphite);
      LP(f,[0,.13,0],[0,.48,0],.085,M.silver,12);
      L(f,0,.51,0,.57,.11,.53,M.graphite);
      L(f,0,.581,.02,.49,.09,.46,fabric);
      L(f,0,.90,-.22,.57,.67,.12,M.enamel,-.07);
      L(f,0,.915,-.141,.48,.56,.09,fabric,-.07);
      L(f,0,1.31,-.23,.37,.18,.16,M.graphite);
      L(f,0,1.32,-.13,.30,.13,.055,M.padding);
      for(const arm of [-1,1]) {
        LP(f,[arm*.27,.57,-.15],[arm*.27,.77,-.15],.024,M.silver,10);
        L(f,arm*.29,.79,.03,.089,.067,.42,M.graphite);
        L(f,arm*.10,.94,-.082,.041,.55,.022,M.seal,arm*.15);
        L(f,arm*.085,.648,.12,.15,.024,.043,M.seal,arm*.2);
        LP(f,[arm*.18,.28,-.12],[arm*.18,.28,.26],.018,M.silver,8);
      }
      L(f,0,.665,.155,.068,.036,.042,M.silver);
      for(let i=0;i<4;i++)L(f,0,.75+i*.095,-.292,.36,.019,.014,M.seal);
      placard(f,side<0?'PILOT 01':'NAV 02','RESTRAINT / CHECK',0,1.13,-.304,.28).rotation.y+=Math.PI;
      blocker(m,`pilot-seat-${side}`,side*1.35,-3.11,.70,.72);
      stats.seats++;
    }
  }

  const builders={'front-door':arrival,archive,floor:fabrication,forum,bridge};
  for(const m of MODULES)if(builders[m.id]) {
    ctx.beginModule(m); builders[m.id](m); ctx.endSection();
  }
  return stats;
}
