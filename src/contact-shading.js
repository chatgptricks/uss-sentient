import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

/** Contact shading for solid station equipment, excluding glass and overlays. */
export class StationSSAOPass extends SSAOPass {
  constructor(scene, camera, width = 512, height = 512, kernelSize = 32) {
    super(scene, camera, width, height, kernelSize);
    this.kernelRadius = .28;
    // Three's SSAO shader compares normalized linear depth, not world metres.
    const depthRange = camera.far - camera.near;
    this.minDistance = .004 / depthRange;
    this.maxDistance = .45 / depthRange;
    this._stationVisibilityCache = [];
  }

  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverse(object => {
      if (!object.visible) return;
      const materials = object.isMesh
        ? (Array.isArray(object.material) ? object.material : [object.material])
        : [];
      // Mixed-material equipment retains its opaque surfaces in the AO pass.
      const faintTransparentMesh = materials.length > 0
        && materials.every(material => material?.transparent && material.opacity < .5);
      if (object.userData.excludeFromAO || object.isSprite || faintTransparentMesh) {
        this._stationVisibilityCache.push(object);
        object.visible = false;
      }
    });
  }

  _restoreVisibility() {
    super._restoreVisibility();
    for (const object of this._stationVisibilityCache) object.visible = true;
    this._stationVisibilityCache.length = 0;
  }

  _renderOverride(renderer, ...args) {
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const overrideMaterial = this.scene.overrideMaterial;
    // RenderPass has already refreshed any dirty shadows for this frame.
    // The normal/depth pass must not render those shadow maps a second time.
    renderer.shadowMap.autoUpdate = false;
    try {
      return super._renderOverride(renderer, ...args);
    } finally {
      renderer.shadowMap.autoUpdate = shadowAutoUpdate;
      this.scene.overrideMaterial = overrideMaterial;
    }
  }

  render(renderer, ...args) {
    try {
      return super.render(renderer, ...args);
    } finally {
      // Also recover visibility if rendering aborts before Three restores it.
      this._restoreVisibility();
    }
  }
}
