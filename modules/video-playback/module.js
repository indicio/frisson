/**
 * Video Playback module — playlist, transitions, optional audio-reactive effects.
 *
 * Asset discovery: see /media/video/manifest.json (no directory scan in browser).
 * Persistence: shared/moduleLocalState.js + Favorites from controls (serializable params).
 * Master playlist: favorites store the same param object this module uses via PARAM_CHANGE.
 */

import { drawVideoEffect, resetEffectsWork } from './effects.js';
import {
  loadModuleState,
  loadModuleStatePortable,
  saveModuleStatePortable,
} from '../../shared/moduleLocalState.js';

const MODULE_ID = 'video-playback';

/** @type {HTMLElement|null} */
let container = null;
let audioAPI = null;
/** @type {BroadcastChannel|null} */
let controlsChannel = null;

let canvas = null;
let ctx = null;
/** @type {HTMLVideoElement|null} */
let videoA = null;
/** @type {HTMLVideoElement|null} */
let videoB = null;
/** Active output: 'a' | 'b' (which element is "current" for display during XFade) */
let activeSlot = 'a';

let animationId = null;
let manifest = { version: 1, basePath: '/media/video', videos: [] };
/** @type {Map<string, object>} */
let videoById = new Map();

/** Smoothed amplitude for effects */
let smoothAmp = 0;

/** Transition state machine */
let trans = {
  phase: 'idle',
  t0: 0,
  duration: 800,
  fromSlot: 'a',
  toSlot: 'b',
  blackAlpha: 0,
  /** @type {boolean|undefined} */
  _didSwap: false,
  /** @type {boolean|undefined} */
  _loopRestart: false,
};

const params = {
  playbackMode: 'single',
  singleVideoId: null,
  playlistIds: [],
  playlistLoop: true,
  transition: 'crossfade',
  crossfadeMs: 800,
  fadeBlackMs: 500,
  singleLoopFadeBlackMs: 350,
  effectMode: 'none',
  effectIntensity: 0.5,
  effectSensitivity: 1,
  effectThreshold: 0.05,
};

let playlistIndex = 0;
let needsUserGesture = false;
/** @type {HTMLDivElement|null} */
let tapOverlay = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let autoplayFallbackTimer = null;

function getCurrentVideo() {
  return activeSlot === 'a' ? videoA : videoB;
}

function getInactiveVideo() {
  return activeSlot === 'a' ? videoB : videoA;
}

function resolveVideoUrl(entry) {
  if (!entry || !entry.file) return '';
  return new URL(`../../media/video/${entry.file}`, import.meta.url).href;
}

function resolvePosterUrl(entry) {
  if (!entry) return '';
  if (entry.poster) {
    return new URL(`../../media/video/${entry.poster}`, import.meta.url).href;
  }
  const base = entry.file.replace(/\.(mp4|webm|mov)$/i, '');
  try {
    return new URL(`../../media/video/${base}.jpg`, import.meta.url).href;
  } catch {
    return '';
  }
}

async function loadManifest() {
  const url = new URL('../../media/video/manifest.json', import.meta.url);
  const res = await fetch(url.href);
  if (!res.ok) {
    console.warn('[video-playback] manifest missing:', res.status);
    return;
  }
  manifest = await res.json();
  videoById = new Map((manifest.videos || []).map((v) => [v.id, v]));
}

async function applySavedModuleState() {
  let saved = await loadModuleStatePortable(MODULE_ID, null);
  if (!saved || typeof saved !== 'object') {
    saved = loadModuleState(MODULE_ID, null);
  }
  if (!saved || typeof saved !== 'object') return;
  try {
    if (saved.playbackMode) params.playbackMode = saved.playbackMode;
    if (saved.singleVideoId !== undefined) params.singleVideoId = saved.singleVideoId;
    if (Array.isArray(saved.playlistIds)) params.playlistIds = [...saved.playlistIds];
    if (typeof saved.playlistLoop === 'boolean') params.playlistLoop = saved.playlistLoop;
    if (saved.transition) params.transition = saved.transition;
    if (typeof saved.crossfadeMs === 'number') params.crossfadeMs = saved.crossfadeMs;
    if (typeof saved.fadeBlackMs === 'number') params.fadeBlackMs = saved.fadeBlackMs;
    if (typeof saved.singleLoopFadeBlackMs === 'number') params.singleLoopFadeBlackMs = saved.singleLoopFadeBlackMs;
    if (saved.effectMode) params.effectMode = saved.effectMode;
    if (typeof saved.effectIntensity === 'number') params.effectIntensity = saved.effectIntensity;
    if (typeof saved.effectSensitivity === 'number') params.effectSensitivity = saved.effectSensitivity;
    if (typeof saved.effectThreshold === 'number') params.effectThreshold = saved.effectThreshold;
  } catch (e) {
    console.warn('[video-playback] corrupt saved state ignored', e);
  }
}

function persistState() {
  const state = {
    playbackMode: params.playbackMode,
    singleVideoId: params.singleVideoId,
    playlistIds: [...params.playlistIds],
    playlistLoop: params.playlistLoop,
    transition: params.transition,
    crossfadeMs: params.crossfadeMs,
    fadeBlackMs: params.fadeBlackMs,
    singleLoopFadeBlackMs: params.singleLoopFadeBlackMs,
    effectMode: params.effectMode,
    effectIntensity: params.effectIntensity,
    effectSensitivity: params.effectSensitivity,
    effectThreshold: params.effectThreshold,
  };
  void saveModuleStatePortable(MODULE_ID, state);
}

function getAmplitude() {
  if (audioAPI && typeof audioAPI.getAudioLevel === 'function') {
    return audioAPI.getAudioLevel();
  }
  return 0;
}

function getVideoEntryById(id) {
  return id ? videoById.get(id) : null;
}

function currentEntryFromMode() {
  if (params.playbackMode === 'single') {
    return getVideoEntryById(params.singleVideoId);
  }
  const ids = params.playlistIds;
  if (!ids.length) return null;
  const id = ids[Math.min(playlistIndex, ids.length - 1)];
  return getVideoEntryById(id);
}

function nextPlaylistIndex() {
  const ids = params.playlistIds;
  if (!ids.length) return -1;
  if (playlistIndex + 1 < ids.length) return playlistIndex + 1;
  if (params.playlistLoop) return 0;
  return -1;
}

function preloadNext() {
  const inactive = getInactiveVideo();
  if (!inactive) return;
  let nextId = null;
  if (params.playbackMode === 'single') {
    nextId = params.singleVideoId;
  } else {
    const n = nextPlaylistIndex();
    if (n < 0) return;
    nextId = params.playlistIds[n];
  }
  const entry = getVideoEntryById(nextId);
  if (!entry) return;
  const url = resolveVideoUrl(entry);
  if (inactive.src !== url) {
    inactive.src = url;
    inactive.load();
  }
}

/**
 * Ensure there is something to play on first load (saved state may have no selection).
 */
function ensureDefaultMediaSelection() {
  const vids = manifest.videos || [];
  if (vids.length === 0) return;
  if (params.playbackMode === 'single' && !params.singleVideoId) {
    params.singleVideoId = vids[0].id;
    persistState();
  }
}

/**
 * Muted + playsinline + autoplay attribute satisfies most browsers' autoplay policies.
 * Retries play() on several events because timing varies by decoder/cache.
 * @param {{ showFallbackOverlay?: boolean }} [opts] — set false for secondary element during crossfade
 */
function attemptAutoplay(video, onPlaying, opts = {}) {
  if (!video) return;
  const showFallback = opts.showFallbackOverlay !== false;

  if (showFallback && autoplayFallbackTimer) {
    clearTimeout(autoplayFallbackTimer);
    autoplayFallbackTimer = null;
  }

  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('autoplay', '');

  let settled = false;
  const tryPlay = () => {
    if (settled || !video.src) return;
    const p = video.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        if (settled) return;
        settled = true;
        if (showFallback && autoplayFallbackTimer) {
          clearTimeout(autoplayFallbackTimer);
          autoplayFallbackTimer = null;
        }
        tapOverlay?.remove();
        tapOverlay = null;
        needsUserGesture = false;
        onPlaying?.();
      }).catch(() => {
        /* will retry on next event or fallback overlay */
      });
    }
  };

  video.addEventListener('loadeddata', tryPlay, { once: true });
  video.addEventListener('canplay', tryPlay, { once: true });
  video.addEventListener('canplaythrough', tryPlay, { once: true });
  queueMicrotask(tryPlay);
  [50, 200, 600].forEach((ms) => setTimeout(tryPlay, ms));

  if (showFallback) {
    autoplayFallbackTimer = setTimeout(() => {
      autoplayFallbackTimer = null;
      if (!video.paused) return;
      showTapOverlay();
    }, 1800);
  }
}

function attachVideoListeners(v) {
  v.addEventListener('ended', onVideoEnded);
  v.addEventListener('error', onVideoError);
}

function onVideoError(e) {
  console.warn('[video-playback] video error', e);
  const v = e.target;
  if (v?.error) console.warn(v.error.code, v.error.message);
}

function onVideoEnded() {
  const v = getCurrentVideo();
  if (!v || v !== (activeSlot === 'a' ? videoA : videoB)) return;

  if (params.playbackMode === 'single') {
    if (params.transition === 'fadeBlack' && params.singleLoopFadeBlackMs > 0) {
      startFadeBlackLoop();
    } else {
      v.currentTime = 0;
      attemptAutoplay(v);
    }
    return;
  }

  const next = nextPlaylistIndex();
  if (next < 0) {
    v.pause();
    return;
  }
  playlistIndex = next;
  beginTransitionToIndex(playlistIndex);
}

function swapActive() {
  activeSlot = activeSlot === 'a' ? 'b' : 'a';
}

function beginTransitionToIndex(index) {
  const ids = params.playlistIds;
  const id = ids[index];
  const entry = getVideoEntryById(id);
  const inactive = getInactiveVideo();
  if (!entry || !inactive) return;

  const url = resolveVideoUrl(entry);
  inactive.src = url;
  inactive.load();

  let started = false;
  const startWhenReady = () => {
    if (started) return;
    if (inactive.readyState < 2) return;
    started = true;
    inactive.removeEventListener('canplay', startWhenReady);
    const t = params.transition;
    if (t === 'cut') {
      inactive.currentTime = 0;
      attemptAutoplay(inactive, null, { showFallbackOverlay: false });
      getCurrentVideo().pause();
      swapActive();
      trans.phase = 'idle';
      preloadNext();
      persistState();
      return;
    }
    if (t === 'fadeBlack') {
      trans.phase = 'fadeBlack';
      trans.t0 = performance.now();
      trans.duration = Math.max(120, params.fadeBlackMs);
      trans.blackAlpha = 0;
      trans.fromSlot = activeSlot;
      trans.toSlot = activeSlot === 'a' ? 'b' : 'a';
      trans._didSwap = false;
      trans._loopRestart = false;
      inactive.currentTime = 0;
      // Do not play inactive until mid-transition (see drawFrame fadeBlack)
      return;
    }
    // crossfade (default)
    trans.phase = 'crossfade';
    trans.t0 = performance.now();
    trans.duration = params.crossfadeMs;
    trans.fromSlot = activeSlot;
    trans.toSlot = activeSlot === 'a' ? 'b' : 'a';
    inactive.currentTime = 0;
    attemptAutoplay(inactive, null, { showFallbackOverlay: false });
  };

  inactive.addEventListener('canplay', startWhenReady, { once: true });
  // Same-URL reuse may not fire canplay; retry until HAVE_CURRENT_DATA
  [120, 400, 1200].forEach((t) => setTimeout(() => startWhenReady(), t));
}

function startFadeBlackLoop() {
  trans.phase = 'fadeBlack';
  trans.t0 = performance.now();
  trans.duration = Math.max(120, params.singleLoopFadeBlackMs);
  trans.blackAlpha = 0;
  trans.fromSlot = activeSlot;
  trans.toSlot = activeSlot;
  trans._didSwap = false;
  trans._loopRestart = true;
}

function showTapOverlay() {
  needsUserGesture = true;
  if (!container || tapOverlay) return;
  tapOverlay = document.createElement('div');
  tapOverlay.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,.75);color:#fff;font:16px sans-serif;cursor:pointer;z-index:20;';
  tapOverlay.textContent = 'Tap to start playback (browser autoplay policy)';
  tapOverlay.addEventListener(
    'click',
    () => {
      tapOverlay?.remove();
      tapOverlay = null;
      needsUserGesture = false;
      getCurrentVideo()
        ?.play()
        .catch(() => {});
    },
    { once: true }
  );
  container.appendChild(tapOverlay);
}

function resize() {
  if (!canvas || !container) return;
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawFrame(now) {
  if (!ctx || !canvas) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return;

  const raw = getAmplitude();
  smoothAmp += (raw - smoothAmp) * 0.15;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  const eff = {
    mode: params.effectMode,
    intensity: params.effectIntensity,
    sensitivity: params.effectSensitivity,
    threshold: params.effectThreshold,
  };

  if (trans.phase === 'idle') {
    const v = getCurrentVideo();
    if (v && v.readyState >= 2) {
      drawVideoEffect(ctx, v, w, h, smoothAmp, eff, now);
    }
    return;
  }

  if (trans.phase === 'crossfade') {
    const elapsed = now - trans.t0;
    const u = Math.min(1, elapsed / Math.max(1, trans.duration));
    const v1 = trans.fromSlot === 'a' ? videoA : videoB;
    const v2 = trans.toSlot === 'a' ? videoA : videoB;
    if (v1 && v1.readyState >= 2) {
      ctx.save();
      ctx.globalAlpha = 1 - u;
      drawVideoEffect(ctx, v1, w, h, smoothAmp, eff, now);
      ctx.restore();
    }
    if (v2 && v2.readyState >= 2) {
      ctx.save();
      ctx.globalAlpha = u;
      drawVideoEffect(ctx, v2, w, h, smoothAmp, eff, now);
      ctx.restore();
    }
    if (u >= 1) {
      v1?.pause();
      swapActive();
      trans.phase = 'idle';
      getCurrentVideo()?.play().catch(() => showTapOverlay());
      preloadNext();
      persistState();
    }
    return;
  }

  if (trans.phase === 'fadeBlack') {
    const elapsed = now - trans.t0;
    const u = Math.min(1, elapsed / Math.max(1, trans.duration));
    const vFrom = trans.fromSlot === 'a' ? videoA : videoB;
    const vTo = trans.toSlot === 'a' ? videoA : videoB;

    // Single-video loop: fade out → seek(0) → fade in (same element)
    if (trans._loopRestart) {
      if (u < 0.5) {
        const k = u * 2;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        if (vFrom && vFrom.readyState >= 2) {
          ctx.save();
          ctx.globalAlpha = 1 - k;
          drawVideoEffect(ctx, vFrom, w, h, smoothAmp, eff, now);
          ctx.restore();
        }
        ctx.fillStyle = `rgba(0,0,0,${k})`;
        ctx.fillRect(0, 0, w, h);
      } else {
        if (!trans._didSwap) {
          trans._didSwap = true;
          vFrom.currentTime = 0;
          vFrom.play().catch(() => showTapOverlay());
        }
        const k = (u - 0.5) * 2;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        if (vFrom && vFrom.readyState >= 2) {
          ctx.save();
          ctx.globalAlpha = k;
          drawVideoEffect(ctx, vFrom, w, h, smoothAmp, eff, now);
          ctx.restore();
        }
      }
      if (u >= 1) {
        trans.phase = 'idle';
        trans._loopRestart = false;
        trans._didSwap = false;
      }
      return;
    }

    // Playlist: fade out A → swap/play B → fade in B
    if (u < 0.5) {
      const k = u * 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      if (vFrom && vFrom.readyState >= 2) {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        drawVideoEffect(ctx, vFrom, w, h, smoothAmp, eff, now);
        ctx.restore();
      }
      ctx.fillStyle = `rgba(0,0,0,${k})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      if (!trans._didSwap) {
        trans._didSwap = true;
        vFrom.pause();
        vTo.currentTime = 0;
        vTo.play().catch(() => showTapOverlay());
        swapActive();
      }
      const k = (u - 0.5) * 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      if (vTo && vTo.readyState >= 2) {
        ctx.save();
        ctx.globalAlpha = k;
        drawVideoEffect(ctx, vTo, w, h, smoothAmp, eff, now);
        ctx.restore();
      }
    }
    if (u >= 1) {
      trans.phase = 'idle';
      trans._didSwap = false;
      preloadNext();
      persistState();
    }
    return;
  }
}

function tick(now) {
  animationId = requestAnimationFrame(tick);
  drawFrame(now);
}

function startPlaybackFromState() {
  const entry = currentEntryFromMode();
  if (!entry || !videoA) return;
  if (params.playbackMode === 'playlist' && params.playlistIds.length) {
    playlistIndex = 0;
  }
  const url = resolveVideoUrl(entry);
  if (!url) return;
  videoA.src = url;
  videoA.load();
  activeSlot = 'a';
  attemptAutoplay(videoA, () => preloadNext());
}

export function updateParams(patch) {
  Object.assign(params, patch);
  if (patch.singleVideoId !== undefined) {
    params.singleVideoId = patch.singleVideoId === '' ? null : patch.singleVideoId;
  }
  if (patch.playlistIds && typeof patch.playlistIds === 'string') {
    try {
      params.playlistIds = JSON.parse(patch.playlistIds);
    } catch {
      params.playlistIds = [];
    }
  }
  if (patch.playlistIndex !== undefined) {
    playlistIndex = Math.max(0, parseInt(patch.playlistIndex, 10) || 0);
  }
  persistState();
}

function handleParamMessage(event) {
  if (!event.data || event.data.type !== 'PARAM_CHANGE') return;
  const { param, value } = event.data;
  if (param === 'reloadPlayback') {
    playlistIndex = 0;
    startPlaybackFromState();
    return;
  }
  updateParams({ [param]: value });
}

export async function initModule({ container: el, audio, controlsChannel: ch }) {
  container = el;
  audioAPI = audio;
  controlsChannel = ch;

  await loadManifest();
  await applySavedModuleState();
  ensureDefaultMediaSelection();

  canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;background:#000;';
  ctx = canvas.getContext('2d');
  container.style.cssText = 'width:100%;height:100%;overflow:hidden;background:#000;position:relative;';
  container.appendChild(canvas);

  videoA = document.createElement('video');
  videoB = document.createElement('video');
  for (const v of [videoA, videoB]) {
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('autoplay', '');
    v.preload = 'auto';
    v.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    container.appendChild(v);
    attachVideoListeners(v);
  }

  window.addEventListener('resize', resize);
  if (controlsChannel) controlsChannel.addEventListener('message', handleParamMessage);
  window.addEventListener('message', handleParamMessage);

  resize();
  startPlaybackFromState();
  animationId = requestAnimationFrame(tick);
}

export function start() {
  if (!animationId) animationId = requestAnimationFrame(tick);
  // Loader calls start() right after init; user gesture may apply here — retry if still paused
  const v = getCurrentVideo();
  if (v && v.src && v.paused && v.readyState >= 2) {
    attemptAutoplay(v, () => preloadNext());
  }
}

export function stop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  videoA?.pause();
  videoB?.pause();
}

export function destroy() {
  stop();
  if (autoplayFallbackTimer) {
    clearTimeout(autoplayFallbackTimer);
    autoplayFallbackTimer = null;
  }
  window.removeEventListener('resize', resize);
  window.removeEventListener('message', handleParamMessage);
  if (controlsChannel) controlsChannel.removeEventListener('message', handleParamMessage);
  controlsChannel = null;
  tapOverlay?.remove();
  tapOverlay = null;
  videoA?.remove();
  videoB?.remove();
  videoA = null;
  videoB = null;
  canvas?.remove();
  canvas = null;
  ctx = null;
  container = null;
  audioAPI = null;
  resetEffectsWork();
}

if (typeof window !== 'undefined') {
  window.moduleAPI = {
    initModule,
    start,
    stop,
    destroy,
    updateParams,
  };
}
