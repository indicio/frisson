import { clamp } from './utils.js';

/**
 * Maps audio bands onto visual parameters (base + audio * amount).
 */
export class AudioMapper {
  /**
   * @param {object} params mutable params object
   * @param {object} audioState from AudioEnvelope
   * @returns {object} effective values keyed like params
   */
  apply(params, audioState) {
    const effective = { ...params };
    const mappings = params.audioMappings || {};

    for (const [key, mapping] of Object.entries(mappings)) {
      if (!mapping || mapping.source === 'none' || !mapping.amount) continue;
      if (!(key in params)) continue;
      const audioVal = audioState[mapping.source] ?? 0;
      const base = params[key];
      effective[key] = clamp(base + audioVal * mapping.amount, 0, 2);
    }

    if (audioState.bassTransient > 0) {
      const imp = mappings.explosionImpulse;
      if (imp?.amount) {
        effective.explosionAmount = clamp(
          effective.explosionAmount + audioState.bassTransient * imp.amount,
          0,
          1.5
        );
      }
    }

    return effective;
  }
}
