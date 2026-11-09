/**
 * Live effect preview for the controls tray.
 * Runs its own module instance, so the thumbnail keeps drawing when the
 * projector window is closed. It listens on its own controls channel and
 * does not replace the viewer's channel handler.
 */
import * as audio from '../shell/audio.js';

export async function startControlPreview(container, modulePath) {
  const iframe = document.createElement('iframe');
  iframe.title = 'Effect preview';
  iframe.src = modulePath;
  container.replaceChildren(iframe);

  let stopped = false;
  let timer = 0;
  let channel = null;
  let unwatch = () => {};

  const stop = () => {
    stopped = true;
    clearInterval(timer);
    unwatch();
    unwatch = () => {};
    try { iframe.contentWindow?.moduleAPI?.stop?.(); } catch { /* already gone */ }
    try { iframe.contentWindow?.moduleAPI?.destroy?.(); } catch { /* already gone */ }
    try { channel?.close(); } catch { /* already closed */ }
    channel = null;
    iframe.remove();
  };

  try {
    await waitForLoad(iframe);
    if (stopped) return { stop };
    const moduleWindow = iframe.contentWindow;
    const api = await waitForModuleAPI(moduleWindow);
    if (stopped) return { stop };
    channel = new BroadcastChannel('visualizer-controls');
    const audioReady = audio.ensureAudioReady();
    unwatch = audio.watchWindow(moduleWindow);
    await api.initModule({
      container: iframe.contentDocument?.body,
      audio: audioApi(),
      controlsChannel: channel,
    });
    if (stopped) return { stop };
    await api.start?.();
    audioReady.catch(() => {});
    timer = setInterval(() => {
      try {
        moduleWindow.postMessage({
          type: 'AUDIO_UPDATE',
          fftData: audio.getFFTData(),
          waveformData: audio.getWaveformData(),
          audioLevel: audio.getAudioLevel(),
        }, '*');
      } catch { /* iframe navigated */ }
    }, 32);
    return { stop };
  } catch (error) {
    console.warn('Effect preview failed', error);
    const stillCurrent = iframe.isConnected;
    stop();
    if (stillCurrent) container.replaceChildren(note('Preview unavailable'));
    return { stop() { if (stillCurrent) container.replaceChildren(); } };
  }
}

function audioApi() {
  return {
    getFFTData: audio.getFFTData,
    getWaveformData: audio.getWaveformData,
    getNormalizedFFTData: audio.getNormalizedFFTData,
    getAudioLevel: audio.getAudioLevel,
    getAudioContext: audio.getAudioContext,
    getAnalyser: audio.getAnalyser,
  };
}

function note(text) {
  const p = document.createElement('p');
  p.className = 'controls-preview-note';
  p.textContent = text;
  return p;
}

function waitForLoad(iframe) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview load timeout')), 8000);
    iframe.onload = () => { clearTimeout(timeout); resolve(); };
    iframe.onerror = () => { clearTimeout(timeout); reject(new Error('Preview failed to load')); };
  });
}

function waitForModuleAPI(moduleWindow) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      try {
        if (moduleWindow.moduleAPI) {
          clearInterval(timer);
          resolve(moduleWindow.moduleAPI);
          return;
        }
      } catch { /* not ready */ }
      if (attempts > 80) {
        clearInterval(timer);
        reject(new Error('Preview module did not start'));
      }
    }, 100);
  });
}

/** How many property columns fit in the controls area. */
export function controlColumnCount(width, preview) {
  if (width >= 980 && !preview) return 3;
  if (width >= 520) return 2;
  return 1;
}

export function applyControlColumns(content, preview) {
  if (!content) return;
  const columns = String(controlColumnCount(content.clientWidth, preview));
  content.style.setProperty('--control-columns', columns);
  const iframe = content.querySelector('iframe');
  try {
    iframe?.contentDocument?.documentElement?.style.setProperty('--control-columns', columns);
  } catch { /* iframe not ready */ }
}
