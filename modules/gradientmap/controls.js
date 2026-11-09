import { Favorites } from '../../shared/favorites.js';

const MODULE_ID = 'gradientmap';

let controlsChannel = null;
let webcamActive = false;
let suppressParamSend = false;

async function init() {
  controlsChannel = new BroadcastChannel('visualizer-controls');
  controlsChannel.onmessage = handleModuleMessage;

  setupControls();

  const favorites = new Favorites({
    moduleId: MODULE_ID,
    getAllParams,
    applyParams,
    saveButtonId: 'saveFavoriteBtn',
  });
  await favorites.init();

  updateColorInputsState();
  updateWebcamState(false);
}

function handleModuleMessage(event) {
  if (!event?.data || event.data.type !== 'PARAM_UPDATES') {
    return;
  }

  const updates = event.data.updates || {};

  if (typeof updates.webcamActive === 'boolean') {
    updateWebcamState(updates.webcamActive);
  }

  if (updates.error === 'webcam') {
    setWebcamError(updates.message || 'Unable to access webcam.');
  } else if (!updates.error) {
    setWebcamError('');
  }

  const syncKeys = [
    'colorTheme',
    'gradientColor1',
    'gradientColor2',
    'gradientColor3',
    'transitionDuration',
    'autoSequence',
    'autoSequenceInterval'
  ];
  const incomingParams = {};
  syncKeys.forEach((key) => {
    if (updates[key] !== undefined) {
      incomingParams[key] = updates[key];
    }
  });

  if (Object.keys(incomingParams).length > 0) {
    suppressParamSend = true;
    applyParams(incomingParams);
    suppressParamSend = false;
  }
}

function setupControls() {
  const startBtn = document.getElementById('startWebcam');
  const stopBtn = document.getElementById('stopWebcam');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      sendParamChange('webcamCommand', 'start');
      startBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
      setWebcamError('');
      setWebcamStatusText('Starting camera…');
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      sendParamChange('webcamCommand', 'stop');
      stopBtn.disabled = true;
      if (startBtn) startBtn.disabled = false;
      setWebcamStatusText('Camera idle');
    });
  }

  setupSlider('audioSensitivity', 'audioSensitivityValue', (value) => {
    sendParamChange('audioSensitivity', parseFloat(value));
  });
  setupSlider('globalIntensity', 'globalIntensityValue', (value) => {
    sendParamChange('globalIntensity', parseFloat(value));
  });
  setupSlider('globalBrightness', 'globalBrightnessValue', (value) => {
    sendParamChange('globalBrightness', parseFloat(value));
  });
  setupSlider('globalContrast', 'globalContrastValue', (value) => {
    sendParamChange('globalContrast', parseFloat(value));
  });
  setupSlider('globalBlend', 'globalBlendValue', (value) => {
    sendParamChange('globalBlend', parseFloat(value));
  });
  setupSlider('globalBlur', 'globalBlurValue', (value) => {
    sendParamChange('globalBlur', parseFloat(value));
  }, (val) => parseFloat(val).toFixed(1));

  setupSlider('gradientContrast', 'gradientContrastValue', (value) => {
    sendParamChange('gradientContrast', parseFloat(value));
  });
  setupSlider('gradientBrightness', 'gradientBrightnessValue', (value) => {
    sendParamChange('gradientBrightness', parseFloat(value));
  });
  setupSlider('gradientBlend', 'gradientBlendValue', (value) => {
    sendParamChange('gradientBlend', parseFloat(value));
  });

  const themeSelect = document.getElementById('colorTheme');
  if (themeSelect) {
    themeSelect.addEventListener('change', (event) => {
      sendParamChange('colorTheme', event.target.value);
      updateColorInputsState();
    });
  }

  const randomizeBtn = document.getElementById('randomizePalette');
  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', () => {
      sendParamChange('randomizePalette', { seed: Date.now() });
    });
  }

  setupColorInput('gradientColor1');
  setupColorInput('gradientColor2');
  setupColorInput('gradientColor3');

  setupSlider('transitionDuration', 'transitionDurationValue', (value) => {
    sendParamChange('transitionDuration', parseFloat(value));
  }, (val) => parseFloat(val).toFixed(1));

  const autoSequenceCheckbox = document.getElementById('autoSequence');
  if (autoSequenceCheckbox) {
    autoSequenceCheckbox.addEventListener('change', (event) => {
      sendParamChange('autoSequence', event.target.checked);
      updateSequenceControlsVisibility();
    });
  }

  setupSlider('autoSequenceInterval', 'autoSequenceIntervalValue', (value) => {
    sendParamChange('autoSequenceInterval', parseInt(value, 10));
  }, (val) => parseInt(val, 10));

  updateSequenceControlsVisibility();
}

function setupSlider(sliderId, valueId, onChange, formatter = (val) => parseFloat(val).toFixed(2)) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(valueId);
  if (!slider || !display) return;

  slider.addEventListener('input', (event) => {
    const value = event.target.value;
    display.textContent = formatter(value);
    onChange(value);
  });

  display.textContent = formatter(slider.value);
}

function setupColorInput(id) {
  const input = document.getElementById(id);
  if (!input) return;

  input.addEventListener('input', (event) => {
    const field = event.target.id;
    sendParamChange(field, event.target.value);
    const themeSelect = document.getElementById('colorTheme');
    if (themeSelect && themeSelect.value !== 'custom') {
      themeSelect.value = 'custom';
      sendParamChange('colorTheme', 'custom');
      updateColorInputsState();
    }
  });
}

function updateColorInputsState() {
  const themeSelect = document.getElementById('colorTheme');
  const colorInputs = document.querySelectorAll('#gradientColorInputs input[type="color"]');
  const presetHint = document.getElementById('presetHint');

  if (!themeSelect || !colorInputs) return;

  const isCustom = themeSelect.value === 'custom';
  colorInputs.forEach((input) => {
    input.disabled = !isCustom;
    input.style.opacity = isCustom ? '1' : '0.5';
  });

  if (presetHint) {
    presetHint.textContent = isCustom
      ? 'Color pickers available when theme is Custom.'
      : 'Switch to Custom to edit the palette.';
  }
}

function updateSequenceControlsVisibility() {
  const autoSequenceCheckbox = document.getElementById('autoSequence');
  const sequenceControls = document.getElementById('sequenceControls');
  if (!autoSequenceCheckbox || !sequenceControls) return;
  sequenceControls.style.display = autoSequenceCheckbox.checked ? 'block' : 'none';
}

function updateWebcamState(active) {
  webcamActive = active;
  const startBtn = document.getElementById('startWebcam');
  const stopBtn = document.getElementById('stopWebcam');

  if (startBtn) startBtn.disabled = active;
  if (stopBtn) stopBtn.disabled = !active;

  if (active) {
    setWebcamStatusText('Webcam active');
  } else {
    setWebcamStatusText('Camera idle');
  }
}

function setWebcamStatusText(text) {
  const el = document.getElementById('webcamStatus');
  if (el) {
    el.textContent = text;
  }
}

function setWebcamError(message) {
  const errorEl = document.getElementById('webcamError');
  if (!errorEl) return;

  if (message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  } else {
    errorEl.style.display = 'none';
  }
}

function sendParamChange(param, value) {
  if (!controlsChannel || suppressParamSend) return;
  controlsChannel.postMessage({
    type: 'PARAM_CHANGE',
    param,
    value
  });
}

function applyParams(params = {}) {
  Object.entries(params).forEach(([key, value]) => {
    const el = document.getElementById(key);
    if (!el) return;

    if (el.type === 'range') {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.tagName === 'SELECT') {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.type === 'color') {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.type === 'checkbox') {
      el.checked = Boolean(value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  updateSequenceControlsVisibility();
}

function getAllParams() {
  return {
    audioSensitivity: parseFloat(document.getElementById('audioSensitivity')?.value || 1),
    globalIntensity: parseFloat(document.getElementById('globalIntensity')?.value || 1),
    globalBrightness: parseFloat(document.getElementById('globalBrightness')?.value || 0),
    globalContrast: parseFloat(document.getElementById('globalContrast')?.value || 1),
    globalBlend: parseFloat(document.getElementById('globalBlend')?.value || 1),
    globalBlur: parseFloat(document.getElementById('globalBlur')?.value || 0),
    colorTheme: document.getElementById('colorTheme')?.value || 'custom',
    gradientColor1: document.getElementById('gradientColor1')?.value || '#000000',
    gradientColor2: document.getElementById('gradientColor2')?.value || '#808080',
    gradientColor3: document.getElementById('gradientColor3')?.value || '#ffffff',
    gradientContrast: parseFloat(document.getElementById('gradientContrast')?.value || 1),
    gradientBrightness: parseFloat(document.getElementById('gradientBrightness')?.value || 0),
    gradientBlend: parseFloat(document.getElementById('gradientBlend')?.value || 1),
    transitionDuration: parseFloat(document.getElementById('transitionDuration')?.value || 2),
    autoSequence: document.getElementById('autoSequence')?.checked || false,
    autoSequenceInterval: parseInt(document.getElementById('autoSequenceInterval')?.value || 30, 10)
  };
}

function bootControls() {
  init().catch((e) => console.error('controls init failed', e));
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootControls);
} else {
  bootControls();
}
