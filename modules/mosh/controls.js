/**
 * Datamosh Lab Controls
 * UI for controlling the datamosh visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'mosh';

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

  // Preset buttons
  const nextPresetBtn = document.getElementById('nextPresetBtn');
  const randomPresetBtn = document.getElementById('randomPresetBtn');
  const resetPresetBtn = document.getElementById('resetPresetBtn');

  if (nextPresetBtn) {
    nextPresetBtn.addEventListener('click', () => {
      sendParamChange('nextPreset', true);
    });
  }

  if (randomPresetBtn) {
    randomPresetBtn.addEventListener('click', () => {
      sendParamChange('randomPreset', true);
    });
  }

  if (resetPresetBtn) {
    resetPresetBtn.addEventListener('click', () => {
      sendParamChange('resetPreset', true);
    });
  }

  // Glitch Mode
  setupSelect('glitchMode', (val) => {
    sendParamChange('glitchMode', parseInt(val));
  });

  // Audio Sensitivity
  setupSlider('audioSensitivity', 'audioSensitivityValue', (val) => {
    sendParamChange('audioSensitivity', parseFloat(val));
  });

  // Global Intensity
  setupSlider('globalIntensity', 'globalIntensityValue', (val) => {
    sendParamChange('globalIntensity', parseFloat(val));
  });

  // Resolution Scale
  setupSlider('resolutionScale', 'resolutionScaleValue', (val) => {
    sendParamChange('resolutionScale', parseFloat(val));
  });

  // Glitch Base Intensity
  setupSlider('glitchBaseIntensity', 'glitchBaseIntensityValue', (val) => {
    sendParamChange('glitchBaseIntensity', parseFloat(val));
  });

  // Glitch Max Pixel Size
  setupSlider('glitchMaxPixelSize', 'glitchMaxPixelSizeValue', (val) => {
    sendParamChange('glitchMaxPixelSize', parseFloat(val));
  }, true);

  // Glitch RGB Offset
  setupSlider('glitchRGBOffset', 'glitchRGBOffsetValue', (val) => {
    sendParamChange('glitchRGBOffset', parseFloat(val));
  }, false, (v) => parseFloat(v).toFixed(3));

  // Glitch Threshold
  setupSlider('glitchThreshold', 'glitchThresholdValue', (val) => {
    sendParamChange('glitchThreshold', parseFloat(val));
  });

  // Feedback Mix
  setupSlider('feedbackMix', 'feedbackMixValue', (val) => {
    sendParamChange('feedbackMix', parseFloat(val));
  });

  // Feedback Zoom
  setupSlider('feedbackZoom', 'feedbackZoomValue', (val) => {
    sendParamChange('feedbackZoom', parseFloat(val));
  }, false, (v) => parseFloat(v).toFixed(3));

  // Feedback Distort
  setupSlider('feedbackDistort', 'feedbackDistortValue', (val) => {
    sendParamChange('feedbackDistort', parseFloat(val));
  }, false, (v) => parseFloat(v).toFixed(3));

  // CRT Curvature
  setupSlider('crtCurvature', 'crtCurvatureValue', (val) => {
    sendParamChange('crtCurvature', parseFloat(val));
  });

  // Vignette Strength
  setupSlider('vignetteStrength', 'vignetteStrengthValue', (val) => {
    sendParamChange('vignetteStrength', parseFloat(val));
  });

  // Scanline Intensity
  setupSlider('scanlineIntensity', 'scanlineIntensityValue', (val) => {
    sendParamChange('scanlineIntensity', parseFloat(val));
  });

  // Bloom Threshold
  setupSlider('bloomThreshold', 'bloomThresholdValue', (val) => {
    sendParamChange('bloomThreshold', parseFloat(val));
  });

  // Bloom Intensity
  setupSlider('bloomIntensity', 'bloomIntensityValue', (val) => {
    sendParamChange('bloomIntensity', parseFloat(val));
  });

  // Freeze Probability
  setupSlider('freezeProbability', 'freezeProbabilityValue', (val) => {
    sendParamChange('freezeProbability', parseFloat(val));
  }, false, (v) => parseFloat(v).toFixed(3));

  // Tear Intensity
  setupSlider('tearIntensity', 'tearIntensityValue', (val) => {
    sendParamChange('tearIntensity', parseFloat(val));
  });
}

/**
 * Set up a slider control
 */
function setupSlider(sliderId, valueId, callback, isInteger = false, formatFn = null) {
  const slider = document.getElementById(sliderId);
  const valueDisplay = document.getElementById(valueId);

  if (!slider || !valueDisplay) return;

  slider.addEventListener('input', (e) => {
    const val = e.target.value;
    if (formatFn) {
      valueDisplay.textContent = formatFn(val);
    } else if (isInteger) {
      valueDisplay.textContent = Math.round(parseFloat(val));
    } else {
      valueDisplay.textContent = parseFloat(val).toFixed(2);
    }
    callback(val);
  });

  // Initial display
  if (formatFn) {
    valueDisplay.textContent = formatFn(slider.value);
  } else if (isInteger) {
    valueDisplay.textContent = Math.round(parseFloat(slider.value));
  } else {
    valueDisplay.textContent = parseFloat(slider.value).toFixed(2);
  }
}

/**
 * Set up a select control
 */
function setupSelect(selectId, callback) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.addEventListener('change', (e) => {
    callback(e.target.value);
  });
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
    audioSensitivity: parseFloat(document.getElementById('audioSensitivity')?.value || 1.0),
    globalIntensity: parseFloat(document.getElementById('globalIntensity')?.value || 1.0),
    resolutionScale: parseFloat(document.getElementById('resolutionScale')?.value || 1.0),
    glitchMode: parseInt(document.getElementById('glitchMode')?.value || 0),
    glitchBaseIntensity: parseFloat(document.getElementById('glitchBaseIntensity')?.value || 0.3),
    glitchMaxPixelSize: parseInt(document.getElementById('glitchMaxPixelSize')?.value || 8),
    glitchRGBOffset: parseFloat(document.getElementById('glitchRGBOffset')?.value || 0.01),
    glitchThreshold: parseFloat(document.getElementById('glitchThreshold')?.value || 0.5),
    feedbackMix: parseFloat(document.getElementById('feedbackMix')?.value || 0.3),
    feedbackZoom: parseFloat(document.getElementById('feedbackZoom')?.value || 0.98),
    feedbackDistort: parseFloat(document.getElementById('feedbackDistort')?.value || 0.01),
    crtCurvature: parseFloat(document.getElementById('crtCurvature')?.value || 0.1),
    vignetteStrength: parseFloat(document.getElementById('vignetteStrength')?.value || 0.3),
    scanlineIntensity: parseFloat(document.getElementById('scanlineIntensity')?.value || 0.2),
    bloomThreshold: parseFloat(document.getElementById('bloomThreshold')?.value || 0.7),
    bloomIntensity: parseFloat(document.getElementById('bloomIntensity')?.value || 0.3),
    freezeProbability: parseFloat(document.getElementById('freezeProbability')?.value || 0.01),
    tearIntensity: parseFloat(document.getElementById('tearIntensity')?.value || 0.3)
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

