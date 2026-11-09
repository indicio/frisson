/**
 * Iframe-side view of the shell's audio and video inputs.
 * The parent pushes FFT frames with AUDIO_UPDATE and the camera stream
 * with attachStream / VIDEO_STREAM. Modules read this instead of calling
 * getUserMedia themselves.
 */

const state = {
  fft: null,
  waveform: null,
  level: 0,
  video: null,
};

const cameraListeners = new Set();
let videoEl = null;
let listening = false;

function videoElement() {
  if (videoEl || typeof document === 'undefined') return videoEl;
  videoEl = document.createElement('video');
  videoEl.autoplay = true;
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.setAttribute('playsinline', '');
  videoEl.style.cssText = 'position:fixed;left:-2400px;top:0;width:1280px;height:720px;opacity:0;pointer-events:none';
  const mount = () => {
    if (!videoEl.parentNode) (document.body || document.documentElement).appendChild(videoEl);
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
  return videoEl;
}

function emitVideo() {
  cameraListeners.forEach((fn) => {
    try { fn(state.video); } catch (error) { console.warn(error); }
  });
}

function resample(src, target) {
  if (src.length === target.length) {
    target.set(src);
    return;
  }
  const last = src.length - 1;
  for (let i = 0; i < target.length; i++) {
    target[i] = src[Math.min(last, Math.floor((i * src.length) / target.length))];
  }
}

export function attachStream(stream) {
  const el = videoElement();
  if (!el) return;
  if (!stream) {
    if (el.srcObject) el.srcObject = null;
    state.video = null;
    emitVideo();
    return;
  }
  if (el.srcObject !== stream) el.srcObject = stream;
  state.video = el;
  el.play().catch(() => {});
  emitVideo();
}

function onMessage(event) {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'AUDIO_UPDATE') {
    state.fft = data.fftData && data.fftData.length ? data.fftData : null;
    state.waveform = data.waveformData && data.waveformData.length ? data.waveformData : null;
    state.level = Number(data.audioLevel) || 0;
  } else if (data.type === 'VIDEO_STREAM') {
    attachStream(data.stream || null);
  } else if (data.type === 'VIDEO_STOP') {
    attachStream(null);
  }
}

function start() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('message', onMessage);
}

export function fillFrequency(target) {
  start();
  if (!state.fft || !state.fft.length || !target) return false;
  resample(state.fft, target);
  return true;
}

export function fillWaveform(target) {
  start();
  if (!state.waveform || !state.waveform.length || !target) return false;
  resample(state.waveform, target);
  return true;
}

export function bindCamera(apply) {
  start();
  cameraListeners.add(apply);
  try { apply(state.video); } catch (error) { console.warn(error); }
  return () => cameraListeners.delete(apply);
}

const api = {
  fft() { start(); return state.fft; },
  waveform() { start(); return state.waveform; },
  level() { start(); return state.level; },
  video() {
    start();
    return state.video && state.video.readyState >= 2 ? state.video : null;
  },
  fillFrequency,
  fillWaveform,
  bindCamera,
  attachStream,
};

start();
if (typeof window !== 'undefined') {
  window.frissonMedia = api;
  window.dispatchEvent(new Event('frisson-media-ready'));
}
