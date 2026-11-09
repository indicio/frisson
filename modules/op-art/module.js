/**
 * Op Art Module
 * Audio-reactive striped cubes/spheres visualization with op-art patterns
 */

import * as THREE from '../../shared/libs/three-r161/three.module.js';

let scene = null;
let camera = null;
let renderer = null;
let container = null;
let audioData = null;
let controlsChannel = null;
let animationId = null;
let cubeGroup = null;
let cubes = [];
let stripeMaterial = null;

// Configuration
let params = {
  cubeCount: 16,
  cubeSize: 2.5,
  sizeVariation: 0.0, // 0 = uniform size, 1 = maximum variation
  cubeOpacity: 1.0,
  geometryType: 'cubes', // 'cubes', 'spheres', 'mixed'
  intersectionChaos: 0.5,
  distributionDensity: 0.5,
  animationRate: 1.0,
  stripeWidth: 0.2,
  stripeAngle: 0,
  color1: '#000000',
  color2: '#ffffff',
  rotationSensitivity: 2.0,
  orbitSensitivity: 1.5,
  scaleSensitivity: 0.3,
  backgroundColor: '#000000',
  wireframe: false
};

// Audio variables
let audioAmplitude = 0;

// Shader Material for Procedural Stripes
const stripeVertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vPosition = position;
    vNormal = normal;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const stripeFragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uStripeWidth;
  uniform float uStripeAngle;
  uniform float uAudioIntensity;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    // Rotate UV coordinates based on stripe angle
    float angle = radians(uStripeAngle);
    float cosA = cos(angle);
    float sinA = sin(angle);
    
    // Rotate the UV space
    vec2 rotatedUV = vec2(
      vUv.x * cosA - vUv.y * sinA,
      vUv.x * sinA + vUv.y * cosA
    );
    
    // Create stripes along the rotated axis
    float stripe = mod(rotatedUV.y / uStripeWidth, 2.0);
    
    // Alternate between colors based on stripe pattern
    vec3 color = mix(uColor1, uColor2, step(1.0, stripe));
    
    // Modulate brightness with audio intensity
    color *= (1.0 + uAudioIntensity * 0.5);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Create stripe material
 */
function createStripeMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: stripeVertexShader,
    fragmentShader: stripeFragmentShader,
    uniforms: {
      uColor1: { value: new THREE.Color(params.color1) },
      uColor2: { value: new THREE.Color(params.color2) },
      uStripeWidth: { value: params.stripeWidth },
      uStripeAngle: { value: params.stripeAngle },
      uAudioIntensity: { value: 0 }
    },
    transparent: false,
    opacity: 1.0,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending
  });
}

/**
 * Create cubes/spheres
 */
function createCubes() {
  // Clear existing cubes
  cubes.forEach(cube => {
    cubeGroup.remove(cube.mesh);
  });
  cubes = [];

  // Determine geometry type for each object
  const isMixed = params.geometryType === 'mixed';
  const useSpheres = params.geometryType === 'spheres';

  // For mixed mode, create a balanced distribution
  let geometryTypes = [];
  if (isMixed) {
    const halfCount = Math.floor(params.cubeCount / 2);
    const sphereCount = params.cubeCount - halfCount;
    
    for (let i = 0; i < halfCount; i++) {
      geometryTypes.push('cube');
    }
    for (let i = 0; i < sphereCount; i++) {
      geometryTypes.push('sphere');
    }
    
    // Shuffle the array for random distribution
    for (let i = geometryTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [geometryTypes[i], geometryTypes[j]] = [geometryTypes[j], geometryTypes[i]];
    }
  }

  // Distribution density affects base radius and variation
  const densityFactor = 1.0 - params.distributionDensity;
  const baseRadius = 2.0 + densityFactor * 2.0;
  const baseRadiusVariation = 1.0 + densityFactor * 2.0;

  // Create objects with intersecting orbits
  for (let i = 0; i < params.cubeCount; i++) {
    let geometry;
    let isSphere = false;

    if (isMixed) {
      isSphere = geometryTypes[i] === 'sphere';
    } else {
      isSphere = useSpheres;
    }

    // Apply size variation (0 = no variation, 1 = max variation ±50%)
    const sizeVariationFactor = params.sizeVariation * 0.5; // Max ±50% variation
    const sizeMultiplier = 1.0 + (Math.random() - 0.5) * sizeVariationFactor * 2; // Range: 1.0 ± sizeVariationFactor
    const actualSize = params.cubeSize * sizeMultiplier;

    if (isSphere) {
      geometry = new THREE.SphereGeometry(
        actualSize / 2,
        32,
        32
      );
    } else {
      geometry = new THREE.BoxGeometry(
        actualSize,
        actualSize,
        actualSize
      );
    }

    const material = stripeMaterial.clone();
    material.wireframe = params.wireframe;
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Configure orbit parameters based on distribution density
    const radiusVariation = baseRadiusVariation * params.intersectionChaos;
    let radius = baseRadius + (Math.random() - 0.5) * radiusVariation;
    
    if (isSphere) {
      radius *= 1.3;
    }
    
    const baseHeightVariation = 1.0 + densityFactor * 2.0;
    const heightVariation = baseHeightVariation * params.intersectionChaos;
    let height = (Math.random() - 0.5) * heightVariation;
    
    if (isSphere) {
      height *= 1.3;
    }
    
    const phase = (Math.random() * Math.PI * 2);
    const orbitSpeed = 0.3 + Math.random() * 0.4;
    
    const rotationSpeed = {
      x: (Math.random() - 0.5) * 0.02,
      y: (Math.random() - 0.5) * 0.02,
      z: (Math.random() - 0.5) * 0.02
    };

    const cubeData = {
      mesh,
      radius,
      height,
      phase,
      orbitSpeed,
      rotationSpeed,
      baseRotation: {
        x: Math.random() * Math.PI * 2,
        y: Math.random() * Math.PI * 2,
        z: Math.random() * Math.PI * 2
      },
      orbitAngle: phase,
      baseScale: sizeMultiplier, // Store the size multiplier for animation scaling
      isSphere
    };

    cubes.push(cubeData);
    cubeGroup.add(mesh);
  }
}

/**
 * Process audio data
 */
function processAudioData() {
  if (!audioData) {
    audioAmplitude = 0;
    return;
  }

  try {
    const fftData = audioData.getFFTData ? audioData.getFFTData() : null;
    
    if (fftData && fftData.length > 0) {
      let sum = 0;
      for (let i = 0; i < fftData.length; i++) {
        sum += fftData[i];
      }
      const rawAmplitude = (sum / fftData.length) / 255;
      // Square root for smoother response
      audioAmplitude = Math.pow(rawAmplitude, 0.5);
    } else {
      audioAmplitude = 0;
    }
  } catch (e) {
    console.warn('Error getting audio data:', e);
    audioAmplitude = 0;
  }
}

/**
 * Animation loop
 */
function animate() {
  animationId = requestAnimationFrame(animate);

  // Update audio data
  processAudioData();

  // Update shader uniform with audio intensity
  const audioIntensity = audioAmplitude;
  stripeMaterial.uniforms.uAudioIntensity.value = audioIntensity;
  cubes.forEach(cube => {
    cube.mesh.material.uniforms.uAudioIntensity.value = audioIntensity;
  });

  // Update each object
  cubes.forEach(cube => {
    // Audio-reactive rotation speed
    const rotationMultiplier = (1 + audioAmplitude * params.rotationSensitivity) * params.animationRate;
    cube.baseRotation.x += cube.rotationSpeed.x * rotationMultiplier;
    cube.baseRotation.y += cube.rotationSpeed.y * rotationMultiplier;
    cube.baseRotation.z += cube.rotationSpeed.z * rotationMultiplier;

    // Audio-reactive orbit speed
    const orbitMultiplier = (1 + audioAmplitude * params.orbitSensitivity) * params.animationRate;
    cube.orbitAngle += cube.orbitSpeed * orbitMultiplier * 0.01;

    // Calculate orbit position
    const x = Math.cos(cube.orbitAngle) * cube.radius;
    const z = Math.sin(cube.orbitAngle) * cube.radius;
    const y = cube.height + Math.sin(cube.orbitAngle * 0.7) * 0.3;

    // Apply orbit position
    cube.mesh.position.set(x, y, z);

    // Apply rotation
    cube.mesh.rotation.set(
      cube.baseRotation.x,
      cube.baseRotation.y,
      cube.baseRotation.z
    );

                // Audio-reactive scale pulsing (using stored baseScale multiplier)
                const scalePulse = 1 + audioAmplitude * params.scaleSensitivity;
                const baseScale = (params.cubeSize / 2.5) * cube.baseScale;
                cube.mesh.scale.setScalar(baseScale * scalePulse);
  });

  // Rotate the entire group slowly
  cubeGroup.rotation.y += 0.002 * params.animationRate;

  // Render
  renderer.render(scene, camera);
}

/**
 * Handle resize
 */
function onWindowResize() {
  if (!container || !camera || !renderer) return;
  
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
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
  window.addEventListener('resize', onWindowResize);
  
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(params.backgroundColor);

  // Camera setup
  camera = new THREE.PerspectiveCamera(
    75,
    (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
    0.1,
    1000
  );
  camera.position.set(0, 0, 12);

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  // Create stripe material
  stripeMaterial = createStripeMaterial();

  // Create cube group
  cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  // Initial cube creation
  createCubes();

  // Set background color
  container.style.backgroundColor = params.backgroundColor;
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
  window.removeEventListener('resize', onWindowResize);
  
  if (controlsChannel) {
    controlsChannel.close();
  }
  
  if (renderer) {
    renderer.dispose();
    if (container && renderer.domElement) {
      container.removeChild(renderer.domElement);
    }
  }
  
  // Dispose materials and geometries
  cubes.forEach(cube => {
    if (cube.mesh.material) cube.mesh.material.dispose();
    if (cube.mesh.geometry) cube.mesh.geometry.dispose();
  });
  
  if (stripeMaterial) {
    stripeMaterial.dispose();
  }
  
  scene = null;
  camera = null;
  renderer = null;
  container = null;
  audioData = null;
  controlsChannel = null;
  cubeGroup = null;
  cubes = [];
  stripeMaterial = null;
}

/**
 * Update parameters
 */
export function updateParams(newParams) {
  Object.assign(params, newParams);
  
  if (scene) {
    if (newParams.backgroundColor !== undefined) {
      scene.background.set(params.backgroundColor);
      if (container) {
        container.style.backgroundColor = params.backgroundColor;
      }
    }
  }
  
  if (stripeMaterial) {
    if (newParams.color1 !== undefined) {
      stripeMaterial.uniforms.uColor1.value.set(params.color1);
      cubes.forEach(cube => {
        cube.mesh.material.uniforms.uColor1.value.set(params.color1);
      });
    }
    if (newParams.color2 !== undefined) {
      stripeMaterial.uniforms.uColor2.value.set(params.color2);
      cubes.forEach(cube => {
        cube.mesh.material.uniforms.uColor2.value.set(params.color2);
      });
    }
    if (newParams.stripeWidth !== undefined) {
      stripeMaterial.uniforms.uStripeWidth.value = params.stripeWidth;
      cubes.forEach(cube => {
        cube.mesh.material.uniforms.uStripeWidth.value = params.stripeWidth;
      });
    }
    if (newParams.stripeAngle !== undefined) {
      stripeMaterial.uniforms.uStripeAngle.value = params.stripeAngle;
      cubes.forEach(cube => {
        cube.mesh.material.uniforms.uStripeAngle.value = params.stripeAngle;
      });
    }
    if (newParams.wireframe !== undefined) {
      stripeMaterial.wireframe = params.wireframe;
      cubes.forEach(cube => {
        cube.mesh.material.wireframe = params.wireframe;
      });
    }
  }
  
  // Recreate cubes if geometry-related params changed
  if (newParams.cubeCount !== undefined || 
      newParams.geometryType !== undefined || 
      newParams.intersectionChaos !== undefined || 
      newParams.distributionDensity !== undefined ||
      newParams.sizeVariation !== undefined) {
    createCubes();
  }
  
  // Update cube size (only if size variation is 0, otherwise recreate for proper variation)
  if (newParams.cubeSize !== undefined) {
    if (params.sizeVariation === 0) {
      cubes.forEach(cube => {
        const baseScale = params.cubeSize / 2.5;
        cube.mesh.scale.setScalar(baseScale);
      });
    } else {
      // If size variation is active, recreate to apply new base size with variation
      createCubes();
    }
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

