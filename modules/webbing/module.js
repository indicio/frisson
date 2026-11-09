/**
 * Webbing Module
 * Dual emitter audio visualizer with particle connections
 */

let canvas = null;
let ctx = null;
let container = null;
let audioData = null;
let controlsChannel = null;
let animationId = null;

// Configuration
let params = {
  orbitRadius: 250,
  orbitSpeed: 0.04,
  particleCount: 50,
  spawnRate: 1,
  amplitudeThreshold: 0.015,
  connectionDistance: 200,
  minSize: 2,
  maxSize: 8,
  minSpeed: 1,
  maxSpeed: 5,
  minLifespan: 1,
  maxLifespan: 14,
  colorTheme: 'ocean',
  lowColor: '#0000ff',
  highColor: '#ff0000',
  connectionColor: '#ffffff',
  connectionThickness: 1,
  lowFreq: 200,
  highFreq: 2000,
  backgroundColor: '#000000'
};

// Color themes
const colorThemes = {
  ocean: { low: '#0000ff', high: '#00ffff' },
  sunset: { low: '#ff3300', high: '#ffcc00' },
  neon: { low: '#ff00ff', high: '#00ffff' },
  forest: { low: '#006600', high: '#66ff00' },
  fire: { low: '#ff0000', high: '#ffff00' },
  purple: { low: '#6600cc', high: '#cc00ff' },
  rainbow: { low: '#ff0000', high: '#0000ff' },
  monochrome: { low: '#ffffff', high: '#888888' }
};

// Particle system
class Particle {
  constructor(emitterId, x, y) {
    this.reset(emitterId, x, y);
  }

  reset(emitterId, x, y) {
    this.emitterId = emitterId;
    this.x = x;
    this.y = y;
    this.active = true;
    this.lifespan = Math.random() * (params.maxLifespan - params.minLifespan) + params.minLifespan;
    this.age = 0;
    this.size = Math.random() * (params.maxSize - params.minSize) + params.minSize;
    this.speed = Math.random() * (params.maxSpeed - params.minSpeed) + params.minSpeed;
    this.angle = Math.random() * Math.PI * 2;
    this.opacity = 1;
    const lowHsl = hexToHsl(params.lowColor);
    const highHsl = hexToHsl(params.highColor);
    this.hue = lowHsl.h;
    this.lowHue = lowHsl.h;
    this.highHue = highHsl.h;
  }

  update(amplitude, frequency) {
    this.age += 0.016;
    if (this.age >= this.lifespan) {
      this.active = false;
      return;
    }

    this.speed += amplitude;
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.opacity = 1 - (this.age / this.lifespan);

    // Update color based on frequency
    const freqRatio = Math.min(frequency / params.highFreq, 1);
    this.hue = this.lowHue + (this.highHue - this.lowHue) * freqRatio;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.hue}, 100%, 50%, ${this.opacity})`;
    ctx.fill();
  }
}

class Emitter {
  constructor(id) {
    this.id = id;
    this.angle = id * Math.PI;
    this.particles = [];
    this.x = 0;
    this.y = 0;
  }

  update(amplitude, frequency) {
    // Update position
    this.angle += params.orbitSpeed;
    this.x = canvas.width / 2 + Math.cos(this.angle) * params.orbitRadius;
    this.y = canvas.height / 2 + Math.sin(this.angle) * params.orbitRadius;

    // Spawn new particles
    if (amplitude > params.amplitudeThreshold && Math.random() < params.spawnRate) {
      if (this.particles.length < params.particleCount) {
        this.particles.push(new Particle(this.id, this.x, this.y));
      }
    }

    // Update existing particles
    this.particles = this.particles.filter(p => p.active);
    this.particles.forEach(p => {
      // Update colors when params change
      const lowHsl = hexToHsl(params.lowColor);
      const highHsl = hexToHsl(params.highColor);
      p.lowHue = lowHsl.h;
      p.highHue = highHsl.h;
      p.update(amplitude, frequency);
    });
  }

  draw() {
    this.particles.forEach(p => p.draw());
  }
}

const emitters = [new Emitter(0), new Emitter(1)];

// Helper functions
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function drawConnections() {
  const particles1 = emitters[0].particles;
  const particles2 = emitters[1].particles;
  
  const connColor = hexToRgb(params.connectionColor);
  
  ctx.lineWidth = params.connectionThickness;
  ctx.beginPath();
  for (let i = 0; i < particles1.length; i++) {
    for (let j = 0; j < particles2.length; j++) {
      const p1 = particles1[i];
      const p2 = particles2[j];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < params.connectionDistance) {
        const opacity = (1 - distance / params.connectionDistance) * 
                        Math.min(p1.opacity, p2.opacity);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(${connColor.r}, ${connColor.g}, ${connColor.b}, ${opacity * 0.5})`;
        ctx.stroke();
      }
    }
  }
}

function animate() {
  if (!canvas || !ctx) return;

  ctx.fillStyle = params.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (audioData && audioData.getAnalyser) {
    try {
      const analyser = audioData.getAnalyser();
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      let maxVal = 0;
      let maxIndex = 0;
      
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
        if (dataArray[i] > maxVal) {
          maxVal = dataArray[i];
          maxIndex = i;
        }
      }
      
      const audioContext = audioData.getAudioContext();
      const amplitude = sum / (dataArray.length * 255);
      const frequency = maxIndex * (audioContext.sampleRate / analyser.fftSize);

      emitters.forEach(emitter => {
        emitter.update(amplitude, frequency);
        emitter.draw();
      });

      drawConnections();
    } catch (e) {
      // Audio not ready yet, continue with default values
      emitters.forEach(emitter => {
        emitter.update(0.1, 500);
        emitter.draw();
      });
      drawConnections();
    }
  } else {
    // No audio, use default values
    emitters.forEach(emitter => {
      emitter.update(0.1, 500);
      emitter.draw();
    });
    drawConnections();
  }

  animationId = requestAnimationFrame(animate);
}

function handleResize() {
  if (!canvas || !container) return;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}

function handleControlMessage(event) {
  if (event.data && event.data.type === 'PARAM_CHANGE') {
    const { param, value } = event.data;
    if (params.hasOwnProperty(param)) {
      params[param] = value;
      
      // Handle theme change
      if (param === 'colorTheme' && colorThemes[value]) {
        params.lowColor = colorThemes[value].low;
        params.highColor = colorThemes[value].high;
      }
      
      // Handle background color
      if (param === 'backgroundColor' && container) {
        container.style.backgroundColor = value;
      }
      
      // Trim particles if count is reduced
      if (param === 'particleCount') {
        emitters.forEach(emitter => {
          if (emitter.particles.length > params.particleCount) {
            emitter.particles = emitter.particles.slice(0, params.particleCount);
          }
        });
      }
    }
  }
}

function handleWindowMessage(event) {
  handleControlMessage(event);
}

/**
 * Initialize the module
 */
export async function initModule({ container: containerElement, audio, controlsChannel: channel }) {
  container = containerElement;
  audioData = audio;
  controlsChannel = channel;
  
  // Create canvas
  canvas = document.createElement('canvas');
  canvas.id = 'visualizer';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);
  
  ctx = canvas.getContext('2d');
  
  // Set initial size
  handleResize();
  
  // Set background
  container.style.backgroundColor = params.backgroundColor;
  
  // Listen for control messages
  if (controlsChannel) {
    controlsChannel.onmessage = handleControlMessage;
  }
  
  // Listen for window messages
  window.addEventListener('message', handleWindowMessage);
  
  // Handle resize
  window.addEventListener('resize', handleResize);
}

/**
 * Start the animation loop
 */
export function start() {
  if (!animationId) {
    animate();
  }
}

/**
 * Stop the animation loop
 */
export function stop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

/**
 * Update parameters
 */
export function updateParams(newParams) {
  Object.assign(params, newParams);
  
  // Handle theme change
  if (newParams.colorTheme && colorThemes[newParams.colorTheme]) {
    params.lowColor = colorThemes[newParams.colorTheme].low;
    params.highColor = colorThemes[newParams.colorTheme].high;
  }
  
  // Handle background color
  if (newParams.backgroundColor && container) {
    container.style.backgroundColor = newParams.backgroundColor;
  }
  
  // Trim particles if count is reduced
  if (newParams.particleCount !== undefined) {
    emitters.forEach(emitter => {
      if (emitter.particles.length > params.particleCount) {
        emitter.particles = emitter.particles.slice(0, params.particleCount);
      }
    });
  }
}

/**
 * Destroy the module
 */
export function destroy() {
  stop();
  
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('message', handleWindowMessage);
  
  if (canvas && canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }
  
  canvas = null;
  ctx = null;
  container = null;
  audioData = null;
  controlsChannel = null;
  
  // Clear particles
  emitters.forEach(emitter => {
    emitter.particles = [];
  });
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

