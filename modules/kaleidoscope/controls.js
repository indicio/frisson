/**
 * Kaleidoscope Controls
 * UI for controlling the kaleidoscope visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'kaleidoscope';

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

  // Kaleidoscope Segments
  setupSlider('kaleidSegments', 'kaleidSegmentsValue', (val) => {
    sendParamChange('kaleidSegments', parseFloat(val));
  }, true);

  // Audio Reactive Segments
  setupSlider('audioReactiveSegments', 'audioReactiveSegmentsValue', (val) => {
    sendParamChange('audioReactiveSegments', parseFloat(val));
  }, true);

  // Kaleidoscope Subdivisions
  setupSlider('kaleidSubdivisions', 'kaleidSubdivisionsValue', (val) => {
    sendParamChange('kaleidSubdivisions', parseFloat(val));
  }, true);

  // Mirror Strength
  setupSlider('kaleidMirrorStrength', 'kaleidMirrorStrengthValue', (val) => {
    sendParamChange('kaleidMirrorStrength', parseFloat(val));
  });

  // Zoom
  setupSlider('kaleidZoom', 'kaleidZoomValue', (val) => {
    sendParamChange('kaleidZoom', parseFloat(val));
  });

  // Rotation Speed
  setupSlider('kaleidRotationSpeed', 'kaleidRotationSpeedValue', (val) => {
    sendParamChange('kaleidRotationSpeed', parseFloat(val));
  });

  // Rotation Centers
  setupSlider('rotationCenters', 'rotationCentersValue', (val) => {
    sendParamChange('rotationCenters', parseFloat(val));
  }, true);

  // Center Orbit Radius
  setupSlider('centerOrbitRadius', 'centerOrbitRadiusValue', (val) => {
    sendParamChange('centerOrbitRadius', parseFloat(val));
  });

  // Center Orbit Speed
  setupSlider('centerOrbitSpeed', 'centerOrbitSpeedValue', (val) => {
    sendParamChange('centerOrbitSpeed', parseFloat(val));
  });

  // Fractal Recursion
  setupSlider('fractalRecursion', 'fractalRecursionValue', (val) => {
    sendParamChange('fractalRecursion', parseFloat(val));
  }, true);

  // Recursion Scale
  setupSlider('recursionScale', 'recursionScaleValue', (val) => {
    sendParamChange('recursionScale', parseFloat(val));
  });

  // Temporal Feedback
  setupSlider('temporalFeedback', 'temporalFeedbackValue', (val) => {
    sendParamChange('temporalFeedback', parseFloat(val));
  });

  // Preset buttons
  const presetPsychedelic = document.getElementById('presetPsychedelic');
  const presetCompoundEye = document.getElementById('presetCompoundEye');
  const presetInfiniteTunnel = document.getElementById('presetInfiniteTunnel');
  const presetRainbowPulse = document.getElementById('presetRainbowPulse');

  if (presetPsychedelic) {
    presetPsychedelic.addEventListener('click', () => {
      applyPreset({
        audioReactiveSegments: 6,
        fractalRecursion: 3,
        temporalFeedback: 0.5
      });
    });
  }

  if (presetCompoundEye) {
    presetCompoundEye.addEventListener('click', () => {
      applyPreset({
        rotationCenters: 4,
        centerOrbitRadius: 0.3,
        centerOrbitSpeed: 0.5
      });
    });
  }

  if (presetInfiniteTunnel) {
    presetInfiniteTunnel.addEventListener('click', () => {
      applyPreset({
        fractalRecursion: 4,
        recursionScale: 2.5,
        kaleidRotationSpeed: 0.5
      });
    });
  }

  if (presetRainbowPulse) {
    presetRainbowPulse.addEventListener('click', () => {
      applyPreset({
        audioReactiveSegments: 8,
        kaleidRotationSpeed: 0.3
      });
    });
  }
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
 * Apply preset values
 */
function applyPreset(presetValues) {
  Object.keys(presetValues).forEach(key => {
    const slider = document.getElementById(key);
    const valueDisplay = document.getElementById(key + 'Value');
    if (slider && valueDisplay) {
      const val = presetValues[key];
      slider.value = val;
      const isInteger = key.includes('Segments') || key.includes('Recursion') || key.includes('Centers');
      if (isInteger) {
        valueDisplay.textContent = Math.round(val);
      } else {
        valueDisplay.textContent = parseFloat(val).toFixed(2);
      }
      slider.dispatchEvent(new Event('input'));
    }
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
    globalBrightness: parseFloat(document.getElementById('globalBrightness')?.value || 0),
    globalContrast: parseFloat(document.getElementById('globalContrast')?.value || 1.0),
    globalBlend: parseFloat(document.getElementById('globalBlend')?.value || 1.0),
    globalBlur: parseFloat(document.getElementById('globalBlur')?.value || 0),
    kaleidSegments: parseFloat(document.getElementById('kaleidSegments')?.value || 6),
    kaleidSubdivisions: parseFloat(document.getElementById('kaleidSubdivisions')?.value || 1),
    kaleidMirrorStrength: parseFloat(document.getElementById('kaleidMirrorStrength')?.value || 1.0),
    kaleidZoom: parseFloat(document.getElementById('kaleidZoom')?.value || 1.0),
    kaleidRotationSpeed: parseFloat(document.getElementById('kaleidRotationSpeed')?.value || 0),
    audioReactiveSegments: parseFloat(document.getElementById('audioReactiveSegments')?.value || 0),
    rotationCenters: parseFloat(document.getElementById('rotationCenters')?.value || 1),
    centerOrbitRadius: parseFloat(document.getElementById('centerOrbitRadius')?.value || 0),
    centerOrbitSpeed: parseFloat(document.getElementById('centerOrbitSpeed')?.value || 0),
    fractalRecursion: parseFloat(document.getElementById('fractalRecursion')?.value || 1),
    recursionScale: parseFloat(document.getElementById('recursionScale')?.value || 1.0),
    temporalFeedback: parseFloat(document.getElementById('temporalFeedback')?.value || 0)
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

