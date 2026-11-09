/**
 * Metaball2 Module
 * Shader-based audio-reactive metaballs visualization
 */

import * as THREE from '../../shared/libs/three-r161/three.module.js';

let scene = null;
let camera = null;
let renderer = null;
let container = null;
let material = null;
let mesh = null;
let audioData = null;
let controlsChannel = null;
let animationId = null;
let lastTime = 0;
let lastAudio = { low: 0, mid: 0, high: 0 };

// Module parameters
let params = {
  speed: 1.0,
  ballCount: 5,
  lowSens: 1.0,
  midSens: 1.0,
  highSens: 1.0,
  masterAudioGain: 1.0,
  threshold: 1.5,
  glow: 0.5,
  baseSize: 0.25,
  color1: '#3366ff',
  color2: '#ff3399',
  bgColor: '#000000'
};

// Shaders
const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float time;
uniform vec2 resolution;
uniform float audioLow;
uniform float audioMid;
uniform float audioHigh;
uniform float threshold;
uniform float glowIntensity;
uniform float baseSize;
uniform int ballCount;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 bgColor;
varying vec2 vUv;

float metaball(vec2 p, vec2 center, float radius) {
  return radius / length(p - center);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= resolution.x / resolution.y;

  float t = time * 0.5;
  float sum = 0.0;
  
  for (int i = 0; i < 10; i++) {
    if (i >= ballCount) break;
    
    float fi = float(i);
    float offset = fi * 2.3;

    // Per-ball speed and phase for more organic motion
    float speed = 0.6 + fi * 0.07;
    float phase = offset + t * (0.8 + fi * 0.13) * speed;

    vec2 pos = vec2(
      sin(phase) * (0.4 + fi * 0.04),
      cos(phase * 1.3) * (0.4 + fi * 0.04)
    );
    
    float audioEffect = 0.0;
    if (i % 3 == 0) audioEffect = audioLow * 0.4;
    else if (i % 3 == 1) audioEffect = audioMid * 0.3;
    else audioEffect = audioHigh * 0.35;
    
    sum += metaball(uv, pos, baseSize + audioEffect);
  }
  
  float glow = smoothstep(threshold - 0.5, threshold + 0.5, sum);
  
  vec3 finalColor = mix(color1, color2, sin(t + sum) * 0.5 + 0.5);
  finalColor *= glow;
  
  float edge = smoothstep(threshold, threshold + 0.1, sum);
  finalColor += vec3(1.0) * (edge - glow) * glowIntensity;
  
  finalColor = mix(bgColor, finalColor, glow);

  // Simple gamma-ish curve for punchier look
  finalColor = pow(finalColor, vec3(0.8));
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

/**
 * Initialize the module
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.container - Container element
 * @param {Object} config.audio - Audio API object
 * @param {BroadcastChannel} config.controlsChannel - Channel for control messages
 */
export async function initModule({ container: containerElement, audio, controlsChannel: channel }) {
  container = containerElement;
  audioData = audio;
  controlsChannel = channel;
  
  // Listen for control messages
  if (controlsChannel) {
    controlsChannel.onmessage = handleControlMessage;
  }
  
  // Also listen for window messages (from shell)
  window.addEventListener('message', handleWindowMessage);
  
  // Initialize Three.js scene
  initScene();
  createShaderMaterial();
  createMesh();
  
  // Set background
  container.style.backgroundColor = params.bgColor;
}

/**
 * Initialize Three.js scene
 */
function initScene() {
  // Scene
  scene = new THREE.Scene();
  
  // Camera (orthographic for full-screen shader)
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(dpr);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(params.bgColor, 1);
  container.appendChild(renderer.domElement);
  
  // Handle resize
  window.addEventListener('resize', handleResize);
}

/**
 * Create shader material
 */
function createShaderMaterial() {
  const dpr = window.devicePixelRatio || 1;
  material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(
        container.clientWidth * dpr,
        container.clientHeight * dpr
      ) },
      audioLow: { value: 0 },
      audioMid: { value: 0 },
      audioHigh: { value: 0 },
      threshold: { value: params.threshold },
      glowIntensity: { value: params.glow },
      baseSize: { value: params.baseSize },
      ballCount: { value: params.ballCount },
      color1: { value: hexToColor(params.color1) },
      color2: { value: hexToColor(params.color2) },
      bgColor: { value: hexToColor(params.bgColor) }
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending
  });
}

/**
 * Create mesh
 */
function createMesh() {
  const geometry = new THREE.PlaneGeometry(2, 2);
  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
}

/**
 * Convert hex color to THREE.Color
 */
function hexToColor(hex) {
  return new THREE.Color(hex);
}

/**
 * Get audio data with smoothing
 */
function getAudioData() {
  if (!audioData) {
    return lastAudio;
  }
  
  try {
    const fftData = audioData.getFFTData ? audioData.getFFTData() : null;
    
    if (!fftData || fftData.length === 0) {
      return lastAudio;
    }
    
    const third = Math.max(1, Math.floor(fftData.length / 3));
    let low = 0, mid = 0, high = 0;
    
    // Sum low frequencies
    for (let i = 0; i < third; i++) {
      low += fftData[i];
    }
    
    // Sum mid frequencies
    for (let i = third; i < third * 2; i++) {
      mid += fftData[i];
    }
    
    // Sum high frequencies
    for (let i = third * 2; i < fftData.length; i++) {
      high += fftData[i];
    }
    
    // Normalize (0-255 range)
    low  = Math.min(1, low / (third * 255));
    mid  = Math.min(1, mid / (third * 255));
    high = Math.min(1, high / ((fftData.length - third * 2) * 255));
    
    // Smooth audio data to prevent jitter
    const alpha = 0.5;
    lastAudio.low  = lastAudio.low  * alpha + low  * (1 - alpha);
    lastAudio.mid  = lastAudio.mid  * alpha + mid  * (1 - alpha);
    lastAudio.high = lastAudio.high * alpha + high * (1 - alpha);
  } catch (e) {
    console.warn('Error getting audio data:', e);
  }
  
  return lastAudio;
}

/**
 * Start the module
 */
export function start() {
  animate();
}

/**
 * Stop the module
 */
export function stop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

/**
 * Destroy the module and clean up resources
 */
export function destroy() {
  stop();
  
  window.removeEventListener('message', handleWindowMessage);
  window.removeEventListener('resize', handleResize);
  
  if (controlsChannel) {
    controlsChannel.close();
  }
  
  // Dispose Three.js resources
  if (mesh) {
    mesh.geometry.dispose();
    mesh.material.dispose();
    scene.remove(mesh);
    mesh = null;
  }
  
  if (material) {
    material.dispose();
    material = null;
  }
  
  if (renderer) {
    renderer.dispose();
    if (container && renderer.domElement) {
      container.removeChild(renderer.domElement);
    }
  }
  
  scene = null;
  camera = null;
  renderer = null;
  container = null;
  audioData = null;
  controlsChannel = null;
}

/**
 * Update module parameters
 * @param {Object} newParams - New parameter values
 */
export function updateParams(newParams) {
  Object.assign(params, newParams);
  
  if (!material) return;
  
  // Update material uniforms
  if (newParams.threshold !== undefined) {
    material.uniforms.threshold.value = params.threshold;
  }
  if (newParams.glow !== undefined) {
    material.uniforms.glowIntensity.value = params.glow;
  }
  if (newParams.baseSize !== undefined) {
    material.uniforms.baseSize.value = params.baseSize;
  }
  if (newParams.ballCount !== undefined) {
    material.uniforms.ballCount.value = Math.floor(params.ballCount);
  }
  if (newParams.color1 !== undefined) {
    material.uniforms.color1.value = hexToColor(params.color1);
  }
  if (newParams.color2 !== undefined) {
    material.uniforms.color2.value = hexToColor(params.color2);
  }
  if (newParams.bgColor !== undefined) {
    material.uniforms.bgColor.value = hexToColor(params.bgColor);
    if (container) {
      container.style.backgroundColor = params.bgColor;
    }
    if (renderer) {
      renderer.setClearColor(params.bgColor, 1);
    }
  }
}

/**
 * Animation loop
 */
function animate(now = 0) {
  animationId = requestAnimationFrame(animate);
  
  const dt = (now - lastTime) / 1000 || 0;
  lastTime = now;
  
  const audio = getAudioData();
  
  if (material) {
    material.uniforms.time.value += dt * params.speed;
    material.uniforms.audioLow.value  = audio.low  * params.lowSens  * params.masterAudioGain;
    material.uniforms.audioMid.value  = audio.mid  * params.midSens  * params.masterAudioGain;
    material.uniforms.audioHigh.value = audio.high * params.highSens * params.masterAudioGain;
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Handle window resize
 */
function handleResize() {
  if (!container || !renderer || !material) return;
  
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(dpr);
  renderer.setSize(container.clientWidth, container.clientHeight);
  material.uniforms.resolution.value.set(
    container.clientWidth * dpr,
    container.clientHeight * dpr
  );
}

/**
 * Handle control messages
 */
function handleControlMessage(event) {
  if (event.data.type === 'PARAM_CHANGE') {
    const { param, value } = event.data;
    updateParams({ [param]: value });
  }
}

/**
 * Handle window messages (from shell)
 */
function handleWindowMessage(event) {
  if (event.data.type === 'PARAM_CHANGE') {
    const { param, value } = event.data;
    updateParams({ [param]: value });
  } else if (event.data.type === 'AUDIO_UPDATE') {
    // Audio updates handled in animate loop via audioData API
  }
}

// Expose module API to window (for loader.js)
// This must be at the end after all functions are defined
if (typeof window !== 'undefined') {
  window.moduleAPI = {
    initModule,
    start,
    stop,
    destroy,
    updateParams
  };
}

