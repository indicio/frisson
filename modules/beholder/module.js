import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

let host = null;
let controlsChannel = null;
let audioAPI = null;
let renderer = null;
let scene = null;
let camera = null;
let composer = null;
let bloomPass = null;
let ambientLight = null;
let rimLight = null;
let keyLight = null;
let animationId = null;
let clock = null;
let micContext = null;
let micAnalyser = null;
let micData = null;
let micStream = null;
let sharedEyeTexture = null;
let fallbackEyeTexture = null;

/** @type {Array<{ mesh: THREE.Mesh, basePos: THREE.Vector3, phase: number, driftFreq: number, targetRot: {x:number,y:number}, lastSaccade: number, saccadeInterval: number, radius:number, isAlpha:boolean }>} */
let eyes = [];

const params = {
  focus: 10.0,
  aperture: 0.02,
  maxblur: 0.01,
  autoTrack: true,
  rimColor: '#ff1100',
  dynamicLights: 250,
  ambientLight: 1.0,
  eyeHue: 0.0,
  bgColor: '#080808',
  fogDensity: 0.015,
  swarmCount: 15,
  baseSize: 1.0,
  soloMode: false,
  enableAmbient: true,
  maxTransposition: 1.2,
  ambientSpeed: 1.0,
  moveInConcert: false,
  useMicrophone: false,
};

function createEyeTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const x = c.getContext('2d');
  if (!x) return null;

  const cx = 256;
  const cy = 256;
  const sclera = x.createRadialGradient(cx, cy, 32, cx, cy, 250);
  sclera.addColorStop(0, '#ffffff');
  sclera.addColorStop(0.7, '#e7e7e7');
  sclera.addColorStop(1, '#cfcfcf');
  x.fillStyle = sclera;
  x.fillRect(0, 0, 512, 512);

  // Keep iris relatively compact to match original reference proportions.
  const iris = x.createRadialGradient(cx, cy, 8, cx, cy, 98);
  iris.addColorStop(0, '#48d9ff');
  iris.addColorStop(0.45, '#1b79d4');
  iris.addColorStop(0.85, '#13255f');
  iris.addColorStop(1, '#08102a');
  x.fillStyle = iris;
  x.beginPath();
  x.arc(cx, cy, 96, 0, Math.PI * 2);
  x.fill();

  x.fillStyle = '#000';
  x.beginPath();
  x.arc(cx, cy, 26, 0, Math.PI * 2);
  x.fill();

  x.strokeStyle = 'rgba(255,255,255,0.12)';
  x.lineWidth = 2;
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const r0 = 30;
    const r1 = 94;
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    x.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    x.stroke();
  }

  // Slight vignette toward edge to keep sclera shape readable on sphere.
  const vignette = x.createRadialGradient(cx, cy, 170, cx, cy, 256);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
  x.fillStyle = vignette;
  x.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ensureFallbackTexture() {
  if (!fallbackEyeTexture) fallbackEyeTexture = createEyeTexture();
  return fallbackEyeTexture;
}

function loadEyeTexture() {
  if (sharedEyeTexture) return Promise.resolve(sharedEyeTexture);
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    const url = new URL('./eye-texture.png', import.meta.url).href;
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        sharedEyeTexture = tex;
        resolve(sharedEyeTexture);
      },
      undefined,
      () => {
        console.warn('[beholder] eye-texture.png missing; using procedural fallback');
        sharedEyeTexture = ensureFallbackTexture();
        resolve(sharedEyeTexture);
      }
    );
  });
}

function clearEyes() {
  for (const e of eyes) {
    scene.remove(e.mesh);
    e.mesh.geometry.dispose();
    if (Array.isArray(e.mesh.material)) {
      e.mesh.material.forEach((m) => m.dispose());
    } else {
      e.mesh.material.dispose();
    }
  }
  eyes = [];
}

function isOverlapping(pos, radius) {
  const buffer = 1.2;
  for (const eye of eyes) {
    if (pos.distanceTo(eye.basePos) < (radius + eye.radius + buffer)) return true;
  }
  return false;
}

async function createEye(x, y, z, scaleMultiplier, isAlpha = false) {
  const radius = params.baseSize * scaleMultiplier;
  const geometry = new THREE.SphereGeometry(radius, 48, 48);
  const texture = await loadEyeTexture();
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.15,
    metalness: 0.2,
    bumpMap: texture,
    bumpScale: 0.05,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uAudioLevel = { value: 0 };
    shader.uniforms.uHue = { value: 0 };
    shader.vertexShader = `varying vec2 vUv;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv = uv;');
    shader.fragmentShader = `
      uniform float uAudioLevel; uniform float uHue;
      varying vec2 vUv;
      vec3 applyHue(vec3 color, float h) {
        vec3 k = vec3(0.57735); float c = cos(h);
        return color * c + cross(k, color) * sin(h) + k * dot(k, color) * (1.0 - c);
      }\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 uv = vUv; float dist = distance(uv, vec2(0.5));
      if(dist < 0.25) uv = mix(uv, vec2(0.5), uAudioLevel * 0.45);
      vec4 texColor = texture2D(map, uv);
      if(dist < 0.45) texColor.rgb = applyHue(texColor.rgb, uHue);
      diffuseColor *= texColor;
    `);
    material.userData.shader = shader;
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = -Math.PI / 2;
  scene.add(mesh);
  eyes.push({
    mesh,
    isAlpha,
    radius,
    basePos: new THREE.Vector3(x, y, z),
    phase: Math.random() * 6.28,
    driftFreq: 0.3 + Math.random() * 0.7,
    targetRot: { x: 0, y: -Math.PI / 2 },
    lastSaccade: Math.random() * 2000,
    saccadeInterval: 2000 + Math.random() * 3000,
  });
}

async function rebuildEyes() {
  clearEyes();
  if (params.soloMode) {
    await createEye(0, 0, 10, 4.0, true);
    return;
  }
  await createEye(0, 0, 12, 1.2, true);
  for (let i = 0; i < params.swarmCount; i++) {
    let foundSpot = false;
    let attempts = 0;
    while (!foundSpot && attempts < 100) {
      const x = (Math.random() - 0.5) * 45;
      const y = (Math.random() - 0.5) * 35;
      const z = (Math.random() - 0.5) * 50;
      const scale = 0.5 + Math.random();
      if (!isOverlapping(new THREE.Vector3(x, y, z), params.baseSize * scale)) {
        await createEye(x, y, z, scale);
        foundSpot = true;
      }
      attempts++;
    }
  }
}

function getAudioLevel() {
  const apiLevel = audioAPI?.getAudioLevel?.();
  if (typeof apiLevel === 'number') return Math.max(0, Math.min(1, apiLevel));
  if (micAnalyser && micData) {
    micAnalyser.getByteFrequencyData(micData);
    const sum = micData.reduce((a, b) => a + b, 0);
    return (sum / micData.length) / 255;
  }
  return 0;
}

async function onParamChange(param, value) {
  params[param] = value;
  if (param === 'bgColor') {
    const c = new THREE.Color(value);
    scene.background = c;
    if (scene.fog) scene.fog.color = c;
  } else if (param === 'fogDensity') {
    if (scene.fog) scene.fog.density = value;
  } else if (param === 'ambientLight') {
    if (ambientLight) ambientLight.intensity = value;
  } else if (param === 'rimColor') {
    if (rimLight) rimLight.color.set(value);
  } else if (param === 'dynamicLights') {
    if (rimLight) rimLight.intensity = value;
    if (keyLight) keyLight.intensity = value * 1.5;
  } else if (param === 'focus') {
    if (bloomPass) bloomPass.strength = Math.max(0, Math.min(3, (100 - value) / 40));
  } else if (param === 'aperture') {
    if (bloomPass) bloomPass.radius = Math.max(0, Math.min(1, value * 10));
  } else if (param === 'maxblur') {
    if (bloomPass) bloomPass.threshold = Math.max(0, Math.min(1, 1 - value * 20));
  } else if (['swarmCount', 'baseSize', 'soloMode', 'rebuildEyes'].includes(param)) {
    await rebuildEyes();
  }
}

function handleParamMessage(event) {
  if (event.data?.type === 'PARAM_CHANGE') {
    void onParamChange(event.data.param, event.data.value);
  }
}

function resize() {
  if (!host || !camera || !renderer || !composer) return;
  const w = Math.max(1, host.clientWidth);
  const h = Math.max(1, host.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
}

function animate() {
  animationId = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const audioLevel = getAudioLevel();
  let foremostZ = -Infinity;

  for (const eyeObj of eyes) {
    const mesh = eyeObj.mesh;
    if (params.enableAmbient) {
      const s = params.ambientSpeed * eyeObj.driftFreq;
      const r = params.maxTransposition;
      mesh.position.x = eyeObj.basePos.x + Math.sin(t * s + eyeObj.phase) * r;
      mesh.position.y = eyeObj.basePos.y + Math.cos(t * s * 0.8 + eyeObj.phase) * r;
      mesh.position.z = eyeObj.basePos.z + Math.sin(t * s * 1.2 + eyeObj.phase) * (r * 0.5);
    }

    if (mesh.position.z > foremostZ) foremostZ = mesh.position.z;

    if (mesh.material?.userData?.shader) {
      mesh.material.userData.shader.uniforms.uAudioLevel.value = audioLevel;
      mesh.material.userData.shader.uniforms.uHue.value = params.eyeHue;
    }

    const rotS = (eyeObj.isAlpha || !params.moveInConcert) ? 0.08 : 0.12;
    const nowMs = performance.now();
    if (eyeObj.isAlpha || !params.moveInConcert) {
      if (nowMs - eyeObj.lastSaccade > eyeObj.saccadeInterval) {
        eyeObj.targetRot.x = (Math.random() - 0.5) * 0.7;
        eyeObj.targetRot.y = -Math.PI / 2 + (Math.random() - 0.5) * 1.0;
        eyeObj.lastSaccade = nowMs;
      }
    } else if (eyes[0]) {
      eyeObj.targetRot.x = eyes[0].targetRot.x;
      eyeObj.targetRot.y = eyes[0].targetRot.y;
    }
    mesh.rotation.x += (eyeObj.targetRot.x - mesh.rotation.x) * rotS;
    mesh.rotation.y += (eyeObj.targetRot.y - mesh.rotation.y) * rotS;
  }

  if (params.autoTrack && Number.isFinite(foremostZ)) {
    const targetFocus = camera.position.z - foremostZ;
    params.focus += (targetFocus - params.focus) * 0.05;
    if (bloomPass) bloomPass.strength = Math.max(0, Math.min(3, (100 - params.focus) / 40));
  }

  composer.render();
}

export async function initModule({ container: containerElement, audio, controlsChannel: channel }) {
  host = containerElement;
  audioAPI = audio;
  controlsChannel = channel;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(params.bgColor);
  scene.fog = new THREE.FogExp2(params.bgColor, params.fogDensity);

  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.set(0, 0, 25);
  clock = new THREE.Clock();

  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.innerHTML = '';
  host.appendChild(renderer.domElement);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(host.clientWidth || 640, host.clientHeight || 360),
    0.9,
    0.2,
    0.45
  );
  composer.addPass(bloomPass);

  ambientLight = new THREE.AmbientLight(0xffffff, params.ambientLight);
  scene.add(ambientLight);

  rimLight = new THREE.PointLight(params.rimColor, params.dynamicLights);
  rimLight.position.set(-25, 15, -10);
  scene.add(rimLight);

  keyLight = new THREE.SpotLight(0xffffff, params.dynamicLights * 1.5);
  keyLight.position.set(25, 25, 40);
  scene.add(keyLight);

  await rebuildEyes();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('message', handleParamMessage);
  if (controlsChannel) controlsChannel.addEventListener('message', handleParamMessage);
}

export function start() {
  if (!animationId) animate();
}

export function stop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

export function destroy() {
  stop();
  window.removeEventListener('resize', resize);
  window.removeEventListener('message', handleParamMessage);
  if (controlsChannel) controlsChannel.removeEventListener('message', handleParamMessage);
  clearEyes();
  if (composer) composer.dispose();
  if (renderer) renderer.dispose();
  if (renderer?.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  if (micContext && micContext.state !== 'closed') micContext.close();

  host = null;
  controlsChannel = null;
  audioAPI = null;
  renderer = null;
  scene = null;
  camera = null;
  composer = null;
  bloomPass = null;
  ambientLight = null;
  rimLight = null;
  keyLight = null;
  micContext = null;
  micAnalyser = null;
  micData = null;
  micStream = null;
}

export function updateParams(newParams) {
  Object.entries(newParams || {}).forEach(([k, v]) => {
    void onParamChange(k, v);
  });
}

if (typeof window !== 'undefined') {
  window.moduleAPI = { initModule, start, stop, destroy, updateParams };
}
