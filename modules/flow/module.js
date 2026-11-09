/**
 * Flow Module
 * Audio-reactive particle fluid visualization with swirling vortices
 */

// ===== Core Three.js =====
let scene, camera, renderer, points, geometry, material;
let vignetteEl;

// Viewport metrics (cached)
let aspect = window.innerWidth / window.innerHeight;
let halfW = aspect;
let halfH = 1;

// Pointer stirring
const pointer = { x: 0, y: 0, active: false };

// Particle system with subparticles for visual density
let PARTICLE_COUNT = 30000; // Simulated particles (configurable)
let SUBPARTICLES_PER_PARTICLE = 0; // Visual subparticles per simulated particle (configurable)
let TOTAL_VISUAL_PARTICLES = PARTICLE_COUNT * (1 + SUBPARTICLES_PER_PARTICLE);
let positions, velocities, colors;
let visualPositions, visualColors; // For rendering with subparticles

// Multiple swirl centers
const SWIRL_CENTERS = [
  { x: 0.5,  y: 0.3,  vx: 0.15,  vy: 0.12,  radius: 0.4 },
  { x: -0.4, y: -0.2, vx: -0.18, vy: 0.15, radius: 0.35 },
  { x: 0.2,  y: -0.5, vx: 0.12,  vy: -0.14, radius: 0.38 }
];

// Audio (provided by loader)
let audioAPI = null;
let audioLevel = 0;
let bassLevel = 0;
let trebleLevel = 0;

// Beat-ish detection
let audioAccumulator = 0;
let audioSamples = 0;
let audioTrend = 0;
let beat = 0;

// Time
let lastTime = performance.now() / 1000;
let animationId = null;

// Automation timers
let autoExplodeTimer = null;
let autoRandomizeTimer = null;
let lastExplodeTime = 0;
let lastRandomizeTime = 0;

// Module state
let container = null;
let controlsChannel = null;

// Config
const config = {
  swirlStrength: 1.8,
  flowSpeed: 1.2,
  turbulence: 1.3,
  particleSize: 2.2,
  brightness: 1.2,
  particleDensity: 80,
  audioInfluence: 1.5,
  particleInteraction: 0.0,
  viscosity: 1.5,
  flowInfluence: 1.0,
  pointerInfluence: 0.0,
  edgeVignette: 0.8, // internal only
  bgColor: '#020309',
  coolColor: '#6fc9ff',
  warmColor: '#ff7aa0',
  autoExplode: false,
  explodeInterval: 10,
  autoRandomize: false,
  randomizeInterval: 15,
  particleCount: 30000,
  subparticleCount: 0
};

// Reused colors
const coolColorObj = new THREE.Color(config.coolColor);
const warmColorObj = new THREE.Color(config.warmColor);

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// ===== Scene Init =====
function initThree() {
  const canvas = document.getElementById('viz');
  if (!canvas) {
    console.error('Flow: Canvas element not found');
    return;
  }
  
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020309);

  aspect = window.innerWidth / window.innerHeight;
  halfW = aspect;
  halfH = 1;

  const camAspect = aspect;
  camera = new THREE.OrthographicCamera(-camAspect, camAspect, 1, -1, -10, 10);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  vignetteEl = document.getElementById('vignette');

  initParticles();

  window.addEventListener('resize', onWindowResize);

  // Pointer stirring
  window.addEventListener('pointermove', (e) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const nx = (e.clientX / w) * 2 - 1;
    const ny = -((e.clientY / h) * 2 - 1);
    pointer.x = nx * halfW;
    pointer.y = ny * halfH;
    pointer.active = true;
  });
  
  // Add renderer to container if provided
  if (container && renderer && renderer.domElement) {
    if (!container.contains(renderer.domElement)) {
      container.appendChild(renderer.domElement);
    }
  }
}

function initParticles() {
  // Remove existing particles if reinitializing
  if (points) {
    scene.remove(points);
    if (geometry) geometry.dispose();
    if (material) material.dispose();
  }

  geometry = new THREE.BufferGeometry();
  
  // Physics simulation arrays (main particles only)
  positions = new Float32Array(PARTICLE_COUNT * 3);
  velocities = new Float32Array(PARTICLE_COUNT * 3);
  colors = new Float32Array(PARTICLE_COUNT * 3);
  
  // Visual rendering arrays (main + subparticles)
  visualPositions = new Float32Array(TOTAL_VISUAL_PARTICLES * 3);
  visualColors = new Float32Array(TOTAL_VISUAL_PARTICLES * 3);

  const halfLocalW = halfW;
  const halfLocalH = halfH;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;

    // Fill the entire viewport uniformly
    positions[i3 + 0] = (Math.random() * 2 - 1) * halfLocalW;
    positions[i3 + 1] = (Math.random() * 2 - 1) * halfLocalH;
    positions[i3 + 2] = (Math.random() * 0.2 - 0.1); // slight depth variance

    velocities[i3 + 0] = (Math.random() * 2 - 1) * 0.02;
    velocities[i3 + 1] = (Math.random() * 2 - 1) * 0.02;
    velocities[i3 + 2] = 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(visualPositions, 3));
  
  // Initialize colors (will be updated dynamically)
  const coolCol = new THREE.Color(config.coolColor);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    colors[i * 3 + 0] = coolCol.r;
    colors[i * 3 + 1] = coolCol.g;
    colors[i * 3 + 2] = coolCol.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(visualColors, 3));

  material = new THREE.PointsMaterial({
    size: config.particleSize,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    sizeAttenuation: true
  });

  points = new THREE.Points(geometry, material);
  scene.add(points);
}

function applyPerformanceSettings() {
  const newParticleCount = parseInt(config.particleCount);
  const newSubparticleCount = parseInt(config.subparticleCount);
  
  // Update globals
  PARTICLE_COUNT = newParticleCount;
  SUBPARTICLES_PER_PARTICLE = newSubparticleCount;
  TOTAL_VISUAL_PARTICLES = PARTICLE_COUNT * (1 + SUBPARTICLES_PER_PARTICLE);
  
  // Reinitialize particle system
  initParticles();
}

// ===== Handle Window Messages =====
function handleWindowMessage(event) {
  if (event.data && event.data.type === 'AUDIO_UPDATE') {
    // Audio updates handled in animate loop via audioAPI
  } else if (event.data && event.data.type === 'PARAM_CHANGE') {
    handleParamChange(event.data.param, event.data.value);
  }
}

// ===== Handle Control Messages =====
function handleControlMessage(event) {
  if (event.data && event.data.type === 'PARAM_CHANGE') {
    handleParamChange(event.data.param, event.data.value);
  }
}

// ===== Handle Parameter Changes =====
function handleParamChange(param, value) {
  // Handle special actions
  if (param === 'triggerExplode') {
    triggerExplode();
    return;
  }
  if (param === 'triggerRandomize') {
    triggerRandomize();
    return;
  }
  if (param === 'applyPerformance') {
    applyPerformanceSettings();
    return;
  }
  
  if (config.hasOwnProperty(param)) {
    config[param] = value;
    
    // Handle special cases
    if (param === 'bgColor' && scene) {
      scene.background = new THREE.Color(value);
    }
    if (param === 'coolColor') {
      coolColorObj.set(value);
    }
    if (param === 'warmColor') {
      warmColorObj.set(value);
    }
    if (param === 'particleCount' || param === 'subparticleCount') {
      // These require reinitialization, handled by apply button
    }
  }
}

// ===== Update Swirl Centers =====
function updateSwirlCenters(dt) {
  const halfLocalW = halfW;
  const halfLocalH = halfH;

  for (let center of SWIRL_CENTERS) {
    // Drift the centers
    center.x += center.vx * dt;
    center.y += center.vy * dt;

    // Bounce off viewport edges
    if (center.x > halfLocalW * 0.8 || center.x < -halfLocalW * 0.8) {
      center.vx *= -1;
      center.x = clamp(center.x, -halfLocalW * 0.8, halfLocalW * 0.8);
    }
    if (center.y > halfLocalH * 0.8 || center.y < -halfLocalH * 0.8) {
      center.vy *= -1;
      center.y = clamp(center.y, -halfLocalH * 0.8, halfLocalH * 0.8);
    }

    // Slight perturbation from audio
    const audioNudge = audioLevel * 0.02;
    center.vx += (Math.random() * 2 - 1) * audioNudge;
    center.vy += (Math.random() * 2 - 1) * audioNudge;

    // Dampen velocity
    center.vx = clamp(center.vx, -0.3, 0.3);
    center.vy = clamp(center.vy, -0.3, 0.3);
  }
}

// ===== Vector Field (Multiple swirl centers + pointer + modes + motion) =====
function getFieldVelocity(x, y, time) {
  const halfLocalW = halfW;
  const halfLocalH = halfH;

  // Normalize coordinates to [-1,1]
  const nx = x / halfLocalW;
  const ny = y / halfLocalH;

  const t = time * config.flowSpeed;
  const beatBoost = 1 + beat * 0.8;

  const turb = config.turbulence * beatBoost;

  let totalSwirlX = 0;
  let totalSwirlY = 0;

  // Combine influence from all swirl centers
  for (let center of SWIRL_CENTERS) {
    const dx = x - center.x;
    const dy = y - center.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq) + 0.001;

    // Influence falls off with distance
    const influenceRadius = center.radius * (1.5 + audioLevel * 0.5);
    const influence = Math.exp(-distSq / (influenceRadius * influenceRadius));

    // Swirl around this center (perpendicular to radial direction)
    const swirlBase = config.swirlStrength * (0.8 + 0.6 * audioLevel);
    const swirlX = -dy / dist * swirlBase * influence * 1.5;
    const swirlY = dx / dist * swirlBase * influence * 1.5;

    totalSwirlX += swirlX;
    totalSwirlY += swirlY;
  }

  // Base turbulence waves
  let wave1X = Math.sin(nx * 2.5 + ny * 1.8 + t * 0.5) * Math.cos(ny * 1.3 - t * 0.3);
  let wave1Y = Math.cos(ny * 2.2 - nx * 1.5 + t * 0.6) * Math.sin(nx * 1.4 + t * 0.4);
  
  let wave2X = Math.sin(nx * 4.2 - ny * 3.1 + t * 0.7) * 0.5;
  let wave2Y = Math.cos(ny * 3.8 + nx * 2.9 - t * 0.8) * 0.5;

  // Mode multipliers and extras
  let swirlMul = 1.0;
  let noiseMul = 1.0;
  let flowMul = 1.0;
  let curlMul = 1.0;
  let modeVX = 0.0;
  let modeVY = 0.0;

  // Large-scale flow patterns
  const flowX = Math.sin(nx * 1.2 + t * 0.3) * Math.cos(ny * 0.8);
  const flowY = Math.cos(ny * 1.5 - t * 0.25) * Math.sin(nx * 0.9);

  let noiseX = (wave1X + wave2X + flowX * 0.7) * 0.5 * noiseMul;
  let noiseY = (wave1Y + wave2Y + flowY * 0.7) * 0.5 * noiseMul;

  // Add curl (rotation) for more swirling effect
  const curlX = -noiseY * 0.8 * curlMul;
  const curlY = noiseX * 0.8 * curlMul;

  // Start with center-driven swirl + turbulence
  let vx = (totalSwirlX * swirlMul + (noiseX + curlX) * turb * flowMul) * 0.5;
  let vy = (totalSwirlY * swirlMul + (noiseY + curlY) * turb * flowMul) * 0.5;

  // Optional pointer stirring as an extra swirl center
  if (config.pointerInfluence > 0 && pointer.active) {
    const dxp = x - pointer.x;
    const dyp = y - pointer.y;
    const distSqP = dxp * dxp + dyp * dyp;
    const distP = Math.sqrt(distSqP) + 0.001;

    const influenceRadiusP = 0.6;
    const influenceP = Math.exp(-distSqP / (influenceRadiusP * influenceRadiusP));

    const swirlBaseP = config.pointerInfluence * (0.5 + audioLevel);
    const swirlPX = -dyp / distP * swirlBaseP * influenceP;
    const swirlPY = dxp / distP * swirlBaseP * influenceP;

    vx += swirlPX;
    vy += swirlPY;
  }

  return { vx, vy };
}

// ===== Particle Simulation =====
function updateParticles(dt, time) {
  if (!positions || !velocities) return;

  const halfLocalW = halfW;
  const halfLocalH = halfH;

  // More viscous, oil-like drag
  const dragBase = 0.96;
  const dragTreble = trebleLevel * 0.04;

  // Particle density control - determine how many particles are active
  const activeParticleCount = Math.floor(PARTICLE_COUNT * (config.particleDensity / 100));

  // Particle interaction and viscosity system
  const interactionRadius = 0.12;
  const viscosityStrength = 0.01 * config.viscosity;
  const interactionStrength = config.particleInteraction;

  for (let i = 0; i < activeParticleCount; i++) {
    const i3 = i * 3;

    let x = positions[i3 + 0];
    let y = positions[i3 + 1];

    let avgVx = 0;
    let avgVy = 0;
    let interactX = 0;
    let interactY = 0;
    let neighborCount = 0;

    // Sample nearby particles for interactions (scaled lightly with density)
    const baseSamples = 8;
    const extraSamples = 6;
    const densityFactor = config.particleDensity / 100;
    const sampleCount = Math.floor(baseSamples + extraSamples * densityFactor);

    for (let s = 0; s < sampleCount; s++) {
      const j = Math.floor(Math.random() * activeParticleCount);
      if (j === i) continue;

      const j3 = j * 3;
      const dx = x - positions[j3 + 0];
      const dy = y - positions[j3 + 1];
      const distSq = dx * dx + dy * dy;

      if (distSq > 0 && distSq < interactionRadius * interactionRadius) {
        const dist = Math.sqrt(distSq);
        
        // Viscosity: match velocities of nearby particles
        avgVx += velocities[j3 + 0];
        avgVy += velocities[j3 + 1];

        // Particle interaction: attraction (negative) or repulsion (positive)
        if (interactionStrength !== 0) {
          const force = Math.abs(interactionStrength) * 0.00015 / (distSq + 0.001);
          if (interactionStrength < 0) {
            // Attraction: pull toward other particles
            interactX -= (dx / dist) * force;
            interactY -= (dy / dist) * force;
          } else {
            // Repulsion: push away from other particles
            interactX += (dx / dist) * force;
            interactY += (dy / dist) * force;
          }
        }

        neighborCount++;
      }
    }

    if (neighborCount > 0) {
      avgVx /= neighborCount;
      avgVy /= neighborCount;
      
      // Apply viscosity: velocity matching
      velocities[i3 + 0] += (avgVx - velocities[i3 + 0]) * viscosityStrength;
      velocities[i3 + 1] += (avgVy - velocities[i3 + 1]) * viscosityStrength;

      // Apply interaction forces
      velocities[i3 + 0] += interactX;
      velocities[i3 + 1] += interactY;
    }
  }

  for (let i = 0; i < activeParticleCount; i++) {
    const i3 = i * 3;

    let x = positions[i3 + 0];
    let y = positions[i3 + 1];
    let z = positions[i3 + 2];

    let vx = velocities[i3 + 0];
    let vy = velocities[i3 + 1];
    let vz = velocities[i3 + 2];

    const field = getFieldVelocity(x, y, time);
    const audioAmp = 1 + audioLevel * config.audioInfluence;
    const flowAmp = config.flowInfluence;

    vx += field.vx * dt * audioAmp * flowAmp;
    vy += field.vy * dt * audioAmp * flowAmp;

    const drag = dragBase - dragTreble;
    vx *= drag;
    vy *= drag;
    vz *= drag;

    x += vx * dt;
    y += vy * dt;
    // z only used for slight parallax; keep it small
    z = clamp(z, -0.5, 0.5);

    // Constrain to viewport bounds, reflect slightly
    const wallDamp = 0.7;

    if (x > halfLocalW) {
      x = halfLocalW;
      vx *= -wallDamp;
    } else if (x < -halfLocalW) {
      x = -halfLocalW;
      vx *= -wallDamp;
    }

    if (y > halfLocalH) {
      y = halfLocalH;
      vy *= -wallDamp;
    } else if (y < -halfLocalH) {
      y = -halfLocalH;
      vy *= -wallDamp;
    }

    positions[i3 + 0] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    velocities[i3 + 0] = vx;
    velocities[i3 + 1] = vy;
    velocities[i3 + 2] = vz;
  }

  // Color dispersion by density
  coolColorObj.set(config.coolColor);
  warmColorObj.set(config.warmColor);
  const densityCheckRadius = 0.15;
  const densityCheckSamples = 8;

  for (let i = 0; i < activeParticleCount; i++) {
    const i3 = i * 3;
    const x = positions[i3 + 0];
    const y = positions[i3 + 1];

    // Count nearby particles to estimate local density
    let nearbyCount = 0;
    for (let s = 0; s < densityCheckSamples; s++) {
      const j = Math.floor(Math.random() * activeParticleCount);
      if (j === i) continue;
      
      const j3 = j * 3;
      const dx = x - positions[j3 + 0];
      const dy = y - positions[j3 + 1];
      const distSq = dx * dx + dy * dy;
      
      if (distSq < densityCheckRadius * densityCheckRadius) {
        nearbyCount++;
      }
    }

    // Map density to color (more neighbors = warmer, fewer = cooler)
    const densityFactor = Math.min(nearbyCount / (densityCheckSamples * 0.5), 1.0);
    const bassMix = bassLevel * 0.5;
    const finalMix = clamp(densityFactor * 0.7 + bassMix, 0, 1);

    const r = coolColorObj.r + (warmColorObj.r - coolColorObj.r) * finalMix;
    const g = coolColorObj.g + (warmColorObj.g - coolColorObj.g) * finalMix;
    const b = coolColorObj.b + (warmColorObj.b - coolColorObj.b) * finalMix;

    colors[i3 + 0] = r;
    colors[i3 + 1] = g;
    colors[i3 + 2] = b;
  }

  // Update visual buffers with main particles + subparticles
  const activeVisualCount = activeParticleCount * (1 + SUBPARTICLES_PER_PARTICLE);
  const subOffset = 0.03; // How far subparticles offset from parent
  
  for (let i = 0; i < activeParticleCount; i++) {
    const i3 = i * 3;
    const parentX = positions[i3 + 0];
    const parentY = positions[i3 + 1];
    const parentZ = positions[i3 + 2];
    const parentR = colors[i3 + 0];
    const parentG = colors[i3 + 1];
    const parentB = colors[i3 + 2];
    
    // Main particle
    const mainIdx = i * (1 + SUBPARTICLES_PER_PARTICLE);
    const mainIdx3 = mainIdx * 3;
    visualPositions[mainIdx3 + 0] = parentX;
    visualPositions[mainIdx3 + 1] = parentY;
    visualPositions[mainIdx3 + 2] = parentZ;
    visualColors[mainIdx3 + 0] = parentR;
    visualColors[mainIdx3 + 1] = parentG;
    visualColors[mainIdx3 + 2] = parentB;
    
    // Subparticles - orbit around parent with slight variations
    for (let s = 0; s < SUBPARTICLES_PER_PARTICLE; s++) {
      const subIdx = mainIdx + 1 + s;
      const subIdx3 = subIdx * 3;
      
      // Create orbital offset that varies with time and particle index
      const angle = (i * 2.5 + s * Math.PI * 2 / SUBPARTICLES_PER_PARTICLE + lastTime * 0.5) % (Math.PI * 2);
      const radius = subOffset * (0.8 + Math.sin(i * 0.1 + s) * 0.2);
      
      visualPositions[subIdx3 + 0] = parentX + Math.cos(angle) * radius;
      visualPositions[subIdx3 + 1] = parentY + Math.sin(angle) * radius;
      visualPositions[subIdx3 + 2] = parentZ + (s - SUBPARTICLES_PER_PARTICLE * 0.5) * 0.02;
      
      // Slightly vary subparticle colors for more organic look
      const colorVar = 0.85 + Math.sin(i * 0.3 + s) * 0.15;
      visualColors[subIdx3 + 0] = parentR * colorVar;
      visualColors[subIdx3 + 1] = parentG * colorVar;
      visualColors[subIdx3 + 2] = parentB * colorVar;
    }
  }
  
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.setDrawRange(0, activeVisualCount);

  // Visual response
  const baseOpacity = 0.25 + audioLevel * 0.65;
  material.opacity = clamp(baseOpacity * config.brightness, 0.1, 1.0);

  const sizeBoost = 1 + audioLevel * 1.2;
  material.size = config.particleSize * sizeBoost;

  // Edge vignette driven by audio (internal only)
  if (vignetteEl) {
    const edge = config.edgeVignette * (0.25 + audioLevel * 0.75);
    vignetteEl.style.opacity = clamp(edge, 0, 1);
  }
}

// ===== Camera =====
function updateCamera(time) {
  // Camera drift currently disabled for clarity
  return;
}

// ===== Animation Loop =====
function animate() {
  animationId = requestAnimationFrame(animate);

  const now = performance.now() / 1000;
  let dt = now - lastTime;
  lastTime = now;
  dt = Math.min(dt, 0.05);

  // Auto Explode
  if (config.autoExplode && (now - lastExplodeTime) >= config.explodeInterval) {
    triggerExplode();
  }

  // Auto Randomize
  if (config.autoRandomize && (now - lastRandomizeTime) >= config.randomizeInterval) {
    triggerRandomize();
  }

  updateAudio();
  updateSwirlCenters(dt);
  updateParticles(dt, now);
  updateCamera(now);

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// ===== Resize =====
function onWindowResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  aspect = w / h;
  halfW = aspect;
  halfH = 1;

  if (camera) {
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
  }

  if (renderer) {
    renderer.setSize(w, h);
  }
}

// ===== Audio Update =====
function updateAudio() {
  if (!audioAPI) return;
  
  const fftData = audioAPI.getNormalizedFFTData();
  if (!fftData || fftData.length === 0) return;
  
  // Calculate audio level
  let sum = 0;
  for (let i = 0; i < fftData.length; i++) {
    sum += fftData[i];
  }
  audioLevel = sum / fftData.length;
  
  // Calculate bass and treble levels
  const bassStart = 0;
  const bassEnd = Math.floor(fftData.length * 0.1);
  const trebleStart = Math.floor(fftData.length * 0.7);
  const trebleEnd = fftData.length;
  
  let bassSum = 0;
  for (let i = bassStart; i < bassEnd; i++) {
    bassSum += fftData[i];
  }
  bassLevel = bassSum / (bassEnd - bassStart);
  
  let trebleSum = 0;
  for (let i = trebleStart; i < trebleEnd; i++) {
    trebleSum += fftData[i];
  }
  trebleLevel = trebleSum / (trebleEnd - trebleStart);

  // Beat-ish transient detection (very simple)
  audioAccumulator += audioLevel;
  audioSamples++;

  if (audioSamples >= 43) { // ~rough window
    const avg = audioAccumulator / audioSamples;
    audioTrend = avg * 0.8 + audioTrend * 0.2; // smooth baseline
    audioAccumulator = 0;
    audioSamples = 0;
  }

  if (audioLevel > audioTrend + 0.18) {
    beat = 1.0;
  } else {
    beat *= 0.86; // decay
  }
}

// ===== Automation Functions =====
function triggerExplode() {
  if (!positions || !velocities) return;

  const aspect = window.innerWidth / window.innerHeight;
  const halfW = aspect;
  const halfH = 1;

  // Create smooth transition to fill viewport
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;

    const currentX = positions[i3 + 0];
    const currentY = positions[i3 + 1];

    // Random target position across entire viewport
    const targetX = (Math.random() * 2 - 1) * halfW;
    const targetY = (Math.random() * 2 - 1) * halfH;

    // Calculate direction to target
    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;

    // Strong velocity toward target with explosion effect
    const explosionStrength = 1.2 + Math.random() * 0.8;
    const dirX = dx / dist;
    const dirY = dy / dist;

    // Set velocity to smoothly move toward target
    velocities[i3 + 0] = dirX * explosionStrength;
    velocities[i3 + 1] = dirY * explosionStrength;
    velocities[i3 + 2] = (Math.random() * 2 - 1) * 0.15;
  }
  lastExplodeTime = performance.now() / 1000;
}

function triggerRandomize() {
  const randomInRange = (min, max, step) => {
    const range = max - min;
    const steps = Math.floor(range / step);
    return min + (Math.floor(Math.random() * (steps + 1)) * step);
  };

  config.swirlStrength = randomInRange(0.4, 3.8, 0.1);
  config.flowSpeed = randomInRange(0.3, 2.5, 0.1);
  config.turbulence = randomInRange(0.3, 2.7, 0.1);
  config.audioInfluence = randomInRange(0, 3, 0.1);
  config.particleInteraction = randomInRange(-2.5, 2.5, 0.1);
  config.viscosity = randomInRange(0.5, 4.5, 0.1);
  config.flowInfluence = randomInRange(0.4, 2.6, 0.1);
  config.pointerInfluence = randomInRange(0, 3, 0.1);

  // Randomize colors
  const randomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  config.coolColor = randomColor();
  config.warmColor = randomColor();
  coolColorObj.set(config.coolColor);
  warmColorObj.set(config.warmColor);
  
  // Notify controls of parameter changes
  if (controlsChannel) {
    controlsChannel.postMessage({
      type: 'PARAM_UPDATES',
      updates: {
        swirlStrength: config.swirlStrength,
        flowSpeed: config.flowSpeed,
        turbulence: config.turbulence,
        audioInfluence: config.audioInfluence,
        particleInteraction: config.particleInteraction,
        viscosity: config.viscosity,
        flowInfluence: config.flowInfluence,
        pointerInfluence: config.pointerInfluence,
        coolColor: config.coolColor,
        warmColor: config.warmColor
      }
    });
  }
  
  lastRandomizeTime = performance.now() / 1000;
}

// ===== Module API =====
const moduleAPI = {
  async initModule({ container: providedContainer, audio, controlsChannel: providedControlsChannel }) {
    container = providedContainer;
    controlsChannel = providedControlsChannel;
    audioAPI = audio;
    
    // Initialize Three.js
    initThree();
    
    // Set up message listener for audio updates and control messages
    window.addEventListener('message', handleWindowMessage);
    
    // Set up BroadcastChannel for control messages
    if (controlsChannel) {
      controlsChannel.onmessage = handleControlMessage;
    }
    
    // Handle resize
    onWindowResize();
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
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('message', handleWindowMessage);
    
    // Remove pointer move listener
    const pointerMoveHandler = (e) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nx = (e.clientX / w) * 2 - 1;
      const ny = -((e.clientY / h) * 2 - 1);
      pointer.x = nx * halfW;
      pointer.y = ny * halfH;
      pointer.active = true;
    };
    window.removeEventListener('pointermove', pointerMoveHandler);
    
    if (controlsChannel) {
      controlsChannel.close();
    }
    
    if (container && renderer && renderer.domElement && container.contains(renderer.domElement)) {
      container.removeChild(renderer.domElement);
    }
    
    if (geometry) geometry.dispose();
    if (material) material.dispose();
    if (renderer) renderer.dispose();
  }
};

// Expose API immediately (before loader calls initModule)
window.moduleAPI = moduleAPI;

console.log('Flow module API exposed', { hasInitModule: !!moduleAPI.initModule });

