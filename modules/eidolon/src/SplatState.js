import { hash01 } from './utils.js';

/**
 * Immutable canonical splat data + mutable runtime buffers (typed arrays).
 */
export class SplatState {
  constructor() {
    this.count = 0;
    /** @type {Float32Array|null} */
    this.originalPosition = null;
    /** @type {Float32Array|null} */
    this.originalRotation = null;
    /** @type {Float32Array|null} */
    this.originalScale = null;
    /** @type {Float32Array|null} */
    this.originalOpacity = null;
    /** @type {Uint8Array|null} */
    this.originalColor = null;

    this.position = null;
    this.rotation = null;
    this.scale = null;
    this.opacity = null;
    this.velocity = null;
    this.randomSeed = null;
    this.normalizedRadius = null;

    this.modelCenter = [0, 0, 0];
    this.fitScale = 1;
    /** Indices to process when sampling < 100% */
    this.activeIndices = null;
  }

  /**
   * @param {Float32Array} centers length count*3, world space
   * @param {object} [extras]
   */
  initFromCenters(centers, extras = {}) {
    const n = centers.length / 3;
    this.count = n;
    this.originalPosition = new Float32Array(centers);
    this.position = new Float32Array(centers);
    this.velocity = new Float32Array(n * 3);
    this.randomSeed = new Float32Array(n);
    this.normalizedRadius = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      this.randomSeed[i] = hash01(i * 1.618 + 0.123) * 1000;
    }

    if (extras.rotations) {
      this.originalRotation = new Float32Array(extras.rotations);
      this.rotation = new Float32Array(extras.rotations);
    }
    if (extras.scales) {
      this.originalScale = new Float32Array(extras.scales);
      this.scale = new Float32Array(extras.scales);
    }
    if (extras.opacities) {
      this.originalOpacity = new Float32Array(extras.opacities);
      this.opacity = new Float32Array(extras.opacities);
    }
    if (extras.colors) {
      this.originalColor = new Uint8Array(extras.colors);
    }

    this._computeCenterAndRadii();
    this._applyCentering();
    this.setActiveSampling(100);
  }

  _computeCenterAndRadii() {
    const n = this.count;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < n; i++) {
      cx += this.originalPosition[i * 3];
      cy += this.originalPosition[i * 3 + 1];
      cz += this.originalPosition[i * 3 + 2];
    }
    cx /= n || 1;
    cy /= n || 1;
    cz /= n || 1;
    this.modelCenter = [cx, cy, cz];

    let maxR = 0;
    for (let i = 0; i < n; i++) {
      const dx = this.originalPosition[i * 3] - cx;
      const dy = this.originalPosition[i * 3 + 1] - cy;
      const dz = this.originalPosition[i * 3 + 2] - cz;
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r > maxR) maxR = r;
      this.normalizedRadius[i] = 0;
    }
    for (let i = 0; i < n; i++) {
      const dx = this.originalPosition[i * 3] - cx;
      const dy = this.originalPosition[i * 3 + 1] - cy;
      const dz = this.originalPosition[i * 3 + 2] - cz;
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      this.normalizedRadius[i] = maxR > 0 ? r / maxR : 0;
    }

    this.fitScale = maxR > 0 ? 1.8 / maxR : 1;
  }

  _applyCentering() {
    const [cx, cy, cz] = this.modelCenter;
    const s = this.fitScale;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      this.originalPosition[o] = (this.originalPosition[o] - cx) * s;
      this.originalPosition[o + 1] = (this.originalPosition[o + 1] - cy) * s;
      this.originalPosition[o + 2] = (this.originalPosition[o + 2] - cz) * s;
    }
    this.modelCenter = [0, 0, 0];
    this.position.set(this.originalPosition);
    this._computeCenterAndRadii();
  }

  /** @param {number} percent 1–100 */
  setActiveSampling(percent, maxCount = 0) {
    const n = this.count;
    let target = Math.floor((n * percent) / 100);
    if (maxCount > 0) target = Math.min(target, maxCount);
    target = Math.max(1, Math.min(n, target));

    if (target >= n) {
      this.activeIndices = null;
      return;
    }

    const stride = n / target;
    const indices = new Uint32Array(target);
    for (let j = 0; j < target; j++) {
      indices[j] = Math.min(n - 1, Math.floor(j * stride));
    }
    this.activeIndices = indices;
  }

  resetRuntime() {
    if (!this.originalPosition) return;
    this.position.set(this.originalPosition);
    if (this.velocity) this.velocity.fill(0);
    if (this.rotation && this.originalRotation) this.rotation.set(this.originalRotation);
    if (this.scale && this.originalScale) this.scale.set(this.originalScale);
    if (this.opacity && this.originalOpacity) this.opacity.set(this.originalOpacity);
  }

  dispose() {
    this.count = 0;
    this.originalPosition = null;
    this.position = null;
    this.activeIndices = null;
  }
}
