import { clamp } from './utils.js';

/**
 * Attack / release envelope for audio bands.
 */
export class AudioEnvelope {
  constructor() {
    this.amplitude = 0;
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.spectralCentroid = 0;
    this._prevBass = 0;
    this.bassTransient = 0;
    this._impactHold = 0;
  }

  /**
   * @param {object|null} audioAPI shell audio API
   * @param {object} params
   * @param {number} dt seconds
   */
  update(audioAPI, params, dt) {
    if (!audioAPI) {
      this._decayAll(dt, params.audioRelease);
      return this.snapshot();
    }

    const sens = params.audioSensitivity;
    let amp = 0;
    let bass = 0;
    let mid = 0;
    let treble = 0;
    let centroid = 0.5;

    try {
      amp = (audioAPI.getAudioLevel?.() ?? 0) * sens;
      const fft = audioAPI.getFFTData?.();
      if (fft && fft.length > 0) {
        const n = fft.length;
        const bEnd = Math.floor(n * 0.08);
        const mEnd = Math.floor(n * 0.45);
        let bSum = 0;
        let mSum = 0;
        let tSum = 0;
        let wSum = 0;
        for (let i = 0; i < n; i++) {
          const v = fft[i] / 255;
          if (i < bEnd) bSum += v;
          else if (i < mEnd) mSum += v;
          else tSum += v;
          wSum += v * i;
        }
        bass = (bSum / (bEnd || 1)) * sens;
        mid = (mSum / ((mEnd - bEnd) || 1)) * sens;
        treble = (tSum / (n - mEnd || 1)) * sens;
        const total = bSum + mSum + tSum || 1;
        centroid = (wSum / total) / n;
      }
    } catch {
      /* mic unavailable */
    }

    const attack = params.audioAttack;
    const release = params.audioRelease;
    const smooth = params.audioSmoothing;

    this.amplitude = this._follow(this.amplitude, amp, attack, release, dt, smooth);
    this.bass = this._follow(this.bass, bass, attack, release, dt, smooth);
    this.mid = this._follow(this.mid, mid, attack, release, dt, smooth);
    this.treble = this._follow(this.treble, treble, attack, release, dt, smooth);
    this.spectralCentroid = this._follow(this.spectralCentroid, centroid, attack, release, dt, smooth);

    const bassDelta = Math.max(0, this.bass - this._prevBass);
    this._prevBass = this.bass;

    if (params.bassImpactEnabled && bassDelta > params.bassThreshold) {
      this.bassTransient = Math.min(1, bassDelta * 3);
      this._impactHold = params.bassImpactHold;
    }

    if (this._impactHold > 0) {
      this._impactHold -= dt;
    } else {
      this.bassTransient *= params.bassImpactDecay;
    }

    return this.snapshot();
  }

  _follow(current, target, attack, release, dt, smooth) {
    const rate = target > current ? attack : release;
    const k = 1 - Math.pow(1 - clamp(rate), dt * 60);
    let next = current + (target - current) * k;
    next = current * smooth + next * (1 - smooth);
    return clamp(next);
  }

  _decayAll(dt, release) {
    const k = Math.pow(release, dt * 60);
    this.amplitude *= k;
    this.bass *= k;
    this.mid *= k;
    this.treble *= k;
    this.bassTransient *= k;
  }

  snapshot() {
    return {
      amplitude: this.amplitude,
      bass: this.bass,
      mid: this.mid,
      treble: this.treble,
      spectralCentroid: this.spectralCentroid,
      bassTransient: this.bassTransient,
    };
  }
}
