import { stackDeformations, splatReconstructionFactor, mixPosition } from './deformations/operators.js';
import { applyEasing } from './utils.js';

/**
 * Applies deformation operators + reconstruction mix to splat state.
 */
export class DeformationEngine {
  /**
   * @param {import('./SplatState.js').SplatState} state
   * @param {object} params
   * @param {object} audioState
   * @param {number} time
   * @param {number} impulse
   */
  update(state, params, audioState, time, impulse = 0) {
    if (!state.originalPosition || params.frozen) return;

    const n = state.count;
    const [cx, cy, cz] = state.modelCenter;
    const reconGlobal = applyEasing(params.reconstructionEasing, params.reconstruction);

    const indices = state.activeIndices;

    const applySplat = (i) => {
      const o = i * 3;
      const ox = state.originalPosition[o];
      const oy = state.originalPosition[o + 1];
      const oz = state.originalPosition[o + 2];

      const depth = params.audioDepth;
      const nr = state.normalizedRadius[i];
      const audioWeight = nr >= 1 - depth ? 1 : Math.max(0, (nr - (1 - depth)) / depth);

      const p = { ...params };
      if (impulse > 0) {
        p.explosionAmount = Math.min(1, p.explosionAmount + impulse * p.bassImpactStrength);
      }

      const ctx = {
        ox,
        oy,
        oz,
        cx,
        cy,
        cz,
        normRadius: nr,
        seed: state.randomSeed[i],
        time,
        params: p,
        audioWeight,
      };

      const [ex, ey, ez] = stackDeformations(ctx);
      let recon = splatReconstructionFactor(reconGlobal, params.reconstructionStyle, nr, state.randomSeed[i], time);
      recon *= params.reconstructionSpread;
      recon = Math.min(1, recon);

      const [px, py, pz] = mixPosition(ox, oy, oz, ox + ex, oy + ey, oz + ez, recon);
      state.position[o] = px;
      state.position[o + 1] = py;
      state.position[o + 2] = pz;
    };

    if (indices) {
      state.position.set(state.originalPosition);
      for (let j = 0; j < indices.length; j++) applySplat(indices[j]);
    } else {
      for (let i = 0; i < n; i++) applySplat(i);
    }
  }
}
