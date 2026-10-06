import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { CubeToEquirectGenerator } from 'three-gpu-pathtracer/src/utils/CubeToEquirectGenerator.js';
import { GenerateMeshBVHWorker } from 'three-mesh-bvh/worker';
import { createTracingMaterials } from './tracing-materials.js';

// Path tracing is deliberately isolated from the moving game. The snapshot owns
// its materials; it shares read-only geometry and never moves a live hatch.
export async function createRaytracedView({ renderer, scene, camera, signal, onStatus, rasterize }) {
  if (!renderer.extensions.has('EXT_color_buffer_float')) {
    throw new Error('This browser cannot render floating-point ray-traced images.');
  }
  const aborted = () => { if (signal.aborted) throw new DOMException('View cancelled', 'AbortError'); };
  const savedRenderer = {
    target:renderer.getRenderTarget(), face:renderer.getActiveCubeFace(), level:renderer.getActiveMipmapLevel(),
    viewport:renderer.getViewport(new THREE.Vector4()), scissor:renderer.getScissor(new THREE.Vector4()),
    scissorTest:renderer.getScissorTest(), autoClear:renderer.autoClear,
    clearColor:renderer.getClearColor(new THREE.Color()), clearAlpha:renderer.getClearAlpha(),
  };
  const snapshot = new THREE.Scene();
  snapshot.background = scene.background;
  // RoomEnvironment's PMREM is an encoded render target, not an HDR input.
  // Window sunlight, physical fixtures and emissive panels supply the lighting.
  snapshot.environment = null;
  const frozenCamera = camera.clone();
  frozenCamera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  const materials = createTracingMaterials(renderer);
  let worker, tracer, generatedGeometry, ownedBackground, released = false;
  const counts = { meshes: 0, instances: 0, triangles: 0, lights: 0 };
  const matrix = new THREE.Matrix4(), worldMatrix = new THREE.Matrix4();
  const shaderErrorHandler = renderer.debug.onShaderError;
  let shaderFailure = false;
  const abortPromise = new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('View cancelled', 'AbortError')), { once: true });
  });
  // The listener can fire after a successful build; mark rejection handled then.
  abortPromise.catch(() => {});
  function dispose() {
    if (released) return;
    released = true;
    worker?.dispose();
    if (tracer) {
      // v0.0.24's public dispose omits its secondary target and background.
      // The pinned library leaves shader uniforms/texture arrays to its caller.
      const ownedMaterials = new Set([tracer._pathTracer.material, tracer._lowResPathTracer.material]);
      for (const material of ownedMaterials) {
        for (const {value} of Object.values(material.uniforms)) {
          if (value?.renderTarget) { value.renderTarget.fsQuad?.material.dispose(); value.renderTarget.dispose(); }
          else value?.dispose?.();
          value?.tex?.dispose();
        }
        material.dispose();
      }
      tracer._pathTracer._blendQuad.material.dispose();
      tracer._lowResPathTracer._blendQuad.material.dispose();
      tracer.dispose();
      tracer._lowResPathTracer.dispose();
      tracer._internalBackground?.dispose();
      tracer._colorBackground?.dispose();
    }
    (generatedGeometry || tracer?._generator.geometry)?.dispose();
    materials.dispose();
    ownedBackground?.dispose();
    snapshot.clear();
    renderer.debug.onShaderError = shaderErrorHandler;
    renderer.setRenderTarget(savedRenderer.target,savedRenderer.face,savedRenderer.level);
    renderer.setViewport(savedRenderer.viewport); renderer.setScissor(savedRenderer.scissor);
    renderer.setScissorTest(savedRenderer.scissorTest); renderer.autoClear=savedRenderer.autoClear;
    renderer.setClearColor(savedRenderer.clearColor,savedRenderer.clearAlpha);
  }
  try {
    onStatus('Preparing station geometry');
    if (scene.background?.isCubeTexture) {
      // Avoid the library's implicit 4K conversion and large readback on every
      // entry. This background is only distant pinpoints, not image-based light.
      const generator = new CubeToEquirectGenerator(renderer);
      try {
        ownedBackground = generator.generate(scene.background,1024,512);
        snapshot.background = ownedBackground;
      } finally { generator._quad.material.dispose(); generator.dispose(); }
    }
    const objects = [];
    // Custom-shader overlays (the deck guide light) have no physical material.
    scene.traverseVisible(object => { if ((object.isMesh && !object.material?.isShaderMaterial) || object.isLight) objects.push(object); });
    for (let index = 0; index < objects.length; index++) {
      aborted();
      const object = objects[index];
      if (object.isMesh) {
        const material = Array.isArray(object.material) ? object.material.map(materials.convert) : materials.convert(object.material);
        const total = object.isInstancedMesh ? object.count : 1;
        const triangleCount = (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
        for (let i = 0; i < total; i++) {
          const mesh = new THREE.Mesh(object.geometry, material);
          mesh.matrixAutoUpdate = false;
          if (object.isInstancedMesh) {
            object.getMatrixAt(i, matrix);
            worldMatrix.multiplyMatrices(object.matrixWorld, matrix);
            mesh.matrix.copy(worldMatrix);
            counts.instances++;
          } else mesh.matrix.copy(object.matrixWorld);
          snapshot.add(mesh); counts.meshes++; counts.triangles += triangleCount;
        }
      } else if (object.isSpotLight || object.isDirectionalLight || object.isRectAreaLight || object.isPointLight) {
        const light = object.clone();
        object.matrixWorld.decompose(light.position, light.quaternion, light.scale);
        light.castShadow = false; // The tracer tests rays against the real hull.
        if (object.target) {
          light.target = new THREE.Object3D();
          object.target.getWorldPosition(light.target.position);
          snapshot.add(light.target);
        }
        // Performance gameplay disables solar shadow maps, not the actual star.
        if (object.name.startsWith('Sol Sentient')) light.intensity = 2.5;
        snapshot.add(light); counts.lights++;
      }
      if (index % 100 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    aborted();
    renderer.debug.onShaderError = (...args) => {
      shaderFailure = true;
      shaderErrorHandler?.(...args);
    };
    tracer = new WebGLPathTracer(renderer);
    tracer.bounces = 5;
    tracer.transmissiveBounces = 6;
    tracer.filterGlossyFactor = .5;
    tracer.tiles.set(3, 3);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    tracer.renderScale = Math.min(.75, Math.sqrt(600000 / (size.x * size.y)));
    tracer.textureSize.set(512, 512);
    tracer.minSamples = 1;
    tracer.renderDelay = 0;
    tracer.fadeDuration = 250;
    tracer.rasterizeSceneCallback = rasterize;
    worker = new GenerateMeshBVHWorker();
    worker.generate = function(geometry, options) {
      this.running = true;
      return this.runTask(this.worker, geometry, options).then(
        result => { this.running = false; return result; },
        error => { this.running = false; throw error; },
      );
    };
    tracer.setBVHWorker(worker);
    onStatus('Building light paths');
    const result = await Promise.race([
      tracer.setSceneAsync(snapshot, frozenCamera, { onProgress: progress => {
        if (!signal.aborted) onStatus(`Building light paths · ${Math.round(progress * 100)}%`);
      } }),
      abortPromise,
    ]);
    generatedGeometry = result.geometry;
    aborted();
    onStatus('Compiling ray tracer');
    return {
      render() {
        if (released) return;
        if (shaderFailure) throw new Error('The ray-tracing shader is not supported by this graphics driver.');
        tracer.renderSample();
      },
      stats: () => ({ ...counts, samples: +tracer.samples.toFixed(2), compiling: tracer.isCompiling, resolutionScale: tracer.renderScale, bounces: tracer.bounces }),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
