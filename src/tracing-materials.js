import * as THREE from 'three';

/** Owned, frozen material equivalents for a separate path-traced scene snapshot. */
export function createTracingMaterials(renderer) {
  const cache = new Map(), materials = new Set(), textures = new Set(), targets = new Set();
  const paletteCache = new Map();
  let disposed = false;
  const linear = x => x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
  const srgb = x => x <= .0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - .055;
  const byte = x => Math.round(255 * Math.max(0, Math.min(1, srgb(x))));

  function own(material, original) {
    material.name = `${original.name || original.type} / frozen tracing`;
    materials.add(material); cache.set(original, material); return material;
  }
  function common(original) {
    return {
      color: original.color?.clone() || new THREE.Color(0xffffff),
      map: original.map || null, alphaMap: original.alphaMap || null,
      transparent: !!original.transparent, opacity: original.opacity ?? 1,
      alphaTest: original.alphaTest || 0, side: original.side ?? THREE.FrontSide,
      vertexColors: !!original.vertexColors, depthWrite: original.depthWrite !== false,
      depthTest: original.depthTest !== false, visible: original.visible !== false,
      polygonOffset: !!original.polygonOffset,
      polygonOffsetFactor: original.polygonOffsetFactor || 0,
      polygonOffsetUnits: original.polygonOffsetUnits || 0,
    };
  }
  function sampler(texture, source) {
    texture.colorSpace = THREE.SRGBColorSpace;
    if (source) {
      for (const key of ['wrapS', 'wrapT', 'magFilter', 'minFilter', 'anisotropy', 'flipY', 'channel', 'generateMipmaps', 'matrixAutoUpdate']) texture[key] = source[key];
      texture.offset.copy(source.offset); texture.repeat.copy(source.repeat);
      texture.center.copy(source.center); texture.rotation = source.rotation;
      texture.matrix.copy(source.matrix);
    }
    texture.needsUpdate = true; textures.add(texture); return texture;
  }

  // The realtime Kenney palette is applied after map decoding, in linear RGB.
  // Bake that same hull remap; orange equipment faces become subdued lime. Their
  // object-space micro-lines are deliberately omitted from this texture snapshot.
  function stationPalette(original) {
    const source = original.map, tint = original.color || new THREE.Color(0xffffff);
    const key = `${source?.uuid || 'solid'}:${tint.r},${tint.g},${tint.b}`;
    if (paletteCache.has(key)) return paletteCache.get(key);
    const image = source?.image;
    const width = image?.width || image?.naturalWidth || 1, height = image?.height || image?.naturalHeight || 1;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Cannot bake the station equipment palette without a 2D canvas.');
    if (image?.data) {
      const data = context.createImageData(width, height), channels = image.data.length / (width * height);
      for (let i = 0; i < width * height; i++) {
        for (let c = 0; c < 3; c++) data.data[i * 4 + c] = image.data[i * channels + c];
        data.data[i * 4 + 3] = channels === 4 ? image.data[i * channels + 3] : 255;
      }
      context.putImageData(data, 0, 0);
    } else if (image) context.drawImage(image, 0, 0, width, height);
    else { context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); }
    const diffuse = context.getImageData(0, 0, width, height);
    const emission = context.createImageData(width, height);
    const decode = source?.colorSpace === THREE.SRGBColorSpace ? linear : x => x;
    for (let i = 0; i < diffuse.data.length; i += 4) {
      const r = decode(diffuse.data[i] / 255) * tint.r;
      const g = decode(diffuse.data[i + 1] / 255) * tint.g;
      const b = decode(diffuse.data[i + 2] / 255) * tint.b;
      const display = r >= b * 1.65 + .01 && g >= b * 1.35 + .01;
      const luminance = r * .2126 + g * .7152 + b * .0722;
      const t = THREE.MathUtils.clamp((luminance - .035) / (.68 - .035), 0, 1), smooth = t * t * (3 - 2 * t);
      const color = display ? [.40, .53, .055] : [.028 + (.85 - .028) * smooth, .043 + (.86 - .043) * smooth, .049 + (.79 - .049) * smooth];
      for (let c = 0; c < 3; c++) {
        diffuse.data[i + c] = byte(color[c]);
        emission.data[i + c] = display ? byte([.055, .075, .005][c]) : 0;
      }
      emission.data[i + 3] = diffuse.data[i + 3];
    }
    context.putImageData(diffuse, 0, 0);
    const emissionCanvas = document.createElement('canvas'); emissionCanvas.width = width; emissionCanvas.height = height;
    emissionCanvas.getContext('2d').putImageData(emission, 0, 0);
    const result = { map: sampler(new THREE.CanvasTexture(canvas), source), emissiveMap: sampler(new THREE.CanvasTexture(emissionCanvas), source) };
    paletteCache.set(key, result); return result;
  }

  function bakeStar(original) {
    // SphereGeometry uses x=-cos(phi)*sin(theta), z=sin(phi)*sin(theta)
    // and uv.y=1-theta/pi. Bake in those UVs, preserving the frozen time uniform.
    // View-facing terms are unity: the map represents emitted surface radiance,
    // without baking one camera's silhouette shading into the opposite hemisphere.
    let fragmentShader = original.fragmentShader
      .replace(/varying\s+vec3\s+(vSurface|vViewNormal|vViewDirection)\s*;/g, '')
      .replace(/#include\s*<tonemapping_fragment>/g, '')
      .replace(/#include\s*<colorspace_fragment>/g, '')
      .replace(/void\s+main\s*\(\s*\)\s*\{/, `void main() {
        float phi = bakeUv.x * 6.283185307179586;
        float theta = (1.0 - bakeUv.y) * 3.141592653589793;
        vec3 vSurface = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
        vec3 vViewNormal = vSurface;
        vec3 vViewDirection = vSurface;
      `);
    fragmentShader = `varying vec2 bakeUv;\n${fragmentShader}`;
    const target = new THREE.WebGLRenderTarget(1024, 512, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace, minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false,
    });
    target.texture.name = 'Frozen Sol Sentient radiance';
    target.texture.wrapS = THREE.RepeatWrapping;
    target.texture.generateMipmaps = false;
    const uniforms = Object.fromEntries(Object.entries(original.uniforms).map(([name, uniform]) => [name, { value: uniform.value?.clone && !uniform.value.isTexture ? uniform.value.clone() : uniform.value }]));
    const material = new THREE.ShaderMaterial({
      uniforms, fragmentShader,
      vertexShader: 'varying vec2 bakeUv; void main() { bakeUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2), scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.Camera();
    const state = {
      target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(), level: renderer.getActiveMipmapLevel(),
      viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()), scissorTest: renderer.getScissorTest(),
      clearColor: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
      autoClear: renderer.autoClear, toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure,
      outputColorSpace: renderer.outputColorSpace, xr: renderer.xr.enabled,
    };
    let rendered = false;
    try {
      renderer.xr.enabled = false; renderer.autoClear = true;
      renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.setRenderTarget(target); renderer.setViewport(0, 0, 1024, 512);
      renderer.setScissorTest(false); renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera); rendered = true;
    } finally {
      renderer.setRenderTarget(state.target, state.face, state.level);
      renderer.setViewport(state.viewport); renderer.setScissor(state.scissor); renderer.setScissorTest(state.scissorTest);
      renderer.setClearColor(state.clearColor, state.clearAlpha);
      renderer.autoClear = state.autoClear; renderer.toneMapping = state.toneMapping;
      renderer.toneMappingExposure = state.exposure; renderer.outputColorSpace = state.outputColorSpace; renderer.xr.enabled = state.xr;
      geometry.dispose(); material.dispose();
      if (!rendered) target.dispose();
    }
    targets.add(target);
    return target.texture;
  }

  function convert(original) {
    if (disposed) throw new Error('The tracing material snapshot has been disposed.');
    if (Array.isArray(original)) return original.map(convert);
    if (!original?.isMaterial) throw new TypeError('Expected a Three.js material.');
    if (cache.has(original)) return cache.get(original);
    // Shader surfaces may name a simpler stand-in for the path tracer.
    if (original.userData?.traceMaterial) { const material = convert(original.userData.traceMaterial); cache.set(original, material); return material; }
    if (original.isMeshStandardMaterial || original.isMeshPhysicalMaterial) {
      const material = original.clone();
      if (original.customProgramCacheKey?.() === 'sentient-kenney-instrument-v1') {
        const baked = stationPalette(original);
        material.color.setRGB(1, 1, 1); material.map = baked.map;
        material.emissive.setRGB(1, 1, 1); material.emissiveIntensity = 1; material.emissiveMap = baked.emissiveMap;
      }
      return own(material, original);
    }
    if (original.isShaderMaterial && /vSurface/.test(original.fragmentShader) && /turbulence/.test(original.fragmentShader)) {
      const map = bakeStar(original);
      return own(new THREE.MeshStandardMaterial({ ...common(original), color: 0x000000, map: null, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 1, roughness: 1, metalness: 0 }), original);
    }
    const material = new THREE.MeshStandardMaterial({ ...common(original), roughness: .72, metalness: 0 });
    if ((original.isMeshBasicMaterial || original.isSpriteMaterial) && original.toneMapped === false) {
      material.emissive.copy(original.color || new THREE.Color(0xffffff));
      material.emissiveMap = original.map || null; material.emissiveIntensity = 1;
    } else if (original.isShaderMaterial) {
      const color = original.uniforms?.color?.value || original.uniforms?.diffuse?.value;
      if (color?.isColor) material.color.copy(color);
      else material.color.setHex(0x81928b);
    }
    return own(material, original);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    targets.forEach(target => target.dispose());
    materials.clear(); textures.clear(); targets.clear(); cache.clear(); paletteCache.clear();
  }
  return { convert, dispose };
}
