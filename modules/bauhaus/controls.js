/**
 * Bauhaus Controls
 * UI for controlling the bauhaus visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'bauhaus';

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
  if (event.data.type === 'PARAM_UPDATES') {
    // Module has randomized settings, update UI
    applyParams(event.data.updates);
  }
}

/**
 * Set up control inputs
 */
function setupControls() {
  // Grid Density
  const densitySelect = document.getElementById('density');
  if (densitySelect) {
    densitySelect.addEventListener('change', (e) => {
      sendParamChange('density', e.target.value);
    });
  }

  // Shape checkboxes
  const chkSq = document.getElementById('chk-sq');
  const chkCi = document.getElementById('chk-ci');
  const chkWe = document.getElementById('chk-we');
  const chkTri = document.getElementById('chk-tri');

  if (chkSq) {
    chkSq.addEventListener('change', () => {
      sendParamChange('shapes', getActiveShapes());
    });
  }
  if (chkCi) {
    chkCi.addEventListener('change', () => {
      sendParamChange('shapes', getActiveShapes());
    });
  }
  if (chkWe) {
    chkWe.addEventListener('change', () => {
      sendParamChange('shapes', getActiveShapes());
    });
  }
  if (chkTri) {
    chkTri.addEventListener('change', () => {
      sendParamChange('shapes', getActiveShapes());
    });
  }

  // Reshuffle button
  const btnReshuffle = document.getElementById('btn-reshuffle');
  if (btnReshuffle) {
    btnReshuffle.addEventListener('click', () => {
      sendParamChange('reshuffle', true);
    });
  }

  // Theme
  const themeSelect = document.getElementById('theme');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      sendParamChange('theme', e.target.value);
    });
  }

  // Color Transition Rate
  const transitionRateSlider = document.getElementById('transitionRate');
  const transitionRateValue = document.getElementById('transitionRate-value');
  if (transitionRateSlider) {
    transitionRateSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (transitionRateValue) transitionRateValue.textContent = value.toFixed(1);
      sendParamChange('colorTransitionDuration', value);
    });
  }

  // Color Sequence checkbox
  const chkColorSequence = document.getElementById('chk-color-sequence');
  if (chkColorSequence) {
    chkColorSequence.addEventListener('change', (e) => {
      sendParamChange('colorSequence', e.target.checked);
      updateControlVisibility();
    });
  }

  // Sequence Rate
  const sequenceRateSlider = document.getElementById('sequenceRate');
  const sequenceRateValue = document.getElementById('sequenceRate-value');
  if (sequenceRateSlider) {
    sequenceRateSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (sequenceRateValue) sequenceRateValue.textContent = value.toFixed(1);
      sendParamChange('sequenceRate', value);
    });
  }

  // Time Offset
  const timeOffsetSlider = document.getElementById('timeOffset');
  const timeOffsetValue = document.getElementById('timeOffset-value');
  if (timeOffsetSlider) {
    timeOffsetSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (timeOffsetValue) timeOffsetValue.textContent = value;
      sendParamChange('timeOffset', value);
    });
  }

  // Audio Reactive checkbox
  const chkAudio = document.getElementById('chk-audio');
  if (chkAudio) {
    chkAudio.addEventListener('change', (e) => {
      sendParamChange('audioReactive', e.target.checked);
      updateControlVisibility();
    });
  }

  // Audio Sensitivity
  const sensitivitySlider = document.getElementById('sensitivity');
  const sensitivityValue = document.getElementById('sensitivity-value');
  if (sensitivitySlider) {
    sensitivitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (sensitivityValue) sensitivityValue.textContent = value;
      sendParamChange('sensitivity', value);
    });
  }

  // Scaling Amount
  const scalingAmountSlider = document.getElementById('scalingAmount');
  const scalingAmountValue = document.getElementById('scalingAmount-value');
  if (scalingAmountSlider) {
    scalingAmountSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (scalingAmountValue) scalingAmountValue.textContent = value;
      sendParamChange('scalingAmount', value);
    });
  }

  // Scaling Offset
  const scalingOffsetSlider = document.getElementById('scalingOffset');
  const scalingOffsetValue = document.getElementById('scalingOffset-value');
  if (scalingOffsetSlider) {
    scalingOffsetSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (scalingOffsetValue) scalingOffsetValue.textContent = value;
      sendParamChange('scalingOffset', value);
    });
  }

  // Wedge Flip Rate
  const wedgeFlipRateSlider = document.getElementById('wedgeFlipRate');
  const wedgeFlipRateValue = document.getElementById('wedgeFlipRate-value');
  if (wedgeFlipRateSlider) {
    wedgeFlipRateSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (wedgeFlipRateValue) wedgeFlipRateValue.textContent = value;
      sendParamChange('wedgeFlipRate', value);
    });
  }

  // Show Grid checkbox
  const chkGrid = document.getElementById('chk-grid');
  if (chkGrid) {
    chkGrid.addEventListener('change', (e) => {
      sendParamChange('showGrid', e.target.checked);
    });
  }

  // Randomize Colors button
  const btnRandomizeColors = document.getElementById('btn-randomize-colors');
  if (btnRandomizeColors) {
    btnRandomizeColors.addEventListener('click', () => {
      sendParamChange('randomizeColors', true);
    });
  }

  // Randomize Settings button
  const btnRandomizeSettings = document.getElementById('btn-randomize-settings');
  if (btnRandomizeSettings) {
    btnRandomizeSettings.addEventListener('click', () => {
      sendParamChange('randomizeSettings', true);
    });
  }

  // Initialize control visibility
  updateControlVisibility();
}

/**
 * Get active shapes from checkboxes
 */
function getActiveShapes() {
  const shapes = [];
  if (document.getElementById('chk-sq')?.checked) shapes.push('square');
  if (document.getElementById('chk-ci')?.checked) shapes.push('circle');
  if (document.getElementById('chk-we')?.checked) shapes.push('wedge');
  if (document.getElementById('chk-tri')?.checked) shapes.push('triangle');
  return shapes.length > 0 ? shapes : ['square'];
}

/**
 * Update control visibility based on checkboxes
 */
function updateControlVisibility() {
  const audioControls = document.getElementById('audio-controls');
  const audioControlsScaling = document.getElementById('audio-controls-scaling');
  const audioControlsOffset = document.getElementById('audio-controls-offset');
  const colorSequenceControls = document.getElementById('color-sequence-controls');
  const colorSequenceControlsOffset = document.getElementById('color-sequence-controls-offset');

  const chkAudio = document.getElementById('chk-audio');
  const chkColorSequence = document.getElementById('chk-color-sequence');

  if (audioControls && chkAudio) {
    if (chkAudio.checked) {
      audioControls.style.display = 'block';
      if (audioControlsScaling) audioControlsScaling.style.display = 'block';
      if (audioControlsOffset) audioControlsOffset.style.display = 'block';
    } else {
      audioControls.style.display = 'none';
      if (audioControlsScaling) audioControlsScaling.style.display = 'none';
      if (audioControlsOffset) audioControlsOffset.style.display = 'none';
    }
  }

  if (colorSequenceControls && chkColorSequence) {
    if (chkColorSequence.checked) {
      colorSequenceControls.style.display = 'block';
      if (colorSequenceControlsOffset) colorSequenceControlsOffset.style.display = 'block';
    } else {
      colorSequenceControls.style.display = 'none';
      if (colorSequenceControlsOffset) colorSequenceControlsOffset.style.display = 'none';
    }
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
 * Get all current parameter values
 */
function getAllParams() {
  return {
    density: document.getElementById('density')?.value || '16,9',
    shapes: getActiveShapes(),
    theme: document.getElementById('theme')?.value || 'bauhaus',
    colorTransitionDuration: parseFloat(document.getElementById('transitionRate')?.value || '1.0'),
    colorSequence: document.getElementById('chk-color-sequence')?.checked || false,
    sequenceRate: parseFloat(document.getElementById('sequenceRate')?.value || '1.0'),
    timeOffset: parseInt(document.getElementById('timeOffset')?.value || '10'),
    audioReactive: document.getElementById('chk-audio')?.checked || true,
    sensitivity: parseInt(document.getElementById('sensitivity')?.value || '60'),
    scalingAmount: parseInt(document.getElementById('scalingAmount')?.value || '15'),
    scalingOffset: parseInt(document.getElementById('scalingOffset')?.value || '10'),
    wedgeFlipRate: parseInt(document.getElementById('wedgeFlipRate')?.value || '20'),
    showGrid: document.getElementById('chk-grid')?.checked || true
  };
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  if (params.density !== undefined) {
    const el = document.getElementById('density');
    if (el) {
      el.value = params.density;
      el.dispatchEvent(new Event('change'));
    }
  }
  if (params.shapes !== undefined) {
    const chkSq = document.getElementById('chk-sq');
    const chkCi = document.getElementById('chk-ci');
    const chkWe = document.getElementById('chk-we');
    const chkTri = document.getElementById('chk-tri');
    if (chkSq) chkSq.checked = params.shapes.includes('square');
    if (chkCi) chkCi.checked = params.shapes.includes('circle');
    if (chkWe) chkWe.checked = params.shapes.includes('wedge');
    if (chkTri) chkTri.checked = params.shapes.includes('triangle');
    if (chkSq || chkCi || chkWe || chkTri) {
      sendParamChange('shapes', params.shapes);
    }
  }
  if (params.theme !== undefined) {
    const el = document.getElementById('theme');
    if (el) {
      el.value = params.theme;
      el.dispatchEvent(new Event('change'));
    }
  }
  if (params.colorTransitionDuration !== undefined) {
    const el = document.getElementById('transitionRate');
    const valEl = document.getElementById('transitionRate-value');
    if (el) {
      el.value = params.colorTransitionDuration;
      if (valEl) valEl.textContent = params.colorTransitionDuration.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.colorSequence !== undefined) {
    const el = document.getElementById('chk-color-sequence');
    if (el) {
      el.checked = params.colorSequence;
      el.dispatchEvent(new Event('change'));
    }
  }
  if (params.sequenceRate !== undefined) {
    const el = document.getElementById('sequenceRate');
    const valEl = document.getElementById('sequenceRate-value');
    if (el) {
      el.value = params.sequenceRate;
      if (valEl) valEl.textContent = params.sequenceRate.toFixed(1);
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.timeOffset !== undefined) {
    const el = document.getElementById('timeOffset');
    const valEl = document.getElementById('timeOffset-value');
    if (el) {
      el.value = params.timeOffset;
      if (valEl) valEl.textContent = params.timeOffset;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.audioReactive !== undefined) {
    const el = document.getElementById('chk-audio');
    if (el) {
      el.checked = params.audioReactive;
      el.dispatchEvent(new Event('change'));
    }
  }
  if (params.sensitivity !== undefined) {
    const el = document.getElementById('sensitivity');
    const valEl = document.getElementById('sensitivity-value');
    if (el) {
      el.value = params.sensitivity;
      if (valEl) valEl.textContent = params.sensitivity;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.scalingAmount !== undefined) {
    const el = document.getElementById('scalingAmount');
    const valEl = document.getElementById('scalingAmount-value');
    if (el) {
      el.value = params.scalingAmount;
      if (valEl) valEl.textContent = params.scalingAmount;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.scalingOffset !== undefined) {
    const el = document.getElementById('scalingOffset');
    const valEl = document.getElementById('scalingOffset-value');
    if (el) {
      el.value = params.scalingOffset;
      if (valEl) valEl.textContent = params.scalingOffset;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.wedgeFlipRate !== undefined) {
    const el = document.getElementById('wedgeFlipRate');
    const valEl = document.getElementById('wedgeFlipRate-value');
    if (el) {
      el.value = params.wedgeFlipRate;
      if (valEl) valEl.textContent = params.wedgeFlipRate;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.showGrid !== undefined) {
    const el = document.getElementById('chk-grid');
    if (el) {
      el.checked = params.showGrid;
      el.dispatchEvent(new Event('change'));
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
