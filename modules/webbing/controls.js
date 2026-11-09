/**
 * Webbing Controls
 * UI for controlling the webbing visualization
 */

import { generateRandomPalette } from '../../shared/colorPalette.js';
import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'webbing';

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

/**
 * Helper function to sync range and number inputs
 */
function syncInputs(rangeId, numId, valueId, updateFn, parseFn = parseFloat) {
  const rangeInput = document.getElementById(rangeId);
  const numInput = document.getElementById(numId);
  const valueDisplay = document.getElementById(valueId);

  function update(value) {
    const parsed = parseFn(value);
    rangeInput.value = parsed;
    if (numInput) numInput.value = parsed;
    if (valueDisplay) {
      if (parseFn === parseInt) {
        valueDisplay.textContent = parsed;
      } else if (parsed < 1) {
        valueDisplay.textContent = parsed.toFixed(3);
      } else {
        valueDisplay.textContent = parsed.toFixed(1);
      }
    }
    updateFn(parsed);
  }

  if (rangeInput) {
    rangeInput.addEventListener('input', (e) => update(e.target.value));
  }

  if (numInput) {
    numInput.addEventListener('input', (e) => {
      const val = parseFn(e.target.value);
      const min = parseFn(rangeInput.min);
      const max = parseFn(rangeInput.max);
      const clamped = Math.max(min, Math.min(max, val));
      update(clamped);
    });
  }
}

/**
 * Set up control inputs
 */
function setupControls() {
  // Color themes
  const colorThemes = {
    ocean: { low: '#0000ff', high: '#00ffff' },
    sunset: { low: '#ff3300', high: '#ffcc00' },
    neon: { low: '#ff00ff', high: '#00ffff' },
    forest: { low: '#006600', high: '#66ff00' },
    fire: { low: '#ff0000', high: '#ffff00' },
    purple: { low: '#6600cc', high: '#cc00ff' },
    rainbow: { low: '#ff0000', high: '#0000ff' },
    monochrome: { low: '#ffffff', high: '#888888' }
  };

  // Emitter controls
  syncInputs('orbitRadius', 'orbitRadius-num', 'orbitRadius-value', (val) => {
    sendParamChange('orbitRadius', val);
  }, parseInt);

  syncInputs('orbitSpeed', 'orbitSpeed-num', 'orbitSpeed-value', (val) => {
    sendParamChange('orbitSpeed', val);
  });

  syncInputs('particleCount', 'particleCount-num', 'particleCount-value', (val) => {
    sendParamChange('particleCount', Math.floor(val));
  }, parseInt);

  syncInputs('spawnRate', 'spawnRate-num', 'spawnRate-value', (val) => {
    sendParamChange('spawnRate', val);
  });

  syncInputs('amplitudeThreshold', 'amplitudeThreshold-num', 'amplitudeThreshold-value', (val) => {
    sendParamChange('amplitudeThreshold', val);
  });

  syncInputs('connectionDistance', 'connectionDistance-num', 'connectionDistance-value', (val) => {
    sendParamChange('connectionDistance', val);
  }, parseInt);

  // Particle size controls
  syncInputs('minSize', 'minSize-num', 'minSize-value', (val) => {
    sendParamChange('minSize', val);
  });

  syncInputs('maxSize', 'maxSize-num', 'maxSize-value', (val) => {
    sendParamChange('maxSize', val);
  });

  // Particle speed controls
  syncInputs('minSpeed', 'minSpeed-num', 'minSpeed-value', (val) => {
    sendParamChange('minSpeed', val);
  });

  syncInputs('maxSpeed', 'maxSpeed-num', 'maxSpeed-value', (val) => {
    sendParamChange('maxSpeed', val);
  });

  // Particle lifespan controls
  syncInputs('minLifespan', 'minLifespan-num', 'minLifespan-value', (val) => {
    sendParamChange('minLifespan', val);
  });

  syncInputs('maxLifespan', 'maxLifespan-num', 'maxLifespan-value', (val) => {
    sendParamChange('maxLifespan', val);
  });

  // Color theme
  const colorThemeSelect = document.getElementById('colorTheme');
  if (colorThemeSelect) {
    colorThemeSelect.addEventListener('change', (e) => {
      const theme = e.target.value;
      const themeColors = colorThemes[theme];
      if (themeColors) {
        document.getElementById('lowColor').value = themeColors.low;
        document.getElementById('highColor').value = themeColors.high;
        document.getElementById('lowColor-value').textContent = themeColors.low;
        document.getElementById('highColor-value').textContent = themeColors.high;
        sendParamChange('colorTheme', theme);
        sendParamChange('lowColor', themeColors.low);
        sendParamChange('highColor', themeColors.high);
      }
    });
  }

  // Color pickers
  const lowColorPicker = document.getElementById('lowColor');
  const lowColorValue = document.getElementById('lowColor-value');
  if (lowColorPicker) {
    lowColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (lowColorValue) lowColorValue.textContent = hex;
      sendParamChange('lowColor', hex);
    });
  }

  const highColorPicker = document.getElementById('highColor');
  const highColorValue = document.getElementById('highColor-value');
  if (highColorPicker) {
    highColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (highColorValue) highColorValue.textContent = hex;
      sendParamChange('highColor', hex);
    });
  }

  // Connection color
  const connectionColorPicker = document.getElementById('connectionColor');
  const connectionColorValue = document.getElementById('connectionColor-value');
  if (connectionColorPicker) {
    connectionColorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (connectionColorValue) connectionColorValue.textContent = hex;
      sendParamChange('connectionColor', hex);
    });
  }

  syncInputs('connectionThickness', 'connectionThickness-num', 'connectionThickness-value', (val) => {
    sendParamChange('connectionThickness', val);
  });

  // Frequency thresholds
  syncInputs('lowFreq', 'lowFreq-num', 'lowFreq-value', (val) => {
    sendParamChange('lowFreq', val);
  }, parseInt);

  syncInputs('highFreq', 'highFreq-num', 'highFreq-value', (val) => {
    sendParamChange('highFreq', val);
  }, parseInt);

  // Background color
  const backgroundColorInput = document.getElementById('backgroundColor');
  if (backgroundColorInput) {
    backgroundColorInput.addEventListener('input', (e) => {
      sendParamChange('backgroundColor', e.target.value);
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
  const colorThemes = {
    ocean: { low: '#0000ff', high: '#00ffff' },
    sunset: { low: '#ff3300', high: '#ffcc00' },
    neon: { low: '#ff00ff', high: '#00ffff' },
    forest: { low: '#006600', high: '#66ff00' },
    fire: { low: '#ff0000', high: '#ffff00' },
    purple: { low: '#6600cc', high: '#cc00ff' },
    rainbow: { low: '#ff0000', high: '#0000ff' },
    monochrome: { low: '#ffffff', high: '#888888' }
  };

  function randRange(min, max, step = 1) {
    const nSteps = Math.floor((max - min) / step);
    return min + step * Math.floor(Math.random() * (nSteps + 1));
  }

  // Randomize emitter settings
  const orbitRadius = randRange(50, 500, 10);
  updateInputSync('orbitRadius', orbitRadius, parseInt);

  const orbitSpeed = Math.random() * 0.18 + 0.01;
  updateInputSync('orbitSpeed', orbitSpeed, parseFloat);

  const particleCount = randRange(10, 200, 5);
  updateInputSync('particleCount', particleCount, parseInt);

  const spawnRate = Math.random();
  updateInputSync('spawnRate', spawnRate, parseFloat);

  const amplitudeThreshold = Math.random() * 0.085 + 0.005;
  updateInputSync('amplitudeThreshold', amplitudeThreshold, parseFloat);

  const connectionDistance = randRange(50, 500, 10);
  updateInputSync('connectionDistance', connectionDistance, parseInt);

  // Randomize particle size
  const minSize = Math.random() * 15 + 1;
  const maxSize = Math.random() * 40 + minSize;
  updateInputSync('minSize', minSize, parseFloat);
  updateInputSync('maxSize', maxSize, parseFloat);

  // Randomize particle speed
  const minSpeed = Math.random() * 8;
  const maxSpeed = Math.random() * 12 + minSpeed;
  updateInputSync('minSpeed', minSpeed, parseFloat);
  updateInputSync('maxSpeed', maxSpeed, parseFloat);

  // Randomize particle lifespan
  const minLifespan = Math.random() * 8 + 0.5;
  const maxLifespan = Math.random() * 20 + minLifespan;
  updateInputSync('minLifespan', minLifespan, parseFloat);
  updateInputSync('maxLifespan', maxLifespan, parseFloat);

  // Generate harmonious color palette (4 colors needed: lowColor, highColor, connectionColor, backgroundColor)
  const palette1 = generateRandomPalette();
  const palette2 = generateRandomPalette();

  // Use palette for main colors
  document.getElementById('lowColor').value = palette1.c1;
  document.getElementById('lowColor-value').textContent = palette1.c1;
  sendParamChange('lowColor', palette1.c1);

  document.getElementById('highColor').value = palette1.c2;
  document.getElementById('highColor-value').textContent = palette1.c2;
  sendParamChange('highColor', palette1.c2);

  // Randomize color theme to match new colors
  const themeKeys = Object.keys(colorThemes);
  const randomTheme = themeKeys[Math.floor(Math.random() * themeKeys.length)];
  document.getElementById('colorTheme').value = randomTheme;
  sendParamChange('colorTheme', randomTheme);

  // Use palette for connection and background colors
  document.getElementById('connectionColor').value = palette1.c3;
  document.getElementById('connectionColor-value').textContent = palette1.c3;
  sendParamChange('connectionColor', palette1.c3);

  const connectionThickness = Math.random() * 9 + 0.5;
  updateInputSync('connectionThickness', connectionThickness, parseFloat);

  // Randomize frequency thresholds
  const lowFreq = randRange(50, 900, 10);
  const highFreq = randRange(lowFreq + 100, 5000, 50);
  updateInputSync('lowFreq', lowFreq, parseInt);
  updateInputSync('highFreq', highFreq, parseInt);

  // Use second palette for background color
  document.getElementById('backgroundColor').value = palette2.c1;
  sendParamChange('backgroundColor', palette2.c1);
}

/**
 * Helper to update synced inputs
 */
function updateInputSync(id, value, parseFn = parseFloat) {
  const rangeInput = document.getElementById(id);
  const numInput = document.getElementById(id + '-num');
  const valueDisplay = document.getElementById(id + '-value');

  const parsed = parseFn(value);
  if (rangeInput) rangeInput.value = parsed;
  if (numInput) numInput.value = parsed;
  if (valueDisplay) {
    if (parseFn === parseInt) {
      valueDisplay.textContent = parsed;
    } else if (parsed < 1) {
      valueDisplay.textContent = parsed.toFixed(3);
    } else {
      valueDisplay.textContent = parsed.toFixed(1);
    }
  }
  sendParamChange(id, parsed);
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
    orbitRadius: parseInt(document.getElementById('orbitRadius')?.value || '250'),
    orbitSpeed: parseFloat(document.getElementById('orbitSpeed')?.value || '0.04'),
    particleCount: parseInt(document.getElementById('particleCount')?.value || '50'),
    spawnRate: parseFloat(document.getElementById('spawnRate')?.value || '1'),
    amplitudeThreshold: parseFloat(document.getElementById('amplitudeThreshold')?.value || '0.015'),
    connectionDistance: parseInt(document.getElementById('connectionDistance')?.value || '200'),
    minSize: parseFloat(document.getElementById('minSize')?.value || '2'),
    maxSize: parseFloat(document.getElementById('maxSize')?.value || '8'),
    minSpeed: parseFloat(document.getElementById('minSpeed')?.value || '1'),
    maxSpeed: parseFloat(document.getElementById('maxSpeed')?.value || '5'),
    minLifespan: parseFloat(document.getElementById('minLifespan')?.value || '1'),
    maxLifespan: parseFloat(document.getElementById('maxLifespan')?.value || '14'),
    colorTheme: document.getElementById('colorTheme')?.value || 'ocean',
    lowColor: document.getElementById('lowColor')?.value || '#0000ff',
    highColor: document.getElementById('highColor')?.value || '#ff0000',
    connectionColor: document.getElementById('connectionColor')?.value || '#ffffff',
    connectionThickness: parseFloat(document.getElementById('connectionThickness')?.value || '1'),
    lowFreq: parseInt(document.getElementById('lowFreq')?.value || '200'),
    highFreq: parseInt(document.getElementById('highFreq')?.value || '2000'),
    backgroundColor: document.getElementById('backgroundColor')?.value || '#000000'
  };
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  if (params.orbitRadius !== undefined) updateInputSync('orbitRadius', params.orbitRadius, parseInt);
  if (params.orbitSpeed !== undefined) updateInputSync('orbitSpeed', params.orbitSpeed, parseFloat);
  if (params.particleCount !== undefined) updateInputSync('particleCount', params.particleCount, parseInt);
  if (params.spawnRate !== undefined) updateInputSync('spawnRate', params.spawnRate, parseFloat);
  if (params.amplitudeThreshold !== undefined) updateInputSync('amplitudeThreshold', params.amplitudeThreshold, parseFloat);
  if (params.connectionDistance !== undefined) updateInputSync('connectionDistance', params.connectionDistance, parseInt);
  if (params.minSize !== undefined) updateInputSync('minSize', params.minSize, parseFloat);
  if (params.maxSize !== undefined) updateInputSync('maxSize', params.maxSize, parseFloat);
  if (params.minSpeed !== undefined) updateInputSync('minSpeed', params.minSpeed, parseFloat);
  if (params.maxSpeed !== undefined) updateInputSync('maxSpeed', params.maxSpeed, parseFloat);
  if (params.minLifespan !== undefined) updateInputSync('minLifespan', params.minLifespan, parseFloat);
  if (params.maxLifespan !== undefined) updateInputSync('maxLifespan', params.maxLifespan, parseFloat);

  if (params.colorTheme !== undefined) {
    const el = document.getElementById('colorTheme');
    if (el) el.value = params.colorTheme;
    el?.dispatchEvent(new Event('change'));
  }

  if (params.lowColor !== undefined) {
    const el = document.getElementById('lowColor');
    const valEl = document.getElementById('lowColor-value');
    if (el) el.value = params.lowColor;
    if (valEl) valEl.textContent = params.lowColor;
    el?.dispatchEvent(new Event('input'));
  }

  if (params.highColor !== undefined) {
    const el = document.getElementById('highColor');
    const valEl = document.getElementById('highColor-value');
    if (el) el.value = params.highColor;
    if (valEl) valEl.textContent = params.highColor;
    el?.dispatchEvent(new Event('input'));
  }

  if (params.connectionColor !== undefined) {
    const el = document.getElementById('connectionColor');
    const valEl = document.getElementById('connectionColor-value');
    if (el) el.value = params.connectionColor;
    if (valEl) valEl.textContent = params.connectionColor;
    el?.dispatchEvent(new Event('input'));
  }

  if (params.connectionThickness !== undefined) updateInputSync('connectionThickness', params.connectionThickness, parseFloat);
  if (params.lowFreq !== undefined) updateInputSync('lowFreq', params.lowFreq, parseInt);
  if (params.highFreq !== undefined) updateInputSync('highFreq', params.highFreq, parseInt);

  if (params.backgroundColor !== undefined) {
    const el = document.getElementById('backgroundColor');
    if (el) el.value = params.backgroundColor;
    el?.dispatchEvent(new Event('input'));
  }
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

