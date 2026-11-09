/**
 * Wormhole Controls
 * UI for controlling the wormhole visualization
 */

import { generateRandomPalette } from '../../shared/colorPalette.js';
import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'wormhole';

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
  // Global controls
  const tunnelShapeSelect = document.getElementById('tunnelShape');
  if (tunnelShapeSelect) {
    tunnelShapeSelect.addEventListener('change', (e) => {
      sendParamChange('tunnelShape', e.target.value);
    });
  }

  const colorModeSelect = document.getElementById('colorMode');
  if (colorModeSelect) {
    colorModeSelect.addEventListener('change', (e) => {
      sendParamChange('colorMode', e.target.value);
    });
  }

  const elementColorInput = document.getElementById('elementColor');
  const elementColorValue = document.getElementById('elementColor-value');
  if (elementColorInput) {
    elementColorInput.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (elementColorValue) elementColorValue.textContent = hex;
      sendParamChange('elementColor', hex);
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

  // Speed
  const speedInput = document.getElementById('speed');
  const speedValue = document.getElementById('speed-value');
  if (speedInput) {
    speedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (speedValue) speedValue.textContent = val.toFixed(1);
      sendParamChange('speed', val);
    });
  }

  // Audio sensitivity
  const audioSensitivityInput = document.getElementById('audioSensitivity');
  const audioSensitivityValue = document.getElementById('audioSensitivity-value');
  if (audioSensitivityInput) {
    audioSensitivityInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (audioSensitivityValue) audioSensitivityValue.textContent = val.toFixed(1);
      sendParamChange('audioSensitivity', val);
    });
  }

  // Shape selector - controls visibility of shape-specific controls
  const shapeSelect = document.getElementById('shape');
  if (shapeSelect) {
    shapeSelect.addEventListener('change', (e) => {
      const shape = e.target.value;
      sendParamChange('shape', shape);
      updateControlVisibility(shape);
    });

    // Initialize visibility
    updateControlVisibility(shapeSelect.value);
  }

  // Star controls
  const flowDirectionSelect = document.getElementById('flowDirection');
  if (flowDirectionSelect) {
    flowDirectionSelect.addEventListener('change', (e) => {
      sendParamChange('flowDirection', e.target.value);
    });
  }

  const starDensityInput = document.getElementById('starDensity');
  const starDensityValue = document.getElementById('starDensity-value');
  if (starDensityInput) {
    starDensityInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (starDensityValue) starDensityValue.textContent = val;
      sendParamChange('starDensity', val);
    });
  }

  const lineLengthInput = document.getElementById('lineLength');
  const lineLengthValue = document.getElementById('lineLength-value');
  if (lineLengthInput) {
    lineLengthInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (lineLengthValue) lineLengthValue.textContent = val.toFixed(1);
      sendParamChange('lineLength', val);
    });
  }

  // Ring controls
  const ringCountInput = document.getElementById('ringCount');
  const ringCountValue = document.getElementById('ringCount-value');
  if (ringCountInput) {
    ringCountInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (ringCountValue) ringCountValue.textContent = val;
      sendParamChange('ringCount', val);
    });
  }

  const ringThicknessInput = document.getElementById('ringThickness');
  const ringThicknessValue = document.getElementById('ringThickness-value');
  if (ringThicknessInput) {
    ringThicknessInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (ringThicknessValue) ringThicknessValue.textContent = val.toFixed(2);
      sendParamChange('ringThickness', val);
    });
  }

  const ringSpacingInput = document.getElementById('ringSpacing');
  const ringSpacingValue = document.getElementById('ringSpacing-value');
  if (ringSpacingInput) {
    ringSpacingInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (ringSpacingValue) ringSpacingValue.textContent = val.toFixed(1);
      sendParamChange('ringSpacing', val);
    });
  }

  const ringRadiusInput = document.getElementById('ringRadius');
  const ringRadiusValue = document.getElementById('ringRadius-value');
  if (ringRadiusInput) {
    ringRadiusInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (ringRadiusValue) ringRadiusValue.textContent = val;
      sendParamChange('ringRadius', val);
      sendParamChange('tunnelRadius', val);
    });
  }

  // Square controls
  const squareCountInput = document.getElementById('squareCount');
  const squareCountValue = document.getElementById('squareCount-value');
  if (squareCountInput) {
    squareCountInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (squareCountValue) squareCountValue.textContent = val;
      sendParamChange('squareCount', val);
    });
  }

  const squareSpacingInput = document.getElementById('squareSpacing');
  const squareSpacingValue = document.getElementById('squareSpacing-value');
  if (squareSpacingInput) {
    squareSpacingInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (squareSpacingValue) squareSpacingValue.textContent = val.toFixed(1);
      sendParamChange('squareSpacing', val);
    });
  }

  const squareSizeInput = document.getElementById('squareSize');
  const squareSizeValue = document.getElementById('squareSize-value');
  if (squareSizeInput) {
    squareSizeInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (squareSizeValue) squareSizeValue.textContent = val;
      sendParamChange('squareSize', val);
    });
  }

  const borderThicknessInput = document.getElementById('borderThickness');
  const borderThicknessValue = document.getElementById('borderThickness-value');
  if (borderThicknessInput) {
    borderThicknessInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (borderThicknessValue) borderThicknessValue.textContent = val.toFixed(1);
      sendParamChange('borderThickness', val);
    });
  }

  const rotationSpeedInput = document.getElementById('rotationSpeed');
  const rotationSpeedValue = document.getElementById('rotationSpeed-value');
  if (rotationSpeedInput) {
    rotationSpeedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (rotationSpeedValue) rotationSpeedValue.textContent = val.toFixed(1);
      sendParamChange('rotationSpeed', val);
    });
  }

  const rotationDirectionSelect = document.getElementById('rotationDirection');
  if (rotationDirectionSelect) {
    rotationDirectionSelect.addEventListener('change', (e) => {
      sendParamChange('rotationDirection', e.target.value);
    });
  }

  const rotationAxisSelect = document.getElementById('rotationAxis');
  if (rotationAxisSelect) {
    rotationAxisSelect.addEventListener('change', (e) => {
      sendParamChange('rotationAxis', e.target.value);
    });
  }

  // Randomize button
  const randomizeBtn = document.getElementById('randomizeBtn');
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', randomizeControls);
  }
}

/**
 * Update control visibility based on selected shape
 */
function updateControlVisibility(shape) {
  const starControls = document.getElementById('star-controls');
  const ringControls = document.getElementById('ring-controls');
  const squareControls = document.getElementById('square-controls');

  if (shape === 'stars') {
    if (starControls) starControls.classList.add('active');
    if (ringControls) ringControls.classList.remove('active');
    if (squareControls) squareControls.classList.remove('active');
  } else if (shape === 'rings') {
    if (starControls) starControls.classList.remove('active');
    if (ringControls) ringControls.classList.add('active');
    if (squareControls) squareControls.classList.remove('active');
  } else if (shape === 'squares') {
    if (starControls) starControls.classList.remove('active');
    if (ringControls) ringControls.classList.remove('active');
    if (squareControls) squareControls.classList.add('active');
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

  function randIntRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Generate harmonious color palette
  const palette = generateRandomPalette();

  // Randomize tunnel shape
  const tunnelShapes = ['cylinder', 'spiral', 'funnel-expand', 'funnel-contract', 'figure8'];
  const tunnelShape = randChoice(tunnelShapes);
  document.getElementById('tunnelShape').value = tunnelShape;
  sendParamChange('tunnelShape', tunnelShape);

  // Randomize color mode
  const colorModes = ['solid', 'rainbow', 'audio-reactive'];
  const colorMode = randChoice(colorModes);
  document.getElementById('colorMode').value = colorMode;
  sendParamChange('colorMode', colorMode);

  // Randomize colors using palette
  const elementColorEl = document.getElementById('elementColor');
  if (elementColorEl) {
    elementColorEl.value = palette.c1;
    const elementColorValue = document.getElementById('elementColor-value');
    if (elementColorValue) elementColorValue.textContent = palette.c1;
    sendParamChange('elementColor', palette.c1);
  }

  const backgroundColorEl = document.getElementById('backgroundColor');
  if (backgroundColorEl) {
    backgroundColorEl.value = palette.c2;
    const backgroundColorValue = document.getElementById('backgroundColor-value');
    if (backgroundColorValue) backgroundColorValue.textContent = palette.c2;
    sendParamChange('backgroundColor', palette.c2);
  }

  // Randomize speed
  const speed = randRange(0.1, 1, 0.1);
  const speedEl = document.getElementById('speed');
  const speedValue = document.getElementById('speed-value');
  if (speedEl) speedEl.value = speed;
  if (speedValue) speedValue.textContent = speed.toFixed(1);
  sendParamChange('speed', speed);

  // Randomize audio sensitivity
  const audioSensitivity = randRange(0, 3, 0.1);
  const audioSensitivityEl = document.getElementById('audioSensitivity');
  const audioSensitivityValue = document.getElementById('audioSensitivity-value');
  if (audioSensitivityEl) audioSensitivityEl.value = audioSensitivity;
  if (audioSensitivityValue) audioSensitivityValue.textContent = audioSensitivity.toFixed(1);
  sendParamChange('audioSensitivity', audioSensitivity);

  // Randomize shape
  const shapes = ['stars', 'rings', 'squares'];
  const shape = randChoice(shapes);
  document.getElementById('shape').value = shape;
  updateControlVisibility(shape);
  sendParamChange('shape', shape);

  // Randomize star-specific settings
  if (shape === 'stars') {
    const flowDirections = ['forward', 'reverse', 'orbital', 'chaotic'];
    const flowDirection = randChoice(flowDirections);
    document.getElementById('flowDirection').value = flowDirection;
    sendParamChange('flowDirection', flowDirection);

    const starDensity = randIntRange(1000, 10000);
    const starDensityEl = document.getElementById('starDensity');
    const starDensityValue = document.getElementById('starDensity-value');
    if (starDensityEl) starDensityEl.value = starDensity;
    if (starDensityValue) starDensityValue.textContent = starDensity;
    sendParamChange('starDensity', starDensity);

    const lineLength = randRange(0.5, 10, 0.1);
    const lineLengthEl = document.getElementById('lineLength');
    const lineLengthValue = document.getElementById('lineLength-value');
    if (lineLengthEl) lineLengthEl.value = lineLength;
    if (lineLengthValue) lineLengthValue.textContent = lineLength.toFixed(1);
    sendParamChange('lineLength', lineLength);
  }

  // Randomize ring-specific settings
  if (shape === 'rings') {
    const ringCount = randIntRange(10, 200);
    const ringCountEl = document.getElementById('ringCount');
    const ringCountValue = document.getElementById('ringCount-value');
    if (ringCountEl) ringCountEl.value = ringCount;
    if (ringCountValue) ringCountValue.textContent = ringCount;
    sendParamChange('ringCount', ringCount);

    const ringThickness = randRange(0.05, 2, 0.05);
    const ringThicknessEl = document.getElementById('ringThickness');
    const ringThicknessValue = document.getElementById('ringThickness-value');
    if (ringThicknessEl) ringThicknessEl.value = ringThickness;
    if (ringThicknessValue) ringThicknessValue.textContent = ringThickness.toFixed(2);
    sendParamChange('ringThickness', ringThickness);

    const ringSpacing = randRange(1, 10, 0.5);
    const ringSpacingEl = document.getElementById('ringSpacing');
    const ringSpacingValue = document.getElementById('ringSpacing-value');
    if (ringSpacingEl) ringSpacingEl.value = ringSpacing;
    if (ringSpacingValue) ringSpacingValue.textContent = ringSpacing.toFixed(1);
    sendParamChange('ringSpacing', ringSpacing);

    const ringRadius = randIntRange(5, 50);
    const ringRadiusEl = document.getElementById('ringRadius');
    const ringRadiusValue = document.getElementById('ringRadius-value');
    if (ringRadiusEl) ringRadiusEl.value = ringRadius;
    if (ringRadiusValue) ringRadiusValue.textContent = ringRadius;
    sendParamChange('ringRadius', ringRadius);
    sendParamChange('tunnelRadius', ringRadius);
  }

  // Randomize square-specific settings
  if (shape === 'squares') {
    const squareCount = randIntRange(10, 200);
    const squareCountEl = document.getElementById('squareCount');
    const squareCountValue = document.getElementById('squareCount-value');
    if (squareCountEl) squareCountEl.value = squareCount;
    if (squareCountValue) squareCountValue.textContent = squareCount;
    sendParamChange('squareCount', squareCount);

    const squareSpacing = randRange(1, 10, 0.5);
    const squareSpacingEl = document.getElementById('squareSpacing');
    const squareSpacingValue = document.getElementById('squareSpacing-value');
    if (squareSpacingEl) squareSpacingEl.value = squareSpacing;
    if (squareSpacingValue) squareSpacingValue.textContent = squareSpacing.toFixed(1);
    sendParamChange('squareSpacing', squareSpacing);

    const squareSize = randIntRange(5, 50);
    const squareSizeEl = document.getElementById('squareSize');
    const squareSizeValue = document.getElementById('squareSize-value');
    if (squareSizeEl) squareSizeEl.value = squareSize;
    if (squareSizeValue) squareSizeValue.textContent = squareSize;
    sendParamChange('squareSize', squareSize);

    const borderThickness = randRange(0, 5, 0.1);
    const borderThicknessEl = document.getElementById('borderThickness');
    const borderThicknessValue = document.getElementById('borderThickness-value');
    if (borderThicknessEl) borderThicknessEl.value = borderThickness;
    if (borderThicknessValue) borderThicknessValue.textContent = borderThickness.toFixed(1);
    sendParamChange('borderThickness', borderThickness);

    const rotationSpeed = randRange(0, 2, 0.1);
    const rotationSpeedEl = document.getElementById('rotationSpeed');
    const rotationSpeedValue = document.getElementById('rotationSpeed-value');
    if (rotationSpeedEl) rotationSpeedEl.value = rotationSpeed;
    if (rotationSpeedValue) rotationSpeedValue.textContent = rotationSpeed.toFixed(1);
    sendParamChange('rotationSpeed', rotationSpeed);

    const rotationDirections = ['forward', 'reverse', 'alternating'];
    const rotationDirection = randChoice(rotationDirections);
    document.getElementById('rotationDirection').value = rotationDirection;
    sendParamChange('rotationDirection', rotationDirection);

    const rotationAxes = ['z', 'xyz', 'xy'];
    const rotationAxis = randChoice(rotationAxes);
    document.getElementById('rotationAxis').value = rotationAxis;
    sendParamChange('rotationAxis', rotationAxis);
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
  const shapeEl = document.getElementById('shape');
  if (shapeEl) updateControlVisibility(shapeEl.value);
}

/**
 * Get all current parameters
 */
function getAllParams() {
  return {
    tunnelShape: document.getElementById('tunnelShape')?.value || 'cylinder',
    colorMode: document.getElementById('colorMode')?.value || 'solid',
    elementColor: document.getElementById('elementColor')?.value || '#4a9eff',
    backgroundColor: document.getElementById('backgroundColor')?.value || '#000000',
    speed: parseFloat(document.getElementById('speed')?.value || 0.5),
    audioSensitivity: parseFloat(document.getElementById('audioSensitivity')?.value || 1.0),
    shape: document.getElementById('shape')?.value || 'stars',
    flowDirection: document.getElementById('flowDirection')?.value || 'forward',
    starDensity: parseInt(document.getElementById('starDensity')?.value || 5000),
    lineLength: parseFloat(document.getElementById('lineLength')?.value || 2.5),
    ringCount: parseInt(document.getElementById('ringCount')?.value || 50),
    ringThickness: parseFloat(document.getElementById('ringThickness')?.value || 0.2),
    ringSpacing: parseFloat(document.getElementById('ringSpacing')?.value || 4.0),
    ringRadius: parseInt(document.getElementById('ringRadius')?.value || 15),
    squareCount: parseInt(document.getElementById('squareCount')?.value || 50),
    squareSpacing: parseFloat(document.getElementById('squareSpacing')?.value || 4.0),
    squareSize: parseInt(document.getElementById('squareSize')?.value || 15),
    borderThickness: parseFloat(document.getElementById('borderThickness')?.value || 2),
    rotationSpeed: parseFloat(document.getElementById('rotationSpeed')?.value || 0.5),
    rotationDirection: document.getElementById('rotationDirection')?.value || 'forward',
    rotationAxis: document.getElementById('rotationAxis')?.value || 'xyz'
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

