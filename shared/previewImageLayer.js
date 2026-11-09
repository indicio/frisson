/**
 * Draws the image layer over the controls preview and toggles its visibility.
 * The overlay listens on the dashboard channel, so it follows the viewer.
 */
import { getAudioLevel } from '../shell/audio.js';
import { getActivePreset, presetToFlatSettings } from './imageLayerDoc.js';
import { loadImageLayerPortable } from './portableStorage.js';

const STAGE_WIDTH = 1920;
const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.75"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18"/><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M10.5 6.2A11 11 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3.4 3.8M6.1 6.7C3.5 8.5 2 12 2 12s3.5 6 10 6c1.6 0 3-.3 4.3-.9"/><path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

export function mountPreviewImage(frame) {
  if (!frame || frame.dataset.imageLayerBound) return () => {};
  frame.dataset.imageLayerBound = '1';

  const layer = document.createElement('div');
  layer.className = 'preview-image-layer';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'preview-image-eye';
  frame.append(layer);
  const slot = frame.parentElement?.querySelector('.preview-image-eye-slot');
  if (slot) slot.replaceChildren(button);
  else frame.parentElement?.querySelector('.preview-toggle')?.after(button);

  let settings = emptySettings();
  let imageData = null;
  let stopped = false;
  const channel = new BroadcastChannel('visualizer-dashboard');

  function adopt(next) {
    if (!next || typeof next !== 'object') return;
    settings = {
      ...settings,
      ...next,
      raster: { ...settings.raster, ...(next.raster || {}) },
      svg: { ...settings.svg, ...(next.svg || {}) },
      dropShadow: { ...settings.dropShadow, ...(next.dropShadow || {}) },
    };
  }

  function render(level = 0) {
    const visible = settings.visibility !== false;
    button.classList.toggle('is-off', !visible);
    button.setAttribute('aria-pressed', visible ? 'true' : 'false');
    button.setAttribute('aria-label', visible ? 'Hide image' : 'Show image');
    button.title = visible ? 'Hide image' : 'Show image';
    button.innerHTML = visible ? EYE : EYE_OFF;
    layer.replaceChildren();
    if (!visible || !imageData?.data) return;
    const fitted = frame.clientWidth / STAGE_WIDTH;
    const node = picture(imageData, settings, fitted, level);
    if (node) layer.append(node);
  }

  button.addEventListener('click', () => {
    settings = { ...settings, visibility: settings.visibility === false };
    render(0);
    channel.postMessage({
      type: 'IMAGE_LAYER_UPDATE',
      data: { settings: { visibility: settings.visibility } },
    });
  });

  channel.onmessage = (event) => {
    const message = event.data || {};
    const data = message.data || {};
    if (message.type === 'IMAGE_LAYER_UPDATE' || message.type === 'IMAGE_LAYER_APPLY_PRESET') {
      adopt(data.settings);
      if (data.settings?.imageData) imageData = data.settings.imageData;
    } else if (message.type === 'IMAGE_LAYER_LOAD_FILE' && data.file?.data) {
      imageData = data.file;
      settings = { ...settings, mode: String(data.file.type || '').includes('svg') ? 'svg' : 'raster' };
    } else if (message.type === 'IMAGE_LAYER_LOAD_SVG' && data.svgCode) {
      imageData = { type: 'svg-code', data: data.svgCode };
      settings = { ...settings, mode: 'svg' };
    } else if (message.type === 'IMAGE_LAYER_CLEAR') {
      imageData = null;
    } else if (message.type === 'IMAGE_LAYER_VISIBILITY_CHANGED' && typeof data.visible === 'boolean') {
      settings = { ...settings, visibility: data.visible };
    } else {
      return;
    }
    render(0);
  };

  loadImageLayerPortable().then((doc) => {
    if (stopped) return;
    const active = doc ? getActivePreset(doc) : null;
    if (!active) return;
    adopt(presetToFlatSettings(active));
    imageData = active.imageData || null;
    render(0);
  }).catch(() => {});

  let last = 0;
  const tick = (now) => {
    if (stopped) return;
    if (now - last > 50 && settings.visibility !== false && imageData?.data && settings.mode !== 'svg') {
      last = now;
      render(getAudioLevel() || 0);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const observer = new ResizeObserver(() => render(getAudioLevel() || 0));
  observer.observe(frame);

  return () => {
    stopped = true;
    observer.disconnect();
    try { channel.close(); } catch { /* already closed */ }
    layer.remove();
    button.remove();
    delete frame.dataset.imageLayerBound;
  };
}

function emptySettings() {
  return {
    visibility: true,
    width: 400,
    offsetX: 0,
    offsetY: 0,
    mode: 'raster',
    raster: { scaleSensitivity: 0.5, baseOpacity: 1, maxExpansion: 2 },
    svg: { scale: 1 },
    dropShadow: { enabled: false },
  };
}

function picture(image, spec, fitted, level) {
  const expansion = spec.raster?.maxExpansion ?? 2;
  const pulse = spec.mode === 'svg'
    ? 1
    : Math.min(1 + level * (spec.raster?.scaleSensitivity ?? 0.5) * expansion, expansion);
  const width = Math.max(8, (spec.width || 400) * (spec.mode === 'svg' ? (spec.svg?.scale || 1) : 1) * pulse * fitted);
  const data = typeof image.data === 'string' ? image.data.trim() : '';
  const markup = data.startsWith('<') || data.startsWith('<?xml');
  const node = markup ? svgNode(data) : rasterNode(data);
  if (!node) return null;
  node.style.width = `${width}px`;
  node.style.maxWidth = `${width}px`;
  node.style.height = 'auto';
  if (!markup) node.style.opacity = String(spec.raster?.baseOpacity ?? 1);
  node.style.transform = `translate(${(spec.offsetX || 0) * fitted}px, ${(spec.offsetY || 0) * fitted}px)`;
  node.style.filter = shadow(spec.dropShadow, fitted);
  return node;
}

function rasterNode(src) {
  if (typeof src !== 'string' || !src) return null;
  const img = document.createElement('img');
  img.alt = '';
  img.src = src;
  return img;
}

function svgNode(markup) {
  const img = document.createElement('img');
  img.alt = '';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  return img;
}

function shadow(drop, fitted) {
  if (!drop?.enabled) return 'none';
  const hex = String(drop.color || '#000000');
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const opacity = Number.isFinite(Number(drop.opacity)) ? Number(drop.opacity) : 0.35;
  const color = match
    ? `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${opacity})`
    : `rgba(0,0,0,${opacity})`;
  const px = (value) => Math.round((Number(value) || 0) * fitted);
  return `drop-shadow(${px(drop.offsetX)}px ${px(drop.offsetY)}px ${Math.max(0, px(drop.blur))}px ${color})`;
}
