import * as THREE from 'three';
import { GaussianSplats3D } from './SplatLoader.js';

/**
 * WebGL viewport + Gaussian splat drop-in renderer.
 */
export class SplatRenderer {
  constructor() {
    /** @type {HTMLElement|null} */
    this.container = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.dropIn = null;
    this.clock = new THREE.Clock();
    this._resizeObserver = null;
  }

  /**
   * @param {HTMLElement} container
   */
  init(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 500);
    this.camera.position.set(0, 0.5, 4);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.dropIn = new GaussianSplats3D.DropInViewer({
      dynamicScene: true,
      freeIntermediateSplatData: false,
      gpuAcceleratedSort: true,
      integerBasedSort: true,
      sharedMemoryForWorkers: false,
    });
    this.scene.add(this.dropIn);

    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    this._onResize = onResize;
    this.resize();
  }

  resize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const scale = 1;
    const w = Math.floor((this.container.clientWidth || window.innerWidth) * scale);
    const h = Math.floor((this.container.clientHeight || window.innerHeight) * scale);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /**
   * @param {import('../../../shared/libs/gaussian-splats-3d/gaussian-splats-3d.module.js').SplatBuffer} splatBuffer
   */
  async loadSplatBuffer(splatBuffer) {
    const viewer = this.dropIn.viewer;
    const replace = viewer.splatMesh != null;
    await viewer.addSplatBuffers(
      [splatBuffer],
      [{ position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }],
      true,
      false,
      false,
      replace
    );
  }

  /**
   * Push deformed positions to GPU splat buffers.
   * @param {Float32Array} positions length count*3
   */
  uploadPositions(positions) {
    const mesh = this.dropIn?.viewer?.splatMesh;
    if (!mesh?.splatDataTextures?.baseData?.centers) return;
    const count = mesh.getSplatCount();
    const centers = mesh.splatDataTextures.baseData.centers;
    const len = Math.min(centers.length, positions.length);
    centers.set(positions.subarray(0, len));
    mesh.updateDataTexturesFromBaseData(0, count - 1);
    this.dropIn.viewer.runSplatSort?.(true, false);
  }

  /**
   * @param {THREE.PerspectiveCamera} camera
   */
  render(camera) {
    const cam = camera || this.camera;
    this.dropIn.viewer.update(this.renderer, cam);
    this.renderer.render(this.scene, cam);
  }

  setRenderScale(scale) {
    if (!this.renderer || !this.container) return;
    const w = Math.floor((this.container.clientWidth || window.innerWidth) * scale);
    const h = Math.floor((this.container.clientHeight || window.innerHeight) * scale);
    this.renderer.setSize(w, h, false);
  }

  dispose() {
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this.dropIn?.viewer?.dispose?.();
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.container = null;
  }
}

export { THREE };
