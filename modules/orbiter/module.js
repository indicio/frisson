/**
 * Orbiter Module
 * 3D particle system with audio-reactive emitters orbiting in 3D space
 */

import * as THREE from '../../shared/libs/three-r161/three.module.js';
import { OrbitControls } from '../../shared/libs/three-r161/OrbitControls.js';

let scene = null;
let camera = null;
let renderer = null;
let container = null;
let controls = null;
let audioData = null;
let controlsChannel = null;
let animationId = null;
let frameCount = 0;
let t = 0;
let lastFrameTime = 0;

// Visualization state
let rotationMode = 'auto';
let autoOrbitAngle = 0;
let audioOrbitAngle = 0;
let lastAudioOrbitAngle = 0;
let circleMode = "static";
let particleShape = "sphere";
let emitterShape = 'sphere';

// Parameters
let params = {
  particleSize: 0.25,
  decayRate: 0.022,
  lineLen: 0.7,
  lineOri: "along",
  circleRadius: 7,
  audioCircleRadius: 7,
  rotSpeed: 0.24,
  sensitivity: 0.18,
  particleRate: 2,
  freqMin: 0.08,
  freqMax: 0.78,
  currentTheme: 'spectrum',
  backgroundColor: '#000000'
};

let numEmitters = 128;
let emitters = [];
let particles = [];

/**
 * Convert a visible-light wavelength (380–700 nm) to an RGB THREE.Color.
 * Uses Dan Bruton's piecewise-linear approximation with intensity fall-off
 * at the edges of human perception.
 */
function wavelengthToColor(wavelength) {
  let r, g, b;

  if (wavelength >= 380 && wavelength < 440) {
    r = -(wavelength - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (wavelength >= 440 && wavelength < 490) {
    r = 0;
    g = (wavelength - 440) / (490 - 440);
    b = 1;
  } else if (wavelength >= 490 && wavelength < 510) {
    r = 0;
    g = 1;
    b = -(wavelength - 510) / (510 - 490);
  } else if (wavelength >= 510 && wavelength < 580) {
    r = (wavelength - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (wavelength >= 580 && wavelength < 645) {
    r = 1;
    g = -(wavelength - 645) / (645 - 580);
    b = 0;
  } else if (wavelength >= 645 && wavelength <= 700) {
    r = 1;
    g = 0;
    b = 0;
  } else {
    r = 0; g = 0; b = 0;
  }

  // Intensity fall-off near the edges of human perception
  let intensity;
  if (wavelength >= 380 && wavelength < 420) {
    intensity = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
  } else if (wavelength >= 420 && wavelength <= 645) {
    intensity = 1.0;
  } else if (wavelength > 645 && wavelength <= 700) {
    intensity = 0.3 + 0.7 * (700 - wavelength) / (700 - 645);
  } else {
    intensity = 0;
  }

  return new THREE.Color(r * intensity, g * intensity, b * intensity);
}

// Color theme functions
const themeFunctions = {
  spectrum: (i, t, n) => {
    // Map emitter index across the full visible spectrum (380–700 nm)
    // with slow time-based cycling so the colors drift
    const offset = (t * 0.05) % 1;
    const pos = ((i / n) + offset) % 1;
    const wavelength = 380 + pos * (700 - 380);
    return wavelengthToColor(wavelength);
  },
  rainbow: (i, t, n) => new THREE.Color().setHSL((((i/n)+t*0.18)%1), 1, 0.5),
  neon: (i, t, n) => {
    const c = new THREE.Color();
    let h = (((i/n)+t*0.24) % 1);
    c.setHSL(h, 1, 0.7);
    return c;
  },
  ice: (i, t, n) => {
    let l = 0.65+0.08*Math.sin(t*2+i*0.21);
    return new THREE.Color().setHSL(0.58+0.04*Math.sin(i*0.2 + t*0.7), 0.4+0.5*Math.abs(Math.cos(t+i*0.09)), l);
  },
  fire: (i, t, n) => {
    return new THREE.Color().setHSL(0.04+0.04*Math.sin(i*.15+t*2), 1, 0.53+0.25*Math.abs(Math.sin(i*0.06+t)));
  },
  cosmic: (i, t, n) => {
    let h = 0.78+0.15*Math.sin(t+i*0.13);
    let s = 0.38+0.58*Math.abs(Math.cos(t*1.1+i*0.07));
    let l = 0.40+0.27*Math.abs(Math.cos(i*0.13+t*0.9));
    return new THREE.Color().setHSL(h%1, s, l);
  }
};

/**
 * Initialize the module
 */
export async function initModule({ container: containerElement, audio, controlsChannel: channel }) {
  container = containerElement;
  audioData = audio;
  controlsChannel = channel;
  
  if (controlsChannel) {
    controlsChannel.onmessage = handleControlMessage;
  }
  
  window.addEventListener('message', handleWindowMessage);
  window.addEventListener('resize', handleResize);
  
  initScene();
  recreateEmitters();
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

/**
 * Initialize Three.js scene
 */
function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(params.backgroundColor);
  
  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(74, aspect, 0.1, 1000);
  camera.position.set(0, 7, 29);
  camera.lookAt(0, 0, 0);
  
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = true;
  controls.enabled = false;
  controls.target.set(0, 0, 0);
  controls.update();
}

/**
 * Get emitter positions based on shape
 */
function getEmitterPositions(shape, count, radius) {
  let positions = [];
  if (shape === 'circle') {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      positions.push({x, y, z:0, baseAngle: angle});
    }
  } else if (shape === 'cube') {
    let grid = Math.ceil(Math.pow(count/6,0.5));
    if(grid < 1) grid = 1;
    let faceSpacing = 2*radius / (grid-1||1);
    let placed = 0;
    for (let face=0;face<6&&placed<count;face++) {
      let fixedAxis = Math.floor(face/2), sign = (face%2)*2-1;
      for (let i=0;i<grid&&placed<count;i++) {
        for (let j=0;j<grid&&placed<count;j++) {
          let pos = [0,0,0];
          if (fixedAxis === 0) {
            pos[0] = sign*radius;
            pos[1] = -radius + i*faceSpacing;
            pos[2] = -radius + j*faceSpacing;
          } else if (fixedAxis === 1) {
            pos[1] = sign*radius;
            pos[0] = -radius + i*faceSpacing;
            pos[2] = -radius + j*faceSpacing;
          } else {
            pos[2] = sign*radius;
            pos[0] = -radius + i*faceSpacing;
            pos[1] = -radius + j*faceSpacing;
          }
          positions.push({x: pos[0], y: pos[1], z: pos[2], baseAngle: Math.atan2(pos[1], pos[0])});
          placed += 1;
        }
      }
    }
  } else if (shape === 'sphere') {
    let offset = 2/ count;
    let increment = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      let y = ((i * offset) -1) + (offset/2);
      let r = Math.sqrt(1 - y * y);
      let phi = i * increment;
      let x = Math.cos(phi)*r;
      let z = Math.sin(phi)*r;
      positions.push({x: x*radius, y: y*radius, z: z*radius, baseAngle: Math.atan2(y, x)});
    }
  }
  return positions;
}

/**
 * Get animated emitter position
 */
function getAnimatedEmitterPos(emitter, index, currentTime) {
  const time = currentTime !== undefined ? currentTime : Date.now() * 0.001;
  const baseAngle = emitter.baseAngle || 0;
  const angle = baseAngle + time * params.rotSpeed;
  const radius = circleMode === "audio-size" ? params.audioCircleRadius : params.circleRadius;
  
  if (emitterShape === 'circle') {
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: 0
    };
  } else {
    // Rotate the base position around the Y axis so sphere/cube emitters orbit
    const base = emitter.basePos || { x: 0, y: 0, z: 0 };
    const rotAngle = time * params.rotSpeed;
    const cos = Math.cos(rotAngle);
    const sin = Math.sin(rotAngle);
    // Scale base positions to current radius
    const scale = radius / (params.circleRadius || 7);
    const bx = base.x * scale;
    const by = base.y * scale;
    const bz = base.z * scale;
    return {
      x: bx * cos - bz * sin,
      y: by,
      z: bx * sin + bz * cos
    };
  }
}

/**
 * Recreate emitters
 */
function recreateEmitters() {
  // Remove old emitters
  emitters.forEach(emitter => {
    scene.remove(emitter.mesh);
    emitter.mesh.geometry.dispose();
    emitter.mesh.material.dispose();
  });
  emitters = [];
  
  const preferredCounts = {
    circle: 128,
    cube: 54,
    sphere: 128
  };
  numEmitters = preferredCounts[emitterShape] || 64;
  
  const positions = getEmitterPositions(emitterShape, numEmitters, params.circleRadius);
  
  for (let i = 0; i < numEmitters; i++) {
    const pos = positions[i];
    const geometry = new THREE.SphereGeometry(0.22, 7, 7);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0
    });
    const emitter = new THREE.Mesh(geometry, material);
    emitter.position.set(pos.x, pos.y, pos.z);
    scene.add(emitter);
    emitters.push({
      mesh: emitter,
      baseAngle: pos.baseAngle !== undefined ? pos.baseAngle : Math.atan2(pos.y, pos.x),
      basePos: { ...pos }
    });
  }
}

/**
 * Particle class
 */
class Particle {
  constructor(position, direction, color, amplitude) {
    this.life = 1.0;
    this.decay = params.decayRate;
    this.direction = direction.clone();
    this.particleShape = particleShape;
    this.mesh = null;
    this.material = null;
    this.themeColor = color.clone();
    this.velocity = direction.clone().multiplyScalar(amplitude * 0.57 + 0.11);
    
    if (particleShape === "sphere") {
      const geometry = new THREE.SphereGeometry(params.particleSize, 6, 6);
      this.material = new THREE.MeshBasicMaterial({ 
        color: color.clone(),
        transparent: true,
        opacity: 1
      });
      this.mesh = new THREE.Mesh(geometry, this.material);
      this.mesh.position.copy(position);
      scene.add(this.mesh);
    } else if (particleShape === "square") {
      const geometry = new THREE.BoxGeometry(params.particleSize*1.6, params.particleSize*1.6, params.particleSize*1.6);
      this.material = new THREE.MeshBasicMaterial({
        color: color.clone(),
        transparent: true,
        opacity: 1
      });
      this.mesh = new THREE.Mesh(geometry, this.material);
      this.mesh.position.copy(position);
      scene.add(this.mesh);
    } else if (particleShape === "line") {
      let v = direction.clone().normalize();
      let localLineLen = params.lineLen * (0.7 + amplitude * 1.6);
      let start = new THREE.Vector3().copy(position);
      let end = new THREE.Vector3();
      if (params.lineOri === "along") {
        end.copy(position).add(v.clone().multiplyScalar(localLineLen));
      } else if (params.lineOri === "fixed-x") {
        end.copy(position).add(new THREE.Vector3(1,0,0).multiplyScalar(localLineLen));
      } else if (params.lineOri === "fixed-y") {
        end.copy(position).add(new THREE.Vector3(0,1,0).multiplyScalar(localLineLen));
      } else {
        end.copy(position).add(new THREE.Vector3(0,0,1).multiplyScalar(localLineLen));
      }
      const points = [start, end];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.material = new THREE.LineBasicMaterial({
        color: color.clone(),
        transparent: true,
        opacity: 1
      });
      this.mesh = new THREE.Line(geometry, this.material);
      this._lineStart = start.clone();
      this._lineEnd = end.clone();
      this._lineVec = end.clone().sub(start);
      scene.add(this.mesh);
    }
  }
  
  update(currColor, deltaTime = 0.016) {
    // Frame-rate independent decay
    this.life -= this.decay * deltaTime * 60; // Scale to maintain similar decay rate
    
    if (currColor) {
      if (this.particleShape === "line") {
        this.material.color.copy(currColor);
      } else {
        this.mesh.material.color.copy(currColor);
      }
      this.themeColor.copy(currColor);
    }
    
    if (this.particleShape === "sphere" || this.particleShape === "square") {
      this.mesh.material.opacity = this.life;
      // Frame-rate independent movement
      const velocityDelta = this.velocity.clone().multiplyScalar(deltaTime * 60); // Scale to maintain similar speed
      this.mesh.position.add(velocityDelta);
      this.mesh.scale.setScalar(this.life);
    } else if (this.particleShape === "line") {
      this.material.opacity = this.life;
      let d = this._lineVec.clone().normalize();
      // Frame-rate independent movement
      const velocityDelta = this.velocity.clone().multiplyScalar(deltaTime * 60); // Scale to maintain similar speed
      this._lineStart.add(velocityDelta);
      this._lineEnd = this._lineStart.clone().add(d.clone().multiplyScalar(this._lineVec.length()));
      this.mesh.geometry.setFromPoints([this._lineStart, this._lineEnd]);
    }
    
    return this.life > 0;
  }
  
  destroy() {
    scene.remove(this.mesh);
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}

/**
 * Start the module
 */
export function start() {
  lastFrameTime = 0; // Reset frame time tracking
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
 * Destroy the module
 */
export function destroy() {
  stop();
  
  window.removeEventListener('message', handleWindowMessage);
  window.removeEventListener('resize', handleResize);
  
  if (controlsChannel) {
    controlsChannel.close();
  }
  
  // Clean up particles
  particles.forEach(p => p.destroy());
  particles = [];
  
  // Clean up emitters
  emitters.forEach(emitter => {
    scene.remove(emitter.mesh);
    emitter.mesh.geometry.dispose();
    emitter.mesh.material.dispose();
  });
  emitters = [];
  
  if (renderer) {
    renderer.dispose();
    if (container && renderer.domElement) {
      container.removeChild(renderer.domElement);
    }
  }
  
  scene = null;
  camera = null;
  renderer = null;
  controls = null;
  container = null;
  audioData = null;
  controlsChannel = null;
}

/**
 * Update parameters
 */
export function updateParams(newParams) {
  Object.assign(params, newParams);
  
  if (newParams.emitterShape !== undefined && newParams.emitterShape !== emitterShape) {
    emitterShape = newParams.emitterShape;
    recreateEmitters();
  }
  
  if (newParams.particleShape !== undefined && newParams.particleShape !== particleShape) {
    particleShape = newParams.particleShape;
  }
  
  if (newParams.rotationMode !== undefined) {
    rotationMode = newParams.rotationMode;
    if (controls) {
      controls.enabled = rotationMode === 'manual';
    }
  }
  
  if (newParams.circleMode !== undefined) {
    circleMode = newParams.circleMode;
  }
  
  if (scene && newParams.backgroundColor !== undefined) {
    scene.background = new THREE.Color(params.backgroundColor);
  }
}

/**
 * Animation loop
 */
function animate(now = 0) {
  animationId = requestAnimationFrame(animate);
  
  // Calculate delta time in seconds (frame-rate independent)
  const deltaTime = lastFrameTime === 0 ? 0.016 : (now - lastFrameTime) * 0.001;
  lastFrameTime = now;
  
  // Clamp delta time to prevent large jumps (e.g., tab switching returns)
  const clampedDelta = Math.min(deltaTime, 0.1);
  
  t = now * 0.001;
  frameCount++;
  
  // Update camera rotation (frame-rate independent)
  // Original was rotSpeed * 0.01 per frame = rotSpeed * 0.6 per second at 60fps
  if (rotationMode === 'auto') {
    autoOrbitAngle += params.rotSpeed * 0.6 * clampedDelta;
    camera.position.x = Math.cos(autoOrbitAngle) * 29;
    camera.position.z = Math.sin(autoOrbitAngle) * 29;
    camera.position.y = 7;
    camera.lookAt(0, 0, 0);
  } else if (rotationMode === 'audio-orbit' && audioData) {
    try {
      const audioLevel = audioData.getAudioLevel ? audioData.getAudioLevel() : 0;
      // Original was (audioLevel * 0.02 + rotSpeed * 0.005) per frame = 60x per second
      audioOrbitAngle += (audioLevel * 1.2 + params.rotSpeed * 0.3) * clampedDelta;
      camera.position.x = Math.cos(audioOrbitAngle) * 29;
      camera.position.z = Math.sin(audioOrbitAngle) * 29;
      camera.position.y = 7;
      camera.lookAt(0, 0, 0);
    } catch (e) {
      // Fallback to auto
      autoOrbitAngle += params.rotSpeed * 0.6 * clampedDelta;
    }
  }
  
  if (controls) {
    controls.update();
  }
  
  // Update audio circle radius
  if (circleMode === "audio-size" && audioData) {
    try {
      const audioLevel = audioData.getAudioLevel ? audioData.getAudioLevel() : 0;
      params.audioCircleRadius = params.circleRadius * (1 + audioLevel * 0.5);
    } catch (e) {
      params.audioCircleRadius = params.circleRadius;
    }
  } else {
    params.audioCircleRadius = params.circleRadius;
  }
  
  // Update emitters and create particles
  let avgAmplitude = 0;
  if (audioData) {
    try {
      const fftData = audioData.getFFTData ? audioData.getFFTData() : null;
      
      if (fftData && fftData.length > 0) {
        for (let i = 0; i < numEmitters; i++) {
          const emitter = emitters[i];
          let {x, y, z} = getAnimatedEmitterPos(emitter, i, t);
          emitter.mesh.position.set(x, y, z);
          emitter.mesh.visible = false;
          
          // Audio mapping
          const freqPosition = params.freqMin + (i / numEmitters) * (params.freqMax - params.freqMin);
          const dataIndex = Math.floor(freqPosition * fftData.length);
          const amplitude = fftData[dataIndex] / 255;
          avgAmplitude += amplitude;
          
          const normal = new THREE.Vector3(x, y, z).normalize();
          const currColor = themeFunctions[params.currentTheme](i, t, numEmitters);
          
          if (amplitude > params.sensitivity && frameCount % params.particleRate === 0) {
            const particle = new Particle(
              emitter.mesh.position,
              normal,
              currColor,
              amplitude
            );
            particle.themeIndex = i;
            particles.push(particle);
          }
        }
        
        avgAmplitude /= numEmitters;
      }
    } catch (e) {
      console.warn('Error getting audio data:', e);
    }
  } else {
    // No audio - just update emitter positions
    for (let i = 0; i < numEmitters; i++) {
      const emitter = emitters[i];
      let {x, y, z} = getAnimatedEmitterPos(emitter, i, t);
      emitter.mesh.position.set(x, y, z);
      emitter.mesh.visible = false;
    }
  }
  
  // Animate particles (pass delta time for frame-rate independence)
  for (let i = particles.length - 1; i >= 0; i--) {
    const pIndex = typeof particles[i].themeIndex === "number" ? particles[i].themeIndex : (i % numEmitters);
    const themeColor = themeFunctions[params.currentTheme](pIndex, t, numEmitters);
    if (!particles[i].update(themeColor, clampedDelta)) {
      particles[i].destroy();
      particles.splice(i, 1);
    }
  }
  
  renderer.render(scene, camera);
}

/**
 * Handle resize
 */
function handleResize() {
  if (!container || !camera || !renderer) return;
  
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  
  if (controls && controls.handleResize) {
    controls.handleResize();
  }
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
 * Handle window messages
 */
function handleWindowMessage(event) {
  if (event.data.type === 'PARAM_CHANGE') {
    const { param, value } = event.data;
    updateParams({ [param]: value });
  }
}

