/**
 * Orbiting Wheels Controls
 * UI for controlling the wheels visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'wheels';

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
  // Background color
  const bgColorInput = document.getElementById('bgColor');
  if (bgColorInput) {
    bgColorInput.addEventListener('input', (e) => {
      sendParamChange('bgColor', e.target.value);
    });
  }

  // Driver rate
  const driverRateInput = document.getElementById('driverRate');
  const driverRateValue = document.getElementById('driverRateValue');
  if (driverRateInput) {
    driverRateInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (driverRateValue) driverRateValue.textContent = val.toFixed(2);
      sendParamChange('driverRate', val);
    });
  }

  // Master palette
  const masterPaletteSelect = document.getElementById('masterPalette');
  if (masterPaletteSelect) {
    masterPaletteSelect.addEventListener('change', (e) => {
      sendParamChange('masterPalette', e.target.value);
    });
  }

  // Layout mode
  const layoutModeSelect = document.getElementById('layoutMode');
  if (layoutModeSelect) {
    layoutModeSelect.addEventListener('change', (e) => {
      sendParamChange('layoutMode', e.target.value);
      updateLayoutVisibility(e.target.value);
    });
    // Initialize visibility
    updateLayoutVisibility(layoutModeSelect.value);
  }

  // Aligned offset
  const alignedOffsetInput = document.getElementById('alignedOffset');
  const alignedOffsetValue = document.getElementById('alignedOffsetValue');
  if (alignedOffsetInput) {
    alignedOffsetInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (alignedOffsetValue) alignedOffsetValue.textContent = val.toFixed(1);
      sendParamChange('alignedOffset', val);
    });
  }

  // Camera mode
  const cameraModeSelect = document.getElementById('cameraMode');
  if (cameraModeSelect) {
    cameraModeSelect.addEventListener('change', (e) => {
      sendParamChange('cameraMode', e.target.value);
    });
  }

  // Camera orbit speed
  const cameraOrbitSpeedInput = document.getElementById('cameraOrbitSpeed');
  const cameraOrbitSpeedValue = document.getElementById('cameraOrbitSpeedValue');
  if (cameraOrbitSpeedInput) {
    cameraOrbitSpeedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (cameraOrbitSpeedValue) cameraOrbitSpeedValue.textContent = val.toFixed(2);
      sendParamChange('cameraOrbitSpeed', val);
    });
  }

  // Camera dolly amount
  const cameraDollyAmountInput = document.getElementById('cameraDollyAmount');
  const cameraDollyAmountValue = document.getElementById('cameraDollyAmountValue');
  if (cameraDollyAmountInput) {
    cameraDollyAmountInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (cameraDollyAmountValue) cameraDollyAmountValue.textContent = val.toFixed(2);
      sendParamChange('cameraDollyAmount', val);
    });
  }

  // Orbit depth
  const orbitDepthInput = document.getElementById('orbitDepth');
  const orbitDepthValue = document.getElementById('orbitDepthValue');
  if (orbitDepthInput) {
    orbitDepthInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (orbitDepthValue) orbitDepthValue.textContent = val.toFixed(1);
      sendParamChange('orbitDepth', val);
    });
  }

  // Orbit radius mult
  const orbitRadiusMultInput = document.getElementById('orbitRadiusMult');
  const orbitRadiusMultValue = document.getElementById('orbitRadiusMultValue');
  if (orbitRadiusMultInput) {
    orbitRadiusMultInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (orbitRadiusMultValue) orbitRadiusMultValue.textContent = val.toFixed(2);
      sendParamChange('orbitRadiusMult', val);
    });
  }

  // Orbit speed
  const orbitSpeedInput = document.getElementById('orbitSpeed');
  const orbitSpeedValue = document.getElementById('orbitSpeedValue');
  if (orbitSpeedInput) {
    orbitSpeedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (orbitSpeedValue) orbitSpeedValue.textContent = val.toFixed(2);
      sendParamChange('orbitSpeed', val);
    });
  }

  // Orbit tilt X
  const orbitTiltXInput = document.getElementById('orbitTiltX');
  const orbitTiltXValue = document.getElementById('orbitTiltXValue');
  if (orbitTiltXInput) {
    orbitTiltXInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (orbitTiltXValue) orbitTiltXValue.textContent = Math.round(val).toString();
      sendParamChange('orbitTiltX', val);
    });
  }

  // Orbit tilt Y
  const orbitTiltYInput = document.getElementById('orbitTiltY');
  const orbitTiltYValue = document.getElementById('orbitTiltYValue');
  if (orbitTiltYInput) {
    orbitTiltYInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (orbitTiltYValue) orbitTiltYValue.textContent = Math.round(val).toString();
      sendParamChange('orbitTiltY', val);
    });
  }

  // Tunnel depth
  const tunnelDepthInput = document.getElementById('tunnelDepth');
  const tunnelDepthValue = document.getElementById('tunnelDepthValue');
  if (tunnelDepthInput) {
    tunnelDepthInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (tunnelDepthValue) tunnelDepthValue.textContent = val.toFixed(0);
      sendParamChange('tunnelDepth', val);
    });
  }

  // Tunnel speed
  const tunnelSpeedInput = document.getElementById('tunnelSpeed');
  const tunnelSpeedValue = document.getElementById('tunnelSpeedValue');
  if (tunnelSpeedInput) {
    tunnelSpeedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (tunnelSpeedValue) tunnelSpeedValue.textContent = val.toFixed(1);
      sendParamChange('tunnelSpeed', val);
    });
  }

  // Master audio sensitivity
  const masterAudioSensInput = document.getElementById('masterAudioSens');
  const masterAudioSensValue = document.getElementById('masterAudioSensValue');
  if (masterAudioSensInput) {
    masterAudioSensInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (masterAudioSensValue) masterAudioSensValue.textContent = val.toFixed(2);
      sendParamChange('masterAudioSens', val);
    });
  }

  // Master spin multiplier
  const masterSpinMultInput = document.getElementById('masterSpinMult');
  const masterSpinMultValue = document.getElementById('masterSpinMultValue');
  if (masterSpinMultInput) {
    masterSpinMultInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (masterSpinMultValue) masterSpinMultValue.textContent = val.toFixed(2);
      sendParamChange('masterSpinMult', val);
    });
  }

  // Master drift multiplier
  const masterDriftMultInput = document.getElementById('masterDriftMult');
  const masterDriftMultValue = document.getElementById('masterDriftMultValue');
  if (masterDriftMultInput) {
    masterDriftMultInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (masterDriftMultValue) masterDriftMultValue.textContent = val.toFixed(2);
      sendParamChange('masterDriftMult', val);
    });
  }

  // Master global scale
  const masterGlobalScaleInput = document.getElementById('masterGlobalScale');
  const masterGlobalScaleValue = document.getElementById('masterGlobalScaleValue');
  if (masterGlobalScaleInput) {
    masterGlobalScaleInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (masterGlobalScaleValue) masterGlobalScaleValue.textContent = val.toFixed(2);
      sendParamChange('masterGlobalScale', val);
    });
  }

  // Master disc count multiplier
  const masterDiscCountMultInput = document.getElementById('masterDiscCountMult');
  const masterDiscCountMultValue = document.getElementById('masterDiscCountMultValue');
  if (masterDiscCountMultInput) {
    masterDiscCountMultInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (masterDiscCountMultValue) masterDiscCountMultValue.textContent = val.toFixed(2);
      sendParamChange('masterDiscCountMult', val);
    });
  }

  // Master disc size multiplier
  const masterDiscSizeMultInput = document.getElementById('masterDiscSizeMult');
  const masterDiscSizeMultValue = document.getElementById('masterDiscSizeMultValue');
  if (masterDiscSizeMultInput) {
    masterDiscSizeMultInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (masterDiscSizeMultValue) masterDiscSizeMultValue.textContent = val.toFixed(2);
      sendParamChange('masterDiscSizeMult', val);
    });
  }

  // Master glow strength
  const masterGlowStrengthInput = document.getElementById('masterGlowStrength');
  const masterGlowStrengthValue = document.getElementById('masterGlowStrengthValue');
  if (masterGlowStrengthInput) {
    masterGlowStrengthInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (masterGlowStrengthValue) masterGlowStrengthValue.textContent = val.toFixed(2);
      sendParamChange('masterGlowStrength', val);
    });
  }

  // Master opacity effect
  const masterOpacityEffectInput = document.getElementById('masterOpacityEffect');
  const masterOpacityEffectValue = document.getElementById('masterOpacityEffectValue');
  if (masterOpacityEffectInput) {
    masterOpacityEffectInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (masterOpacityEffectValue) masterOpacityEffectValue.textContent = val.toFixed(2);
      sendParamChange('masterOpacityEffect', val);
    });
  }

  // Driver checkboxes
  const driverCheckboxes = [
    'alignedOffsetDriver',
    'cameraOrbitSpeedDriver',
    'cameraDollyAmountDriver',
    'orbitDepthDriver',
    'orbitRadiusMultDriver',
    'orbitSpeedDriver',
    'orbitTiltXDriver',
    'orbitTiltYDriver',
    'tunnelDepthDriver',
    'tunnelSpeedDriver',
    'masterAudioSensDriver',
    'masterSpinMultDriver',
    'masterDriftMultDriver',
    'masterGlobalScaleDriver',
    'masterDiscCountMultDriver',
    'masterDiscSizeMultDriver',
    'masterGlowStrengthDriver',
    'masterOpacityEffectDriver'
  ];

  driverCheckboxes.forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        sendParamChange(id, e.target.checked);
      });
    }
  });

  // Randomize buttons
  const masterRandomizeBtn = document.getElementById('masterRandomizeBtn');
  if (masterRandomizeBtn) {
    masterRandomizeBtn.addEventListener('click', () => {
      randomizeMasterControls();
    });
  }

  const randomizeBtn = document.getElementById('randomizeBtn');
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', () => {
      sendParamChange('randomizeWheels', true);
    });
  }

  const addWheelBtn = document.getElementById('addWheelBtn');
  if (addWheelBtn) {
    addWheelBtn.addEventListener('click', () => {
      sendParamChange('addWheel', true);
    });
  }
}

function randomizeMasterControls() {
  const rand = (min, max) => min + Math.random() * (max - min);
  const setRange = (id, value) => {
    const input = document.getElementById(id);
    if (!input) return;
    const step = Number(input.step) || 1;
    const min = Number(input.min);
    const max = Number(input.max);
    const clamped = Math.min(max, Math.max(min, value));
    const snapped = Math.round(clamped / step) * step;
    input.value = String(snapped);
    const label = document.getElementById(`${id}Value`);
    if (label) {
      const digits = Number.isInteger(step) ? 0 : Math.min(3, (String(input.step).split('.')[1] || '').length);
      label.textContent = digits ? snapped.toFixed(digits) : String(Math.round(snapped));
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  setRange('alignedOffset', rand(2, 20));
  setRange('masterAudioSens', rand(0, 2));
  setRange('masterSpinMult', rand(0.5, 2));
  setRange('masterDriftMult', rand(0.5, 2));
  setRange('masterGlobalScale', rand(0.5, 2));
  setRange('masterDiscCountMult', rand(0.5, 2));
  setRange('masterDiscSizeMult', rand(0.5, 2));
  setRange('masterGlowStrength', rand(0.3, 1));
  setRange('masterOpacityEffect', rand(0, 2));
  setRange('orbitDepth', rand(0, 30));
  setRange('orbitRadiusMult', rand(0.5, 2));
  setRange('orbitSpeed', rand(0, 1));
  setRange('orbitTiltX', rand(-80, 80));
  setRange('orbitTiltY', rand(-80, 80));
  setRange('tunnelDepth', rand(30, 200));
  setRange('tunnelSpeed', rand(0, 20));
  setRange('cameraOrbitSpeed', rand(0, 0.5));
  setRange('cameraDollyAmount', rand(0, 1));
  sendParamChange('randomizeWheels', true);
}

/**
 * Update layout visibility based on selected mode
 */
function updateLayoutVisibility(mode) {
  const alignedControls = document.getElementById('alignedControls');
  const orbitControls = document.getElementById('orbitControls');
  const tunnelControls = document.getElementById('tunnelControls');

  if (alignedControls) {
    alignedControls.style.display = (mode === 'aligned') ? 'block' : 'none';
  }
  if (orbitControls) {
    orbitControls.style.display = (mode === 'orbit3d') ? 'block' : 'none';
  }
  if (tunnelControls) {
    tunnelControls.style.display = (mode === 'tunnel') ? 'block' : 'none';
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
    bgColor: document.getElementById('bgColor')?.value || '#050509',
    driverRate: parseFloat(document.getElementById('driverRate')?.value || 1),
    masterPalette: document.getElementById('masterPalette')?.value || 'rainbow',
    layoutMode: document.getElementById('layoutMode')?.value || 'free',
    alignedOffset: parseFloat(document.getElementById('alignedOffset')?.value || 4),
    cameraMode: document.getElementById('cameraMode')?.value || 'static',
    cameraOrbitSpeed: parseFloat(document.getElementById('cameraOrbitSpeed')?.value || 0.12),
    cameraDollyAmount: parseFloat(document.getElementById('cameraDollyAmount')?.value || 0.6),
    orbitDepth: parseFloat(document.getElementById('orbitDepth')?.value || 6),
    orbitRadiusMult: parseFloat(document.getElementById('orbitRadiusMult')?.value || 1),
    orbitSpeed: parseFloat(document.getElementById('orbitSpeed')?.value || 0.25),
    orbitTiltX: parseFloat(document.getElementById('orbitTiltX')?.value || 15),
    orbitTiltY: parseFloat(document.getElementById('orbitTiltY')?.value || 20),
    tunnelDepth: parseFloat(document.getElementById('tunnelDepth')?.value || 80),
    tunnelSpeed: parseFloat(document.getElementById('tunnelSpeed')?.value || 5),
    masterAudioSens: parseFloat(document.getElementById('masterAudioSens')?.value || 1),
    masterSpinMult: parseFloat(document.getElementById('masterSpinMult')?.value || 1),
    masterDriftMult: parseFloat(document.getElementById('masterDriftMult')?.value || 1),
    masterGlobalScale: parseFloat(document.getElementById('masterGlobalScale')?.value || 1),
    masterDiscCountMult: parseFloat(document.getElementById('masterDiscCountMult')?.value || 1),
    masterDiscSizeMult: parseFloat(document.getElementById('masterDiscSizeMult')?.value || 1),
    masterGlowStrength: parseFloat(document.getElementById('masterGlowStrength')?.value || 0.8),
    masterOpacityEffect: parseFloat(document.getElementById('masterOpacityEffect')?.value || 1),
    alignedOffsetDriver: document.getElementById('alignedOffsetDriver')?.checked || false,
    cameraOrbitSpeedDriver: document.getElementById('cameraOrbitSpeedDriver')?.checked || false,
    cameraDollyAmountDriver: document.getElementById('cameraDollyAmountDriver')?.checked || false,
    orbitDepthDriver: document.getElementById('orbitDepthDriver')?.checked || false,
    orbitRadiusMultDriver: document.getElementById('orbitRadiusMultDriver')?.checked || false,
    orbitSpeedDriver: document.getElementById('orbitSpeedDriver')?.checked || false,
    orbitTiltXDriver: document.getElementById('orbitTiltXDriver')?.checked || false,
    orbitTiltYDriver: document.getElementById('orbitTiltYDriver')?.checked || false,
    tunnelDepthDriver: document.getElementById('tunnelDepthDriver')?.checked || false,
    tunnelSpeedDriver: document.getElementById('tunnelSpeedDriver')?.checked || false,
    masterAudioSensDriver: document.getElementById('masterAudioSensDriver')?.checked || false,
    masterSpinMultDriver: document.getElementById('masterSpinMultDriver')?.checked || false,
    masterDriftMultDriver: document.getElementById('masterDriftMultDriver')?.checked || false,
    masterGlobalScaleDriver: document.getElementById('masterGlobalScaleDriver')?.checked || false,
    masterDiscCountMultDriver: document.getElementById('masterDiscCountMultDriver')?.checked || false,
    masterDiscSizeMultDriver: document.getElementById('masterDiscSizeMultDriver')?.checked || false,
    masterGlowStrengthDriver: document.getElementById('masterGlowStrengthDriver')?.checked || false,
    masterOpacityEffectDriver: document.getElementById('masterOpacityEffectDriver')?.checked || false
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


