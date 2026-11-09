/**
 * Wormhole Module
 * 3D tunnel visualization with stars, rings, or squares
 */

import * as THREE from '../../shared/libs/three-r161/three.module.js';

let scene = null;
let camera = null;
let renderer = null;
let container = null;
let audioData = null;
let controlsChannel = null;
let animationId = null;

// Global state
let stars = null;
let rings = [];
let audioLevel = 0;
let isAnimating = true;
let time = 0;
let smoothAudioLevel = 0;
let cameraRotation = { yaw: 0, roll: 0, pitch: 0 };
let targetRotation = { yaw: 0, roll: 0, pitch: 0 };
let rainbowHue = 0;
let shakeX = 0, shakeY = 0;
let targetShakeX = 0, targetShakeY = 0;
let ringScales = [];
let starVelocities = [];
let starAngles = [];

// Configuration
let params = {
  shape: 'stars', // 'stars', 'rings', or 'squares'
  starDensity: 5000,
  lineLength: 2.5,
  flowDirection: 'forward', // 'forward', 'reverse', 'orbital', 'chaotic'
  ringCount: 50,
  ringThickness: 0.2,
  ringSpacing: 4.0,
  ringRadius: 15,
  squareCount: 50,
  squareSpacing: 4.0,
  squareSize: 15,
  borderThickness: 2,
  rotationSpeed: 0.5,
  rotationDirection: 'forward', // 'forward', 'reverse', 'alternating'
  rotationAxis: 'xyz', // 'z', 'xyz', 'xy'
  elementColor: '#4a9eff',
  backgroundColor: '#000000',
  audioSensitivity: 1.0,
  speed: 0.5,
  tunnelLength: 200,
  tunnelRadius: 15,
  curveAmplitude: 5,
  curveFrequency: 0.3,
  tunnelShape: 'cylinder',
  colorMode: 'solid',
  audioSmoothingFactor: 0.12,
  rotationSmoothingFactor: 0.06,
  audioSpeedMultiplier: 0.5,
  shakeSmoothingFactor: 0.25,
  wrapAroundThreshold: 10,
  audioFftSize: 256,
  audioNormalization: 255,
  spiralRotationSpeed: 0.5,
  funnelExpansionRate: 0.05,
  figure8Twist: 1.0
};

// Get radius at a given Z position based on tunnel shape
function getRadiusAtZ(z) {
  const normalizedZ = Math.abs(z) / params.tunnelLength;
  
  switch (params.tunnelShape) {
    case 'funnel-expand':
      return params.tunnelRadius * (0.3 + normalizedZ * 0.7);
    case 'funnel-contract':
      return params.tunnelRadius * (1.0 - normalizedZ * 0.7);
    case 'spiral':
    case 'cylinder':
    case 'figure8':
    default:
      return params.tunnelRadius;
  }
}

// Get color based on color mode
function getElementColor(baseColor, zPosition, index, radiusFactor) {
  const c = new THREE.Color(baseColor);
  const count = params.shape === 'stars' ? params.starDensity : 
               (params.shape === 'squares' ? params.squareCount : params.ringCount);
  
  switch (params.colorMode) {
    case 'rainbow':
      c.setHSL((index / count + rainbowHue) % 1, 1, 0.6);
      break;
    case 'audio-reactive':
      c.setHSL((smoothAudioLevel * 0.7) % 1, 1, 0.6);
      break;
    case 'solid':
    default:
      c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.2);
      break;
  }
  
  return c;
}

// Create stars (line segments)
function createStars() {
  if (stars) {
    scene.remove(stars);
    stars.geometry.dispose();
    stars.material.dispose();
  }

  const positions = [];
  const colors = [];
  starVelocities = [];
  starAngles = [];
  
  const color = new THREE.Color(params.elementColor);
  
  for (let i = 0; i < params.starDensity; i++) {
    const z = -(Math.random() * params.tunnelLength);
    const angle = Math.random() * Math.PI * 2;
    const radiusFactor = Math.sqrt(Math.random());
    const radius = getRadiusAtZ(z) * radiusFactor;
    
    let x = Math.cos(angle) * radius;
    let y = Math.sin(angle) * radius;
    
    if (params.tunnelShape === 'figure8') {
      const twist = (z / params.tunnelLength) * Math.PI * params.figure8Twist;
      const nx = x * Math.cos(twist) - y * Math.sin(twist);
      const ny = x * Math.sin(twist) + y * Math.cos(twist);
      x = nx;
      y = ny;
    }
    
    positions.push(x, y, z);
    starAngles.push(angle);
    starVelocities.push(0);
    
    const c = getElementColor(color, z, i, radiusFactor);
    colors.push(c.r, c.g, c.b);
  }
  
  const linePositions = [];
  const lineColors = [];
  for (let i = 0; i < positions.length; i += 3) {
    linePositions.push(positions[i], positions[i + 1], positions[i + 2]);
    lineColors.push(colors[i], colors[i + 1], colors[i + 2]);
    linePositions.push(positions[i], positions[i + 1], positions[i + 2]);
    lineColors.push(colors[i], colors[i + 1], colors[i + 2]);
  }
  
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
  
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });
  
  stars = new THREE.LineSegments(lineGeometry, material);
  scene.add(stars);
}

// Create a single ring or square
function createRing(zPosition, index) {
  const radius = getRadiusAtZ(zPosition);
  const baseColor = new THREE.Color(params.elementColor);
  const color = getElementColor(baseColor, zPosition, index, null);
  
  if (params.shape === 'squares') {
    const squareGroup = new THREE.Group();
    const size = params.squareSize * 2;
    const faceGeometry = new THREE.PlaneGeometry(size, size);
    
    const faceMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide
    });
    
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    squareGroup.add(face);
    
    const borderThickness = params.borderThickness * 0.1;
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    
    const topBorder = new THREE.Mesh(new THREE.PlaneGeometry(size, borderThickness), borderMaterial);
    topBorder.position.y = size / 2;
    squareGroup.add(topBorder);
    
    const bottomBorder = new THREE.Mesh(new THREE.PlaneGeometry(size, borderThickness), borderMaterial);
    bottomBorder.position.y = -size / 2;
    squareGroup.add(bottomBorder);
    
    const leftBorder = new THREE.Mesh(new THREE.PlaneGeometry(borderThickness, size), borderMaterial);
    leftBorder.position.x = -size / 2;
    squareGroup.add(leftBorder);
    
    const rightBorder = new THREE.Mesh(new THREE.PlaneGeometry(borderThickness, size), borderMaterial);
    rightBorder.position.x = size / 2;
    squareGroup.add(rightBorder);
    
    squareGroup.position.z = zPosition;
    squareGroup.userData = {
      baseZ: zPosition,
      index: index,
      isSquare: true,
      borderThickness: params.borderThickness,
      size: size,
      borders: [topBorder, bottomBorder, leftBorder, rightBorder]
    };
    
    return squareGroup;
  } else {
    const geometry = new THREE.TorusGeometry(radius, params.ringThickness, 8, 64);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    
    const ring = new THREE.Mesh(geometry, material);
    ring.position.z = zPosition;
    ring.userData = {
      baseZ: zPosition,
      index: index,
      isSquare: false
    };
    
    if (params.tunnelShape === 'spiral' || params.tunnelShape === 'figure8') {
      const angle = (zPosition / params.tunnelLength) * Math.PI * 4;
      ring.rotation.z = angle;
    }
    
    return ring;
  }
}

// Create all elements based on shape
function createElements() {
  // Clean up stars if they exist
  if (stars) {
    scene.remove(stars);
    stars.geometry.dispose();
    stars.material.dispose();
    stars = null;
  }
  
  // Clean up rings/squares if they exist
  rings.forEach(ring => {
    scene.remove(ring);
    if (ring.userData.isSquare) {
      ring.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    } else {
      if (ring.geometry) ring.geometry.dispose();
      if (ring.material) ring.material.dispose();
    }
  });
  rings = [];
  ringScales = [];
  
  // Create new elements based on selected shape
  if (params.shape === 'stars') {
    createStars();
  } else {
    const count = params.shape === 'squares' ? params.squareCount : params.ringCount;
    const spacing = params.shape === 'squares' ? params.squareSpacing : params.ringSpacing;
    
    for (let i = 0; i < count; i++) {
      const z = -(i * spacing);
      const ring = createRing(z, i);
      rings.push(ring);
      scene.add(ring);
      ringScales[i] = 1;
    }
  }
}

// Get current audio level from centralized audio system
function getAudioLevel() {
  if (!audioData || typeof audioData.amplitude === 'undefined') return 0;
  
  // Use amplitude from audioData
  const amplitude = audioData.amplitude || 0;
  return Math.min(amplitude, 1.0);
}

// Update camera position and rotation based on time and audio
function updateCamera(deltaTime) {
  audioLevel = getAudioLevel();
  smoothAudioLevel += (audioLevel - smoothAudioLevel) * params.audioSmoothingFactor;
  
  const curveX = Math.sin(time * params.curveFrequency) * params.curveAmplitude;
  const curveY = Math.cos(time * params.curveFrequency * 0.7) * params.curveAmplitude * 0.8;
  
  const audioInfluence = smoothAudioLevel * params.audioSensitivity;
  
  const shakeIntensity = Math.max(0, audioInfluence - 0.3) * 0.25;
  targetShakeX = Math.sin(time * 7.3) * shakeIntensity;
  targetShakeY = Math.cos(time * 6.7) * shakeIntensity;
  
  shakeX += (targetShakeX - shakeX) * params.shakeSmoothingFactor;
  shakeY += (targetShakeY - shakeY) * params.shakeSmoothingFactor;
  
  targetRotation.yaw = curveX * 0.05 + audioInfluence * Math.sin(time * 2) * 0.8;
  targetRotation.roll = -curveX * 0.08 + audioInfluence * Math.cos(time * 1.5) * 1.2;
  targetRotation.pitch = curveY * 0.03 + audioInfluence * Math.sin(time * 1.2) * 0.6;
  
  cameraRotation.yaw += (targetRotation.yaw - cameraRotation.yaw) * params.rotationSmoothingFactor;
  cameraRotation.roll += (targetRotation.roll - cameraRotation.roll) * params.rotationSmoothingFactor;
  cameraRotation.pitch += (targetRotation.pitch - cameraRotation.pitch) * params.rotationSmoothingFactor;
  
  camera.rotation.set(
    cameraRotation.pitch + shakeY,
    cameraRotation.yaw + shakeX,
    cameraRotation.roll
  );
  
  camera.position.x = curveX + audioInfluence * Math.cos(time * 1.8) * 8 + shakeX * 2;
  camera.position.y = curveY + audioInfluence * Math.sin(time * 2.2) * 6 + shakeY * 2;
}

// Update stars
function updateStars(deltaTime) {
  if (!stars || !stars.geometry) return;
  
  const positions = stars.geometry.attributes.position.array;
  const colors = stars.geometry.attributes.color.array;
  const baseVelocity = params.speed * deltaTime * 60 * (1 + smoothAudioLevel * params.audioSpeedMultiplier);
  
  if (params.colorMode === 'rainbow') {
    rainbowHue = (rainbowHue + deltaTime * 0.1) % 1;
  }
  
  const baseColor = new THREE.Color(params.elementColor);
  
  for (let i = 0; i < positions.length; i += 6) {
    const starIndex = i / 6;
    let velocity = baseVelocity;
    
    switch (params.flowDirection) {
      case 'reverse':
        velocity = -baseVelocity;
        break;
      case 'chaotic':
        if (audioLevel > 0.5 && Math.random() < 0.1) {
          starVelocities[starIndex] = (Math.random() - 0.5) * baseVelocity * 3;
        }
        velocity = starVelocities[starIndex] || baseVelocity;
        break;
      case 'orbital':
        velocity = baseVelocity;
        starAngles[starIndex] = (starAngles[starIndex] || 0) + deltaTime * params.spiralRotationSpeed;
        break;
    }
    
    positions[i + 2] += velocity;
    
    if (params.tunnelShape === 'spiral' || params.flowDirection === 'orbital') {
      const angle = starAngles[starIndex] + (positions[i + 2] / params.tunnelLength) * Math.PI * 4;
      const radius = Math.sqrt(positions[i] * positions[i] + positions[i + 1] * positions[i + 1]);
      positions[i] = Math.cos(angle) * radius;
      positions[i + 1] = Math.sin(angle) * radius;
    }
    
    if (params.tunnelShape === 'figure8') {
      const twist = (positions[i + 2] / params.tunnelLength) * Math.PI * params.figure8Twist;
      const radius = Math.sqrt(positions[i] * positions[i] + positions[i + 1] * positions[i + 1]);
      const baseAngle = starAngles[starIndex];
      const x = Math.cos(baseAngle) * radius;
      const y = Math.sin(baseAngle) * radius;
      const nx = x * Math.cos(twist) - y * Math.sin(twist);
      const ny = x * Math.sin(twist) + y * Math.cos(twist);
      positions[i] = nx;
      positions[i + 1] = ny;
    }
    
    if (params.tunnelShape.includes('funnel')) {
      const targetRadius = getRadiusAtZ(positions[i + 2]);
      const currentRadius = Math.sqrt(positions[i] * positions[i] + positions[i + 1] * positions[i + 1]);
      if (currentRadius > 0.01) {
        const scale = targetRadius / params.tunnelRadius;
        const angle = Math.atan2(positions[i + 1], positions[i]);
        const baseRadius = Math.sqrt(Math.pow(positions[i] / scale, 2) + Math.pow(positions[i + 1] / scale, 2));
        positions[i] = Math.cos(angle) * baseRadius * scale;
        positions[i + 1] = Math.sin(angle) * baseRadius * scale;
      }
    }
    
    const radiusFactor = Math.sqrt(positions[i] * positions[i] + positions[i + 1] * positions[i + 1]) / params.tunnelRadius;
    const newColor = getElementColor(baseColor, positions[i + 2], starIndex, radiusFactor);
    colors[i] = colors[i + 3] = newColor.r;
    colors[i + 1] = colors[i + 4] = newColor.g;
    colors[i + 2] = colors[i + 5] = newColor.b;
    
    const distanceFromCamera = Math.abs(positions[i + 2]);
    const fogFactor = 1 - Math.min(distanceFromCamera / params.tunnelLength, 1);
    const opacity = Math.pow(fogFactor, 2) * 0.8;
    
    const bloomBoost = 1 + smoothAudioLevel * 0.5;
    colors[i] = Math.min(colors[i] * bloomBoost * (opacity + 0.2), 1);
    colors[i + 1] = Math.min(colors[i + 1] * bloomBoost * (opacity + 0.2), 1);
    colors[i + 2] = Math.min(colors[i + 2] * bloomBoost * (opacity + 0.2), 1);
    colors[i + 3] = colors[i];
    colors[i + 4] = colors[i + 1];
    colors[i + 5] = colors[i + 2];
    
    positions[i + 5] = positions[i + 2] - params.lineLength;
    
    const wrapThreshold = params.flowDirection === 'reverse' ? -params.tunnelLength - params.wrapAroundThreshold : params.wrapAroundThreshold;
    const wrapCondition = params.flowDirection === 'reverse' ? positions[i + 2] < wrapThreshold : positions[i + 2] > wrapThreshold;
    
    if (wrapCondition) {
      positions[i + 2] = params.flowDirection === 'reverse' ? params.wrapAroundThreshold : -params.tunnelLength;
      positions[i + 5] = positions[i + 2] - params.lineLength;
      
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * getRadiusAtZ(positions[i + 2]);
      starAngles[starIndex] = angle;
      positions[i] = Math.cos(angle) * radius;
      positions[i + 1] = Math.sin(angle) * radius;
      positions[i + 3] = positions[i];
      positions[i + 4] = positions[i + 1];
      
      if (params.flowDirection === 'chaotic') {
        starVelocities[starIndex] = baseVelocity;
      }
    } else {
      positions[i + 3] = positions[i];
      positions[i + 4] = positions[i + 1];
    }
  }
  
  stars.geometry.attributes.position.needsUpdate = true;
  stars.geometry.attributes.color.needsUpdate = true;
}

// Update rings/squares
function updateRings(deltaTime) {
  const baseVelocity = params.speed * deltaTime * 60 * (1 + smoothAudioLevel * params.audioSpeedMultiplier);
  
  if (params.colorMode === 'rainbow') {
    rainbowHue = (rainbowHue + deltaTime * 0.1) % 1;
  }
  
  const baseColor = new THREE.Color(params.elementColor);
  
  rings.forEach((ring, index) => {
    ring.position.z += baseVelocity;
    
    const count = params.shape === 'squares' ? params.squareCount : params.ringCount;
    const spacing = params.shape === 'squares' ? params.squareSpacing : params.ringSpacing;
    
    if (ring.position.z > 10) {
      ring.position.z = -(count * spacing);
      ring.userData.baseZ = ring.position.z;
      if (ringScales[index] !== undefined) {
        ringScales[index] = 1;
      }
    }
    
    const distanceFromCamera = Math.abs(ring.position.z);
    const normalizedDistance = Math.min(distanceFromCamera / params.tunnelLength, 1);
    
    const perspectiveScale = 1 / (1 + distanceFromCamera * 0.05);
    const minScale = 0.3;
    const maxScale = 3.0;
    const perspectiveScaleClamped = Math.max(minScale, Math.min(maxScale, perspectiveScale));
    
    if (ring.userData.isSquare) {
      const targetSize = params.squareSize * 2;
      const face = ring.children[0];
      const borders = ring.userData.borders || [ring.children[1], ring.children[2], ring.children[3], ring.children[4]];
      
      if (face && face.geometry.parameters.width !== targetSize) {
        const oldFaceGeometry = face.geometry;
        face.geometry = new THREE.PlaneGeometry(targetSize, targetSize);
        oldFaceGeometry.dispose();
        
        const borderThickness = params.borderThickness * 0.1;
        
        if (borders[0]) {
          const oldGeo = borders[0].geometry;
          borders[0].geometry = new THREE.PlaneGeometry(targetSize, borderThickness);
          borders[0].position.y = targetSize / 2;
          oldGeo.dispose();
        }
        
        if (borders[1]) {
          const oldGeo = borders[1].geometry;
          borders[1].geometry = new THREE.PlaneGeometry(targetSize, borderThickness);
          borders[1].position.y = -targetSize / 2;
          oldGeo.dispose();
        }
        
        if (borders[2]) {
          const oldGeo = borders[2].geometry;
          borders[2].geometry = new THREE.PlaneGeometry(borderThickness, targetSize);
          borders[2].position.x = -targetSize / 2;
          oldGeo.dispose();
        }
        
        if (borders[3]) {
          const oldGeo = borders[3].geometry;
          borders[3].geometry = new THREE.PlaneGeometry(borderThickness, targetSize);
          borders[3].position.x = targetSize / 2;
          oldGeo.dispose();
        }
        
        ring.userData.size = targetSize;
      }
      
      if (ring.userData.borderThickness !== params.borderThickness) {
        const borderThickness = params.borderThickness * 0.1;
        const currentSize = ring.userData.size || targetSize;
        
        borders.forEach((border, idx) => {
          if (border) {
            const oldGeo = border.geometry;
            if (idx < 2) {
              border.geometry = new THREE.PlaneGeometry(currentSize, borderThickness);
            } else {
              border.geometry = new THREE.PlaneGeometry(borderThickness, currentSize);
            }
            oldGeo.dispose();
          }
        });
        ring.userData.borderThickness = params.borderThickness;
      }
      
      let rotationSpeed = params.rotationSpeed;
      if (params.rotationDirection === 'alternating') {
        rotationSpeed *= (index % 2 === 0) ? 1 : -1;
      } else if (params.rotationDirection === 'reverse') {
        rotationSpeed *= -1;
      }
      
      if (params.rotationAxis.includes('x')) {
        ring.rotation.x += rotationSpeed * deltaTime;
      }
      if (params.rotationAxis.includes('y')) {
        ring.rotation.y += rotationSpeed * deltaTime;
      }
      if (params.rotationAxis.includes('z')) {
        ring.rotation.z += rotationSpeed * deltaTime;
      }
      
      ring.scale.setScalar(perspectiveScaleClamped * ringScales[index]);
      
      const newColor = getElementColor(baseColor, ring.position.z, index, null);
      face.material.color.copy(newColor);
      borders.forEach(border => {
        if (border && border.material) {
          border.material.color.copy(newColor);
        }
      });
      
      const opacity = Math.pow(1 - normalizedDistance, 2) * 0.9;
      face.material.opacity = opacity * 0.1;
      
      borders.forEach(border => {
        if (border && border.material) {
          border.material.opacity = opacity * 0.9;
        }
      });
    } else {
      const targetRadius = getRadiusAtZ(ring.position.z);
      if (ring.geometry && ring.geometry.parameters && ring.geometry.parameters.radius !== targetRadius) {
        const oldGeometry = ring.geometry;
        ring.geometry = new THREE.TorusGeometry(targetRadius, params.ringThickness, 8, 64);
        oldGeometry.dispose();
      }
      
      ring.scale.setScalar(perspectiveScaleClamped * ringScales[index]);
      
      const newColor = getElementColor(baseColor, ring.position.z, index, null);
      ring.material.color.copy(newColor);
      
      if (params.tunnelShape === 'spiral' || params.tunnelShape === 'figure8') {
        const angle = (ring.position.z / params.tunnelLength) * Math.PI * 4;
        ring.rotation.z = angle;
      }
      
      const opacity = Math.pow(1 - normalizedDistance, 2) * 0.9;
      ring.material.opacity = opacity;
    }
  });
}

// Main render loop
let lastTime = performance.now();
function renderLoop() {
  animationId = requestAnimationFrame(renderLoop);
  
  const currentTime = performance.now();
  let deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  
  deltaTime = Math.min(deltaTime, 0.05);
  
  if (isAnimating) {
    time += deltaTime;
    updateCamera(deltaTime);
    if (params.shape === 'stars') {
      updateStars(deltaTime);
    } else {
      updateRings(deltaTime);
    }
  }
  
  renderer.render(scene, camera);
}

// Handle window resize
function handleResize() {
  if (!container || !camera || !renderer) return;
  
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  if (width === 0 || height === 0) return;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Handle parameter messages
function handleParamMessage(event) {
  if (event.data && event.data.type === 'PARAM_CHANGE') {
    const { param, value } = event.data;
    
    if (param === 'elementColor' || param === 'backgroundColor') {
      updateParams({ [param]: value });
    } else if (param === 'shape' || param === 'tunnelShape' || 
               param === 'starDensity' || param === 'ringCount' || param === 'squareCount' ||
               param === 'ringSpacing' || param === 'squareSpacing' ||
               param === 'ringRadius' || param === 'ringThickness') {
      updateParams({ [param]: value });
      createElements();
    } else if (param === 'colorMode' && params.shape === 'stars') {
      updateParams({ [param]: value });
      createStars();
    } else {
      updateParams({ [param]: value });
    }
  }
}

/**
 * Initialize module
 */
export function initModule({ container: containerElement, audio, controlsChannel: channel }) {
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
  
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;
  const aspect = width / height;
  
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.z = 5; // Position camera to see the tunnel
  
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setClearColor(new THREE.Color(params.backgroundColor), 1);
  renderer.autoClear = true;
  
  container.appendChild(renderer.domElement);
  
  createElements();
  
  // Handle resize
  window.addEventListener('resize', handleResize);
  
  // Auto-start animation
  start();
}

/**
 * Start animation
 */
export function start() {
  isAnimating = true;
  lastTime = performance.now();
  if (!animationId) {
    renderLoop();
  }
}

/**
 * Stop animation
 */
export function stop() {
  isAnimating = false;
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
  
  // Clean up Three.js resources
  if (stars) {
    scene.remove(stars);
    stars.geometry.dispose();
    stars.material.dispose();
    stars = null;
  }
  
  rings.forEach(ring => {
    scene.remove(ring);
    if (ring.userData.isSquare) {
      ring.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    } else {
      if (ring.geometry) ring.geometry.dispose();
      if (ring.material) ring.material.dispose();
    }
  });
  rings = [];
  
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
    newParams.shape !== undefined ||
    newParams.tunnelShape !== undefined ||
    newParams.starDensity !== undefined ||
    newParams.ringCount !== undefined ||
    newParams.squareCount !== undefined ||
    newParams.ringSpacing !== undefined ||
    newParams.squareSpacing !== undefined ||
    newParams.ringRadius !== undefined ||
    newParams.tunnelRadius !== undefined ||
    newParams.ringThickness !== undefined ||
    newParams.elementColor !== undefined ||
    newParams.backgroundColor !== undefined ||
    (newParams.colorMode !== undefined && params.shape === 'stars');
  
  Object.assign(params, newParams);
  
  // Convert hex colors to numbers
  if (newParams.elementColor && typeof newParams.elementColor === 'string') {
    params.elementColor = newParams.elementColor;
  }
  if (newParams.backgroundColor && typeof newParams.backgroundColor === 'string') {
    params.backgroundColor = newParams.backgroundColor;
    if (renderer) {
      renderer.setClearColor(new THREE.Color(params.backgroundColor), 1);
    }
  }
  
  if (needsRecreate && scene) {
    createElements();
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