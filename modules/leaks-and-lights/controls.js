/**
 * Leaks and Lights Controls
 * UI for controlling the leaks-and-lights visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'leaks-and-lights';

/** Emitter quadrant state (module scope — favorites + applyParams must see these). */
let currentEmitterJitter = 0.5;
let currentEmitterCurl = 0.5;

function updateQuadrantIndicator() {
  const quadrantIndicator = document.getElementById('quadrant-indicator');
  if (!quadrantIndicator) return;
  const x = currentEmitterJitter * 100;
  const y = (1 - currentEmitterCurl) * 100;
  quadrantIndicator.style.left = x + '%';
  quadrantIndicator.style.top = y + '%';
}

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
 * Set slider value and update display
 */
function setSliderValue(id, value) {
  const input = document.getElementById(id);
  if (!input) return;
  input.value = value;
  const valueEl = document.getElementById(id.replace('ctrl-', '') + '-value');
  if (valueEl) {
    const step = parseFloat(input.step || "1");
    let decimals = 0;
    if (step < 1 && step >= 0.1) decimals = 1;
    else if (step < 0.1) decimals = 2;
    valueEl.textContent = Number(value).toFixed(decimals);
  }
}

/**
 * Set up control inputs
 */
function setupControls() {
  // GLOBAL
  const masterIntensityInput = document.getElementById('ctrl-masterIntensity');
  if (masterIntensityInput) {
    masterIntensityInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-masterIntensity', val);
      sendParamChange('masterIntensity', val);
    });
  }

  const audioSensitivityInput = document.getElementById('ctrl-audioSensitivity');
  if (audioSensitivityInput) {
    audioSensitivityInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-audioSensitivity', val);
      sendParamChange('audioSensitivity', val);
    });
  }

  const trailFadeInput = document.getElementById('ctrl-trailFade');
  if (trailFadeInput) {
    trailFadeInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-trailFade', val);
      sendParamChange('trailFade', val);
    });
  }

  const backgroundColorInput = document.getElementById('ctrl-backgroundColor');
  if (backgroundColorInput) {
    backgroundColorInput.addEventListener('input', (e) => {
      sendParamChange('backgroundColor', e.target.value);
    });
  }

  // LEAKS
  const leakEnabledInput = document.getElementById('ctrl-leakEnabled');
  if (leakEnabledInput) {
    leakEnabledInput.addEventListener('change', (e) => {
      sendParamChange('leakEnabled', e.target.checked);
      updateGroupVisibility();
    });
  }

  const leakCountInput = document.getElementById('ctrl-leakCount');
  if (leakCountInput) {
    leakCountInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      setSliderValue('ctrl-leakCount', val);
      sendParamChange('leakCount', val);
    });
  }

  const leakEdgeBiasInput = document.getElementById('ctrl-leakEdgeBias');
  if (leakEdgeBiasInput) {
    leakEdgeBiasInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-leakEdgeBias', val);
      sendParamChange('leakEdgeBias', val);
    });
  }

  const leakBaseRadiusInput = document.getElementById('ctrl-leakBaseRadius');
  if (leakBaseRadiusInput) {
    leakBaseRadiusInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-leakBaseRadius', val);
      sendParamChange('leakBaseRadius', val);
    });
  }

  const leakNoiseSpeedInput = document.getElementById('ctrl-leakNoiseSpeed');
  if (leakNoiseSpeedInput) {
    leakNoiseSpeedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-leakNoiseSpeed', val);
      sendParamChange('leakNoiseSpeed', val);
    });
  }

  const leakBaseIntensityInput = document.getElementById('ctrl-leakBaseIntensity');
  if (leakBaseIntensityInput) {
    leakBaseIntensityInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-leakBaseIntensity', val);
      sendParamChange('leakBaseIntensity', val);
    });
  }

  const leakAudioBreathInput = document.getElementById('ctrl-leakAudioBreath');
  if (leakAudioBreathInput) {
    leakAudioBreathInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-leakAudioBreath', val);
      sendParamChange('leakAudioBreath', val);
    });
  }

  const leakPaletteSelect = document.getElementById('ctrl-leakPaletteMode');
  if (leakPaletteSelect) {
    leakPaletteSelect.addEventListener('change', (e) => {
      sendParamChange('leakPaletteMode', e.target.value);
      updateColorPickerVisibility();
      updateGroupVisibility();
    });
  }

  const leakBlendSelect = document.getElementById('ctrl-leakBlendMode');
  if (leakBlendSelect) {
    leakBlendSelect.addEventListener('change', (e) => {
      sendParamChange('leakBlendMode', e.target.value);
    });
  }

  const leakColor1Input = document.getElementById('ctrl-leakColor1');
  if (leakColor1Input) {
    leakColor1Input.addEventListener('input', (e) => {
      sendParamChange('leakColor1', e.target.value);
    });
  }

  const leakColor2Input = document.getElementById('ctrl-leakColor2');
  if (leakColor2Input) {
    leakColor2Input.addEventListener('input', (e) => {
      sendParamChange('leakColor2', e.target.value);
    });
  }

  const leakColor3Input = document.getElementById('ctrl-leakColor3');
  if (leakColor3Input) {
    leakColor3Input.addEventListener('input', (e) => {
      sendParamChange('leakColor3', e.target.value);
    });
  }

  // BURSTS
  const burstEnabledInput = document.getElementById('ctrl-burstEnabled');
  if (burstEnabledInput) {
    burstEnabledInput.addEventListener('change', (e) => {
      sendParamChange('burstEnabled', e.target.checked);
      updateGroupVisibility();
    });
  }

  const burstBaseRateInput = document.getElementById('ctrl-burstBaseRate');
  if (burstBaseRateInput) {
    burstBaseRateInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-burstBaseRate', val);
      sendParamChange('burstBaseRate', val);
    });
  }

  const burstPeakThresholdInput = document.getElementById('ctrl-burstPeakThreshold');
  if (burstPeakThresholdInput) {
    burstPeakThresholdInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-burstPeakThreshold', val);
      sendParamChange('burstPeakThreshold', val);
    });
  }

  const burstMinParticlesInput = document.getElementById('ctrl-burstMinParticles');
  if (burstMinParticlesInput) {
    burstMinParticlesInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      setSliderValue('ctrl-burstMinParticles', val);
      sendParamChange('burstMinParticles', val);
    });
  }

  const burstMaxParticlesInput = document.getElementById('ctrl-burstMaxParticles');
  if (burstMaxParticlesInput) {
    burstMaxParticlesInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      setSliderValue('ctrl-burstMaxParticles', val);
      sendParamChange('burstMaxParticles', val);
    });
  }

  // Quadrant Control for Emitter Style
  const quadrantControl = document.getElementById('ctrl-emitterQuadrant');

  function handleQuadrantMove(e) {
    if (!quadrantControl) return;
    const rect = quadrantControl.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    currentEmitterJitter = x;
    currentEmitterCurl = 1 - y;

    sendParamChange('emitterJitter', currentEmitterJitter);
    sendParamChange('emitterCurl', currentEmitterCurl);

    const lightningJitter = x * 1.5;
    sendParamChange('lightningJitter', lightningJitter);
    setSliderValue('ctrl-lightningJitter', lightningJitter);

    const lightningTwistAmount = currentEmitterCurl * 3;
    sendParamChange('lightningTwistAmount', lightningTwistAmount);
    setSliderValue('ctrl-lightningTwistAmount', lightningTwistAmount);

    updateQuadrantIndicator();
  }

  if (quadrantControl) {
    // Mouse events
    quadrantControl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      handleQuadrantMove(e);
      const moveHandler = (e) => {
        handleQuadrantMove(e);
      };
      const upHandler = () => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
      };
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
    });

    // Touch events
    let touchMoveHandler = null;
    let touchEndHandler = null;

    quadrantControl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleQuadrantMove({ clientX: touch.clientX, clientY: touch.clientY });

      touchMoveHandler = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleQuadrantMove({ clientX: touch.clientX, clientY: touch.clientY });
      };

      touchEndHandler = () => {
        document.removeEventListener('touchmove', touchMoveHandler);
        document.removeEventListener('touchend', touchEndHandler);
        touchMoveHandler = null;
        touchEndHandler = null;
      };

      document.addEventListener('touchmove', touchMoveHandler);
      document.addEventListener('touchend', touchEndHandler);
    });

    // Initialize indicator position
    updateQuadrantIndicator();
  }

  // PARTICLES
  const particleBaseSpeedInput = document.getElementById('ctrl-particleBaseSpeed');
  if (particleBaseSpeedInput) {
    particleBaseSpeedInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-particleBaseSpeed', val);
      sendParamChange('particleBaseSpeed', val);
    });
  }

  const particleSpeedAudioBoostInput = document.getElementById('ctrl-particleSpeedAudioBoost');
  if (particleSpeedAudioBoostInput) {
    particleSpeedAudioBoostInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-particleSpeedAudioBoost', val);
      sendParamChange('particleSpeedAudioBoost', val);
    });
  }

  const particleLifetimeMinInput = document.getElementById('ctrl-particleLifetimeMin');
  if (particleLifetimeMinInput) {
    particleLifetimeMinInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-particleLifetimeMin', val);
      sendParamChange('particleLifetimeMin', val);
    });
  }

  const particleLifetimeMaxInput = document.getElementById('ctrl-particleLifetimeMax');
  if (particleLifetimeMaxInput) {
    particleLifetimeMaxInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-particleLifetimeMax', val);
      sendParamChange('particleLifetimeMax', val);
    });
  }

  const particleSizeMinInput = document.getElementById('ctrl-particleSizeMin');
  if (particleSizeMinInput) {
    particleSizeMinInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-particleSizeMin', val);
      sendParamChange('particleSizeMin', val);
    });
  }

  const particleSizeMaxInput = document.getElementById('ctrl-particleSizeMax');
  if (particleSizeMaxInput) {
    particleSizeMaxInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-particleSizeMax', val);
      sendParamChange('particleSizeMax', val);
    });
  }

  const particleDirectionSpreadInput = document.getElementById('ctrl-particleDirectionSpread');
  if (particleDirectionSpreadInput) {
    particleDirectionSpreadInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-particleDirectionSpread', val);
      sendParamChange('particleDirectionSpread', val);
    });
  }

  const particleTrailLengthInput = document.getElementById('ctrl-particleTrailLength');
  if (particleTrailLengthInput) {
    particleTrailLengthInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      setSliderValue('ctrl-particleTrailLength', val);
      sendParamChange('particleTrailLength', val);
    });
  }

  const particleDivergenceInput = document.getElementById('ctrl-particleDivergence');
  if (particleDivergenceInput) {
    particleDivergenceInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-particleDivergence', val);
      sendParamChange('particleDivergence', val);
    });
  }

  const lightningBranchingInput = document.getElementById('ctrl-lightningBranching');
  if (lightningBranchingInput) {
    lightningBranchingInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-lightningBranching', val);
      sendParamChange('lightningBranching', val);
    });
  }

  const lightningJitterInput = document.getElementById('ctrl-lightningJitter');
  if (lightningJitterInput) {
    lightningJitterInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-lightningJitter', val);
      sendParamChange('lightningJitter', val);
      currentEmitterJitter = val / 1.5;
      sendParamChange('emitterJitter', currentEmitterJitter);
      updateQuadrantIndicator();
    });
  }

  const lightningTwistAmountInput = document.getElementById('ctrl-lightningTwistAmount');
  if (lightningTwistAmountInput) {
    lightningTwistAmountInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-lightningTwistAmount', val);
      sendParamChange('lightningTwistAmount', val);
      currentEmitterCurl = val / 3;
      sendParamChange('emitterCurl', currentEmitterCurl);
      updateQuadrantIndicator();
    });
  }

  const particleColorModeSelect = document.getElementById('ctrl-particleColorMode');
  if (particleColorModeSelect) {
    particleColorModeSelect.addEventListener('change', (e) => {
      sendParamChange('particleColorMode', e.target.value);
    });
  }

  const particleAudioColorBoostInput = document.getElementById('ctrl-particleAudioColorBoost');
  if (particleAudioColorBoostInput) {
    particleAudioColorBoostInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-particleAudioColorBoost', val);
      sendParamChange('particleAudioColorBoost', val);
    });
  }

  const particleOpacityVariabilityInput = document.getElementById('ctrl-particleOpacityVariability');
  if (particleOpacityVariabilityInput) {
    particleOpacityVariabilityInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-particleOpacityVariability', val);
      sendParamChange('particleOpacityVariability', val);
    });
  }

  // CAMERA
  const cameraEnabledInput = document.getElementById('ctrl-cameraEnabled');
  if (cameraEnabledInput) {
    cameraEnabledInput.addEventListener('change', (e) => {
      sendParamChange('cameraEnabled', e.target.checked);
      updateGroupVisibility();
    });
  }

  const cameraOpacityInput = document.getElementById('ctrl-cameraOpacity');
  if (cameraOpacityInput) {
    cameraOpacityInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setSliderValue('ctrl-cameraOpacity', val);
      sendParamChange('cameraOpacity', val);
    });
  }

  const cameraBlendSelect = document.getElementById('ctrl-cameraBlendMode');
  if (cameraBlendSelect) {
    cameraBlendSelect.addEventListener('change', (e) => {
      sendParamChange('cameraBlendMode', e.target.value);
    });
  }

  // PERFORMANCE
  const maxParticlesInput = document.getElementById('ctrl-maxParticles');
  if (maxParticlesInput) {
    maxParticlesInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      setSliderValue('ctrl-maxParticles', val);
      sendParamChange('maxParticles', val);
    });
  }

  // Randomize button
  const randomizeBtn = document.getElementById('randomizeBtn');
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', randomizeControls);
  }

  // Initialize visibility
  updateColorPickerVisibility();
  updateGroupVisibility();
}

/**
 * Update color picker visibility based on palette mode
 */
function updateColorPickerVisibility() {
  const leakPaletteSelect = document.getElementById('ctrl-leakPaletteMode');
  const isCustom = leakPaletteSelect && leakPaletteSelect.value === 'custom';
  const customColorRows = document.querySelectorAll('.leak-custom-colors');
  customColorRows.forEach(row => {
    if (isCustom) {
      row.classList.add('visible');
    } else {
      row.classList.remove('visible');
    }
  });
}

/**
 * Update group visibility based on enabled states
 */
function updateGroupVisibility() {
  const leaksContent = document.getElementById('leaks-content');
  const leakEnabledInput = document.getElementById('ctrl-leakEnabled');
  if (leaksContent && leakEnabledInput) {
    if (leakEnabledInput.checked) {
      leaksContent.classList.remove('hidden');
    } else {
      leaksContent.classList.add('hidden');
    }
  }

  const burstsContent = document.getElementById('bursts-content');
  const burstEnabledInput = document.getElementById('ctrl-burstEnabled');
  if (burstsContent && burstEnabledInput) {
    if (burstEnabledInput.checked) {
      burstsContent.classList.remove('hidden');
    } else {
      burstsContent.classList.add('hidden');
    }
  }

  const cameraContent = document.getElementById('camera-content');
  const cameraEnabledInput = document.getElementById('ctrl-cameraEnabled');
  if (cameraContent && cameraEnabledInput) {
    if (cameraEnabledInput.checked) {
      cameraContent.classList.remove('hidden');
    } else {
      cameraContent.classList.add('hidden');
    }
  }
}

/**
 * Randomize all controls
 */
function randomizeControls() {
  function randRange(min, max, step = 0.01) {
    const nSteps = Math.floor((max - min) / step);
    return min + step * Math.floor(Math.random() * (nSteps + 1));
  }

  function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Randomize all values
  const masterIntensity = randRange(0.5, 2.0, 0.01);
  setSliderValue('ctrl-masterIntensity', masterIntensity);
  sendParamChange('masterIntensity', masterIntensity);

  const audioSensitivity = randRange(0.5, 3.0, 0.01);
  setSliderValue('ctrl-audioSensitivity', audioSensitivity);
  sendParamChange('audioSensitivity', audioSensitivity);

  const trailFade = randRange(0.05, 0.4, 0.01);
  setSliderValue('ctrl-trailFade', trailFade);
  sendParamChange('trailFade', trailFade);

  // Random background color
  const bgHue = Math.floor(Math.random() * 360);
  const bgSat = Math.floor(20 + Math.random() * 30);
  const bgLight = Math.floor(5 + Math.random() * 15);
  const bgColor = `hsl(${bgHue}, ${bgSat}%, ${bgLight}%)`;
  document.getElementById('ctrl-backgroundColor').value = bgColor;
  sendParamChange('backgroundColor', bgColor);

  // Leaks
  const leakEnabled = Math.random() > 0.3;
  document.getElementById('ctrl-leakEnabled').checked = leakEnabled;
  sendParamChange('leakEnabled', leakEnabled);

  const leakCount = 1 + Math.floor(Math.random() * 19);
  setSliderValue('ctrl-leakCount', leakCount);
  sendParamChange('leakCount', leakCount);

  const leakEdgeBias = randRange(0, 1, 0.01);
  setSliderValue('ctrl-leakEdgeBias', leakEdgeBias);
  sendParamChange('leakEdgeBias', leakEdgeBias);

  const leakBaseRadius = 50 + Math.floor(Math.random() * 550);
  setSliderValue('ctrl-leakBaseRadius', leakBaseRadius);
  sendParamChange('leakBaseRadius', leakBaseRadius);

  const leakNoiseSpeed = randRange(0, 2, 0.01);
  setSliderValue('ctrl-leakNoiseSpeed', leakNoiseSpeed);
  sendParamChange('leakNoiseSpeed', leakNoiseSpeed);

  const leakBaseIntensity = randRange(0.1, 1, 0.01);
  setSliderValue('ctrl-leakBaseIntensity', leakBaseIntensity);
  sendParamChange('leakBaseIntensity', leakBaseIntensity);

  const leakAudioBreath = randRange(0, 1, 0.01);
  setSliderValue('ctrl-leakAudioBreath', leakAudioBreath);
  sendParamChange('leakAudioBreath', leakAudioBreath);

  const leakPalettes = ['cool', 'warm', 'neon', 'sunset', 'ocean', 'forest', 'fire', 'ice', 'purple', 'gold', 'custom'];
  const leakPalette = randChoice(leakPalettes);
  document.getElementById('ctrl-leakPaletteMode').value = leakPalette;
  sendParamChange('leakPaletteMode', leakPalette);

  const blendModes = ['lighter', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'difference', 'exclusion', 'multiply', 'normal'];
  const leakBlend = randChoice(blendModes);
  document.getElementById('ctrl-leakBlendMode').value = leakBlend;
  sendParamChange('leakBlendMode', leakBlend);

  const leakColor1 = `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`;
  document.getElementById('ctrl-leakColor1').value = leakColor1;
  sendParamChange('leakColor1', leakColor1);

  const leakColor2 = `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`;
  document.getElementById('ctrl-leakColor2').value = leakColor2;
  sendParamChange('leakColor2', leakColor2);

  const leakColor3 = `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`;
  document.getElementById('ctrl-leakColor3').value = leakColor3;
  sendParamChange('leakColor3', leakColor3);

  // Bursts
  const burstEnabled = Math.random() > 0.3;
  document.getElementById('ctrl-burstEnabled').checked = burstEnabled;
  sendParamChange('burstEnabled', burstEnabled);

  const burstBaseRate = randRange(0, 15, 0.05);
  setSliderValue('ctrl-burstBaseRate', burstBaseRate);
  sendParamChange('burstBaseRate', burstBaseRate);

  const burstPeakThreshold = randRange(0, 1, 0.01);
  setSliderValue('ctrl-burstPeakThreshold', burstPeakThreshold);
  sendParamChange('burstPeakThreshold', burstPeakThreshold);

  const burstMinParticles = 1 + Math.floor(Math.random() * 49);
  setSliderValue('ctrl-burstMinParticles', burstMinParticles);
  sendParamChange('burstMinParticles', burstMinParticles);

  const burstMaxParticles = 10 + Math.floor(Math.random() * 290);
  setSliderValue('ctrl-burstMaxParticles', burstMaxParticles);
  sendParamChange('burstMaxParticles', burstMaxParticles);

  const emitterJitter = randRange(0, 1, 0.01);
  sendParamChange('emitterJitter', emitterJitter);

  const emitterCurl = randRange(0, 1, 0.01);
  sendParamChange('emitterCurl', emitterCurl);

  // Particles
  const particleBaseSpeed = 50 + Math.floor(Math.random() * 950);
  setSliderValue('ctrl-particleBaseSpeed', particleBaseSpeed);
  sendParamChange('particleBaseSpeed', particleBaseSpeed);

  const particleSpeedAudioBoost = randRange(0, 2, 0.01);
  setSliderValue('ctrl-particleSpeedAudioBoost', particleSpeedAudioBoost);
  sendParamChange('particleSpeedAudioBoost', particleSpeedAudioBoost);

  const particleLifetimeMin = randRange(0.2, 9, 0.05);
  setSliderValue('ctrl-particleLifetimeMin', particleLifetimeMin);
  sendParamChange('particleLifetimeMin', particleLifetimeMin);

  const particleLifetimeMax = randRange(0.5, 15, 0.05);
  setSliderValue('ctrl-particleLifetimeMax', particleLifetimeMax);
  sendParamChange('particleLifetimeMax', particleLifetimeMax);

  const particleSizeMin = randRange(0.1, 30, 0.1);
  setSliderValue('ctrl-particleSizeMin', particleSizeMin);
  sendParamChange('particleSizeMin', particleSizeMin);

  const particleSizeMax = randRange(0.2, 80, 0.1);
  setSliderValue('ctrl-particleSizeMax', particleSizeMax);
  sendParamChange('particleSizeMax', particleSizeMax);

  const particleDirectionSpread = Math.floor(Math.random() * 361);
  setSliderValue('ctrl-particleDirectionSpread', particleDirectionSpread);
  sendParamChange('particleDirectionSpread', particleDirectionSpread);

  const particleTrailLength = 5 + Math.floor(Math.random() * 195);
  setSliderValue('ctrl-particleTrailLength', particleTrailLength);
  sendParamChange('particleTrailLength', particleTrailLength);

  const particleDivergence = randRange(0, 2, 0.01);
  setSliderValue('ctrl-particleDivergence', particleDivergence);
  sendParamChange('particleDivergence', particleDivergence);

  const lightningBranching = randRange(0, 1, 0.01);
  setSliderValue('ctrl-lightningBranching', lightningBranching);
  sendParamChange('lightningBranching', lightningBranching);

  const lightningJitter = randRange(0, 1.5, 0.01);
  setSliderValue('ctrl-lightningJitter', lightningJitter);
  sendParamChange('lightningJitter', lightningJitter);

  const lightningTwistAmount = randRange(0, 3, 0.01);
  setSliderValue('ctrl-lightningTwistAmount', lightningTwistAmount);
  sendParamChange('lightningTwistAmount', lightningTwistAmount);

  const particleColorModes = ['palette', 'randomHue', 'ampMapped'];
  const particleColorMode = randChoice(particleColorModes);
  document.getElementById('ctrl-particleColorMode').value = particleColorMode;
  sendParamChange('particleColorMode', particleColorMode);

  const particleAudioColorBoost = randRange(0, 1, 0.01);
  setSliderValue('ctrl-particleAudioColorBoost', particleAudioColorBoost);
  sendParamChange('particleAudioColorBoost', particleAudioColorBoost);

  const particleOpacityVariability = randRange(0, 1, 0.01);
  setSliderValue('ctrl-particleOpacityVariability', particleOpacityVariability);
  sendParamChange('particleOpacityVariability', particleOpacityVariability);

  // Performance
  const maxParticles = 200 + Math.floor(Math.random() * 2800 / 50) * 50;
  setSliderValue('ctrl-maxParticles', maxParticles);
  sendParamChange('maxParticles', maxParticles);

  // Camera
  const cameraEnabled = Math.random() > 0.7;
  document.getElementById('ctrl-cameraEnabled').checked = cameraEnabled;
  sendParamChange('cameraEnabled', cameraEnabled);

  const cameraOpacity = randRange(0.3, 1, 0.01);
  setSliderValue('ctrl-cameraOpacity', cameraOpacity);
  sendParamChange('cameraOpacity', cameraOpacity);

  const cameraBlendModes = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'difference', 'exclusion', 'lighter'];
  const cameraBlend = randChoice(cameraBlendModes);
  document.getElementById('ctrl-cameraBlendMode').value = cameraBlend;
  sendParamChange('cameraBlendMode', cameraBlend);

  updateColorPickerVisibility();
  updateGroupVisibility();
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  Object.keys(params).forEach(key => {
    const el = document.getElementById(`ctrl-${key}`);
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

  // Update quadrant indicator if emitter values are in params
  if (params.emitterJitter !== undefined) {
    currentEmitterJitter = params.emitterJitter;
  }
  if (params.emitterCurl !== undefined) {
    currentEmitterCurl = params.emitterCurl;
  }
  updateQuadrantIndicator();

  updateColorPickerVisibility();
  updateGroupVisibility();
}

/**
 * Get all current parameters
 */
function getAllParams() {
  return {
    masterIntensity: parseFloat(document.getElementById('ctrl-masterIntensity')?.value || 1.0),
    audioSensitivity: parseFloat(document.getElementById('ctrl-audioSensitivity')?.value || 1.2),
    trailFade: parseFloat(document.getElementById('ctrl-trailFade')?.value || 0.12),
    backgroundColor: document.getElementById('ctrl-backgroundColor')?.value || '#000000',
    leakEnabled: document.getElementById('ctrl-leakEnabled')?.checked || true,
    leakCount: parseInt(document.getElementById('ctrl-leakCount')?.value || 7, 10),
    leakEdgeBias: parseFloat(document.getElementById('ctrl-leakEdgeBias')?.value || 0.8),
    leakBaseRadius: parseFloat(document.getElementById('ctrl-leakBaseRadius')?.value || 260),
    leakNoiseSpeed: parseFloat(document.getElementById('ctrl-leakNoiseSpeed')?.value || 0.18),
    leakBaseIntensity: parseFloat(document.getElementById('ctrl-leakBaseIntensity')?.value || 0.35),
    leakAudioBreath: parseFloat(document.getElementById('ctrl-leakAudioBreath')?.value || 0.4),
    leakPaletteMode: document.getElementById('ctrl-leakPaletteMode')?.value || 'cool',
    leakBlendMode: document.getElementById('ctrl-leakBlendMode')?.value || 'lighter',
    leakColor1: document.getElementById('ctrl-leakColor1')?.value || '#00aaff',
    leakColor2: document.getElementById('ctrl-leakColor2')?.value || '#ff00aa',
    leakColor3: document.getElementById('ctrl-leakColor3')?.value || '#aaff00',
    burstEnabled: document.getElementById('ctrl-burstEnabled')?.checked || true,
    burstBaseRate: parseFloat(document.getElementById('ctrl-burstBaseRate')?.value || 3.5),
    burstPeakThreshold: parseFloat(document.getElementById('ctrl-burstPeakThreshold')?.value || 0.65),
    burstMinParticles: parseInt(document.getElementById('ctrl-burstMinParticles')?.value || 8, 10),
    burstMaxParticles: parseInt(document.getElementById('ctrl-burstMaxParticles')?.value || 90, 10),
    emitterJitter: currentEmitterJitter,
    emitterCurl: currentEmitterCurl,
    particleBaseSpeed: parseFloat(document.getElementById('ctrl-particleBaseSpeed')?.value || 260),
    particleSpeedAudioBoost: parseFloat(document.getElementById('ctrl-particleSpeedAudioBoost')?.value || 0.9),
    particleLifetimeMin: parseFloat(document.getElementById('ctrl-particleLifetimeMin')?.value || 1.8),
    particleLifetimeMax: parseFloat(document.getElementById('ctrl-particleLifetimeMax')?.value || 5.4),
    particleSizeMin: parseFloat(document.getElementById('ctrl-particleSizeMin')?.value || 0.3),
    particleSizeMax: parseFloat(document.getElementById('ctrl-particleSizeMax')?.value || 3),
    particleDirectionSpread: parseFloat(document.getElementById('ctrl-particleDirectionSpread')?.value || 360),
    particleTrailLength: parseInt(document.getElementById('ctrl-particleTrailLength')?.value || 150, 10),
    particleDivergence: parseFloat(document.getElementById('ctrl-particleDivergence')?.value || 0.5),
    lightningBranching: parseFloat(document.getElementById('ctrl-lightningBranching')?.value || 0.3),
    lightningJitter: parseFloat(document.getElementById('ctrl-lightningJitter')?.value || 0.45),
    lightningTwistAmount: parseFloat(document.getElementById('ctrl-lightningTwistAmount')?.value || 1.2),
    particleColorMode: document.getElementById('ctrl-particleColorMode')?.value || 'palette',
    particleAudioColorBoost: parseFloat(document.getElementById('ctrl-particleAudioColorBoost')?.value || 0.6),
    particleOpacityVariability: parseFloat(document.getElementById('ctrl-particleOpacityVariability')?.value || 0.3),
    maxParticles: parseInt(document.getElementById('ctrl-maxParticles')?.value || 1300, 10),
    cameraEnabled: document.getElementById('ctrl-cameraEnabled')?.checked || false,
    cameraOpacity: parseFloat(document.getElementById('ctrl-cameraOpacity')?.value || 0.7),
    cameraBlendMode: document.getElementById('ctrl-cameraBlendMode')?.value || 'normal'
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


