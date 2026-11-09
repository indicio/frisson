/**
 * Inkdrop Controls
 * UI for controlling the inkdrop visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;

const MODULE_ID = 'inkdrop';

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

function formatRate(value) {
  const rate = Number(value);
  return rate <= 0 ? 'Off' : `${rate}/min`;
}

function formatVariation(value) {
  return `${Number(value)}%`;
}

/**
 * Set up control inputs
 */
function setupControls() {
  // Control elements
  const addInkBtn = document.getElementById('addInk');
  const clearBtn = document.getElementById('clearBtn');
  const randomizeBtn = document.getElementById('randomizeBtn');
  const autoRandomizeToggle = document.getElementById('autoRandomize');
  const sensitivitySlider = document.getElementById('sensitivity');
  const diffusionSlider = document.getElementById('diffusion');
  const minParticleSizeSlider = document.getElementById('minParticleSize');
  const maxParticleSizeSlider = document.getElementById('maxParticleSize');
  const gravitySlider = document.getElementById('gravity');
  const spinRateSlider = document.getElementById('spinRate');
  const spinDirectionSelect = document.getElementById('spinDirection');
  const spinTurbulenceSlider = document.getElementById('spinTurbulence');
  const colorThemeSelect = document.getElementById('colorTheme');
  const dropRateSlider = document.getElementById('dropRate');
  const dropVariationSlider = document.getElementById('dropVariation');
  const sensValue = document.getElementById('sensValue');
  const diffValue = document.getElementById('diffValue');
  const minSizeValue = document.getElementById('minSizeValue');
  const maxSizeValue = document.getElementById('maxSizeValue');
  const gravityValue = document.getElementById('gravityValue');
  const spinRateValue = document.getElementById('spinRateValue');
  const spinTurbulenceValue = document.getElementById('spinTurbulenceValue');
  const dropRateValue = document.getElementById('dropRateValue');
  const dropVariationValue = document.getElementById('dropVariationValue');

  // Local state
  let autoRandomizeInterval = null;

  // Theme options for randomizing
  const themeOptions = ['ocean', 'sunset', 'neon', 'forest', 'fire', 'purple', 'rainbow', 'monochrome'];

  // Button events
  if (addInkBtn) {
    addInkBtn.addEventListener('click', () => {
      sendParamChange('action', { action: 'addInk' });
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      sendParamChange('action', { action: 'clearCanvas' });
    });
  }

  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', () => {
      randomizeSettings();
    });
  }

  // Slider events
  if (sensitivitySlider) {
    sensitivitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (sensValue) sensValue.textContent = value;
      sendParamChange('sensitivity', value);
    });
  }

  if (diffusionSlider) {
    diffusionSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (diffValue) diffValue.textContent = value;
      sendParamChange('diffusion', value);
    });
  }

  if (minParticleSizeSlider) {
    minParticleSizeSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (minSizeValue) minSizeValue.textContent = value.toFixed(1);
      sendParamChange('minParticleSize', value);
    });
  }

  if (maxParticleSizeSlider) {
    maxParticleSizeSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (maxSizeValue) maxSizeValue.textContent = value.toFixed(1);
      sendParamChange('maxParticleSize', value);
    });
  }

  if (gravitySlider) {
    gravitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (gravityValue) gravityValue.textContent = value;
      sendParamChange('gravity', value);
    });
  }

  if (spinRateSlider) {
    spinRateSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (spinRateValue) spinRateValue.textContent = value;
      sendParamChange('spinRate', value);
    });
  }

  if (spinDirectionSelect) {
    spinDirectionSelect.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      sendParamChange('spinDirection', value);
    });
  }

  if (spinTurbulenceSlider) {
    spinTurbulenceSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (spinTurbulenceValue) spinTurbulenceValue.textContent = value;
      sendParamChange('spinTurbulence', value);
    });
  }

  if (colorThemeSelect) {
    colorThemeSelect.addEventListener('change', (e) => {
      const value = e.target.value;
      sendParamChange('colorTheme', value);
    });
  }

  if (dropRateSlider) {
    dropRateSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value, 10);
      if (dropRateValue) dropRateValue.textContent = formatRate(value);
      sendParamChange('dropRate', value);
    });
  }

  if (dropVariationSlider) {
    dropVariationSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value, 10);
      if (dropVariationValue) dropVariationValue.textContent = formatVariation(value);
      sendParamChange('dropVariation', value);
    });
  }

  // Auto-randomize functionality
  if (autoRandomizeToggle) {
    autoRandomizeToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        autoRandomizeInterval = setInterval(() => {
          randomizeSettings();
        }, 10000);
      } else {
        if (autoRandomizeInterval) {
          clearInterval(autoRandomizeInterval);
          autoRandomizeInterval = null;
        }
      }
    });
  }

  // Randomize settings function
  function randomizeSettings() {
    // Randomize sensitivity (1-100)
    const sensitivity = Math.floor(Math.random() * 100) + 1;
    if (sensitivitySlider) {
      sensitivitySlider.value = sensitivity;
      if (sensValue) sensValue.textContent = sensitivity;
      sendParamChange('sensitivity', sensitivity);
    }

    // Randomize diffusion (1-100)
    const diffusion = Math.floor(Math.random() * 100) + 1;
    if (diffusionSlider) {
      diffusionSlider.value = diffusion;
      if (diffValue) diffValue.textContent = diffusion;
      sendParamChange('diffusion', diffusion);
    }

    // Randomize min particle size (0.5-10)
    const minParticleSize = Math.round((Math.random() * 9.5 + 0.5) * 2) / 2;
    if (minParticleSizeSlider) {
      minParticleSizeSlider.value = minParticleSize;
      if (minSizeValue) minSizeValue.textContent = minParticleSize.toFixed(1);
      sendParamChange('minParticleSize', minParticleSize);
    }

    // Randomize max particle size (minParticleSize-30)
    const maxMin = Math.max(minParticleSize, 1);
    const maxParticleSize = Math.round((Math.random() * (30 - maxMin) + maxMin) * 2) / 2;
    if (maxParticleSizeSlider) {
      maxParticleSizeSlider.value = maxParticleSize;
      if (maxSizeValue) maxSizeValue.textContent = maxParticleSize.toFixed(1);
      sendParamChange('maxParticleSize', maxParticleSize);
    }

    // Randomize gravity (-100 to 100)
    const gravity = Math.floor(Math.random() * 201) - 100;
    if (gravitySlider) {
      gravitySlider.value = gravity;
      if (gravityValue) gravityValue.textContent = gravity;
      sendParamChange('gravity', gravity);
    }

    // Randomize spin rate (0-200)
    const spinRate = Math.floor(Math.random() * 201);
    if (spinRateSlider) {
      spinRateSlider.value = spinRate;
      if (spinRateValue) spinRateValue.textContent = spinRate;
      sendParamChange('spinRate', spinRate);
    }

    // Randomize spin direction (1 or -1)
    const spinDirection = Math.random() < 0.5 ? 1 : -1;
    if (spinDirectionSelect) {
      spinDirectionSelect.value = spinDirection;
      sendParamChange('spinDirection', spinDirection);
    }

    // Randomize spin turbulence (0-100)
    const spinTurbulence = Math.floor(Math.random() * 101);
    if (spinTurbulenceSlider) {
      spinTurbulenceSlider.value = spinTurbulence;
      if (spinTurbulenceValue) spinTurbulenceValue.textContent = spinTurbulence;
      sendParamChange('spinTurbulence', spinTurbulence);
    }

    const dropRate = Math.floor(Math.random() * 61);
    if (dropRateSlider) {
      dropRateSlider.value = dropRate;
      if (dropRateValue) dropRateValue.textContent = formatRate(dropRate);
      sendParamChange('dropRate', dropRate);
    }

    const dropVariation = Math.floor(Math.random() * 101);
    if (dropVariationSlider) {
      dropVariationSlider.value = dropVariation;
      if (dropVariationValue) dropVariationValue.textContent = formatVariation(dropVariation);
      sendParamChange('dropVariation', dropVariation);
    }

    // Randomize color theme
    const randomTheme = themeOptions[Math.floor(Math.random() * themeOptions.length)];
    if (colorThemeSelect) {
      colorThemeSelect.value = randomTheme;
      sendParamChange('colorTheme', randomTheme);
    }
  }
}

/**
 * Send parameter change message
 */
function sendParamChange(param, value) {
  if (controlsChannel) {
    // Handle action requests specially
    if (param === 'action') {
      // Actions are sent as special messages that the module handles via handleAction
      // For now, we'll send them as PARAM_CHANGE messages with a special format
      if (value && value.action) {
        controlsChannel.postMessage({
          type: 'PARAM_CHANGE',
          param: '_action',
          value: value.action,
          data: value
        });
      }
    } else {
      controlsChannel.postMessage({
        type: 'PARAM_CHANGE',
        param: param,
        value: value
      });
    }
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
    sensitivity: parseInt(document.getElementById('sensitivity')?.value || '50'),
    diffusion: parseInt(document.getElementById('diffusion')?.value || '50'),
    minParticleSize: parseFloat(document.getElementById('minParticleSize')?.value || '1'),
    maxParticleSize: parseFloat(document.getElementById('maxParticleSize')?.value || '5'),
    gravity: parseInt(document.getElementById('gravity')?.value || '0'),
    spinRate: parseInt(document.getElementById('spinRate')?.value || '0'),
    spinDirection: parseInt(document.getElementById('spinDirection')?.value || '1'),
    spinTurbulence: parseInt(document.getElementById('spinTurbulence')?.value || '0'),
    colorTheme: document.getElementById('colorTheme')?.value || 'ocean',
    dropRate: parseInt(document.getElementById('dropRate')?.value || '8', 10),
    dropVariation: parseInt(document.getElementById('dropVariation')?.value || '40', 10)
  };
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  if (params.sensitivity !== undefined) {
    const el = document.getElementById('sensitivity');
    const valEl = document.getElementById('sensValue');
    if (el) el.value = params.sensitivity;
    if (valEl) valEl.textContent = params.sensitivity;
  }
  if (params.diffusion !== undefined) {
    const el = document.getElementById('diffusion');
    const valEl = document.getElementById('diffValue');
    if (el) el.value = params.diffusion;
    if (valEl) valEl.textContent = params.diffusion;
  }
  if (params.minParticleSize !== undefined) {
    const el = document.getElementById('minParticleSize');
    const valEl = document.getElementById('minSizeValue');
    if (el) el.value = params.minParticleSize;
    if (valEl) valEl.textContent = params.minParticleSize.toFixed(1);
  }
  if (params.maxParticleSize !== undefined) {
    const el = document.getElementById('maxParticleSize');
    const valEl = document.getElementById('maxSizeValue');
    if (el) el.value = params.maxParticleSize;
    if (valEl) valEl.textContent = params.maxParticleSize.toFixed(1);
  }
  if (params.gravity !== undefined) {
    const el = document.getElementById('gravity');
    const valEl = document.getElementById('gravityValue');
    if (el) el.value = params.gravity;
    if (valEl) valEl.textContent = params.gravity;
  }
  if (params.spinRate !== undefined) {
    const el = document.getElementById('spinRate');
    const valEl = document.getElementById('spinRateValue');
    if (el) el.value = params.spinRate;
    if (valEl) valEl.textContent = params.spinRate;
  }
  if (params.spinDirection !== undefined) {
    const el = document.getElementById('spinDirection');
    if (el) el.value = params.spinDirection;
  }
  if (params.spinTurbulence !== undefined) {
    const el = document.getElementById('spinTurbulence');
    const valEl = document.getElementById('spinTurbulenceValue');
    if (el) el.value = params.spinTurbulence;
    if (valEl) valEl.textContent = params.spinTurbulence;
  }
  if (params.colorTheme !== undefined) {
    const el = document.getElementById('colorTheme');
    if (el) el.value = params.colorTheme;
  }
  if (params.dropRate !== undefined) {
    const el = document.getElementById('dropRate');
    const valEl = document.getElementById('dropRateValue');
    if (el) el.value = params.dropRate;
    if (valEl) valEl.textContent = formatRate(params.dropRate);
  }
  if (params.dropVariation !== undefined) {
    const el = document.getElementById('dropVariation');
    const valEl = document.getElementById('dropVariationValue');
    if (el) el.value = params.dropVariation;
    if (valEl) valEl.textContent = formatVariation(params.dropVariation);
  }

  // Send all params to module
  Object.entries(params).forEach(([key, value]) => {
    sendParamChange(key, value);
  });
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
