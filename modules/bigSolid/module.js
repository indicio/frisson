/**
 * Big Solid Module
 * Audio-reactive full-screen solid color visualization
 */
import '../../shared/mediaFeed.js';

let container = null;
let canvas = null;
let ctx = null;
let audioData = null;
let controlsChannel = null;
let animationId = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let bufferLength = 0;
let audioStream = null;

// Color state
let currentColor = [128, 128, 128]; // Start with gray
let targetColor = [128, 128, 128];

// Amplitude state
let smoothedAmplitude = 0;
let rawAmplitude = 0;

// Flash state
let flashActive = false;
let flashEndTime = 0;
const flashCooldown = 100; // ms

// Hold mode state
let holdColor = [128, 128, 128];

// Control parameters
let params = {
  sensitivity: 1.0,
  smoothing: 0.7,
  palette: 'warm',
  brightnessBias: 0,
  minTransitionSpeed: 0.005,
  maxTransitionSpeed: 0.15,
  flashThreshold: 0.9,
  holdMode: false,
  timeBasedMode: false,
  sequenceDuration: 30.0, // seconds for full cycle
  color1: '#ff0000',
  color2: '#ffa500',
  color3: '#ffff00',
  color4: '#00ff00',
  holdColor: '#808080'
};

let lastFrameTime = 0;
let sequenceStartTime = 0;

// Color palettes
const ColorPalettes = {
  warm: [[255, 100, 80], [255, 150, 80], [255, 200, 100], [255, 230, 140], [255, 180, 120]],
  cool: [[80, 150, 255], [100, 200, 255], [140, 180, 255], [180, 220, 255], [120, 160, 240]],
  neon: [[255, 0, 150], [150, 255, 0], [0, 255, 255], [255, 255, 0], [255, 0, 255]],
  monochrome: [[240, 240, 240], [200, 200, 200], [150, 150, 150], [100, 100, 100], [50, 50, 50]],
  sunset: [[255, 94, 77], [255, 154, 0], [255, 206, 84], [255, 159, 64], [255, 107, 129]],
  ocean: [[0, 119, 190], [0, 180, 216], [144, 224, 239], [72, 202, 228], [173, 216, 230]],
  forest: [[34, 139, 34], [76, 175, 80], [129, 199, 132], [102, 187, 106], [156, 204, 101]],
  purple: [[138, 43, 226], [147, 112, 219], [186, 85, 211], [221, 160, 221], [230, 230, 250]],
  rainbow: null // Special case - computed dynamically
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [128, 128, 128];
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function generateRainbowPalette() {
  const colors = [];
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const hue = (i / steps) * 360;
    const rgb = hslToRgb(hue / 360, 1, 0.5);
    colors.push(rgb);
  }
  return colors;
}

function getPalette(name) {
  if (name === 'custom') {
    return [
      hexToRgb(params.color1),
      hexToRgb(params.color2),
      hexToRgb(params.color3),
      hexToRgb(params.color4)
    ];
  }
  if (name === 'rainbow') {
    return generateRainbowPalette();
  }
  return ColorPalettes[name] || ColorPalettes.warm;
}

function getColorForLevel(level, paletteName) {
  const palette = getPalette(paletteName);
  if (palette.length === 0) {
    return [128, 128, 128];
  }
  
  level = Math.max(0, Math.min(1, level));
  
  // For very low levels, darken the base color significantly
  if (level < 0.1) {
    const baseColor = palette[0];
    const darkness = level / 0.1;
    return [
      Math.floor(baseColor[0] * darkness * 0.3),
      Math.floor(baseColor[1] * darkness * 0.3),
      Math.floor(baseColor[2] * darkness * 0.3)
    ];
  }
  
  // For mid to high levels, interpolate through palette colors
  const paletteLevel = (level - 0.1) / 0.9;
  const colorIndex = paletteLevel * (palette.length - 1);
  const lowerIndex = Math.floor(colorIndex);
  const upperIndex = Math.min(lowerIndex + 1, palette.length - 1);
  const t = colorIndex - lowerIndex;
  
  const lowerColor = palette[lowerIndex];
  const upperColor = palette[upperIndex];
  
  const r = Math.floor(lowerColor[0] * (1 - t) + upperColor[0] * t);
  const g = Math.floor(lowerColor[1] * (1 - t) + upperColor[1] * t);
  const b = Math.floor(lowerColor[2] * (1 - t) + upperColor[2] * t);
  
  // Brighten high levels
  if (level > 0.7) {
    const brightenFactor = (level - 0.7) / 0.3;
    const maxBrightness = 255;
    return [
      Math.min(255, Math.floor(r + (maxBrightness - r) * brightenFactor * 0.5)),
      Math.min(255, Math.floor(g + (maxBrightness - g) * brightenFactor * 0.5)),
      Math.min(255, Math.floor(b + (maxBrightness - b) * brightenFactor * 0.5))
    ];
  }
  
  return [r, g, b];
}

function resizeCanvas() {
  if (!canvas || !container) return;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  draw();
}

function getAmplitude() {
  const waveform = audioData?.getWaveformData?.() || window.frissonMedia?.waveform?.();
  if (!waveform || !waveform.length) return smoothedAmplitude * (params.smoothing || 0);

  let sum = 0;
  for (let i = 0; i < waveform.length; i++) {
    const normalized = (waveform[i] - 128) / 128;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / waveform.length);
  
  const scaledAmplitude = Math.min(1.0, rms * params.sensitivity);
  
  rawAmplitude = scaledAmplitude;
  
  smoothedAmplitude = params.smoothing * smoothedAmplitude + 
                      (1 - params.smoothing) * scaledAmplitude;
  
  return smoothedAmplitude;
}

function updateColor(amplitude) {
  const now = Date.now();
  
  // Time-based mode: cycle through all colors in palette over time
  if (params.timeBasedMode) {
    // Calculate elapsed time since sequence start
    const elapsedTime = (now - sequenceStartTime) / 1000; // Convert to seconds
    
    // Calculate progress through sequence (0 to 1, looping)
    const progress = (elapsedTime % params.sequenceDuration) / params.sequenceDuration;
    
    // Get palette colors
    const palette = getPalette(params.palette);
    if (palette.length === 0) {
      return;
    }
    
    // Calculate which two colors to interpolate between
    const colorIndex = progress * palette.length;
    const lowerIndex = Math.floor(colorIndex) % palette.length;
    const upperIndex = (lowerIndex + 1) % palette.length;
    const t = colorIndex - Math.floor(colorIndex);
    
    const lowerColor = palette[lowerIndex];
    const upperColor = palette[upperIndex];
    
    // Interpolate between colors
    let r = Math.floor(lowerColor[0] * (1 - t) + upperColor[0] * t);
    let g = Math.floor(lowerColor[1] * (1 - t) + upperColor[1] * t);
    let b = Math.floor(lowerColor[2] * (1 - t) + upperColor[2] * t);
    
    // Apply brightness bias if set
    if (params.brightnessBias !== 0) {
      const bias = params.brightnessBias;
      r = Math.max(0, Math.min(255, r + (bias > 0 ? (255 - r) * bias : r * bias)));
      g = Math.max(0, Math.min(255, g + (bias > 0 ? (255 - g) * bias : g * bias)));
      b = Math.max(0, Math.min(255, b + (bias > 0 ? (255 - b) * bias : b * bias)));
    }
    
    targetColor = [r, g, b];
    
    // Smooth transition to target color
    const transitionSpeed = 0.1; // Fixed speed for time-based mode
    currentColor[0] = currentColor[0] + (targetColor[0] - currentColor[0]) * transitionSpeed;
    currentColor[1] = currentColor[1] + (targetColor[1] - currentColor[1]) * transitionSpeed;
    currentColor[2] = currentColor[2] + (targetColor[2] - currentColor[2]) * transitionSpeed;
    return;
  }
  
  // Handle flash for non-time-based modes
  if (amplitude > params.flashThreshold && 
      !flashActive && 
      now > flashEndTime + flashCooldown) {
    flashActive = true;
    flashEndTime = now + 50;
  }
  
  if (flashActive && now > flashEndTime) {
    flashActive = false;
  }
  
  // Hold mode: maintain solid color, only flash on threshold
  if (params.holdMode) {
    if (flashActive) {
      targetColor = [255, 255, 255];
    } else {
      targetColor = [...holdColor];
    }
    const transitionSpeed = flashActive ? 0.3 : 0.1;
    currentColor[0] = currentColor[0] + (targetColor[0] - currentColor[0]) * transitionSpeed;
    currentColor[1] = currentColor[1] + (targetColor[1] - currentColor[1]) * transitionSpeed;
    currentColor[2] = currentColor[2] + (targetColor[2] - currentColor[2]) * transitionSpeed;
    return;
  }
  
  // Normal mode: reactive color changes
  if (flashActive) {
    targetColor = [255, 255, 255];
  } else {
    const color = getColorForLevel(amplitude, params.palette);
    
    if (params.brightnessBias !== 0) {
      const bias = params.brightnessBias;
      targetColor = [
        Math.max(0, Math.min(255, color[0] + (bias > 0 ? (255 - color[0]) * bias : color[0] * bias))),
        Math.max(0, Math.min(255, color[1] + (bias > 0 ? (255 - color[1]) * bias : color[1] * bias))),
        Math.max(0, Math.min(255, color[2] + (bias > 0 ? (255 - color[2]) * bias : color[2] * bias)))
      ];
    } else {
      targetColor = color;
    }
  }
  
  const speedRange = params.maxTransitionSpeed - params.minTransitionSpeed;
  const transitionSpeed = params.minTransitionSpeed + (speedRange * amplitude);
  
  currentColor[0] = currentColor[0] + (targetColor[0] - currentColor[0]) * transitionSpeed;
  currentColor[1] = currentColor[1] + (targetColor[1] - currentColor[1]) * transitionSpeed;
  currentColor[2] = currentColor[2] + (targetColor[2] - currentColor[2]) * transitionSpeed;
}

function draw() {
  if (!ctx || !canvas) return;
  const [r, g, b] = currentColor.map(v => Math.round(v));
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderLoop() {
  animationId = requestAnimationFrame(renderLoop);
  
  const amplitude = getAmplitude();
  updateColor(amplitude);
  draw();
}

function handleResize() {
  resizeCanvas();
}

function handleParamMessage(event) {
  if (event.data && event.data.type === 'PARAM_CHANGE') {
    const { param, value } = event.data;
    updateParams({ [param]: value });
  }
}

/**
 * Initialize module
 */
export async function initModule({ container: containerElement, audio, controlsChannel: channel }) {
  container = containerElement;
  audioData = audio;
  controlsChannel = channel;
  
  // Listen for parameter changes
  if (controlsChannel) {
    controlsChannel.addEventListener('message', handleParamMessage);
  }
  window.addEventListener('message', handleParamMessage);
  
  // Create canvas
  canvas = document.createElement('canvas');
  canvas.id = 'colorCanvas';
  ctx = canvas.getContext('2d');
  
  resizeCanvas();
  container.appendChild(canvas);
  
  window.addEventListener('resize', handleResize);
  
  // Initialize hold color
  holdColor = hexToRgb(params.holdColor);
  targetColor = [...holdColor];
  
  // Initialize sequence start time for time-based mode
  sequenceStartTime = Date.now();
}

/**
 * Start animation
 */
export function start() {
  if (!animationId) {
    renderLoop();
  }
}

/**
 * Stop animation
 */
export function stop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

/**
 * Destroy module
 */
export function destroy() {
  stop();
  
  // Stop audio stream
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  
  // Close audio context
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }
  
  analyser = null;
  microphone = null;
  dataArray = null;
  bufferLength = 0;
  
  if (canvas && container && container.contains(canvas)) {
    container.removeChild(canvas);
  }
  
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('message', handleParamMessage);
  if (controlsChannel) {
    controlsChannel.removeEventListener('message', handleParamMessage);
  }
  
  canvas = null;
  ctx = null;
  container = null;
  audioData = null;
  controlsChannel = null;
}

/**
 * Update parameters
 */
export function updateParams(newParams) {
  Object.assign(params, newParams);
  
  // Update hold color if changed
  if (newParams.holdColor !== undefined) {
    holdColor = hexToRgb(params.holdColor);
    if (params.holdMode && !flashActive && !params.timeBasedMode) {
      targetColor = [...holdColor];
    }
  }
  
  // Reset if holdMode changed
  if (newParams.holdMode !== undefined) {
    if (params.holdMode && !params.timeBasedMode) {
      targetColor = [...holdColor];
    }
  }
  
  // Reset sequence start time if time-based mode or duration changed
  if (newParams.timeBasedMode !== undefined || newParams.sequenceDuration !== undefined) {
    if (params.timeBasedMode) {
      sequenceStartTime = Date.now();
    }
  }
}

// Expose module API to window (for loader.js)
if (typeof window !== 'undefined') {
  window.moduleAPI = {
    initModule,
    start,
    stop,
    destroy,
    updateParams
  };
}

