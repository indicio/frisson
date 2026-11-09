/**
 * Shared microphone and camera for every module.
 * Capture is armed from the front-page switches. Modules read the analyser
 * and the camera stream; they do not call getUserMedia themselves.
 */

const AUDIO_KEY = 'frisson-audio-input';
const VIDEO_KEY = 'frisson-video-input';

let audioContext = null;
let analyser = null;
let microphone = null;
let micStream = null;
let videoStream = null;
let dataArray = null;
let waveformArray = null;
let fftSize = 2048;
let audioWanted = false;
let videoWanted = false;
const inputListeners = new Set();
const watchedWindows = new Set();

function readFlag(key) {
  try { return localStorage.getItem(key) === 'on'; } catch { return false; }
}

function writeFlag(key, on) {
  try { localStorage.setItem(key, on ? 'on' : 'off'); } catch { /* private mode */ }
}

function isAudioInitialized() {
  return !!(audioContext && analyser && microphone && dataArray);
}

/**
 * Initialize the audio system (idempotent: safe to call when already running).
 * @returns {Promise<void>}
 */
export async function initAudio() {
  try {
    if (isAudioInitialized()) {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      return;
    }

    // Create audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Resume audio context if suspended (required by browsers)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    // Create analyser node
    analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0.8;
    
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    microphone = audioContext.createMediaStreamSource(micStream);
    microphone.connect(analyser);
    
    // Ensure audio context is running
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    // Initialize data arrays
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    waveformArray = new Uint8Array(bufferLength);
    
    console.log('Audio system initialized, state:', audioContext.state);
    return Promise.resolve();
  } catch (error) {
    console.error('Failed to initialize audio:', error);
    stopMic();
    throw error;
  }
}

/**
 * Ensure mic + analyser are ready (e.g. before loading an audio-reactive module or advancing the playlist).
 * Does not throw; returns whether audio is active.
 * @returns {Promise<boolean>}
 */
export async function ensureAudioReady() {
  if (!audioWanted) return false;
  try {
    if (isAudioInitialized()) {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      return true;
    }
    await initAudio();
    return true;
  } catch (e) {
    console.warn(
      'Audio not available (mic may require a user gesture in this window):',
      e && e.message ? e.message : e
    );
    return false;
  }
}

/**
 * Get frequency domain data (FFT)
 * @returns {Uint8Array} Frequency data array (0-255)
 */
export function getFFTData() {
  if (!analyser || !dataArray) {
    return new Uint8Array(0);
  }
  
  // Resume audio context if suspended
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(err => {
      console.warn('Failed to resume audio context:', err);
    });
  }
  
  analyser.getByteFrequencyData(dataArray);
  return dataArray;
}

/**
 * Get time domain data (waveform)
 * @returns {Uint8Array} Waveform data array (0-255)
 */
export function getWaveformData() {
  if (!analyser || !waveformArray) {
    return new Uint8Array(0);
  }
  
  analyser.getByteTimeDomainData(waveformArray);
  return waveformArray;
}

/**
 * Get normalized frequency data (0-1)
 * @returns {Float32Array} Normalized frequency data
 */
export function getNormalizedFFTData() {
  // Resume audio context if suspended
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(err => {
      console.warn('Failed to resume audio context:', err);
    });
  }
  
  const fftData = getFFTData();
  if (!fftData || fftData.length === 0) {
    return new Float32Array(0);
  }
  
  const normalized = new Float32Array(fftData.length);
  
  for (let i = 0; i < fftData.length; i++) {
    normalized[i] = Math.min(1, fftData[i] / 255.0);
  }
  
  return normalized;
}

/**
 * Get audio context (for advanced use cases)
 * @returns {AudioContext|null}
 */
export function getAudioContext() {
  return audioContext;
}

/**
 * Get analyser node (for advanced use cases)
 * @returns {AnalyserNode|null}
 */
export function getAnalyser() {
  return analyser;
}

/**
 * Get FFT buffer size
 * @returns {number}
 */
export function getFFTSize() {
  return fftSize;
}

/**
 * Set FFT size (must be power of 2)
 * @param {number} size - FFT size (e.g., 512, 1024, 2048, 4096)
 */
export function setFFTSize(size) {
  if (!analyser) return;
  
  // Validate power of 2
  if ((size & (size - 1)) !== 0) {
    console.warn('FFT size must be a power of 2');
    return;
  }
  
  fftSize = size;
  analyser.fftSize = size;
  
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  waveformArray = new Uint8Array(bufferLength);
}

/**
 * Get overall audio level (RMS)
 * @returns {number} Audio level 0-1
 */
export function getAudioLevel() {
  // Resume audio context if suspended
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(err => {
      console.warn('Failed to resume audio context:', err);
    });
  }
  
  const waveform = getWaveformData();
  if (waveform.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < waveform.length; i++) {
    const normalized = (waveform[i] - 128) / 128;
    sum += normalized * normalized;
  }
  
  const rms = Math.sqrt(sum / waveform.length);
  // Clamp to 0-1 range
  return Math.min(1, Math.max(0, rms));
}

function stopMic() {
  micStream?.getTracks().forEach((track) => track.stop());
  micStream = null;
  if (microphone) {
    try { microphone.disconnect(); } catch { /* already disconnected */ }
  }
  microphone = null;
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => {});
  }
  audioContext = null;
  analyser = null;
  dataArray = null;
  waveformArray = null;
}

function stopVideo() {
  videoStream?.getTracks().forEach((track) => track.stop());
  videoStream = null;
}

function notifyInputs() {
  const state = getInputState();
  inputListeners.forEach((fn) => {
    try { fn(state); } catch (error) { console.warn(error); }
  });
  watchedWindows.forEach((win) => deliverInputs(win));
}

function deliverInputs(win) {
  if (!win) return;
  const stream = videoWanted ? videoStream : null;
  try {
    if (typeof win.frissonMedia?.attachStream === 'function') {
      win.frissonMedia.attachStream(stream);
      return;
    }
  } catch { /* window navigated */ }
  try {
    win.postMessage(stream ? { type: 'VIDEO_STREAM', stream } : { type: 'VIDEO_STOP' }, '*');
  } catch { /* window navigated */ }
}

export function getInputState() {
  return { audio: audioWanted, video: videoWanted };
}

export function subscribeInputs(listener) {
  inputListeners.add(listener);
  return () => inputListeners.delete(listener);
}

export function watchWindow(win) {
  if (!win) return () => {};
  watchedWindows.add(win);
  deliverInputs(win);
  return () => watchedWindows.delete(win);
}

export async function setAudioEnabled(on) {
  audioWanted = !!on;
  writeFlag(AUDIO_KEY, audioWanted);
  if (audioWanted) {
    try { await initAudio(); } catch (error) {
      console.warn('Microphone did not start:', error?.message || error);
    }
  } else {
    stopMic();
  }
  notifyInputs();
  return isAudioInitialized();
}

export async function setVideoEnabled(on) {
  videoWanted = !!on;
  writeFlag(VIDEO_KEY, videoWanted);
  if (videoWanted) {
    try {
      if (!videoStream) {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }
    } catch (error) {
      console.warn('Camera did not start:', error?.message || error);
      stopVideo();
    }
  } else {
    stopVideo();
  }
  notifyInputs();
  return !!videoStream;
}

export async function restoreInputs() {
  audioWanted = readFlag(AUDIO_KEY);
  videoWanted = readFlag(VIDEO_KEY);
  if (audioWanted) {
    try { await initAudio(); } catch { /* retry on the next module load */ }
  }
  if (videoWanted && !videoStream) {
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch { /* the switch stays on; the next toggle retries */ }
  }
  notifyInputs();
  return getInputState();
}

/**
 * Clean up audio and video resources
 */
export function destroyAudio() {
  stopMic();
  stopVideo();
  notifyInputs();
}

