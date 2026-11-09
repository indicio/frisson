/**
 * Lightweight spring physics on splat positions.
 */
export class PhysicsEngine {
  /**
   * @param {import('./SplatState.js').SplatState} state
   * @param {object} params
   * @param {number} dt
   */
  step(state, params, dt) {
    if (!params.physicsEnabled || !state.velocity || params.frozen) return;

    const n = state.count;
    const drag = params.physicsDrag;
    const home = params.homeAttraction;
    const maxV = params.maxVelocity;
    const forceMul = params.physicsForce;
    const turb = params.physicsTurbulence;

    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const tx = state.position[o];
      const ty = state.position[o + 1];
      const tz = state.position[o + 2];
      const ox = state.originalPosition[o];
      const oy = state.originalPosition[o + 1];
      const oz = state.originalPosition[o + 2];

      let fx = (ox - tx) * home;
      let fy = (oy - ty) * home;
      let fz = (oz - tz) * home;

      if (turb > 0) {
        fx += (Math.random() - 0.5) * turb * 0.02;
        fy += (Math.random() - 0.5) * turb * 0.02;
        fz += (Math.random() - 0.5) * turb * 0.02;
      }

      state.velocity[o] = (state.velocity[o] + fx * forceMul * dt) * drag;
      state.velocity[o + 1] = (state.velocity[o + 1] + fy * forceMul * dt) * drag;
      state.velocity[o + 2] = (state.velocity[o + 2] + fz * forceMul * dt) * drag;

      const vlen = Math.sqrt(
        state.velocity[o] ** 2 + state.velocity[o + 1] ** 2 + state.velocity[o + 2] ** 2
      );
      if (vlen > maxV) {
        const s = maxV / vlen;
        state.velocity[o] *= s;
        state.velocity[o + 1] *= s;
        state.velocity[o + 2] *= s;
      }

      state.position[o] += state.velocity[o];
      state.position[o + 1] += state.velocity[o + 1];
      state.position[o + 2] += state.velocity[o + 2];
    }
  }
}
