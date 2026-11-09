/**
 * Leaks and Lights Module
 * Audio-reactive light leaks and particle bursts visualization
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
let freqData = null;
let cameraStream = null;
let cameraVideo = null;
let width = 0, height = 0, dpr = 1;

// Audio state
let amp = 0, bass = 0, mid = 0, treble = 0, lastAmp = 0;

// Control parameters
let controls = {
  // GLOBAL
  masterIntensity: 1.0,
  audioSensitivity: 1.2,
  trailFade: 0.12,
  backgroundColor: "#000000",
  useHighDPI: true,

  // LIGHT LEAKS
  leakEnabled: true,
  leakCount: 7,
  leakEdgeBias: 0.8,
  leakBaseRadius: 260,
  leakRadiusJitter: 0.5,
  leakNoiseSpeed: 0.18,
  leakJitterAmount: 0.12,
  leakHueShiftSpeed: 0.06,
  leakBaseIntensity: 0.35,
  leakAudioBreath: 0.4,
  leakPaletteMode: "cool",
  leakBlendMode: "lighter",
  customPalette: null,
  leakColor1: "#00aaff",
  leakColor2: "#ff00aa",
  leakColor3: "#aaff00",

  // BURSTS
  burstEnabled: true,
  burstBaseRate: 3.5,
  burstAudioSensitivity: 1.5,
  burstPeakThreshold: 0.65,
  burstMinParticles: 8,
  burstMaxParticles: 90,
  emitterJitter: 0.5,
  emitterCurl: 0.5,

  // PARTICLES
  particleBaseSpeed: 260,
  particleSpeedAudioBoost: 0.9,
  particleLifetimeMin: 1.8,
  particleLifetimeMax: 5.4,
  particleSizeMin: 0.3,
  particleSizeMax: 3,
  particleSpinBase: 2.0,
  particleSpinAudioBoost: 6.0,
  particleDirectionSpread: 360,
  particleGravity: 0,
  particleTrailMode: "streaks",
  particleColorMode: "palette",
  particleAudioColorBoost: 0.6,
  particleOpacityVariability: 0.3,
  lightningBranching: 0.3,
  lightningJitter: 0.45,
  lightningForkChance: 0.2,
  lightningTwistAmount: 1.2,
  particleTrailLength: 150,
  particleDivergence: 0.5,

  // Spatial / freq mapping
  burstVerticalBiasBass: 0.4,
  burstVerticalBiasTreble: 0.4,

  // PERF
  maxParticles: 1300,
  showDebugOverlay: false,

  // CAMERA
  cameraEnabled: false,
  cameraHeight: 30,
  cameraOpacity: 0.7,
  cameraBlendMode: "normal"
};

// Shared hex -> HSL conversion
function hexToHslComponents(hex) {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  return {
    h: (h + 360) % 360,
    s: s * 100,
    l: l * 100
  };
}

function hexToHue(hex) {
  return hexToHslComponents(hex).h;
}

function hexToSat(hex) {
  return hexToHslComponents(hex).s;
}

// LIGHT LEAKS
class Leak {
  constructor() { this.reset(); }
  reset() {
    const edge = Math.floor(Math.random() * 4);
    const margin = Math.min(width, height) * 0.15;
    const t = Math.random();
    if (edge === 0) { this.x = t * width; this.y = Math.random() * margin; }
    else if (edge === 1) { this.x = width - Math.random() * margin; this.y = t * height; }
    else if (edge === 2) { this.x = t * width; this.y = height - Math.random() * margin; }
    else { this.x = Math.random() * margin; this.y = t * height; }

    const jitter = controls.leakRadiusJitter;
    const baseR = controls.leakBaseRadius;
    this.baseRadius = baseR * (1 - jitter + 2 * jitter * Math.random());
    this.radius = this.baseRadius;
    this.hue = this.pickHue();
    this.sat = this.pickSat();
    this.light = 55 + Math.random() * 15;
    this.alpha = controls.leakBaseIntensity * (0.7 + 0.6 * Math.random());
    this.vx = (Math.random() - 0.5) * controls.leakNoiseSpeed * 80;
    this.vy = (Math.random() - 0.5) * controls.leakNoiseSpeed * 80;
  }
  pickHue() {
    const mode = controls.leakPaletteMode;
    if (mode === "custom") {
      const colors = [controls.leakColor1, controls.leakColor2, controls.leakColor3];
      const choices = colors.filter(Boolean);
      if (choices.length) {
        const selectedColor = choices[Math.floor(Math.random() * choices.length)];
        return hexToHue(selectedColor) + (Math.random() * 20 - 10);
      }
    }
    if (mode === "warm") return 20 + Math.random() * 60;
    if (mode === "neon") {
      const choices = [140, 180, 210, 280, 320];
      return choices[Math.floor(Math.random() * choices.length)] + (Math.random() * 20 - 10);
    }
    if (mode === "sunset") return 15 + Math.random() * 45;
    if (mode === "ocean") return 180 + Math.random() * 50;
    if (mode === "forest") return 120 + Math.random() * 40;
    if (mode === "fire") return 0 + Math.random() * 60;
    if (mode === "ice") return 200 + Math.random() * 30;
    if (mode === "purple") return 270 + Math.random() * 60;
    if (mode === "gold") return 45 + Math.random() * 30;
    if (mode === "custom" && controls.customPalette) {
      return controls.customPalette.baseHue + Math.random() * controls.customPalette.hueSpread;
    }
    return 180 + Math.random() * 80;
  }
  pickSat() {
    const mode = controls.leakPaletteMode;
    if (mode === "custom") {
      const colors = [controls.leakColor1, controls.leakColor2, controls.leakColor3];
      const choices = colors.filter(Boolean);
      if (choices.length) {
        const selectedColor = choices[Math.floor(Math.random() * choices.length)];
        return hexToSat(selectedColor);
      }
    }
    if (mode === "warm") return 70 + Math.random() * 20;
    if (mode === "neon") return 85 + Math.random() * 15;
    if (mode === "sunset") return 75 + Math.random() * 20;
    if (mode === "ocean") return 70 + Math.random() * 15;
    if (mode === "forest") return 65 + Math.random() * 20;
    if (mode === "fire") return 80 + Math.random() * 15;
    if (mode === "ice") return 55 + Math.random() * 15;
    if (mode === "purple") return 75 + Math.random() * 20;
    if (mode === "gold") return 70 + Math.random() * 20;
    if (mode === "custom" && controls.customPalette) {
      return controls.customPalette.saturation * 100;
    }
    return 60 + Math.random() * 20;
  }
  update(dt) {
    const speed = controls.leakNoiseSpeed;
    if (speed > 0) {
      this.vx += (Math.random() - 0.5) * speed * 40 * dt;
      this.vy += (Math.random() - 0.5) * speed * 40 * dt;
    }
    this.vx *= (1 - 0.4 * dt);
    this.vy *= (1 - 0.4 * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const bias = controls.leakEdgeBias;
    if (bias > 0) {
      const cx = width / 2, cy = height / 2;
      const dx = this.x - cx, dy = this.y - cy;
      const edgePull = 0.2 * bias;
      this.x += dx * edgePull * dt;
      this.y += dy * edgePull * dt;
    }

    const margin = Math.min(width, height) * 0.3;
    if (this.x < -margin || this.x > width + margin || this.y < -margin || this.y > height + margin) {
      this.reset();
    }

    const breathFactor = 1 + controls.leakAudioBreath * amp * controls.masterIntensity;
    this.radius = this.baseRadius * breathFactor;
    const baseA = controls.leakBaseIntensity;
    this.alpha = baseA * (0.7 + 0.3 * Math.random()) * (0.7 + 0.6 * amp);
    this.hue += controls.leakHueShiftSpeed * dt * 30;
  }
  render(ctx) {
    if (this.alpha <= 0) return;
    const blendModes = {
      'lighter': 'lighter',
      'screen': 'screen',
      'overlay': 'overlay',
      'soft-light': 'soft-light',
      'hard-light': 'hard-light',
      'color-dodge': 'color-dodge',
      'difference': 'difference',
      'exclusion': 'exclusion',
      'multiply': 'multiply',
      'normal': 'source-over'
    };
    ctx.save();
    ctx.globalCompositeOperation = blendModes[controls.leakBlendMode] || 'lighter';
    const r = this.radius;
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    const color = `hsla(${this.hue}, ${this.sat}%, ${this.light}%, `;
    gradient.addColorStop(0.0, color + (this.alpha * 0.9) + ")");
    gradient.addColorStop(0.3, color + (this.alpha * 0.5) + ")");
    gradient.addColorStop(1.0, color + "0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

const leaks = [];
function initLeaks() {
  leaks.length = 0;
  for (let i = 0; i < controls.leakCount; i++) leaks.push(new Leak());
}

// PARTICLES (Lightning-like)
class Particle {
  constructor(x, y, angle, speed, size, life, color, parent = null, depth = 0) {
    this.x = x; this.y = y;
    this.prevX = x; this.prevY = y;
    this.startX = x; this.startY = y;
    this.angle = angle;
    this.baseAngle = angle;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.size = size;
    this.baseSize = size;
    this.life = life; this.maxLife = life;
    this.spin = (Math.random() - 0.5) * controls.particleSpinBase;
    this.spin += controls.particleSpinAudioBoost * treble * (Math.random() > 0.5 ? 1 : -1);
    this.rotation = Math.random() * Math.PI * 2;
    this.color = color;
    this.parent = parent;
    this.depth = depth;
    this.children = [];
    this.path = [{x, y}];
    this.twist = 0;
    this.twistSpeed = (Math.random() - 0.5) * controls.lightningTwistAmount * 2;
    this.jitter = controls.lightningJitter;
    this.branched = false;
    const variability = controls.particleOpacityVariability;
    this.opacityMultiplier = 1 - variability + (variability * 2 * Math.random());
    this.opacityMultiplier = Math.max(0, Math.min(1, this.opacityMultiplier));
  }
  update(dt) {
    this.prevX = this.x; this.prevY = this.y;
    
    const dx = this.x - this.startX;
    const dy = this.y - this.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = Math.sqrt(width * width + height * height);
    const distanceFactor = Math.min(1, distance / (maxDistance * 0.3));
    
    const jitterAmount = controls.emitterJitter;
    const curlAmount = controls.emitterCurl;
    
    this.twist += this.twistSpeed * dt * (0.5 + curlAmount * 1.5);
    const divergenceMultiplier = 1 + distanceFactor * controls.particleDivergence;
    
    const smoothFactor = curlAmount;
    const jitterFactor = (1 - curlAmount) * jitterAmount;
    
    const twistOffset = Math.sin(this.twist) * this.jitter * 50 * divergenceMultiplier * (0.5 + smoothFactor * 0.5);
    const perpAngle = this.baseAngle + Math.PI / 2;
    let jitterX = Math.cos(perpAngle) * twistOffset;
    let jitterY = Math.sin(perpAngle) * twistOffset;
    
    const baseRandomJitter = this.jitter * 240 * divergenceMultiplier;
    const randomJitter = baseRandomJitter * (0.3 + jitterFactor * 0.7);
    jitterX += (Math.random() - 0.5) * randomJitter * (1 + distanceFactor * 2);
    jitterY += (Math.random() - 0.5) * randomJitter * (1 + distanceFactor * 2);
    
    const snapAmount = 45 * divergenceMultiplier * jitterFactor;
    jitterX += (Math.random() > 0.7 ? 1 : -1) * snapAmount * distanceFactor;
    jitterY += (Math.random() > 0.7 ? 1 : -1) * snapAmount * distanceFactor;
    
    if (curlAmount > 0.3) {
      const curlStrength = (curlAmount - 0.3) / 0.7;
      const curlAngle = this.twist * 2 * curlStrength;
      const curlRadius = 100 * curlStrength;
      jitterX += Math.cos(this.baseAngle + Math.PI/2 + curlAngle) * curlRadius * dt;
      jitterY += Math.sin(this.baseAngle + Math.PI/2 + curlAngle) * curlRadius * dt;
    }
    
    const divergenceAngle = (Math.random() - 0.5) * controls.particleDivergence * distanceFactor * 0.5 * (1 - smoothFactor * 0.5);
    const twistInfluence = smoothFactor * 0.8 + (1 - smoothFactor) * 0.2;
    const currentAngle = this.baseAngle + Math.sin(this.twist) * controls.lightningTwistAmount * twistInfluence + divergenceAngle;
    this.vx = Math.cos(currentAngle) * this.speed;
    this.vy = Math.sin(currentAngle) * this.speed;
    
    this.vy += controls.particleGravity * dt;
    const angularBoost = 1 + distanceFactor * 1.5;
    this.x += (this.vx * dt + jitterX * dt) * angularBoost;
    this.y += (this.vy * dt + jitterY * dt) * angularBoost;
    
    this.path.push({x: this.x, y: this.y});
    const maxPathLength = Math.max(10, Math.floor(controls.particleTrailLength));
    if (this.path.length > maxPathLength) this.path.shift();
    
    this.rotation += this.spin * dt;
    this.life -= dt;
    
    if (!this.branched && this.depth < 3 && Math.random() < controls.lightningForkChance * dt * 10) {
      const branchAngle = this.baseAngle + (Math.random() - 0.5) * Math.PI * controls.lightningBranching;
      const branchSpeed = this.speed * (0.6 + Math.random() * 0.4);
      const branchLife = this.life * (0.5 + Math.random() * 0.3);
      const branchSize = this.baseSize * (0.7 + Math.random() * 0.3);
      const child = new Particle(this.x, this.y, branchAngle, branchSpeed, branchSize, branchLife, this.color, this, this.depth + 1);
      this.children.push(child);
      particles.push(child);
      this.branched = true;
    }
  }
  render(ctx) {
    if (this.life <= 0) return;
    const t = 1 - this.life / this.maxLife;
    const alpha = t * this.opacityMultiplier;
    const size = this.size * (1 - t * 0.3);
    
    ctx.save();
    const [h, s, l] = this.color;
    let intensityBoost = 1 + controls.particleAudioColorBoost * amp * controls.masterIntensity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    
    if (this.path.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.path[0].x, this.path[0].y);
      for (let i = 1; i < this.path.length; i++) {
        ctx.lineTo(this.path[i].x, this.path[i].y);
      }
      ctx.lineWidth = size * 4;
      const glowAlpha = alpha * 0.4;
      ctx.strokeStyle = `hsla(${h}, ${s}%, ${Math.min(100, l * intensityBoost)}%, ${glowAlpha})`;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(this.path[0].x, this.path[0].y);
      for (let i = 1; i < this.path.length; i++) {
        ctx.lineTo(this.path[i].x, this.path[i].y);
      }
      ctx.lineWidth = size * 2;
      const startPoint = this.path[0];
      const endPoint = this.path[this.path.length - 1];
      const gradient = ctx.createLinearGradient(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
      const startAlpha = alpha * 0.3;
      const endAlpha = alpha;
      gradient.addColorStop(0, `hsla(${h}, ${s}%, ${Math.min(100, l * intensityBoost)}%, ${startAlpha})`);
      gradient.addColorStop(1, `hsla(${h}, ${s}%, ${Math.min(100, l * intensityBoost)}%, ${endAlpha})`);
      ctx.strokeStyle = gradient;
      ctx.stroke();
    } else if (this.path.length === 1) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${h}, ${s}%, ${Math.min(100, l * intensityBoost)}%, ${alpha})`;
      ctx.fill();
    }
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, size * 0.6, 0, Math.PI * 2);
    const nodeFill = `hsla(${h}, ${s}%, ${Math.min(100, l * intensityBoost * 1.2)}%, ${alpha})`;
    ctx.fillStyle = nodeFill;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${h}, ${s}%, ${Math.min(100, l * intensityBoost * 1.5)}%, ${alpha})`;
    ctx.fill();
    
    ctx.restore();
  }
}

const particles = [];
let burstAccumulator = 0;

function pickParticleColor() {
  const mode = controls.particleColorMode;
  if (mode === "randomHue") {
    const hue = Math.random() * 360;
    return [hue, 80, 60];
  } else if (mode === "ampMapped") {
    const hue = 200 - 140 * Math.min(1, amp);
    const sat = 50 + 40 * Math.min(1, amp);
    const light = 40 + 30 * Math.min(1, amp);
    return [hue, sat, light];
  } else {
    const modeLeak = controls.leakPaletteMode;
    let hue;
    if (modeLeak === "warm") hue = 20 + Math.random() * 60;
    else if (modeLeak === "neon") {
      const choices = [140, 180, 210, 260, 320];
      hue = choices[Math.floor(Math.random() * choices.length)] + (Math.random() * 20 - 10);
    } else if (modeLeak === "sunset") hue = 15 + Math.random() * 45;
    else if (modeLeak === "ocean") hue = 180 + Math.random() * 50;
    else if (modeLeak === "forest") hue = 120 + Math.random() * 40;
    else if (modeLeak === "fire") hue = 0 + Math.random() * 60;
    else if (modeLeak === "ice") hue = 200 + Math.random() * 30;
    else if (modeLeak === "purple") hue = 270 + Math.random() * 60;
    else if (modeLeak === "gold") hue = 45 + Math.random() * 30;
    else if (modeLeak === "custom") {
      const colors = [controls.leakColor1, controls.leakColor2, controls.leakColor3].filter(Boolean);
      if (colors.length) {
        const c = colors[Math.floor(Math.random() * colors.length)];
        hue = hexToHue(c);
      } else if (controls.customPalette) {
        hue = controls.customPalette.baseHue + Math.random() * controls.customPalette.hueSpread;
      } else {
        hue = 180 + Math.random() * 80;
      }
    } else hue = 180 + Math.random() * 80;
    const sat = 75 + Math.random() * 20;
    const light = 50 + Math.random() * 15;
    return [hue, sat, light];
  }
}

function spawnBurst(peakBoost = 0) {
  if (!controls.burstEnabled) return;
  let vyBias = 0.5;
  vyBias += (controls.burstVerticalBiasTreble * treble);
  vyBias -= (controls.burstVerticalBiasBass * bass);
  vyBias = Math.max(0.1, Math.min(0.9, vyBias));
  const x = Math.random() * width;
  const y = vyBias * height + (Math.random() - 0.5) * height * 0.2;
  const ampFactor = Math.min(1.5, amp * controls.masterIntensity);
  const minP = controls.burstMinParticles;
  const maxP = controls.burstMaxParticles;
  let n = Math.floor(minP + (maxP - minP) * ampFactor + peakBoost * 0.5 * maxP);
  n = Math.max(minP, Math.min(maxP, n));
  const spreadDeg = controls.particleDirectionSpread;
  const spreadRad = spreadDeg * Math.PI / 180;

  const boltCount = Math.max(1, Math.floor(n / 8));
  for (let i = 0; i < boltCount; i++) {
    const baseAngle = (Math.PI * 2 * i / boltCount) + (Math.random() - 0.5) * spreadRad;
    const speed = controls.particleBaseSpeed *
      (0.7 + Math.random() * 0.6) *
      (1 + controls.particleSpeedAudioBoost * ampFactor);
    const life = controls.particleLifetimeMin +
      Math.random() * (controls.particleLifetimeMax - controls.particleLifetimeMin);
    const size = controls.particleSizeMin +
      Math.random() * (controls.particleSizeMax - controls.particleSizeMin);
    const color = pickParticleColor();
    particles.push(new Particle(x, y, baseAngle, speed, size, life, color, null, 0));
  }
  if (particles.length > controls.maxParticles) {
    const excess = particles.length - controls.maxParticles;
    particles.splice(0, excess);
  }
}

function resize() {
  width = container.clientWidth;
  height = container.clientHeight;
  dpr = controls.useHighDPI ? window.devicePixelRatio || 1 : 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let cameraBound = false;
function initCamera() {
  const media = window.frissonMedia;
  if (!media || cameraBound) return;
  cameraBound = true;
  media.bindCamera((el) => {
    cameraVideo = el;
  });
}

function stopCamera() {
  cameraVideo = null;
}

function updateAudio() {
  const shared = audioData?.getFFTData?.() || window.frissonMedia?.fft?.();
  if (shared && shared.length) freqData = shared;
  if (!freqData || !freqData.length) {
    amp *= 0.95;
    bass = mid = treble = 0;
    return;
  }
  let total = 0;
  for (let i = 0; i < freqData.length; i++) total += freqData[i];
  const avg = total / freqData.length;
  let rawAmp = (avg / 255) * controls.audioSensitivity;
  amp = amp * 0.85 + rawAmp * 0.15;
  amp = Math.max(0, Math.min(1.5, amp));

  const third = Math.floor(freqData.length / 3);
  let bSum = 0, mSum = 0, tSum = 0;
  for (let i = 0; i < third; i++) bSum += freqData[i];
  for (let i = third; i < 2 * third; i++) mSum += freqData[i];
  for (let i = 2 * third; i < freqData.length; i++) tSum += freqData[i];

  bass = (bSum / third) / 255;
  mid = (mSum / third) / 255;
  treble = (tSum / (freqData.length - 2 * third)) / 255;
}

let lastTime = performance.now();
let running = false;

function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  updateAudio();

  ctx.globalCompositeOperation = "source-over";
  const bgColor = controls.backgroundColor;
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  ctx.fillStyle = `rgba(${r},${g},${b},${controls.trailFade})`;
  ctx.fillRect(0, 0, width, height);

  if (controls.leakEnabled) {
    leaks.forEach(leak => { leak.update(dt); leak.render(ctx); });
  }

  if (controls.cameraEnabled && cameraVideo && cameraVideo.readyState === 4) {
    const cameraHeightPercent = controls.cameraHeight / 100;
    const cameraHeightPx = height * cameraHeightPercent;
    const cameraY = height - cameraHeightPx;
    
    const videoAspect = cameraVideo.videoWidth / cameraVideo.videoHeight;
    const canvasAspect = width / cameraHeightPx;
    
    let drawWidth = width;
    let drawHeight = cameraHeightPx;
    let drawX = 0;
    let drawY = cameraY;
    
    if (videoAspect > canvasAspect) {
      drawHeight = cameraHeightPx;
      drawWidth = drawHeight * videoAspect;
      drawX = (width - drawWidth) / 2;
    } else {
      drawWidth = width;
      drawHeight = drawWidth / videoAspect;
      drawY = height - drawHeight;
    }
    
    ctx.save();
    ctx.globalAlpha = controls.cameraOpacity;
    ctx.globalCompositeOperation = controls.cameraBlendMode;
    ctx.drawImage(cameraVideo, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  }

  const baseRate = controls.burstBaseRate * (0.4 + 0.6 * amp * controls.masterIntensity);
  burstAccumulator += dt * Math.max(0, baseRate);
  while (burstAccumulator >= 1) {
    spawnBurst(0);
    burstAccumulator -= 1;
  }

  const threshold = controls.burstPeakThreshold;
  const isPeak = amp > threshold && lastAmp <= threshold;
  if (isPeak) spawnBurst(1);
  lastAmp = amp;

  ctx.globalCompositeOperation = "lighter";
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update(dt);
    if (
      p.life <= 0 ||
      p.x < -width * 0.5 || p.x > width * 1.5 ||
      p.y < -height * 0.5 || p.y > height * 1.5
    ) {
      particles.splice(i, 1);
    } else {
      p.render(ctx);
    }
  }
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
  canvas.id = 'canvas';
  ctx = canvas.getContext('2d');
  
  // Create camera video element
  cameraVideo = document.createElement('video');
  cameraVideo.autoplay = true;
  cameraVideo.playsInline = true;
  cameraVideo.style.display = 'none';
  container.appendChild(cameraVideo);
  
  resize();
  container.appendChild(canvas);
  
  window.addEventListener('resize', resize);
  
  initCamera();
  
  initLeaks();
}

/**
 * Start animation
 */
export function start() {
  if (!running) {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }
}

/**
 * Stop animation
 */
export function stop() {
  running = false;
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
  
  stopCamera();
  
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }
  
  analyser = null;
  freqData = null;
  cameraStream = null;
  cameraVideo = null;
  
  if (canvas && container && container.contains(canvas)) {
    container.removeChild(canvas);
  }
  if (cameraVideo && container && container.contains(cameraVideo)) {
    container.removeChild(cameraVideo);
  }
  
  window.removeEventListener('resize', resize);
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
  Object.assign(controls, newParams);
  
  // Handle special cases
  if (newParams.leakCount !== undefined) {
    initLeaks();
  }
  
  if (newParams.cameraEnabled && controls.cameraEnabled) {
    initCamera();
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














