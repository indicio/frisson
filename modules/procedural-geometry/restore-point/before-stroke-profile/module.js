/**
 * Procedural Geometry module.
 * Canvas 2D strokes. Deformations happen in geometry space before rasterization.
 */

import {
  backgroundColor,
  buildStrokes,
  cloneState,
  createAudioTracker,
  createModulator,
  presetById,
  sanitizeState,
} from './engine.js';
import { loadModuleState, saveModuleState } from '../../shared/moduleLocalState.js';
import { loadModuleStatePortable, saveModuleStatePortable } from '../../shared/portableStorage.js';

const MODULE_ID = 'procedural-geometry';
const canvas = document.getElementById('geometry');
const ctx = canvas.getContext('2d');

let state = sanitizeState(presetById('vortex-tunnel').state);
let audioAPI = null;
let controlsChannel = null;
let running = false;
let frameId = 0;
let elapsed = 0;
let lastTick = 0;
let saveTimer = 0;
let sampleRate = 48000;
const track = createAudioTracker();
const modulator = createModulator();
let metrics = track(null, null, 0, sampleRate);

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function onMessage(event) {
  const data = event.data;
  if (!data || data.type !== 'PARAM_CHANGE') {
    if (data?.type === 'AUDIO_UPDATE') {
      metrics = track(data.fftData, data.waveformData, data.audioLevel, sampleRate);
    } else if (data?.type === 'REQUEST_STATE') {
      publishState();
    }
    return;
  }
  if (data.param === 'state' && data.value && typeof data.value === 'object') setState(data.value, false);
  else applyControlParam(data.param, data.value);
}

const CONTROL_PATHS = {
  shape: 'form.shape',
  'form-sides': 'form.sides',
  'form-starPoints': 'form.starPoints',
  'form-starInner': 'form.starInner',
  'form-ellipseAspect': 'form.ellipseAspect',
  'form-spiralPitch': 'form.spiralPitch',
  'form-spiralTurns': 'form.spiralTurns',
  'form-spiralArms': 'form.spiralArms',
  'form-seed': 'form.seed',
  'form-waveType': 'form.waveType',
  'form-waveAmp': 'form.waveAmp',
  'form-waveFreq': 'form.waveFreq',
  'form-rotationStep': 'form.rotationStep',
  'form-rotation': 'form.rotation',
  'form-centerX': 'form.centerX',
  'form-centerY': 'form.centerY',
  'form-scale': 'form.scale',
  'form-limit': 'form.limit',
  'form-quality': 'form.quality',
  'form-morph': 'form.morph',
  'width-base': 'width.base',
  'width-min': 'width.min',
  'width-max': 'width.max',
  'width-amplitude': 'width.amplitude',
  'width-period': 'width.period',
  'width-phase': 'width.phase',
  'width-phaseSpeed': 'width.phaseSpeed',
  'width-curve': 'width.curve',
  'width-space': 'width.space',
  'width-direction': 'width.direction',
  'width-sequence': 'width.sequence',
  'width-seed': 'width.seed',
  'gap-base': 'gap.base',
  'gap-min': 'gap.min',
  'gap-max': 'gap.max',
  'gap-amplitude': 'gap.amplitude',
  'gap-period': 'gap.period',
  'gap-phase': 'gap.phase',
  'gap-phaseSpeed': 'gap.phaseSpeed',
  'gap-curve': 'gap.curve',
  'gap-space': 'gap.space',
  'gap-direction': 'gap.direction',
  'gap-sequence': 'gap.sequence',
  'gap-seed': 'gap.seed',
  'anim-speed': 'anim.speed',
  'anim-translateX': 'anim.translateX',
  'anim-translateY': 'anim.translateY',
  'anim-rotation': 'anim.rotation',
  'anim-expand': 'anim.expand',
  'anim-wavePhase': 'anim.wavePhase',
  'anim-turbEvolve': 'anim.turbEvolve',
  'anim-ripple': 'anim.ripple',
  'anim-hue': 'anim.hue',
  'anim-polyRot': 'anim.polyRot',
  'anim-morph': 'anim.morph',
  audioGain: 'audioGain',
  'color-fg': 'color.fg',
  'color-bg': 'color.bg',
  'color-hue': 'color.hue',
  'color-bgHue': 'color.bgHue',
  'color-saturation': 'color.saturation',
  'color-brightness': 'color.brightness',
  'color-bgBrightness': 'color.bgBrightness',
  'color-opacity': 'color.opacity',
  'color-palette': 'color.palette',
  'color-paletteMix': 'color.paletteMix',
  'color-invert': 'color.invert',
};

const WAVE_FOR_SHAPE = {
  sine: 'sine',
  'triangle-wave': 'triangle',
  saw: 'saw',
  'square-wave': 'square',
  compound: 'compound',
};

function applyControlParam(param, value) {
  if (param === 'preset' || param === 'presetName') {
    const found = presetById(String(value));
    if (found?.state) setState(found.state, false);
    return;
  }
  if (typeof param === 'string' && param.startsWith('preset-')) {
    const found = presetById(param.slice('preset-'.length));
    if (found?.state) setState(found.state, false);
    return;
  }
  const path = CONTROL_PATHS[param];
  if (!path) return;
  const next = cloneState(state);
  setByPath(next, path, coerceControl(path, value));
  if (path === 'form.shape' && WAVE_FOR_SHAPE[next.form.shape]) {
    next.form.waveType = WAVE_FOR_SHAPE[next.form.shape];
    if ((next.form.waveAmp || 0) < 8) next.form.waveAmp = 42;
  }
  next.presetId = null;
  setState(next, false);
}

function coerceControl(path, value) {
  if (path.endsWith('.sequence')) {
    return String(value).split(',').map((part) => Number(part.trim())).filter((item) => Number.isFinite(item));
  }
  if (path === 'color.invert') return Boolean(value);
  if (path === 'form.shape' || path === 'form.waveType' || path === 'color.palette' || path === 'color.fg' || path === 'color.bg' || path.endsWith('.curve') || path.endsWith('.space')) {
    return String(value);
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function setByPath(object, path, value) {
  const keys = path.split('.');
  let current = object;
  for (let i = 0; i < keys.length - 1; i += 1) current = current[keys[i]];
  current[keys[keys.length - 1]] = value;
}

function setState(next, persist = true) {
  state = sanitizeState(next);
  if (persist) scheduleSave();
}

function publishState() {
  controlsChannel?.postMessage({ type: 'GEOMETRY_STATE', state });
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveModuleState(MODULE_ID, state);
    void saveModuleStatePortable(MODULE_ID, state);
  }, 400);
}

function frame(now) {
  if (!running) return;
  const dt = Math.min(0.05, lastTick ? (now - lastTick) / 1000 : 0);
  lastTick = now;
  elapsed += dt * (state.anim.speed ?? 1);
  if (audioAPI?.getAudioContext) {
    const rate = audioAPI.getAudioContext()?.sampleRate;
    if (rate) sampleRate = rate;
  }
  if (audioAPI && !metrics.fft?.length) {
    metrics = track(audioAPI.getFFTData?.(), audioAPI.getWaveformData?.(), audioAPI.getAudioLevel?.() || 0, sampleRate);
  }
  const render = modulator.apply(state, metrics, dt, state.audioGain);
  draw(render, elapsed);
  frameId = requestAnimationFrame(frame);
}

function draw(render, time) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = backgroundColor(render);
  ctx.fillRect(0, 0, width, height);
  const cx = width * 0.5 + render.form.centerX * width * 0.25 + Math.sin(time * 0.15) * render.anim.translateX;
  const cy = height * 0.5 + render.form.centerY * height * 0.25;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(render.form.rotation * Math.PI / 180);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const strokes = buildStrokes(render, time);
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i += 1) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    ctx.strokeStyle = stroke.color;
    ctx.globalAlpha = stroke.alpha;
    ctx.lineWidth = Math.max(0.5, stroke.width);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

async function restore() {
  let saved = null;
  try { saved = await loadModuleStatePortable(MODULE_ID, null); } catch { saved = null; }
  if (!saved) saved = loadModuleState(MODULE_ID, null);
  if (saved?.form) state = sanitizeState(saved);
}

const moduleAPI = {
  async initModule({ audio, controlsChannel: channel }) {
    audioAPI = audio;
    controlsChannel = channel || null;
    if (controlsChannel) controlsChannel.onmessage = onMessage;
    window.addEventListener('message', onMessage);
    window.addEventListener('resize', resize);
    resize();
    await restore();
    publishState();
  },
  start() {
    if (running) return;
    running = true;
    lastTick = 0;
    frameId = requestAnimationFrame(frame);
  },
  stop() {
    running = false;
    cancelAnimationFrame(frameId);
    frameId = 0;
  },
  destroy() {
    moduleAPI.stop();
    clearTimeout(saveTimer);
    window.removeEventListener('message', onMessage);
    window.removeEventListener('resize', resize);
    if (controlsChannel) controlsChannel.onmessage = null;
  },
  updateParams(params) {
    if (!params) return;
    if (params.state) setState(params.state);
    else if (params.form) setState(params);
  },
};

window.moduleAPI = moduleAPI;
