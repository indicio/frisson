/** Playlist playback uses the viewer's single loader and serialized transitions. */
import * as loader from './loader.js';

let playlist = [];
let currentIndex = 0;
let isPlaying = false;
let currentTimeout = null;
let onModuleChangeCallback = null;
let getEntryParamsCallback = null;
let fadeInDuration = 1000;
let fadeOutDuration = 1000;
let repeatMode = false;
let fadeEnabled = true;
let deadline = null;
let remainingDuration = null;
let revision = 0;
let loadedIndex = -1;

function clearTimer() {
  clearTimeout(currentTimeout);
  currentTimeout = null;
}
function valid(token) { return isPlaying && token === revision; }
function schedule(container, duration, token) {
  if (!valid(token)) return;
  clearTimer();
  deadline = performance.now() + duration;
  currentTimeout = setTimeout(() => {
    deadline = null;
    remainingDuration = null;
    currentIndex++;
    void playCurrent(container);
  }, duration);
}
export function setPlaylist(entries) {
  stop();
  playlist = entries.map(entry => ({ ...entry, durationMs: Math.max(1, Number(entry.durationMs) || 1000) }));
  currentIndex = 0;
  loadedIndex = -1;
  remainingDuration = null;
}
export function addToPlaylist(entry) {
  playlist.push({ ...entry, durationMs: Math.max(1, Number(entry.durationMs) || 1000) });
}
export function clearPlaylist() { setPlaylist([]); }
export async function play(container, onModuleChange, getEntryParams) {
  if (!playlist.length || isPlaying) return;
  isPlaying = true;
  onModuleChangeCallback = onModuleChange;
  getEntryParamsCallback = getEntryParams || null;
  return playCurrent(container);
}
export function stop() {
  ++revision;
  isPlaying = false;
  if (deadline !== null) remainingDuration = Math.max(0, deadline - performance.now());
  deadline = null;
  clearTimer();
  // A stop during initialization runs after that initialization finishes.
  return loader.runTransition(() => loader.stopModule()).catch(error => console.warn('Could not stop module', error));
}
export async function resume(container, getEntryParams) {
  if (isPlaying || !playlist.length || currentIndex >= playlist.length) return;
  getEntryParamsCallback = getEntryParams || getEntryParamsCallback;
  isPlaying = true;
  if (!loader.getCurrentModule() || loadedIndex !== currentIndex) return playCurrent(container);
  const token = ++revision;
  return loader.runTransition(async () => {
    if (!valid(token)) return;
    try {
      loader.resumeAudioUpdates();
      await loader.startModule();
      if (!valid(token)) return;
      container.style.opacity = '1';
      container.style.transition = '';
      const duration = remainingDuration ?? playlist[currentIndex].durationMs;
      remainingDuration = null;
      schedule(container, duration, token);
      onModuleChangeCallback?.(playlist[currentIndex].moduleId, playlist[currentIndex]);
    } catch (error) {
      if (valid(token)) { isPlaying = false; console.error('Could not resume playlist', error); }
    }
  });
}
async function fade(container, opacity, duration) {
  container.style.transition = `opacity ${duration}ms ease`;
  container.style.opacity = String(opacity);
  await new Promise(resolve => setTimeout(resolve, duration));
  container.style.transition = '';
}
async function playCurrent(container) {
  const token = ++revision;
  clearTimer();
  deadline = null;
  remainingDuration = null;
  return loader.runTransition(async () => {
    // Bound failures to one pass, even with repeat enabled.
    for (let failed = 0; valid(token) && failed < playlist.length; failed++) {
      if (currentIndex >= playlist.length) {
        if (repeatMode) currentIndex = 0;
        else { isPlaying = false; await loader.stopModule(); return; }
      }
      const entry = playlist[currentIndex];
      try {
        if (loader.getCurrentModule()) {
          if (fadeEnabled) await fade(container, 0, fadeOutDuration);
          if (!valid(token)) return;
          await loader.stopModule();
          if (!valid(token)) return;
        }
        loadedIndex = -1;
        await loader.loadModule(entry.modulePath, container);
        if (!valid(token)) return;
        if (getEntryParamsCallback) {
          const params = await getEntryParamsCallback(entry);
          if (!valid(token)) return;
          if (params) await loader.applyInitialParams(params);
          if (!valid(token)) return;
        }
        await loader.startModule();
        if (!valid(token)) return;
        loadedIndex = currentIndex;
        if (fadeEnabled) await fade(container, 1, fadeInDuration);
        else container.style.opacity = '1';
        if (!valid(token)) return;
        schedule(container, entry.durationMs, token);
        onModuleChangeCallback?.(entry.moduleId, entry);
        return;
      } catch (error) {
        if (!valid(token)) return;
        console.error('Error playing playlist entry:', error);
        await loader.unloadModule().catch(() => {});
        if (!valid(token)) return;
        loadedIndex = -1;
        currentIndex++;
      }
    }
    if (valid(token)) {
      isPlaying = false;
      container.style.opacity = '1';
      console.error('Playlist stopped because no entries could load.');
    }
  });
}
export function jumpTo(index, container) {
  if (index < 0 || index >= playlist.length) return;
  ++revision;
  clearTimer();
  deadline = null;
  remainingDuration = null;
  currentIndex = index;
  if (isPlaying) return playCurrent(container);
}
export function next(container) {
  if (currentIndex + 1 < playlist.length) return jumpTo(currentIndex + 1, container);
  if (repeatMode) return jumpTo(0, container);
  stop();
  currentIndex = playlist.length;
}
export function previous(container) { return jumpTo(Math.max(0, currentIndex - 1), container); }

/**
 * Get current playlist
 * @returns {PlaylistEntry[]}
 */
export function getPlaylist() {
  return [...playlist];
}

/**
 * Get current index
 * @returns {number}
 */
export function getCurrentIndex() {
  return currentIndex;
}

/**
 * Check if playlist is playing
 * @returns {boolean}
 */
export function isPlayingPlaylist() {
  return isPlaying;
}

/**
 * Set fade durations
 * @param {number} fadeIn - Fade in duration in ms
 * @param {number} fadeOut - Fade out duration in ms
 */
export function setFadeDurations(fadeIn, fadeOut) {
  fadeInDuration = fadeIn;
  fadeOutDuration = fadeOut;
}

/**
 * Set repeat mode (loop playlist when it ends)
 * @param {boolean} enabled - Whether to repeat
 */
export function setRepeatMode(enabled) {
  repeatMode = !!enabled;
}

/**
 * Get repeat mode
 * @returns {boolean}
 */
export function getRepeatMode() {
  return repeatMode;
}

/**
 * Toggle repeat mode
 * @returns {boolean} New state
 */
export function toggleRepeatMode() {
  repeatMode = !repeatMode;
  return repeatMode;
}

/**
 * Set fade mode (fade out/in between modules)
 * @param {boolean} enabled - Whether to fade
 */
export function setFadeEnabled(enabled) {
  fadeEnabled = !!enabled;
}

/**
 * Get fade mode
 * @returns {boolean}
 */
export function getFadeEnabled() {
  return fadeEnabled;
}

/**
 * Toggle fade mode
 * @returns {boolean} New state
 */
export function toggleFadeEnabled() {
  fadeEnabled = !fadeEnabled;
  return fadeEnabled;
}

