/**
 * One iframe per mapped module. Instances share the viewer's audio analyser.
 * Placement runs from mappingOutput, and only while Mapping Mode is active.
 */

import * as audio from './audio.js';
import { getModuleFavoriteParams } from '../shared/favorites.js';
import { matrix3d, quadHomography } from '../shared/mapping/homography.js';
import { contentFrame, outlinePoints, surfaceAxes } from '../shared/mapping/scene.js';

const hosts = new Map();
let layer = null;
let active = false;
let pump = 0;

export function attach() {
  layer = document.getElementById('mapping-modules');
  if (layer) layer.hidden = !active;
}

let playing = true;

export function setPlaying(on) {
  playing = on !== false;
  for (const host of hosts.values()) {
    syncPlayback(host).catch((error) => console.error('Mapped playback failed', error));
  }
  if (playing && hosts.size) ensurePump();
  else if (!playing) stopPump();
}

export function setActive(on) {
  active = Boolean(on);
  if (layer) layer.hidden = !active;
  if (!active) clear();
}

export function sync(scene, metrics) {
  if (!layer) return;
  const visible = active && !metrics.blackout;
  layer.hidden = !visible;
  if (!visible) return;
  const live = new Set();
  for (const surface of scene.surfaces || []) {
    const moduleId = moduleAssignment(surface);
    if (!moduleId) continue;
    live.add(surface.id);
    let host = hosts.get(surface.id);
    if (!host || host.moduleId !== moduleId) {
      if (host) destroy(surface.id);
      host = create(surface, moduleId);
    }
    place(host, surface, metrics);
  }
  for (const id of [...hosts.keys()]) {
    if (!live.has(id)) destroy(id);
  }
  if (hosts.size === 0) stopPump();
}

function moduleAssignment(surface) {
  if (surface.visible === false) return '';
  const content = surface.content;
  if (!content || (content.kind !== 'module' && content.kind !== 'composition')) return '';
  return content.moduleId || '';
}

function create(surface, moduleId) {
  const frameEl = document.createElement('div');
  frameEl.style.position = 'absolute';
  frameEl.style.overflow = 'hidden';
  frameEl.style.pointerEvents = 'none';
  frameEl.style.transformOrigin = '0 0';
  const iframe = document.createElement('iframe');
  iframe.title = surface.name || moduleId;
  iframe.style.position = 'absolute';
  iframe.style.border = 'none';
  iframe.style.background = 'transparent';
  iframe.style.pointerEvents = 'none';
  iframe.style.visibility = 'hidden';
  frameEl.appendChild(iframe);
  layer.appendChild(frameEl);
  const host = {
    id: surface.id,
    moduleId,
    frameEl,
    iframe,
    generation: 1,
    api: null,
    channel: null,
    win: null,
    width: 0,
    height: 0,
    boxWidth: 0,
    boxHeight: 0,
    appliedPreset: null,
  };
  hosts.set(surface.id, host);
  boot(host).catch((error) => {
    console.error('Mapped module failed:', moduleId, error);
  });
  return host;
}

async function boot(host) {
  const generation = host.generation;
  host.iframe.src = `../modules/${host.moduleId}/index.html`;
  await waitForLoad(host.iframe);
  if (stale(host, generation)) return;
  const moduleWindow = host.iframe.contentWindow;
  const api = await waitForAPI(moduleWindow);
  if (stale(host, generation)) return;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('visualizer-controls') : null;
  host.channel = channel;
  await api.initModule({
    container: host.iframe.contentDocument.body,
    audio: audioBindings(),
    controlsChannel: channel,
  });
  if (stale(host, generation)) return;
  host.api = api;
  host.win = moduleWindow;
  host.iframe.style.visibility = 'visible';
  await syncPlayback(host);
  if (playing) ensurePump();
}

function syncPlayback(host) {
  if (!host.api) return Promise.resolve();
  const want = playing ? 'run' : 'stop';
  if (host.playback === want) return Promise.resolve();
  const method = playing ? host.api.start : host.api.stop;
  const run = typeof method === 'function' ? method.call(host.api) : null;
  return Promise.resolve(run).then(() => {
    host.playback = want;
  });
}

function stale(host, generation) {
  return host.generation !== generation || !hosts.has(host.id);
}

function audioBindings() {
  const read = (name, empty) => (typeof audio[name] === 'function' ? audio[name]() : empty);
  return {
    getFFTData: () => read('getFFTData', new Uint8Array(0)),
    getWaveformData: () => read('getWaveformData', new Uint8Array(0)),
    getNormalizedFFTData: () => read('getNormalizedFFTData', new Float32Array(0)),
    getAudioLevel: () => read('getAudioLevel', 0),
    getAudioContext: () => read('getAudioContext', null),
    getAnalyser: () => read('getAnalyser', null),
  };
}

function place(host, surface, metrics) {
  const { scaleX, scaleY } = metrics;
  host.frameEl.style.opacity = String(metrics.opacityFor ? metrics.opacityFor(surface) : (surface.opacity ?? 1));
  if (surface.type === 'quad' && surface.points?.length === 4) {
    const destination = surface.points.map((point) => ({ x: point.x * scaleX, y: point.y * scaleY }));
    const fitted = fitQuad(destination);
    if (fitted) {
      setBox(host, 0, 0, fitted.width, fitted.height);
      host.frameEl.style.transform = fitted.transform;
      host.frameEl.style.clipPath = 'none';
      placeContent(host, surface);
      applyPreset(host, surface);
      return;
    }
  }
  const samples = outlinePoints(surface, surface.anchors ? 16 : 48)
    .map((point) => ({ x: point.x * scaleX, y: point.y * scaleY }));
  const box = bounds(samples);
  const width = Math.max(2, box.width);
  const height = Math.max(2, box.height);
  setBox(host, box.x, box.y, width, height);
  host.frameEl.style.transform = 'none';
  const polygon = samples.map((point) => {
    const x = ((point.x - box.x) / width) * 100;
    const y = ((point.y - box.y) / height) * 100;
    return `${x}% ${y}%`;
  }).join(', ');
  host.frameEl.style.clipPath = `polygon(${polygon})`;
  placeContent(host, surface);
  applyPreset(host, surface);
}

function placeContent(host, surface) {
  const frame = contentFrame(surface);
  const iframe = host.iframe;
  iframe.style.left = `${frame.x}%`;
  iframe.style.top = `${frame.y}%`;
  iframe.style.width = `${frame.width}%`;
  iframe.style.height = `${frame.height}%`;
  const surfaceTurn = surface.type === 'quad' ? 0 : surfaceAxes(surface).angle * 180 / Math.PI;
  const turn = surfaceTurn + frame.rotation;
  iframe.style.transformOrigin = '50% 50%';
  iframe.style.transform = turn ? `rotate(${turn}deg)` : 'none';
  const width = host.boxWidth * frame.width / 100;
  const height = host.boxHeight * frame.height / 100;
  if (![width, height].every(Number.isFinite)) return;
  if (Math.abs(host.width - width) <= 2 && Math.abs(host.height - height) <= 2) return;
  host.width = width;
  host.height = height;
  const now = performance.now();
  const notify = () => {
    host.resizedAt = performance.now();
    host.win?.dispatchEvent(new Event('resize'));
  };
  if (now - (host.resizedAt || 0) > 200) {
    notify();
    return;
  }
  clearTimeout(host.resizeTimer);
  host.resizeTimer = setTimeout(notify, 200);
}

function applyPreset(host, surface) {
  const preset = surface.content?.preset || '';
  if (!host.api || host.appliedPreset === preset) return;
  host.appliedPreset = preset;
  if (!preset) return;
  const generation = host.generation;
  getModuleFavoriteParams(host.moduleId, preset).then((params) => {
    if (stale(host, generation) || host.appliedPreset !== preset || !params) return;
    if (host.api?.updateParams) {
      Promise.resolve(host.api.updateParams(params)).catch((error) => {
        console.error('Mapped preset failed', error);
      });
    }
    for (const [param, value] of Object.entries(params)) {
      const message = { type: 'PARAM_CHANGE', param, value };
      host.win?.postMessage(message, '*');
      host.channel?.postMessage(message);
    }
  }).catch((error) => console.error('Mapped preset failed', error));
}

function fitQuad(destination) {
  const box = bounds(destination);
  const width = Math.max(32, box.width);
  const height = Math.max(32, box.height);
  const local = destination.map((point) => ({ x: point.x - box.x, y: point.y - box.y }));
  const matrix = quadHomography(width, height, local);
  if (!matrix) return null;
  return { width, height, transform: `translate(${box.x}px, ${box.y}px) ${matrix3d(matrix)}` };
}

function setBox(host, x, y, width, height) {
  if (![x, y, width, height].every(Number.isFinite)) return;
  host.boxWidth = width;
  host.boxHeight = height;
  const frame = host.frameEl;
  frame.style.left = `${x}px`;
  frame.style.top = `${y}px`;
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
}

function bounds(points) {
  let x = Infinity;
  let y = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  points.forEach((point) => {
    x = Math.min(x, point.x);
    y = Math.min(y, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  });
  return { x, y, width: right - x, height: bottom - y };
}

function destroy(id) {
  const host = hosts.get(id);
  if (!host) return;
  host.generation += 1;
  hosts.delete(id);
  const api = host.api;
  host.api = null;
  clearTimeout(host.resizeTimer);
  host.channel?.close();
  host.frameEl.remove();
  if (api?.destroy) Promise.resolve(api.destroy()).catch(() => {});
}

function clear() {
  for (const id of [...hosts.keys()]) destroy(id);
  stopPump();
}

function ensurePump() {
  if (pump || typeof audio.getFFTData !== 'function') return;
  pump = setInterval(() => {
    const payload = {
      type: 'AUDIO_UPDATE',
      fftData: audio.getFFTData(),
      waveformData: typeof audio.getWaveformData === 'function' ? audio.getWaveformData() : new Uint8Array(0),
      audioLevel: typeof audio.getAudioLevel === 'function' ? audio.getAudioLevel() : 0,
    };
    for (const host of hosts.values()) host.win?.postMessage(payload, '*');
  }, 16);
}

function stopPump() {
  clearInterval(pump);
  pump = 0;
}

function waitForLoad(iframe) {
  return new Promise((resolve, reject) => {
    const finish = () => {
      iframe.removeEventListener('load', finish);
      iframe.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      iframe.removeEventListener('load', finish);
      iframe.removeEventListener('error', fail);
      reject(new Error('Module frame failed to load'));
    };
    iframe.addEventListener('load', finish);
    iframe.addEventListener('error', fail);
  });
}

function waitForAPI(moduleWindow) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      try {
        if (moduleWindow?.moduleAPI) {
          clearInterval(timer);
          resolve(moduleWindow.moduleAPI);
          return;
        }
      } catch (error) {
        clearInterval(timer);
        reject(error);
        return;
      }
      if (attempts >= 100) {
        clearInterval(timer);
        reject(new Error('Module API was not ready'));
      }
    }, 100);
  });
}
