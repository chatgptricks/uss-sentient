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
    for (let i = 0; i < 230; i++) {
      const x = 2 + random() * 1020;
      const y = 2 + random() * 1020;
      const diameter = .42 + random() * .47;
      const brightness = .25 + random() * .43;
      // A single antialiased pinpoint. No halo, flare, sprite, or local particle.
      ctx.fillStyle = `rgba(215,229,235,${brightness})`;
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
}
