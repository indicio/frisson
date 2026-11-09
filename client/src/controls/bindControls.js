import { Favorites } from '../../../shared/favorites.js';

function labelFor(root, id) {
  return root.querySelector(`#${CSS.escape(id)}-v`);
}

function readParams(root) {
  const params = {};
  root.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.id || el.id === 'favoriteName' || el.type === 'file') return;
    if (el.closest('.favorites-panel')) return;
    if (el.id === 'preset') params.presetName = el.value;
    else if (el.type === 'checkbox') params[el.id] = el.checked;
    else if (el.type === 'range' || el.type === 'number') params[el.id] = el.valueAsNumber;
    else params[el.id] = el.value;
  });
  return params;
}

function writeControl(root, id, value) {
  const el = root.querySelector(`#${CSS.escape(id)}`);
  if (!el || el.type === 'file') return null;
  if (el.type === 'checkbox') el.checked = Boolean(value);
  else if (value != null) el.value = String(value);
  const label = labelFor(root, id);
  if (label) label.textContent = el.value;
  return el;
}

/**
 * Bind a migrated module's markup to visualizer-controls and the shared favorites store.
 * Returns a cleanup function.
 */
export function bindControls(root, moduleId) {
  const channel = new BroadcastChannel('visualizer-controls');
  const cleanups = [];
  const on = (el, type, fn) => {
    el.addEventListener(type, fn);
    cleanups.push(() => el.removeEventListener(type, fn));
  };
  const send = (param, value) => {
    channel.postMessage({ type: 'PARAM_CHANGE', param, value });
  };

  function applyParams(params, shouldSend) {
    if (!params || typeof params !== 'object') return;
    for (const [key, value] of Object.entries(params)) {
      const id = key === 'presetName' ? 'preset' : key;
      const el = writeControl(root, id, value);
      if (!el || !shouldSend || key === 'presetName') continue;
      const outgoing = el.type === 'checkbox'
        ? el.checked
        : (el.type === 'range' || el.type === 'number' ? Number(value) : value);
      send(id, outgoing);
    }
  }

  channel.onmessage = (event) => {
    if (event.data?.type === 'PARAM_UPDATES') applyParams(event.data.updates, false);
  };

  root.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.id || el.id === 'favoriteName' || el.closest('.favorites-panel')) return;
    if (el.id === 'plyFile') {
      on(el, 'change', async () => {
        const file = el.files?.[0];
        if (!file) return;
        const fileData = await file.arrayBuffer();
        channel.postMessage({ type: 'LOAD_PLY_FILE', fileData, fileName: file.name });
        el.value = '';
      });
      return;
    }
    const eventName = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    on(el, eventName, () => {
      const label = labelFor(root, el.id);
      if (label) label.textContent = el.value;
      const value = el.type === 'checkbox'
        ? el.checked
        : (el.type === 'range' || el.type === 'number' ? el.valueAsNumber : el.value);
      send(el.id, value);
    });
  });

  root.querySelectorAll('[data-action]').forEach((button) => {
    on(button, 'click', () => send('_action', button.getAttribute('data-action')));
  });

  root.querySelectorAll('button[id]').forEach((button) => {
    if (button.dataset.action || button.closest('.favorites-panel')) return;
    on(button, 'click', () => send(button.id, true));
  });

  const favorites = new Favorites({
    moduleId,
    getAllParams: () => readParams(root),
    applyParams: (params) => applyParams(params, true),
  });
  let cancelled = false;
  favorites.init().then(() => {
    if (!cancelled) window.postMessage({ type: 'frisson-controls-ready', moduleId }, '*');
  });

  return () => {
    cancelled = true;
    channel.close();
    cleanups.forEach((fn) => fn());
  };
}
