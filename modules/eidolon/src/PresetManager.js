import { cloneParams, DEFAULT_PARAMS } from './params.js';

const PRESETS = {
  solid: {
    presetName: 'solid',
    explosionAmount: 0,
    floatAmount: 0,
    reconstruction: 1,
    autoOrbit: true,
    orbitSpeed: 0.1,
  },
  breathing: {
    presetName: 'breathing',
    explosionAmount: 0.15,
    audioMappings: {
      explosionAmount: { source: 'amplitude', amount: 0.2 },
      floatAmount: { source: 'amplitude', amount: 0.05 },
    },
  },
  pulse: {
    presetName: 'pulse',
    explosionAmount: 0.1,
    audioMappings: {
      explosionAmount: { source: 'amplitude', amount: 0.55 },
    },
  },
  impact: {
    presetName: 'impact',
    explosionAmount: 0.12,
    bassImpactEnabled: true,
    bassImpactStrength: 0.65,
    homeAttraction: 0.55,
    physicsEnabled: true,
    audioMappings: {
      explosionImpulse: { source: 'bass', amount: 0.7 },
    },
  },
  ghost: {
    presetName: 'ghost',
    floatAmount: 0.35,
    floatDistance: 0.12,
    opacity: 0.65,
    orbitSpeed: 0.08,
    explosionAmount: 0.08,
    audioMappings: {
      explosionAmount: { source: 'amplitude', amount: 0.15 },
      floatAmount: { source: 'amplitude', amount: 0.1 },
    },
  },
  dissolve: {
    presetName: 'dissolve',
    floatAmount: 0.4,
    floatDistance: 0.2,
    turbulenceAmount: 0.35,
    audioMappings: {
      floatAmount: { source: 'amplitude', amount: 0.25 },
      turbulenceAmount: { source: 'treble', amount: 0.35 },
    },
  },
  supernova: {
    presetName: 'supernova',
    explosionAmount: 0.35,
    explosionDistance: 2.5,
    spiralAmount: 0.25,
    turbulenceAmount: 0.4,
    orbitAmount: 0.15,
    audioMappings: {
      explosionAmount: { source: 'amplitude', amount: 0.4 },
      spiralAmount: { source: 'mid', amount: 0.2 },
    },
  },
  gravity: {
    presetName: 'gravity',
    physicsEnabled: true,
    homeAttraction: 0.7,
    explosionAmount: 0.2,
    audioMappings: {
      explosionAmount: { source: 'amplitude', amount: 0.35 },
    },
  },
  vortex: {
    presetName: 'vortex',
    spiralAmount: 0.55,
    spiralTwist: 2,
    audioMappings: {
      spiralAmount: { source: 'amplitude', amount: 0.35 },
      spiralSpeed: { source: 'mid', amount: 0.5 },
    },
  },
  atomic: {
    presetName: 'atomic',
    orbitAmount: 0.45,
    explosionAmount: 0.05,
    orbitCohesion: 0.6,
    audioDepth: 0.4,
    audioMappings: {
      orbitAmount: { source: 'mid', amount: 0.2 },
      explosionAmount: { source: 'bass', amount: 0.15 },
    },
  },
  shimmer: {
    presetName: 'shimmer',
    reconstruction: 0.95,
    turbulenceAmount: 0.25,
    audioDepth: 0.25,
    audioMappings: {
      turbulenceAmount: { source: 'treble', amount: 0.45 },
    },
  },
  default: {
    presetName: 'default',
    explosionAmount: 0.2,
    homeAttraction: 0.45,
    reconstruction: 0.92,
    autoOrbit: true,
    orbitSpeed: 0.12,
    audioMappings: {
      explosionAmount: { source: 'amplitude', amount: 0.35 },
      explosionImpulse: { source: 'bass', amount: 0.4 },
      turbulenceAmount: { source: 'treble', amount: 0.25 },
    },
  },
};

export class PresetManager {
  static list() {
    return Object.keys(PRESETS);
  }

  static apply(name, currentParams) {
    const base = cloneParams(currentParams || DEFAULT_PARAMS);
    const patch = PRESETS[name] || PRESETS.default;
    return { ...base, ...patch, audioMappings: { ...base.audioMappings, ...(patch.audioMappings || {}) } };
  }
}

export { PRESETS };
