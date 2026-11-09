/**
 * Supercam Controls
 * UI for controlling the supercam visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'supercam';

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
    listContainerId: 'favoritesList',
  });
  await favorites.init();
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

  // Also send via window.postMessage for iframe communication
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'PARAM_CHANGE',
      param: param,
      value: value
    }, '*');
  }
}

/**
 * Set up control inputs
 */
function setupControls() {
  // Mode selector
  const modeSelect = document.getElementById('modeSelect');
  if (modeSelect) {
    modeSelect.addEventListener('change', (e) => {
      const mode = parseInt(e.target.value);
      sendParamChange('mode', mode);
      updateModeControls();
    });
  }

  // Global controls
  setupSlider('audioSensitivity', 'audioSensitivityValue', (val) => {
    sendParamChange('audioSensitivity', parseFloat(val));
  });

  setupSlider('globalIntensity', 'globalIntensityValue', (val) => {
    sendParamChange('globalIntensity', parseFloat(val));
  });

  setupSlider('globalBrightness', 'globalBrightnessValue', (val) => {
    sendParamChange('globalBrightness', parseFloat(val));
  });

  setupSlider('globalContrast', 'globalContrastValue', (val) => {
    sendParamChange('globalContrast', parseFloat(val));
  });

  setupSlider('globalBlend', 'globalBlendValue', (val) => {
    sendParamChange('globalBlend', parseFloat(val));
  });

  setupSlider('globalBlur', 'globalBlurValue', (val) => {
    sendParamChange('globalBlur', parseFloat(val));
  });

  // Mode 0: Kaleidoscope
  setupSlider('kaleidSegments', 'kaleidSegmentsValue', (val) => {
    sendParamChange('kaleidSegments', parseFloat(val));
  });

  setupSlider('kaleidSubdivisions', 'kaleidSubdivisionsValue', (val) => {
    sendParamChange('kaleidSubdivisions', parseFloat(val));
  });

  setupSlider('kaleidMirrorStrength', 'kaleidMirrorStrengthValue', (val) => {
    sendParamChange('kaleidMirrorStrength', parseFloat(val));
  });

  setupSlider('kaleidZoom', 'kaleidZoomValue', (val) => {
    sendParamChange('kaleidZoom', parseFloat(val));
  });

  setupSlider('kaleidRotationSpeed', 'kaleidRotationSpeedValue', (val) => {
    sendParamChange('kaleidRotationSpeed', parseFloat(val));
  });

  // Mode 1: Glitch
  setupSlider('glitchBaseIntensity', 'glitchBaseIntensityValue', (val) => {
    sendParamChange('glitchBaseIntensity', parseFloat(val));
  });

  setupSlider('glitchMaxPixelSize', 'glitchMaxPixelSizeValue', (val) => {
    sendParamChange('glitchMaxPixelSize', parseFloat(val));
  });

  setupSlider('glitchRGBOffset', 'glitchRGBOffsetValue', (val) => {
    sendParamChange('glitchRGBOffset', parseFloat(val));
  });

  setupSlider('glitchThreshold', 'glitchThresholdValue', (val) => {
    sendParamChange('glitchThreshold', parseFloat(val));
  });

  // Mode 2: Gradient Map
  const gradientPreset = document.getElementById('gradientPreset');
  if (gradientPreset) {
    gradientPreset.addEventListener('change', (e) => {
      sendParamChange('gradientPreset', e.target.value);
    });
  }

  // Color pickers for custom gradient
  const gradientColor1 = document.getElementById('gradientColor1');
  const gradientColor1Value = document.getElementById('gradientColor1-value');
  if (gradientColor1) {
    gradientColor1.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (gradientColor1Value) gradientColor1Value.textContent = hex;
      sendParamChange('gradientColor1', hex);
      sendParamChange('gradientPreset', 'custom');
      if (gradientPreset) gradientPreset.value = 'custom';
    });
  }

  const gradientColor2 = document.getElementById('gradientColor2');
  const gradientColor2Value = document.getElementById('gradientColor2-value');
  if (gradientColor2) {
    gradientColor2.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (gradientColor2Value) gradientColor2Value.textContent = hex;
      sendParamChange('gradientColor2', hex);
      sendParamChange('gradientPreset', 'custom');
      if (gradientPreset) gradientPreset.value = 'custom';
    });
  }

  const gradientColor3 = document.getElementById('gradientColor3');
  const gradientColor3Value = document.getElementById('gradientColor3-value');
  if (gradientColor3) {
    gradientColor3.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (gradientColor3Value) gradientColor3Value.textContent = hex;
      sendParamChange('gradientColor3', hex);
      sendParamChange('gradientPreset', 'custom');
      if (gradientPreset) gradientPreset.value = 'custom';
    });
  }

  setupSlider('gradientContrast', 'gradientContrastValue', (val) => {
    sendParamChange('gradientContrast', parseFloat(val));
  });

  setupSlider('gradientBrightness', 'gradientBrightnessValue', (val) => {
    sendParamChange('gradientBrightness', parseFloat(val));
  });

  // Mode 3: Camera Shake
  setupSlider('shakeMaxPosition', 'shakeMaxPositionValue', (val) => {
    sendParamChange('shakeMaxPosition', parseFloat(val));
  });

  setupSlider('shakeMaxRotation', 'shakeMaxRotationValue', (val) => {
    sendParamChange('shakeMaxRotation', parseFloat(val));
  });

  setupSlider('shakeSmoothness', 'shakeSmoothnessValue', (val) => {
    sendParamChange('shakeSmoothness', parseFloat(val));
  });

  setupSlider('shakeAudioSensitivity', 'shakeAudioSensitivityValue', (val) => {
    sendParamChange('shakeAudioSensitivity', parseFloat(val));
  });

  setupSlider('shakeRefractionAmount', 'shakeRefractionAmountValue', (val) => {
    sendParamChange('shakeRefractionAmount', parseFloat(val));
  });

  setupSlider('shakeRefractionIntensity', 'shakeRefractionIntensityValue', (val) => {
    sendParamChange('shakeRefractionIntensity', parseFloat(val));
  });

  updateModeControls();
}

/**
 * Helper to setup slider with value display
 */
function setupSlider(sliderId, valueId, callback) {
  const slider = document.getElementById(sliderId);
  const valueDisplay = document.getElementById(valueId);

  if (!slider) return;

  slider.addEventListener('input', (e) => {
    const val = e.target.value;
    if (valueDisplay) {
      valueDisplay.textContent = parseFloat(val).toFixed(2);
    }
    callback(val);
  });

  // Initial value
  if (valueDisplay && slider.value !== undefined) {
    valueDisplay.textContent = parseFloat(slider.value).toFixed(2);
  }
}

/**
 * Update visible mode controls
 */
function updateModeControls() {
  const modeSelect = document.getElementById('modeSelect');
  if (!modeSelect) return;

  const currentMode = parseInt(modeSelect.value);

  for (let i = 0; i < 4; i++) {
    const modeControls = document.getElementById(`mode${i}-controls`);
    if (modeControls) {
      modeControls.style.display = currentMode === i ? 'block' : 'none';
    }
  }
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

/**
 * Get all current parameters
 */
function getAllParams() {
  return {
    mode: parseInt(document.getElementById('modeSelect')?.value || 0),
    audioSensitivity: parseFloat(document.getElementById('audioSensitivity')?.value || 1.0),
    globalIntensity: parseFloat(document.getElementById('globalIntensity')?.value || 1.0),
    globalBrightness: parseFloat(document.getElementById('globalBrightness')?.value || 0),
    globalContrast: parseFloat(document.getElementById('globalContrast')?.value || 1.0),
    globalBlend: parseFloat(document.getElementById('globalBlend')?.value || 1.0),
    globalBlur: parseFloat(document.getElementById('globalBlur')?.value || 0),
    // Mode 0: Kaleidoscope
    kaleidSegments: parseFloat(document.getElementById('kaleidSegments')?.value || 6),
    kaleidSubdivisions: parseFloat(document.getElementById('kaleidSubdivisions')?.value || 1),
    kaleidMirrorStrength: parseFloat(document.getElementById('kaleidMirrorStrength')?.value || 1.0),
    kaleidZoom: parseFloat(document.getElementById('kaleidZoom')?.value || 1.0),
    kaleidRotationSpeed: parseFloat(document.getElementById('kaleidRotationSpeed')?.value || 0),
    // Mode 1: Glitch
    glitchBaseIntensity: parseFloat(document.getElementById('glitchBaseIntensity')?.value || 0.3),
    glitchMaxPixelSize: parseFloat(document.getElementById('glitchMaxPixelSize')?.value || 8),
    glitchRGBOffset: parseFloat(document.getElementById('glitchRGBOffset')?.value || 0.01),
    glitchThreshold: parseFloat(document.getElementById('glitchThreshold')?.value || 0.5),
    // Mode 2: Gradient Map
    gradientPreset: document.getElementById('gradientPreset')?.value || 'custom',
    gradientColor1: document.getElementById('gradientColor1')?.value || '#000000',
    gradientColor2: document.getElementById('gradientColor2')?.value || '#808080',
    gradientColor3: document.getElementById('gradientColor3')?.value || '#ffffff',
    gradientContrast: parseFloat(document.getElementById('gradientContrast')?.value || 1.0),
    gradientBrightness: parseFloat(document.getElementById('gradientBrightness')?.value || 0),
    // Mode 3: Camera Shake
    shakeMaxPosition: parseFloat(document.getElementById('shakeMaxPosition')?.value || 0.02),
    shakeMaxRotation: parseFloat(document.getElementById('shakeMaxRotation')?.value || 0.1),
    shakeSmoothness: parseFloat(document.getElementById('shakeSmoothness')?.value || 0.7),
    shakeAudioSensitivity: parseFloat(document.getElementById('shakeAudioSensitivity')?.value || 1.0),
    shakeRefractionAmount: parseFloat(document.getElementById('shakeRefractionAmount')?.value || 0),
    shakeRefractionIntensity: parseFloat(document.getElementById('shakeRefractionIntensity')?.value || 1.0)
  };
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

