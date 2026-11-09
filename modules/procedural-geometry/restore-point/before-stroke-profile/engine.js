/**
 * Procedural Geometry engine.
 * Geometry-space strokes only. Screen-space post distortion can wrap these
 * polylines later without changing the generators.
 *
 * Pitch comes from waveform autocorrelation with a confidence gate, not from
 * the loudest FFT bin. The tracker holds the last confident note.
 */

export const VERSION = 1;

export const SHAPES = [
  { id: 'horizontal', label: 'Horizontal lines', group: 'parallel', show: '' },
  { id: 'vertical', label: 'Vertical lines', group: 'parallel', show: '' },
  { id: 'diagonal', label: 'Diagonal lines', group: 'parallel', show: '' },
  { id: 'sine', label: 'Parallel sine waves', group: 'parallel', show: 'wave' },
  { id: 'triangle-wave', label: 'Parallel triangle waves', group: 'parallel', show: 'wave' },
  { id: 'saw', label: 'Parallel sawtooth waves', group: 'parallel', show: 'wave' },
  { id: 'square-wave', label: 'Parallel square waves', group: 'parallel', show: 'wave' },
  { id: 'compound', label: 'Compound waveforms', group: 'parallel', show: 'wave' },
  { id: 'crosshatch', label: 'Crosshatch grid', group: 'parallel', show: '' },
  { id: 'circles', label: 'Circles', group: 'concentric', show: '' },
  { id: 'ellipses', label: 'Ellipses', group: 'concentric', show: 'ellipse' },
  { id: 'squares', label: 'Squares', group: 'concentric', show: '' },
  { id: 'rectangles', label: 'Rectangles', group: 'concentric', show: 'ellipse' },
  { id: 'diamonds', label: 'Diamonds', group: 'concentric', show: '' },
  { id: 'triangles', label: 'Triangles', group: 'concentric', show: '' },
  { id: 'polygons', label: 'Polygons', group: 'concentric', show: 'sides' },
  { id: 'stars', label: 'Stars', group: 'concentric', show: 'star' },
  { id: 'organic', label: 'Organic contours', group: 'concentric', show: 'organic' },
  { id: 'rounded', label: 'Rounded polygons', group: 'concentric', show: 'sides' },
  { id: 'spokes', label: 'Radial spokes', group: 'radial', show: '' },
  { id: 'spiral-arch', label: 'Archimedean spiral', group: 'radial', show: 'spiral' },
  { id: 'spiral-log', label: 'Logarithmic spiral', group: 'radial', show: 'spiral' },
  { id: 'spiral-arms', label: 'Multi-arm spiral', group: 'radial', show: 'spiral arms' },
  { id: 'polygon-tunnel', label: 'Polygon tunnel', group: 'radial', show: 'sides step' },
];

export const DEFORM_TYPES = [
  { id: 'wave', label: 'Wave' },
  { id: 'turbulence', label: 'Turbulence' },
  { id: 'twist', label: 'Twist' },
  { id: 'ripple', label: 'Ripple' },
  { id: 'pinch', label: 'Pinch / Bulge' },
  { id: 'vortex', label: 'Vortex' },
  { id: 'shift', label: 'Directional shift' },
  { id: 'warp', label: 'Noise warp' },
];

export const SOURCES = [
  { id: 'rms', label: 'RMS amplitude' },
  { id: 'peak', label: 'Peak amplitude' },
  { id: 'bass', label: 'Bass' },
  { id: 'mid', label: 'Midrange' },
  { id: 'treble', label: 'Treble' },
  { id: 'band', label: 'Frequency band' },
  { id: 'centroid', label: 'Spectral centroid' },
  { id: 'pitch', label: 'Pitch' },
  { id: 'midi', label: 'MIDI note' },
  { id: 'pitchClass', label: 'Pitch class' },
  { id: 'transient', label: 'Transient' },
];

export const DESTINATIONS = [
  { id: 'widthBase', label: 'Line width', min: 0.5, max: 300 },
  { id: 'gapBase', label: 'Gap width', min: 0, max: 400 },
  { id: 'widthAmp', label: 'Width progression', min: 0, max: 200 },
  { id: 'gapAmp', label: 'Gap progression', min: 0, max: 200 },
  { id: 'widthPeriod', label: 'Progression period', min: 1, max: 32 },
  { id: 'scale', label: 'Shape scale', min: 0.2, max: 3 },
  { id: 'sides', label: 'Polygon sides', min: 3, max: 16 },
  { id: 'starInner', label: 'Star inner radius', min: 0.05, max: 0.95 },
  { id: 'waveAmp', label: 'Wave amplitude', min: 0, max: 240 },
  { id: 'waveFreq', label: 'Wave frequency', min: 0.2, max: 16 },
  { id: 'turbStrength', label: 'Turbulence strength', min: 0, max: 240 },
  { id: 'noiseScale', label: 'Noise scale', min: 0.001, max: 0.08 },
  { id: 'noiseDetail', label: 'Noise detail', min: 1, max: 6 },
  { id: 'twistStrength', label: 'Twist strength', min: -180, max: 180 },
  { id: 'rippleAmp', label: 'Ripple amplitude', min: 0, max: 200 },
  { id: 'vortexStrength', label: 'Vortex strength', min: -180, max: 180 },
  { id: 'translateSpeed', label: 'Translation speed', min: -400, max: 400 },
  { id: 'rotationSpeed', label: 'Rotation speed', min: -180, max: 180 },
  { id: 'expandSpeed', label: 'Expansion speed', min: -400, max: 400 },
  { id: 'wavePhaseSpeed', label: 'Wave phase speed', min: -4, max: 4 },
  { id: 'turbSpeed', label: 'Turbulence evolution', min: 0, max: 3 },
  { id: 'fgHue', label: 'Foreground hue', min: 0, max: 360 },
  { id: 'bgHue', label: 'Background hue', min: 0, max: 360 },
  { id: 'saturation', label: 'Saturation', min: 0, max: 2 },
  { id: 'brightness', label: 'Brightness', min: 0, max: 2 },
  { id: 'opacity', label: 'Opacity', min: 0, max: 1 },
  { id: 'paletteMix', label: 'Palette mix', min: 0, max: 1 },
];

const DEST_INDEX = Object.fromEntries(DESTINATIONS.map((item) => [item.id, item]));

export function defaultProgress(base, min, max) {
  return {
    base, min, max,
    amplitude: 0,
    period: 8,
    phase: 0,
    phaseSpeed: 0,
    direction: 1,
    curve: 'sine',
    space: 'index',
    sequence: [2, 8, 24, 80, 24, 8],
    seed: 1,
  };
}

export function defaultDeform(type = 'wave', extra = {}) {
  return {
    id: `d${Math.random().toString(36).slice(2, 8)}`,
    enabled: true,
    type,
    strength: 24,
    scale: 0.01,
    frequency: 2,
    speed: 0.35,
    phase: 0,
    direction: 0,
    centerX: 0,
    centerY: 0,
    octaves: 3,
    seed: 1,
    falloff: 280,
    wave: 'sine',
    axis: 'radial',
    ...extra,
  };
}

export function defaultRoute(extra = {}) {
  return {
    id: `r${Math.random().toString(36).slice(2, 8)}`,
    enabled: true,
    source: 'rms',
    dest: 'widthBase',
    depth: 0.8,
    inMin: 0,
    inMax: 1,
    outMin: 1,
    outMax: 28,
    curve: 'linear',
    invert: false,
    attack: 0.03,
    release: 0.18,
    mode: 'add',
    bandLow: 0,
    bandHigh: 0.15,
    ...extra,
  };
}

export function defaultState() {
  return {
    version: VERSION,
    form: {
      shape: 'polygons',
      sides: 6,
      starPoints: 5,
      starInner: 0.42,
      ellipseAspect: 1.7,
      spiralArms: 4,
      spiralPitch: 16,
      spiralTurns: 6,
      waveType: 'sine',
      waveAmp: 0,
      waveFreq: 3,
      rotationStep: 7,
      centerX: 0,
      centerY: 0,
      rotation: 0,
      scale: 1,
      limit: 28,
      quality: 0.75,
      seed: 3,
      morph: 0,
    },
    width: defaultProgress(2.5, 0.5, 300),
    gap: { ...defaultProgress(22, 0, 400), curve: 'uniform', amplitude: 0 },
    anim: {
      speed: 1,
      translateX: 0,
      translateY: 0,
      rotation: 10,
      expand: 36,
      wavePhase: 0.4,
      turbEvolve: 0.15,
      ripple: 0.5,
      hue: 0,
      polyRot: 4,
      morph: 0,
    },
    deformations: [
      defaultDeform('twist', { strength: 28, speed: 0.15, falloff: 640 }),
      defaultDeform('wave', { strength: 10, frequency: 3, speed: 0.25, wave: 'sine' }),
    ],
    routes: [],
    color: {
      fg: '#e9fbff',
      bg: '#05070b',
      hue: 190,
      bgHue: 0,
      saturation: 0.7,
      brightness: 0.82,
      bgBrightness: 1,
      opacity: 1,
      palette: 'cyan',
      paletteMix: 0.85,
      invert: false,
    },
    audioGain: 1,
  };
}

function stage(type, extra) {
  return defaultDeform(type, extra);
}

export const PRESETS = [
  preset('classic-op-art', 'Classic Op Art', (s) => {
    s.form.shape = 'horizontal';
    s.form.waveAmp = 0;
    s.form.limit = 42;
    s.width = { ...s.width, base: 6, amplitude: 8, period: 2, curve: 'alternating', min: 1, max: 22 };
    s.gap = { ...s.gap, base: 14, amplitude: 0, curve: 'uniform', min: 4, max: 40 };
    s.anim = { ...s.anim, rotation: 0, expand: 0, translateY: 14, hue: 0, polyRot: 0, speed: 0.45 };
    s.deformations = [];
    s.routes = [];
    s.color = { ...s.color, fg: '#f4f7fb', bg: '#070708', palette: 'none', paletteMix: 0, hue: 0, saturation: 0, brightness: 1 };
  }),
  preset('extreme-bands', 'Extreme Bands', (s) => {
    s.form.shape = 'vertical';
    s.form.limit = 16;
    s.width = { ...s.width, curve: 'sequence', sequence: [2, 8, 24, 80, 160, 80, 24, 8], period: 8, min: 0.5, max: 300, base: 8 };
    s.gap = { ...s.gap, curve: 'sequence', sequence: [4, 40, 0, 18, 70, 8], base: 12, amplitude: 0, min: 0, max: 120, period: 6 };
    s.anim = { ...s.anim, rotation: 0, expand: 0, translateX: 28, translateY: 0, hue: 0, polyRot: 0 };
    s.deformations = [];
    s.routes = [];
    s.color = { ...s.color, fg: '#ffffff', bg: '#000000', palette: 'none', paletteMix: 0, hue: 0, saturation: 0, brightness: 1 };
  }),
  preset('breathing-rings', 'Breathing Rings', (s) => {
    s.form.shape = 'circles';
    s.form.limit = 24;
    s.width = { ...s.width, base: 2, amplitude: 1.5, curve: 'sine', period: 8 };
    s.gap = { ...s.gap, base: 28, amplitude: 0, curve: 'uniform' };
    s.anim = { ...s.anim, expand: 48, rotation: 0, translateY: 0, hue: 0, polyRot: 0 };
    s.deformations = [];
    s.routes = [];
    s.color = { ...s.color, fg: '#d8fbff', bg: '#061018', palette: 'cyan', paletteMix: 0.4, hue: 0 };
  }),
  preset('liquid-lines', 'Liquid Lines', (s) => {
    s.form.shape = 'sine';
    s.form.waveType = 'sine';
    s.form.waveAmp = 36;
    s.form.waveFreq = 2.4;
    s.form.limit = 22;
    s.width = { ...s.width, base: 3, amplitude: 2, curve: 'sine' };
    s.gap = { ...s.gap, base: 26, amplitude: 6, curve: 'sine' };
    s.anim = { ...s.anim, translateY: 16, expand: 0, rotation: 0, wavePhase: 0.6, hue: 6, polyRot: 0 };
    s.deformations = [stage('turbulence', { strength: 22, scale: 0.008, octaves: 3, speed: 0.2, seed: 4 })];
    s.routes = [];
    s.color = { ...s.color, fg: '#b7fff1', bg: '#07110f', palette: 'ice', paletteMix: 0.7, hue: 0 };
  }),
  preset('topographic', 'Topographic', (s) => {
    s.form.shape = 'organic';
    s.form.limit = 26;
    s.form.seed = 11;
    s.width = { ...s.width, base: 1.6, amplitude: 0.6, curve: 'sine' };
    s.gap = { ...s.gap, base: 18, amplitude: 4, curve: 'triangle' };
    s.anim = { ...s.anim, expand: 12, rotation: 2, turbEvolve: 0.25, hue: 0, polyRot: 0 };
    s.deformations = [
      stage('warp', { strength: 34, scale: 0.006, octaves: 4, speed: 0.12, seed: 8 }),
      stage('turbulence', { strength: 12, scale: 0.02, octaves: 2, speed: 0.2, seed: 2 }),
    ];
    s.routes = [];
    s.color = { ...s.color, fg: '#d5ffe8', bg: '#07110c', palette: 'ice', paletteMix: 0.55, hue: 0, saturation: 0.45 };
  }),
  preset('vortex-tunnel', 'Vortex Tunnel', (s) => {
    s.form.shape = 'polygon-tunnel';
    s.form.sides = 6;
    s.form.rotationStep = 8;
    s.form.limit = 26;
    s.width = { ...s.width, base: 2.2, amplitude: 1.4, curve: 'sine', period: 7 };
    s.gap = { ...s.gap, base: 24, amplitude: 0, curve: 'uniform' };
    s.anim = { ...s.anim, rotation: 14, expand: 42, polyRot: 6, hue: 10 };
    s.deformations = [
      stage('twist', { strength: 42, falloff: 720, speed: 0.12 }),
      stage('ripple', { strength: 8, frequency: 2.2, speed: 0.45, falloff: 800 }),
    ];
    s.routes = [];
    s.color = { ...s.color, fg: '#f3fdff', bg: '#04060c', palette: 'cyan', paletteMix: 1, hue: 0, saturation: 0.85, brightness: 0.9 };
  }),
  preset('geometric-chaos', 'Geometric Chaos', (s) => {
    s.form.shape = 'stars';
    s.form.starPoints = 7;
    s.form.starInner = 0.38;
    s.form.limit = 16;
    s.width = { ...s.width, curve: 'sequence', sequence: [2, 18, 70, 140, 40], period: 5, min: 0.5, max: 300 };
    s.gap = { ...s.gap, base: 30, amplitude: 18, curve: 'sawtooth', min: 4 };
    s.anim = { ...s.anim, rotation: 18, expand: 30, polyRot: 12, hue: 20 };
    s.deformations = [
      stage('wave', { strength: 30, frequency: 2, wave: 'triangle' }),
      stage('turbulence', { strength: 26, scale: 0.012, octaves: 3, seed: 6 }),
      stage('vortex', { strength: 36, falloff: 340, speed: 0.3 }),
    ];
    s.routes = [];
    s.color = { ...s.color, fg: '#fff4d2', bg: '#100806', palette: 'magma', paletteMix: 0.8, hue: 28 };
  }),
  preset('psychedelic-spiral', 'Psychedelic Spiral', (s) => {
    s.form.shape = 'spiral-arms';
    s.form.spiralArms = 5;
    s.form.spiralPitch = 18;
    s.form.spiralTurns = 7;
    s.form.limit = 5;
    s.width = { ...s.width, base: 3, amplitude: 1.5, curve: 'sine' };
    s.gap = { ...s.gap, base: 0, amplitude: 0 };
    s.anim = { ...s.anim, rotation: 22, expand: 0, hue: 36, polyRot: 0 };
    s.deformations = [stage('twist', { strength: 16, falloff: 900, speed: 0.2 })];
    s.routes = [];
    s.color = { ...s.color, fg: '#ffe1ff', bg: '#090612', palette: 'magma', paletteMix: 0.65, hue: 300, saturation: 0.9, brightness: 0.7 };
  }),
  preset('bass-reactor', 'Bass Reactor', (s) => {
    s.form.shape = 'circles';
    s.form.limit = 20;
    s.width = { ...s.width, base: 3, amplitude: 0, curve: 'uniform' };
    s.gap = { ...s.gap, base: 26, amplitude: 0, curve: 'uniform' };
    s.anim = { ...s.anim, expand: 10, rotation: 4, hue: 0, polyRot: 0 };
    s.deformations = [stage('pinch', { strength: 10, falloff: 420 })];
    s.routes = [
      defaultRoute({ source: 'bass', dest: 'widthBase', mode: 'add', depth: 1, outMin: 1, outMax: 36, attack: 0.02, release: 0.2 }),
      defaultRoute({ source: 'bass', dest: 'expandSpeed', mode: 'add', depth: 1, outMin: 0, outMax: 120, attack: 0.04, release: 0.25 }),
    ];
    s.color = { ...s.color, fg: '#fff1c9', bg: '#120c08', palette: 'magma', paletteMix: 0.35, hue: 36 };
  }),
  preset('pitch-chromatic', 'Pitch Chromatic', (s) => {
    s.form.shape = 'polygons';
    s.form.sides = 5;
    s.form.limit = 18;
    s.width = { ...s.width, base: 2.4, amplitude: 1, curve: 'sine' };
    s.gap = { ...s.gap, base: 24, amplitude: 0 };
    s.anim = { ...s.anim, expand: 16, rotation: 6, hue: 0, polyRot: 0 };
    s.deformations = [];
    s.routes = [
      defaultRoute({ source: 'pitchClass', dest: 'fgHue', mode: 'replace', depth: 1, outMin: 0, outMax: 360, attack: 0.05, release: 0.3 }),
      defaultRoute({ source: 'centroid', dest: 'saturation', mode: 'add', depth: 0.8, outMin: 0.2, outMax: 1.2 }),
      defaultRoute({ source: 'rms', dest: 'scale', mode: 'add', depth: 0.6, outMin: 0.9, outMax: 1.25, attack: 0.03, release: 0.2 }),
    ];
    s.color = { ...s.color, palette: 'cyan', paletteMix: 0.2, saturation: 0.8, brightness: 0.85 };
  }),
  preset('ripple-field', 'Ripple Field', (s) => {
    s.form.shape = 'circles';
    s.form.limit = 12;
    s.width = { ...s.width, base: 2.4, amplitude: 0 };
    s.gap = { ...s.gap, base: 42, amplitude: 0 };
    s.anim = { ...s.anim, expand: 18, rotation: 0, ripple: 1.1, hue: 0, polyRot: 0 };
    s.deformations = [stage('ripple', { strength: 36, frequency: 1.4, speed: 0.8, falloff: 980 })];
    s.routes = [
      defaultRoute({ source: 'transient', dest: 'rippleAmp', mode: 'add', depth: 1, outMin: 0, outMax: 48, attack: 0.01, release: 0.35 }),
    ];
    s.color = { ...s.color, fg: '#e7f6ff', bg: '#05070c', palette: 'cyan', paletteMix: 0.25, hue: 0 };
  }),
  preset('morphing-polygons', 'Morphing Polygons', (s) => {
    s.form.shape = 'polygons';
    s.form.sides = 3;
    s.form.morph = 0.85;
    s.form.limit = 14;
    s.width = { ...s.width, base: 2.5, amplitude: 1.2, curve: 'triangle' };
    s.gap = { ...s.gap, base: 30, amplitude: 0 };
    s.anim = { ...s.anim, morph: 0.85, rotation: 12, expand: 22, polyRot: 16, hue: 12 };
    s.deformations = [stage('wave', { strength: 12, frequency: 2, wave: 'sine', speed: 0.3 })];
    s.routes = [];
    s.color = { ...s.color, fg: '#f7f3ff', bg: '#0a0712', palette: 'complement', paletteMix: 0.55, hue: 20 };
  }),
];

function preset(id, name, apply) {
  const state = defaultState();
  apply(state);
  state.presetId = id;
  return { id, name, state };
}

export function presetById(id) {
  return PRESETS.find((item) => item.id === id) || PRESETS[0];
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function sanitizeState(raw) {
  const base = defaultState();
  const src = raw && typeof raw === 'object' ? raw : {};
  const form = { ...base.form, ...(src.form || {}) };
  form.sides = clamp(Math.round(form.sides || 6), 3, 16);
  form.starPoints = clamp(Math.round(form.starPoints || 5), 3, 16);
  form.starInner = clamp(form.starInner, 0.05, 0.95);
  form.ellipseAspect = clamp(form.ellipseAspect, 0.25, 4);
  form.spiralArms = clamp(Math.round(form.spiralArms || 1), 1, 8);
  form.spiralTurns = clamp(form.spiralTurns, 1, 14);
  form.limit = clamp(Math.round(form.limit || 24), 4, 80);
  form.quality = clamp(form.quality, 0.35, 1);
  form.scale = clamp(form.scale, 0.15, 3);
  if (!SHAPES.some((item) => item.id === form.shape)) form.shape = 'circles';
  const width = sanitizeProgress(src.width, base.width);
  const gap = sanitizeProgress(src.gap, base.gap);
  const anim = { ...base.anim, ...(src.anim || {}) };
  anim.speed = clamp(anim.speed, 0, 4);
  const deformations = Array.isArray(src.deformations) ? src.deformations.slice(0, 8).map((item, index) => {
    const stage = {
      ...defaultDeform('wave'),
      ...item,
      id: item?.id || `d${index}`,
    };
    if (!DEFORM_TYPES.some((entry) => entry.id === stage.type)) stage.type = 'wave';
    return stage;
  }) : base.deformations;
  const routes = Array.isArray(src.routes) ? src.routes.slice(0, 12).map((item, index) => ({
    ...defaultRoute(),
    ...item,
    id: item?.id || `r${index}`,
  })) : [];
  const color = { ...base.color, ...(src.color || {}) };
  // Older builds added bgHue and crushed lightness with bgBrightness, so the
  // swatch never reached the canvas. That factory pair is not a chosen tint.
  if (Number(src.color?.bgHue) === 220 && Math.abs(Number(src.color?.bgBrightness) - 0.04) < 0.001) {
    color.bgHue = 0;
    color.bgBrightness = 1;
  }
  return {
    version: VERSION,
    form, width, gap, anim, deformations, routes, color,
    audioGain: clamp(src.audioGain ?? base.audioGain, 0, 4),
    presetId: src.presetId || null,
  };
}

function sanitizeProgress(raw, fallback) {
  const spec = { ...fallback, ...(raw || {}) };
  spec.min = clamp(spec.min, 0, 400);
  spec.max = clamp(Math.max(spec.min, spec.max), spec.min, 400);
  spec.base = clamp(spec.base, spec.min, spec.max);
  spec.amplitude = clamp(spec.amplitude, 0, 400);
  spec.period = clamp(spec.period, 0.5, 64);
  spec.direction = spec.direction < 0 ? -1 : 1;
  spec.phaseSpeed = clamp(spec.phaseSpeed || 0, -4, 4);
  spec.seed = clamp(Math.round(spec.seed || 1), 1, 40);
  const curves = ['uniform', 'linear', 'triangle', 'sine', 'sawtooth', 'exponential', 'alternating', 'stepped', 'random', 'sequence'];
  if (!curves.includes(spec.curve)) spec.curve = 'sine';
  if (spec.space !== 'spatial') spec.space = 'index';
  spec.sequence = Array.isArray(spec.sequence) && spec.sequence.length
    ? spec.sequence.slice(0, 16).map((value) => clamp(Number(value) || 0, 0, 400))
    : fallback.sequence;
  return spec;
}

export function createAudioTracker() {
  const held = { hz: 0, midi: 0, pitchClass: 0, confident: false };
  let lastLevel = 0;
  return function track(fft, waveform, level, sampleRate = 48000) {
    const gain = 1;
    const rms = clamp((level || 0) * gain, 0, 1);
    const bins = fft?.length || 0;
    const band = (from, to) => energy(fft, from, to);
    const peak = waveformPeak(waveform);
    const centroid = spectralCentroid(fft);
    const pitch = estimatePitch(waveform, sampleRate);
    if (pitch.confidence >= 0.45 && pitch.hz > 40 && pitch.hz < 2000) {
      held.hz = pitch.hz;
      held.midi = 69 + 12 * Math.log2(pitch.hz / 440);
      held.pitchClass = ((Math.round(held.midi) % 12) + 12) % 12;
      held.confident = true;
    }
    const transient = clamp((rms - lastLevel) * 4, 0, 1);
    lastLevel = lastLevel * 0.8 + rms * 0.2;
    return {
      rms, peak,
      bass: band(0, 0.08),
      mid: band(0.08, 0.4),
      treble: band(0.4, 1),
      centroid,
      pitch: held.confident ? clamp((Math.log2(held.hz / 40)) / Math.log2(2000 / 40), 0, 1) : 0,
      midi: held.confident ? clamp(held.midi / 127, 0, 1) : 0,
      pitchClass: held.confident ? held.pitchClass / 11 : 0,
      transient,
      confident: held.confident && pitch.confidence >= 0.45,
      fft, bins,
    };
  };
}

export function createModulator() {
  const memory = new Map();
  return {
    reset() { memory.clear(); },
    apply(base, metrics, dt, gain = 1) {
      const state = cloneState(base);
      const scaled = scaleMetrics(metrics, gain);
      for (const route of state.routes) {
        if (!route.enabled) continue;
        const dest = DEST_INDEX[route.dest];
        if (!dest) continue;
        const raw = sourceValue(scaled, route);
        const shaped = shapeSignal(raw, route);
        const prev = memory.get(route.id);
        const smooth = smoothSignal(prev ?? shaped, shaped, dt, route.attack, route.release);
        memory.set(route.id, smooth);
        const mapped = route.outMin + smooth * (route.outMax - route.outMin);
        applyDest(state, route, dest, mapped, smooth);
      }
      return sanitizeState(state);
    },
  };
}

function scaleMetrics(metrics, gain) {
  const g = clamp(gain, 0, 4);
  if (!metrics) return { rms: 0, peak: 0, bass: 0, mid: 0, treble: 0, centroid: 0, pitch: 0, midi: 0, pitchClass: 0, transient: 0, fft: null, bins: 0 };
  const scale = (value) => clamp((value || 0) * g, 0, 1);
  return { ...metrics, rms: scale(metrics.rms), peak: scale(metrics.peak), bass: scale(metrics.bass), mid: scale(metrics.mid), treble: scale(metrics.treble), transient: scale(metrics.transient) };
}

function sourceValue(metrics, route) {
  if (route.source === 'band') return energy(metrics.fft, route.bandLow, route.bandHigh);
  return metrics[route.source] ?? 0;
}

function shapeSignal(raw, route) {
  const span = Math.max(0.0001, route.inMax - route.inMin);
  let x = clamp((raw - route.inMin) / span, 0, 1);
  if (route.curve === 'exponential') x = x * x;
  else if (route.curve === 'logarithmic') x = Math.log1p(x * 9) / Math.log(10);
  else if (route.curve === 'stepped') x = Math.floor(x * 5) / 4;
  if (route.invert) x = 1 - x;
  return x;
}

function smoothSignal(prev, next, dt, attack, release) {
  const tau = Math.max(0.001, next > prev ? attack : release);
  const k = 1 - Math.exp(-Math.max(0, dt) / tau);
  return prev + (next - prev) * k;
}

function applyDest(state, route, dest, mapped, shaped) {
  const depth = clamp(route.depth, 0, 1);
  const current = readDest(state, dest.id);
  let next = current;
  if (route.mode === 'multiply') next = current * (1 + depth * (shaped * 2 - 1));
  else if (route.mode === 'replace') next = current + (mapped - current) * depth;
  else next = current + depth * (shaped * 2 - 1) * Math.max(1, Math.abs(route.outMax - route.outMin)) * 0.5;
  writeDest(state, dest.id, clamp(next, dest.min, dest.max));
}

function readDest(state, id) {
  const map = {
    widthBase: state.width.base,
    gapBase: state.gap.base,
    widthAmp: state.width.amplitude,
    gapAmp: state.gap.amplitude,
    widthPeriod: state.width.period,
    scale: state.form.scale,
    sides: state.form.sides,
    starInner: state.form.starInner,
    waveAmp: state.form.waveAmp,
    waveFreq: state.form.waveFreq,
    translateSpeed: state.anim.translateY,
    rotationSpeed: state.anim.rotation,
    expandSpeed: state.anim.expand,
    wavePhaseSpeed: state.anim.wavePhase,
    turbSpeed: state.anim.turbEvolve,
    fgHue: state.color.hue,
    bgHue: state.color.bgHue,
    saturation: state.color.saturation,
    brightness: state.color.brightness,
    opacity: state.color.opacity,
    paletteMix: state.color.paletteMix,
  };
  if (id === 'turbStrength') return firstOf(state, 'turbulence')?.strength ?? 0;
  if (id === 'noiseScale') return firstOf(state, 'turbulence')?.scale ?? firstOf(state, 'warp')?.scale ?? 0.01;
  if (id === 'noiseDetail') return firstOf(state, 'turbulence')?.octaves ?? 3;
  if (id === 'twistStrength') return firstOf(state, 'twist')?.strength ?? 0;
  if (id === 'rippleAmp') return firstOf(state, 'ripple')?.strength ?? 0;
  if (id === 'vortexStrength') return firstOf(state, 'vortex')?.strength ?? 0;
  return map[id] ?? 0;
}

function writeDest(state, id, value) {
  if (id === 'widthBase') state.width.base = value;
  else if (id === 'gapBase') state.gap.base = value;
  else if (id === 'widthAmp') state.width.amplitude = value;
  else if (id === 'gapAmp') state.gap.amplitude = value;
  else if (id === 'widthPeriod') state.width.period = value;
  else if (id === 'scale') state.form.scale = value;
  else if (id === 'sides') state.form.sides = Math.round(value);
  else if (id === 'starInner') state.form.starInner = value;
  else if (id === 'waveAmp') state.form.waveAmp = value;
  else if (id === 'waveFreq') state.form.waveFreq = value;
  else if (id === 'translateSpeed') state.anim.translateY = value;
  else if (id === 'rotationSpeed') state.anim.rotation = value;
  else if (id === 'expandSpeed') state.anim.expand = value;
  else if (id === 'wavePhaseSpeed') state.anim.wavePhase = value;
  else if (id === 'turbSpeed') state.anim.turbEvolve = value;
  else if (id === 'fgHue') state.color.hue = value;
  else if (id === 'bgHue') state.color.bgHue = value;
  else if (id === 'saturation') state.color.saturation = value;
  else if (id === 'brightness') state.color.brightness = value;
  else if (id === 'opacity') state.color.opacity = value;
  else if (id === 'paletteMix') state.color.paletteMix = value;
  else if (id === 'turbStrength') setFirst(state, 'turbulence', 'strength', value);
  else if (id === 'noiseScale') setFirst(state, 'turbulence', 'scale', value);
  else if (id === 'noiseDetail') setFirst(state, 'turbulence', 'octaves', Math.round(value));
  else if (id === 'twistStrength') setFirst(state, 'twist', 'strength', value);
  else if (id === 'rippleAmp') setFirst(state, 'ripple', 'strength', value);
  else if (id === 'vortexStrength') setFirst(state, 'vortex', 'strength', value);
}

function firstOf(state, type) {
  return state.deformations.find((item) => item.type === type && item.enabled !== false) || state.deformations.find((item) => item.type === type);
}

function setFirst(state, type, key, value) {
  const item = firstOf(state, type);
  if (item) item[key] = value;
}

export function buildStrokes(state, elapsed) {
  const safe = state?.form ? state : defaultState();
  const shape = SHAPES.find((item) => item.id === safe.form.shape) || SHAPES[0];
  const limit = safe.form.limit;
  const quality = safe.form.quality;
  const strokes = [];
  if (shape.group === 'parallel') {
    const horizontal = safe.form.shape !== 'vertical';
    pushParallel(strokes, safe, elapsed, horizontal, 0);
    if (safe.form.shape === 'crosshatch') pushParallel(strokes, safe, elapsed, false, 90);
    if (safe.form.shape === 'diagonal') strokes.forEach((stroke) => { stroke.angle = 35; });
  } else if (shape.id === 'spokes') {
    pushSpokes(strokes, safe, elapsed);
  } else if (shape.id.startsWith('spiral')) {
    pushSpiral(strokes, safe, elapsed);
  } else {
    pushRings(strokes, safe, elapsed, limit, quality);
  }
  const viewScale = safe.form.scale;
  for (const stroke of strokes) {
    if (stroke.angle) {
      const radians = stroke.angle * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      for (const point of stroke.points) {
        const x = point.x * cos - point.y * sin;
        const y = point.x * sin + point.y * cos;
        point.x = x;
        point.y = y;
      }
    }
    deform(stroke.points, safe, elapsed);
    if (viewScale !== 1) {
      for (const point of stroke.points) {
        point.x *= viewScale;
        point.y *= viewScale;
      }
    }
    stroke.color = strokeColor(safe, stroke.t, elapsed);
    stroke.alpha = clamp(safe.color.opacity, 0, 1);
  }
  return strokes;
}

function pushParallel(strokes, state, elapsed, horizontal, angle) {
  const span = 2400;
  const steps = cycle(state, elapsed);
  const travel = mod(elapsed * (horizontal ? state.anim.translateY : state.anim.translateX || state.anim.translateY), Math.max(1, steps.span));
  let cursor = -span * 0.5 + travel;
  let index = 0;
  const cap = state.form.limit * (state.form.shape === 'crosshatch' ? 1 : 2);
  while (cursor < span * 0.5 && index < cap) {
    const step = steps.items[index % steps.items.length];
    const samples = Math.round(48 + 80 * state.form.quality);
    const points = [];
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const along = -span * 0.45 + u * span * 0.9;
      let x = horizontal ? along : cursor;
      let y = horizontal ? cursor : along;
      const wave = state.form.waveAmp * waveform(waveKind(state), u * state.form.waveFreq + elapsed * state.anim.wavePhase);
      if (horizontal) y += wave;
      else x += wave;
      points.push({ x, y });
    }
    strokes.push({ points, width: step.w, t: index / cap, angle });
    cursor += step.w + step.g;
    index += 1;
  }
}

function pushRings(strokes, state, elapsed, limit, quality) {
  const steps = cycle(state, elapsed);
  const travel = mod(elapsed * state.anim.expand, Math.max(1, steps.span));
  let radius = Math.max(4, travel);
  let index = 0;
  const maxR = 1100;
  while (radius < maxR && index < limit) {
    const step = steps.items[index % steps.items.length];
    const morph = state.anim.morph > 0 ? 0.5 + 0.5 * Math.sin(elapsed * state.anim.morph) : state.form.morph;
    const rotation = (state.form.rotation + elapsed * state.anim.rotation + index * (state.form.rotationStep + elapsed * state.anim.polyRot * 0.15)) * Math.PI / 180;
    const points = ringPoints(state, radius + step.w * 0.5, rotation, quality, morph, index);
    strokes.push({ points, width: step.w, t: radius / maxR, angle: 0 });
    radius += step.w + Math.max(0, step.g);
    index += 1;
  }
}

function pushSpokes(strokes, state, elapsed) {
  const count = clamp(Math.round(state.form.limit), 4, 80);
  const reach = 1000 * state.form.scale;
  for (let index = 0; index < count; index += 1) {
    const angle = state.form.rotation * Math.PI / 180 + elapsed * state.anim.rotation * Math.PI / 180 + index / count * Math.PI * 2;
    const width = progression(index, index / count, state.width, elapsed);
    strokes.push({
      points: [
        { x: Math.cos(angle) * 8, y: Math.sin(angle) * 8 },
        { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach },
      ],
      width,
      t: index / count,
      angle: 0,
    });
  }
}

function pushSpiral(strokes, state, elapsed) {
  const arms = state.form.shape === 'spiral-arms' ? state.form.spiralArms : 1;
  const turns = state.form.spiralTurns;
  const samples = Math.round(turns * (36 + 70 * state.form.quality));
  const log = state.form.shape === 'spiral-log';
  for (let arm = 0; arm < arms; arm += 1) {
    const points = [];
    const offset = arm / arms * Math.PI * 2 + elapsed * state.anim.rotation * Math.PI / 180;
    for (let i = 0; i <= samples; i += 1) {
      const theta = i / samples * turns * Math.PI * 2;
      const radius = log
        ? 6 * Math.exp(state.form.spiralPitch * 0.012 * theta)
        : state.form.spiralPitch * theta;
      points.push({ x: Math.cos(theta + offset) * radius, y: Math.sin(theta + offset) * radius });
    }
    const width = progression(arm, arm / arms, state.width, elapsed);
    strokes.push({ points, width, t: arm / arms, angle: 0 });
  }
}

function ringPoints(state, radius, rotation, quality, morph, index) {
  const shape = state.form.shape === 'polygon-tunnel' ? 'polygons' : state.form.shape;
  const samples = shape === 'circles' || shape === 'ellipses' || shape === 'organic'
    ? Math.round(48 + 80 * quality)
    : null;
  const points = [];
  if (samples) {
    const aspect = shape === 'ellipses' ? state.form.ellipseAspect : 1;
    for (let i = 0; i <= samples; i += 1) {
      const angle = rotation + i / samples * Math.PI * 2;
      let rr = radius;
      if (shape === 'organic') {
        rr *= 1 + 0.16 * Math.sin(angle * 3 + state.form.seed) + 0.07 * Math.sin(angle * 7 + index);
      }
      const blend = 1 - clamp(morph, 0, 1) * 0;
      points.push({ x: Math.cos(angle) * rr * aspect * blend, y: Math.sin(angle) * rr });
    }
    return points;
  }
  const sides = shape === 'triangles' ? 3 : shape === 'squares' || shape === 'diamonds' ? 4 : shape === 'stars' ? state.form.starPoints : state.form.sides;
  const star = shape === 'stars';
  const vertices = star ? sides * 2 : sides;
  const perEdge = Math.max(1, Math.round(1 + 4 * quality));
  const aspect = shape === 'rectangles' ? state.form.ellipseAspect : 1;
  const turn = (shape === 'squares' ? Math.PI / 4 : shape === 'diamonds' ? 0 : -Math.PI / 2) + rotation;
  const blend = clamp(morph, 0, 1);
  const corner = (index) => {
    const angle = turn + index / vertices * Math.PI * 2;
    let rr = radius;
    if (star) rr *= index % 2 === 0 ? 1 : state.form.starInner;
    if (shape === 'rounded') rr *= 0.86 + 0.14 * Math.cos(angle * sides);
    rr = rr * (1 - blend) + radius * blend;
    return { x: Math.cos(angle) * rr * aspect, y: Math.sin(angle) * rr };
  };
  const total = vertices * perEdge;
  for (let i = 0; i <= total; i += 1) {
    const position = i / perEdge;
    const from = Math.floor(position) % vertices;
    const to = (from + 1) % vertices;
    const t = position - Math.floor(position);
    const a = corner(from);
    const b = corner(to);
    points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return points;
}

function cycle(state, elapsed) {
  const count = Math.max(2, Math.round(state.width.period));
  const items = [];
  let span = 0;
  for (let index = 0; index < count; index += 1) {
    const w = progression(index, index / count, state.width, elapsed);
    const g = progression(index, index / count, state.gap, elapsed);
    items.push({ w, g });
    span += w + g;
  }
  return { items, span: Math.max(1, span) };
}

export function progression(index, spatial, spec, elapsed) {
  const period = Math.max(0.25, spec.period || 1);
  const phase = (spec.phase || 0) + elapsed * (spec.phaseSpeed || 0);
  const t = ((spec.space === 'spatial' ? spatial * period : index) / period) * (spec.direction < 0 ? -1 : 1) + phase;
  if (spec.curve === 'sequence') {
    const seq = spec.sequence?.length ? spec.sequence : [spec.base];
    const at = Math.abs(Math.floor(t * seq.length)) % seq.length;
    return clamp(seq[at], spec.min, spec.max);
  }
  const f = t - Math.floor(t);
  let wave = 0.5;
  if (spec.curve === 'uniform') wave = 0.5;
  else if (spec.curve === 'linear' || spec.curve === 'sawtooth') wave = f;
  else if (spec.curve === 'triangle') wave = 1 - Math.abs(f * 2 - 1);
  else if (spec.curve === 'sine') wave = 0.5 + 0.5 * Math.sin(f * Math.PI * 2);
  else if (spec.curve === 'exponential') wave = Math.pow(2, f) - 1;
  else if (spec.curve === 'alternating') wave = Math.floor(index + phase) % 2 ? 1 : 0;
  else if (spec.curve === 'stepped') wave = Math.floor(f * 4) / 3;
  else if (spec.curve === 'random') wave = hash(Math.floor(index + phase) * 17.13 + (spec.seed || 1));
  return clamp(spec.base + (wave * 2 - 1) * spec.amplitude, spec.min, spec.max);
}

function deform(points, state, elapsed) {
  for (const stage of state.deformations) {
    if (!stage.enabled) continue;
    const t = elapsed * (stage.speed || 0) + stage.phase;
    for (const point of points) applyStage(point, stage, t, elapsed, state.anim);
  }
}

function applyStage(point, stage, t, elapsed, anim) {
  const dx = point.x - (stage.centerX || 0);
  const dy = point.y - (stage.centerY || 0);
  const dist = Math.hypot(dx, dy) + 0.001;
  const fall = Math.exp(-dist / Math.max(20, stage.falloff || 280));
  if (stage.type === 'wave') {
    const angle = (stage.direction || 0) * Math.PI / 180;
    const along = point.x * Math.cos(angle) + point.y * Math.sin(angle);
    const amount = waveform(stage.wave || 'sine', along * (stage.frequency || 1) * 0.01 + t) * stage.strength;
    point.x += -Math.sin(angle) * amount;
    point.y += Math.cos(angle) * amount;
  } else if (stage.type === 'turbulence' || stage.type === 'warp') {
    const octaves = stage.type === 'warp' ? Math.max(stage.octaves || 3, 4) : (stage.octaves || 3);
    const scale = Math.max(0.0004, stage.scale || 0.01);
    const drift = elapsed * (anim.turbEvolve || 0);
    const nx = fbm(point.x * scale, point.y * scale, stage.seed || 1, octaves, t + drift);
    const ny = fbm(point.x * scale + 19, point.y * scale - 7, (stage.seed || 1) + 3, octaves, t + drift);
    point.x += (nx * 2 - 1) * stage.strength;
    point.y += (ny * 2 - 1) * stage.strength;
  } else if (stage.type === 'twist') {
    const turn = stage.strength * Math.PI / 180 * fall;
    const c = Math.cos(turn);
    const s = Math.sin(turn + t * 0.2);
    point.x = (stage.centerX || 0) + dx * c - dy * s;
    point.y = (stage.centerY || 0) + dx * s + dy * c;
  } else if (stage.type === 'ripple') {
    const amount = Math.sin(dist * (stage.frequency || 1) * 0.02 - t * 4) * stage.strength * Math.max(fall, 0.15);
    point.x += dx / dist * amount;
    point.y += dy / dist * amount;
  } else if (stage.type === 'pinch') {
    const pull = 1 + stage.strength * 0.004 * fall;
    point.x = (stage.centerX || 0) + dx * pull;
    point.y = (stage.centerY || 0) + dy * pull;
  } else if (stage.type === 'vortex') {
    const turn = stage.strength * Math.PI / 180 * fall;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    point.x = (stage.centerX || 0) + dx * c - dy * s;
    point.y = (stage.centerY || 0) + dx * s + dy * c;
  } else if (stage.type === 'shift') {
    const amount = stage.strength;
    if (stage.axis === 'vertical') point.y += amount * Math.sin(t);
    else if (stage.axis === 'tangential') {
      point.x += -dy / dist * amount * 0.15;
      point.y += dx / dist * amount * 0.15;
    } else if (stage.axis === 'radial') {
      point.x += dx / dist * amount * 0.15;
      point.y += dy / dist * amount * 0.15;
    } else point.x += amount * Math.sin(t);
  }
}

export function backgroundColor(state) {
  const color = tintBackground(state.color.bg, state.color.bgHue, state.color.bgBrightness);
  return state.color.invert ? paint(state.color.fg, state.color.hue, state.color.saturation, state.color.brightness, 0) : color;
}

function tintBackground(hex, hueShift, brightness) {
  const shift = Number(hueShift) || 0;
  const level = Number.isFinite(Number(brightness)) ? Number(brightness) : 1;
  if (!shift && level === 1) return hex;
  const hsl = hexToHsl(hex);
  hsl.h += shift;
  hsl.l = clamp(hsl.l * Math.max(0, level), 0, 1);
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

function strokeColor(state, t, elapsed) {
  const palettes = {
    cyan: ['#e8fbff', '#7ee7ff', '#3d8bfd'],
    magma: ['#fff3c4', '#ff7a3c', '#ff2d55'],
    ice: ['#ffffff', '#b8fff2', '#6ec8ff'],
    complement: ['#f4f7ff', '#d6ff6b', '#7aa2ff'],
  };
  let hex = state.color.fg;
  const palette = palettes[state.color.palette];
  if (palette && state.color.paletteMix > 0) hex = mixHex(hex, samplePalette(palette, t), state.color.paletteMix);
  const hue = state.color.hue + elapsed * state.anim.hue;
  const painted = paint(hex, hue, state.color.saturation, state.color.brightness, 0);
  return state.color.invert ? tintBackground(state.color.bg, state.color.bgHue, state.color.bgBrightness) : painted;
}

function paint(hex, hue, saturation, brightness, offset) {
  const hsl = hexToHsl(hex);
  hsl.h = hsl.h + hue + offset;
  hsl.s = clamp(hsl.s * saturation, 0, 1);
  hsl.l = clamp(hsl.l * Math.max(0, brightness) + (brightness < 0.2 ? brightness * 0.2 : 0), 0, 1);
  if (brightness <= 1) hsl.l = clamp(hsl.l * (0.35 + brightness * 0.65), 0, 1);
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

function waveKind(state) {
  if (state.form.shape === 'triangle-wave') return 'triangle';
  if (state.form.shape === 'saw') return 'saw';
  if (state.form.shape === 'square-wave') return 'square';
  if (state.form.shape === 'compound') return 'compound';
  if (state.form.shape === 'sine') return 'sine';
  return state.form.waveType || 'sine';
}

function waveform(type, t) {
  const f = t - Math.floor(t);
  if (type === 'triangle' || type === 'triangle-wave') return 1 - Math.abs(f * 2 - 1) * 2;
  if (type === 'saw' || type === 'sawtooth') return f * 2 - 1;
  if (type === 'square' || type === 'square-wave') return f < 0.5 ? 1 : -1;
  if (type === 'compound') return Math.sin(f * Math.PI * 2) * 0.65 + (1 - Math.abs(f * 2 - 1) * 2) * 0.35;
  return Math.sin(f * Math.PI * 2);
}

function energy(fft, from, to) {
  if (!fft?.length) return 0;
  const a = clamp(Math.floor(fft.length * clamp(from, 0, 1)), 0, fft.length - 1);
  const b = clamp(Math.floor(fft.length * clamp(to, 0, 1)), a + 1, fft.length);
  let sum = 0;
  for (let i = a; i < b; i += 1) sum += fft[i];
  return clamp(sum / ((b - a) * 255), 0, 1);
}

function waveformPeak(waveform) {
  if (!waveform?.length) return 0;
  let peak = 0;
  for (let i = 0; i < waveform.length; i += 1) peak = Math.max(peak, Math.abs(waveform[i] - 128) / 128);
  return clamp(peak, 0, 1);
}

function spectralCentroid(fft) {
  if (!fft?.length) return 0;
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < fft.length; i += 1) {
    sum += fft[i];
    weight += fft[i] * i;
  }
  if (sum <= 0) return 0;
  return clamp(weight / sum / fft.length, 0, 1);
}

export function estimatePitch(waveform, sampleRate = 48000) {
  if (!waveform || waveform.length < 64) return { hz: 0, confidence: 0 };
  const size = Math.min(waveform.length, 512);
  const samples = new Float32Array(size);
  let mean = 0;
  for (let i = 0; i < size; i += 1) {
    samples[i] = (waveform[i] - 128) / 128;
    mean += samples[i];
  }
  mean /= size;
  let energySum = 0;
  for (let i = 0; i < size; i += 1) {
    samples[i] -= mean;
    energySum += samples[i] * samples[i];
  }
  if (energySum < 0.01) return { hz: 0, confidence: 0 };
  const minLag = Math.max(2, Math.floor(sampleRate / 2000));
  const maxLag = Math.min(size - 2, Math.floor(sampleRate / 50));
  let best = 0;
  let bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let corr = 0;
    for (let i = 0; i < size - lag; i += 1) corr += samples[i] * samples[i + lag];
    const normalized = corr / energySum;
    if (normalized > best) {
      best = normalized;
      bestLag = lag;
    }
  }
  return { hz: sampleRate / bestLag, confidence: clamp(best, 0, 1) };
}

function fbm(x, y, seed, octaves, z) {
  let total = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  const count = clamp(Math.round(octaves || 1), 1, 6);
  for (let i = 0; i < count; i += 1) {
    total += amp * vnoise(x * freq + z, y * freq - z * 0.6, seed + i);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total / norm;
}

function vnoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;
  const sample = (ix, iy) => hash((ix + seed * 19) * 127.1 + (iy + seed) * 311.7);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = sample(x0, y0);
  const b = sample(x0 + 1, y0);
  const c = sample(x0, y0 + 1);
  const d = sample(x0 + 1, y0 + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function samplePalette(palette, t) {
  const scaled = clamp(t, 0, 0.999) * (palette.length - 1);
  const index = Math.floor(scaled);
  return mixHex(palette[index], palette[Math.min(palette.length - 1, index + 1)], scaled - index);
}

function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mix = (from, to) => Math.round(from + (to - from) * clamp(t, 0, 1));
  return rgbToHex(mix(ca.r, cb.r), mix(ca.g, cb.g), mix(ca.b, cb.b));
}

function hexToRgb(hex) {
  const value = String(hex || '#000').replace('#', '');
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value.padEnd(6, '0');
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const light = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function hash(n) {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
