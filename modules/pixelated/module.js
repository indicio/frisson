/**
 * Pixelated Module
 * Video-based particle visualizer with audio-reactive distortion
 */

import * as THREE from '../../shared/libs/three-r161/three.module.js';
import '../../shared/mediaFeed.js';

let scene = null;
let camera = null;
let renderer = null;
let container = null;
let audioData = null;
let controlsChannel = null;
let animationId = null;

// Global state
let particles = null;
let currentParticleType = 'sphere';
let particleMaterialCache = {};
let video = null;
let videoCanvas = null;
let videoCtx = null;
let videoStream = null;
let analyser = null;
let dataArray = null;
let bufferLength = 0;
let audioContext = null;

// Configuration
let params = {
  particleType: 'sphere',
  particleSize: 3,
  distortionAmount: 0.5,
  distortionPattern: 'linear',
  distortionSpeed: 1.0,
  distortionFrequency: 1.0,
  particleCount: 10000,
  particleDiffusion: 'grid',
  colorTheme: 'plasma',
  color1: '#621cbb',
  color2: '#fe3b8f',
  backgroundColor: '#000000'
};

let gridSize = Math.floor(Math.sqrt(params.particleCount));
let time = 0;
let color1 = [0.38, 0.11, 0.73]; // #621cbb
let color2 = [0.99, 0.23, 0.56]; // #fe3b8f
let backgroundColor = [0, 0, 0]; // #000000

// Color themes
const colorThemes = {
  plasma: [[0.05, 0.03, 0.53], [0.47, 0.06, 0.53], [0.84, 0.28, 0.39], [0.99, 0.65, 0.04]],
  ocean: [[0.0, 0.1, 0.3], [0.0, 0.3, 0.5], [0.0, 0.6, 0.8], [0.5, 0.9, 1.0]],
  fire: [[0.1, 0.0, 0.0], [0.6, 0.1, 0.0], [0.9, 0.4, 0.0], [1.0, 0.9, 0.2]],
  neon: [[0.5, 0.0, 0.5], [1.0, 0.0, 0.5], [0.0, 1.0, 1.0], [0.5, 1.0, 0.0]],
  grayscale: [[0.0, 0.0, 0.0], [0.3, 0.3, 0.3], [0.7, 0.7, 0.7], [1.0, 1.0, 1.0]],
  technicolor: [[1.0,0.0,0.0], [1.0,0.5,0.0], [1.0,1.0,0.0], [0.0,1.0,0.0], [0.0,0.0,1.0], [0.29,0.0,0.51], [0.56,0.0,1.0]],
  rainbow: [[1.0,0.0,0.0], [1.0,0.5,0.0], [1.0,1.0,0.0], [0.0,1.0,0.0], [0.0,1.0,1.0], [0.0,0.0,1.0], [0.5,0.0,1.0], [1.0,0.0,1.0]],
  pastel: [[1.0, 0.8, 0.8], [1.0, 1.0, 0.8], [0.8, 1.0, 0.8], [0.8, 1.0, 1.0], [0.8, 0.8, 1.0], [1.0, 0.8, 1.0]],
  icecream: [[1.0, 0.9, 0.9], [1.0, 0.8, 0.7], [0.96, 0.85, 0.72], [0.79, 0.93, 0.81], [0.75, 0.95, 0.94], [0.88, 0.91, 0.98]],
  forest: [[0.13, 0.28, 0.16], [0.25, 0.47, 0.22], [0.44, 0.63, 0.33], [0.62, 0.75, 0.46], [0.83, 0.91, 0.74]],
  candy: [[1.0,0.33,0.56], [1.0,0.60,0.66], [1.0,0.78,0.79], [0.69,0.91,1.0], [0.5,1.0,0.95]]
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ] : null;
}

function rgbToHex(r, g, b) {
  return '#' + [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
    .map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function createCircleSprite(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2-1, 0, 2 * Math.PI, false);
  ctx.fillStyle = '#fff';
  ctx.fill();
  return canvas;
}

function createSquareSprite(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function getParticleMaterial(type) {
  if (particleMaterialCache[type]) return particleMaterialCache[type];
  let mat;
  if (type === 'sphere') {
    const tex = new THREE.Texture(createCircleSprite());
    tex.needsUpdate = true;
    mat = new THREE.PointsMaterial({
      map: tex,
      size: params.particleSize,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9
    });
  } else if (type === 'square') {
    const tex = new THREE.Texture(createSquareSprite());
    tex.needsUpdate = true;
    mat = new THREE.PointsMaterial({
      map: tex,
      size: params.particleSize,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9
    });
  }
  particleMaterialCache[type] = mat;
  return mat;
}

function clearParticles() {
  if (particles) {
    scene.remove(particles);
    particles.geometry.dispose();
    if (particles.material.map) particles.material.map.dispose();
    particles.material.dispose();
    particles = null;
  }
}

function calculatePatternPosition(index, gridSize, pattern, particleCount) {
  const spacing = 8;
  if (pattern === 'grid') {
    const y = Math.floor(index / gridSize);
    const x = index % gridSize;
    return {
      x: (x - gridSize / 2) * spacing,
      y: (gridSize / 2 - y) * spacing,
      u: x / gridSize,
      v: y / gridSize
    };
  }
  if (pattern === 'spiral') {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const r = spacing * Math.sqrt(index) * 0.8;
    const angle = index * golden + Math.PI;
    return {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      u: 0.5 + 0.5 * Math.cos(angle) * r / (gridSize * spacing / 2),
      v: 0.5 + 0.5 * Math.sin(angle) * r / (gridSize * spacing / 2)
    };
  }
  // fallback to grid
  const y = Math.floor(index / gridSize);
  const x = index % gridSize;
  return {
    x: (x - gridSize / 2) * spacing,
    y: (gridSize / 2 - y) * spacing,
    u: x / gridSize,
    v: y / gridSize
  };
}

function createParticles() {
  gridSize = Math.floor(Math.sqrt(params.particleCount));

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(params.particleCount * 3);
  const colors = new Float32Array(params.particleCount * 3);
  const uvs = new Float32Array(params.particleCount * 2);

  for (let i = 0; i < params.particleCount; i++) {
    const { x, y, u, v } = calculatePatternPosition(i, gridSize, params.particleDiffusion, params.particleCount);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = 0;
    uvs[i * 2] = Math.min(Math.max(u, 0), 1);
    uvs[i * 2 + 1] = Math.min(Math.max(v, 0), 1);
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 1;
    colors[i * 3 + 2] = 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  particles = new THREE.Points(geometry, getParticleMaterial(params.particleType));
  scene.add(particles);
}

function calculateDistortion(pattern, i, particleCount, freq, avgFreq, brightness, positions, time) {
  const baseDisplacement = freq * params.distortionAmount * 100;
  const x = positions[i * 3];
  const y = positions[i * 3 + 1];
  const distance = Math.sqrt(x * x + y * y);
  const angle = Math.atan2(y, x);
  
  switch(pattern) {
    case 'linear':
      return (brightness * 50 + baseDisplacement) * (1 + avgFreq);
    case 'wave':
      const wave = Math.sin(distance * 0.01 * params.distortionFrequency + time * params.distortionSpeed) * baseDisplacement;
      return (brightness * 50 + wave) * (1 + avgFreq);
    case 'spiral':
      const spiral = Math.sin(angle * params.distortionFrequency + distance * 0.01 + time * params.distortionSpeed) * baseDisplacement;
      return (brightness * 50 + spiral) * (1 + avgFreq);
    case 'pulse':
      const pulse = Math.sin(time * params.distortionSpeed * 2) * baseDisplacement * params.distortionFrequency;
      return (brightness * 50 + pulse + baseDisplacement) * (1 + avgFreq);
    case 'ripple':
      const ripple = Math.sin(distance * 0.02 * params.distortionFrequency - time * params.distortionSpeed * 2) * baseDisplacement;
      return (brightness * 50 + ripple) * (1 + avgFreq);
    case 'twist':
      const twist = Math.sin(angle * params.distortionFrequency * 2 + distance * 0.01 + time * params.distortionSpeed) * baseDisplacement;
      return (brightness * 50 + twist) * (1 + avgFreq);
    case 'noise':
      const noise = (Math.random() - 0.5) * baseDisplacement * params.distortionFrequency;
      return (brightness * 50 + baseDisplacement + noise) * (1 + avgFreq);
    default:
      return (brightness * 50 + baseDisplacement) * (1 + avgFreq);
  }
}

function updateColors() {
  if (params.color1) color1 = hexToRgb(params.color1);
  if (params.color2) color2 = hexToRgb(params.color2);
  if (params.backgroundColor) {
    backgroundColor = hexToRgb(params.backgroundColor);
    if (renderer) {
      renderer.setClearColor(new THREE.Color(backgroundColor[0], backgroundColor[1], backgroundColor[2]));
    }
    if (scene) {
      scene.background = new THREE.Color(backgroundColor[0], backgroundColor[1], backgroundColor[2]);
    }
  }
}

function applyTheme(themeName) {
  if (themeName === 'custom' || !colorThemes[themeName]) {
    return;
  }
  
  const theme = colorThemes[themeName];
  if (theme && theme.length > 0) {
    const firstColor = theme[0];
    const lastColor = theme[theme.length - 1];
    
    color1 = firstColor;
    color2 = lastColor;
    
    params.color1 = rgbToHex(firstColor[0], firstColor[1], firstColor[2]);
    params.color2 = rgbToHex(lastColor[0], lastColor[1], lastColor[2]);
  }
}

// Main render loop
let lastTime = performance.now();
function renderLoop() {
  animationId = requestAnimationFrame(renderLoop);
  
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  
  time += deltaTime * params.distortionSpeed;

  if (video && video.readyState === video.HAVE_ENOUGH_DATA && particles) {
    const bins = window.frissonMedia?.fft?.();
    let avgFreq = window.frissonMedia?.level?.() || 0;
    if (bins && bins.length) {
      let sum = 0;
      for (let i = 0; i < bins.length; i++) sum += bins[i];
      avgFreq = sum / bins.length / 255;
    }
    
    // Set canvas to 16:9 aspect ratio
    const targetWidth = 1280;
    const targetHeight = 720;
    videoCanvas.width = targetWidth;
    videoCanvas.height = targetHeight;
    
    // Calculate source dimensions to maintain 16:9 from video
    const videoAspect = video.videoWidth / video.videoHeight;
    const targetAspect = 16 / 9;
    let sx, sy, sw, sh;
    
    if (videoAspect > targetAspect) {
      sh = video.videoHeight;
      sw = sh * targetAspect;
      sx = (video.videoWidth - sw) / 2;
      sy = 0;
    } else {
      sw = video.videoWidth;
      sh = sw / targetAspect;
      sx = 0;
      sy = (video.videoHeight - sh) / 2;
    }
    
    // Draw video to canvas, cropping to 16:9
    videoCtx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

    const positions = particles.geometry.attributes.position.array;
    const colors = particles.geometry.attributes.color.array;
    const uvs = particles.geometry.attributes.uv.array;
    
    for (let i = 0; i < params.particleCount; i++) {
      const i3 = i * 3;
      const i2 = i * 2;
      const u = uvs[i2];
      const v = uvs[i2 + 1];
      const px = Math.floor(u * videoCanvas.width);
      const py = Math.floor(v * videoCanvas.height);
      const pixelData = videoCtx.getImageData(
        Math.max(0, Math.min(px, videoCanvas.width-1)),
        Math.max(0, Math.min(py, videoCanvas.height-1)),
        1, 1).data;
      const brightness = (pixelData[0] + pixelData[1] + pixelData[2]) / (3 * 255);
      const freqIndex = bins && bins.length ? Math.floor((i / params.particleCount) * bins.length) : 0;
      const freq = bins && bins.length ? bins[Math.min(freqIndex, bins.length - 1)] / 255 : 0;
      const displacement = calculateDistortion(params.distortionPattern, i, params.particleCount, freq, avgFreq, brightness, positions, time);
      
      // Interpolate between color1 and color2 based on brightness
      colors[i3] = color1[0] + (color2[0] - color1[0]) * brightness;
      colors[i3 + 1] = color1[1] + (color2[1] - color1[1]) * brightness;
      colors[i3 + 2] = color1[2] + (color2[2] - color1[2]) * brightness;
      positions[i3 + 2] = displacement;
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function handleResize() {
  if (!container || !camera || !renderer) return;
  
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  if (width === 0 || height === 0) return;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
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
  
  // Initialize Three.js scene
  scene = new THREE.Scene();
  
  const aspect = container.clientWidth / container.clientHeight || 1;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.z = 500;
  
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  
  updateColors();
  
  container.appendChild(renderer.domElement);
  videoCanvas = document.createElement('canvas');
  videoCtx = videoCanvas.getContext('2d');
  window.frissonMedia.bindCamera((el) => { video = el; });
  createParticles();
  window.addEventListener('resize', handleResize);
}

/**
 * Start animation
 */
export function start() {
  lastTime = performance.now();
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
  
  video = null;
  videoCanvas = null;
  videoCtx = null;
  analyser = null;
  dataArray = null;
  
  // Clean up particles
  clearParticles();
  
  // Clean up materials
  Object.values(particleMaterialCache).forEach(mat => {
    if (mat.map) mat.map.dispose();
    mat.dispose();
  });
  particleMaterialCache = {};
  
  if (renderer) {
    if (container && renderer.domElement && container.contains(renderer.domElement)) {
      container.removeChild(renderer.domElement);
    }
    renderer.dispose();
    renderer = null;
  }
  
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('message', handleParamMessage);
  if (controlsChannel) {
    controlsChannel.removeEventListener('message', handleParamMessage);
  }
  
  scene = null;
  camera = null;
  container = null;
  audioData = null;
  controlsChannel = null;
}

/**
 * Update parameters
 */
export function updateParams(newParams) {
  const needsRecreate = 
    newParams.particleType !== undefined ||
    newParams.particleCount !== undefined ||
    newParams.particleDiffusion !== undefined;
  
  Object.assign(params, newParams);
  
  // Update colors
  if (newParams.color1 || newParams.color2 || newParams.backgroundColor || newParams.colorTheme) {
    if (newParams.colorTheme) {
      applyTheme(newParams.colorTheme);
    }
    updateColors();
  }
  
  // Update particle size
  if (newParams.particleSize !== undefined && particles) {
    particles.material.size = params.particleSize;
  }
  
  // Recreate particles if needed
  if (needsRecreate && scene) {
    clearParticles();
    createParticles();
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

