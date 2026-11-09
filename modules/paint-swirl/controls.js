import { Favorites } from '../../shared/favorites.js';

const MODULE_ID = 'paint-swirl';
let controlsChannel = null;

const SLIDER_PARAMS = [
  { id: 'speed', parse: parseFloat, format: (v) => v.toFixed(2) },
  { id: 'swirl', parse: parseFloat, format: (v) => v.toFixed(2) },
  { id: 'stretch', parse: parseFloat, format: (v) => v.toFixed(2) },
  { id: 'detail', parse: parseFloat, format: (v) => v.toFixed(2) },
  { id: 'edges', parse: parseFloat, format: (v) => v.toFixed(2) },
  { id: 'variety', parse: parseFloat, format: (v) => v.toFixed(2) },
  { id: 'audioReactivity', parse: parseFloat, format: (v) => v.toFixed(2) },
  { id: 'autoRandAll', parse: (v) => +v, format: (v) => v === 0 ? 'Off' : v + 's' },
  { id: 'autoRandColors', parse: (v) => +v, format: (v) => v === 0 ? 'Off' : v + 's' },
];

const COLOR_PARAMS = ['color1', 'color2', 'color3', 'color4'];

const DEFAULTS = {
  palettePreset: 'marbling',
  color1: '#f04d4d',
  color2: '#f4a040',
  color3: '#3498db',
  color4: '#2ecc71',
  speed: 0.55,
  swirl: 1.35,
  stretch: 1.65,
  detail: 1.3,
  edges: 0.85,
  variety: 0.5,
  audioReactivity: 0.5,
  mouseSim: 'none',
  autoRandAll: 0,
  autoRandColors: 0,
};

async function init() {
  controlsChannel = new BroadcastChannel('visualizer-controls');
  controlsChannel.onmessage = handleModuleMessage;
  window.addEventListener('message', handleModuleMessage);

  setupControls();

  const favorites = new Favorites({
    moduleId: MODULE_ID,
    getAllParams,
    applyParams,
  });
  await favorites.init();

  updateConnectionStatus(true);
}

function updateConnectionStatus(connected) {
  const el = document.getElementById('connectionStatus');
  if (!el) return;
  el.textContent = connected ? 'Connected to visualization' : 'Waiting for visualization...';
  el.className = 'connection-status ' + (connected ? 'connected' : 'disconnected');
}

function setValueDisplay(id, value, format) {
  const el = document.getElementById(`${id}-value`);
  if (el) el.textContent = format(value);
}

function setupControls() {
  SLIDER_PARAMS.forEach(({ id, parse, format }) => {
    const slider = document.getElementById(id);
    if (!slider) return;
    slider.addEventListener('input', (e) => {
      const value = parse(e.target.value);
      setValueDisplay(id, value, format);
      sendParamChange(id, value);
    });
  });

  COLOR_PARAMS.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      setValueDisplay(id, value, (v) => v);
      sendParamChange(id, value);
      const presetEl = document.getElementById('palettePreset');
      if (presetEl && presetEl.value !== 'custom') {
        presetEl.value = 'custom';
        sendParamChange('palettePreset', 'custom');
      }
    });
  });

  const palettePreset = document.getElementById('palettePreset');
  if (palettePreset) {
    palettePreset.addEventListener('change', (e) => {
      sendParamChange('palettePreset', e.target.value);
      if (e.target.value !== 'custom') {
        sendParamChange('_action', { action: 'applyPreset', preset: e.target.value });
      }
    });
  }

  document.getElementById('randomizeColorsBtn')?.addEventListener('click', () => {
    sendParamChange('_action', { action: 'randomizeColors' });
  });

  document.getElementById('randomizeSeedBtn')?.addEventListener('click', () => {
    sendParamChange('_action', { action: 'randomizeSeed' });
  });

  document.getElementById('randomizeSettingsBtn')?.addEventListener('click', () => {
    sendParamChange('_action', { action: 'randomizeSettings' });
  });

  const mouseSim = document.getElementById('mouseSim');
  if (mouseSim) {
    mouseSim.addEventListener('change', (e) => {
      sendParamChange('mouseSim', e.target.value);
    });
  }
}

function handleModuleMessage(event) {
  if (event.data?.type === 'PARAM_UPDATES') {
    applyParamsToUI(event.data.updates || {}, false);
  }
}

function sendParamChange(param, value) {
  const payload = param === '_action'
    ? { type: 'PARAM_CHANGE', param: '_action', value: value.action, data: value }
    : { type: 'PARAM_CHANGE', param, value };

  controlsChannel?.postMessage(payload);

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, '*');
  }
}

function getAllParams() {
  const result = { ...DEFAULTS };

  const presetEl = document.getElementById('palettePreset');
  if (presetEl) result.palettePreset = presetEl.value;

  COLOR_PARAMS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) result[id] = el.value;
  });

  SLIDER_PARAMS.forEach(({ id, parse }) => {
    const el = document.getElementById(id);
    if (el) result[id] = parse(el.value);
  });

  const mouseSim = document.getElementById('mouseSim');
  if (mouseSim) result.mouseSim = mouseSim.value;

  return result;
}

function applyParamsToUI(params, sendToModule = true) {
  if (params.palettePreset !== undefined) {
    const el = document.getElementById('palettePreset');
    if (el) el.value = params.palettePreset;
  }

  if (params.mouseSim !== undefined) {
    const el = document.getElementById('mouseSim');
    if (el) el.value = params.mouseSim;
  }

  COLOR_PARAMS.forEach((id) => {
    if (params[id] === undefined) return;
    const el = document.getElementById(id);
    if (el) el.value = params[id];
    setValueDisplay(id, params[id], (v) => v);
  });

  SLIDER_PARAMS.forEach(({ id, format }) => {
    if (params[id] === undefined) return;
    const el = document.getElementById(id);
    if (el) el.value = params[id];
    setValueDisplay(id, params[id], format);
  });

  if (sendToModule) {
    Object.entries(params).forEach(([key, value]) => {
      sendParamChange(key, value);
    });
  }
}

function applyParams(params) {
  applyParamsToUI(params, true);
}

function bootControls() {
  init().catch((e) => console.error('controls init failed', e));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootControls);
} else {
  bootControls();
}
