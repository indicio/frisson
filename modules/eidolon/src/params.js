/** @typedef {'none'|'amplitude'|'bass'|'mid'|'treble'|'spectralCentroid'} AudioSource */

/** @typedef {{ source: AudioSource, amount: number }} AudioMapping */

export const AUDIO_SOURCES = ['none', 'amplitude', 'bass', 'mid', 'treble', 'spectralCentroid'];

export const DEFAULT_AUDIO_MAPPINGS = {
  explosionAmount: { source: 'amplitude', amount: 0.35 },
  explosionImpulse: { source: 'bass', amount: 0.4 },
  turbulenceAmount: { source: 'treble', amount: 0.25 },
  spiralAmount: { source: 'mid', amount: 0.1 },
  orbitAmount: { source: 'mid', amount: 0.08 },
  floatAmount: { source: 'amplitude', amount: 0.12 },
  cameraDistance: { source: 'bass', amount: 0.15 },
};

export const DEFAULT_PARAMS = {
  modelScale: 1,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  posX: 0,
  posY: 0,
  posZ: 0,
  opacity: 1,
  splatSize: 1,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hueShift: 0,

  autoOrbit: true,
  orbitSpeed: 0.15,
  orbitRadius: 1,
  orbitAxis: 'y',
  elevation: 0.25,
  fov: 55,
  cameraDistance: 4,
  targetX: 0,
  targetY: 0,
  targetZ: 0,

  explosionAmount: 0.2,
  explosionDistance: 1.5,
  explosionSpread: 1,
  explosionRandomness: 0.25,
  explosionTurbulence: 0,
  explosionDirection: 'radial',
  explosionDirectionStrength: 0,

  orbitAmount: 0,
  orbitRadiusDeform: 0.4,
  orbitSpeedDeform: 0.6,
  orbitAxisDeform: 'y',
  orbitAngularSpread: 1,
  orbitRadialSpread: 1,
  orbitCohesion: 1,

  spiralAmount: 0,
  spiralTwist: 1.2,
  spiralRadius: 0.8,
  spiralSpeed: 0.5,
  spiralVerticalStretch: 1,
  spiralTurbulence: 0,

  floatAmount: 0,
  floatDistance: 0.08,
  floatCohesion: 1,
  noiseAmount: 0,
  noiseScale: 1.5,
  noiseSpeed: 0.8,

  turbulenceAmount: 0,
  turbulenceScale: 2,
  turbulenceSpeed: 1,
  turbulenceFrequency: 1,

  waveAmount: 0,
  waveFrequency: 2,
  waveSpeed: 1,
  waveAxis: 'y',

  reconstruction: 1,
  reconstructionDuration: 1.2,
  reconstructionStyle: 'global',
  reconstructionSpread: 1,
  reconstructionEasing: 'easeOut',

  physicsEnabled: false,
  homeAttraction: 0.45,
  physicsDrag: 0.9,
  physicsForce: 1,
  maxVelocity: 3,
  physicsTurbulence: 0,

  audioSensitivity: 1,
  audioAttack: 0.06,
  audioRelease: 0.38,
  audioSmoothing: 0.72,
  audioDepth: 0.65,

  bassImpactEnabled: true,
  bassThreshold: 0.12,
  bassImpactStrength: 0.45,
  bassImpactHold: 0.05,
  bassImpactDecay: 0.88,

  renderScale: 1,
  samplingPercent: 100,
  maxSplatCount: 0,
  performanceMode: false,
  highQuality: true,

  frozen: false,
  presetName: 'default',

  audioMappings: { ...DEFAULT_AUDIO_MAPPINGS },
};

export function cloneParams(p = DEFAULT_PARAMS) {
  return JSON.parse(JSON.stringify(p));
}
