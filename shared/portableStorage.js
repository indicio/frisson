/**
 * Portable configuration: JSON files under data/ when using node serve.js.
 * When the API is reachable, files are the source of truth — we do not mirror
 * shell playlist/view settings to localStorage (so another machine + same repo
 * does not pick up stale browser data).
 *
 * localStorage is only used when the API is unavailable (e.g. static hosting).
 *
 * Files:
 *   data/shell/config.json       — view mode, master playlist, repeat, fade
 *   data/image-layer/image-layer.json — image layer presets (v2) or legacy flat v1
 *   data/module-state/<id>.json  — per-module session state (e.g. video-playback)
 *   data/favorites/<id>.json     — favorites (existing API)
 */

import { getApiBase } from './apiBase.js';
import { pendingSave, saveJSON } from './saveQueue.js';
import {
  normalizeImageLayerDoc,
  getActivePreset,
  presetToFlatSettings,
  upsertPresetDataFromFlat,
} from './imageLayerDoc.js';

const API_BASE = getApiBase();

/** 'file' = GET /api/shell/config succeeded; 'browser' = offline / no API */
export let shellConfigDataSource = /** @type {'unknown' | 'file' | 'browser'} */ ('unknown');

/** @type {object|null} */
let shellConfigCache = null;
let imageLayerCache = null;
let imageReadWarningShown = false;

function normalizeShellConfig(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  return {
    version: 1,
    viewMode: o.viewMode === 'list' ? 'list' : 'grid',
    playlist: Array.isArray(o.playlist) ? o.playlist : [],
    repeat: !!o.repeat,
    fade: o.fade !== false,
    savedPlaylists: (o.savedPlaylists && typeof o.savedPlaylists === 'object' && !Array.isArray(o.savedPlaylists))
      ? o.savedPlaylists : {},
  };
}

/**
 * Build shell config from legacy localStorage keys (offline / first run).
 */
export function loadShellConfigFromLocalStorage() {
  let fade = true;
  try {
    const s = localStorage.getItem('visualizer-playlist-fade');
    if (s !== null) fade = JSON.parse(s);
  } catch {
    fade = true;
  }
  let repeat = false;
  try {
    const s = localStorage.getItem('visualizer-playlist-repeat');
    if (s !== null) repeat = JSON.parse(s);
  } catch {
    repeat = false;
  }
  let playlist = [];
  try {
    const s = localStorage.getItem('visualizer-playlist');
    if (s) playlist = JSON.parse(s);
  } catch {
    playlist = [];
  }
  const viewMode = localStorage.getItem('shell-view-preference');
  return normalizeShellConfig({
    viewMode: viewMode === 'list' || viewMode === 'grid' ? viewMode : 'grid',
    playlist,
    repeat,
    fade,
  });
}

/**
 * Mirror shell config into localStorage for modules that read keys directly.
 */
export function syncShellConfigToLocalStorage(cfg) {
  const c = normalizeShellConfig(cfg);
  try {
    localStorage.setItem('shell-view-preference', c.viewMode);
    localStorage.setItem('visualizer-playlist', JSON.stringify(c.playlist));
    localStorage.setItem('visualizer-playlist-repeat', JSON.stringify(c.repeat));
    localStorage.setItem('visualizer-playlist-fade', JSON.stringify(c.fade));
  } catch (e) {
    console.warn('[portable] localStorage sync failed', e);
  }
}

/** Remove mirrored shell keys so stale browser data cannot override project JSON. */
export function clearShellLocalStorageMirror() {
  try {
    localStorage.removeItem('shell-view-preference');
    localStorage.removeItem('visualizer-playlist');
    localStorage.removeItem('visualizer-playlist-repeat');
    localStorage.removeItem('visualizer-playlist-fade');
  } catch (e) {
    console.warn('[portable] clear shell localStorage failed', e);
  }
}

export function isShellConfigFromProjectFile() {
  return shellConfigDataSource === 'file';
}

/**
 * Load shell UI config from server or localStorage.
 * When GET succeeds (including empty body / missing file → {}), project JSON wins.
 */
export async function loadShellConfig() {
  const pending = pendingSave(`${API_BASE}/shell/config`);
  if (pending) {
    shellConfigDataSource = 'file';
    shellConfigCache = normalizeShellConfig(pending);
    return shellConfigCache;
  }
  try {
    const res = await fetch(`${API_BASE}/shell/config`);
    if (res.ok) {
      const data = await res.json();
      shellConfigDataSource = 'file';
      shellConfigCache = normalizeShellConfig(
        data && typeof data === 'object' ? data : {}
      );
      clearShellLocalStorageMirror();
      return shellConfigCache;
    }
  } catch (e) {
    console.warn('[portable] shell config: server unavailable, using localStorage', e.message || e);
  }
  shellConfigDataSource = 'browser';
  shellConfigCache = loadShellConfigFromLocalStorage();
  return shellConfigCache;
}

/**
 * Merge partial update, write file + localStorage.
 * @param {Partial<{ viewMode: string, playlist: unknown[], repeat: boolean, fade: boolean, savedPlaylists: Record<string, unknown[]> }>} partial
 */
export async function updateShellConfig(partial) {
  const base = shellConfigCache || loadShellConfigFromLocalStorage();
  const next = normalizeShellConfig({ ...base, ...partial });
  shellConfigCache = next;
  if (shellConfigDataSource !== 'file') {
    syncShellConfigToLocalStorage(next);
  }
  return saveJSON(`${API_BASE}/shell/config`, next);
}

function syncImageLayerLocalStorageFromFlat(flat) {
  try {
    if (flat.imageData != null) {
      localStorage.setItem('imageLayer_data', JSON.stringify(flat.imageData));
    } else {
      localStorage.removeItem('imageLayer_data');
      localStorage.removeItem('imageLayer_mode');
    }
    if (flat.mode) {
      localStorage.setItem('imageLayer_mode', flat.mode);
    } else {
      localStorage.removeItem('imageLayer_mode');
    }
  } catch (e) {
    console.warn('[portable] image layer localStorage', e);
  }
}

async function fetchImageLayerRaw() {
  const pending = pendingSave(`${API_BASE}/shell/image-layer`);
  if (pending) return pending;
  try {
    const res = await fetch(`${API_BASE}/shell/image-layer`);
    if (res.ok) {
      const data = await res.json();
      imageLayerCache = data && typeof data === 'object' ? data : {};
      return imageLayerCache;
    }
  } catch (e) {
    console.warn('[portable] image-layer fetch', e.message || e);
  }
  if (imageLayerCache) return imageLayerCache;
  throw new Error('Cannot load image presets; refusing to overwrite existing presets.');
}

/** Load normalized v2 image-layer document from the server (or null if offline). */
export async function loadImageLayerPortable() {
  const pending = pendingSave(`${API_BASE}/shell/image-layer`);
  if (pending) return normalizeImageLayerDoc(pending);
  try {
    const res = await fetch(`${API_BASE}/shell/image-layer`);
    if (res.ok) {
      const raw = await res.json();
      const doc = normalizeImageLayerDoc(raw);
      imageLayerCache = doc;
      const active = getActivePreset(doc);
      if (active) {
        syncImageLayerLocalStorageFromFlat(presetToFlatSettings(active));
      }
      return doc;
    }
  } catch (e) {
    console.warn('[portable] image-layer load: server unavailable', e.message || e);
  }
  return null;
}

/**
 * Write full v2 document to disk and mirror active preset into localStorage.
 * @param {ReturnType<typeof emptyImageLayerDoc>} doc
 */
export async function saveImageLayerDocument(doc) {
  const normalized = normalizeImageLayerDoc(doc);
  imageLayerCache = normalized;
  const active = getActivePreset(normalized);
  if (active) {
    syncImageLayerLocalStorageFromFlat(presetToFlatSettings(active));
  }
  return saveJSON(`${API_BASE}/shell/image-layer`, normalized);
}

/**
 * Merge current flat settings into the named preset and persist (viewer edits).
 * @param {Record<string, unknown>} flatSettings
 * @param {string} activePresetId
 */
export async function mergeActivePresetIntoFile(flatSettings, activePresetId) {
  try {
    const raw = await fetchImageLayerRaw();
    let doc = normalizeImageLayerDoc(raw);
    doc = upsertPresetDataFromFlat(doc, activePresetId, flatSettings);
    doc.activePresetId = activePresetId;
    return await saveImageLayerDocument(doc);
  } catch (error) {
    console.warn('[portable] Image settings not saved:', error);
    if (!imageReadWarningShown) {
      imageReadWarningShown = true;
      window.alert('Image settings could not be saved because the existing presets could not be loaded. Keep this window open, restart the Frisson server, then try changing the settings again.');
    }
    return false;
  }
}

/**
 * @param {string} moduleId
 * @param {T} defaultValue
 * @returns {Promise<T>}
 * @template T
 */
export async function loadModuleStatePortable(moduleId, defaultValue) {
  const pending = pendingSave(`${API_BASE}/module-state/${encodeURIComponent(moduleId)}`);
  if (pending) return pending;
  const key = `${moduleId}-module-state`;
  try {
    const res = await fetch(`${API_BASE}/module-state/${encodeURIComponent(moduleId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch {}
        return /** @type {T} */ (data);
      }
    }
  } catch (e) {
    console.warn(`[portable] module-state ${moduleId}: server unavailable`, e.message || e);
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

/**
 * @param {string} moduleId
 * @param {object} state
 */
export async function saveModuleStatePortable(moduleId, state) {
  const key = `${moduleId}-module-state`;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.warn('[portable] module state localStorage', e);
  }
  return saveJSON(`${API_BASE}/module-state/${encodeURIComponent(moduleId)}`, state);
}
