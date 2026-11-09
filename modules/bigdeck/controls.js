/**
 * Big Deck Controls
 * UI for controlling the bigdeck card visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'bigdeck';

async function init() {
  controlsChannel = new BroadcastChannel('visualizer-controls');
  setupControls();

  const favorites = new Favorites({
    moduleId: MODULE_ID,
    getAllParams,
    applyParams,
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

function setupControls() {
  // Layout select
  setupSelect('layout', 'layout', (val) => updateLayoutVisibility(val));
  setupSelect('backTheme', 'backTheme');

  // Next layout button
  const nextLayoutBtn = document.getElementById('nextLayoutBtn');
  if (nextLayoutBtn) {
    nextLayoutBtn.addEventListener('click', () => {
      const layoutSelect = document.getElementById('layout');
      if (!layoutSelect) return;
      const opts = layoutSelect.options;
      const next = (layoutSelect.selectedIndex + 1) % opts.length;
      layoutSelect.selectedIndex = next;
      layoutSelect.dispatchEvent(new Event('change'));
    });
  }

  // Shuffle button
  const shuffleBtn = document.getElementById('shuffleBtn');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => sendParamChange('shuffle', true));
  }

  // Range sliders
  const sliders = [
    'cardCount', 'fieldSpread', 'ringRadius',
    'tunnelLength', 'tunnelRadius', 'gridRows', 'gridCols',
    'explodingRadius', 'sphereRadius',
    'fanRadius', 'fanAngle', 'fanTilt', 'fanLift',
    'helixRadius', 'helixHeight', 'helixTwists',
    'fogDensity', 'overallBrightness',
    'ambientIntensity', 'hemiIntensity',
    'keyLightIntensity', 'fillLightIntensity', 'rimLightIntensity',
    'cameraZoom', 'idleSpin',
    'rotationSpeedX', 'rotationSpeedY', 'rotationSpeedZ',
    'waveAmplitude', 'waveFrequency', 'pulseSpeed',
    'autoRotateSpeed', 'cardFlipSpeed',
    'bassReactivity', 'midReactivity', 'trebleReactivity',
    'audioSmoothing',
  ];
  sliders.forEach((id) => setupSlider(id, id));

  // Color inputs
  const bgColor = document.getElementById('backgroundColor');
  if (bgColor) {
    bgColor.addEventListener('input', (e) => sendParamChange('backgroundColor', e.target.value));
  }

  // Checkboxes
  setupCheckbox('autoRotate', 'autoRotate', () => {
    const group = document.getElementById('autoRotateSpeedGroup');
    const cb = document.getElementById('autoRotate');
    if (group && cb) group.style.display = cb.checked ? '' : 'none';
  });

  setupCheckbox('enableCardFlip', 'enableCardFlip', () => {
    const group = document.getElementById('cardFlipSpeedGroup');
    const cb = document.getElementById('enableCardFlip');
    if (group && cb) group.style.display = cb.checked ? '' : 'none';
  });

  setupCheckbox('audioEnabled', 'audioEnabled', () => {
    const controls = document.getElementById('audioControls');
    const cb = document.getElementById('audioEnabled');
    if (controls && cb) controls.style.display = cb.checked ? '' : 'none';
  });

  setupCheckbox('audioToPosition', 'audioToPosition');
  setupCheckbox('audioToRotation', 'audioToRotation');
  setupCheckbox('audioToScale', 'audioToScale');
  setupCheckbox('audioToCamera', 'audioToCamera');

  // Initialize layout visibility
  const layoutSelect = document.getElementById('layout');
  if (layoutSelect) updateLayoutVisibility(layoutSelect.value);
}

function setupSlider(id, param) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(`${id}-value`);
  if (!el) return;
  el.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (valEl) valEl.textContent = val % 1 === 0 ? val : val.toFixed(el.step && el.step.includes('.') ? el.step.split('.')[1].length : 1);
    sendParamChange(param, val);
  });
}

function setupSelect(id, param, cb) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', (e) => {
    sendParamChange(param, e.target.value);
    if (cb) cb(e.target.value);
  });
}

function setupCheckbox(id, param, cb) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', (e) => {
    sendParamChange(param, e.target.checked);
    if (cb) cb();
  });
}

function updateLayoutVisibility(layout) {
  const paramsContainer = document.getElementById('layoutParams');
  if (!paramsContainer) return;
  paramsContainer.classList.add('active');
  paramsContainer.querySelectorAll('.layout-params-group').forEach((g) => {
    g.style.display = g.dataset.layout === layout ? '' : 'none';
  });
}

function getAllParams() {
  const get = (id, fallback) => {
    const el = document.getElementById(id);
    if (!el) return fallback;
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'color') return el.value;
    if (el.tagName === 'SELECT') return el.value;
    return parseFloat(el.value);
  };

  return {
    layout: get('layout', 'field'),
    cardCount: get('cardCount', 52),
    fieldSpread: get('fieldSpread', 12),
    ringRadius: get('ringRadius', 7),
    tunnelLength: get('tunnelLength', 40),
    tunnelRadius: get('tunnelRadius', 5),
    gridRows: get('gridRows', 5),
    gridCols: get('gridCols', 10),
    explodingRadius: get('explodingRadius', 15),
    sphereRadius: get('sphereRadius', 8),
    fanRadius: get('fanRadius', 6),
    fanAngle: get('fanAngle', 120),
    fanTilt: get('fanTilt', 35),
    fanLift: get('fanLift', 0.4),
    helixRadius: get('helixRadius', 5),
    helixHeight: get('helixHeight', 16),
    helixTwists: get('helixTwists', 3),
    backTheme: get('backTheme', 'blue'),
    fogDensity: get('fogDensity', 0.008),
    backgroundColor: get('backgroundColor', '#020309'),
    overallBrightness: get('overallBrightness', 1.6),
    ambientIntensity: get('ambientIntensity', 2.4),
    hemiIntensity: get('hemiIntensity', 0.8),
    keyLightIntensity: get('keyLightIntensity', 2.2),
    fillLightIntensity: get('fillLightIntensity', 2.2),
    rimLightIntensity: get('rimLightIntensity', 1.8),
    cameraZoom: get('cameraZoom', 18),
    idleSpin: get('idleSpin', 0.15),
    rotationSpeedX: get('rotationSpeedX', 0.2),
    rotationSpeedY: get('rotationSpeedY', 0.5),
    rotationSpeedZ: get('rotationSpeedZ', 0.1),
    waveAmplitude: get('waveAmplitude', 2.0),
    waveFrequency: get('waveFrequency', 1.0),
    pulseSpeed: get('pulseSpeed', 1.0),
    autoRotate: get('autoRotate', false),
    autoRotateSpeed: get('autoRotateSpeed', 0.5),
    enableCardFlip: get('enableCardFlip', false),
    cardFlipSpeed: get('cardFlipSpeed', 1.0),
    audioEnabled: get('audioEnabled', false),
    bassReactivity: get('bassReactivity', 1.0),
    midReactivity: get('midReactivity', 0.8),
    trebleReactivity: get('trebleReactivity', 0.6),
    audioToPosition: get('audioToPosition', true),
    audioToRotation: get('audioToRotation', true),
    audioToScale: get('audioToScale', false),
    audioToCamera: get('audioToCamera', false),
    audioSmoothing: get('audioSmoothing', 0.7),
  };
}

function applyParams(params) {
  Object.keys(params).forEach((key) => {
    const el = document.getElementById(key);
    if (!el) return;
    if (el.type === 'range' || el.type === 'number') {
      el.value = params[key];
      el.dispatchEvent(new Event('input'));
    } else if (el.type === 'color') {
      el.value = params[key];
      el.dispatchEvent(new Event('input'));
    } else if (el.tagName === 'SELECT') {
      el.value = params[key];
      el.dispatchEvent(new Event('change'));
    } else if (el.type === 'checkbox') {
      el.checked = params[key];
      el.dispatchEvent(new Event('change'));
    }
  });
}

// Initialize when DOM is ready
function bootControls() {
  init().catch((e) => console.error('controls init failed', e));
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootControls);
} else {
  bootControls();
}
