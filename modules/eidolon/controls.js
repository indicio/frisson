import { Favorites } from '../../shared/favorites.js';

const MODULE_ID = 'eidolon';
let controlsChannel = null;

const RANGE_IDS = [
  'modelScale', 'opacity', 'orbitSpeed', 'cameraDistance', 'fov',
  'explosionAmount', 'explosionDistance', 'explosionSpread', 'explosionRandomness', 'explosionDirectionStrength',
  'orbitAmount', 'spiralAmount', 'floatAmount', 'turbulenceAmount',
  'reconstruction', 'homeAttraction',
  'audioSensitivity', 'audioAttack', 'audioRelease', 'audioDepth',
  'samplingPercent', 'renderScale',
];

const CHECK_IDS = ['autoOrbit', 'physicsEnabled'];
const SELECT_IDS = ['explosionDirection', 'reconstructionStyle', 'preset'];

function sendParamChange(param, value) {
  const payload = { type: 'PARAM_CHANGE', param, value };
  controlsChannel?.postMessage(payload);
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, '*');
  }
}

function sendAction(action) {
  sendParamChange('_action', action);
}

function bindRange(id, decimals = 2) {
  const el = document.getElementById(id);
  const label = document.getElementById(`${id}-v`);
  if (!el) return;
  const update = () => {
    const v = parseFloat(el.value);
    if (label) label.textContent = decimals === 0 ? String(Math.round(v)) : v.toFixed(decimals);
    sendParamChange(id, v);
  };
  el.addEventListener('input', update);
  update();
}

function getAllParams() {
  const p = {};
  for (const id of RANGE_IDS) {
    const el = document.getElementById(id);
    if (el) p[id] = parseFloat(el.value);
  }
  for (const id of CHECK_IDS) {
    const el = document.getElementById(id);
    if (el) p[id] = el.checked;
  }
  for (const id of SELECT_IDS) {
    const el = document.getElementById(id);
    if (el) p[id === 'preset' ? 'presetName' : id] = el.value;
  }
  return p;
}

function applyParams(params) {
  if (!params) return;
  for (const id of RANGE_IDS) {
    if (params[id] == null) continue;
    const el = document.getElementById(id);
    const label = document.getElementById(`${id}-v`);
    if (el) el.value = String(params[id]);
    if (label) {
      const decimals = id === 'samplingPercent' || id === 'fov' ? 0 : 2;
      label.textContent = decimals === 0 ? String(Math.round(params[id])) : Number(params[id]).toFixed(decimals);
    }
    sendParamChange(id, params[id]);
  }
  for (const id of CHECK_IDS) {
    if (typeof params[id] !== 'boolean') continue;
    const el = document.getElementById(id);
    if (el) el.checked = params[id];
    sendParamChange(id, params[id]);
  }
  if (params.reconstructionStyle) {
    const el = document.getElementById('reconstructionStyle');
    if (el) el.value = params.reconstructionStyle;
    sendParamChange('reconstructionStyle', params.reconstructionStyle);
  }
  if (params.explosionDirection) {
    const el = document.getElementById('explosionDirection');
    if (el) el.value = params.explosionDirection;
    sendParamChange('explosionDirection', params.explosionDirection);
  }
  if (params.presetName) {
    const el = document.getElementById('preset');
    if (el) el.value = params.presetName;
  }
}

async function init() {
  controlsChannel = new BroadcastChannel('visualizer-controls');
  controlsChannel.onmessage = (e) => {
    if (e.data?.type === 'PARAM_UPDATES') applyParams(e.data.updates);
  };

  RANGE_IDS.forEach((id) => {
    const decimals = id === 'samplingPercent' || id === 'fov' ? 0 : 2;
    bindRange(id, decimals);
  });

  CHECK_IDS.forEach((id) => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      sendParamChange(id, e.target.checked);
    });
  });

  document.getElementById('explosionDirection')?.addEventListener('change', (e) => {
    sendParamChange('explosionDirection', e.target.value);
  });
  document.getElementById('reconstructionStyle')?.addEventListener('change', (e) => {
    sendParamChange('reconstructionStyle', e.target.value);
  });
  document.getElementById('preset')?.addEventListener('change', (e) => {
    sendParamChange('preset', e.target.value);
  });

  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => sendAction(btn.getAttribute('data-action')));
  });

  document.getElementById('plyFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const payload = {
      type: 'LOAD_PLY_FILE',
      fileData: buf,
      fileName: file.name,
    };
    controlsChannel.postMessage(payload);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, '*');
    }
    e.target.value = '';
  });

  const favorites = new Favorites({ moduleId: MODULE_ID, getAllParams, applyParams });
  await favorites.init();
}

init();
