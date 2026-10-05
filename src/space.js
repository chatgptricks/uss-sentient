import * as THREE from 'three';

/**
 * Distant stars belong to the sky, never to the station's metre-scale scene.
 * Three renders scene.background with camera rotation but without translation,
 * so these pinpoints cannot slide across a window as the player walks past it.
 */
export function addSpaceEnvironment({ scene, root, animated, texture, addMesh, resourceMaterials, resourceTextures }) {
  let seed = 18593;
  const random = () => {
    seed = seed * 16807 % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const skyFaces = Array.from({ length: 6 }, () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#020407';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const stellarColors = ['222,233,255', '239,243,255', '216,232,251', '255,236,210', '190,214,255'];
    for (let i = 0; i < 2600; i++) {
      const x = 2 + random() * 1020;
      const y = 2 + random() * 1020;
      const diameter = .52 + Math.pow(random(), 7) * 1.06;
      const brightness = .35 + Math.sqrt(random()) * .55;
      // A single antialiased pinpoint. No halo, flare, sprite, or local particle.
      ctx.fillStyle = `rgba(${stellarColors[Math.floor(random() * stellarColors.length)]},${brightness})`;
      ctx.beginPath();
      ctx.arc(x, y, diameter * .5, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas;
  });
  const sky = new THREE.CubeTexture(skyFaces);
  sky.colorSpace = THREE.SRGBColorSpace;
  sky.magFilter = THREE.LinearFilter;
  sky.minFilter = THREE.LinearFilter;
  sky.generateMipmaps = false;
  sky.needsUpdate = true;
  resourceTextures.add(sky);
  scene.background = sky;

  // The station occupies a close orbit over a fractured mineral world. Radiance
  // is baked once, including terraces, luminous fissures, mist and nightfall;
  // the large exterior never adds lights, shadow maps, or animated texture work.
  const planetPosition = new THREE.Vector3(30, -125, -4), planetRadius = 92;
  const noiseTable = new Float32Array(32 * 32 * 32);
  for (let i=0;i<noiseTable.length;i++) noiseTable[i]=random();
  const smooth = value => value * value * (3 - 2 * value);
  const step = (low, high, value) => smooth(Math.max(0, Math.min(1, (value-low)/(high-low))));
  function noise(x, y, z) {
    const ix=Math.floor(x), iy=Math.floor(y), iz=Math.floor(z);
    const fx=smooth(x-ix), fy=smooth(y-iy), fz=smooth(z-iz);
    const a=(ix&31)+((iy&31)<<5)+((iz&31)<<10), b=((ix+1)&31)+((iy&31)<<5)+((iz&31)<<10);
    const c=(ix&31)+(((iy+1)&31)<<5)+((iz&31)<<10), d=((ix+1)&31)+(((iy+1)&31)<<5)+((iz&31)<<10);
    const e=(ix&31)+((iy&31)<<5)+(((iz+1)&31)<<10), f=((ix+1)&31)+((iy&31)<<5)+(((iz+1)&31)<<10);
    const g=(ix&31)+(((iy+1)&31)<<5)+(((iz+1)&31)<<10), h=((ix+1)&31)+(((iy+1)&31)<<5)+(((iz+1)&31)<<10);
    const front=(noiseTable[a]+(noiseTable[b]-noiseTable[a])*fx)*(1-fy)+(noiseTable[c]+(noiseTable[d]-noiseTable[c])*fx)*fy;
    const back=(noiseTable[e]+(noiseTable[f]-noiseTable[e])*fx)*(1-fy)+(noiseTable[g]+(noiseTable[h]-noiseTable[g])*fx)*fy;
    return front+(back-front)*fz;
  }
  function terrainNoise(x, y, z, octaves=5) {
    let value=0, amplitude=.54, total=0;
    for (let octave=0;octave<octaves;octave++) {
      value+=noise(x,y,z)*amplitude; total+=amplitude;
      x=x*2.03+3.17; y=y*2.03+7.91; z=z*2.03+1.43; amplitude*=.49;
    }
    return value/total;
  }
  // A side-lit solar phase puts a legible terminator across the mineral plates. The
  // compressed celestial distances are illustrative, not an orbital simulation.
  const solarDirection = new THREE.Vector3(-.91,.03,-.41).normalize();
  const plateCount=32, plateSeeds=new Float32Array(plateCount*3);
  const platePalette=[[38,23,58],[58,31,74],[116,61,79],[154,83,92],[77,51,89]];
  for(let i=0;i<plateCount;i++) {
    const y=1-2*(i+.5)/plateCount, ring=Math.sqrt(1-y*y), angle=i*2.3999632297+(random()-.5)*.21;
    plateSeeds.set([Math.cos(angle)*ring,y,Math.sin(angle)*ring],i*3);
  }
  const planetMap = texture(3072,1536,(ctx,width,height) => {
    const pixels=ctx.createImageData(width,height), data=pixels.data;
    const sinLongitude=new Float32Array(width), cosLongitude=new Float32Array(width);
    for (let x=0;x<width;x++) {
      const phi=x/(width-1)*Math.PI*2;
      sinLongitude[x]=Math.sin(phi); cosLongitude[x]=Math.cos(phi);
    }
    for (let y=0;y<height;y++) {
      const theta=y/(height-1)*Math.PI, axis=Math.cos(theta), ring=Math.sin(theta);
      for (let x=0;x<width;x++) {
        // Match the sphere's quarter-turn around X. Moving its UV poles away
        // from the cupola avoids stretched texels in the main downward view.
        const nx=-cosLongitude[x]*ring, ny=-sinLongitude[x]*ring, nz=axis;
        // Warped spherical Voronoi cells produce coherent tectonic slabs rather
        // than recoloured continent blobs. Their borders become canyon systems.
        const warp=noise(nx*9+15,ny*9+11,nz*9+7)-.5;
        const wx=nx+warp*.064;
        const wy=ny+(noise(nx*9+3,ny*9+17,nz*9+21)-.5)*.064;
        const wz=nz+(noise(nx*9+24,ny*9+4,nz*9+12)-.5)*.064;
        let closest=-2, second=-2, plate=0;
        for(let p=0;p<plateCount;p++) {
          const k=p*3, score=wx*plateSeeds[k]+wy*plateSeeds[k+1]+wz*plateSeeds[k+2];
          if(score>closest){second=closest;closest=score;plate=p;}else if(score>second)second=score;
        }
        const edge=closest-second;
        const relief=terrainNoise(nx*20+13,ny*20+5,nz*20+19,3);
        const grain=noise(nx*145+2,ny*145+11,nz*145+7);
        // A finite height difference in the solar direction bakes actual
        // light-facing grain and shaded pits into otherwise unlit geometry.
        const grainLit=noise(nx*145+2+solarDirection.x*.32,ny*145+11+solarDirection.y*.32,nz*145+7+solarDirection.z*.32);
        const grit=noise(nx*357+21,ny*357+8,nz*357+3);
        const rockLight=Math.max(.40,Math.min(1.37,.89+(grainLit-grain)*2.9))*(.85+grit*.29);
        const mineral=noise(nx*6+2,ny*6+15,nz*6+22);
        const superRift=Math.abs(nx*.88+ny*.20+nz*.43+.025+warp*.13);
        const canyon=Math.max(1-step(.002,.015,edge),1-step(.004,.024,superRift));
        const smallFault=1-step(.003,.015,Math.abs(noise(nx*32+4,ny*32+21,nz*32+9)-.48));
        const tributaries=smallFault*(1-step(.018,.075,edge))*step(.25,.65,mineral)*.065;
        const vein=Math.max(1-step(.0003,.00115,edge),1-step(.0006,.0022,superRift))*(.25+grain*.18)+tributaries;
        const terrace=Math.floor((edge*7+relief*.27)*11)/11;
        const layers=edge*147+relief*9, layer=layers-Math.floor(layers);
        const strataLight=1-.27*(1-step(.012,.145,layer))+.13*step(.925,.99,layer);
        const shelf=(1-step(.04,.105,edge))*step(.008,.023,edge);
        const paint=platePalette[plate%platePalette.length];
        const k=plate*3, layered=.5+.5*Math.sin((nx*plateSeeds[k+2]-nz*plateSeeds[k]+ny*.24)*197+relief*11);
        const reliefLight=(.65+relief*.44+grain*.11+terrace*.32+layered*.055)*(1-smallFault*.30)*rockLight*strataLight;
        const copper=shelf*(.37+mineral*.38);
        let r=(paint[0]*(1-copper)+(143+relief*58)*copper)*reliefLight;
        let g=(paint[1]*(1-copper)+(69+relief*33)*copper)*reliefLight;
        let b=(paint[2]*(1-copper)+(61+relief*22)*copper)*reliefLight;
        // Stepped mineral rims drop into obsidian channels; only their narrow
        // deepest basins fluoresce, including on the planet's night side.
        r=r*(1-canyon*.90)+canyon*5;
        g=g*(1-canyon*.87)+canyon*8;
        b=b*(1-canyon*.77)+canyon*16;
        const latitude=nx*.42+ny*.21+nz*.883;
        const jet=latitude*49+relief*7+warp*3;
        const dust=terrainNoise(nx*7+24,ny*7+3,nz*7+17,3);
        const mist=step(.49,.66,dust)*step(.24,.88,.5+.5*Math.sin(jet))*.35;
        const fineMist=step(.91,.99,.5+.5*Math.sin(jet*3.7))*.026;
        const veil=mist+fineMist, pearl=step(.35,.65,mineral);
        r=r*(1-veil)+(174+pearl*17)*veil;
        g=g*(1-veil)+(145+pearl*18)*veil;
        b=b*(1-veil)+(79+pearl*106)*veil;
        const incidence=nx*solarDirection.x+ny*solarDirection.y+nz*solarDirection.z;
        const daylight=step(-.055,.07,incidence)*Math.pow(Math.max(0,incidence),.42);
        const light=.055+daylight*.945;
        const dusk=Math.exp(-Math.abs(incidence)*28)*.045;
        const i=(y*width+x)*4;
        data[i]=Math.min(255,r*light+dusk*85+vein*(170-mineral*110));
        data[i+1]=Math.min(255,g*light+dusk*58+vein*(184+mineral*22));
        data[i+2]=Math.min(255,b*light+2+dusk*119+vein*(39+mineral*157));
        data[i+3]=255;
      }
    }
    ctx.putImageData(pixels,0,0);
    const lightingAt=(x,y)=>{
      const phi=x/(width-1)*Math.PI*2,theta=y/(height-1)*Math.PI,s=Math.sin(theta);
      const incidence=-Math.cos(phi)*s*solarDirection.x-Math.sin(phi)*s*solarDirection.y+Math.cos(theta)*solarDirection.z;
      return .055+step(-.055,.07,incidence)*Math.pow(Math.max(0,incidence),.42)*.945;
    };
    const ink=(r,g,b,light,alpha)=>`rgba(${Math.round(r*light)},${Math.round(g*light)},${Math.round(b*light)},${alpha})`;
    // Discontinuous, angular faults introduce a smaller geological scale than
    // the main plates. A fine copper lip borders each dark fracture.
    for(let fault=0;fault<135;fault++) {
      let x=random()*width,y=(.16+random()*.68)*height,angle=random()*Math.PI*2;
      const points=[[x,y]],segments=9+Math.floor(random()*15),length=3+random()*7;
      for(let segment=0;segment<segments;segment++) {
        angle+=(random()-.5)*.85;x+=Math.cos(angle)*length;y+=Math.sin(angle)*length;
        points.push([x,y]);
      }
      const light=lightingAt(points[0][0],points[0][1]);
      ctx.lineJoin='miter';ctx.lineCap='butt';
      ctx.strokeStyle=ink(13,8,21,Math.max(.14,light),.84);ctx.lineWidth=1.05+random()*.85;
      ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
      ctx.strokeStyle=ink(170,99,108,light,.46);ctx.lineWidth=.48;
      ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x-.55,y-.35):ctx.moveTo(x-.55,y-.35));ctx.stroke();
      for(let branch=2;branch<points.length-2;branch+=4) {
        const p=points[branch],next=points[branch+1],a=Math.atan2(next[1]-p[1],next[0]-p[0])+(random()>.5?1:-1)*(.5+random()*.5);
        ctx.strokeStyle=ink(14,9,23,Math.max(.15,light),.73);ctx.lineWidth=.65;
        ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(p[0]+Math.cos(a)*length*1.8,p[1]+Math.sin(a)*length*1.8);
        ctx.lineTo(p[0]+Math.cos(a+.34)*length*3.5,p[1]+Math.sin(a+.34)*length*3.5);ctx.stroke();
      }
    }
    // Scar fields are physically scaled in spherical UVs, with raised broken
    // rims, shaded floors and ejecta scratches. They do not emit at night.
    const scarFields=Array.from({length:11},(_,i)=>({x:(i===0?.785:random())*width,y:(i===0?.535:.2+random()*.6)*height}));
    for(let crater=0;crater<270;crater++) {
      const field=scarFields[crater%scarFields.length],spread=crater<155?85:270;
      const x=(field.x+(random()-.5)*spread+width)%width,y=Math.max(height*.13,Math.min(height*.87,field.y+(random()-.5)*spread*.65));
      const radius=1.9+Math.pow(random(),3)*22,stretch=1/Math.sin(y/height*Math.PI),light=lightingAt(x,y);
      ctx.save();ctx.translate(x,y);ctx.scale(stretch,1);
      const ringPoints=Array.from({length:32},(_,i)=>{const a=i/32*Math.PI*2,r=radius*(.94+random()*.12);return [Math.cos(a)*r,Math.sin(a)*r];});
      ctx.strokeStyle=ink(93,55,82,light,.46);ctx.lineWidth=Math.max(.8,radius*.16);
      ctx.beginPath();ringPoints.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.stroke();
      ctx.fillStyle=ink(20,11,31,Math.max(.22,light),.72);ctx.beginPath();ctx.ellipse(0,0,radius*.82,radius*.80,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=ink(202,130,136,light,.70);ctx.lineWidth=Math.max(.65,radius*.065);
      ctx.beginPath();ctx.ellipse(-radius*.025,-radius*.04,radius*.91,radius*.88,0,Math.PI*.88,Math.PI*1.91);ctx.stroke();
      ctx.strokeStyle=ink(10,7,17,Math.max(.18,light),.76);ctx.lineWidth=Math.max(.9,radius*.14);
      ctx.beginPath();ctx.ellipse(radius*.04,radius*.03,radius*.69,radius*.66,0,Math.PI*.84,Math.PI*1.82);ctx.stroke();
      if(radius>7) {
        ctx.strokeStyle=ink(153,92,113,light,.23);ctx.lineWidth=.6;
        for(let ray=0;ray<9;ray++) {
          const angle=random()*Math.PI*2,reach=radius*(1.15+random()*.68);
          ctx.beginPath();ctx.moveTo(Math.cos(angle)*radius*.98,Math.sin(angle)*radius*.98);
          ctx.lineTo(Math.cos(angle+.06)*reach,Math.sin(angle+.06)*reach);ctx.stroke();
        }
        ctx.fillStyle=ink(113,70,94,light,.43);ctx.beginPath();ctx.ellipse(-radius*.15,radius*.12,radius*.15,radius*.11,0,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
  });
  planetMap.name='Pelagia / fractured mineral plates, fluorescent basins and sulfur mist';
  planetMap.wrapS=THREE.RepeatWrapping;
  const planetMaterial=new THREE.MeshBasicMaterial({map:planetMap,toneMapped:false});
  planetMaterial.name='Pelagia / prelit planetary surface'; resourceMaterials.add(planetMaterial);
  const planetGeometry=new THREE.SphereGeometry(planetRadius,128,80);
  planetGeometry.rotateX(Math.PI/2);
  const planet=addMesh(planetGeometry,planetMaterial,root);
  planet.name='Pelagia / alien mineral planet beneath USS Sentient'; planet.position.copy(planetPosition);
  planet.castShadow=false; planet.receiveShadow=false; planet.userData.excludeFromAO=true;

  // Vertex alpha supplies a layered mineral limb without a fragment shader. Its
  // fixed viewing axis is the cupola; station-scale movement barely changes it.
  const atmosphereGeometry=new THREE.SphereGeometry(planetRadius+1.05,128,80);
  const surface=atmosphereGeometry.attributes.position, atmosphereColors=new Float32Array(surface.count*4);
  const cupola=new THREE.Vector3(0,-3.2,-22), point=new THREE.Vector3(), view=new THREE.Vector3(), normal=new THREE.Vector3();
  for (let i=0;i<surface.count;i++) {
    point.fromBufferAttribute(surface,i); normal.copy(point).normalize();
    view.copy(cupola).sub(planetPosition).sub(point).normalize();
    const facing=Math.max(0,normal.dot(view)), lit=step(-.12,.48,normal.dot(solarDirection));
    const stratum=.5+.5*Math.sin((normal.x*.42+normal.y*.21+normal.z*.883)*132);
    atmosphereColors.set([.48+stratum*.15,.29+stratum*.22,.12+stratum*.30,Math.pow(1-facing,5)*(.025+lit*.24)],i*4);
  }
  atmosphereGeometry.setAttribute('color',new THREE.BufferAttribute(atmosphereColors,4));
  const atmosphereMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false,side:THREE.FrontSide});
  atmosphereMaterial.name='Pelagia / sulfur, pearl and gold atmospheric limb'; resourceMaterials.add(atmosphereMaterial);
  const atmosphere=addMesh(atmosphereGeometry,atmosphereMaterial,root);
  atmosphere.name='Pelagia atmosphere'; atmosphere.position.copy(planetPosition);
  atmosphere.castShadow=false; atmosphere.receiveShadow=false; atmosphere.userData.excludeFromAO=true;

  // Fine, translucent mineral debris: one static draw with radial gaps and
  // incomplete outer dust arcs. The ring never updates its texture in flight.
  const ringInner=118, ringOuter=172;
  const ringMap=texture(2048,256,(ctx,width,height)=>{
    const pixels=ctx.createImageData(width,height),data=pixels.data;
    for(let y=0;y<height;y++) {
      const radius=1-y/(height-1);
      const fine=.5+.5*Math.sin(radius*431+Math.sin(radius*117)*1.8);
      const bands=.24+.56*fine+Math.sin(radius*76)*.17;
      const clearGap=(radius>.318&&radius<.367)||(radius>.676&&radius<.715);
      const rim=step(0,.035,radius)*(1-step(.94,1,radius));
      for(let x=0;x<width;x++) {
        const angle=x/(width-1)*Math.PI*2;
        const dust=noise(Math.cos(angle)*17+2,Math.sin(angle)*17+8,radius*37+12);
        const arc=radius>.76?(step(-.35,.35,Math.sin(angle*3+radius*5))*.83+.17):1;
        const flecks=.68+random()*.32, mineral=step(.39,.69,dust);
        const i=(y*width+x)*4;
        data[i]=154+mineral*57;data[i+1]=128+mineral*43;data[i+2]=91+mineral*71;
        data[i+3]=clearGap?0:Math.max(0,Math.min(128,bands*rim*arc*(.48+dust*.52)*flecks*119));
      }
    }
    ctx.putImageData(pixels,0,0);
  });
  ringMap.name='Pelagia / banded mineral dust rings';ringMap.wrapS=THREE.RepeatWrapping;
  const ringGeometry=new THREE.RingGeometry(ringInner,ringOuter,256,8);
  const ringPositions=ringGeometry.attributes.position,ringUV=ringGeometry.attributes.uv;
  for(let i=0;i<ringPositions.count;i++) {
    const x=ringPositions.getX(i),y=ringPositions.getY(i);
    ringUV.setXY(i,(i%257)/256,(Math.hypot(x,y)-ringInner)/(ringOuter-ringInner));
  }
  const ringMaterial=new THREE.MeshBasicMaterial({map:ringMap,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
  ringMaterial.name='Pelagia / inclined dust ring';resourceMaterials.add(ringMaterial);
  const planetaryRing=addMesh(ringGeometry,ringMaterial,root);
  planetaryRing.name='Pelagia / broken mineral rings';planetaryRing.position.copy(planetPosition);
  const ringNormal=new THREE.Vector3(-.43,.62,.655).normalize();
  planetaryRing.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),ringNormal);
  planetaryRing.castShadow=false;planetaryRing.receiveShadow=false;planetaryRing.userData.excludeFromAO=true;

  // Only this one luminous body is prominent: the lime star framed by the bridge.
  const stellarMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec3 vSurface;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;
      void main() {
        vSurface = normalize(position);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewNormal = normalize(normalMatrix * normal);
        vViewDirection = -viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vSurface;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;
      float hash(vec3 p) {
        p = fract(p * .3183099 + .1);
        p *= 17.;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3. - 2. * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float turbulence(vec3 p) {
        float n = noise(p) * .54;
        n += noise(p * 2.07 + 7.3) * .27;
        n += noise(p * 4.19 + 13.7) * .13;
        n += noise(p * 8.37 + 19.1) * .06;
        return n;
      }
      void main() {
        vec3 surface = normalize(vSurface);
        float t = time * .018;
        vec3 p = surface * 7.5;
        vec3 flow = vec3(
          noise(p + vec3(t, 0., 0.)),
          noise(p + vec3(4.7, t, 2.1)),
          noise(p + vec3(1.3, 8.1, -t))
        ) - .5;
        float cells = turbulence(p + flow * 2.2 + vec3(0., t, 0.));
        float granules = noise(surface * 88. + flow * 1.8 + t) * .085;
        float heat = smoothstep(.25, .78, cells + granules);
        float filaments = pow(1. - abs(cells * 2. - 1.), 12.) * .13;
        vec3 cool = vec3(.32, .49, .005);
        vec3 hot = vec3(.87, 1., .12);
        vec3 color = mix(cool, hot, heat) + filaments * vec3(.55, .67, .08);
        float facing = max(dot(normalize(vViewNormal), normalize(vViewDirection)), 0.);
        float limb = .57 + .43 * pow(facing, .32);
        gl_FragColor = vec4(color * limb * 1.45, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
  });
  resourceMaterials.add(stellarMaterial);
  const star = addMesh(new THREE.SphereGeometry(19, 72, 48), stellarMaterial);
  star.name = 'Sentient primary lime star';
  star.position.set(-1, 9, -103);
  star.castShadow = false;
  star.receiveShadow = false;

  const coronaMap = texture(512, 512, ctx => {
    const gradient = ctx.createRadialGradient(256, 256, 134, 256, 256, 256);
    gradient.addColorStop(0, 'rgba(221,255,65,.15)');
    gradient.addColorStop(.16, 'rgba(205,255,22,.095)');
    gradient.addColorStop(.48, 'rgba(170,232,11,.024)');
    gradient.addColorStop(1, 'rgba(150,222,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
  });
  const coronaMaterial = new THREE.SpriteMaterial({
    map: coronaMap,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  resourceMaterials.add(coronaMaterial);
  const corona = new THREE.Sprite(coronaMaterial);
  corona.name = 'Primary star corona';
  corona.position.copy(star.position);
  corona.scale.set(72, 72, 1);
  root.add(corona);

  animated.push(time => {
    stellarMaterial.uniforms.time.value = time;
    star.rotation.y = time * .004;
  });
  return {
    distantStars:15600, backgroundType:'CubeTexture', planetName:'Pelagia',
    planetPosition:planetPosition.toArray(), planetRadius, planetDrawCalls:3,
    planetTriangles:(planet.geometry.index.count+atmosphere.geometry.index.count+ringGeometry.index.count)/3,
    planetTextureSize:[3072,1536], dynamicPlanetEffects:0,
    planetDescription:'Obsidian and violet tectonic plates, copper mineral terraces, fluorescent fracture basins and stratified sulfur haze',
    planetFeatures:['warped tectonic plates','directionally shaded granular crust','layered copper shelves','branching faults','impact scar clusters','chartreuse and cyan fissures','mineral mist','tilted broken dust rings'],
    planetaryRings:{innerRadius:ringInner,outerRadius:ringOuter,normal:ringNormal.toArray(),textureSize:[2048,256]},
  };
}
