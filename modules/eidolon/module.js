import { SplatRenderer } from './src/SplatRenderer.js';
import { SplatState } from './src/SplatState.js';
import { loadPlyBuffer, extractMeshData } from './src/SplatLoader.js';
import { DeformationEngine } from './src/DeformationEngine.js';
import { PhysicsEngine } from './src/PhysicsEngine.js';
import { AudioEnvelope } from './src/AudioEnvelope.js';
import { AudioMapper } from './src/AudioMapper.js';
import { CameraController } from './src/CameraController.js';
import { PresetManager } from './src/PresetManager.js';
import { cloneParams, DEFAULT_PARAMS } from './src/params.js';

let container = null;
let audioAPI = null;
let controlsChannel = null;
let renderer = null;
let cameraController = null;
let splatState = new SplatState();
let deformationEngine = new DeformationEngine();
let physicsEngine = new PhysicsEngine();
let audioEnvelope = new AudioEnvelope();
let audioMapper = new AudioMapper();

let params = cloneParams(DEFAULT_PARAMS);
params = PresetManager.apply('default', params);

let animationId = null;
let clock = { last: 0 };
let isPaused = false;
let loadStatus = 'idle';
let loadMessage = 'Drop a .ply Gaussian Splat file';
let animReconstruction = null;
let animExplosion = null;
/** @type {Float32Array|null} */
let uploadBuffer = null;

function setStatus(status, message) {
  loadStatus = status;
  loadMessage = message;
  updateOverlay();
}

function updateOverlay() {
  const el = document.getElementById('eidolon-overlay');
  if (!el) return;
  if (loadStatus === 'idle' || loadStatus === 'error') {
    el.classList.remove('hidden');
    el.querySelector('.msg').textContent = loadMessage;
  } else if (loadStatus === 'loading') {
    el.classList.remove('hidden');
    el.querySelector('.msg').textContent = loadMessage;
  } else {
    el.classList.add('hidden');
  }
}

async function loadPlyFile(file) {
  if (!file || !renderer) return;
  const name = file.name.toLowerCase();
  if (!name.endsWith('.ply')) {
    setStatus('error', 'Unsupported file — use Gaussian Splat .ply');
    return;
  }

  setStatus('loading', `Loading ${file.name}…`);
  try {
    const buf = await file.arrayBuffer();
    const splatBuffer = await loadPlyBuffer(buf, (p) => {
      setStatus('loading', `Loading ${file.name}… ${Math.round(p * 100)}%`);
    });

    await renderer.loadSplatBuffer(splatBuffer);
    const data = extractMeshData(renderer.dropIn);
    if (!data) throw new Error('Failed to read splat data');

    splatState.dispose();
    splatState = new SplatState();
    splatState.initFromCenters(data.centers, {
      scales: data.scales,
      rotations: data.rotations,
      colors: data.colors,
    });
    applyPerformanceSampling();

    setStatus('ready', '');
    updateOverlay();
  } catch (err) {
    console.error('[eidolon] load failed:', err);
    const msg = err?.message || String(err);
    setStatus('error', msg.includes('Ply') || msg.includes('ply') || msg.includes('format')
      ? `${msg} — use a 3D Gaussian Splat .ply (INRIA / standard splat format)`
      : msg || 'Failed to load PLY');
  }
}

function applyPerformanceSampling() {
  splatState.setActiveSampling(params.samplingPercent, params.maxSplatCount || 0);
}

function tick(now) {
  if (isPaused) return;
  const dt = Math.min(0.05, (now - clock.last) / 1000 || 0.016);
  clock.last = now;
  const time = now / 1000;

  if (animReconstruction !== null) {
    params.reconstruction += (animReconstruction - params.reconstruction) * Math.min(1, dt * 3);
    if (Math.abs(params.reconstruction - animReconstruction) < 0.002) {
      params.reconstruction = animReconstruction;
      animReconstruction = null;
    }
  }
  if (animExplosion !== null) {
    params.explosionAmount += (animExplosion - params.explosionAmount) * Math.min(1, dt * 4);
    if (Math.abs(params.explosionAmount - animExplosion) < 0.002) {
      params.explosionAmount = animExplosion;
      animExplosion = null;
    }
  }

  const audioState = audioEnvelope.update(audioAPI, params, dt);
  const effective = audioMapper.apply(params, audioState);

  deformationEngine.update(splatState, effective, audioState, time, audioState.bassTransient);
  physicsEngine.step(splatState, effective, dt);

  if (splatState.count > 0) {
    const src = splatState.position;
    const needsTransform = params.modelScale !== 1 || params.posX || params.posY || params.posZ;
    if (needsTransform) {
      if (!uploadBuffer || uploadBuffer.length !== src.length) {
        uploadBuffer = new Float32Array(src.length);
      }
      const s = params.modelScale;
      for (let i = 0; i < splatState.count; i++) {
        const o = i * 3;
        uploadBuffer[o] = src[o] * s + params.posX;
        uploadBuffer[o + 1] = src[o + 1] * s + params.posY;
        uploadBuffer[o + 2] = src[o + 2] * s + params.posZ;
      }
      renderer.uploadPositions(uploadBuffer);
    } else {
      renderer.uploadPositions(src);
    }
  }

  cameraController.update(effective, time, dt, audioState);
  renderer.setRenderScale(params.renderScale);
  renderer.render(renderer.camera);
}

function animate(now) {
  animationId = requestAnimationFrame(animate);
  tick(now);
}

function setupFileDrop() {
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) loadPlyFile(file);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };

  for (const el of [container, document, document.body, renderer?.renderer?.domElement]) {
    if (!el) continue;
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
  }

  document.getElementById('eidolon-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) loadPlyFile(file);
    e.target.value = '';
  });
}

function handleParamMessage(event) {
  const data = event.data;
  if (!data) return;

  if (data.type === 'LOAD_PLY_FILE' && data.fileData) {
    loadPlyFile(new File([data.fileData], data.fileName || 'model.ply'));
    return;
  }

  if (data.type !== 'PARAM_CHANGE') return;

  onParamChange(data.param, data.value);
}

function onParamChange(param, value) {
  if (param === '_action') {
    handleAction(value);
    return;
  }
  if (param === 'preset') {
    params = PresetManager.apply(value, params);
    syncParamsToControls();
    return;
  }
  if (param === 'audioMapping') {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      params.audioMappings = { ...params.audioMappings, ...parsed };
    } catch {
      /* ignore */
    }
    return;
  }
  if (param in params || param.startsWith('audio')) {
    params[param] = value;
  }
  if (param === 'samplingPercent' || param === 'maxSplatCount') {
    applyPerformanceSampling();
  }
}

function handleAction(action) {
  switch (action) {
    case 'explode':
      animExplosion = Math.min(1, params.explosionAmount + 0.45);
      animReconstruction = 0.15;
      break;
    case 'reconstruct':
      animReconstruction = 1;
      animExplosion = 0;
      break;
    case 'impact':
      audioEnvelope.bassTransient = 1;
      break;
    case 'freeze':
      params.frozen = !params.frozen;
      break;
    case 'reset':
      params = PresetManager.apply('default', params);
      splatState.resetRuntime();
      animReconstruction = 1;
      animExplosion = null;
      syncParamsToControls();
      break;
    default:
      break;
  }
}

function syncParamsToControls() {
  controlsChannel?.postMessage({ type: 'PARAM_UPDATES', updates: { ...params } });
}

export async function initModule({ container: c, audio, controlsChannel: ch }) {
  container = c;
  audioAPI = audio;
  controlsChannel = ch;

  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#000';

  const overlay = document.createElement('div');
  overlay.id = 'eidolon-overlay';
  overlay.innerHTML = `
    <div class="panel">
      <p class="msg">${loadMessage}</p>
      <label class="load-btn">Load PLY<input type="file" id="eidolon-file-input" accept=".ply" hidden></label>
    </div>`;
  container.appendChild(overlay);

  renderer = new SplatRenderer();
  renderer.init(container);
  cameraController = new CameraController(renderer.camera);

  setupFileDrop();
  window.addEventListener('message', handleParamMessage);
  if (controlsChannel) controlsChannel.onmessage = handleParamMessage;

  updateOverlay();
}

export function start() {
  if (!animationId) {
    clock.last = performance.now();
    animationId = requestAnimationFrame(animate);
  }
  isPaused = false;
}

export function stop() {
  isPaused = true;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

export function destroy() {
  stop();
  window.removeEventListener('message', handleParamMessage);
  renderer?.dispose();
  splatState.dispose();
}

export function updateParams(updates) {
  Object.assign(params, updates);
  applyPerformanceSampling();
}

window.moduleAPI = {
  initModule,
  start,
  stop,
  destroy,
  updateParams,
};

console.log('[eidolon] module API ready');
