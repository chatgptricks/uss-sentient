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

  // The station occupies a close orbit over this ocean world. Its radiance is
  // baked once into a seamless spherical map, including clouds and nightfall;
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
  // A side-lit solar phase puts a legible terminator across the ocean. The
  // compressed celestial distances are illustrative, not an orbital simulation.
  const solarDirection = new THREE.Vector3(-.91,.03,-.41).normalize();
  const planetMap = texture(2048,1024,(ctx,width,height) => {
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
        const warp=noise(nx*3+15,ny*3+11,nz*3+7)-.5;
        const land=terrainNoise(nx*2.7+13+warp*.55,ny*2.7+5,nz*2.7+19-warp*.55,7);
        const mountains=terrainNoise(nx*46+2,ny*46+11,nz*46+7,4);
        const latitude=Math.abs(nx*.2+ny*.4+nz*.8944);
        const inland=step(.516,.522,land), coast=step(.501,.517,land);
        const climate=noise(nx*6+2,ny*6+15,nz*6+22);
        const dryness=step(.17,.28,latitude)*(1-step(.63,.78,latitude))*step(.3,.64,climate);
        const ice=Math.max(step(.90,.99,latitude+mountains*.045),step(.65,.79,land+mountains*.09)*inland*.8);
        // Deep blue water, turquoise shelves, green/brown continents and ice.
        let r=7+coast*12, g=35+coast*54, b=72+coast*52;
        r=r*(1-inland)+(24+dryness*129+mountains*38)*inland;
        g=g*(1-inland)+(54+dryness*69+mountains*39)*inland;
        b=b*(1-inland)+(31+dryness*51+mountains*23)*inland;
        r=r*(1-ice)+207*ice; g=g*(1-ice)+222*ice; b=b*(1-ice)+224*ice;
        const wind=Math.sin(latitude*12+ny*2)*1.7;
        const cloudNoise=terrainNoise(nx*8+nz*wind+24,ny*9+3,nz*8-nx*wind+17,6);
        const cloudDetail=noise(nx*135+19,ny*135+6,nz*135+23);
        let clouds=step(.505,.605,cloudNoise)*(.66+cloudDetail*.31);
        // One broad rotating weather system, built into the same static map.
        const sx=nx+.37, sy=ny-.83, sz=nz-.42, stormDistance=Math.sqrt(sx*sx+sy*sy+sz*sz);
        if (stormDistance<.42) {
          const swirl=Math.sin(Math.atan2(sz,sx)*3-stormDistance*47+cloudNoise*2)*.5+.5;
          const bands=step(.30,.76,swirl)*(1-step(.13,.42,stormDistance))*step(.023,.063,stormDistance);
          clouds=Math.max(clouds,bands*.88);
        }
        // Cloud shadows are a small diffuse depression under the white layer.
        const cloudShade=1-clouds*.10;
        r=r*cloudShade*(1-clouds)+234*clouds;
        g=g*cloudShade*(1-clouds)+242*clouds;
        b=b*cloudShade*(1-clouds)+244*clouds;
        const incidence=nx*solarDirection.x+ny*solarDirection.y+nz*solarDirection.z;
        const daylight=step(-.055,.07,incidence)*Math.pow(Math.max(0,incidence),.42);
        const light=.025+daylight*.975;
        const dusk=Math.exp(-Math.abs(incidence)*28)*.045;
        const i=(y*width+x)*4;
        data[i]=Math.min(255,r*light+dusk*60);
        data[i+1]=Math.min(255,g*light+dusk*89);
        data[i+2]=Math.min(255,b*light+2+dusk*146);
        data[i+3]=255;
      }
    }
    ctx.putImageData(pixels,0,0);
  });
  planetMap.name='Pelagia / oceans, continents, weather and solar terminator';
  planetMap.wrapS=THREE.RepeatWrapping;
  const planetMaterial=new THREE.MeshBasicMaterial({map:planetMap,toneMapped:false});
  planetMaterial.name='Pelagia / prelit planetary surface'; resourceMaterials.add(planetMaterial);
  const planetGeometry=new THREE.SphereGeometry(planetRadius,128,80);
  planetGeometry.rotateX(Math.PI/2);
  const planet=addMesh(planetGeometry,planetMaterial,root);
  planet.name='Pelagia / ocean planet beneath USS Sentient'; planet.position.copy(planetPosition);
  planet.castShadow=false; planet.receiveShadow=false; planet.userData.excludeFromAO=true;

  // Vertex alpha supplies a quiet blue limb without a fragment shader. Its
  // fixed viewing axis is the cupola; station-scale movement barely changes it.
  const atmosphereGeometry=new THREE.SphereGeometry(planetRadius+1.05,128,80);
  const surface=atmosphereGeometry.attributes.position, atmosphereColors=new Float32Array(surface.count*4);
  const cupola=new THREE.Vector3(0,-3.2,-22), point=new THREE.Vector3(), view=new THREE.Vector3(), normal=new THREE.Vector3();
  for (let i=0;i<surface.count;i++) {
    point.fromBufferAttribute(surface,i); normal.copy(point).normalize();
    view.copy(cupola).sub(planetPosition).sub(point).normalize();
    const facing=Math.max(0,normal.dot(view)), lit=step(-.12,.48,normal.dot(solarDirection));
    atmosphereColors.set([.11,.40,.74,Math.pow(1-facing,5)*(.018+lit*.22)],i*4);
  }
  atmosphereGeometry.setAttribute('color',new THREE.BufferAttribute(atmosphereColors,4));
  const atmosphereMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false,side:THREE.FrontSide});
  atmosphereMaterial.name='Pelagia / thin blue atmospheric limb'; resourceMaterials.add(atmosphereMaterial);
  const atmosphere=addMesh(atmosphereGeometry,atmosphereMaterial,root);
  atmosphere.name='Pelagia atmosphere'; atmosphere.position.copy(planetPosition);
  atmosphere.castShadow=false; atmosphere.receiveShadow=false; atmosphere.userData.excludeFromAO=true;

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
    planetPosition:planetPosition.toArray(), planetRadius, planetDrawCalls:2,
    planetTriangles:(planet.geometry.index.count+atmosphere.geometry.index.count)/3,
    planetTextureSize:[2048,1024], dynamicPlanetEffects:0,
  };
}
