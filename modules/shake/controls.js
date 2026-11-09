/**
 * Camera Shake Controls
 * UI for controlling the camera shake visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'shake';

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
 * Set up control inputs
 */
function setupControls() {
  // Webcam buttons
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      sendParamChange('startWebcam', true);
      startBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      sendParamChange('stopWebcam', true);
      stopBtn.disabled = true;
      if (startBtn) startBtn.disabled = false;
    });
  }

  // Audio Sensitivity
  setupSlider('audioSensitivity', 'audioSensitivityValue', (val) => {
    sendParamChange('audioSensitivity', parseFloat(val));
  });

  // Global Intensity
  setupSlider('globalIntensity', 'globalIntensityValue', (val) => {
    sendParamChange('globalIntensity', parseFloat(val));
  });

  // Global Brightness
  setupSlider('globalBrightness', 'globalBrightnessValue', (val) => {
    sendParamChange('globalBrightness', parseFloat(val));
  });

  // Global Contrast
  setupSlider('globalContrast', 'globalContrastValue', (val) => {
    sendParamChange('globalContrast', parseFloat(val));
  });

  // Global Blend
  setupSlider('globalBlend', 'globalBlendValue', (val) => {
    sendParamChange('globalBlend', parseFloat(val));
  });

  // Global Blur
  setupSlider('globalBlur', 'globalBlurValue', (val) => {
    sendParamChange('globalBlur', parseFloat(val));
  });

  // Global Saturation
  setupSlider('globalSaturation', 'globalSaturationValue', (val) => {
    sendParamChange('globalSaturation', parseFloat(val));
  });

  // Shake Max Position
  setupSlider('shakeMaxPosition', 'shakeMaxPositionValue', (val) => {
    sendParamChange('shakeMaxPosition', parseFloat(val));
  });

  // Shake Max Rotation
  setupSlider('shakeMaxRotation', 'shakeMaxRotationValue', (val) => {
    sendParamChange('shakeMaxRotation', parseFloat(val));
  });

  // Shake Smoothness
  setupSlider('shakeSmoothness', 'shakeSmoothnessValue', (val) => {
    sendParamChange('shakeSmoothness', parseFloat(val));
  });

  // Shake Audio Sensitivity
  setupSlider('shakeAudioSensitivity', 'shakeAudioSensitivityValue', (val) => {
    sendParamChange('shakeAudioSensitivity', parseFloat(val));
  });

  // Shake Refraction Amount
  setupSlider('shakeRefractionAmount', 'shakeRefractionAmountValue', (val) => {
    sendParamChange('shakeRefractionAmount', parseFloat(val));
  });

  // Shake Refraction Intensity
  setupSlider('shakeRefractionIntensity', 'shakeRefractionIntensityValue', (val) => {
    sendParamChange('shakeRefractionIntensity', parseFloat(val));
  });
}

/**
 * Set up a slider control
 */
function setupSlider(sliderId, valueId, callback, isInteger = false) {
  const slider = document.getElementById(sliderId);
  const valueDisplay = document.getElementById(valueId);

  if (!slider || !valueDisplay) return;

  slider.addEventListener('input', (e) => {
    const val = e.target.value;
    if (isInteger) {
      valueDisplay.textContent = Math.round(parseFloat(val));
    } else {
      valueDisplay.textContent = parseFloat(val).toFixed(2);
    }
    callback(val);
  });

  // Initial display
  if (isInteger) {
    valueDisplay.textContent = Math.round(parseFloat(slider.value));
  } else {
    valueDisplay.textContent = parseFloat(slider.value).toFixed(2);
  }
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
 * Get all current parameters
 */
function getAllParams() {
  return {
    audioSensitivity: parseFloat(document.getElementById('audioSensitivity')?.value || 1.0),
    globalIntensity: parseFloat(document.getElementById('globalIntensity')?.value || 1.0),
    globalBrightness: parseFloat(document.getElementById('globalBrightness')?.value || 0),
    globalContrast: parseFloat(document.getElementById('globalContrast')?.value || 1.0),
    globalBlend: parseFloat(document.getElementById('globalBlend')?.value || 1.0),
    globalBlur: parseFloat(document.getElementById('globalBlur')?.value || 0),
    globalSaturation: parseFloat(document.getElementById('globalSaturation')?.value || 1.0),
    shakeMaxPosition: parseFloat(document.getElementById('shakeMaxPosition')?.value || 0.02),
    shakeMaxRotation: parseFloat(document.getElementById('shakeMaxRotation')?.value || 0.1),
    shakeSmoothness: parseFloat(document.getElementById('shakeSmoothness')?.value || 0.7),
    shakeAudioSensitivity: parseFloat(document.getElementById('shakeAudioSensitivity')?.value || 1.0),
    shakeRefractionAmount: parseFloat(document.getElementById('shakeRefractionAmount')?.value || 0),
    shakeRefractionIntensity: parseFloat(document.getElementById('shakeRefractionIntensity')?.value || 1.0)
  };
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

