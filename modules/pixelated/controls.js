/**
 * Pixelated Controls
 * UI for controlling the pixelated visualization
 */

import { generateRandomPalette } from '../../shared/colorPalette.js';
import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'pixelated';

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
  // Color theme
  const colorThemeSelect = document.getElementById('colorTheme');
  if (colorThemeSelect) {
    colorThemeSelect.addEventListener('change', (e) => {
      const theme = e.target.value;
      sendParamChange('colorTheme', theme);

      // If not custom, theme will be applied by module
      if (theme !== 'custom') {
        // Module will update colors based on theme
      } else {
        // Custom theme - use current color picker values
        sendParamChange('color1', document.getElementById('color1').value);
        sendParamChange('color2', document.getElementById('color2').value);
      }
    });
  }

  // Color pickers
  const color1Input = document.getElementById('color1');
  const color1Value = document.getElementById('color1-value');
  if (color1Input) {
    color1Input.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (color1Value) color1Value.textContent = hex;
      sendParamChange('color1', hex);

      // Switch to custom when user manually changes color
      if (colorThemeSelect && colorThemeSelect.value !== 'custom') {
        colorThemeSelect.value = 'custom';
        sendParamChange('colorTheme', 'custom');
      }
    });
  }

  const color2Input = document.getElementById('color2');
  const color2Value = document.getElementById('color2-value');
  if (color2Input) {
    color2Input.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (color2Value) color2Value.textContent = hex;
      sendParamChange('color2', hex);

      // Switch to custom when user manually changes color
      if (colorThemeSelect && colorThemeSelect.value !== 'custom') {
        colorThemeSelect.value = 'custom';
        sendParamChange('colorTheme', 'custom');
      }
    });
  }

  const backgroundColorInput = document.getElementById('backgroundColor');
  const backgroundColorValue = document.getElementById('backgroundColor-value');
  if (backgroundColorInput) {
    backgroundColorInput.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (backgroundColorValue) backgroundColorValue.textContent = hex;
      sendParamChange('backgroundColor', hex);
    });
  }

  // Particle type
  const particleTypeSelect = document.getElementById('particleType');
  if (particleTypeSelect) {
    particleTypeSelect.addEventListener('change', (e) => {
      sendParamChange('particleType', e.target.value);
    });
  }

  // Particle diffusion
  const particleDiffusionSelect = document.getElementById('particleDiffusion');
  if (particleDiffusionSelect) {
    particleDiffusionSelect.addEventListener('change', (e) => {
      sendParamChange('particleDiffusion', e.target.value);
    });
  }

  // Particle count
  const particleCountInput = document.getElementById('particleCount');
  const particleCountValue = document.getElementById('particleCount-value');
  if (particleCountInput) {
    particleCountInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (particleCountValue) particleCountValue.textContent = val.toLocaleString();
      sendParamChange('particleCount', val);
    });
  }

  // Particle size
  const particleSizeInput = document.getElementById('particleSize');
  const particleSizeValue = document.getElementById('particleSize-value');
  if (particleSizeInput) {
    particleSizeInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (particleSizeValue) particleSizeValue.textContent = val;
      sendParamChange('particleSize', val);
    });
  }

  // Distortion pattern
  const distortionPatternSelect = document.getElementById('distortionPattern');
  if (distortionPatternSelect) {
    distortionPatternSelect.addEventListener('change', (e) => {
      sendParamChange('distortionPattern', e.target.value);
    });
  }

  // Distortion amount
  const distortionAmountInput = document.getElementById('distortionAmount');
  const distortionAmountValue = document.getElementById('distortionAmount-value');
  if (distortionAmountInput) {
    distortionAmountInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (distortionAmountValue) distortionAmountValue.textContent = val.toFixed(2);
      sendParamChange('distortionAmount', val);
    });
  }

  // Distortion speed
  const distortionSpeedInput = document.getElementById('distortionSpeed');
  const distortionSpeedValue = document.getElementById('distortionSpeed-value');
  if (distortionSpeedInput) {
    distortionSpeedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (distortionSpeedValue) distortionSpeedValue.textContent = val.toFixed(1);
      sendParamChange('distortionSpeed', val);
    });
  }

  // Distortion frequency
  const distortionFrequencyInput = document.getElementById('distortionFrequency');
  const distortionFrequencyValue = document.getElementById('distortionFrequency-value');
  if (distortionFrequencyInput) {
    distortionFrequencyInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (distortionFrequencyValue) distortionFrequencyValue.textContent = val.toFixed(1);
      sendParamChange('distortionFrequency', val);
    });
  }

  // Randomize button
  const randomizeBtn = document.getElementById('randomizeBtn');
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', randomizeControls);
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

  function randIntRange(min, max, step = 1) {
    const nSteps = Math.floor((max - min) / step);
    return min + step * Math.floor(Math.random() * (nSteps + 1));
  }

  function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Generate harmonious color palette
  const palette = generateRandomPalette();

  // Random color theme (or use custom with palette)
  const themes = ['plasma', 'ocean', 'fire', 'neon', 'grayscale', 'technicolor', 'rainbow', 'pastel', 'icecream', 'forest', 'candy', 'custom'];
  const theme = randChoice(themes);
  const colorThemeSelect = document.getElementById('colorTheme');
  if (colorThemeSelect) {
    colorThemeSelect.value = theme;
    colorThemeSelect.dispatchEvent(new Event('change'));
  }

  // If custom theme, use palette colors
  if (theme === 'custom') {
    const color1El = document.getElementById('color1');
    const color1Value = document.getElementById('color1-value');
    if (color1El) {
      color1El.value = palette.c1;
      if (color1Value) color1Value.textContent = palette.c1;
      color1El.dispatchEvent(new Event('input'));
    }

    const color2El = document.getElementById('color2');
    const color2Value = document.getElementById('color2-value');
    if (color2El) {
      color2El.value = palette.c2;
      if (color2Value) color2Value.textContent = palette.c2;
      color2El.dispatchEvent(new Event('input'));
    }
  }

  // Random background color using palette
  const backgroundColorEl = document.getElementById('backgroundColor');
  const backgroundColorValue = document.getElementById('backgroundColor-value');
  if (backgroundColorEl) {
    backgroundColorEl.value = palette.c3;
    if (backgroundColorValue) backgroundColorValue.textContent = palette.c3;
    backgroundColorEl.dispatchEvent(new Event('input'));
  }

  // Random particle type
  const particleTypes = ['sphere', 'square'];
  const particleType = randChoice(particleTypes);
  const particleTypeSelect = document.getElementById('particleType');
  if (particleTypeSelect) {
    particleTypeSelect.value = particleType;
    particleTypeSelect.dispatchEvent(new Event('change'));
  }

  // Random particle diffusion
  const diffusions = ['grid', 'spiral'];
  const diffusion = randChoice(diffusions);
  const particleDiffusionSelect = document.getElementById('particleDiffusion');
  if (particleDiffusionSelect) {
    particleDiffusionSelect.value = diffusion;
    particleDiffusionSelect.dispatchEvent(new Event('change'));
  }

  // Random particle count
  const particleCount = randIntRange(1000, 50000, 1000);
  const particleCountEl = document.getElementById('particleCount');
  const particleCountValue = document.getElementById('particleCount-value');
  if (particleCountEl) particleCountEl.value = particleCount;
  if (particleCountValue) particleCountValue.textContent = particleCount.toLocaleString();
  particleCountEl?.dispatchEvent(new Event('input'));

  // Random particle size
  const particleSize = randRange(1, 10, 0.5);
  const particleSizeEl = document.getElementById('particleSize');
  const particleSizeValue = document.getElementById('particleSize-value');
  if (particleSizeEl) particleSizeEl.value = particleSize;
  if (particleSizeValue) particleSizeValue.textContent = particleSize;
  particleSizeEl?.dispatchEvent(new Event('input'));

  // Random distortion pattern
  const distortionPatterns = ['linear', 'wave', 'spiral', 'pulse', 'ripple', 'twist', 'noise'];
  const distortionPattern = randChoice(distortionPatterns);
  const distortionPatternSelect = document.getElementById('distortionPattern');
  if (distortionPatternSelect) {
    distortionPatternSelect.value = distortionPattern;
    distortionPatternSelect.dispatchEvent(new Event('change'));
  }

  // Random distortion amount
  const distortionAmount = randRange(0, 2, 0.1);
  const distortionAmountEl = document.getElementById('distortionAmount');
  const distortionAmountValue = document.getElementById('distortionAmount-value');
  if (distortionAmountEl) distortionAmountEl.value = distortionAmount;
  if (distortionAmountValue) distortionAmountValue.textContent = distortionAmount.toFixed(2);
  distortionAmountEl?.dispatchEvent(new Event('input'));

  // Random distortion speed
  const distortionSpeed = randRange(0, 3, 0.1);
  const distortionSpeedEl = document.getElementById('distortionSpeed');
  const distortionSpeedValue = document.getElementById('distortionSpeed-value');
  if (distortionSpeedEl) distortionSpeedEl.value = distortionSpeed;
  if (distortionSpeedValue) distortionSpeedValue.textContent = distortionSpeed.toFixed(1);
  distortionSpeedEl?.dispatchEvent(new Event('input'));

  // Random distortion frequency
  const distortionFrequency = randRange(0.1, 5, 0.1);
  const distortionFrequencyEl = document.getElementById('distortionFrequency');
  const distortionFrequencyValue = document.getElementById('distortionFrequency-value');
  if (distortionFrequencyEl) distortionFrequencyEl.value = distortionFrequency;
  if (distortionFrequencyValue) distortionFrequencyValue.textContent = distortionFrequency.toFixed(1);
  distortionFrequencyEl?.dispatchEvent(new Event('input'));
}

/**
 * Get all current parameters
 */
function getAllParams() {
  return {
    colorTheme: document.getElementById('colorTheme')?.value || 'plasma',
    color1: document.getElementById('color1')?.value || '#621cbb',
    color2: document.getElementById('color2')?.value || '#fe3b8f',
    backgroundColor: document.getElementById('backgroundColor')?.value || '#000000',
    particleType: document.getElementById('particleType')?.value || 'sphere',
    particleDiffusion: document.getElementById('particleDiffusion')?.value || 'grid',
    particleCount: parseInt(document.getElementById('particleCount')?.value || 10000),
    particleSize: parseFloat(document.getElementById('particleSize')?.value || 3),
    distortionPattern: document.getElementById('distortionPattern')?.value || 'linear',
    distortionAmount: parseFloat(document.getElementById('distortionAmount')?.value || 0.5),
    distortionSpeed: parseFloat(document.getElementById('distortionSpeed')?.value || 1.0),
    distortionFrequency: parseFloat(document.getElementById('distortionFrequency')?.value || 1.0)
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

