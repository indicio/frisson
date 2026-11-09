/**
 * Photosome Controls
 * UI for controlling the photosome visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'photosome';

// DOM references
let simScaleEl, simScaleValueEl;
let resetBtn, clearBtn, randomizeBtn;
let autoDropsEl, autoMinEl, autoMaxEl, centerBiasEl;
let autoMinValueEl, autoMaxValueEl, centerBiasValueEl;
let durMinEl, durMaxEl, fadeMinEl, fadeMaxEl, strengthMinEl, strengthMaxEl;
let durMinValueEl, durMaxValueEl, fadeMinValueEl, fadeMaxValueEl;
let strengthMinValueEl, strengthMaxValueEl;
let expansionSpeedEl, expansionSpeedValueEl;
let expCurveEl, expKEl, expMidEl, expSharpEl;
let expKValueEl, expMidValueEl, expSharpValueEl;
let aspectMinEl, aspectMaxEl, shapeAmpMinEl, shapeAmpMaxEl;
let shapeFreqMinEl, shapeFreqMaxEl, noRotationEl;
let rotSpeedMinEl, rotSpeedMaxEl;
let aspectMinValueEl, aspectMaxValueEl, shapeAmpMinValueEl, shapeAmpMaxValueEl;
let shapeFreqMinValueEl, shapeFreqMaxValueEl, rotSpeedMinValueEl, rotSpeedMaxValueEl;
let blendModeEl, warpBaseEl, decayEl, featherEl;
let edgeFreqEl, edgeAmpEl, diffuseEl, rimWEl, rimIEl;
let edgeRoughMinEl, edgeRoughMaxEl;
let warpBaseValueEl, decayValueEl, featherValueEl;
let edgeFreqValueEl, edgeAmpValueEl, diffuseValueEl;
let rimWValueEl, rimIValueEl, edgeRoughMinValueEl, edgeRoughMaxValueEl;
let colorThemeEl, useCustomColorsEl;
let customColor1El, customColor2El, customColor3El, backgroundColorEl;
let enableAudioBtn, bassTriggersDropsEl, bassThreshEl, bassCooldownEl;
let bassThreshValueEl, bassCooldownValueEl;
let audioWarpEl, warpAudioEl, audioEdgeEl, audioDiffuseEl;
let warpAudioValueEl;

/**
 * Initialize controls
 */
async function init() {
  // Set up BroadcastChannel for communication
  controlsChannel = new BroadcastChannel('visualizer-controls');

  // Listen for messages from module
  controlsChannel.onmessage = handleModuleMessage;

  // Get all DOM references
  getDOMElements();

  // Set up all control inputs
  setupControls();

  // Set up favorites functionality
  const favorites = new Favorites({
    moduleId: MODULE_ID,
    getAllParams,
    applyParams,
    saveButtonId: 'saveFavoriteBtn',
    nameInputId: 'favoriteName',
  });
  await favorites.init();
}

/**
 * Get DOM element references
 */
function getDOMElements() {
  simScaleEl = document.getElementById('simScale');
  simScaleValueEl = document.getElementById('simScaleValue');
  resetBtn = document.getElementById('resetBtn');
  clearBtn = document.getElementById('clearBtn');
  randomizeBtn = document.getElementById('randomizeBtn');
  autoDropsEl = document.getElementById('autoDrops');
  autoMinEl = document.getElementById('autoMin');
  autoMaxEl = document.getElementById('autoMax');
  centerBiasEl = document.getElementById('centerBias');
  autoMinValueEl = document.getElementById('autoMinValue');
  autoMaxValueEl = document.getElementById('autoMaxValue');
  centerBiasValueEl = document.getElementById('centerBiasValue');
  durMinEl = document.getElementById('durMin');
  durMaxEl = document.getElementById('durMax');
  fadeMinEl = document.getElementById('fadeMin');
  fadeMaxEl = document.getElementById('fadeMax');
  strengthMinEl = document.getElementById('strengthMin');
  strengthMaxEl = document.getElementById('strengthMax');
  durMinValueEl = document.getElementById('durMinValue');
  durMaxValueEl = document.getElementById('durMaxValue');
  fadeMinValueEl = document.getElementById('fadeMinValue');
  fadeMaxValueEl = document.getElementById('fadeMaxValue');
  strengthMinValueEl = document.getElementById('strengthMinValue');
  strengthMaxValueEl = document.getElementById('strengthMaxValue');
  expansionSpeedEl = document.getElementById('expansionSpeed');
  expansionSpeedValueEl = document.getElementById('expansionSpeedValue');
  expCurveEl = document.getElementById('expCurve');
  expKEl = document.getElementById('expK');
  expMidEl = document.getElementById('expMid');
  expSharpEl = document.getElementById('expSharp');
  expKValueEl = document.getElementById('expKValue');
  expMidValueEl = document.getElementById('expMidValue');
  expSharpValueEl = document.getElementById('expSharpValue');
  aspectMinEl = document.getElementById('aspectMin');
  aspectMaxEl = document.getElementById('aspectMax');
  shapeAmpMinEl = document.getElementById('shapeAmpMin');
  shapeAmpMaxEl = document.getElementById('shapeAmpMax');
  shapeFreqMinEl = document.getElementById('shapeFreqMin');
  shapeFreqMaxEl = document.getElementById('shapeFreqMax');
  noRotationEl = document.getElementById('noRotation');
  rotSpeedMinEl = document.getElementById('rotSpeedMin');
  rotSpeedMaxEl = document.getElementById('rotSpeedMax');
  aspectMinValueEl = document.getElementById('aspectMinValue');
  aspectMaxValueEl = document.getElementById('aspectMaxValue');
  shapeAmpMinValueEl = document.getElementById('shapeAmpMinValue');
  shapeAmpMaxValueEl = document.getElementById('shapeAmpMaxValue');
  shapeFreqMinValueEl = document.getElementById('shapeFreqMinValue');
  shapeFreqMaxValueEl = document.getElementById('shapeFreqMaxValue');
  rotSpeedMinValueEl = document.getElementById('rotSpeedMinValue');
  rotSpeedMaxValueEl = document.getElementById('rotSpeedMaxValue');
  blendModeEl = document.getElementById('blendMode');
  warpBaseEl = document.getElementById('warpBase');
  decayEl = document.getElementById('decay');
  featherEl = document.getElementById('feather');
  edgeFreqEl = document.getElementById('edgeFreq');
  edgeAmpEl = document.getElementById('edgeAmp');
  diffuseEl = document.getElementById('diffuse');
  rimWEl = document.getElementById('rimW');
  rimIEl = document.getElementById('rimI');
  edgeRoughMinEl = document.getElementById('edgeRoughMin');
  edgeRoughMaxEl = document.getElementById('edgeRoughMax');
  warpBaseValueEl = document.getElementById('warpBaseValue');
  decayValueEl = document.getElementById('decayValue');
  featherValueEl = document.getElementById('featherValue');
  edgeFreqValueEl = document.getElementById('edgeFreqValue');
  edgeAmpValueEl = document.getElementById('edgeAmpValue');
  diffuseValueEl = document.getElementById('diffuseValue');
  rimWValueEl = document.getElementById('rimWValue');
  rimIValueEl = document.getElementById('rimIValue');
  edgeRoughMinValueEl = document.getElementById('edgeRoughMinValue');
  edgeRoughMaxValueEl = document.getElementById('edgeRoughMaxValue');
  colorThemeEl = document.getElementById('colorTheme');
  useCustomColorsEl = document.getElementById('useCustomColors');
  customColor1El = document.getElementById('customColor1');
  customColor2El = document.getElementById('customColor2');
  customColor3El = document.getElementById('customColor3');
  backgroundColorEl = document.getElementById('backgroundColor');
  enableAudioBtn = document.getElementById('enableAudioBtn');
  bassTriggersDropsEl = document.getElementById('bassTriggersDrops');
  bassThreshEl = document.getElementById('bassThresh');
  bassCooldownEl = document.getElementById('bassCooldown');
  bassThreshValueEl = document.getElementById('bassThreshValue');
  bassCooldownValueEl = document.getElementById('bassCooldownValue');
  audioWarpEl = document.getElementById('audioWarp');
  warpAudioEl = document.getElementById('warpAudio');
  audioEdgeEl = document.getElementById('audioEdge');
  audioDiffuseEl = document.getElementById('audioDiffuse');
  warpAudioValueEl = document.getElementById('warpAudioValue');
}

/**
 * Handle messages from module
 */
function handleModuleMessage(event) {
  // Module can send updates if needed
}

/**
 * Send parameter change to module
 */
function sendParamChange(param, value) {
  if (controlsChannel) {
    controlsChannel.postMessage({
      type: 'PARAM_CHANGE',
      param: param,
      value: value
    });
  }
}

/**
 * Helper to hook up range inputs with value displays
 */
function hookRange(inputEl, valueEl, formatter) {
  if (!inputEl || !valueEl) return;

  const update = () => {
    valueEl.textContent = formatter(inputEl.value);
  };

  inputEl.addEventListener('input', () => {
    update();
    sendParamChange(inputEl.id, parseFloat(inputEl.value));
  });

  update();
}

/**
 * Set up control inputs
 */
function setupControls() {
  // Range inputs with value displays
  hookRange(simScaleEl, simScaleValueEl, v => parseFloat(v).toFixed(2) + 'x');
  hookRange(autoMinEl, autoMinValueEl, v => parseFloat(v).toFixed(2));
  hookRange(autoMaxEl, autoMaxValueEl, v => parseFloat(v).toFixed(2));
  hookRange(centerBiasEl, centerBiasValueEl, v => parseFloat(v).toFixed(2));
  hookRange(durMinEl, durMinValueEl, v => parseFloat(v).toFixed(1));
  hookRange(durMaxEl, durMaxValueEl, v => parseFloat(v).toFixed(1));
  hookRange(fadeMinEl, fadeMinValueEl, v => parseFloat(v).toFixed(1));
  hookRange(fadeMaxEl, fadeMaxValueEl, v => parseFloat(v).toFixed(1));
  hookRange(strengthMinEl, strengthMinValueEl, v => parseFloat(v).toFixed(2));
  hookRange(strengthMaxEl, strengthMaxValueEl, v => parseFloat(v).toFixed(2));
  hookRange(expansionSpeedEl, expansionSpeedValueEl, v => parseFloat(v).toFixed(2) + 'x');
  hookRange(expKEl, expKValueEl, v => parseFloat(v).toFixed(2));
  hookRange(expMidEl, expMidValueEl, v => parseFloat(v).toFixed(2));
  hookRange(expSharpEl, expSharpValueEl, v => parseFloat(v).toFixed(1));
  hookRange(aspectMinEl, aspectMinValueEl, v => parseFloat(v).toFixed(2));
  hookRange(aspectMaxEl, aspectMaxValueEl, v => parseFloat(v).toFixed(2));
  hookRange(shapeAmpMinEl, shapeAmpMinValueEl, v => parseFloat(v).toFixed(3));
  hookRange(shapeAmpMaxEl, shapeAmpMaxValueEl, v => parseFloat(v).toFixed(3));
  hookRange(shapeFreqMinEl, shapeFreqMinValueEl, v => parseFloat(v).toFixed(1));
  hookRange(shapeFreqMaxEl, shapeFreqMaxValueEl, v => parseFloat(v).toFixed(1));
  hookRange(rotSpeedMinEl, rotSpeedMinValueEl, v => parseFloat(v).toFixed(2));
  hookRange(rotSpeedMaxEl, rotSpeedMaxValueEl, v => parseFloat(v).toFixed(2));
  hookRange(warpBaseEl, warpBaseValueEl, v => parseFloat(v).toFixed(3));
  hookRange(decayEl, decayValueEl, v => parseFloat(v).toFixed(3));
  hookRange(featherEl, featherValueEl, v => parseFloat(v).toFixed(2));
  hookRange(edgeFreqEl, edgeFreqValueEl, v => parseFloat(v).toFixed(1));
  hookRange(edgeAmpEl, edgeAmpValueEl, v => parseFloat(v).toFixed(2));
  hookRange(diffuseEl, diffuseValueEl, v => parseFloat(v).toFixed(3));
  hookRange(rimWEl, rimWValueEl, v => parseFloat(v).toFixed(3));
  hookRange(rimIEl, rimIValueEl, v => parseFloat(v).toFixed(2));
  hookRange(edgeRoughMinEl, edgeRoughMinValueEl, v => parseFloat(v).toFixed(3));
  hookRange(edgeRoughMaxEl, edgeRoughMaxValueEl, v => parseFloat(v).toFixed(3));
  hookRange(bassThreshEl, bassThreshValueEl, v => parseFloat(v).toFixed(2));
  hookRange(bassCooldownEl, bassCooldownValueEl, v => parseFloat(v).toFixed(2));
  hookRange(warpAudioEl, warpAudioValueEl, v => parseFloat(v).toFixed(3));

  // Checkboxes
  if (autoDropsEl) {
    autoDropsEl.addEventListener('change', () => {
      sendParamChange('autoDrops', autoDropsEl.checked);
    });
  }
  if (noRotationEl) {
    noRotationEl.addEventListener('change', () => {
      sendParamChange('noRotation', noRotationEl.checked);
    });
  }
  if (useCustomColorsEl) {
    useCustomColorsEl.addEventListener('change', () => {
      sendParamChange('useCustomColors', useCustomColorsEl.checked);
    });
  }
  if (bassTriggersDropsEl) {
    bassTriggersDropsEl.addEventListener('change', () => {
      sendParamChange('bassTriggersDrops', bassTriggersDropsEl.checked);
    });
  }
  if (audioWarpEl) {
    audioWarpEl.addEventListener('change', () => {
      sendParamChange('audioWarp', audioWarpEl.checked);
    });
  }
  if (audioEdgeEl) {
    audioEdgeEl.addEventListener('change', () => {
      sendParamChange('audioEdge', audioEdgeEl.checked);
    });
  }
  if (audioDiffuseEl) {
    audioDiffuseEl.addEventListener('change', () => {
      sendParamChange('audioDiffuse', audioDiffuseEl.checked);
    });
  }

  // Selects
  if (expCurveEl) {
    expCurveEl.addEventListener('change', () => {
      sendParamChange('expCurve', expCurveEl.value);
    });
  }
  if (blendModeEl) {
    blendModeEl.addEventListener('change', () => {
      sendParamChange('blendMode', blendModeEl.value);
    });
  }
  if (colorThemeEl) {
    colorThemeEl.addEventListener('change', () => {
      sendParamChange('colorTheme', colorThemeEl.value);
    });
  }

  // Color inputs
  if (customColor1El) {
    customColor1El.addEventListener('input', () => {
      sendParamChange('customColor1', customColor1El.value);
    });
  }
  if (customColor2El) {
    customColor2El.addEventListener('input', () => {
      sendParamChange('customColor2', customColor2El.value);
    });
  }
  if (customColor3El) {
    customColor3El.addEventListener('input', () => {
      sendParamChange('customColor3', customColor3El.value);
    });
  }
  if (backgroundColorEl) {
    backgroundColorEl.addEventListener('input', () => {
      sendParamChange('backgroundColor', backgroundColorEl.value);
    });
  }

  // Buttons
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      sendParamChange('reset', true);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      sendParamChange('clear', true);
    });
  }
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', () => {
      sendParamChange('randomize', true);
    });
  }
}

/**
 * Get all current parameter values
 */
function getAllParams() {
  const params = {};

  // Get all input values
  const inputs = [
    'simScale', 'autoDrops', 'autoMin', 'autoMax', 'centerBias',
    'durMin', 'durMax', 'fadeMin', 'fadeMax', 'strengthMin', 'strengthMax',
    'expansionSpeed', 'expCurve', 'expK', 'expMid', 'expSharp',
    'aspectMin', 'aspectMax', 'shapeAmpMin', 'shapeAmpMax',
    'shapeFreqMin', 'shapeFreqMax', 'noRotation',
    'rotSpeedMin', 'rotSpeedMax',
    'blendMode', 'warpBase', 'decay', 'feather',
    'edgeFreq', 'edgeAmp', 'diffuse', 'rimW', 'rimI',
    'edgeRoughMin', 'edgeRoughMax',
    'colorTheme', 'useCustomColors',
    'customColor1', 'customColor2', 'customColor3', 'backgroundColor',
    'bassTriggersDrops', 'bassThresh', 'bassCooldown',
    'audioWarp', 'warpAudio', 'audioEdge', 'audioDiffuse'
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'checkbox') {
        params[id] = el.checked;
      } else if (el.type === 'range' || el.type === 'number') {
        params[id] = parseFloat(el.value);
      } else {
        params[id] = el.value;
      }
    }
  });

  return params;
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  Object.keys(params).forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      if (el.type === 'checkbox') {
        el.checked = params[key];
        el.dispatchEvent(new Event('change'));
      } else if (el.type === 'range' || el.type === 'number') {
        el.value = params[key];
        const valueEl = document.getElementById(key + 'Value');
        if (valueEl) {
          // Update display based on type
          if (key === 'simScale' || key === 'expansionSpeed') {
            valueEl.textContent = parseFloat(params[key]).toFixed(2) + 'x';
          } else if (key.includes('Value')) {
            valueEl.textContent = parseFloat(params[key]).toFixed(2);
          } else {
            valueEl.textContent = params[key];
          }
        }
        el.dispatchEvent(new Event('input'));
      } else {
        el.value = params[key];
        el.dispatchEvent(new Event('change'));
      }
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

