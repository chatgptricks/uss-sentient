import { moduleFacet } from './layout.js';

/** Peripheral avionics banks: only solid cardinal walls, never an aisle or hatch. */
export function addScreenPanels(ctx) {
  const { MODULES, rooms, localBox, mat, texture, textPlane, kit, animated, materials: M } = ctx;
  const stats = { banks: 0, screens: 0, buttons: 0, gauges: 0, parts: 0 };
  const cyan = mat({ color: 0x75bdc5, emissive: 0x57bcc7, emissiveIntensity: .43, roughness: .45 });
  const lime = mat({ color: 0xc5db69, emissive: 0xcfff04, emissiveIntensity: .38, roughness: .45 });
  const amber = mat({ color: 0xc08c47, emissive: 0xd39032, emissiveIntensity: .2, roughness: .56 });
  const emergency = mat({ color: 0xa74d39, roughness: .52, metalness: .12 });
  const keyCap = mat({ color: 0x8c9c9b, roughness: .55, metalness: .2 });
  const TAU = Math.PI * 2;
  const roomPlots = {
    'front-door': ['radar', 'network', 'matrix', 'wave', 'bars', 'status'],
    archive: ['network', 'matrix', 'wave'],
    floor: ['bars', 'wave', 'spectrum', 'matrix'],
    lab: ['spectrum', 'wave', 'radar', 'status'],
    forum: ['network', 'radar'],
    commons: ['network', 'status', 'wave', 'bars', 'radar', 'matrix'],
    bridge: ['orbit', 'radar'],
  };
  const colors = { lime: '#cfff04', cyan: '#72d4dc', amber: '#e9b368', white: '#e5efe5', dim: '#527075' };
  const line = (g, x1, y1, x2, y2, color, width = 3) => { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const circle = (g, x, y, r, color, width = 3) => { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); };
  const text = (g, value, x, y, size = 24, color = colors.white) => { g.fillStyle = color; g.font = `500 ${size}px Space, Arial`; g.fillText(value, x, y); };

  function displayMap(type, moduleId, index) {
    return texture(768, 432, (g, w, h) => {
      g.fillStyle = '#07151c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#203941'; g.lineWidth = 1;
      for (let x = 32; x < w; x += 48) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 380); g.stroke(); }
      for (let y = 84; y < 380; y += 42) { g.beginPath(); g.moveTo(26, y); g.lineTo(w - 26, y); g.stroke(); }
      const title = ({ radar: 'PROXIMITY ARRAY', network: 'SIGNAL ROUTING', matrix: 'CHANNEL MATRIX', wave: 'LIVE TELEMETRY', bars: 'SYSTEM LOAD', status: 'HABITAT SYSTEMS', orbit: 'ORBIT SOLUTION', spectrum: 'SPECTRAL ANALYSIS' })[type];
      text(g, title, 30, 41, 27);
      text(g, `${String(index + 1).padStart(2, '0')} / LIVE`, 624, 39, 19, colors.cyan);
      line(g, 28, 60, 740, 60, '#3c5760', 2);
      if (type === 'radar') {
        const cx = 280, cy = 224;
        for (const r of [38, 77, 118]) circle(g, cx, cy, r, '#638f87', 2);
        line(g, cx - 140, cy, cx + 140, cy, '#486b70', 2); line(g, cx, cy - 141, cx, cy + 141, '#486b70', 2);
        g.fillStyle = '#cfff041f'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 119, -1.2, -.45); g.closePath(); g.fill();
        line(g, cx, cy, cx + 119 * Math.cos(-.45), cy + 119 * Math.sin(-.45), colors.lime, 4);
        for (const [x, y] of [[232, 144], [340, 252], [193, 267], [364, 169]]) { circle(g, x, y, 8, colors.cyan, 3); g.fillStyle = colors.cyan; g.fillRect(x - 2, y - 2, 4, 4); }
        text(g, 'LOCAL FIELD', 476, 128, 24, colors.cyan); text(g, 'CLEAR', 476, 186, 47, colors.lime);
        text(g, '4 TRACKS', 476, 245, 27); text(g, 'AUTO HOLD', 476, 304, 23, colors.dim);
      } else if (type === 'network') {
        const nodes = [[100, 217], [244, 116], [277, 306], [415, 208], [594, 123], [631, 291]];
        for (const [a,b] of [[0,1],[0,2],[1,3],[2,3],[3,4],[3,5]]) line(g, ...nodes[a], ...nodes[b], '#4e9cac', 5);
        nodes.forEach(([x,y],i) => { circle(g, x, y, i === 3 ? 28 : 21, i === 3 ? colors.lime : colors.cyan, 5); text(g, ['IN','01','02','HUB','03','OUT'][i], x - 16, y + 7, 18); });
        text(g, 'ALL LINKS SYNCHRONIZED', 228, 368, 25, colors.lime);
      } else if (type === 'matrix') {
        for (let row = 0; row < 6; row++) for (let col = 0; col < 14; col++) {
          const lit = ((row * 19 + col * 7 + index) % 13) > 2;
          g.fillStyle = lit ? ((row + col) % 6 === 0 ? colors.amber : colors.cyan) : '#24454c';
          g.fillRect(44 + col * 48, 104 + row * 38, 31, 22);
        }
        text(g, 'CHANNELS / LOCKED', 45, 366, 26, colors.lime);
      } else if (type === 'wave') {
        for (let row = 0; row < 3; row++) {
          const color = [colors.cyan, colors.lime, colors.amber][row]; g.strokeStyle = color; g.lineWidth = 4; g.beginPath();
          for (let i = 0; i < 130; i++) { const x = 36 + i * 5.3, y = 138 + row * 84 + Math.sin(i * (.20 + row * .15) + index) * (18 + row * 4) + Math.sin(i * .8) * 5; i ? g.lineTo(x,y) : g.moveTo(x,y); } g.stroke();
        }
        text(g, 'SIGNAL INTEGRITY', 40, 378, 23); text(g, 'NOMINAL', 572, 378, 23, colors.lime);
      } else if (type === 'bars') {
        const labels = ['POWER', 'COMPUTE', 'STORAGE', 'UPLINK'];
        labels.forEach((name, i) => {
          text(g, name, 35, 127 + i * 68, 22, colors.cyan); g.fillStyle = '#1d3940'; g.fillRect(206, 103 + i * 68, 482, 32);
          const value = [0.72, 0.48, 0.85, 0.64][(i + index) % 4]; g.fillStyle = i === 2 ? colors.amber : colors.lime; g.fillRect(206, 103 + i * 68, 482 * value, 32);
          for (let x = 228; x < 688; x += 24) { g.fillStyle = '#0c2024'; g.fillRect(x, 103 + i * 68, 4, 32); }
        });
      } else if (type === 'status') {
        const labels = ['OXYGEN', 'PRESSURE', 'THERMAL'];
        for (let i = 0; i < 3; i++) {
          const cx = 142 + i * 241, cy = 212; circle(g, cx, cy, 72, '#28474a', 15);
          g.strokeStyle = i === 2 ? colors.amber : colors.cyan; g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, 72, -Math.PI / 2, Math.PI * .99); g.stroke();
          text(g, ['STABLE', 'SEALED', 'NOMINAL'][i], cx - 49, cy + 8, 21, colors.white); text(g, labels[i], cx - 47, 332, 23, colors.lime);
        }
      } else if (type === 'orbit') {
        const cx = 365, cy = 231;
        for (const radius of [72, 134, 198]) { g.strokeStyle = '#497785'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx,cy,radius,radius*.51,-.19,0,TAU); g.stroke(); }
        g.fillStyle = colors.lime; g.beginPath(); g.arc(cx,cy,30,0,TAU); g.fill();
        g.strokeStyle = colors.white; g.lineWidth = 4; g.strokeRect(cx + 116, cy - 45, 18, 18);
        line(g, cx + 125, cy - 36, 650, 103, colors.cyan, 2); text(g, 'USS SENTIENT', 541, 88, 20, colors.cyan);
        text(g, 'SOL SENTIENT', 293, 319, 23, colors.lime); text(g, 'STATION KEEPING', 37, 377, 23);
      } else {
        g.strokeStyle = colors.cyan; g.lineWidth = 4; g.beginPath();
        for (let i = 0; i < 180; i++) {
          const x = 34 + i * 3.9;
          const peak = Math.exp(-Math.pow((i-42)/8,2))*.62 + Math.exp(-Math.pow((i-93)/5,2))*.98 + Math.exp(-Math.pow((i-134)/11,2))*.43;
          const y = 332 - peak * 223 - Math.abs(Math.sin(i*1.7))*9; i ? g.lineTo(x,y) : g.moveTo(x,y);
        } g.stroke();
        for (const [x,name] of [[199,'A'],[397,'B'],[557,'C']]) { line(g,x,92,x,343,colors.amber,2); text(g,name,x+9,110,24,colors.amber); }
        text(g, 'REFERENCE MATCH / CONFIRMED', 37, 382, 24, colors.lime);
      }
      g.fillStyle = '#0b2027'; g.fillRect(0, 409, w, 23);
      text(g, `SENTIENT / ${moduleId.toUpperCase()} / LOCAL SIM`, 30, 425, 13, '#6c969c');
    });
  }

  function faceFor(module, index) {
    const { a, b } = moduleFacet(module, index);
    return { origin: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, ry: -Math.atan2(b.z-a.z,b.x-a.x), length: Math.hypot(b.x-a.x,b.z-a.z), index };
  }
  function part(face, x, y, z, w, h, d, material = M.graphite, rz = 0) {
    stats.parts++; localBox(face.origin, face.ry, x, y, z, w, h, d, material, rz);
  }
  function pipe(face, a, b, r, material) { stats.parts++; kit.localPipe(face.origin,face.ry,a,b,r,material,12); }
  function bolt(face, x, y, z = .255) { stats.parts++; kit.localBolt(face.origin,face.ry,x,y,z,M.silver,.016); }

  function display(face, module, plot, index, x, y, w, h) {
    // Rear support arm and four nested physical bezel levels.
    pipe(face, [x,y,.112], [x,y,.216], .054, M.silver);
    part(face,x,y,.199,w+.10,h+.10,.062,M.graphite);
    part(face,x,y,.236,w+.054,h+.054,.034,M.seal);
    part(face,x,y,.262,w+.014,h+.014,.015,M.silver);
    const point = kit.toWorld(face.origin,face.ry,[x,y,.273]);
    const map = displayMap(plot,module.id,index);
    map.userData.emissiveDisplay = true;
    textPlane(map,w,h,...point,face.ry);
    for(const side of [-1,1]) {
      part(face,x+side*(w/2+.044),y,.267,.027,h*.58,.03,M.enamel);
      bolt(face,x+side*(w/2+.026),y-h/2-.026,.271);
    }
    part(face,x+w/2-.07,y-h/2-.033,.284,.035,.011,.018,cyan);
    stats.screens++;
  }

  function keypad(face, x, y, scale = 1) {
    part(face,x,y,.226,.57*scale,.273*scale,.035,M.seal);
    for(let row=0;row<3;row++) for(let col=0;col<5;col++) {
      const px=x+(col-2)*.095*scale, py=y+(1-row)*.076*scale;
      part(face,px,py,.256,.071*scale,.054*scale,.028,M.graphite);
      const material = col===4 ? (row===0 ? lime : row===1 ? amber : cyan) : keyCap;
      part(face,px,py,.277,.058*scale,.043*scale,.026,material);
      if(col!==4)part(face,px,py+.003*scale,.292,.018*scale,.005*scale,.003,M.enamel);
      stats.buttons++;
    }
  }

  function gauge(face, x, y, value = .6) {
    pipe(face,[x,y,.213],[x,y,.251],.062,M.silver);
    pipe(face,[x,y,.250],[x,y,.279],.051,M.seal);
    for(let i=0;i<7;i++) {
      const angle=-2.45+i*.81;
      part(face,x+Math.cos(angle)*.041,y+Math.sin(angle)*.041,.285,.010,.004,.007,i>4?amber:M.enamel,angle);
    }
    const angle=-2.45+value*4.88;
    pipe(face,[x,y,.289],[x+Math.cos(angle)*.035,y+Math.sin(angle)*.035,.289],.0035,lime);
    pipe(face,[x,y,.284],[x,y,.294],.008,M.silver);
    stats.gauges++;
  }

  function isolationButton(face, x, y) {
    part(face,x,y,.225,.18,.18,.035,M.seal);
    pipe(face,[x,y,.241],[x,y,.262],.045,M.silver);
    pipe(face,[x,y,.259],[x,y,.292],.032,emergency);
    for(const side of [-1,1]) pipe(face,[x+side*.063,y-.065,.27],[x+side*.063,y+.069,.27],.008,M.silver);
    pipe(face,[x-.063,y+.069,.27],[x+.063,y+.069,.27],.008,M.silver);
    part(face,x,y+.095,.247,.062,.012,.013,amber);
    stats.buttons++;
  }

  function bank(face,module,plots,cursor,count=2) {
    const narrow = face.length < 2.5, scale = face.bankScale ?? (narrow ? .91 : 1);
    const yShift=face.index===4?-.055:0;
    const chassisH=count===3?1.26:1.075, chassisY=count===3?1.46:1.43+yShift;
    part(face,0,chassisY,.178,1.81*scale,chassisH,.042,M.enamel);
    for(const x of [-.84,.84]) {
      part(face,x*scale,chassisY,.205,.043,chassisH-.08,.028,M.graphite);
      for(const sign of [-1,1])bolt(face,x*scale,chassisY+sign*(chassisH/2-.06),.232);
    }
    const leftX=-.355*scale;
    display(face,module,plots[cursor%plots.length],cursor,leftX,(count===3?1.77:1.685)+yShift,.88*scale,.495*scale);
    cursor++;
    if(count===3) {
      display(face,module,plots[cursor%plots.length],cursor,.545*scale,1.83,.55*scale,.31*scale);cursor++;
      display(face,module,plots[cursor%plots.length],cursor,.545*scale,1.45,.55*scale,.31*scale);cursor++;
    } else {
      display(face,module,plots[cursor%plots.length],cursor,.545*scale,1.747+yShift,.55*scale,.31*scale);cursor++;
    }
    keypad(face,-.36*scale,1.145+yShift,scale);
    gauge(face,.28*scale,1.17+yShift,.72); gauge(face,.47*scale,1.17+yShift,.51);
    isolationButton(face,.715*scale,1.12+yShift);
    // Physical toggles and rectangular indicator lenses beneath the small monitor.
    if(count!==3)for(let i=0;i<4;i++) {
      const x=(.31+i*.135)*scale;
      part(face,x,1.47+yShift,.233,.061,.11,.019,M.seal);
      part(face,x,1.47+yShift,.270,.018,.061,.035,M.silver,i%2?.22:-.22);
      part(face,x,1.545+yShift,.253,.029,.018,.027,[cyan,lime,amber,cyan][i]);
      stats.buttons++;
    }
    // Conduit and two right-angle plugs attach the assembly to the existing wall.
    pipe(face,[-.63*scale,.91+yShift,.145],[-.63*scale,.80+yShift,.145],.018,M.graphite);
    pipe(face,[.61*scale,.91+yShift,.145],[.61*scale,.80+yShift,.145],.018,M.graphite);
    part(face,-.63*scale,.925+yShift,.151,.076,.061,.055,M.silver);
    part(face,.61*scale,.925+yShift,.151,.076,.061,.055,M.silver);
    stats.banks++;
    return cursor;
  }

  for(const module of MODULES) {
    ctx.beginModule(module);
    const plots=roomPlots[module.id], portName={0:'N',2:'E',4:'S',6:'W'};
    let cursor=0;
    const free=[0,2,4,6].filter(index=>!module.ports.includes(portName[index]) && !(module.id==='bridge' && [0,2].includes(index)));
    if(module.id==='forum') {
      // Door shoulders carry small overhead annunciators; no screen blocks the hatch.
      for(const [j,index] of [0,4].entries()) {
        const face=faceFor(module,index), x=j?1.20:-1.20;
        display(face,module,plots[j],j,x,2.605,.74,.235);
        pipe(face,[x,2.50,.09],[x,2.50,.21],.024,M.silver);
      }
    } else {
      for(const index of free) {
        let face=faceFor(module,index);
        if(index===6 && module.id==='lab') {
          // The existing specimen capsule remains visible below these two readouts.
          for(const x of [.13,1.03]) {
            display(face,module,plots[cursor%plots.length],cursor,x,2.125,.68,.3825);cursor++;
            for(const dx of [-.12,.12]) {
              part(face,x+dx,1.90,.246,.074,.038,.023,M.seal);
              part(face,x+dx,1.90,.272,.047,.023,.028,dx<0?cyan:lime);
              stats.buttons++;
            }
          }
          stats.banks++;
        } else {
          if(index===6) {
            // Existing utility racks occupy the south half of west-facing walls.
            const scale=Math.min(1,(face.length/2-.10)/1.765), offset=.86*scale;
            const point=kit.toWorld(face.origin,face.ry,[offset,0,0]);
            face={...face,origin:{x:point[0],z:point[2]},bankScale:scale};
          }
          cursor=bank(face,module,plots,cursor,module.id==='archive'?3:2);
        }
      }
    }
    ctx.endSection();
  }
  animated.push(time=>{
    cyan.emissiveIntensity=.40+Math.sin(time*.65)*.11;
    lime.emissiveIntensity=.34+Math.sin(time*.44+1.8)*.10;
  });
  return stats;
}
