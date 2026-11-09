/**
 * Op Art Controls
 * UI for controlling the op-art visualization
 */

import { generateRandomPalette } from '../../shared/colorPalette.js';
import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'op-art';

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
 * Set up control inputs
 */
function setupControls() {
  // Cube Count
  const cubeCountSlider = document.getElementById('cubeCount');
  const cubeCountValue = document.getElementById('cubeCount-value');
  if (cubeCountSlider) {
    cubeCountSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (cubeCountValue) cubeCountValue.textContent = value;
      sendParamChange('cubeCount', value);
    });
  }

  // Cube Size
  const cubeSizeSlider = document.getElementById('cubeSize');
  const cubeSizeValue = document.getElementById('cubeSize-value');
  if (cubeSizeSlider) {
    cubeSizeSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (cubeSizeValue) cubeSizeValue.textContent = value.toFixed(1);
      sendParamChange('cubeSize', value);
    });
  }

  // Size Variation
  const sizeVariationSlider = document.getElementById('sizeVariation');
  const sizeVariationValue = document.getElementById('sizeVariation-value');
  if (sizeVariationSlider) {
    sizeVariationSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (sizeVariationValue) sizeVariationValue.textContent = value.toFixed(2);
      sendParamChange('sizeVariation', value);
    });
  }

  // Geometry Type
  const geometryTypeSelect = document.getElementById('geometryType');
  if (geometryTypeSelect) {
    geometryTypeSelect.addEventListener('change', (e) => {
      sendParamChange('geometryType', e.target.value);
    });
  }

  // Intersection Chaos
  const intersectionChaosSlider = document.getElementById('intersectionChaos');
  const intersectionChaosValue = document.getElementById('intersectionChaos-value');
  if (intersectionChaosSlider) {
    intersectionChaosSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (intersectionChaosValue) intersectionChaosValue.textContent = value.toFixed(2);
      sendParamChange('intersectionChaos', value);
    });
  }

  // Distribution Density
  const distributionDensitySlider = document.getElementById('distributionDensity');
  const distributionDensityValue = document.getElementById('distributionDensity-value');
  if (distributionDensitySlider) {
    distributionDensitySlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (distributionDensityValue) distributionDensityValue.textContent = value.toFixed(2);
      sendParamChange('distributionDensity', value);
    });
  }

  // Animation Rate
  const animationRateSlider = document.getElementById('animationRate');
  const animationRateValue = document.getElementById('animationRate-value');
  if (animationRateSlider) {
    animationRateSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (animationRateValue) animationRateValue.textContent = value.toFixed(1);
      sendParamChange('animationRate', value);
    });
  }

  // Stripe Width
  const stripeWidthSlider = document.getElementById('stripeWidth');
  const stripeWidthValue = document.getElementById('stripeWidth-value');
  if (stripeWidthSlider) {
    stripeWidthSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (stripeWidthValue) stripeWidthValue.textContent = value.toFixed(2);
      sendParamChange('stripeWidth', value);
    });
  }

  // Stripe Angle
  const stripeAngleSlider = document.getElementById('stripeAngle');
  const stripeAngleValue = document.getElementById('stripeAngle-value');
  if (stripeAngleSlider) {
    stripeAngleSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (stripeAngleValue) stripeAngleValue.textContent = value;
      sendParamChange('stripeAngle', value);
    });
  }

  // Color 1
  const color1Input = document.getElementById('color1');
  if (color1Input) {
    color1Input.addEventListener('input', (e) => {
      sendParamChange('color1', e.target.value);
    });
  }

  // Color 2
  const color2Input = document.getElementById('color2');
  if (color2Input) {
    color2Input.addEventListener('input', (e) => {
      sendParamChange('color2', e.target.value);
    });
  }

  // Rotation Sensitivity
  const rotationSensitivitySlider = document.getElementById('rotationSensitivity');
  const rotationSensitivityValue = document.getElementById('rotationSensitivity-value');
  if (rotationSensitivitySlider) {
    rotationSensitivitySlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (rotationSensitivityValue) rotationSensitivityValue.textContent = value.toFixed(1);
      sendParamChange('rotationSensitivity', value);
    });
  }

  // Orbit Sensitivity
  const orbitSensitivitySlider = document.getElementById('orbitSensitivity');
  const orbitSensitivityValue = document.getElementById('orbitSensitivity-value');
  if (orbitSensitivitySlider) {
    orbitSensitivitySlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (orbitSensitivityValue) orbitSensitivityValue.textContent = value.toFixed(1);
      sendParamChange('orbitSensitivity', value);
    });
  }

  // Scale Sensitivity
  const scaleSensitivitySlider = document.getElementById('scaleSensitivity');
  const scaleSensitivityValue = document.getElementById('scaleSensitivity-value');
  if (scaleSensitivitySlider) {
    scaleSensitivitySlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (scaleSensitivityValue) scaleSensitivityValue.textContent = value.toFixed(2);
      sendParamChange('scaleSensitivity', value);
    });
  }

  // Background Color
  const backgroundColorInput = document.getElementById('backgroundColor');
  if (backgroundColorInput) {
    backgroundColorInput.addEventListener('input', (e) => {
      sendParamChange('backgroundColor', e.target.value);
    });
  }

  // Randomize Button
  const randomizeBtn = document.getElementById('randomizeBtn');
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', () => {
      randomizeControls();
    });
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

  // Randomize cube count (1 to 64)
  const cubeCount = randIntRange(1, 64);
  const cubeCountEl = document.getElementById('cubeCount');
  const cubeCountValueEl = document.getElementById('cubeCount-value');
  if (cubeCountEl) cubeCountEl.value = cubeCount;
  if (cubeCountValueEl) cubeCountValueEl.textContent = cubeCount;
  cubeCountEl?.dispatchEvent(new Event('input'));

  // Randomize cube size (0.5 to 5.0)
  const cubeSize = randRange(0.5, 5.0, 0.1);
  const cubeSizeEl = document.getElementById('cubeSize');
  const cubeSizeValueEl = document.getElementById('cubeSize-value');
  if (cubeSizeEl) cubeSizeEl.value = cubeSize;
  if (cubeSizeValueEl) cubeSizeValueEl.textContent = cubeSize.toFixed(1);
  cubeSizeEl?.dispatchEvent(new Event('input'));

  // Randomize size variation (0 to 1)
  const sizeVariation = randRange(0, 1, 0.01);
  const sizeVariationEl = document.getElementById('sizeVariation');
  const sizeVariationValueEl = document.getElementById('sizeVariation-value');
  if (sizeVariationEl) sizeVariationEl.value = sizeVariation;
  if (sizeVariationValueEl) sizeVariationValueEl.textContent = sizeVariation.toFixed(2);
  sizeVariationEl?.dispatchEvent(new Event('input'));

  // Randomize geometry type
  const geometryTypes = ['cubes', 'spheres', 'mixed'];
  const geometryType = randChoice(geometryTypes);
  const geometryTypeEl = document.getElementById('geometryType');
  if (geometryTypeEl) {
    geometryTypeEl.value = geometryType;
    geometryTypeEl.dispatchEvent(new Event('change'));
  }

  // Randomize intersection chaos (0 to 1)
  const intersectionChaos = randRange(0, 1, 0.01);
  const intersectionChaosEl = document.getElementById('intersectionChaos');
  const intersectionChaosValueEl = document.getElementById('intersectionChaos-value');
  if (intersectionChaosEl) intersectionChaosEl.value = intersectionChaos;
  if (intersectionChaosValueEl) intersectionChaosValueEl.textContent = intersectionChaos.toFixed(2);
  intersectionChaosEl?.dispatchEvent(new Event('input'));

  // Randomize distribution density (0 to 1)
  const distributionDensity = randRange(0, 1, 0.01);
  const distributionDensityEl = document.getElementById('distributionDensity');
  const distributionDensityValueEl = document.getElementById('distributionDensity-value');
  if (distributionDensityEl) distributionDensityEl.value = distributionDensity;
  if (distributionDensityValueEl) distributionDensityValueEl.textContent = distributionDensity.toFixed(2);
  distributionDensityEl?.dispatchEvent(new Event('input'));

  // Randomize animation rate (0 to 3)
  const animationRate = randRange(0, 3, 0.1);
  const animationRateEl = document.getElementById('animationRate');
  const animationRateValueEl = document.getElementById('animationRate-value');
  if (animationRateEl) animationRateEl.value = animationRate;
  if (animationRateValueEl) animationRateValueEl.textContent = animationRate.toFixed(1);
  animationRateEl?.dispatchEvent(new Event('input'));

  // Randomize stripe width (0.01 to 1.0)
  const stripeWidth = randRange(0.01, 1.0, 0.01);
  const stripeWidthEl = document.getElementById('stripeWidth');
  const stripeWidthValueEl = document.getElementById('stripeWidth-value');
  if (stripeWidthEl) stripeWidthEl.value = stripeWidth;
  if (stripeWidthValueEl) stripeWidthValueEl.textContent = stripeWidth.toFixed(2);
  stripeWidthEl?.dispatchEvent(new Event('input'));

  // Randomize stripe angle (0 to 360)
  const stripeAngle = randIntRange(0, 360);
  const stripeAngleEl = document.getElementById('stripeAngle');
  const stripeAngleValueEl = document.getElementById('stripeAngle-value');
  if (stripeAngleEl) stripeAngleEl.value = stripeAngle;
  if (stripeAngleValueEl) stripeAngleValueEl.textContent = stripeAngle;
  stripeAngleEl?.dispatchEvent(new Event('input'));

  // Randomize colors using harmonious palette
  const color1El = document.getElementById('color1');
  if (color1El) {
    color1El.value = palette.c1;
    color1El.dispatchEvent(new Event('input'));
  }

  const color2El = document.getElementById('color2');
  if (color2El) {
    color2El.value = palette.c2;
    color2El.dispatchEvent(new Event('input'));
  }

  // Randomize rotation sensitivity (0 to 5)
  const rotationSensitivity = randRange(0, 5, 0.1);
  const rotationSensitivityEl = document.getElementById('rotationSensitivity');
  const rotationSensitivityValueEl = document.getElementById('rotationSensitivity-value');
  if (rotationSensitivityEl) rotationSensitivityEl.value = rotationSensitivity;
  if (rotationSensitivityValueEl) rotationSensitivityValueEl.textContent = rotationSensitivity.toFixed(1);
  rotationSensitivityEl?.dispatchEvent(new Event('input'));

  // Randomize orbit sensitivity (0 to 5)
  const orbitSensitivity = randRange(0, 5, 0.1);
  const orbitSensitivityEl = document.getElementById('orbitSensitivity');
  const orbitSensitivityValueEl = document.getElementById('orbitSensitivity-value');
  if (orbitSensitivityEl) orbitSensitivityEl.value = orbitSensitivity;
  if (orbitSensitivityValueEl) orbitSensitivityValueEl.textContent = orbitSensitivity.toFixed(1);
  orbitSensitivityEl?.dispatchEvent(new Event('input'));

  // Randomize scale sensitivity (0 to 1)
  const scaleSensitivity = randRange(0, 1, 0.01);
  const scaleSensitivityEl = document.getElementById('scaleSensitivity');
  const scaleSensitivityValueEl = document.getElementById('scaleSensitivity-value');
  if (scaleSensitivityEl) scaleSensitivityEl.value = scaleSensitivity;
  if (scaleSensitivityValueEl) scaleSensitivityValueEl.textContent = scaleSensitivity.toFixed(2);
  scaleSensitivityEl?.dispatchEvent(new Event('input'));

  // Randomize background color using palette
  const backgroundColorEl = document.getElementById('backgroundColor');
  if (backgroundColorEl) {
    backgroundColorEl.value = palette.c3;
    backgroundColorEl.dispatchEvent(new Event('input'));
  }
}

/**
 * Get all current parameter values
 */
function getAllParams() {
  return {
    cubeCount: parseInt(document.getElementById('cubeCount')?.value || '16'),
    cubeSize: parseFloat(document.getElementById('cubeSize')?.value || '2.5'),
    sizeVariation: parseFloat(document.getElementById('sizeVariation')?.value || '0.0'),
    geometryType: document.getElementById('geometryType')?.value || 'cubes',
    intersectionChaos: parseFloat(document.getElementById('intersectionChaos')?.value || '0.5'),
    distributionDensity: parseFloat(document.getElementById('distributionDensity')?.value || '0.5'),
    animationRate: parseFloat(document.getElementById('animationRate')?.value || '1.0'),
    stripeWidth: parseFloat(document.getElementById('stripeWidth')?.value || '0.2'),
    stripeAngle: parseInt(document.getElementById('stripeAngle')?.value || '0'),
    color1: document.getElementById('color1')?.value || '#000000',
    color2: document.getElementById('color2')?.value || '#ffffff',
    rotationSensitivity: parseFloat(document.getElementById('rotationSensitivity')?.value || '2.0'),
    orbitSensitivity: parseFloat(document.getElementById('orbitSensitivity')?.value || '1.5'),
    scaleSensitivity: parseFloat(document.getElementById('scaleSensitivity')?.value || '0.3'),
    backgroundColor: document.getElementById('backgroundColor')?.value || '#000000'
  };
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  if (params.cubeCount !== undefined) {
    const el = document.getElementById('cubeCount');
    const valEl = document.getElementById('cubeCount-value');
    if (el) el.value = params.cubeCount;
    if (valEl) valEl.textContent = params.cubeCount;
    el?.dispatchEvent(new Event('input'));
  }
  if (params.cubeSize !== undefined) {
    const el = document.getElementById('cubeSize');
    const valEl = document.getElementById('cubeSize-value');
    if (el) el.value = params.cubeSize;
    if (valEl) valEl.textContent = params.cubeSize.toFixed(1);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.sizeVariation !== undefined) {
    const el = document.getElementById('sizeVariation');
    const valEl = document.getElementById('sizeVariation-value');
    if (el) el.value = params.sizeVariation;
    if (valEl) valEl.textContent = params.sizeVariation.toFixed(2);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.geometryType !== undefined) {
    const el = document.getElementById('geometryType');
    if (el) {
      el.value = params.geometryType;
      el.dispatchEvent(new Event('change'));
    }
  }
  if (params.intersectionChaos !== undefined) {
    const el = document.getElementById('intersectionChaos');
    const valEl = document.getElementById('intersectionChaos-value');
    if (el) el.value = params.intersectionChaos;
    if (valEl) valEl.textContent = params.intersectionChaos.toFixed(2);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.distributionDensity !== undefined) {
    const el = document.getElementById('distributionDensity');
    const valEl = document.getElementById('distributionDensity-value');
    if (el) el.value = params.distributionDensity;
    if (valEl) valEl.textContent = params.distributionDensity.toFixed(2);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.animationRate !== undefined) {
    const el = document.getElementById('animationRate');
    const valEl = document.getElementById('animationRate-value');
    if (el) el.value = params.animationRate;
    if (valEl) valEl.textContent = params.animationRate.toFixed(1);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.stripeWidth !== undefined) {
    const el = document.getElementById('stripeWidth');
    const valEl = document.getElementById('stripeWidth-value');
    if (el) el.value = params.stripeWidth;
    if (valEl) valEl.textContent = params.stripeWidth.toFixed(2);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.stripeAngle !== undefined) {
    const el = document.getElementById('stripeAngle');
    const valEl = document.getElementById('stripeAngle-value');
    if (el) el.value = params.stripeAngle;
    if (valEl) valEl.textContent = params.stripeAngle;
    el?.dispatchEvent(new Event('input'));
  }
  if (params.color1 !== undefined) {
    const el = document.getElementById('color1');
    if (el) {
      el.value = params.color1;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.color2 !== undefined) {
    const el = document.getElementById('color2');
    if (el) {
      el.value = params.color2;
      el.dispatchEvent(new Event('input'));
    }
  }
  if (params.rotationSensitivity !== undefined) {
    const el = document.getElementById('rotationSensitivity');
    const valEl = document.getElementById('rotationSensitivity-value');
    if (el) el.value = params.rotationSensitivity;
    if (valEl) valEl.textContent = params.rotationSensitivity.toFixed(1);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.orbitSensitivity !== undefined) {
    const el = document.getElementById('orbitSensitivity');
    const valEl = document.getElementById('orbitSensitivity-value');
    if (el) el.value = params.orbitSensitivity;
    if (valEl) valEl.textContent = params.orbitSensitivity.toFixed(1);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.scaleSensitivity !== undefined) {
    const el = document.getElementById('scaleSensitivity');
    const valEl = document.getElementById('scaleSensitivity-value');
    if (el) el.value = params.scaleSensitivity;
    if (valEl) valEl.textContent = params.scaleSensitivity.toFixed(2);
    el?.dispatchEvent(new Event('input'));
  }
  if (params.backgroundColor !== undefined) {
    const el = document.getElementById('backgroundColor');
    if (el) {
      el.value = params.backgroundColor;
      el.dispatchEvent(new Event('input'));
    }
  }
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

// Initialize on load
function bootControls() {
  init().catch((e) => console.error('controls init failed', e));
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootControls);
} else {
  bootControls();
}

