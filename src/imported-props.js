import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { modulePolygon } from './layout.js';

// Original CC0 Kenney meshes, downloaded from the author's official packs.
// Source archives, licenses, exact selected files and modifications are recorded
// in docs/ASSET-CREDITS.md. Nothing is fetched from an external host at runtime.
const ASSETS = {
  computer: ['kenney-space-station', 'computer'],
  monitor: ['kenney-space-station', 'computer-screen'],
  system: ['kenney-space-station', 'computer-system'],
  wideComputer: ['kenney-space-station', 'computer-wide'],
  wallDisplay: ['kenney-space-station', 'display-wall'],
  wideDisplay: ['kenney-space-station', 'display-wall-wide'],
  case: ['kenney-space-station', 'container'],
  flatCase: ['kenney-space-station', 'container-flat'],
  openCase: ['kenney-space-station', 'container-flat-open'],
  wideCase: ['kenney-space-station', 'container-wide'],
  tallCase: ['kenney-space-station', 'container-tall'],
  console: ['kenney-space', 'desk_computer'],
  cornerConsole: ['kenney-space', 'desk_computerCorner'],
  screenConsole: ['kenney-space', 'desk_computerScreen'],
  generator: ['kenney-space', 'machine_generator'],
  largeGenerator: ['kenney-space', 'machine_generatorLarge'],
  radio: ['kenney-space', 'machine_wireless'],
  battery: ['kenney-space', 'machine_barrel'],
  drum: ['kenney-space', 'barrel'],
};

/** Load once, normalize each authored model, then instance its original meshes. */
export async function addImportedProps(ctx) {
  const { MODULES, colliders, beginModule, endSection, resourceMaterials, resourceGeometries, resourceTextures } = ctx;
  const loader = new GLTFLoader();
  const materialCache = new Map(), prefabs = new Map(), batches = new Map();
  const types = {}, placements = [];
  let floorColliders = 0;

  function retainMaterial(material) {
    resourceMaterials?.add(material);
    for (const value of Object.values(material)) if (value?.isTexture) resourceTextures?.add(value);
  }
  function stationMaterial(original, pack) {
    retainMaterial(original);
    const key = `${pack}/${original.name}`;
    if (materialCache.has(key)) return materialCache.get(key);
    const material = original.clone();
    material.roughness = .48; material.metalness = .24;
    if (pack === 'kenney-space-station') {
      // Preserve the author's palette UVs and model surfaces. Orange display and
      // safety regions become Sentient instrument faces; structure becomes ivory.
      material.color.setHex(0xffffff);
      material.onBeforeCompile = shader => {
        shader.vertexShader = `varying vec3 vPropPosition;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPropPosition = position;');
        shader.fragmentShader = `varying vec3 vPropPosition;\n${shader.fragmentShader}`
          .replace('#include <map_fragment>', `#include <map_fragment>
            float propDisplay = step(diffuseColor.b * 1.65 + .01, diffuseColor.r) * step(diffuseColor.b * 1.35 + .01, diffuseColor.g);
            float propLum = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
            vec3 propHull = mix(vec3(.028,.043,.049),vec3(.85,.86,.79),smoothstep(.035,.68,propLum));
            float propLine = step(.78,fract((vPropPosition.y+.017)*29.0)) * step(.16,fract((vPropPosition.x+.31)*6.0));
            float propTick = step(.83,fract((vPropPosition.x+.023)*21.0)) * step(.79,fract((vPropPosition.y+.019)*16.0));
            float propInk = max(propLine,propTick);
            diffuseColor.rgb = mix(propHull,mix(vec3(.017,.047,.052),vec3(.67,.84,.19),propInk),propDisplay);
          `)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += propDisplay * propInk * vec3(.20,.29,.025);');
      };
      material.customProgramCacheKey = () => 'sentient-kenney-instrument-v1';
    } else {
      const name = original.name.toLowerCase();
      if (name.includes('red')) { material.color.setHex(0xbace43); material.emissive.setHex(0x273106); material.emissiveIntensity = .18; }
      else if (name === 'dark') material.color.setHex(0x1b2b31);
      else if (name.includes('dark')) material.color.setHex(0x5b6c72);
      else material.color.setHex(0xe1e3d9);
    }
    retainMaterial(material); materialCache.set(key, material); return material;
  }

  await Promise.all(Object.entries(ASSETS).map(async ([type, [pack, file]]) => {
    const source = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${pack}/${file}.glb`);
    source.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(source.scene);
    const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    const normalize = new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z);
    const parts = [];
    source.scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      resourceGeometries?.add(mesh.geometry);
      const material = Array.isArray(mesh.material) ? mesh.material.map(m => stationMaterial(m, pack)) : stationMaterial(mesh.material, pack);
      parts.push({ geometry: mesh.geometry, material, transform: normalize.clone().multiply(mesh.matrixWorld) });
    });
    prefabs.set(type, { size, parts });
  }));

  function place(module, parent, type, x, z, width, yaw = 0, y = .04, floor = true, label = '') {
    const prefab = prefabs.get(type), scale = width / prefab.size.x;
    const worldX = module.x + x, worldZ = module.z + z;
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(worldX, y, worldZ), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
    for (const part of prefab.parts) {
      const materialKey = Array.isArray(part.material) ? part.material.map(m => m.uuid).join(':') : part.material.uuid;
      const key = `${parent.uuid}/${part.geometry.uuid}/${materialKey}`;
      if (!batches.has(key)) batches.set(key, { parent, ...part, matrices: [] });
      batches.get(key).matrices.push(transform.clone().multiply(part.transform));
    }
    const depth = prefab.size.z * scale;
    const extentX = Math.abs(Math.cos(yaw)) * width + Math.abs(Math.sin(yaw)) * depth;
    const extentZ = Math.abs(Math.sin(yaw)) * width + Math.abs(Math.cos(yaw)) * depth;
    if (floor && y > .18) {
      // Raised computers need real structural support. These cabinets stay
      // strictly inside the already registered equipment footprint.
      const { enamel, graphite, silver } = ctx.materials;
      const cabinetHeight = y - .065;
      ctx.box(worldX, cabinetHeight / 2 + .025, worldZ, width * .78, cabinetHeight, depth * .78, enamel, yaw);
      ctx.box(worldX, .037, worldZ, width * .96, .065, depth * .96, graphite, yaw);
      ctx.box(worldX, y - .015, worldZ, width * .98, .03, depth * .98, graphite, yaw);
      const frontX = worldX + Math.sin(yaw) * depth * .397;
      const frontZ = worldZ + Math.cos(yaw) * depth * .397;
      ctx.box(frontX, Math.max(.13, y * .59), frontZ, width * .53, .028, .018, silver, yaw);
      for (let vent = 0; vent < 3; vent++) ctx.box(frontX, .13 + vent * .055, frontZ, width * .56, .018, .015, graphite, yaw);
    }
    if (floor) {
      colliders.push({ id: `imported-${module.id}-${placements.length}`, x: worldX, z: worldZ, w: extentX, d: extentZ });
      floorColliders++;
    }
    types[type] = (types[type] || 0) + 1;
    placements.push({ room: module.id, type, x: worldX, z: worldZ, y, w: extentX, d: extentZ, h: prefab.size.y * scale, floor, label });
  }

  function upperDisplay(module, parent, type, facetIndex, width, tangent = 0, y = 2.04) {
    const polygon = modulePolygon(module), a = polygon[facetIndex], b = polygon[(facetIndex + 1) % 8];
    const yaw = -Math.atan2(b.z - a.z, b.x - a.x), c = Math.cos(yaw), s = Math.sin(yaw);
    const prefab = prefabs.get(type), depth = prefab.size.z * width / prefab.size.x;
    const forward = depth / 2 + .18;
    const x = (a.x + b.x) / 2 + tangent * c + forward * s - module.x;
    const z = (a.z + b.z) / 2 - tangent * s + forward * c - module.z;
    // Wall fixtures sit above the player's body; they require no floor blocker.
    place(module, parent, type, x, z, width, yaw, y, false, 'Overhead instrument display');
  }

  for (const module of MODULES) {
    const parent = beginModule(module), id = module.id;
    const p = (type, x, z, width, yaw = 0, y = .04, floor = true, label = '') => place(module, parent, type, x, z, width, yaw, y, floor, label);
    if (id === 'front-door') {
      p('case', -.67, module.hz - .57, .68, 0, .04, true, 'Arrival cargo case');
      p('wideCase', .68, module.hz - .57, .62, 0, .04, true, 'Transit supply case');
      p('computer', -module.hx + .46, .10, .58, Math.PI / 2, .88, true, 'Dock communications computer');
      p('radio', -module.hx + .48, 1.04, .58, Math.PI / 2, .12, true, 'Radio transceiver');
      p('wallDisplay', module.hx - .24, .2, .47, -Math.PI / 2, 1.88, false);
      upperDisplay(module, parent, 'wideDisplay', 3, .46, 0, 2.12);
    } else if (id === 'archive') {
      p('screenConsole', module.hx - .42, -.28, .83, -Math.PI / 2, .06, true, 'Archive index computer');
      p('tallCase', module.hx - .44, 1.02, .48, -Math.PI / 2, .05, true, 'Memory cartridge vault');
      p('system', module.hx - .43, -1.53, .58, -Math.PI / 2, .86, true, 'Evidence processing unit');
      upperDisplay(module, parent, 'wallDisplay', 3, .39, 0, 2.11);
      upperDisplay(module, parent, 'wideDisplay', 5, .47, 0, 2.12);
    } else if (id === 'floor') {
      p('largeGenerator', -module.hx + .73, -.33, .97, Math.PI / 2, .05, true, 'Production power unit');
      p('generator', -module.hx + .64, .97, .82, Math.PI / 2, .06, true, 'Instrument power supply');
      p('wideComputer', -.64, module.hz - .59, .95, Math.PI, .75, true, 'Production editing console');
      p('monitor', .66, module.hz - .48, .84, Math.PI, .78, true, 'Render status monitor');
      p('openCase', 1.85, module.hz - .54, .53, Math.PI / 2, .05, true, 'Production tool case');
      upperDisplay(module, parent, 'wideDisplay', 5, .48, 0, 2.10);
    } else if (id === 'lab') {
      p('battery', -.72, -module.hz + .64, .63, 0, .08, true, 'Analyzer battery assembly');
      p('generator', .30, -module.hz + .64, .69, 0, .08, true, 'Sample analyzer drive');
      p('monitor', -module.hx + .40, 1.13, .64, Math.PI / 2, .81, true, 'Experiment readout');
      p('flatCase', -module.hx + .52, .1, .55, Math.PI / 2, .04, true, 'Sealed sample case');
      upperDisplay(module, parent, 'wallDisplay', 3, .44, -.34, 2.11);
      upperDisplay(module, parent, 'wallDisplay', 3, .44, .34, 2.11);
    } else if (id === 'commons') {
      p('console', module.hx - .44, -.72, 1.08, -Math.PI / 2, .07, true, 'Shared account console');
      p('computer', module.hx - .43, .67, .59, -Math.PI / 2, .82, true, 'Community communications');
      p('battery', -1.04, module.hz - .52, .59, Math.PI, .07, true, 'Life support reserve');
      p('drum', .0, module.hz - .48, .54, Math.PI, .07, true, 'Resource cartridge');
      p('openCase', 1.15, module.hz - .60, .54, Math.PI / 2, .04, true, 'Shared equipment stowage');
      upperDisplay(module, parent, 'wideDisplay', 3, .50, 0, 2.11);
    } else if (id === 'forum') {
      // Four-way traffic keeps the Forum floor empty. Imported consoles are
      // secured above the peripheral panels rather than placed in the aisles.
      upperDisplay(module, parent, 'wideDisplay', 3, .44, -.33, 2.11);
      upperDisplay(module, parent, 'wideDisplay', 3, .44, .33, 2.11);
      upperDisplay(module, parent, 'wideDisplay', 5, .44, -.33, 2.11);
      upperDisplay(module, parent, 'wideDisplay', 5, .44, .33, 2.11);
      p('radio', module.hx - .68, module.hz - .88, .30, -Math.PI * .75, 2.16, false, 'Strategy communications array');
    } else if (id === 'bridge') {
      // Low front console bank preserves the tall observation-window sightline.
      for (const x of [-1.35, 0, 1.35]) p('wideComputer', x, -module.hz + .70, 1.10, 0, .62, true, 'Forward flight console');
      for (const z of [-1.15, .65]) {
        p('screenConsole', module.hx - .53, z, 1.22, -Math.PI / 2, .06, true, 'Orbital tracking station');
        p('console', -module.hx + .56, z, 1.27, Math.PI / 2, .06, true, 'Campaign command station');
      }
      p('cornerConsole', -2.53, -module.hz + 1.31, .93, Math.PI / 4, .05, true, 'Port command console');
      p('cornerConsole', 2.53, -module.hz + 1.31, .93, -Math.PI / 4, .05, true, 'Starboard command console');
      p('system', -module.hx + .61, 2.26, .82, Math.PI / 2, .40, true, 'Telemetry computer');
      p('radio', module.hx - .66, -2.48, .53, -Math.PI / 2, 1.95, false, 'Star tracking receiver');
      upperDisplay(module, parent, 'wideDisplay', 5, .52, -.57, 2.13);
      upperDisplay(module, parent, 'wideDisplay', 5, .52, .57, 2.13);
    }
    endSection();
  }

  let drawBatches = 0;
  for (const { parent, geometry, material, matrices } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.name = 'Imported Kenney CC0 equipment';
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); drawBatches++;
  }
  return { modelsLoaded: prefabs.size, instances: placements.length, types, drawBatches, floorColliders, placements };
}
