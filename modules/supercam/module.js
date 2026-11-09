/**
 * Supercam Module
 * Audio-Reactive Webcam Visualizer with multiple effect modes
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

// Video and audio
let video = null;
let videoTexture = null;
let material = null;
let plane = null;
let stream = null;
let audioContext = null;
let analyser = null;
let audioSource = null;
let dataArray = null;
let audioLevel = 0;
let smoothedAudioLevel = 0;

// Gradient texture
let gradientCanvas = null;
let gradientCtx = null;

// Configuration
let params = {
  mode: 0,
  audioSensitivity: 1.0,
  globalIntensity: 1.0,
  globalBrightness: 0,
  globalContrast: 1.0,
  globalBlend: 1.0,
  globalBlur: 0,
  // Mode 0: Kaleidoscope
  kaleidSegments: 6,
  kaleidSubdivisions: 1,
  kaleidMirrorStrength: 1.0,
  kaleidZoom: 1.0,
  kaleidRotationSpeed: 0,
  // Mode 1: Glitch
  glitchBaseIntensity: 0.3,
  glitchMaxPixelSize: 8,
  glitchRGBOffset: 0.01,
  glitchThreshold: 0.5,
  // Mode 2: Gradient Map
  gradientPreset: 'custom',
  gradientColor1: '#000000',
  gradientColor2: '#808080',
  gradientColor3: '#ffffff',
  gradientContrast: 1.0,
  gradientBrightness: 0,
  gradientBlend: 1.0,
  gradientTexture: null,
  // Mode 3: Camera Shake
  shakeMaxPosition: 0.02,
  shakeMaxRotation: 0.1,
  shakeSmoothness: 0.7,
  shakeAudioSensitivity: 1.0,
  shakeRefractionAmount: 0,
  shakeRefractionIntensity: 1.0
};

// Vertex shader
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader with all modes
const fragmentShader = `
  uniform sampler2D tVideo;
  uniform sampler2D tGradient;
  uniform float time;
  uniform float audioLevel;
  uniform float globalIntensity;
  uniform float globalBrightness;
  uniform float globalContrast;
  uniform float globalBlend;
  uniform float globalBlur;
  uniform vec2 resolution;
  uniform int mode;
  
  // Mode 0: Kaleidoscope
  uniform float kaleidSegments;
  uniform float kaleidSubdivisions;
  uniform float kaleidMirrorStrength;
  uniform float kaleidZoom;
  uniform float kaleidRotationSpeed;
  
  // Mode 1: Glitch
  uniform float glitchBaseIntensity;
  uniform float glitchMaxPixelSize;
  uniform float glitchRGBOffset;
  uniform float glitchThreshold;
  
  // Mode 2: Gradient Map
  uniform float gradientContrast;
  uniform float gradientBrightness;
  uniform float gradientBlend;
  
  // Mode 3: Camera Shake
  uniform float shakeMaxPosition;
  uniform float shakeMaxRotation;
  uniform float shakeSmoothness;
  uniform float shakeAudioSensitivity;
  uniform float shakeRefractionAmount;
  uniform float shakeRefractionIntensity;
  
  varying vec2 vUv;
  
  // Pseudo-random function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  // Noise function
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  
  // Mode 0: Kaleidoscope
  vec2 kaleidoscopeUV(vec2 uv) {
    vec2 centered = (uv - 0.5) * 2.0;
    float angle = atan(centered.y, centered.x);
    float radius = length(centered);
    
    // Rotate
    angle += time * kaleidRotationSpeed;
    
    // Fold into segments
    float segmentAngle = 6.28318 / kaleidSegments;
    angle = mod(angle, segmentAngle * 2.0);
    if (angle > segmentAngle) {
      angle = segmentAngle * 2.0 - angle;
    }
    
    // Apply subdivisions
    if (kaleidSubdivisions > 1.0) {
      float subSegmentAngle = segmentAngle / kaleidSubdivisions;
      float localAngle = mod(angle, subSegmentAngle * 2.0);
      if (localAngle > subSegmentAngle) {
        localAngle = subSegmentAngle * 2.0 - localAngle;
      }
      angle = floor(angle / (subSegmentAngle * 2.0)) * (subSegmentAngle * 2.0) + localAngle;
    }
    
    // Convert back to cartesian
    vec2 folded = vec2(cos(angle), sin(angle)) * radius;
    vec2 result = (folded * 0.5 + 0.5) / kaleidZoom;
    
    // Mirror strength
    return mix(uv, result, kaleidMirrorStrength);
  }
  
  // Mode 1: Glitch
  vec3 glitchEffect(vec2 uv) {
    vec3 base = texture2D(tVideo, uv).rgb;
    float intensity = mix(glitchBaseIntensity, 1.0, audioLevel);
    float rowNoise = noise(vec2(uv.y * 20.0, time * 1.5));
    float trigger = step(glitchThreshold, intensity + (rowNoise - 0.5) * 0.5);
    
    // Always-on subtle RGB drift
    float subtleOffset = glitchRGBOffset * 0.3 * intensity;
    float rSub = texture2D(tVideo, uv + vec2(subtleOffset, 0.0)).r;
    float gSub = texture2D(tVideo, uv).g;
    float bSub = texture2D(tVideo, uv - vec2(subtleOffset, 0.0)).b;
    vec3 subtleColor = vec3(rSub, gSub, bSub);
    
    if (trigger < 0.5) {
      return mix(base, subtleColor, 0.5 * intensity);
    }
    
    // Hard glitch when triggered
    float rowHash = random(vec2(
      floor(uv.y * resolution.y),
      floor(time * 3.0)
    ));
    float blockFactor = mix(1.0, glitchMaxPixelSize, intensity * rowHash);
    vec2 blockUV = floor(uv * resolution.xy / blockFactor) * blockFactor / resolution.xy;
    
    float lineJitter = (random(vec2(blockUV.y * 200.0, floor(time * 20.0))) - 0.5);
    lineJitter *= 0.06 * intensity;
    blockUV.x += lineJitter;
    
    float blockMask = step(
      0.8,
      random(floor(blockUV * 40.0) + floor(time * 5.0))
    );
    if (blockMask > 0.5) {
      float verticalShift = (random(vec2(blockUV.x * 50.0, time)) - 0.5);
      blockUV.y = clamp(
        blockUV.y + verticalShift * 0.2 * intensity,
        0.0,
        1.0
      );
    }
    
    float rgbOff = glitchRGBOffset * intensity;
    float r = texture2D(tVideo, blockUV + vec2(rgbOff, 0.0)).r;
    float g = texture2D(tVideo, blockUV).g;
    float b = texture2D(tVideo, blockUV - vec2(rgbOff, 0.0)).b;
    vec3 col = vec3(r, g, b);
    
    float crush = smoothstep(0.6, 1.0, intensity);
    vec3 crushed = floor(col * 8.0) / 8.0;
    col = mix(col, crushed, crush);
    
    float grain = (random(uv * resolution.xy * 2.0 + time) - 0.5);
    grain *= 0.25 * intensity;
    col += grain;
    
    col = mix(subtleColor, col, 0.8);
    return col;
  }
  
  // Mode 3: Camera Shake
  vec2 cameraShakeUV(vec2 uv) {
    float shakeAmount = audioLevel * shakeAudioSensitivity;
    shakeAmount = clamp(shakeAmount, 0.0, 1.0);
    
    vec2 shakeOffset = vec2(
      noise(vec2(time * 10.0, 0.0)) - 0.5,
      noise(vec2(time * 10.0, 100.0)) - 0.5
    ) * shakeMaxPosition * shakeAmount;
    
    float shakeAngle = (noise(vec2(time * 8.0, 200.0)) - 0.5) * shakeMaxRotation * shakeAmount;
    
    vec2 centered = uv - 0.5;
    float cosAngle = cos(shakeAngle);
    float sinAngle = sin(shakeAngle);
    vec2 rotated = vec2(
      centered.x * cosAngle - centered.y * sinAngle,
      centered.x * sinAngle + centered.y * cosAngle
    );
    
    return rotated + 0.5 + shakeOffset;
  }
  
  // Blur effect
  vec3 blurEffect(vec2 uv, float blurAmount) {
    if (blurAmount <= 0.0) {
      return texture2D(tVideo, uv).rgb;
    }
    
    vec3 color = vec3(0.0);
    float totalWeight = 0.0;
    float stepSize = blurAmount * 0.001;
    
    for (float x = -1.0; x <= 1.0; x += 1.0) {
      for (float y = -1.0; y <= 1.0; y += 1.0) {
        vec2 offset = vec2(x, y) * stepSize;
        float weight = 1.0 / (1.0 + length(vec2(x, y)));
        color += texture2D(tVideo, clamp(uv + offset, 0.0, 1.0)).rgb * weight;
        totalWeight += weight;
      }
    }
    
    return color / totalWeight;
  }
  
  void main() {
    vec2 uv = vUv;
    
    vec3 originalColor = texture2D(tVideo, uv).rgb;
    if (globalBlur > 0.0) {
      originalColor = blurEffect(uv, globalBlur);
    }
    
    vec3 color = vec3(0.0);
    
    if (mode == 0) {
      vec2 kaleidUV = kaleidoscopeUV(uv);
      color = texture2D(tVideo, kaleidUV).rgb;
      if (globalBlur > 0.0) {
        color = blurEffect(kaleidUV, globalBlur);
      }
    } else if (mode == 1) {
      color = glitchEffect(uv);
    } else if (mode == 2) {
      vec3 original = texture2D(tVideo, uv).rgb;
      if (globalBlur > 0.0) {
        original = blurEffect(uv, globalBlur);
      }
      float luminance = dot(original, vec3(0.299, 0.587, 0.114));
      luminance = (luminance - 0.5) * gradientContrast + 0.5 + gradientBrightness;
      luminance = clamp(luminance, 0.0, 1.0);
      vec3 mapped = texture2D(tGradient, vec2(luminance, 0.5)).rgb;
      color = mix(original, mapped, gradientBlend);
    } else if (mode == 3) {
      vec2 shakeUV = cameraShakeUV(uv);
      
      if (shakeRefractionAmount > 0.0) {
        vec2 shakeOffset = vec2(
          noise(vec2(time * 10.0, 0.0)) - 0.5,
          noise(vec2(time * 10.0, 100.0)) - 0.5
        ) * shakeMaxPosition * clamp(audioLevel * shakeAudioSensitivity, 0.0, 1.0);
        
        vec2 refractionDir = normalize(vec2(-shakeOffset.y, shakeOffset.x));
        float refractionOffset = shakeRefractionAmount * shakeRefractionIntensity;
        
        vec2 rUV = clamp(shakeUV + refractionDir * refractionOffset, 0.0, 1.0);
        vec2 gUV = shakeUV;
        vec2 bUV = clamp(shakeUV - refractionDir * refractionOffset, 0.0, 1.0);
        
        float r = texture2D(tVideo, rUV).r;
        float g = texture2D(tVideo, gUV).g;
        float b = texture2D(tVideo, bUV).b;
        
        color = vec3(r, g, b);
      } else {
        color = texture2D(tVideo, shakeUV).rgb;
      }
      
      if (globalBlur > 0.0) {
        color = blurEffect(shakeUV, globalBlur);
      }
    } else {
      color = originalColor;
    }
    
    // Apply global intensity
    color = mix(texture2D(tVideo, uv).rgb, color, globalIntensity);
    
    // Apply global brightness
    color += globalBrightness;
    
    // Apply global contrast
    color = (color - 0.5) * globalContrast + 0.5;
    
    // Apply global blend with original
    color = mix(texture2D(tVideo, uv).rgb, color, globalBlend);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Create gradient texture
 */
function createGradientTexture() {
  gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = 256;
  gradientCanvas.height = 1;
  gradientCtx = gradientCanvas.getContext('2d');
  
  drawGradientToCanvas();
  
  const texture = new THREE.CanvasTexture(gradientCanvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  
  return texture;
}

/**
 * Draw gradient to canvas based on preset or custom colors
 */
function drawGradientToCanvas() {
  if (!gradientCtx) return;
  
  const gradient = gradientCtx.createLinearGradient(0, 0, 256, 0);
  
  if (params.gradientPreset === 'custom') {
    gradient.addColorStop(0, params.gradientColor1);
    gradient.addColorStop(0.5, params.gradientColor2);
    gradient.addColorStop(1, params.gradientColor3);
  } else {
    switch (params.gradientPreset) {
      case 'warmNeon':
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.3, '#ff0066');
        gradient.addColorStop(0.6, '#ffaa00');
        gradient.addColorStop(1, '#ffff00');
        break;
      case 'coldSynthwave':
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.3, '#003366');
        gradient.addColorStop(0.6, '#0066ff');
        gradient.addColorStop(1, '#00ffff');
        break;
      case 'duotone':
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f3460');
        break;
      case 'fire':
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.2, '#330000');
        gradient.addColorStop(0.5, '#ff3300');
        gradient.addColorStop(0.8, '#ffaa00');
        gradient.addColorStop(1, '#ffffaa');
        break;
      case 'ocean':
        gradient.addColorStop(0, '#001122');
        gradient.addColorStop(0.3, '#003366');
        gradient.addColorStop(0.6, '#0066aa');
        gradient.addColorStop(1, '#00aaff');
        break;
      default:
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(1, '#ffffff');
    }
  }
  
  gradientCtx.fillStyle = gradient;
  gradientCtx.fillRect(0, 0, 256, 1);
}

/**
 * Update gradient texture
 */
function updateGradientTexture() {
  if (!params.gradientTexture) return;
  drawGradientToCanvas();
  params.gradientTexture.needsUpdate = true;
}

/**
 * Initialize Three.js scene
 */
function initThreeJS() {
  // Check if Three.js is loaded
  if (typeof THREE === 'undefined') {
    throw new Error('Three.js is not loaded. Please check the import.');
  }
  
  if (!container) {
    throw new Error('Container is not set. Cannot initialize Three.js scene.');
  }
  
  console.log('Initializing Three.js scene...', {
    containerWidth: container.clientWidth,
    containerHeight: container.clientHeight
  });
  
  scene = new THREE.Scene();
  
  const width = container.clientWidth || window.innerWidth || 800;
  const height = container.clientHeight || window.innerHeight || 600;
  console.log('Scene dimensions:', width, 'x', height);
  
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  
  // Create WebGL renderer with error checking
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: false, // Opaque background
    preserveDrawingBuffer: false // Better performance
  });
  
  // Verify WebGL context was created
  const gl = renderer.getContext();
  if (!gl) {
    throw new Error('Failed to create WebGL context');
  }
  console.log('WebGL context created:', {
    vendor: gl.getParameter(gl.VENDOR),
    renderer: gl.getParameter(gl.RENDERER),
    version: gl.getParameter(gl.VERSION)
  });
  
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setClearColor(0x000000, 1); // Black background
  
  // Ensure canvas is visible and properly sized
  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  
  container.appendChild(canvas);
  console.log('Renderer canvas appended to container');
  
  // Create full-screen quad geometry (covers entire viewport)
  const geometry = new THREE.PlaneGeometry(2, 2);
  console.log('Geometry created: PlaneGeometry(2, 2)');
  
  params.gradientTexture = createGradientTexture();
  console.log('Gradient texture created');
  
  // Create default black texture (will be replaced with video texture)
  const defaultTexture = new THREE.DataTexture(
    new Uint8Array([0, 0, 0, 255]),
    1, 1,
    THREE.RGBAFormat
  );
  defaultTexture.needsUpdate = true;
  console.log('Default texture created (black)');
  
  // Compile and link shaders with error checking
  console.log('Compiling shaders...');
  const shaderMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      tVideo: { value: defaultTexture },
      tGradient: { value: params.gradientTexture },
      time: { value: 0 },
      audioLevel: { value: 0 },
      globalIntensity: { value: 1.0 },
      globalBrightness: { value: 0 },
      globalContrast: { value: 1.0 },
      globalBlend: { value: 1.0 },
      globalBlur: { value: 0 },
      resolution: { value: new THREE.Vector2(width, height) },
      mode: { value: 0 },
      kaleidSegments: { value: 6 },
      kaleidSubdivisions: { value: 1 },
      kaleidMirrorStrength: { value: 1.0 },
      kaleidZoom: { value: 1.0 },
      kaleidRotationSpeed: { value: 0 },
      glitchBaseIntensity: { value: 0.3 },
      glitchMaxPixelSize: { value: 8 },
      glitchRGBOffset: { value: 0.01 },
      glitchThreshold: { value: 0.5 },
      gradientContrast: { value: 1.0 },
      gradientBrightness: { value: 0 },
      gradientBlend: { value: 1.0 },
      shakeMaxPosition: { value: 0.02 },
      shakeMaxRotation: { value: 0.1 },
      shakeSmoothness: { value: 0.7 },
      shakeAudioSensitivity: { value: 1.0 },
      shakeRefractionAmount: { value: 0 },
      shakeRefractionIntensity: { value: 1.0 }
    }
  });
  
  // Check for shader compilation errors after material is created
  // Three.js handles shader compilation internally, but we can check for errors
  // Note: ShaderMaterial will throw if compilation fails, so if we get here, it compiled
  console.log('ShaderMaterial created - shaders compiled and linked');
  
  // Verify the material has the expected uniforms
  const requiredUniforms = ['tVideo', 'time', 'audioLevel', 'mode', 'resolution'];
  const missingUniforms = requiredUniforms.filter(name => !shaderMaterial.uniforms[name]);
  if (missingUniforms.length > 0) {
    console.warn('Missing required uniforms:', missingUniforms);
  } else {
    console.log('All required uniforms present');
  }
  
  material = shaderMaterial;
  console.log('ShaderMaterial created and assigned');
  
  // Create mesh with geometry and material
  plane = new THREE.Mesh(geometry, material);
  scene.add(plane);
  console.log('Plane mesh added to scene');
  
  // Test render: clear to a test color to verify WebGL is working
  renderer.setClearColor(0xff0000, 1); // Red background for testing
  renderer.render(scene, camera);
  console.log('Test render completed - canvas should show red background');
  
  // Reset to black after test
  setTimeout(() => {
    renderer.setClearColor(0x000000, 1);
    console.log('Background reset to black');
  }, 1000);
  
  window.addEventListener('resize', handleResize);
  console.log('Three.js initialization complete');
}

/**
 * Handle window resize
 */
function handleResize() {
  if (!container || !renderer) return;
  
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  
  if (width === 0 || height === 0) return;
  
  renderer.setSize(width, height);
  if (material) {
    material.uniforms.resolution.value.set(width, height);
  }
}

/**
 * Use the shared camera and microphone from the front page.
 */
function startWebcam() {
  const attach = () => {
    const media = window.frissonMedia;
    if (!media) return false;
    media.bindCamera((el) => {
      if (videoTexture) {
        videoTexture.dispose();
        videoTexture = null;
      }
      video = el || null;
      if (!video || !material) {
        if (material) material.uniforms.tVideo.value = null;
        return;
      }
      videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBFormat;
      videoTexture.generateMipmaps = false;
      videoTexture.flipY = false;
      videoTexture.needsUpdate = true;
      material.uniforms.tVideo.value = videoTexture;
    });
    return true;
  };
  if (!attach()) window.addEventListener('frisson-media-ready', attach, { once: true });
}

function stopWebcam() {
  if (videoTexture) {
    videoTexture.dispose();
    videoTexture = null;
  }
  video = null;
  if (material) material.uniforms.tVideo.value = null;
}

/**
 * Analyze audio
 */
function analyzeAudio() {
  const level = (audioData && audioData.getAudioLevel && audioData.getAudioLevel()) || window.frissonMedia?.level?.() || 0;
  audioLevel = Math.min(level * params.audioSensitivity, 1);
  smoothedAudioLevel = smoothedAudioLevel * 0.9 + audioLevel * 0.1;
}


/**
 * Animation loop
 */
let frameCount = 0;
let lastLogTime = 0;

function animate() {
  animationId = requestAnimationFrame(animate);
  
  frameCount++;
  const now = performance.now();
  
  // Log every 5 seconds to verify loop is running
  if (now - lastLogTime > 5000) {
    console.log('Animation loop running - frame:', frameCount, {
      hasRenderer: !!renderer,
      hasScene: !!scene,
      hasCamera: !!camera,
      hasMaterial: !!material,
      hasVideoTexture: !!videoTexture,
      hasVideo: !!video
    });
    lastLogTime = now;
  }
  
  analyzeAudio();
  
  const time = performance.now() * 0.001;
  
  if (material) {
    material.uniforms.time.value = time;
    material.uniforms.audioLevel.value = smoothedAudioLevel;
    material.uniforms.globalIntensity.value = params.globalIntensity;
    material.uniforms.globalBrightness.value = params.globalBrightness;
    material.uniforms.globalContrast.value = params.globalContrast;
    material.uniforms.globalBlend.value = params.globalBlend;
    material.uniforms.globalBlur.value = params.globalBlur;
    material.uniforms.mode.value = params.mode;
    
    // Mode-specific uniforms
    material.uniforms.kaleidSegments.value = params.kaleidSegments;
    material.uniforms.kaleidSubdivisions.value = params.kaleidSubdivisions;
    material.uniforms.kaleidMirrorStrength.value = params.kaleidMirrorStrength;
    material.uniforms.kaleidZoom.value = params.kaleidZoom;
    material.uniforms.kaleidRotationSpeed.value = params.kaleidRotationSpeed;
    
    material.uniforms.glitchBaseIntensity.value = params.glitchBaseIntensity;
    material.uniforms.glitchMaxPixelSize.value = params.glitchMaxPixelSize;
    material.uniforms.glitchRGBOffset.value = params.glitchRGBOffset;
    material.uniforms.glitchThreshold.value = params.glitchThreshold;
    
    material.uniforms.gradientContrast.value = params.gradientContrast;
    material.uniforms.gradientBrightness.value = params.gradientBrightness;
    material.uniforms.gradientBlend.value = params.gradientBlend;
    
    material.uniforms.shakeMaxPosition.value = params.shakeMaxPosition;
    material.uniforms.shakeMaxRotation.value = params.shakeMaxRotation;
    material.uniforms.shakeSmoothness.value = params.shakeSmoothness;
    material.uniforms.shakeAudioSensitivity.value = params.shakeAudioSensitivity;
    material.uniforms.shakeRefractionAmount.value = params.shakeRefractionAmount;
    material.uniforms.shakeRefractionIntensity.value = params.shakeRefractionIntensity;
    
    // CRITICAL: VideoTexture requires needsUpdate = true every frame while video is playing
    // This tells Three.js to copy the latest video frame from the video element to the GPU texture
    if (videoTexture && video) {
      // Check if video has loaded enough data (readyState >= 2 means HAVE_CURRENT_DATA)
      if (video.readyState >= 2) {
        // Always update texture every frame - video is a live stream
        // This is the key: without this, the texture won't update with new video frames
        videoTexture.needsUpdate = true;
        
        // Verify video is actually playing
        if (video.paused) {
          console.warn('Video paused in animation loop, attempting to resume');
          video.play().catch(err => {
            console.warn('Video play failed in animation loop:', err);
          });
        }
        
        // Log texture update occasionally for debugging
        if (frameCount % 300 === 0) { // Every ~5 seconds at 60fps
          console.log('Video texture updating:', {
            readyState: video.readyState,
            playing: !video.paused,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            textureNeedsUpdate: videoTexture.needsUpdate
          });
        }
      } else {
        // Video not ready yet - log occasionally for debugging
        if (frameCount % 300 === 0) {
          console.log('Video not ready yet, readyState:', video.readyState, '(need >= 2)');
        }
      }
    } else {
      // Missing video or texture - log occasionally
      if (frameCount % 300 === 0) {
        console.warn('Video texture or video element missing:', {
          hasVideoTexture: !!videoTexture,
          hasVideo: !!video,
          materialHasTexture: !!(material && material.uniforms.tVideo.value)
        });
      }
    }
  } else {
    if (frameCount % 300 === 0) {
      console.warn('Material not available in animation loop');
    }
  }
  
  // Render the scene
  if (renderer && scene && camera) {
    try {
      renderer.render(scene, camera);
    } catch (renderError) {
      console.error('Render error:', renderError);
    }
  } else {
    if (frameCount % 300 === 0) {
      console.warn('Cannot render - missing components:', {
        hasRenderer: !!renderer,
        hasScene: !!scene,
        hasCamera: !!camera
      });
    }
  }
}

/**
 * Handle parameter messages
 */
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
  
  // Initialize Three.js first (this must succeed)
  try {
    initThreeJS();
  } catch (error) {
    console.error('Failed to initialize Three.js:', error);
    throw new Error('Failed to initialize Three.js. Please check the console for details.');
  }
  
  // Request camera access (critical for this module)
  // Handle errors gracefully - module can still render with a black texture
  try {
    await startWebcam();
    console.log('Camera initialized successfully');
  } catch (error) {
    console.error('Failed to access camera:', error);
    // Don't throw - let the module load with a black texture
    // The user can manually retry camera access later
    console.warn('Module will continue without camera. Please grant camera permissions and refresh.');
    
    // Create a default black texture so rendering can continue
    if (material) {
      const defaultTexture = new THREE.DataTexture(
        new Uint8Array([0, 0, 0, 255]),
        1, 1,
        THREE.RGBAFormat
      );
      defaultTexture.needsUpdate = true;
      material.uniforms.tVideo.value = defaultTexture;
    }
  }
  
  // Start animation loop
  animate();
}

/**
 * Start the module
 */
export function start() {
  if (!animationId) {
    animate();
  }
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
 * Destroy module
 */
export function destroy() {
  stop();
  
  stopWebcam();
  
  if (params.gradientTexture) {
    params.gradientTexture.dispose();
    params.gradientTexture = null;
  }
  
  if (gradientCanvas) {
    gradientCanvas = null;
    gradientCtx = null;
  }
  
  if (material) {
    material.dispose();
    material = null;
  }
  
  if (plane) {
    if (plane.geometry) plane.geometry.dispose();
    plane = null;
  }
  
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
  Object.assign(params, newParams);
  
  // Update gradient texture if gradient params changed
  if (newParams.gradientPreset !== undefined || 
      newParams.gradientColor1 !== undefined ||
      newParams.gradientColor2 !== undefined ||
      newParams.gradientColor3 !== undefined) {
    updateGradientTexture();
  }
}

// Expose module API to window (for loader.js)
// This must be set immediately when the module loads, before any async operations
if (typeof window !== 'undefined') {
  window.moduleAPI = {
    initModule,
    start,
    stop,
    destroy,
    updateParams
  };
}

