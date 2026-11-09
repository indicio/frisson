/**
 * Plain bridge to the legacy viewer popup.
 * React calls this module. Channel handling and popup timing stay here.
 */

const listeners = new Set();
let channel = null;
let viewerWindow = null;
let connected = false;

function emit(message) {
  if (message?.type === 'VIEWER_READY') connected = true;
  for (const listener of listeners) listener(message);
}

export function startViewerBridge() {
  if (channel) return;
  channel = new BroadcastChannel('visualizer-dashboard');
  channel.onmessage = (event) => emit(event.data || {});

  Object.defineProperty(window, 'viewerWindow', {
    configurable: true,
    get: () => viewerWindow,
    set: (value) => { viewerWindow = value; },
  });
  Object.defineProperty(window, 'isViewerConnected', {
    configurable: true,
    get: () => isViewerConnected(),
    set: (value) => { connected = Boolean(value); },
  });
  window.ensureViewerOpen = ensureViewerOpen;

  setInterval(() => {
    if (viewerWindow?.closed) {
      viewerWindow = null;
      connected = false;
      emit({ type: 'VIEWER_CLOSED' });
    }
  }, 1000);
}

export function subscribeViewer(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function postToViewer(type, data = {}) {
  channel?.postMessage({ type, data });
}

export function isViewerConnected() {
  return connected && !!viewerWindow && !viewerWindow.closed;
}

export function viewerStatus() {
  if (isViewerConnected()) return 'connected';
  if (viewerWindow && !viewerWindow.closed) return 'opening';
  return 'disconnected';
}

export function getViewerWindow() {
  return viewerWindow && !viewerWindow.closed ? viewerWindow : null;
}

export function openViewerWindow() {
  if (viewerWindow && !viewerWindow.closed) {
    viewerWindow.focus();
    return viewerWindow;
  }
  const width = window.screen.availWidth || window.screen.width || 1920;
  const height = window.screen.availHeight || window.screen.height || 1080;
  connected = false;
  viewerWindow = window.open(
    '/shell/viewer.html',
    'visualizer-viewer',
    `width=${width},height=${height},left=0,top=0,` +
    'menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no,fullscreen=yes'
  );
  if (!viewerWindow) return null;
  try {
    viewerWindow.moveTo(0, 0);
    viewerWindow.resizeTo(width, height);
  } catch {
    console.log('Could not resize viewer window (security restriction)');
  }
  return viewerWindow;
}

export async function ensureViewerOpen() {
  if (isViewerConnected()) return true;
  if (!openViewerWindow()) return false;
  const started = Date.now();
  while (!connected && Date.now() - started < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!viewerWindow || viewerWindow.closed) return false;
  }
  if (!connected) {
    window.alert('Failed to connect to viewer window. Please allow popups and try again.');
  }
  return connected;
}
