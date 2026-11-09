/**
 * Inkdrop Module
 * Sound-reactive ink in water particle system with flow fields and color themes
 */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let audioData = null;
let controlsChannel = null;
let container = null;
let animationId = null;
let particles = [];
let flowField = [];

// Parameters
let params = {
  sensitivity: 50,
  diffusion: 50,
  minParticleSize: 1,
  maxParticleSize: 5,
  gravity: 0,
  spinRate: 0,
  spinDirection: 1,
  spinTurbulence: 0,
  colorTheme: 'ocean',
  colorGradation: 50,
  backgroundColor: '#0a0a0a',
  dropRate: 8,
  dropVariation: 40
};

let nextDropAt = 0;

// Audio analysis variables
let audioAmplitude = 0;
let audioPitch = 0.5;
let bufferLength = 256;

// Color theme options
const themeOptions = ['ocean', 'sunset', 'neon', 'forest', 'fire', 'purple', 'rainbow', 'monochrome'];

// Color theme system
const colorThemes = {
  ocean: () => {
    const hues = [180, 200, 220, 240];
    return `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 80%, ${50 + Math.random() * 20}%)`;
  },
  sunset: () => {
    const hues = [0, 15, 30, 45, 60];
    return `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 90%, ${55 + Math.random() * 15}%)`;
  },
  neon: () => {
    const colors = [
      `hsl(${Math.random() * 60 + 300}, 100%, 60%)`,
      `hsl(${Math.random() * 60 + 180}, 100%, 60%)`,
      `hsl(${Math.random() * 60 + 120}, 100%, 60%)`
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  },
  forest: () => {
    const hues = [100, 120, 140, 160];
    return `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 70%, ${40 + Math.random() * 20}%)`;
  },
  fire: () => {
    const hues = [0, 15, 30, 45];
    return `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 100%, ${45 + Math.random() * 15}%)`;
  },
  purple: () => {
    const hues = [260, 280, 300, 320];
    return `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 80%, ${50 + Math.random() * 20}%)`;
  },
  rainbow: () => {
    return `hsl(${Math.random() * 360}, 80%, 60%)`;
  },
  monochrome: () => {
    const lightness = 40 + Math.random() * 40;
    return `hsl(0, 0%, ${lightness}%)`;
  }
};

/**
 * Get color from current theme
 */
function getThemeColor() {
  return colorThemes[params.colorTheme]();
}

/**
 * Helper function to parse HSL color
 */
function parseHSL(color) {
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (match) {
    return {
      h: parseInt(match[1]),
      s: parseInt(match[2]),
      l: parseInt(match[3])
    };
  }
  return null;
}

/**
 * Helper function to interpolate between two HSL colors
 */
function interpolateHSL(color1, color2, t) {
  const hsl1 = parseHSL(color1);
  const hsl2 = parseHSL(color2);
  
  if (!hsl1 || !hsl2) {
    return color2;
  }
  
  let hDiff = hsl2.h - hsl1.h;
  if (Math.abs(hDiff) > 180) {
    hDiff = hDiff > 0 ? hDiff - 360 : hDiff + 360;
  }
  const h = (hsl1.h + hDiff * t + 360) % 360;
  
  const s = hsl1.s + (hsl2.s - hsl1.s) * t;
  const l = hsl1.l + (hsl2.l - hsl1.l) * t;
  
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/**
 * Resize canvas
 */
function resizeCanvas() {
  if (!container) return;
  canvas.width = container.clientWidth || window.innerWidth;
  canvas.height = container.clientHeight || window.innerHeight;
  initFlowField();
}

/**
 * Initialize flow field
 */
function initFlowField() {
  flowField = [];
  const cols = Math.floor(canvas.width / 20);
  const rows = Math.floor(canvas.height / 20);
  for (let i = 0; i < cols * rows; i++) {
    flowField.push({ angle: 0, magnitude: 0 });
  }
}

/**
 * Particle class
 */
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.color = color;
    this.targetColor = color;
    this.colorTransitionSpeed = 0.02;
    this.life = 1;
    const sizeRange = params.maxParticleSize - params.minParticleSize;
    this.baseSize = params.minParticleSize + Math.random() * sizeRange;
    this.size = this.baseSize;
    this.history = [];
    this.maxHistory = 30;
    this.angle = Math.random() * Math.PI * 2;
    this.angularVelocity = (Math.random() - 0.5) * 0.1;
  }
  
  updateComplexity(complexity) {
    this.maxHistory = Math.floor(20 + complexity * 40);
  }
  
  updateTargetColor(newColor) {
    this.targetColor = newColor;
  }
  
  updateColor(gradation = 50) {
    const gradationFactor = gradation / 100;
    const transitionSpeed = 0.005 + (gradationFactor * 0.05);
    
    if (this.color !== this.targetColor) {
      const hsl1 = parseHSL(this.color);
      const hsl2 = parseHSL(this.targetColor);
      
      if (hsl1 && hsl2) {
        const threshold = 0.5 + (gradationFactor * 2);
        const hDiff = Math.abs(hsl2.h - hsl1.h);
        const sDiff = Math.abs(hsl2.s - hsl1.s);
        const lDiff = Math.abs(hsl2.l - hsl1.l);
        
        let normalizedHDiff = hDiff;
        if (normalizedHDiff > 180) {
          normalizedHDiff = 360 - normalizedHDiff;
        }
        
        if (normalizedHDiff < threshold && sDiff < threshold && lDiff < threshold) {
          this.color = this.targetColor;
        } else {
          this.color = interpolateHSL(this.color, this.targetColor, transitionSpeed);
        }
      } else {
        if (gradationFactor > 0.9) {
          this.color = this.targetColor;
        } else {
          this.color = this.targetColor;
        }
      }
    }
  }
  
  updateGradation(gradation) {
    const gradationFactor = gradation / 100;
    this.colorTransitionSpeed = 0.005 + (gradationFactor * 0.05);
  }
  
  update(audioLevel = 0, audioAmplitude = 0, audioPitch = 0.5, gradation = 50) {
    this.updateColor(gradation);
    this.updateComplexity(audioPitch);
    
    const col = Math.floor(this.x / 20);
    const row = Math.floor(this.y / 20);
    const cols = Math.floor(canvas.width / 20);
    const index = col + row * cols;
    
    if (flowField[index]) {
      const force = flowField[index];
      this.vx += Math.cos(force.angle) * force.magnitude * 0.1;
      this.vy += Math.sin(force.angle) * force.magnitude * 0.1;
    }
    
    const normalizedAudio = Math.min(Math.max(audioLevel, 0) / 128, 1);
    const audioIntensity = normalizedAudio * (params.sensitivity / 100);
    const distortion = audioAmplitude * 2;
    const distortionStrength = Math.min(distortion, 1.5);
    
    const audioForce = audioLevel * params.sensitivity * 0.001;
    this.vx += (Math.random() - 0.5) * audioForce;
    this.vy += (Math.random() - 0.5) * audioForce;
    
    const distortionForce = distortionStrength * 0.5;
    this.vx += (Math.random() - 0.5) * distortionForce * (0.5 + Math.random());
    this.vy += (Math.random() - 0.5) * distortionForce * (0.5 + Math.random());
    
    const amplitudeTurbulence = distortionStrength * 0.3;
    
    const sizeMultiplier = 1 + audioIntensity * 0.6;
    this.size = this.baseSize * sizeMultiplier;
    
    const sizeDistortion = 1 + (Math.random() - 0.5) * distortionStrength * 0.2;
    this.size *= sizeDistortion;
    
    const audioDiffusion = params.diffusion * (1 + audioIntensity * 0.4);
    const distortedDiffusion = audioDiffusion * (1 + distortionStrength * 0.5);
    
    const audioGravityVariation = Math.sin(Date.now() * 0.01) * audioIntensity * 20;
    const gravityDistortion = (Math.random() - 0.5) * distortionStrength * 30;
    const audioGravity = params.gravity + audioGravityVariation + gravityDistortion;
    
    this.vy += audioGravity * 0.01;
    
    const complexity = audioPitch;
    const complexityMultiplier = 0.5 + complexity * 1.5;
    
    const audioSpinMultiplier = 1 + audioIntensity * 0.4;
    const effectiveSpinRate = params.spinRate * audioSpinMultiplier;
    
    if (effectiveSpinRate > 0) {
      const baseSpinForce = effectiveSpinRate * 0.002;
      const numCenters = Math.floor(2 + complexity * 4);
      const centers = [];
      for (let i = 0; i < numCenters; i++) {
        const angle = (Math.PI * 2 * i) / numCenters;
        const radius = 0.3 + complexity * 0.2;
        centers.push({
          x: canvas.width * (0.5 + Math.cos(angle) * radius),
          y: canvas.height * (0.5 + Math.sin(angle) * radius)
        });
      }
      
      let totalVx = 0;
      let totalVy = 0;
      let weightSum = 0;
      
      centers.forEach((center) => {
        const dx = this.x - center.x;
        const dy = this.y - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
          const angle = Math.atan2(dy, dx);
          const perpAngle = angle + (Math.PI / 2) * params.spinDirection;
          const weight = 1 / (1 + distance * 0.002);
          
          const baseTurbulence = params.spinTurbulence / 50;
          const totalTurbulence = baseTurbulence + amplitudeTurbulence;
          const turbulenceFactor = 1 + (Math.random() - 0.5) * totalTurbulence * 2;
          
          const turbulenceAngle = (Math.random() - 0.5) * (params.spinTurbulence / 100 + distortionStrength * 0.5) * Math.PI;
          const angleComplexity = perpAngle + turbulenceAngle + (Math.random() - 0.5) * complexity * Math.PI * 0.3;
          
          const radialTurbulence = (Math.random() - 0.5) * (params.spinTurbulence / 150 + distortionStrength * 0.1);
          
          const spinForce = baseSpinForce * turbulenceFactor;
          const finalAngle = angleComplexity;
          const tangentForce = spinForce * weight;
          
          const radialAngle = angle;
          const radialForce = radialTurbulence * baseSpinForce * weight * 0.5;
          
          totalVx += Math.cos(finalAngle) * tangentForce + Math.cos(radialAngle) * radialForce;
          totalVy += Math.sin(finalAngle) * tangentForce + Math.sin(radialAngle) * radialForce;
          weightSum += weight;
        }
      });
      
      if (weightSum > 0) {
        this.vx += totalVx / weightSum;
        this.vy += totalVy / weightSum;
      }
      
      const angularTurbulence = (Math.random() - 0.5) * params.spinTurbulence * 0.01;
      const angularDistortion = (Math.random() - 0.5) * distortionStrength * 0.05;
      const angularComplexity = (Math.random() - 0.5) * complexity * 0.1;
      this.angularVelocity += (Math.random() - 0.5) * baseSpinForce * 0.2 + angularTurbulence + angularDistortion + angularComplexity;
      this.angle += this.angularVelocity * baseSpinForce * 3 * params.spinDirection;
    }
    
    const dampingFactor = 0.95 - (complexity * 0.05);
    this.vx *= dampingFactor;
    this.vy *= dampingFactor;
    this.angularVelocity *= 0.98 - (complexity * 0.02);
    
    this.x += this.vx;
    this.y += this.vy;
    
    this.x += (Math.random() - 0.5) * (distortedDiffusion / 25);
    this.y += (Math.random() - 0.5) * (distortedDiffusion / 25);
    
    const wrappedX = this.x < 0 || this.x > canvas.width;
    const wrappedY = this.y < 0 || this.y > canvas.height;
    
    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;
    if (this.y < 0) this.y = canvas.height;
    if (this.y > canvas.height) this.y = 0;
    
    if (!wrappedX && !wrappedY) {
      this.history.push({ x: this.x, y: this.y });
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
    } else {
      this.history = [];
    }
    
    this.life -= 0.002;
  }
  
  draw(gradation = 50) {
    ctx.lineWidth = this.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (this.history.length < 2) return;
    
    const minAngleDiff = Math.PI / 6;
    const maxDistance = Math.max(canvas.width, canvas.height) * 0.5;
    const gradationFactor = gradation / 100;
    const useColorGradation = gradationFactor > 0.3;
    
    const validSegments = [];
    let currentSegment = [];
    let lastAngle = null;
    let lastValidPoint = null;
    
    for (let i = 0; i < this.history.length; i++) {
      const point = this.history[i];
      
      if (i === 0) {
        currentSegment.push(point);
        lastValidPoint = point;
        continue;
      }
      
      if (!lastValidPoint) {
        currentSegment.push(point);
        lastValidPoint = point;
        continue;
      }
      
      const dx = point.x - lastValidPoint.x;
      const dy = point.y - lastValidPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 0.1 || dist > maxDistance) {
        if (dist > maxDistance && currentSegment.length > 1) {
          validSegments.push(currentSegment);
          currentSegment = [point];
        }
        continue;
      }
      
      const angle = Math.atan2(dy, dx);
      
      if (lastAngle !== null) {
        let angleDiff = Math.abs(angle - lastAngle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        const perpendicularThreshold = Math.PI / 2 - minAngleDiff;
        
        if (angleDiff > perpendicularThreshold && angleDiff < Math.PI / 2 + minAngleDiff) {
          if (currentSegment.length > 1) {
            validSegments.push(currentSegment);
          }
          currentSegment = [lastValidPoint, point];
          lastAngle = angle;
          lastValidPoint = point;
          continue;
        }
      }
      
      currentSegment.push(point);
      lastAngle = angle;
      lastValidPoint = point;
    }
    
    if (currentSegment.length > 1) {
      validSegments.push(currentSegment);
    }
    
    const totalHistoryLength = this.history.length;
    let historyIndex = 0;
    
    validSegments.forEach((segment) => {
      const segmentStartProgress = historyIndex / Math.max(1, totalHistoryLength - 1);
      const segmentEndProgress = (historyIndex + segment.length - 1) / Math.max(1, totalHistoryLength - 1);
      const segmentMidProgress = (segmentStartProgress + segmentEndProgress) / 2;
      
      let segmentColor = this.color;
      const hsl = parseHSL(this.color);
      
      if (hsl) {
        if (gradationFactor > 0.1) {
          const hueShift = segmentMidProgress * gradationFactor * 80;
          const satVariation = Math.sin(segmentMidProgress * Math.PI * 6) * gradationFactor * 25;
          const lightVariation = Math.cos(segmentMidProgress * Math.PI * 5) * gradationFactor * 20;
          
          const variedH = (hsl.h + hueShift + 360) % 360;
          const variedS = Math.max(0, Math.min(100, hsl.s + satVariation));
          const variedL = Math.max(0, Math.min(100, hsl.l + lightVariation));
          
          segmentColor = `hsl(${Math.round(variedH)}, ${Math.round(variedS)}%, ${Math.round(variedL)}%)`;
        }
      }
      
      ctx.strokeStyle = segmentColor;
      ctx.beginPath();
      
      for (let i = 0; i < segment.length; i++) {
        const point = segment[i];
        const pointInHistory = historyIndex + i;
        const pointProgress = pointInHistory / Math.max(1, totalHistoryLength - 1);
        const alpha = pointProgress * this.life;
        ctx.globalAlpha = alpha * 0.6;
        
        if (gradationFactor > 0.3) {
          const pointHsl = parseHSL(segmentColor);
          if (pointHsl) {
            const pointOffset = i / Math.max(1, segment.length - 1);
            const pointVariation = Math.sin(pointOffset * Math.PI * 4) * gradationFactor * 8;
            const pointH = (pointHsl.h + pointVariation + 360) % 360;
            ctx.strokeStyle = `hsl(${Math.round(pointH)}, ${pointHsl.s}%, ${pointHsl.l}%)`;
          }
        }
        
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
      
      historyIndex += segment.length;
    });
    
    ctx.globalAlpha = this.life * 0.8;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalAlpha = 1;
  }
}

/**
 * Add ink drop
 */
function addInkDrop(x, y, count = 50) {
  const baseColor = getThemeColor();
  const gradationFactor = params.colorGradation / 100;
  
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = Math.random() * 2 + 1;
    const px = x + Math.cos(angle) * Math.random() * 10;
    const py = y + Math.sin(angle) * Math.random() * 10;
    
    let particleColor = baseColor;
    if (gradationFactor > 0.3) {
      const hsl = parseHSL(baseColor);
      if (hsl) {
        const hueVariation = (Math.random() - 0.5) * gradationFactor * 40;
        const saturationVariation = (Math.random() - 0.5) * gradationFactor * 20;
        const lightnessVariation = (Math.random() - 0.5) * gradationFactor * 15;
        
        const variedH = (hsl.h + hueVariation + 360) % 360;
        const variedS = Math.max(0, Math.min(100, hsl.s + saturationVariation));
        const variedL = Math.max(0, Math.min(100, hsl.l + lightnessVariation));
        
        particleColor = `hsl(${Math.round(variedH)}, ${Math.round(variedS)}%, ${Math.round(variedL)}%)`;
      }
    }
    
    const particle = new Particle(px, py, particleColor);
    particle.updateGradation(params.colorGradation);
    particles.push(particle);
  }
}

/**
 * Update flow field based on audio
 */
function updateFlowField(audioDataArray, pitch = 0.5) {
  if (!audioDataArray || audioDataArray.length === 0) return;
  
  const cols = Math.floor(canvas.width / 20);
  const rows = Math.floor(canvas.height / 20);
  const complexityLayers = Math.floor(1 + pitch * 3);
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const index = x + y * cols;
      
      const audioIndex = Math.floor((x / cols) * bufferLength);
      let audioValue = audioDataArray[audioIndex] / 255;
      
      let complexAngle = 0;
      let complexMagnitude = 0;
      
      for (let layer = 0; layer < complexityLayers; layer++) {
        const freqOffset = Math.floor(layer * bufferLength / complexityLayers);
        const freqIndex = (audioIndex + freqOffset) % bufferLength;
        const layerValue = audioDataArray[freqIndex] / 255;
        const layerWeight = 1 / (layer + 1);
        
        const layerAngle = (x + y + layer) * Math.PI * 0.1 + Date.now() * 0.0001 * (1 + layer);
        complexAngle += Math.cos(layerAngle) * layerValue * layerWeight;
        complexMagnitude += layerValue * layerWeight;
      }
      
      complexAngle /= complexityLayers;
      complexMagnitude = Math.min(complexMagnitude / complexityLayers, 1);
      
      const baseAngle = audioValue * Math.PI * 2 + Date.now() * 0.0001;
      const finalAngle = baseAngle + complexAngle * pitch * Math.PI;
      const finalMagnitude = audioValue * 0.7 + complexMagnitude * 0.3;
      
      if (flowField[index]) {
        flowField[index].angle = finalAngle;
        flowField[index].magnitude = finalMagnitude;
      }
    }
  }
}

/**
 * Calculate amplitude from audio data
 */
function calculateAmplitude(frequencyData) {
  if (!frequencyData || frequencyData.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    sum += (frequencyData[i] / 255) ** 2;
  }
  const rms = Math.sqrt(sum / frequencyData.length);
  return Math.min(rms, 1);
}

/**
 * Calculate pitch/dominant frequency
 */
function calculatePitch(frequencyData) {
  if (!frequencyData || frequencyData.length === 0) return 0.5;
  
  let maxIndex = 0;
  let maxValue = 0;
  
  for (let i = 0; i < frequencyData.length; i++) {
    if (frequencyData[i] > maxValue) {
      maxValue = frequencyData[i];
      maxIndex = i;
    }
  }
  
  const normalizedPitch = maxIndex / frequencyData.length;
  
  let highFreqEnergy = 0;
  let totalEnergy = 0;
  const midPoint = Math.floor(frequencyData.length / 2);
  
  for (let i = 0; i < frequencyData.length; i++) {
    const energy = frequencyData[i];
    totalEnergy += energy;
    if (i > midPoint) {
      highFreqEnergy += energy;
    }
  }
  
  const highFreqRatio = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
  
  return Math.min((normalizedPitch * 0.7 + highFreqRatio * 0.3), 1);
}

/**
 * Animation loop
 */
function nextDropInterval() {
  const rate = Number(params.dropRate) || 0;
  if (rate <= 0) return 0;
  const base = 60000 / rate;
  const variation = Math.min(Math.max(Number(params.dropVariation) || 0, 0), 100) / 100;
  const factor = 1 + (Math.random() * 2 - 1) * variation * 0.85;
  return Math.max(200, base * factor);
}

function spawnScheduledDrop(now) {
  const rate = Number(params.dropRate) || 0;
  if (rate <= 0 || !canvas.width || !canvas.height) {
    nextDropAt = 0;
    return;
  }
  if (!nextDropAt) nextDropAt = now + nextDropInterval();
  if (now < nextDropAt) return;
  addInkDrop(Math.random() * canvas.width, Math.random() * canvas.height, 70);
  nextDropAt = now + nextDropInterval();
}

function animate(now = performance.now()) {
  animationId = requestAnimationFrame(animate);
  
  // Fade effect instead of clear
  if (!params.backgroundColor || params.backgroundColor === '#0a0a0a' || params.backgroundColor === '#000000') {
    ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
  } else {
    const hex = params.backgroundColor.replace('#', '');
    if (hex.length === 6) {
      try {
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.05)`;
      } catch (e) {
        ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
      }
    } else {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
    }
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  let audioLevel = 0;
  
  if (audioData) {
    try {
      const fftData = audioData.getFFTData ? audioData.getFFTData() : null;
      
      if (fftData && fftData.length > 0) {
        bufferLength = fftData.length;
        audioLevel = fftData.reduce((a, b) => a + b) / bufferLength;
        audioAmplitude = calculateAmplitude(fftData);
        audioPitch = calculatePitch(fftData);
        updateFlowField(fftData, audioPitch);
      }
    } catch (e) {
      console.warn('Error getting audio data:', e);
      audioAmplitude = 0;
      audioPitch = 0.5;
    }
  } else {
    audioAmplitude = 0;
    audioPitch = 0.5;
  }

  spawnScheduledDrop(now);
  
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(audioLevel, audioAmplitude, audioPitch, params.colorGradation);
    particles[i].draw(params.colorGradation);
    
    if (particles[i].life <= 0) {
      particles.splice(i, 1);
    }
  }
}

/**
 * Handle control messages
 */
function handleControlMessage(event) {
  if (event.data.type === 'PARAM_CHANGE') {
    const { param, value, data } = event.data;
    // Handle action requests specially
    if (param === '_action' && value) {
      handleAction(value, data);
    } else {
      updateParams({ [param]: value });
    }
  }
}

/**
 * Handle window messages
 */
function handleWindowMessage(event) {
  if (event.data.type === 'PARAM_CHANGE') {
    const { param, value, data } = event.data;
    // Handle action requests specially
    if (param === '_action' && value) {
      handleAction(value, data);
    } else {
      updateParams({ [param]: value });
    }
  }
}

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
  window.addEventListener('resize', resizeCanvas);
  
  // Add canvas to container if needed
  if (container && !container.contains(canvas)) {
    container.appendChild(canvas);
  }
  
  resizeCanvas();
  nextDropAt = 0;

  // Add initial ink drops
  setTimeout(() => {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        addInkDrop(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          60
        );
      }, i * 500);
    }
  }, 500);
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
 * Destroy the module
 */
export function destroy() {
  stop();
  
  window.removeEventListener('message', handleWindowMessage);
  window.removeEventListener('resize', resizeCanvas);
  
  if (controlsChannel) {
    controlsChannel.close();
  }
  
  particles = [];
  flowField = [];
  nextDropAt = 0;
  
  if (container && container.contains(canvas)) {
    container.removeChild(canvas);
  }
  
  container = null;
  audioData = null;
  controlsChannel = null;
}

/**
 * Update parameters
 */
export function updateParams(newParams) {
  Object.assign(params, newParams);
  if (newParams.dropRate !== undefined || newParams.dropVariation !== undefined) {
    nextDropAt = 0;
  }
  
  if (newParams.colorTheme !== undefined) {
    const newTheme = newParams.colorTheme;
    particles.forEach(particle => {
      const newColor = getThemeColor();
      particle.updateTargetColor(newColor);
      particle.updateGradation(params.colorGradation);
    });
  }
  
  if (newParams.colorGradation !== undefined) {
    particles.forEach(particle => {
      particle.updateGradation(params.colorGradation);
    });
  }
  
  if (container && newParams.backgroundColor !== undefined) {
    container.style.backgroundColor = params.backgroundColor;
  }
}

/**
 * Handle action requests (from controls)
 */
export function handleAction(action, data) {
  switch (action) {
    case 'addInk':
      if (data && data.x !== undefined && data.y !== undefined) {
        addInkDrop(data.x, data.y, data.count || 100);
      } else {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        addInkDrop(x, y, 100);
      }
      break;
    case 'clearCanvas':
      particles = [];
      ctx.fillStyle = params.backgroundColor || '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
  }
}

// Expose module API to window (for loader.js)
if (typeof window !== 'undefined') {
  window.moduleAPI = {
    initModule,
    start,
    stop,
    destroy,
    updateParams,
    handleAction
  };
}

