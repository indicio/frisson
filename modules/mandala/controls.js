/**
 * Mandala Controls
 * UI for controlling the mandala visualization
 */

import { Favorites } from '../../shared/favorites.js';

let controlsChannel = null;
const MODULE_ID = 'mandala';

// Shape management
let shapes = [];
let selectedShapeId = null;

// DOM references
let shapeSelect, deleteShapeBtn, updateShapeBtn;
let shapeTypeEl, sizeEl, rotationSpeedEl, offsetXEl, offsetYEl, lineWidthEl, colorEl, opacityEl;
let sizeValueEl, rotationValueEl, offsetXValueEl, offsetYValueEl, lineWidthValueEl, opacityValueEl;
let globalScaleEl, globalScaleValueEl, globalRotationEl, globalRotationValueEl, toggleAnimBtn;
let addShapeBtn;
let incRadiusEl, incRotEl, incOffsetXEl, incOffsetYEl, incOpacityEl, incHueEl;
let ppRadiusMulEl, ppRadiusMulValueEl, ppRotMulEl, ppRotMulValueEl;
let ppOffsetMulEl, ppOffsetMulValueEl, ppOpacityMulEl, ppOpacityMulValueEl;
let ppHueShiftEl, ppHueShiftValueEl;
let ppRadiusDriveEnabledEl, ppRadiusRateEl, ppRadiusAudioEl;
let ppRotDriveEnabledEl, ppRotRateEl, ppRotAudioEl;
let ppOffsetDriveEnabledEl, ppOffsetRateEl, ppOffsetAudioEl;
let ppOpacityDriveEnabledEl, ppOpacityRateEl, ppOpacityAudioEl;
let ppHueDriveEnabledEl, ppHueRateEl, ppHueAudioEl;
let bgModeEl, bgColor1El, bgColor2El;
let enableAudioBtn, audioGainEl, audioGainValueEl;

function typeToSides(type) {
  switch (type) {
    case 'triangle': return 3;
    case 'square': return 4;
    case 'pentagon': return 5;
    case 'hexagon': return 6;
    case 'octagon': return 8;
    default: return 0;
  }
}

function hexToHsl(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToHex(h, s, l) {
  h = (h % 360 + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = v => {
    const n = Math.round((v + m) * 255);
    return n.toString(16).padStart(2, '0');
  };

  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Initialize controls
 */
async function init() {
  // Set up BroadcastChannel for communication
  controlsChannel = new BroadcastChannel('visualizer-controls');

  // Listen for messages from module
  controlsChannel.onmessage = handleModuleMessage;

  // Get all DOM references
  getDOMElements();

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
 * Get DOM element references
 */
function getDOMElements() {
  shapeSelect = document.getElementById('shapeSelect');
  deleteShapeBtn = document.getElementById('deleteShape');
  updateShapeBtn = document.getElementById('updateShape');
  shapeTypeEl = document.getElementById('shapeType');
  sizeEl = document.getElementById('size');
  rotationSpeedEl = document.getElementById('rotationSpeed');
  offsetXEl = document.getElementById('offsetX');
  offsetYEl = document.getElementById('offsetY');
  lineWidthEl = document.getElementById('lineWidth');
  colorEl = document.getElementById('color');
  opacityEl = document.getElementById('opacity');
  sizeValueEl = document.getElementById('sizeValue');
  rotationValueEl = document.getElementById('rotationValue');
  offsetXValueEl = document.getElementById('offsetXValue');
  offsetYValueEl = document.getElementById('offsetYValue');
  lineWidthValueEl = document.getElementById('lineWidthValue');
  opacityValueEl = document.getElementById('opacityValue');
  globalScaleEl = document.getElementById('globalScale');
  globalScaleValueEl = document.getElementById('globalScaleValue');
  globalRotationEl = document.getElementById('globalRotation');
  globalRotationValueEl = document.getElementById('globalRotationValue');
  toggleAnimBtn = document.getElementById('toggleAnim');
  addShapeBtn = document.getElementById('addShape');
  incRadiusEl = document.getElementById('incRadius');
  incRotEl = document.getElementById('incRot');
  incOffsetXEl = document.getElementById('incOffsetX');
  incOffsetYEl = document.getElementById('incOffsetY');
  incOpacityEl = document.getElementById('incOpacity');
  incHueEl = document.getElementById('incHue');
  ppRadiusMulEl = document.getElementById('ppRadiusMul');
  ppRadiusMulValueEl = document.getElementById('ppRadiusMulValue');
  ppRotMulEl = document.getElementById('ppRotMul');
  ppRotMulValueEl = document.getElementById('ppRotMulValue');
  ppOffsetMulEl = document.getElementById('ppOffsetMul');
  ppOffsetMulValueEl = document.getElementById('ppOffsetMulValue');
  ppOpacityMulEl = document.getElementById('ppOpacityMul');
  ppOpacityMulValueEl = document.getElementById('ppOpacityMulValue');
  ppHueShiftEl = document.getElementById('ppHueShift');
  ppHueShiftValueEl = document.getElementById('ppHueShiftValue');
  ppRadiusDriveEnabledEl = document.getElementById('ppRadiusDriveEnabled');
  ppRadiusRateEl = document.getElementById('ppRadiusRate');
  ppRadiusAudioEl = document.getElementById('ppRadiusAudio');
  ppRotDriveEnabledEl = document.getElementById('ppRotDriveEnabled');
  ppRotRateEl = document.getElementById('ppRotRate');
  ppRotAudioEl = document.getElementById('ppRotAudio');
  ppOffsetDriveEnabledEl = document.getElementById('ppOffsetDriveEnabled');
  ppOffsetRateEl = document.getElementById('ppOffsetRate');
  ppOffsetAudioEl = document.getElementById('ppOffsetAudio');
  ppOpacityDriveEnabledEl = document.getElementById('ppOpacityDriveEnabled');
  ppOpacityRateEl = document.getElementById('ppOpacityRate');
  ppOpacityAudioEl = document.getElementById('ppOpacityAudio');
  ppHueDriveEnabledEl = document.getElementById('ppHueDriveEnabled');
  ppHueRateEl = document.getElementById('ppHueRate');
  ppHueAudioEl = document.getElementById('ppHueAudio');
  bgModeEl = document.getElementById('bgMode');
  bgColor1El = document.getElementById('bgColor1');
  bgColor2El = document.getElementById('bgColor2');
  enableAudioBtn = document.getElementById('enableAudio');
  audioGainEl = document.getElementById('audioGain');
  audioGainValueEl = document.getElementById('audioGainValue');
}

// Store full shape data for use in add shape logic
let fullShapesCache = {};

/**
 * Handle messages from module
 */
function handleModuleMessage(event) {
  if (!event.data) return;

  if (event.data.type === 'SHAPES_UPDATE') {
    shapes = event.data.shapes || [];
    refreshShapeSelect();

    // Request full shapes if we don't have them cached
    if (shapes.length > 0) {
      const missingIds = shapes
        .map(s => s.id)
        .filter(id => !fullShapesCache[id]);

      if (missingIds.length > 0 && controlsChannel) {
        // Request full shapes
        controlsChannel.postMessage({
          type: 'GET_ALL_SHAPES'
        });
      }
    }
  } else if (event.data.type === 'ALL_SHAPES') {
    allShapesForFavorites = event.data.shapes || [];
    // Store full shapes in cache
    if (event.data.shapes) {
      event.data.shapes.forEach(s => {
        fullShapesCache[s.id] = s;
      });
    }
    // Also update the local shapes array for the select
    shapes = event.data.shapes.map(s => ({
      id: s.id,
      type: s.type,
      radius: s.radius
    }));
    refreshShapeSelect();
  } else if (event.data.type === 'FULL_SHAPES') {
    // Full shapes data response - update cache
    if (event.data.shapes) {
      event.data.shapes.forEach(s => {
        fullShapesCache[s.id] = s;
      });
    }
  } else if (event.data.type === 'SHAPE_DATA') {
    // Load shape data into controls
    const shape = event.data.shape;
    if (shape) {
      // Store in cache
      fullShapesCache[shape.id] = shape;

      shapeTypeEl.value = shape.type;
      sizeEl.value = shape.radius;
      rotationSpeedEl.value = (shape.rotationSpeed * 180 / Math.PI).toFixed(1);
      offsetXEl.value = shape.offsetX;
      offsetYEl.value = shape.offsetY;
      lineWidthEl.value = shape.lineWidth;
      colorEl.value = shape.color;
      opacityEl.value = Math.round(shape.opacity * 100);

      if (sizeValueEl) sizeValueEl.textContent = sizeEl.value;
      if (rotationValueEl) rotationValueEl.textContent = rotationSpeedEl.value;
      if (offsetXValueEl) offsetXValueEl.textContent = offsetXEl.value;
      if (offsetYValueEl) offsetYValueEl.textContent = offsetYEl.value;
      if (lineWidthValueEl) lineWidthValueEl.textContent = lineWidthEl.value;
      if (opacityValueEl) opacityValueEl.textContent = opacityEl.value + '%';
    }
  }
}

/**
 * Set up control inputs
 */
function setupControls() {
  // Range inputs with value displays
  hookRange(sizeEl, sizeValueEl, v => v);
  hookRange(rotationSpeedEl, rotationValueEl, v => v);
  hookRange(offsetXEl, offsetXValueEl, v => v);
  hookRange(offsetYEl, offsetYValueEl, v => v);
  hookRange(lineWidthEl, lineWidthValueEl, v => v);
  hookRange(opacityEl, opacityValueEl, v => v + '%');
  hookRange(globalScaleEl, globalScaleValueEl, v => parseFloat(v).toFixed(2) + 'x');
  hookRange(globalRotationEl, globalRotationValueEl, v => `${v}°`);
  hookRange(audioGainEl, audioGainValueEl, v => parseFloat(v).toFixed(1) + 'x');
  hookRange(ppRadiusMulEl, ppRadiusMulValueEl, v => parseFloat(v).toFixed(2) + 'x');
  hookRange(ppRotMulEl, ppRotMulValueEl, v => parseFloat(v).toFixed(2) + 'x');
  hookRange(ppOffsetMulEl, ppOffsetMulValueEl, v => parseFloat(v).toFixed(2) + 'x');
  hookRange(ppOpacityMulEl, ppOpacityMulValueEl, v => parseFloat(v).toFixed(2) + 'x');
  hookRange(ppHueShiftEl, ppHueShiftValueEl, v => `${v}°`);

  // Parameter change handlers
  const paramInputs = [
    'globalScale', 'globalRotation', 'shapeType', 'size', 'rotationSpeed',
    'offsetX', 'offsetY', 'lineWidth', 'color', 'opacity',
    'incRadius', 'incRot', 'incOffsetX', 'incOffsetY', 'incOpacity', 'incHue',
    'ppRadiusMul', 'ppRotMul', 'ppOffsetMul', 'ppOpacityMul', 'ppHueShift',
    'ppRadiusRate', 'ppRadiusAudio', 'ppRotRate', 'ppRotAudio',
    'ppOffsetRate', 'ppOffsetAudio', 'ppOpacityRate', 'ppOpacityAudio',
    'ppHueRate', 'ppHueAudio', 'bgMode', 'bgColor1', 'bgColor2', 'audioGain'
  ];

  paramInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'range' || el.type === 'number' || el.type === 'color') {
        el.addEventListener('input', () => {
          const value = el.type === 'checkbox' ? el.checked :
            el.type === 'color' ? el.value :
              parseFloat(el.value);
          sendParamChange(id, value);
        });
      } else if (el.tagName === 'SELECT') {
        el.addEventListener('change', () => {
          sendParamChange(id, el.value);
        });
      }
    }
  });

  // Checkboxes
  const checkboxes = [
    'ppRadiusDriveEnabled', 'ppRotDriveEnabled', 'ppOffsetDriveEnabled',
    'ppOpacityDriveEnabled', 'ppHueDriveEnabled'
  ];
  checkboxes.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        sendParamChange(id, el.checked);
      });
    }
  });

  // Buttons
  if (toggleAnimBtn) {
    toggleAnimBtn.addEventListener('click', () => {
      sendParamChange('toggleAnim', true);
      toggleAnimBtn.textContent = toggleAnimBtn.textContent === 'Start Animation'
        ? 'Pause Animation'
        : 'Start Animation';
    });
  }

  if (addShapeBtn) {
    addShapeBtn.addEventListener('click', () => {
      handleAddShape().catch(err => {
        console.error('Error adding shape:', err);
      });
    });
  }

  if (updateShapeBtn) {
    updateShapeBtn.addEventListener('click', handleUpdateShape);
  }

  if (deleteShapeBtn) {
    deleteShapeBtn.addEventListener('click', handleDeleteShape);
  }

  if (shapeSelect) {
    shapeSelect.addEventListener('change', () => {
      const id = parseInt(shapeSelect.value, 10);
      selectedShapeId = isNaN(id) ? null : id;
      updateSelectionState();
      if (selectedShapeId) {
        requestShapeData(selectedShapeId);
      }
    });
  }
}

function hookRange(el, labelEl, transform = v => v) {
  if (!el || !labelEl) return;
  const update = () => {
    labelEl.textContent = transform(el.value);
  };
  el.addEventListener('input', update);
  update();
}

function getCurrentConfig() {
  const type = shapeTypeEl.value;
  const radius = parseFloat(sizeEl.value);
  const rotationDeg = parseFloat(rotationSpeedEl.value);
  const rotationRadPerSec = rotationDeg * Math.PI / 180;
  const offsetX = parseFloat(offsetXEl.value);
  const offsetY = parseFloat(offsetYEl.value);
  const lineWidth = parseFloat(lineWidthEl.value);
  const color = colorEl.value;
  const opacity = parseFloat(opacityEl.value) / 100;

  return {
    type,
    radius,
    rotationRadPerSec,
    offsetX,
    offsetY,
    lineWidth,
    color,
    opacity,
    sides: typeToSides(type)
  };
}

function getIncrementConfig() {
  return {
    radius: parseFloat(incRadiusEl.value) || 0,
    rotDeg: parseFloat(incRotEl.value) || 0,
    offsetX: parseFloat(incOffsetXEl.value) || 0,
    offsetY: parseFloat(incOffsetYEl.value) || 0,
    opacityPct: parseFloat(incOpacityEl.value) || 0,
    hueDeg: parseFloat(incHueEl.value) || 0
  };
}

async function handleAddShape() {
  const cfg = getCurrentConfig();
  const inc = getIncrementConfig();

  // Find base shape (selected or last)
  let baseShapeId = null;
  let baseShape = null;

  if (shapes.length > 0) {
    if (selectedShapeId) {
      baseShapeId = selectedShapeId;
    } else {
      baseShapeId = shapes[shapes.length - 1].id;
    }

    // Get full shape data from cache or request it
    baseShape = fullShapesCache[baseShapeId];

    if (!baseShape && baseShapeId) {
      // Request the full shape data
      await new Promise((resolve) => {
        const handler = (event) => {
          if (event.data && event.data.type === 'SHAPE_DATA' && event.data.shape.id === baseShapeId) {
            controlsChannel.removeEventListener('message', handler);
            baseShape = event.data.shape;
            fullShapesCache[baseShapeId] = baseShape;
            resolve();
          }
        };
        controlsChannel.addEventListener('message', handler);
        requestShapeData(baseShapeId);

        // Timeout after 500ms
        setTimeout(() => {
          controlsChannel.removeEventListener('message', handler);
          resolve();
        }, 500);
      });
    }
  }

  let finalCfg;
  if (baseShape) {
    // Apply increments to base shape
    const type = shapeTypeEl.value || baseShape.type;
    const sides = typeToSides(type);
    const baseRotDeg = baseShape.rotationSpeed * 180 / Math.PI;

    finalCfg = {
      type,
      radius: clamp(baseShape.radius + inc.radius, 20, 400),
      rotationRadPerSec: clamp(baseRotDeg + inc.rotDeg, -180, 180) * Math.PI / 180,
      offsetX: clamp(baseShape.offsetX + inc.offsetX, -400, 400),
      offsetY: clamp(baseShape.offsetY + inc.offsetY, -400, 400),
      lineWidth: parseFloat(lineWidthEl.value) || baseShape.lineWidth,
      color: baseShape.color, // Will apply hue increment below
      opacity: clamp(baseShape.opacity + (inc.opacityPct / 100), 0.05, 1),
      sides
    };

    // Apply hue increment
    const { h, s, l } = hexToHsl(baseShape.color);
    finalCfg.color = hslToHex(h + inc.hueDeg, s, l);

    // Update controls to reflect new shape
    shapeTypeEl.value = finalCfg.type;
    sizeEl.value = finalCfg.radius;
    rotationSpeedEl.value = (finalCfg.rotationRadPerSec * 180 / Math.PI).toFixed(1);
    offsetXEl.value = finalCfg.offsetX;
    offsetYEl.value = finalCfg.offsetY;
    lineWidthEl.value = finalCfg.lineWidth;
    colorEl.value = finalCfg.color;
    opacityEl.value = Math.round(finalCfg.opacity * 100);

    sizeValueEl.textContent = sizeEl.value;
    rotationValueEl.textContent = rotationSpeedEl.value;
    offsetXValueEl.textContent = offsetXEl.value;
    offsetYValueEl.textContent = offsetYEl.value;
    lineWidthValueEl.textContent = lineWidthEl.value;
    opacityValueEl.textContent = opacityEl.value + '%';
  } else {
    finalCfg = cfg;
  }

  sendShapeAction('add', finalCfg);
}

function handleUpdateShape() {
  if (!selectedShapeId) return;
  const cfg = getCurrentConfig();
  sendShapeAction('update', { id: selectedShapeId, ...cfg });
}

function handleDeleteShape() {
  if (!selectedShapeId) return;
  sendShapeAction('delete', { id: selectedShapeId });
}

function requestShapeData(shapeId) {
  // Request shape data from module
  if (controlsChannel) {
    controlsChannel.postMessage({
      type: 'GET_SHAPE',
      id: shapeId
    });
  }
}

function refreshShapeSelect() {
  if (!shapeSelect) return;
  const current = shapeSelect.value;
  shapeSelect.innerHTML = '<option value="">(none)</option>';
  shapes.forEach(shape => {
    const opt = document.createElement('option');
    opt.value = String(shape.id);
    opt.textContent = `#${shape.id} – ${shape.type} (r=${shape.radius})`;
    shapeSelect.appendChild(opt);
  });
  if (current && shapes.some(s => String(s.id) === parseInt(current))) {
    shapeSelect.value = current;
  } else {
    shapeSelect.value = '';
    selectedShapeId = null;
  }
  updateSelectionState();
}

function updateSelectionState() {
  const hasSelection = !!selectedShapeId;
  if (deleteShapeBtn) deleteShapeBtn.disabled = !hasSelection;
  if (updateShapeBtn) updateShapeBtn.disabled = !hasSelection;
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
 * Send shape action to module
 */
function sendShapeAction(action, data) {
  if (controlsChannel) {
    controlsChannel.postMessage({
      type: 'SHAPE_ACTION',
      action: action,
      data: data
    });
  }
}

// Store all shapes when received for favorites
let allShapesForFavorites = [];

/**
 * Get all current parameter values including shapes
 */
function getAllParams() {
  // Get all config values
  const params = {
    globalScale: parseFloat(globalScaleEl?.value || 1),
    globalRotation: parseFloat(globalRotationEl?.value || 0),
    bgMode: bgModeEl?.value || 'solid',
    bgColor1: bgColor1El?.value || '#020309',
    bgColor2: bgColor2El?.value || '#020309',
    shapeType: shapeTypeEl?.value || 'circle',
    size: parseFloat(sizeEl?.value || 120),
    rotationSpeed: parseFloat(rotationSpeedEl?.value || 20),
    offsetX: parseFloat(offsetXEl?.value || 0),
    offsetY: parseFloat(offsetYEl?.value || 0),
    lineWidth: parseFloat(lineWidthEl?.value || 2),
    color: colorEl?.value || '#ffffff',
    opacity: parseFloat(opacityEl?.value || 100),
    incRadius: parseFloat(incRadiusEl?.value || 0),
    incRot: parseFloat(incRotEl?.value || 0),
    incOffsetX: parseFloat(incOffsetXEl?.value || 0),
    incOffsetY: parseFloat(incOffsetYEl?.value || 0),
    incOpacity: parseFloat(incOpacityEl?.value || 0),
    incHue: parseFloat(incHueEl?.value || 0),
    ppRadiusMul: parseFloat(ppRadiusMulEl?.value || 1),
    ppRadiusDriveEnabled: ppRadiusDriveEnabledEl?.checked || false,
    ppRadiusRate: parseFloat(ppRadiusRateEl?.value || 0.3),
    ppRadiusAudio: parseFloat(ppRadiusAudioEl?.value || 0.5),
    ppRotMul: parseFloat(ppRotMulEl?.value || 1),
    ppRotDriveEnabled: ppRotDriveEnabledEl?.checked || false,
    ppRotRate: parseFloat(ppRotRateEl?.value || 0.2),
    ppRotAudio: parseFloat(ppRotAudioEl?.value || 0.5),
    ppOffsetMul: parseFloat(ppOffsetMulEl?.value || 1),
    ppOffsetDriveEnabled: ppOffsetDriveEnabledEl?.checked || false,
    ppOffsetRate: parseFloat(ppOffsetRateEl?.value || 0.15),
    ppOffsetAudio: parseFloat(ppOffsetAudioEl?.value || 0.5),
    ppOpacityMul: parseFloat(ppOpacityMulEl?.value || 1),
    ppOpacityDriveEnabled: ppOpacityDriveEnabledEl?.checked || false,
    ppOpacityRate: parseFloat(ppOpacityRateEl?.value || 0.1),
    ppOpacityAudio: parseFloat(ppOpacityAudioEl?.value || 0.5),
    ppHueShift: parseFloat(ppHueShiftEl?.value || 0),
    ppHueDriveEnabled: ppHueDriveEnabledEl?.checked || false,
    ppHueRate: parseFloat(ppHueRateEl?.value || 0.1),
    ppHueAudio: parseFloat(ppHueAudioEl?.value || 0.5),
    audioGain: parseFloat(audioGainEl?.value || 1)
  };

  // Include shapes data for favorites
  if (allShapesForFavorites.length > 0) {
    params.shapes = allShapesForFavorites.map(s => ({
      id: s.id,
      type: s.type,
      radius: s.radius,
      sides: s.sides,
      rotationSpeed: s.rotationSpeed,
      offsetX: s.offsetX,
      offsetY: s.offsetY,
      lineWidth: s.lineWidth,
      color: s.color,
      opacity: s.opacity,
      angle: s.angle || 0
    }));
  } else if (shapes.length > 0) {
    params.shapes = shapes.map(s => ({ ...s }));
  }

  return params;
}

/**
 * Apply parameter values to controls
 */
function applyParams(params) {
  // Handle shapes restoration
  if (params.shapes && Array.isArray(params.shapes)) {
    sendShapeAction('setAll', params.shapes);
    // Request updated shapes list after a short delay
    setTimeout(() => {
      if (controlsChannel) {
        controlsChannel.postMessage({
          type: 'GET_ALL_SHAPES'
        });
      }
    }, 100);
  }

  if (params.globalScale !== undefined) {
    if (globalScaleEl) {
      globalScaleEl.value = params.globalScale;
      if (globalScaleValueEl) globalScaleValueEl.textContent = parseFloat(params.globalScale).toFixed(2) + 'x';
      globalScaleEl.dispatchEvent(new Event('input'));
    }
  }
  // Apply all other parameters similarly...
  Object.keys(params).forEach(key => {
    if (key === 'shapes') return; // Already handled above
    const el = document.getElementById(key);
    if (el) {
      if (el.type === 'checkbox') {
        el.checked = params[key];
      } else if (el.type === 'range' || el.type === 'number') {
        el.value = params[key];
        const valueEl = document.getElementById(key + 'Value');
        if (valueEl) {
          if (key === 'globalScale') valueEl.textContent = parseFloat(params[key]).toFixed(2) + 'x';
          else if (key === 'globalRotation') valueEl.textContent = `${params[key]}°`;
          else if (key === 'opacity') valueEl.textContent = params[key] + '%';
          else if (key.includes('Mul')) valueEl.textContent = parseFloat(params[key]).toFixed(2) + 'x';
          else if (key.includes('Shift')) valueEl.textContent = `${params[key]}°`;
          else if (key === 'audioGain') valueEl.textContent = parseFloat(params[key]).toFixed(1) + 'x';
          else valueEl.textContent = params[key];
        }
        el.dispatchEvent(new Event('input'));
      } else {
        el.value = params[key];
        el.dispatchEvent(new Event('input'));
      }
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
