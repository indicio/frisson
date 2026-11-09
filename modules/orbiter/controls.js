/**
 * Orbiter Controls
 * UI for controlling the orbiter visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'orbiter';

/**
 * Initialize controls
 */
async function init() {
  // Set up BroadcastChannel for communication
  controlsChannel = new BroadcastChannel('visualizer-controls');

  // Set up all control inputs
  setupControls();

  // Set up shared favorites
  const favorites = new Favorites({
    moduleId: MODULE_ID,
    getAllParams,
    applyParams,
    listContainerId: 'favoritesList',
  });
  await favorites.init();
}

/**
 * Set up control inputs
 */
function setupControls() {
  // Rotation Mode
  const rotationModeSelect = document.getElementById('rotationMode');
  rotationModeSelect.addEventListener('change', (e) => {
    sendParamChange('rotationMode', e.target.value);
  });

  // Circle Mode
  const circleModeSelect = document.getElementById('circleMode');
  circleModeSelect.addEventListener('change', (e) => {
    sendParamChange('circleMode', e.target.value);
  });

  // Emitter Shape
  const emitterShapeSelect = document.getElementById('emitterShape');
  emitterShapeSelect.addEventListener('change', (e) => {
    sendParamChange('emitterShape', e.target.value);
  });

  // Circle Radius
  const circleRadiusSlider = document.getElementById('circleRadius');
  const circleRadiusValue = document.getElementById('circleRadius-value');
  circleRadiusSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    circleRadiusValue.textContent = value;
    sendParamChange('circleRadius', value);
  });

  // Rotation Speed
  const rotSpeedSlider = document.getElementById('rotSpeed');
  const rotSpeedValue = document.getElementById('rotSpeed-value');
  rotSpeedSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    rotSpeedValue.textContent = value.toFixed(2);
    sendParamChange('rotSpeed', value);
  });

  // Sensitivity
  const sensitivitySlider = document.getElementById('sensitivity');
  const sensitivityValue = document.getElementById('sensitivity-value');
  sensitivitySlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    sensitivityValue.textContent = value.toFixed(2);
    sendParamChange('sensitivity', value);
  });

  // Frequency Min
  const freqMinSlider = document.getElementById('freqMin');
  const freqMinValue = document.getElementById('freqMin-value');
  freqMinSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    freqMinValue.textContent = value + '%';
    sendParamChange('freqMin', value / 100);
  });

  // Frequency Max
  const freqMaxSlider = document.getElementById('freqMax');
  const freqMaxValue = document.getElementById('freqMax-value');
  freqMaxSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    freqMaxValue.textContent = value + '%';
    sendParamChange('freqMax', value / 100);
  });

  // Particle Shape
  const particleShapeSelect = document.getElementById('particleShape');
  const lineLenGroup = document.getElementById('lineLenGroup');
  const lineOriGroup = document.getElementById('lineOriGroup');
  particleShapeSelect.addEventListener('change', (e) => {
    const value = e.target.value;
    if (value === "line") {
      lineLenGroup.style.display = "";
      lineOriGroup.style.display = "";
    } else {
      lineLenGroup.style.display = "none";
      lineOriGroup.style.display = "none";
    }
    sendParamChange('particleShape', value);
  });

  // Particle Rate
  const particleRateSlider = document.getElementById('particleRate');
  const particleRateValue = document.getElementById('particleRate-value');
  particleRateSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    particleRateValue.textContent = value;
    sendParamChange('particleRate', value);
  });

  // Particle Size
  const particleSizeSlider = document.getElementById('particleSize');
  const particleSizeValue = document.getElementById('particleSize-value');
  particleSizeSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    particleSizeValue.textContent = value.toFixed(2);
    sendParamChange('particleSize', value);
  });

  // Line Length
  const lineLenSlider = document.getElementById('lineLen');
  const lineLenValue = document.getElementById('lineLen-value');
  lineLenSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    lineLenValue.textContent = value.toFixed(2);
    sendParamChange('lineLen', value);
  });

  // Line Orientation
  const lineOriSelect = document.getElementById('lineOri');
  lineOriSelect.addEventListener('change', (e) => {
    sendParamChange('lineOri', e.target.value);
  });

  // Decay Rate
  const decayRateSlider = document.getElementById('decayRate');
  const decayRateValue = document.getElementById('decayRate-value');
  decayRateSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    decayRateValue.textContent = value.toFixed(3);
    sendParamChange('decayRate', value);
  });

  // Color Theme
  const colorThemeSelect = document.getElementById('colorTheme');
  colorThemeSelect.addEventListener('change', (e) => {
    sendParamChange('currentTheme', e.target.value);
  });

  // Background Color
  const backgroundColorInput = document.getElementById('backgroundColor');
  backgroundColorInput.addEventListener('input', (e) => {
    sendParamChange('backgroundColor', e.target.value);
  });

  // Randomize Button
  const randomizeBtn = document.getElementById('randomizeBtn');
  randomizeBtn.addEventListener('click', () => {
    randomizeControls();
  });
}

/**
 * Randomize all controls
 */
function randomizeControls() {
  function randRange(min, max, step = 1) {
    const nSteps = Math.floor((max - min) / step);
    return min + step * Math.floor(Math.random() * (nSteps + 1));
  }

  function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const themes = ['spectrum', 'rainbow', 'neon', 'ice', 'fire', 'cosmic'];
  const shapes = ['circle', 'cube', 'sphere'];
  const particleShapes = ['sphere', 'square', 'line'];
  const circleModes = ['static', 'audio-size'];
  const rotationModes = ['auto', 'manual', 'audio-orbit'];

  // Set random values
  document.getElementById('circleRadius').value = randRange(4, 20, 1);
  document.getElementById('circleRadius').dispatchEvent(new Event('input'));

  document.getElementById('rotSpeed').value = randRange(0.07, 1.0, 0.01);
  document.getElementById('rotSpeed').dispatchEvent(new Event('input'));

  document.getElementById('sensitivity').value = randRange(0.08, 0.5, 0.01);
  document.getElementById('sensitivity').dispatchEvent(new Event('input'));

  document.getElementById('freqMin').value = randRange(0, 45, 1);
  document.getElementById('freqMin').dispatchEvent(new Event('input'));

  document.getElementById('freqMax').value = randRange(55, 100, 1);
  document.getElementById('freqMax').dispatchEvent(new Event('input'));

  document.getElementById('particleSize').value = randRange(0.10, 0.45, 0.01);
  document.getElementById('particleSize').dispatchEvent(new Event('input'));

  document.getElementById('decayRate').value = randRange(0.007, 0.045, 0.001);
  document.getElementById('decayRate').dispatchEvent(new Event('input'));

  document.getElementById('particleRate').value = randRange(1, 8, 1);
  document.getElementById('particleRate').dispatchEvent(new Event('input'));

  document.getElementById('colorTheme').value = randChoice(themes);
  document.getElementById('colorTheme').dispatchEvent(new Event('change'));

  document.getElementById('emitterShape').value = randChoice(shapes);
  document.getElementById('emitterShape').dispatchEvent(new Event('change'));

  document.getElementById('particleShape').value = randChoice(particleShapes);
  document.getElementById('particleShape').dispatchEvent(new Event('change'));

  document.getElementById('circleMode').value = randChoice(circleModes);
  document.getElementById('circleMode').dispatchEvent(new Event('change'));

  document.getElementById('rotationMode').value = randChoice(rotationModes);
  document.getElementById('rotationMode').dispatchEvent(new Event('change'));
}

/**
 * Send parameter change message
 */
function sendParamChange(param, value) {
  if (controlsChannel) {
    controlsChannel.postMessage({
      type: 'PARAM_CHANGE',
      param: param,
      value: value
    });
  }

  // Also send to parent window (if in iframe)
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'PARAM_CHANGE',
      param: param,
      value: value
    }, '*');
  }
}

/**
 * Get all current parameter values
 */
function getAllParams() {
  return {
    rotationMode: document.getElementById('rotationMode')?.value || 'auto',
    circleMode: document.getElementById('circleMode')?.value || 'static',
    emitterShape: document.getElementById('emitterShape')?.value || 'sphere',
    circleRadius: parseInt(document.getElementById('circleRadius')?.value || '7'),
    rotSpeed: parseFloat(document.getElementById('rotSpeed')?.value || '0.24'),
    sensitivity: parseFloat(document.getElementById('sensitivity')?.value || '0.18'),
    freqMin: parseInt(document.getElementById('freqMin')?.value || '8'),
    freqMax: parseInt(document.getElementById('freqMax')?.value || '78'),
    particleShape: document.getElementById('particleShape')?.value || 'sphere',
    particleRate: parseInt(document.getElementById('particleRate')?.value || '2'),
    particleSize: parseFloat(document.getElementById('particleSize')?.value || '0.25'),
    lineLen: parseFloat(document.getElementById('lineLen')?.value || '0.7'),
    lineOri: document.getElementById('lineOri')?.value || 'along',
    decayRate: parseFloat(document.getElementById('decayRate')?.value || '0.022'),
    currentTheme: document.getElementById('colorTheme')?.value || 'spectrum',
    backgroundColor: document.getElementById('backgroundColor')?.value || '#000000'
  };
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  if (params.rotationMode !== undefined) {
    const el = document.getElementById('rotationMode');
    if (el) el.value = params.rotationMode;
    el?.dispatchEvent(new Event('change'));
  }
  if (params.circleMode !== undefined) {
    const el = document.getElementById('circleMode');
    if (el) el.value = params.circleMode;
    el?.dispatchEvent(new Event('change'));
  }
  if (params.emitterShape !== undefined) {
    const el = document.getElementById('emitterShape');
    if (el) el.value = params.emitterShape;
    el?.dispatchEvent(new Event('change'));
  }
  if (params.circleRadius !== undefined) {
    const el = document.getElementById('circleRadius');
    const valEl = document.getElementById('circleRadius-value');
    if (el) el.value = params.circleRadius;
    if (valEl) valEl.textContent = params.circleRadius;
    el?.dispatchEvent(new Event('input'));
  }
  if (params.rotSpeed !== undefined) {
    const el = document.getElementById('rotSpeed');
    const valEl = document.getElementById('rotSpeed-value');
    if (el) el.value = params.rotSpeed;
    if (valEl) valEl.textContent = params.rotSpeed.toFixed(2);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.sensitivity !== undefined) {
    const el = document.getElementById('sensitivity');
    const valEl = document.getElementById('sensitivity-value');
    if (el) el.value = params.sensitivity;
    if (valEl) valEl.textContent = params.sensitivity.toFixed(2);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.freqMin !== undefined) {
    const el = document.getElementById('freqMin');
    const valEl = document.getElementById('freqMin-value');
    if (el) el.value = params.freqMin;
    if (valEl) valEl.textContent = params.freqMin + '%';
    el?.dispatchEvent(new Event('input'));
  }
  if (params.freqMax !== undefined) {
    const el = document.getElementById('freqMax');
    const valEl = document.getElementById('freqMax-value');
    if (el) el.value = params.freqMax;
    if (valEl) valEl.textContent = params.freqMax + '%';
    el?.dispatchEvent(new Event('input'));
  }
  if (params.particleShape !== undefined) {
    const el = document.getElementById('particleShape');
    if (el) el.value = params.particleShape;
    el?.dispatchEvent(new Event('change'));
  }
  if (params.particleRate !== undefined) {
    const el = document.getElementById('particleRate');
    const valEl = document.getElementById('particleRate-value');
    if (el) el.value = params.particleRate;
    if (valEl) valEl.textContent = params.particleRate;
    el?.dispatchEvent(new Event('input'));
  }
  if (params.particleSize !== undefined) {
    const el = document.getElementById('particleSize');
    const valEl = document.getElementById('particleSize-value');
    if (el) el.value = params.particleSize;
    if (valEl) valEl.textContent = params.particleSize.toFixed(2);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.lineLen !== undefined) {
    const el = document.getElementById('lineLen');
    const valEl = document.getElementById('lineLen-value');
    if (el) el.value = params.lineLen;
    if (valEl) valEl.textContent = params.lineLen.toFixed(2);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.lineOri !== undefined) {
    const el = document.getElementById('lineOri');
    if (el) el.value = params.lineOri;
    el?.dispatchEvent(new Event('change'));
  }
  if (params.decayRate !== undefined) {
    const el = document.getElementById('decayRate');
    const valEl = document.getElementById('decayRate-value');
    if (el) el.value = params.decayRate;
    if (valEl) valEl.textContent = params.decayRate.toFixed(3);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.currentTheme !== undefined) {
    const el = document.getElementById('colorTheme');
    if (el) el.value = params.currentTheme;
    el?.dispatchEvent(new Event('change'));
  }
  if (params.backgroundColor !== undefined) {
    const el = document.getElementById('backgroundColor');
    if (el) el.value = params.backgroundColor;
    el?.dispatchEvent(new Event('input'));
  }
}


// Initialize on load
function bootControls() {
  init().catch((e) => console.error('controls init failed', e));
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootControls);
} else {
  bootControls();
}

