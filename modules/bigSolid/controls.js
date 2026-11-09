/**
 * Big Solid Controls
 * UI for controlling the bigSolid visualization
 */

import { generateRandomPalette } from '../../shared/colorPalette.js';
import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'bigSolid';

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
  // Sensitivity
  const sensitivityInput = document.getElementById('sensitivity');
  const sensitivityValue = document.getElementById('sensitivity-value');
  if (sensitivityInput) {
    sensitivityInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (sensitivityValue) sensitivityValue.textContent = val.toFixed(2);
      sendParamChange('sensitivity', val);
    });
  }

  // Smoothing
  const smoothingInput = document.getElementById('smoothing');
  const smoothingValue = document.getElementById('smoothing-value');
  if (smoothingInput) {
    smoothingInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (smoothingValue) smoothingValue.textContent = val.toFixed(2);
      sendParamChange('smoothing', val);
    });
  }

  // Time-based mode toggle
  const timeBasedModeInput = document.getElementById('timeBasedMode');
  if (timeBasedModeInput) {
    timeBasedModeInput.addEventListener('change', (e) => {
      sendParamChange('timeBasedMode', e.target.checked);
      updateTimeBasedModeVisibility(e.target.checked);
    });

    // Initialize visibility
    updateTimeBasedModeVisibility(timeBasedModeInput.checked);
  }

  // Sequence duration
  const sequenceDurationInput = document.getElementById('sequenceDuration');
  const sequenceDurationValue = document.getElementById('sequenceDuration-value');
  if (sequenceDurationInput) {
    sequenceDurationInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (sequenceDurationValue) sequenceDurationValue.textContent = val.toFixed(1);
      sendParamChange('sequenceDuration', val);
    });
  }

  // Palette selector
  const paletteSelect = document.getElementById('palette');
  if (paletteSelect) {
    paletteSelect.addEventListener('change', (e) => {
      const palette = e.target.value;
      sendParamChange('palette', palette);
      toggleCustomColors(palette);
    });

    // Initialize visibility
    toggleCustomColors(paletteSelect.value);
  }

  // Custom color pickers
  const colorPickers = ['color1', 'color2', 'color3', 'color4'];
  colorPickers.forEach((id) => {
    const picker = document.getElementById(id);
    if (picker) {
      picker.addEventListener('input', (e) => {
        sendParamChange(id, e.target.value);
        // Switch to custom palette if colors are manually changed
        if (paletteSelect && paletteSelect.value !== 'custom') {
          paletteSelect.value = 'custom';
          sendParamChange('palette', 'custom');
          toggleCustomColors('custom');
        }
      });
    }
  });

  // Brightness bias
  const brightnessInput = document.getElementById('brightness');
  const brightnessValue = document.getElementById('brightness-value');
  if (brightnessInput) {
    brightnessInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (brightnessValue) brightnessValue.textContent = val.toFixed(2);
      sendParamChange('brightnessBias', val);
    });
  }

  // Min transition speed
  const minSpeedInput = document.getElementById('minSpeed');
  const minSpeedValue = document.getElementById('minSpeed-value');
  if (minSpeedInput) {
    minSpeedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (minSpeedValue) minSpeedValue.textContent = val.toFixed(4);
      sendParamChange('minTransitionSpeed', val);
    });
  }

  // Max transition speed
  const maxSpeedInput = document.getElementById('maxSpeed');
  const maxSpeedValue = document.getElementById('maxSpeed-value');
  if (maxSpeedInput) {
    maxSpeedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (maxSpeedValue) maxSpeedValue.textContent = val.toFixed(4);
      sendParamChange('maxTransitionSpeed', val);
    });
  }

  // Flash threshold
  const flashThresholdInput = document.getElementById('flashThreshold');
  const flashThresholdValue = document.getElementById('flashThreshold-value');
  if (flashThresholdInput) {
    flashThresholdInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (flashThresholdValue) flashThresholdValue.textContent = val.toFixed(2);
      sendParamChange('flashThreshold', val);
    });
  }

  // Hold mode toggle
  const holdModeInput = document.getElementById('holdMode');
  if (holdModeInput) {
    holdModeInput.addEventListener('change', (e) => {
      sendParamChange('holdMode', e.target.checked);
    });
  }

  // Hold color picker
  const holdColorInput = document.getElementById('holdColor');
  if (holdColorInput) {
    holdColorInput.addEventListener('input', (e) => {
      sendParamChange('holdColor', e.target.value);
    });
  }

  // Randomize button
  const randomizeBtn = document.getElementById('randomizeBtn');
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', randomizeControls);
  }
}

/**
 * Toggle custom colors visibility
 */
function toggleCustomColors(palette) {
  const customColorsGroup = document.getElementById('customColorsGroup');
  if (customColorsGroup) {
    if (palette === 'custom') {
      customColorsGroup.classList.add('visible');
    } else {
      customColorsGroup.classList.remove('visible');
    }
  }
}

/**
 * Update time-based mode controls visibility
 */
function updateTimeBasedModeVisibility(enabled) {
  const sequenceDurationGroup = document.getElementById('sequenceDurationGroup');
  if (sequenceDurationGroup) {
    if (enabled) {
      sequenceDurationGroup.style.display = 'block';
    } else {
      sequenceDurationGroup.style.display = 'none';
    }
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

  function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Generate harmonious color palette
  const palette = generateRandomPalette();

  // Randomize sensitivity
  const sensitivity = randRange(0.5, 2.0, 0.1);
  const sensitivityEl = document.getElementById('sensitivity');
  const sensitivityValue = document.getElementById('sensitivity-value');
  if (sensitivityEl) sensitivityEl.value = sensitivity;
  if (sensitivityValue) sensitivityValue.textContent = sensitivity.toFixed(2);
  sendParamChange('sensitivity', sensitivity);

  // Randomize smoothing
  const smoothing = randRange(0.3, 0.95, 0.05);
  const smoothingEl = document.getElementById('smoothing');
  const smoothingValue = document.getElementById('smoothing-value');
  if (smoothingEl) smoothingEl.value = smoothing;
  if (smoothingValue) smoothingValue.textContent = smoothing.toFixed(2);
  sendParamChange('smoothing', smoothing);

  // Randomize palette
  const palettes = ['warm', 'cool', 'neon', 'monochrome', 'sunset', 'ocean', 'forest', 'purple', 'rainbow', 'custom'];
  const randomPalette = randChoice(palettes);
  const paletteSelect = document.getElementById('palette');
  if (paletteSelect) {
    paletteSelect.value = randomPalette;
    paletteSelect.dispatchEvent(new Event('change'));
  }

  // If custom palette, use palette colors
  if (randomPalette === 'custom') {
    const color1El = document.getElementById('color1');
    const color2El = document.getElementById('color2');
    const color3El = document.getElementById('color3');
    const color4El = document.getElementById('color4');

    // Generate 2 palettes for 4 colors
    const palette2 = generateRandomPalette();

    if (color1El) {
      color1El.value = palette.c1;
      color1El.dispatchEvent(new Event('input'));
    }
    if (color2El) {
      color2El.value = palette.c2;
      color2El.dispatchEvent(new Event('input'));
    }
    if (color3El) {
      color3El.value = palette.c3;
      color3El.dispatchEvent(new Event('input'));
    }
    if (color4El) {
      color4El.value = palette2.c1;
      color4El.dispatchEvent(new Event('input'));
    }
  }

  // Randomize time-based mode
  const timeBasedMode = Math.random() > 0.7; // 30% chance
  const timeBasedModeEl = document.getElementById('timeBasedMode');
  if (timeBasedModeEl) {
    timeBasedModeEl.checked = timeBasedMode;
    timeBasedModeEl.dispatchEvent(new Event('change'));
  }

  // Randomize sequence duration (5-60 seconds)
  const sequenceDuration = randRange(5, 60, 1);
  const sequenceDurationEl = document.getElementById('sequenceDuration');
  const sequenceDurationValue = document.getElementById('sequenceDuration-value');
  if (sequenceDurationEl) sequenceDurationEl.value = sequenceDuration;
  if (sequenceDurationValue) sequenceDurationValue.textContent = sequenceDuration.toFixed(1);
  sendParamChange('sequenceDuration', sequenceDuration);

  // Randomize brightness bias
  const brightness = randRange(-0.5, 0.5, 0.1);
  const brightnessEl = document.getElementById('brightness');
  const brightnessValue = document.getElementById('brightness-value');
  if (brightnessEl) brightnessEl.value = brightness;
  if (brightnessValue) brightnessValue.textContent = brightness.toFixed(2);
  sendParamChange('brightnessBias', brightness);

  // Randomize min transition speed
  const minSpeed = randRange(0.001, 0.02, 0.001);
  const minSpeedEl = document.getElementById('minSpeed');
  const minSpeedValue = document.getElementById('minSpeed-value');
  if (minSpeedEl) minSpeedEl.value = minSpeed;
  if (minSpeedValue) minSpeedValue.textContent = minSpeed.toFixed(4);
  sendParamChange('minTransitionSpeed', minSpeed);

  // Randomize max transition speed
  const maxSpeed = randRange(0.05, 0.3, 0.01);
  const maxSpeedEl = document.getElementById('maxSpeed');
  const maxSpeedValue = document.getElementById('maxSpeed-value');
  if (maxSpeedEl) maxSpeedEl.value = maxSpeed;
  if (maxSpeedValue) maxSpeedValue.textContent = maxSpeed.toFixed(4);
  sendParamChange('maxTransitionSpeed', maxSpeed);

  // Randomize flash threshold
  const flashThreshold = randRange(0.7, 1.0, 0.05);
  const flashThresholdEl = document.getElementById('flashThreshold');
  const flashThresholdValue = document.getElementById('flashThreshold-value');
  if (flashThresholdEl) flashThresholdEl.value = flashThreshold;
  if (flashThresholdValue) flashThresholdValue.textContent = flashThreshold.toFixed(2);
  sendParamChange('flashThreshold', flashThreshold);

  // Randomize hold mode
  const holdMode = Math.random() > 0.5;
  const holdModeEl = document.getElementById('holdMode');
  if (holdModeEl) {
    holdModeEl.checked = holdMode;
    holdModeEl.dispatchEvent(new Event('change'));
  }

  // Randomize hold color using palette
  const holdColorEl = document.getElementById('holdColor');
  if (holdColorEl) {
    holdColorEl.value = palette.c3;
    holdColorEl.dispatchEvent(new Event('input'));
  }
}


/**
 * Get all current parameters
 */
function getAllParams() {
  return {
    sensitivity: parseFloat(document.getElementById('sensitivity')?.value || 1.0),
    smoothing: parseFloat(document.getElementById('smoothing')?.value || 0.7),
    timeBasedMode: document.getElementById('timeBasedMode')?.checked || false,
    sequenceDuration: parseFloat(document.getElementById('sequenceDuration')?.value || 30.0),
    palette: document.getElementById('palette')?.value || 'warm',
    color1: document.getElementById('color1')?.value || '#ff0000',
    color2: document.getElementById('color2')?.value || '#ffa500',
    color3: document.getElementById('color3')?.value || '#ffff00',
    color4: document.getElementById('color4')?.value || '#00ff00',
    brightnessBias: parseFloat(document.getElementById('brightness')?.value || 0),
    minTransitionSpeed: parseFloat(document.getElementById('minSpeed')?.value || 0.005),
    maxTransitionSpeed: parseFloat(document.getElementById('maxSpeed')?.value || 0.15),
    flashThreshold: parseFloat(document.getElementById('flashThreshold')?.value || 0.9),
    holdMode: document.getElementById('holdMode')?.checked || false,
    holdColor: document.getElementById('holdColor')?.value || '#808080'
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

