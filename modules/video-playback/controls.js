/**
 * Video Playback — control panel.
 * See MODULE_NOTES.md and media/video/README.md for manifest + persistence.
 */

import { Favorites } from '../../shared/favorites.js';
import { loadModuleState, loadModuleStatePortable } from '../../shared/moduleLocalState.js';

const MODULE_ID = 'video-playback';

let controlsChannel = null;
/** @type {{ version: number, videos: Array<{id:string,file:string,poster?:string}> }} */
let manifest = { version: 1, videos: [] };
/** @type {string[]} */
let playlistIds = [];
let draggedEl = null;

function manifestUrl() {
  return new URL('../../media/video/manifest.json', import.meta.url).href;
}

function videoFileUrl(file) {
  return new URL(`../../media/video/${file}`, import.meta.url).href;
}

function posterUrlFor(entry) {
  if (!entry) return '';
  if (entry.poster) return videoFileUrl(entry.poster);
  const base = entry.file.replace(/\.(mp4|webm|mov)$/i, '');
  return videoFileUrl(`${base}.jpg`);
}

function entryById(id) {
  return manifest.videos?.find((v) => v.id === id);
}

function sendParamChange(param, value) {
  const payload = { type: 'PARAM_CHANGE', param, value };
  if (controlsChannel) controlsChannel.postMessage(payload);
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, '*');
  }
}

function sendReload() {
  sendParamChange('reloadPlayback', true);
}

function getAllParams() {
  return {
    playbackMode: document.getElementById('playbackMode')?.value || 'single',
    singleVideoId: document.getElementById('singleVideoId')?.value || null,
    playlistIds: [...playlistIds],
    playlistLoop: document.getElementById('playlistLoop')?.checked ?? true,
    transition: document.getElementById('transition')?.value || 'crossfade',
    crossfadeMs: parseFloat(document.getElementById('crossfadeMs')?.value) || 800,
    fadeBlackMs: parseFloat(document.getElementById('fadeBlackMs')?.value) || 500,
    singleLoopFadeBlackMs: parseFloat(document.getElementById('singleLoopFadeBlackMs')?.value) || 350,
    effectMode: document.getElementById('effectMode')?.value || 'none',
    effectIntensity: parseFloat(document.getElementById('effectIntensity')?.value) || 0.5,
    effectSensitivity: parseFloat(document.getElementById('effectSensitivity')?.value) || 1,
    effectThreshold: parseFloat(document.getElementById('effectThreshold')?.value) || 0.05,
  };
}

/** Fill UI from params object; optionally push to viewer (favorites load). */
function fillFromParams(p, push = false) {
  if (!p) return;
  const mode = document.getElementById('playbackMode');
  if (mode && p.playbackMode) mode.value = p.playbackMode;
  if (p.singleVideoId != null) {
    const sel = document.getElementById('singleVideoId');
    if (sel) sel.value = p.singleVideoId;
  }
  if (Array.isArray(p.playlistIds)) {
    playlistIds = [...p.playlistIds];
  }
  const pl = document.getElementById('playlistLoop');
  if (pl && typeof p.playlistLoop === 'boolean') pl.checked = p.playlistLoop;
  const tr = document.getElementById('transition');
  if (tr && p.transition) tr.value = p.transition;
  setRange('crossfadeMs', p.crossfadeMs, 'crossfadeMs-v');
  setRange('fadeBlackMs', p.fadeBlackMs, 'fadeBlackMs-v');
  setRange('singleLoopFadeBlackMs', p.singleLoopFadeBlackMs, 'singleLoopFadeBlackMs-v');
  const em = document.getElementById('effectMode');
  if (em && p.effectMode) em.value = p.effectMode;
  setRange('effectIntensity', p.effectIntensity, 'effectIntensity-v', 2);
  setRange('effectSensitivity', p.effectSensitivity, 'effectSensitivity-v', 2);
  setRange('effectThreshold', p.effectThreshold, 'effectThreshold-v', 2);
  renderPlaylist();
  syncModeUI();
  if (push) pushAllParams();
}

function applyParams(p) {
  fillFromParams(p, true);
}

function setRange(id, val, labelId, decimals = 0) {
  const el = document.getElementById(id);
  const lb = document.getElementById(labelId);
  if (typeof val !== 'number' || val == null || Number.isNaN(val)) return;
  if (el) el.value = String(val);
  if (lb) lb.textContent = decimals === 2 ? val.toFixed(2) : String(Math.round(val));
}

function pushAllParams() {
  const p = getAllParams();
  sendParamChange('playbackMode', p.playbackMode);
  sendParamChange('singleVideoId', p.singleVideoId);
  sendParamChange('playlistIds', JSON.stringify(p.playlistIds));
  sendParamChange('playlistLoop', p.playlistLoop);
  sendParamChange('transition', p.transition);
  sendParamChange('crossfadeMs', p.crossfadeMs);
  sendParamChange('fadeBlackMs', p.fadeBlackMs);
  sendParamChange('singleLoopFadeBlackMs', p.singleLoopFadeBlackMs);
  sendParamChange('effectMode', p.effectMode);
  sendParamChange('effectIntensity', p.effectIntensity);
  sendParamChange('effectSensitivity', p.effectSensitivity);
  sendParamChange('effectThreshold', p.effectThreshold);
  sendReload();
}

async function loadManifest() {
  try {
    const res = await fetch(manifestUrl());
    if (!res.ok) throw new Error(String(res.status));
    manifest = await res.json();
  } catch (e) {
    console.warn('[video-playback controls] manifest load failed', e);
    manifest = { version: 1, videos: [] };
  }
}

function renderLibrary() {
  const root = document.getElementById('video-library');
  if (!root) return;
  const vids = manifest.videos || [];
  if (vids.length === 0) {
    root.innerHTML = '<div class="vp-empty">No videos in manifest. Edit <code>media/video/manifest.json</code> and add media files.</div>';
    return;
  }
  root.innerHTML = '';
  vids.forEach((v) => {
    const card = document.createElement('div');
    card.className = 'vp-lib-card';
    const img = document.createElement('img');
    img.alt = v.id;
    img.loading = 'lazy';
    img.src = posterUrlFor(v);
    img.onerror = () => {
      img.style.background = 'linear-gradient(135deg,#222,#444)';
      img.removeAttribute('src');
    };
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = v.file || v.id;
    card.appendChild(img);
    card.appendChild(cap);
    card.addEventListener('click', () => addToPlaylist(v.id));
    root.appendChild(card);
  });
}

function populateSingleSelect() {
  const sel = document.getElementById('singleVideoId');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Select —</option>';
  (manifest.videos || []).forEach((v) => {
    const o = document.createElement('option');
    o.value = v.id;
    o.textContent = v.id;
    sel.appendChild(o);
  });
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function addToPlaylist(id) {
  if (playlistIds.includes(id)) return;
  playlistIds.push(id);
  renderPlaylist();
  sendParamChange('playlistIds', JSON.stringify(playlistIds));
  sendReload();
}

function removeFromPlaylist(index) {
  playlistIds.splice(index, 1);
  renderPlaylist();
  sendParamChange('playlistIds', JSON.stringify(playlistIds));
  sendReload();
}

function renderPlaylist() {
  const root = document.getElementById('playlist-stack');
  if (!root) return;
  root.innerHTML = '';
  if (playlistIds.length === 0) {
    root.innerHTML = '<div class="vp-empty">Playlist empty — click library items to add.</div>';
    return;
  }
  playlistIds.forEach((id, index) => {
    const entry = entryById(id);
    const row = document.createElement('div');
    row.className = 'vp-pl-item';
    row.draggable = true;
    row.dataset.index = String(index);
    row.addEventListener('dragstart', (e) => {
      draggedEl = row;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      draggedEl = null;
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = draggedEl ? parseInt(draggedEl.dataset.index, 10) : -1;
      const to = index;
      if (from < 0 || from === to) return;
      const [item] = playlistIds.splice(from, 1);
      playlistIds.splice(to, 0, item);
      renderPlaylist();
      sendParamChange('playlistIds', JSON.stringify(playlistIds));
      sendReload();
    });

    const idx = document.createElement('div');
    idx.className = 'idx';
    idx.textContent = `${index + 1}.`;

    const img = document.createElement('img');
    img.alt = '';
    if (entry) {
      img.src = posterUrlFor(entry);
      img.onerror = () => {
        img.style.background = '#333';
        img.removeAttribute('src');
      };
    }

    const t = document.createElement('div');
    t.className = 't';
    t.textContent = entry ? entry.file || entry.id : id;

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn secondary';
    rm.textContent = 'Remove';
    rm.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromPlaylist(index);
    });

    row.appendChild(idx);
    row.appendChild(img);
    row.appendChild(t);
    row.appendChild(rm);
    root.appendChild(row);
  });
}

function syncModeUI() {
  const mode = document.getElementById('playbackMode')?.value;
  const singleWrap = document.getElementById('singlePickWrap');
  if (singleWrap) singleWrap.style.display = mode === 'single' ? 'block' : 'none';
}

function wireControls() {
  document.getElementById('playbackMode')?.addEventListener('change', () => {
    syncModeUI();
    sendParamChange('playbackMode', document.getElementById('playbackMode').value);
    sendReload();
  });
  document.getElementById('singleVideoId')?.addEventListener('change', (e) => {
    sendParamChange('singleVideoId', e.target.value || null);
    sendReload();
  });
  document.getElementById('playlistLoop')?.addEventListener('change', (e) => {
    sendParamChange('playlistLoop', e.target.checked);
    sendReload();
  });
  document.getElementById('transition')?.addEventListener('change', (e) => {
    sendParamChange('transition', e.target.value);
    sendReload();
  });

  const bindRange = (id, labelId, key, decimals = 0) => {
    const el = document.getElementById(id);
    const lb = document.getElementById(labelId);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      if (lb) lb.textContent = decimals === 2 ? v.toFixed(2) : String(Math.round(v));
      sendParamChange(key, v);
    });
  };
  bindRange('crossfadeMs', 'crossfadeMs-v', 'crossfadeMs');
  bindRange('fadeBlackMs', 'fadeBlackMs-v', 'fadeBlackMs');
  bindRange('singleLoopFadeBlackMs', 'singleLoopFadeBlackMs-v', 'singleLoopFadeBlackMs');
  bindRange('effectIntensity', 'effectIntensity-v', 'effectIntensity', 2);
  bindRange('effectSensitivity', 'effectSensitivity-v', 'effectSensitivity', 2);
  bindRange('effectThreshold', 'effectThreshold-v', 'effectThreshold', 2);

  document.getElementById('effectMode')?.addEventListener('change', (e) => {
    sendParamChange('effectMode', e.target.value);
    sendReload();
  });
}

async function init() {
  controlsChannel = new BroadcastChannel('visualizer-controls');
  await loadManifest();
  populateSingleSelect();
  renderLibrary();

  const saved =
    (await loadModuleStatePortable(MODULE_ID, null)) ?? loadModuleState(MODULE_ID, null);
  if (saved) fillFromParams(saved, false);

  renderPlaylist();
  syncModeUI();
  wireControls();

  const favorites = new Favorites({
    moduleId: MODULE_ID,
    getAllParams,
    applyParams,
    listContainerId: 'favoritesList',
  });
  await favorites.init();
}

init().catch((e) => console.error('controls init failed', e));
