import { Favorites } from '../../shared/favorites.js';

const MODULE_ID = 'beholder';
let controlsChannel = null;

async function init() {
  controlsChannel = new BroadcastChannel('visualizer-controls');
  setupControls();

  const favorites = new Favorites({
    moduleId: MODULE_ID,
    getAllParams,
    applyParams,
    saveButtonId: 'saveFavoriteBtn',
    nameInputId: 'favoriteName',
  });
  await favorites.init();
}

function sendParamChange(param, value) {
  if (controlsChannel) {
    controlsChannel.postMessage({ type: 'PARAM_CHANGE', param, value });
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'PARAM_CHANGE', param, value }, '*');
  }
}

function bindRange(id, digits = 2) {
  const input = document.getElementById(id);
  const value = document.getElementById(`${id}-v`);
  if (!input) return;
  const update = () => {
    const n = parseFloat(input.value);
    if (value) value.textContent = Number.isFinite(n) ? n.toFixed(digits) : input.value;
    sendParamChange(id, n);
  };
  input.addEventListener('input', update);
  if (value) {
    const n = parseFloat(input.value);
    value.textContent = Number.isFinite(n) ? n.toFixed(digits) : input.value;
  }
}

function bindCheck(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener('change', () => sendParamChange(id, input.checked));
}

function bindColor(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener('input', () => sendParamChange(id, input.value));
}

function setupControls() {
  bindRange('focus', 1);
  bindRange('aperture', 3);
  bindRange('maxblur', 3);
  bindRange('swarmCount', 0);
  bindRange('baseSize', 2);
  bindRange('fogDensity', 3);
  bindRange('eyeHue', 2);
  bindRange('ambientLight', 2);
  bindRange('dynamicLights', 0);
  bindRange('maxTransposition', 2);
  bindRange('ambientSpeed', 2);

  bindCheck('autoTrack');
  bindCheck('soloMode');
  bindCheck('enableAmbient');
  bindCheck('moveInConcert');

  bindColor('bgColor');
  bindColor('rimColor');

  const rebuild = document.getElementById('rebuildEyes');
  if (rebuild) rebuild.addEventListener('click', () => sendParamChange('rebuildEyes', true));
}

function getAllParams() {
  const get = (id, fallback) => {
    const el = document.getElementById(id);
    if (!el) return fallback;
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'color') return el.value;
    return parseFloat(el.value);
  };
  return {
    autoTrack: get('autoTrack', true),
    focus: get('focus', 10),
    aperture: get('aperture', 0.02),
    maxblur: get('maxblur', 0.01),
    soloMode: get('soloMode', false),
    swarmCount: get('swarmCount', 15),
    baseSize: get('baseSize', 1),
    bgColor: get('bgColor', '#080808'),
    fogDensity: get('fogDensity', 0.015),
    eyeHue: get('eyeHue', 0),
    ambientLight: get('ambientLight', 1),
    rimColor: get('rimColor', '#ff1100'),
    dynamicLights: get('dynamicLights', 250),
    enableAmbient: get('enableAmbient', true),
    maxTransposition: get('maxTransposition', 1.2),
    ambientSpeed: get('ambientSpeed', 1),
    moveInConcert: get('moveInConcert', false),
  };
}

function applyParams(params) {
  Object.keys(params || {}).forEach((key) => {
    const el = document.getElementById(key);
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!params[key];
      el.dispatchEvent(new Event('change'));
    } else {
      el.value = params[key];
      if (el.type === 'color') el.dispatchEvent(new Event('input'));
      else el.dispatchEvent(new Event('input'));
    }
  });
}

function bootControls() {
  init().catch((e) => console.error('controls init failed', e));
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootControls);
} else {
  bootControls();
}
