/**
 * Orbs Controls
 * UI for controlling the orbs visualization
 */

import { generatePalette, generateRandomPalette } from '../../shared/colorPalette.js';
import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'orbs';

// DOM references
let ui = {};

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
  ui = {
    // Build & Actions
    rebuild: document.getElementById('rebuild'),
    randomize: document.getElementById('randomize'),
    newPalette: document.getElementById('newPalette'),

    // Colors & Background
    colorTheme: document.getElementById('colorTheme'),
    colorJitter: document.getElementById('colorJitter'),
    colorJitterVal: document.getElementById('colorJitterVal'),
    paletteMode: document.getElementById('paletteMode'),
    warmCoolLock: document.getElementById('warmCoolLock'),
    customColor1: document.getElementById('customColor1'),
    customColor2: document.getElementById('customColor2'),
    customColor3: document.getElementById('customColor3'),
    applyCustomPalette: document.getElementById('applyCustomPalette'),
    bgSolidRadio: document.getElementById('bgSolidRadio'),
    bgLinearRadio: document.getElementById('bgLinearRadio'),
    bgRadialRadio: document.getElementById('bgRadialRadio'),
    bgColorSolid: document.getElementById('bgColorSolid'),
    bgColorLinStart: document.getElementById('bgColorLinStart'),
    bgColorLinEnd: document.getElementById('bgColorLinEnd'),
    bgLinearDir: document.getElementById('bgLinearDir'),
    bgColorRadialCenter: document.getElementById('bgColorRadialCenter'),
    bgColorRadialOuter: document.getElementById('bgColorRadialOuter'),
    applyBackgroundColor: document.getElementById('applyBackgroundColor'),
    bgSolidPickerRow: document.getElementById('bgSolidPickerRow'),
    bgLinearPickerRow: document.getElementById('bgLinearPickerRow'),
    bgRadialPickerRow: document.getElementById('bgRadialPickerRow'),

    // Spheres
    sizeMin: document.getElementById('sizeMin'),
    sizeMinVal: document.getElementById('sizeMinVal'),
    sizeMax: document.getElementById('sizeMax'),
    sizeMaxVal: document.getElementById('sizeMaxVal'),
    sizeCurve: document.getElementById('sizeCurve'),
    sizeCurveVal: document.getElementById('sizeCurveVal'),
    emissive: document.getElementById('emissive'),
    emissiveVal: document.getElementById('emissiveVal'),

    // Structure
    layers: document.getElementById('layers'),
    layersVal: document.getElementById('layersVal'),
    density: document.getElementById('density'),
    densityVal: document.getElementById('densityVal'),
    baseRadius: document.getElementById('baseRadius'),
    baseRadiusVal: document.getElementById('baseRadiusVal'),
    radiusStep: document.getElementById('radiusStep'),
    radiusStepVal: document.getElementById('radiusStepVal'),
    thickness: document.getElementById('thickness'),
    thicknessVal: document.getElementById('thicknessVal'),

    // Motion
    orbRotRate: document.getElementById('orbRotRate'),
    orbRotRateVal: document.getElementById('orbRotRateVal'),
    orbRotDir: document.getElementById('orbRotDir'),
    orbMotionType: document.getElementById('orbMotionType'),
    layerControls: document.getElementById('layerControls'),

    // Bloom
    bloomEnabled: document.getElementById('bloomEnabled'),
    bStrength: document.getElementById('bStrength'),
    bStrengthVal: document.getElementById('bStrengthVal'),
    bRadius: document.getElementById('bRadius'),
    bRadiusVal: document.getElementById('bRadiusVal'),
    bThreshold: document.getElementById('bThreshold'),
    bThresholdVal: document.getElementById('bThresholdVal'),

    // Trails
    trailEnabled: document.getElementById('trailEnabled'),
    trailLength: document.getElementById('trailLength'),
    trailLengthVal: document.getElementById('trailLengthVal'),
    trailFade: document.getElementById('trailFade'),
    trailFadeVal: document.getElementById('trailFadeVal'),

    // Audio
    audioEnabled: document.getElementById('audioEnabled'),
    bassSensitivity: document.getElementById('bassSensitivity'),
    bassSensitivityVal: document.getElementById('bassSensitivityVal'),
    radiusScaleRange: document.getElementById('radiusScaleRange'),
    radiusScaleRangeVal: document.getElementById('radiusScaleRangeVal')
  };
}

/**
 * Handle messages from module
 */
function handleModuleMessage(event) {
  if (!event.data) return;

  // Handle layer count updates to refresh layer controls
  if (event.data.type === 'LAYERS_UPDATE') {
    const layerCount = event.data.layerCount || 4;
    updateLayerControls(layerCount);
  }
}

/**
 * Set up control inputs
 */
function setupControls() {
  // Range inputs with value displays
  hookRange(ui.colorJitter, ui.colorJitterVal, v => parseFloat(v).toFixed(2));
  hookRange(ui.sizeMin, ui.sizeMinVal, v => parseFloat(v).toFixed(2));
  hookRange(ui.sizeMax, ui.sizeMaxVal, v => parseFloat(v).toFixed(2));
  hookRange(ui.sizeCurve, ui.sizeCurveVal, v => parseFloat(v).toFixed(2));
  hookRange(ui.emissive, ui.emissiveVal, v => parseFloat(v).toFixed(1));
  hookRange(ui.layers, ui.layersVal, v => v);
  hookRange(ui.density, ui.densityVal, v => v);
  hookRange(ui.baseRadius, ui.baseRadiusVal, v => parseFloat(v).toFixed(1));
  hookRange(ui.radiusStep, ui.radiusStepVal, v => parseFloat(v).toFixed(1));
  hookRange(ui.thickness, ui.thicknessVal, v => parseFloat(v).toFixed(2));
  hookRange(ui.orbRotRate, ui.orbRotRateVal, v => parseFloat(v).toFixed(2));
  hookRange(ui.bStrength, ui.bStrengthVal, v => parseFloat(v).toFixed(2));
  hookRange(ui.bRadius, ui.bRadiusVal, v => parseFloat(v).toFixed(2));
  hookRange(ui.bThreshold, ui.bThresholdVal, v => parseFloat(v).toFixed(2));
  hookRange(ui.trailLength, ui.trailLengthVal, v => v);
  hookRange(ui.trailFade, ui.trailFadeVal, v => parseFloat(v).toFixed(2));
  hookRange(ui.bassSensitivity, ui.bassSensitivityVal, v => parseFloat(v).toFixed(1));
  hookRange(ui.radiusScaleRange, ui.radiusScaleRangeVal, v => parseFloat(v).toFixed(1));

  // Parameter change handlers
  const paramInputs = [
    'colorTheme', 'colorJitter', 'paletteMode', 'warmCoolLock',
    'sizeMin', 'sizeMax', 'sizeCurve', 'emissive',
    'layers', 'density', 'baseRadius', 'radiusStep', 'thickness',
    'orbRotRate', 'orbRotDir', 'orbMotionType',
    'bloomEnabled', 'bStrength', 'bRadius', 'bThreshold',
    'trailEnabled', 'trailLength', 'trailFade',
    'audioEnabled', 'bassSensitivity', 'radiusScaleRange'
  ];

  paramInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'range' || el.type === 'number' || el.type === 'color') {
        el.addEventListener('input', () => {
          const value = el.type === 'checkbox' ? el.checked :
            el.type === 'color' ? el.value :
              parseFloat(el.value);
          sendParamChange(id, value);
        });
      } else if (el.tagName === 'SELECT') {
        el.addEventListener('change', () => {
          sendParamChange(id, el.value);
        });
      } else if (el.type === 'checkbox') {
        el.addEventListener('change', () => {
          sendParamChange(id, el.checked);
        });
      }
    }
  });

  // Background mode radio buttons
  [ui.bgSolidRadio, ui.bgLinearRadio, ui.bgRadialRadio].forEach(radio => {
    if (radio) {
      radio.addEventListener('change', () => {
        showHideBgPickers();
        sendParamChange('bgMode', radio.value);
      });
    }
  });

  // Background color inputs
  ['bgColorSolid', 'bgColorLinStart', 'bgColorLinEnd', 'bgLinearDir',
    'bgColorRadialCenter', 'bgColorRadialOuter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          sendParamChange(id, el.value);
        });
      }
    });

  // Custom palette
  if (ui.applyCustomPalette) {
    ui.applyCustomPalette.addEventListener('click', () => {
      const customPalette = [
        ui.customColor1.value,
        ui.customColor2.value,
        ui.customColor3.value
      ];
      sendParamChange('applyCustomPalette', customPalette);
    });
  }

  // Apply background button
  if (ui.applyBackgroundColor) {
    ui.applyBackgroundColor.addEventListener('click', () => {
      const bgConfig = {
        mode: ui.bgSolidRadio.checked ? 'solid' :
          ui.bgLinearRadio.checked ? 'linear' : 'radial',
        solid: ui.bgColorSolid.value,
        linear: {
          start: ui.bgColorLinStart.value,
          end: ui.bgColorLinEnd.value,
          dir: ui.bgLinearDir.value
        },
        radial: {
          center: ui.bgColorRadialCenter.value,
          outer: ui.bgColorRadialOuter.value
        }
      };
      sendParamChange('applyBackground', bgConfig);
    });
  }

  // Buttons
  if (ui.rebuild) {
    ui.rebuild.addEventListener('click', () => {
      sendParamChange('rebuild', true);
    });
  }

  if (ui.randomize) {
    ui.randomize.addEventListener('click', () => {
      randomizeControls();
    });
  }

  if (ui.newPalette) {
    ui.newPalette.addEventListener('click', () => {
      sendParamChange('newPalette', true);
    });
  }

  // Update layer controls when layers change
  if (ui.layers) {
    ui.layers.addEventListener('change', () => {
      const layerCount = parseInt(ui.layers.value, 10);
      updateLayerControls(layerCount);
      sendParamChange('layers', layerCount);
    });
  }

  // Initial layer controls setup
  const initialLayerCount = parseInt(ui.layers?.value || 4, 10);
  updateLayerControls(initialLayerCount);

  // Show/hide background pickers
  showHideBgPickers();
}

/**
 * Hook range input to value display
 */
function hookRange(el, labelEl, transform = v => v) {
  if (!el || !labelEl) return;
  const update = () => {
    labelEl.textContent = transform(el.value);
  };
  el.addEventListener('input', update);
  update();
}

/**
 * Update layer controls dynamically
 */
function updateLayerControls(layerCount) {
  if (!ui.layerControls) return;

  ui.layerControls.innerHTML = '';

  for (let i = 0; i < layerCount; i++) {
    const details = document.createElement('details');
    details.className = 'uiDetails';

    const summary = document.createElement('summary');
    summary.textContent = `Layer ${i + 1}`;
    details.appendChild(summary);

    const card = document.createElement('div');
    card.className = 'layer-card';

    // Orbit rate
    const rateWrap = document.createElement('div');
    rateWrap.className = 'control-item';
    const rateLabel = document.createElement('label');
    rateLabel.className = 'control-label';
    rateLabel.htmlFor = `layerRate${i}`;
    rateLabel.innerHTML = `Orbit Rate <span id="layerRate${i}Val" class="value">0.65</span>`;
    const rateInput = document.createElement('input');
    rateInput.type = 'range';
    rateInput.id = `layerRate${i}`;
    rateInput.min = '0';
    rateInput.max = '3';
    rateInput.step = '0.01';
    rateInput.value = '0.65';
    rateInput.dataset.layerIndex = i;
    rateWrap.appendChild(rateLabel);
    rateWrap.appendChild(rateInput);

    hookRange(rateInput, document.getElementById(`layerRate${i}Val`), v => parseFloat(v).toFixed(2));

    rateInput.addEventListener('input', () => {
      sendParamChange(`layerRate${i}`, parseFloat(rateInput.value));
    });

    // Direction
    const dirRow = document.createElement('div');
    dirRow.className = 'control-item';
    const dirLabel = document.createElement('label');
    dirLabel.textContent = 'Orbit Direction';
    dirLabel.setAttribute('for', `layerDir${i}`);
    const dirSelect = document.createElement('select');
    dirSelect.id = `layerDir${i}`;
    dirSelect.dataset.layerIndex = i;
    const optionCW = document.createElement('option');
    optionCW.value = '1';
    optionCW.textContent = 'Clockwise';
    const optionCCW = document.createElement('option');
    optionCCW.value = '-1';
    optionCCW.textContent = 'Counter-clockwise';
    dirSelect.appendChild(optionCW);
    dirSelect.appendChild(optionCCW);
    dirSelect.value = '1';
    dirRow.appendChild(dirLabel);
    dirRow.appendChild(dirSelect);

    dirSelect.addEventListener('change', () => {
      sendParamChange(`layerDir${i}`, parseFloat(dirSelect.value));
    });

    card.appendChild(rateWrap);
    card.appendChild(dirRow);
    details.appendChild(card);
    ui.layerControls.appendChild(details);
  }
}

/**
 * Show/hide background pickers based on mode
 */
function showHideBgPickers() {
  if (!ui.bgSolidPickerRow || !ui.bgLinearPickerRow || !ui.bgRadialPickerRow) return;

  ui.bgSolidPickerRow.style.display = ui.bgSolidRadio?.checked ? '' : 'none';
  ui.bgLinearPickerRow.style.display = ui.bgLinearRadio?.checked ? '' : 'none';
  ui.bgRadialPickerRow.style.display = ui.bgRadialRadio?.checked ? '' : 'none';
}

/**
 * Randomize all controls
 */
function randomizeControls() {
  const r = Math.random;

  // Randomize structure
  if (ui.layers) {
    ui.layers.value = String(Math.floor(2 + r() * 5));
    ui.layers.dispatchEvent(new Event('input'));
  }
  if (ui.density) {
    ui.density.value = String(Math.floor(200 + r() * 800));
    ui.density.dispatchEvent(new Event('input'));
  }
  if (ui.baseRadius) {
    ui.baseRadius.value = (1.8 + r() * 4.8).toFixed(1);
    ui.baseRadius.dispatchEvent(new Event('input'));
  }
  if (ui.radiusStep) {
    ui.radiusStep.value = (0.8 + r() * 2.6).toFixed(1);
    ui.radiusStep.dispatchEvent(new Event('input'));
  }
  if (ui.thickness) {
    ui.thickness.value = (0.18 + r() * 1.2).toFixed(2);
    ui.thickness.dispatchEvent(new Event('input'));
  }

  // Randomize spheres
  if (ui.sizeMin) {
    ui.sizeMin.value = (0.02 + r() * 0.10).toFixed(2);
    ui.sizeMin.dispatchEvent(new Event('input'));
  }
  if (ui.sizeMax) {
    ui.sizeMax.value = (0.12 + r() * 0.55).toFixed(2);
    ui.sizeMax.dispatchEvent(new Event('input'));
  }
  if (ui.sizeCurve) {
    ui.sizeCurve.value = (0.7 + r() * 2.5).toFixed(2);
    ui.sizeCurve.dispatchEvent(new Event('input'));
  }

  // Randomize color theme
  const themes = ['random', 'ocean', 'sunset', 'forest', 'aurora', 'fire',
    'lavender', 'mint', 'coral', 'cyber', 'golden', 'plum', 'teal'];
  if (ui.colorTheme) {
    ui.colorTheme.value = themes[Math.floor(r() * themes.length)];
    ui.colorTheme.dispatchEvent(new Event('change'));
  }

  if (ui.colorJitter) {
    ui.colorJitter.value = (0.10 + r() * 0.70).toFixed(2);
    ui.colorJitter.dispatchEvent(new Event('input'));
  }
  if (ui.emissive) {
    ui.emissive.value = (2.0 + r() * 6.0).toFixed(1);
    ui.emissive.dispatchEvent(new Event('input'));
  }

  // Randomize bloom
  if (ui.bStrength) {
    ui.bStrength.value = (1.2 + r() * 2.8).toFixed(2);
    ui.bStrength.dispatchEvent(new Event('input'));
  }
  if (ui.bRadius) {
    ui.bRadius.value = (0.25 + r() * 1.2).toFixed(2);
    ui.bRadius.dispatchEvent(new Event('input'));
  }
  if (ui.bThreshold) {
    ui.bThreshold.value = (0.02 + r() * 0.25).toFixed(2);
    ui.bThreshold.dispatchEvent(new Event('input'));
  }

  // Trigger rebuild
  sendParamChange('rebuild', true);
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
 * Get all current parameter values
 */
function getAllParams() {
  const params = {};

  // Get all input values
  Object.keys(ui).forEach(key => {
    const el = ui[key];
    if (el && el.value !== undefined) {
      if (el.type === 'range' || el.type === 'number') {
        params[key] = parseFloat(el.value);
      } else if (el.type === 'color') {
        params[key] = el.value;
      } else if (el.tagName === 'SELECT') {
        params[key] = el.value;
      } else if (el.type === 'checkbox') {
        params[key] = el.checked;
      }
    }
  });

  // Get layer-specific params
  const layerCount = parseInt(ui.layers?.value || 4, 10);
  for (let i = 0; i < layerCount; i++) {
    const rateEl = document.getElementById(`layerRate${i}`);
    const dirEl = document.getElementById(`layerDir${i}`);
    if (rateEl) params[`layerRate${i}`] = parseFloat(rateEl.value);
    if (dirEl) params[`layerDir${i}`] = parseFloat(dirEl.value);
  }

  // Background config
  params.bgMode = ui.bgSolidRadio?.checked ? 'solid' :
    ui.bgLinearRadio?.checked ? 'linear' : 'radial';
  params.bgColorSolid = ui.bgColorSolid?.value;
  params.bgColorLinStart = ui.bgColorLinStart?.value;
  params.bgColorLinEnd = ui.bgColorLinEnd?.value;
  params.bgLinearDir = ui.bgLinearDir?.value;
  params.bgColorRadialCenter = ui.bgColorRadialCenter?.value;
  params.bgColorRadialOuter = ui.bgColorRadialOuter?.value;

  // Custom palette
  params.customPalette = [
    ui.customColor1?.value,
    ui.customColor2?.value,
    ui.customColor3?.value
  ];

  return params;
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  Object.keys(params).forEach(key => {
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



