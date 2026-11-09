import * as THREE from 'three';

/**
 * Orbit camera around model target.
 */
export class CameraController {
  /**
   * @param {THREE.PerspectiveCamera} camera
   */
  constructor(camera) {
    this.camera = camera;
    this._angle = 0;
    this._elevation = 0.25;
  }

  /**
   * @param {object} params
   * @param {number} time
   * @param {number} dt
   * @param {object} [audioState]
   */
  update(params, time, dt, audioState = {}) {
    const cam = this.camera;
    cam.fov = params.fov;
    cam.updateProjectionMatrix();

    if (params.autoOrbit) {
      const speed = params.orbitSpeed * (1 + (audioState.mid ?? 0) * 0.15);
      this._angle += speed * dt;
    }

    this._elevation = params.elevation;

    const dist = params.cameraDistance * (1 - (audioState.bass ?? 0) * 0.08);
    const radius = params.orbitRadius * dist;
    const ax = params.orbitAxis === 'x' ? 1 : 0;
    const az = params.orbitAxis === 'z' ? 1 : 0;
    const ay = params.orbitAxis === 'y' ? 1 : 0;

    let ox = Math.cos(this._angle) * radius;
    let oy = Math.sin(this._elevation) * dist * 0.5;
    let oz = Math.sin(this._angle) * radius;

    if (ax) {
      oy = Math.cos(this._angle) * radius;
      oz = Math.sin(this._angle) * radius;
      ox = 0;
    } else if (az) {
      ox = Math.cos(this._angle) * radius;
      oy = Math.sin(this._angle) * radius;
      oz = 0;
    }

    const tx = params.targetX;
    const ty = params.targetY;
    const tz = params.targetZ;

    const shake = (audioState.treble ?? 0) * 0.02;
    cam.position.set(
      tx + ox + (Math.random() - 0.5) * shake,
      ty + oy + (Math.random() - 0.5) * shake,
      tz + oz + (Math.random() - 0.5) * shake
    );
    cam.lookAt(tx, ty, tz);
  }
}

export { THREE };
