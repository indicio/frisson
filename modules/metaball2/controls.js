/**
 * Metaball2 Controls
 * UI for controlling the metaball2 visualization
 */

import { generateRandomPalette } from '../../shared/colorPalette.js';
import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'metaball2';

/**
 * Initialize controls
 */
async function init() {
  // Set up BroadcastChannel for communication
  controlsChannel = new BroadcastChannel('visualizer-controls');

  // Set up all control inputs
  setupControls();

  // Set up favorites functionality
  const favorites = new Favorites({
    moduleId: MODULE_ID,
    getAllParams,
    applyParams,
  });
  await favorites.init();
}

/**
 * Presets configuration
 */
const presets = {
  default: {
    speed: 1.0,
    ballCount: 5,
    lowSens: 1.0,
    midSens: 1.0,
    highSens: 1.0,
    masterAudioGain: 1.0,
    threshold: 1.5,
    glow: 0.5,
    baseSize: 0.25,
    color1: '#3366ff',
    color2: '#ff3399',
    bgColor: '#000000'
  },
  calm: {
    speed: 0.5,
    ballCount: 4,
    lowSens: 0.7,
    midSens: 0.7,
    highSens: 0.5,
    masterAudioGain: 0.9,
    threshold: 1.7,
    glow: 0.8,
    baseSize: 0.3,
    color1: '#00ffc3',
    color2: '#0077ff',
    bgColor: '#020619'
  },
  aggressive: {
    speed: 2.0,
    ballCount: 8,
    lowSens: 2.0,
    midSens: 2.0,
    highSens: 2.0,
    masterAudioGain: 1.5,
    threshold: 1.2,
    glow: 1.5,
    baseSize: 0.22,
    color1: '#ff3b3b',
    color2: '#ffff00',
    bgColor: '#050000'
  },
  nebula: {
    speed: 0.8,
    ballCount: 7,
    lowSens: 1.5,
    midSens: 1.2,
    highSens: 1.0,
    masterAudioGain: 1.2,
    threshold: 1.4,
    glow: 1.2,
    baseSize: 0.28,
    color1: '#7b2cff',
    color2: '#ff6af1',
    bgColor: '#050016'
  }
};

/**
 * Set up control inputs
 */
function setupControls() {
  // Speed
  const speedSlider = document.getElementById('speed');
  const speedValue = document.getElementById('speed-value');
  speedSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    speedValue.textContent = `${value.toFixed(1)}x`;
    sendParamChange('speed', value);
  });

  // Ball Count
  const ballCountSlider = document.getElementById('ballCount');
  const ballCountValue = document.getElementById('ballCount-value');
  ballCountSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    ballCountValue.textContent = value;
    sendParamChange('ballCount', value);
  });

  // Low Sensitivity
  const lowSensSlider = document.getElementById('lowSens');
  const lowSensValue = document.getElementById('lowSens-value');
  lowSensSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    lowSensValue.textContent = `${value.toFixed(1)}x`;
    sendParamChange('lowSens', value);
  });

  // Mid Sensitivity
  const midSensSlider = document.getElementById('midSens');
  const midSensValue = document.getElementById('midSens-value');
  midSensSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    midSensValue.textContent = `${value.toFixed(1)}x`;
    sendParamChange('midSens', value);
  });

  // High Sensitivity
  const highSensSlider = document.getElementById('highSens');
  const highSensValue = document.getElementById('highSens-value');
  highSensSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    highSensValue.textContent = `${value.toFixed(1)}x`;
    sendParamChange('highSens', value);
  });

  // Master Gain
  const masterGainSlider = document.getElementById('masterGain');
  const masterGainValue = document.getElementById('masterGain-value');
  masterGainSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    masterGainValue.textContent = `${value.toFixed(1)}x`;
    sendParamChange('masterAudioGain', value);
  });

  // Threshold
  const thresholdSlider = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');
  thresholdSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    thresholdValue.textContent = value.toFixed(1);
    sendParamChange('threshold', value);
  });

  // Glow
  const glowSlider = document.getElementById('glow');
  const glowValue = document.getElementById('glow-value');
  glowSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    glowValue.textContent = value.toFixed(1);
    sendParamChange('glow', value);
  });

  // Base Size
  const baseSizeSlider = document.getElementById('baseSize');
  const baseSizeValue = document.getElementById('baseSize-value');
  baseSizeSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    baseSizeValue.textContent = value.toFixed(2);
    sendParamChange('baseSize', value);
  });

  // Color 1
  const color1Input = document.getElementById('color1');
  color1Input.addEventListener('input', (e) => {
    sendParamChange('color1', e.target.value);
  });

  // Color 2
  const color2Input = document.getElementById('color2');
  color2Input.addEventListener('input', (e) => {
    sendParamChange('color2', e.target.value);
  });

  // Background Color
  const bgColorInput = document.getElementById('bgColor');
  bgColorInput.addEventListener('input', (e) => {
    sendParamChange('bgColor', e.target.value);
  });

  // Preset Select
  const presetSelect = document.getElementById('presetSelect');
  presetSelect.addEventListener('change', (e) => {
    applyPreset(e.target.value);
  });

  // Randomize Button
  const randomizeBtn = document.getElementById('randomizeBtn');
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', () => {
      randomizeControls();
    });
  }
}

/**
 * Randomize all controls
 */
function randomizeControls() {
  function randRange(min, max, step = 0.1) {
    const nSteps = Math.floor((max - min) / step);
    return min + step * Math.floor(Math.random() * (nSteps + 1));
  }

  function randIntRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Generate harmonious color palette
  const palette = generateRandomPalette();

  // Randomize speed (0 to 3)
  const speed = randRange(0, 3, 0.1);
  const speedEl = document.getElementById('speed');
  const speedValueEl = document.getElementById('speed-value');
  if (speedEl) speedEl.value = speed;
  if (speedValueEl) speedValueEl.textContent = speed.toFixed(1) + 'x';
  speedEl?.dispatchEvent(new Event('input'));

  // Randomize ball count (2 to 10)
  const ballCount = randIntRange(2, 10);
  const ballCountEl = document.getElementById('ballCount');
  const ballCountValueEl = document.getElementById('ballCount-value');
  if (ballCountEl) ballCountEl.value = ballCount;
  if (ballCountValueEl) ballCountValueEl.textContent = ballCount;
  ballCountEl?.dispatchEvent(new Event('input'));

  // Randomize sensitivities (0 to 3)
  const lowSens = randRange(0, 3, 0.1);
  const lowSensEl = document.getElementById('lowSens');
  const lowSensValueEl = document.getElementById('lowSens-value');
  if (lowSensEl) lowSensEl.value = lowSens;
  if (lowSensValueEl) lowSensValueEl.textContent = lowSens.toFixed(1) + 'x';
  lowSensEl?.dispatchEvent(new Event('input'));

  const midSens = randRange(0, 3, 0.1);
  const midSensEl = document.getElementById('midSens');
  const midSensValueEl = document.getElementById('midSens-value');
  if (midSensEl) midSensEl.value = midSens;
  if (midSensValueEl) midSensValueEl.textContent = midSens.toFixed(1) + 'x';
  midSensEl?.dispatchEvent(new Event('input'));

  const highSens = randRange(0, 3, 0.1);
  const highSensEl = document.getElementById('highSens');
  const highSensValueEl = document.getElementById('highSens-value');
  if (highSensEl) highSensEl.value = highSens;
  if (highSensValueEl) highSensValueEl.textContent = highSens.toFixed(1) + 'x';
  highSensEl?.dispatchEvent(new Event('input'));

  // Randomize master gain (0 to 4)
  const masterGain = randRange(0, 4, 0.1);
  const masterGainEl = document.getElementById('masterGain');
  const masterGainValueEl = document.getElementById('masterGain-value');
  if (masterGainEl) masterGainEl.value = masterGain;
  if (masterGainValueEl) masterGainValueEl.textContent = masterGain.toFixed(1) + 'x';
  masterGainEl?.dispatchEvent(new Event('input'));

  // Randomize threshold (0.5 to 3)
  const threshold = randRange(0.5, 3, 0.1);
  const thresholdEl = document.getElementById('threshold');
  const thresholdValueEl = document.getElementById('threshold-value');
  if (thresholdEl) thresholdEl.value = threshold;
  if (thresholdValueEl) thresholdValueEl.textContent = threshold.toFixed(1);
  thresholdEl?.dispatchEvent(new Event('input'));

  // Randomize glow (0 to 2)
  const glow = randRange(0, 2, 0.1);
  const glowEl = document.getElementById('glow');
  const glowValueEl = document.getElementById('glow-value');
  if (glowEl) glowEl.value = glow;
  if (glowValueEl) glowValueEl.textContent = glow.toFixed(1);
  glowEl?.dispatchEvent(new Event('input'));

  // Randomize base size (0.1 to 0.5)
  const baseSize = randRange(0.1, 0.5, 0.05);
  const baseSizeEl = document.getElementById('baseSize');
  const baseSizeValueEl = document.getElementById('baseSize-value');
  if (baseSizeEl) baseSizeEl.value = baseSize;
  if (baseSizeValueEl) baseSizeValueEl.textContent = baseSize.toFixed(2);
  baseSizeEl?.dispatchEvent(new Event('input'));

  // Randomize colors using harmonious palette
  const color1El = document.getElementById('color1');
  if (color1El) color1El.value = palette.c1;
  color1El?.dispatchEvent(new Event('input'));

  const color2El = document.getElementById('color2');
  if (color2El) color2El.value = palette.c2;
  color2El?.dispatchEvent(new Event('input'));

  const bgColorEl = document.getElementById('bgColor');
  if (bgColorEl) bgColorEl.value = palette.c3;
  bgColorEl?.dispatchEvent(new Event('input'));

  // Reset preset select to default
  const presetSelect = document.getElementById('presetSelect');
  if (presetSelect) presetSelect.value = 'default';
}

/**
 * Apply preset
 */
function applyPreset(name) {
  const preset = presets[name] || presets.default;

  // Update input values
  document.getElementById('speed').value = preset.speed;
  document.getElementById('ballCount').value = preset.ballCount;
  document.getElementById('lowSens').value = preset.lowSens;
  document.getElementById('midSens').value = preset.midSens;
  document.getElementById('highSens').value = preset.highSens;
  document.getElementById('masterGain').value = preset.masterAudioGain;
  document.getElementById('threshold').value = preset.threshold;
  document.getElementById('glow').value = preset.glow;
  document.getElementById('baseSize').value = preset.baseSize;
  document.getElementById('color1').value = preset.color1;
  document.getElementById('color2').value = preset.color2;
  document.getElementById('bgColor').value = preset.bgColor;

  // Update display values
  document.getElementById('speed-value').textContent = `${preset.speed.toFixed(1)}x`;
  document.getElementById('ballCount-value').textContent = preset.ballCount;
  document.getElementById('lowSens-value').textContent = `${preset.lowSens.toFixed(1)}x`;
  document.getElementById('midSens-value').textContent = `${preset.midSens.toFixed(1)}x`;
  document.getElementById('highSens-value').textContent = `${preset.highSens.toFixed(1)}x`;
  document.getElementById('masterGain-value').textContent = `${preset.masterAudioGain.toFixed(1)}x`;
  document.getElementById('threshold-value').textContent = preset.threshold.toFixed(1);
  document.getElementById('glow-value').textContent = preset.glow.toFixed(1);
  document.getElementById('baseSize-value').textContent = preset.baseSize.toFixed(2);

  // Trigger input events to send all parameters
  ['speed', 'ballCount', 'lowSens', 'midSens', 'highSens', 'masterGain', 'threshold', 'glow', 'baseSize', 'color1', 'color2', 'bgColor'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.dispatchEvent(new Event('input'));
    }
  });
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
    speed: parseFloat(document.getElementById('speed')?.value || '1.0'),
    ballCount: parseInt(document.getElementById('ballCount')?.value || '5'),
    lowSens: parseFloat(document.getElementById('lowSens')?.value || '1.0'),
    midSens: parseFloat(document.getElementById('midSens')?.value || '1.0'),
    highSens: parseFloat(document.getElementById('highSens')?.value || '1.0'),
    masterAudioGain: parseFloat(document.getElementById('masterGain')?.value || '1.0'),
    threshold: parseFloat(document.getElementById('threshold')?.value || '1.5'),
    glow: parseFloat(document.getElementById('glow')?.value || '0.5'),
    baseSize: parseFloat(document.getElementById('baseSize')?.value || '0.25'),
    color1: document.getElementById('color1')?.value || '#3366ff',
    color2: document.getElementById('color2')?.value || '#ff3399',
    bgColor: document.getElementById('bgColor')?.value || '#000000'
  };
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  if (params.speed !== undefined) {
    const el = document.getElementById('speed');
    const valEl = document.getElementById('speed-value');
    if (el) el.value = params.speed;
    if (valEl) valEl.textContent = params.speed.toFixed(1) + 'x';
    el?.dispatchEvent(new Event('input'));
  }
  if (params.ballCount !== undefined) {
    const el = document.getElementById('ballCount');
    const valEl = document.getElementById('ballCount-value');
    if (el) el.value = params.ballCount;
    if (valEl) valEl.textContent = params.ballCount;
    el?.dispatchEvent(new Event('input'));
  }
  if (params.lowSens !== undefined) {
    const el = document.getElementById('lowSens');
    const valEl = document.getElementById('lowSens-value');
    if (el) el.value = params.lowSens;
    if (valEl) valEl.textContent = params.lowSens.toFixed(1) + 'x';
    el?.dispatchEvent(new Event('input'));
  }
  if (params.midSens !== undefined) {
    const el = document.getElementById('midSens');
    const valEl = document.getElementById('midSens-value');
    if (el) el.value = params.midSens;
    if (valEl) valEl.textContent = params.midSens.toFixed(1) + 'x';
    el?.dispatchEvent(new Event('input'));
  }
  if (params.highSens !== undefined) {
    const el = document.getElementById('highSens');
    const valEl = document.getElementById('highSens-value');
    if (el) el.value = params.highSens;
    if (valEl) valEl.textContent = params.highSens.toFixed(1) + 'x';
    el?.dispatchEvent(new Event('input'));
  }
  if (params.masterAudioGain !== undefined) {
    const el = document.getElementById('masterGain');
    const valEl = document.getElementById('masterGain-value');
    if (el) el.value = params.masterAudioGain;
    if (valEl) valEl.textContent = params.masterAudioGain.toFixed(1) + 'x';
    el?.dispatchEvent(new Event('input'));
  }
  if (params.threshold !== undefined) {
    const el = document.getElementById('threshold');
    const valEl = document.getElementById('threshold-value');
    if (el) el.value = params.threshold;
    if (valEl) valEl.textContent = params.threshold.toFixed(1);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.glow !== undefined) {
    const el = document.getElementById('glow');
    const valEl = document.getElementById('glow-value');
    if (el) el.value = params.glow;
    if (valEl) valEl.textContent = params.glow.toFixed(1);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.baseSize !== undefined) {
    const el = document.getElementById('baseSize');
    const valEl = document.getElementById('baseSize-value');
    if (el) el.value = params.baseSize;
    if (valEl) valEl.textContent = params.baseSize.toFixed(2);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.color1 !== undefined) {
    const el = document.getElementById('color1');
    if (el) el.value = params.color1;
    el?.dispatchEvent(new Event('input'));
  }
  if (params.color2 !== undefined) {
    const el = document.getElementById('color2');
    if (el) el.value = params.color2;
    el?.dispatchEvent(new Event('input'));
  }
  if (params.bgColor !== undefined) {
    const el = document.getElementById('bgColor');
    if (el) el.value = params.bgColor;
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

