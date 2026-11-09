/**
 * Flow Controls
 * UI for controlling the flow visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'flow';

/**
 * Initialize controls
 */
async function init() {
  // Set up BroadcastChannel for communication
  controlsChannel = new BroadcastChannel('visualizer-controls');

  // Listen for messages from module
  controlsChannel.onmessage = handleModuleMessage;

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
 * Handle messages from module
 */
function handleModuleMessage(event) {
  if (event.data && event.data.type === 'PARAM_UPDATES') {
    // Module has randomized settings, update UI
    applyParams(event.data.updates);
  }
}

/**
 * Set up control inputs
 */
function setupControls() {
  // Performance controls
  const qualityPreset = document.getElementById('qualityPreset');
  if (qualityPreset) {
    qualityPreset.addEventListener('change', () => {
      const presets = {
        low: { particles: 5000, subs: 2 },
        medium: { particles: 10000, subs: 3 },
        high: { particles: 20000, subs: 4 },
        ultra: { particles: 40000, subs: 5 },
        extreme: { particles: 60000, subs: 6 }
      };
      const preset = presets[qualityPreset.value];
      if (preset) {
        const particleCountInput = document.getElementById('particleCount');
        const particleCountValue = document.getElementById('particleCountValue');
        const subparticleCountInput = document.getElementById('subparticleCount');
        const subparticleCountValue = document.getElementById('subparticleCountValue');
        const totalVisualCount = document.getElementById('totalVisualCount');

        if (particleCountInput) particleCountInput.value = preset.particles;
        if (particleCountValue) particleCountValue.textContent = preset.particles.toLocaleString();
        if (subparticleCountInput) subparticleCountInput.value = preset.subs;
        if (subparticleCountValue) subparticleCountValue.textContent = preset.subs;
        if (totalVisualCount) {
          const totalVisual = preset.particles * (1 + preset.subs);
          totalVisualCount.textContent = totalVisual.toLocaleString();
        }
      }
    });
  }

  const applyPerfBtn = document.getElementById('apply-performance-btn');
  if (applyPerfBtn) {
    applyPerfBtn.addEventListener('click', () => {
      const particleCount = parseInt(document.getElementById('particleCount')?.value || 30000);
      const subparticleCount = parseInt(document.getElementById('subparticleCount')?.value || 0);
      sendParamChange('particleCount', particleCount);
      sendParamChange('subparticleCount', subparticleCount);
      sendParamChange('applyPerformance', true);
    });
  }

  // Range inputs
  const rangeInputs = [
    'swirlStrength', 'flowSpeed', 'turbulence', 'particleSize', 'brightness',
    'particleDensity', 'particleInteraction', 'viscosity', 'flowInfluence',
    'pointerInfluence', 'audioInfluence', 'particleCount', 'subparticleCount',
    'explodeInterval', 'randomizeInterval'
  ];

  rangeInputs.forEach(id => {
    const input = document.getElementById(id);
    const valueDisplay = document.getElementById(id + 'Value');
    if (input) {
      input.addEventListener('input', () => {
        const value = parseFloat(input.value);
        if (valueDisplay) {
          const decimals = (input.step && Number(input.step) < 1) ? 1 : 0;
          valueDisplay.textContent = value.toFixed(decimals);
        }
        sendParamChange(id, value);
      });
    }
  });

  // Checkboxes
  const autoExplode = document.getElementById('autoExplode');
  if (autoExplode) {
    autoExplode.addEventListener('change', () => {
      sendParamChange('autoExplode', autoExplode.checked);
    });
  }

  const autoRandomize = document.getElementById('autoRandomize');
  if (autoRandomize) {
    autoRandomize.addEventListener('change', () => {
      sendParamChange('autoRandomize', autoRandomize.checked);
    });
  }

  // Buttons
  const explodeBtn = document.getElementById('explode-btn');
  if (explodeBtn) {
    explodeBtn.addEventListener('click', () => {
      sendParamChange('triggerExplode', true);
    });
  }

  const randomizeBtn = document.getElementById('randomize-btn');
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', () => {
      sendParamChange('triggerRandomize', true);
    });
  }

  // Color inputs
  const colorInputs = ['bgColor', 'coolColor', 'warmColor'];
  colorInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', () => {
        sendParamChange(id, input.value);
      });
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
 * Get all current parameter values
 */
function getAllParams() {
  return {
    swirlStrength: parseFloat(document.getElementById('swirlStrength')?.value || 1.8),
    flowSpeed: parseFloat(document.getElementById('flowSpeed')?.value || 1.2),
    turbulence: parseFloat(document.getElementById('turbulence')?.value || 1.3),
    particleSize: parseFloat(document.getElementById('particleSize')?.value || 2.2),
    brightness: parseFloat(document.getElementById('brightness')?.value || 1.2),
    particleDensity: parseFloat(document.getElementById('particleDensity')?.value || 80),
    particleInteraction: parseFloat(document.getElementById('particleInteraction')?.value || 0),
    viscosity: parseFloat(document.getElementById('viscosity')?.value || 1.5),
    flowInfluence: parseFloat(document.getElementById('flowInfluence')?.value || 1.0),
    pointerInfluence: parseFloat(document.getElementById('pointerInfluence')?.value || 0),
    audioInfluence: parseFloat(document.getElementById('audioInfluence')?.value || 1.5),
    bgColor: document.getElementById('bgColor')?.value || '#020309',
    coolColor: document.getElementById('coolColor')?.value || '#6fc9ff',
    warmColor: document.getElementById('warmColor')?.value || '#ff7aa0',
    autoExplode: document.getElementById('autoExplode')?.checked || false,
    explodeInterval: parseInt(document.getElementById('explodeInterval')?.value || 10),
    autoRandomize: document.getElementById('autoRandomize')?.checked || false,
    randomizeInterval: parseInt(document.getElementById('randomizeInterval')?.value || 15),
    particleCount: parseInt(document.getElementById('particleCount')?.value || 30000),
    subparticleCount: parseInt(document.getElementById('subparticleCount')?.value || 0)
  };
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  if (params.swirlStrength !== undefined) {
    const el = document.getElementById('swirlStrength');
    const valEl = document.getElementById('swirlStrengthValue');
    if (el) {
      el.value = params.swirlStrength;
      if (valEl) valEl.textContent = params.swirlStrength.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.flowSpeed !== undefined) {
    const el = document.getElementById('flowSpeed');
    const valEl = document.getElementById('flowSpeedValue');
    if (el) {
      el.value = params.flowSpeed;
      if (valEl) valEl.textContent = params.flowSpeed.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.turbulence !== undefined) {
    const el = document.getElementById('turbulence');
    const valEl = document.getElementById('turbulenceValue');
    if (el) {
      el.value = params.turbulence;
      if (valEl) valEl.textContent = params.turbulence.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.particleSize !== undefined) {
    const el = document.getElementById('particleSize');
    const valEl = document.getElementById('particleSizeValue');
    if (el) {
      el.value = params.particleSize;
      if (valEl) valEl.textContent = params.particleSize.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.brightness !== undefined) {
    const el = document.getElementById('brightness');
    const valEl = document.getElementById('brightnessValue');
    if (el) {
      el.value = params.brightness;
      if (valEl) valEl.textContent = params.brightness.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.particleDensity !== undefined) {
    const el = document.getElementById('particleDensity');
    const valEl = document.getElementById('particleDensityValue');
    if (el) {
      el.value = params.particleDensity;
      if (valEl) valEl.textContent = params.particleDensity;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.particleInteraction !== undefined) {
    const el = document.getElementById('particleInteraction');
    const valEl = document.getElementById('particleInteractionValue');
    if (el) {
      el.value = params.particleInteraction;
      if (valEl) valEl.textContent = params.particleInteraction.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.viscosity !== undefined) {
    const el = document.getElementById('viscosity');
    const valEl = document.getElementById('viscosityValue');
    if (el) {
      el.value = params.viscosity;
      if (valEl) valEl.textContent = params.viscosity.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.flowInfluence !== undefined) {
    const el = document.getElementById('flowInfluence');
    const valEl = document.getElementById('flowInfluenceValue');
    if (el) {
      el.value = params.flowInfluence;
      if (valEl) valEl.textContent = params.flowInfluence.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.pointerInfluence !== undefined) {
    const el = document.getElementById('pointerInfluence');
    const valEl = document.getElementById('pointerInfluenceValue');
    if (el) {
      el.value = params.pointerInfluence;
      if (valEl) valEl.textContent = params.pointerInfluence.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.audioInfluence !== undefined) {
    const el = document.getElementById('audioInfluence');
    const valEl = document.getElementById('audioInfluenceValue');
    if (el) {
      el.value = params.audioInfluence;
      if (valEl) valEl.textContent = params.audioInfluence.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.bgColor !== undefined) {
    const el = document.getElementById('bgColor');
    if (el) {
      el.value = params.bgColor;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.coolColor !== undefined) {
    const el = document.getElementById('coolColor');
    if (el) {
      el.value = params.coolColor;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.warmColor !== undefined) {
    const el = document.getElementById('warmColor');
    if (el) {
      el.value = params.warmColor;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.autoExplode !== undefined) {
    const el = document.getElementById('autoExplode');
    if (el) {
      el.checked = params.autoExplode;
      el.dispatchEvent(new Event('change'));
    }
  }
  if (params.explodeInterval !== undefined) {
    const el = document.getElementById('explodeInterval');
    const valEl = document.getElementById('explodeIntervalValue');
    if (el) {
      el.value = params.explodeInterval;
      if (valEl) valEl.textContent = params.explodeInterval;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.autoRandomize !== undefined) {
    const el = document.getElementById('autoRandomize');
    if (el) {
      el.checked = params.autoRandomize;
      el.dispatchEvent(new Event('change'));
    }
  }
  if (params.randomizeInterval !== undefined) {
    const el = document.getElementById('randomizeInterval');
    const valEl = document.getElementById('randomizeIntervalValue');
    if (el) {
      el.value = params.randomizeInterval;
      if (valEl) valEl.textContent = params.randomizeInterval;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.particleCount !== undefined) {
    const el = document.getElementById('particleCount');
    const valEl = document.getElementById('particleCountValue');
    if (el) {
      el.value = params.particleCount;
      if (valEl) valEl.textContent = params.particleCount.toLocaleString();
    }
  }
  if (params.subparticleCount !== undefined) {
    const el = document.getElementById('subparticleCount');
    const valEl = document.getElementById('subparticleCountValue');
    if (el) {
      el.value = params.subparticleCount;
      if (valEl) valEl.textContent = params.subparticleCount;
    }
  }
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
