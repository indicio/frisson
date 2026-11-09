/**
 * Mandala Module
 * Geometric wireframes with persistent steps and audio-reactive post-processing
 */

const canvas = document.getElementById('mandala');
if (!canvas) {
  console.error('Mandala: Canvas element not found');
}

const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
let cx = width / 2;
let cy = height / 2;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  cx = width / 2;
  cy = height / 2;
}

window.addEventListener('resize', resize);
resize();

const shapes = [];
let nextId = 1;

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

// Module state
let controlsChannel = null;
let audioAPI = null;
let isPaused = true;
let lastTime = 0;

// Audio setup & level
let audioCtx = null;
let analyser = null;
let audioData = null;
let audioEnabled = false;
let audioLevel = 0;

// Config
const config = {
  globalScale: 1,
  globalRotation: 0,
  bgMode: 'solid',
  bgColor1: '#020309',
  bgColor2: '#020309',
  shapeType: 'circle',
  size: 120,
  rotationSpeed: 20,
  offsetX: 0,
  offsetY: 0,
  lineWidth: 2,
  color: '#ffffff',
  opacity: 100,
  incRadius: 0,
  incRot: 0,
  incOffsetX: 0,
  incOffsetY: 0,
  incOpacity: 0,
  incHue: 0,
  ppRadiusMul: 1,
  ppRadiusDriveEnabled: false,
  ppRadiusRate: 0.3,
  ppRadiusAudio: 0.5,
  ppRotMul: 1,
  ppRotDriveEnabled: false,
  ppRotRate: 0.2,
  ppRotAudio: 0.5,
  ppOffsetMul: 1,
  ppOffsetDriveEnabled: false,
  ppOffsetRate: 0.15,
  ppOffsetAudio: 0.5,
  ppOpacityMul: 1,
  ppOpacityDriveEnabled: false,
  ppOpacityRate: 0.1,
  ppOpacityAudio: 0.5,
  ppHueShift: 0,
  ppHueDriveEnabled: false,
  ppHueRate: 0.1,
  ppHueAudio: 0.5,
  audioGain: 1
};

// Color utilities
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

function updateAudioLevel() {
  if (audioAPI && typeof audioAPI.getAudioLevel === 'function') {
    let level = audioAPI.getAudioLevel();
    const gain = parseFloat(config.audioGain) || 1;
    level = Math.min(1, level * gain);
    const smoothing = 0.8;
    audioLevel = audioLevel * smoothing + level * (1 - smoothing);
    return;
  }
  if (!audioEnabled || !analyser || !audioData) {
    audioLevel = 0;
    return;
  }
  analyser.getByteFrequencyData(audioData);
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i];
  }
  let avg = sum / audioData.length; // 0..255
  let level = avg / 255;           // 0..1

  const gain = parseFloat(config.audioGain) || 1;
  level = Math.min(1, level * gain);

  const smoothing = 0.8;
  audioLevel = audioLevel * smoothing + level * (1 - smoothing);
}

// Background drawing
function drawBackground() {
  const mode = config.bgMode;
  const c1 = config.bgColor1;
  const c2 = config.bgColor2;

  if (mode === 'solid') {
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  let grad;
  switch (mode) {
    case 'linear-h':
      grad = ctx.createLinearGradient(0, 0, width, 0);
      break;
    case 'linear-v':
      grad = ctx.createLinearGradient(0, 0, 0, height);
      break;
    case 'linear-d1':
      grad = ctx.createLinearGradient(0, 0, width, height);
      break;
    case 'linear-d2':
      grad = ctx.createLinearGradient(0, height, width, 0);
      break;
    case 'radial':
    default:
      grad = ctx.createRadialGradient(
        cx, cy, 0,
        cx, cy, Math.max(width, height) * 0.8
      );
      break;
  }

  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

// Post driver helpers
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function applyPostMultiplier(base, enabled, rate, audioAmt, t, opts = {}) {
  const { min = 0, max = Infinity, allowNegative = false } = opts;
  if (!enabled) {
    let v = base;
    if (!allowNegative) v = Math.max(min, v);
    if (max < Infinity) v = Math.min(max, v);
    return v;
  }

  const lfo = Math.sin(2 * Math.PI * rate * t); // -1..1

  const depthLfo = 0.5 * base;       // 50% swing from LFO
  const depthAudio = audioAmt * base; // audio-driven extra

  let v = base + lfo * depthLfo + audioLevel * depthAudio;

  if (!allowNegative) v = Math.max(min, v);
  if (max < Infinity) v = Math.min(max, v);
  return v;
}

function applyPostHue(baseDeg, enabled, rate, audioAmt, t) {
  if (!enabled) {
    return ((baseDeg + 540) % 360) - 180; // clamp to [-180,180]
  }
  const lfo = Math.sin(2 * Math.PI * rate * t); // -1..1

  const depthLfo = 60;              // +/-60° from LFO
  const depthAudio = audioAmt * 90; // up to +/-90° from audio

  let v = baseDeg + lfo * depthLfo + audioLevel * depthAudio;
  // Wrap to [-180, 180]
  v = ((v + 540) % 360) - 180;
  return v;
}

function drawShapeGeometryWithRadius(shape, radius) {
  ctx.beginPath();
  if (shape.type === 'circle') {
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
  } else {
    const n = shape.sides || 3;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

// Animation
let animationId = null;

function animate(timestamp) {
  animationId = requestAnimationFrame(animate);
  
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  const t = timestamp / 1000;

  updateAudioLevel();

  ctx.clearRect(0, 0, width, height);

  // Background
  drawBackground();

  ctx.save();
  ctx.translate(cx, cy);

  const baseGlobalScale = parseFloat(config.globalScale) || 1;
  const globalRotationDeg = parseFloat(config.globalRotation) || 0;
  const globalRotationRad = globalRotationDeg * Math.PI / 180;

  // Base post values
  const radiusMulBase = parseFloat(config.ppRadiusMul) || 1;
  const rotMulBase = parseFloat(config.ppRotMul) || 1;
  const offsetMulBase = parseFloat(config.ppOffsetMul) || 1;
  const opacityMulBase = parseFloat(config.ppOpacityMul) || 1;
  const hueShiftBase = parseFloat(config.ppHueShift) || 0;

  // Driven post values
  const radiusMul = applyPostMultiplier(
    radiusMulBase,
    config.ppRadiusDriveEnabled,
    parseFloat(config.ppRadiusRate) || 0,
    parseFloat(config.ppRadiusAudio) || 0,
    t,
    { min: 0.05, allowNegative: false }
  );
  const rotMul = applyPostMultiplier(
    rotMulBase,
    config.ppRotDriveEnabled,
    parseFloat(config.ppRotRate) || 0,
    parseFloat(config.ppRotAudio) || 0,
    t,
    { min: -2, max: 2, allowNegative: true }
  );
  const offsetMul = applyPostMultiplier(
    offsetMulBase,
    config.ppOffsetDriveEnabled,
    parseFloat(config.ppOffsetRate) || 0,
    parseFloat(config.ppOffsetAudio) || 0,
    t,
    { min: 0, allowNegative: false }
  );
  const opacityMul = applyPostMultiplier(
    opacityMulBase,
    config.ppOpacityDriveEnabled,
    parseFloat(config.ppOpacityRate) || 0,
    parseFloat(config.ppOpacityAudio) || 0,
    t,
    { min: 0, allowNegative: false }
  );
  const hueShiftEff = applyPostHue(
    hueShiftBase,
    config.ppHueDriveEnabled,
    parseFloat(config.ppHueRate) || 0,
    parseFloat(config.ppHueAudio) || 0,
    t
  );

  ctx.rotate(globalRotationRad);
  ctx.scale(baseGlobalScale, baseGlobalScale);

  for (const shape of shapes) {
    if (!isPaused) {
      shape.angle += shape.rotationSpeed * rotMul * dt;
    }

    const ox = shape.offsetX * offsetMul;
    const oy = shape.offsetY * offsetMul;
    const cosA = Math.cos(shape.angle);
    const sinA = Math.sin(shape.angle);

    const px = ox * cosA - oy * sinA;
    const py = ox * sinA + oy * cosA;

    ctx.save();
    ctx.translate(px, py);

    ctx.rotate(shape.angle);

    let renderRadius = Math.max(1, shape.radius * radiusMul);
    let renderOpacity = clamp(shape.opacity * opacityMul, 0, 1);

    const { h, s, l } = hexToHsl(shape.color);
    const renderColor = hslToHex(h + hueShiftEff, s, l);

    ctx.globalAlpha = renderOpacity;
    ctx.lineWidth = shape.lineWidth;
    ctx.strokeStyle = renderColor;

    drawShapeGeometryWithRadius(shape, renderRadius);
    ctx.restore();
  }

  ctx.restore();
}

// Handle control messages
function handleControlMessage(event) {
  if (event.data && event.data.type === 'PARAM_CHANGE') {
    handleParamChange(event.data.param, event.data.value);
  } else if (event.data && event.data.type === 'SHAPE_ACTION') {
    handleShapeAction(event.data.action, event.data.data);
  } else if (event.data && event.data.type === 'GET_ALL_SHAPES') {
    // Send all shapes to controls
    if (controlsChannel) {
      controlsChannel.postMessage({
        type: 'ALL_SHAPES',
        shapes: shapes.map(s => ({ ...s }))
      });
    }
  } else if (event.data && event.data.type === 'GET_SHAPE') {
    // Send specific shape data
    const shape = shapes.find(s => s.id === event.data.id);
    if (controlsChannel && shape) {
      controlsChannel.postMessage({
        type: 'SHAPE_DATA',
        shape: { ...shape }
      });
    }
  }
}

// Handle parameter changes
function handleParamChange(param, value) {
  if (config.hasOwnProperty(param)) {
    config[param] = value;
  }
  
  // Handle special cases
  if (param === 'toggleAnim') {
    isPaused = !isPaused;
  }
}

// Handle shape actions
function handleShapeAction(action, data) {
  if (action === 'add') {
    const shape = {
      id: nextId++,
      type: data.type,
      radius: data.radius,
      sides: data.sides,
      rotationSpeed: data.rotationRadPerSec,
      offsetX: data.offsetX,
      offsetY: data.offsetY,
      lineWidth: data.lineWidth,
      color: data.color,
      opacity: data.opacity,
      angle: 0
    };
    shapes.push(shape);
    refreshShapesInControls();
    // Send the new shape data to controls
    if (controlsChannel) {
      controlsChannel.postMessage({
        type: 'SHAPE_DATA',
        shape: { ...shape }
      });
    }
  } else if (action === 'update') {
    const shape = shapes.find(s => s.id === data.id);
    if (shape) {
      shape.type = data.type;
      shape.radius = data.radius;
      shape.sides = data.sides;
      shape.rotationSpeed = data.rotationRadPerSec;
      shape.offsetX = data.offsetX;
      shape.offsetY = data.offsetY;
      shape.lineWidth = data.lineWidth;
      shape.color = data.color;
      shape.opacity = data.opacity;
      refreshShapesInControls();
      // Also send updated shape data to controls
      if (controlsChannel) {
        controlsChannel.postMessage({
          type: 'SHAPE_DATA',
          shape: { ...shape }
        });
      }
    }
  } else if (action === 'delete') {
    const idx = shapes.findIndex(s => s.id === data.id);
    if (idx !== -1) {
      shapes.splice(idx, 1);
      refreshShapesInControls();
    }
  } else if (action === 'setAll') {
    shapes.length = 0;
    nextId = 1;
    if (data && Array.isArray(data)) {
      data.forEach(s => {
        const id = s.id !== undefined ? s.id : nextId++;
        if (id >= nextId) nextId = id + 1;
        shapes.push({
          id: id,
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
        });
      });
    }
    refreshShapesInControls();
  }
}

function refreshShapesInControls() {
  if (controlsChannel) {
    // Send minimal shape data for the select dropdown
    controlsChannel.postMessage({
      type: 'SHAPES_UPDATE',
      shapes: shapes.map(s => ({
        id: s.id,
        type: s.type,
        radius: s.radius
      }))
    });
    
    // Also send full shape data for caching
    controlsChannel.postMessage({
      type: 'FULL_SHAPES',
      shapes: shapes.map(s => ({ ...s }))
    });
  }
}

// Module API
const moduleAPI = {
  async initModule({ container, audio, controlsChannel: providedControlsChannel }) {
    controlsChannel = providedControlsChannel;
    audioAPI = audio;
    
    // Set up BroadcastChannel for control messages
    if (controlsChannel) {
      controlsChannel.onmessage = handleControlMessage;
      // Send initial shapes data
      refreshShapesInControls();
    }
    
    // Handle resize
    resize();
  },
  
  start() {
    if (!animationId) {
      animate();
    }
  },
  
  stop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  },
  
  destroy() {
    stop();
    window.removeEventListener('resize', resize);
    
    if (controlsChannel) {
      controlsChannel.close();
    }
  },
  
  // Expose shapes for favorites
  getShapes() {
    return shapes.map(s => ({ ...s }));
  },
  
  getConfig() {
    return { ...config };
  }
};

// Expose API immediately
window.moduleAPI = moduleAPI;

console.log('Mandala module API exposed', { hasInitModule: !!moduleAPI.initModule });







