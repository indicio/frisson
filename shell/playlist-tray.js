/**
 * Playlist Tray Module
 * Manages the playlist UI tray at the bottom of the screen
 */

import * as localPlaylist from './playlist.js';
let playlistModule = localPlaylist;
import { getModuleFavoriteNames, getModuleFavoriteParams } from '../shared/favorites.js';
import { loadShellConfig, updateShellConfig } from '../shared/portableStorage.js';

function refreshPlaylistLucideIcons() {
  const L = globalThis.lucide;
  const root = document.getElementById('playlist-tray');
  if (!root || typeof L?.createIcons !== 'function') return;
  L.createIcons({
    attrs: { class: 'lucide lucide-icon', 'stroke-width': 1.75 },
    root,
  });
}

let modules = []; // Will be set from shell
let playlist = [];
let savedPlaylists = {};
let currentIndex = -1;
let isPlaying = false;
let isPaused = false;
let draggedElement = null;
let dragOverElement = null;
/** Bumps on each `renderPlaylist` start so stale async renders cannot append duplicate nodes. */
let playlistRenderVersion = 0;

// DOM Elements
let tray = null;
let trayHeader = null;
let trayToggle = null;
let playlistItems = null;
let addModuleModal = null;
let modalClose = null;
let availableModulesList = null;
let playBtn = null;
let pauseBtn = null;
let stopBtn = null;
let repeatBtn = null;
let fadeBtn = null;
let clearBtn = null;

/**
 * Initialize playlist tray
 * @param {Array} availableModules - Array of module definitions from modules.json
 * @param {object} [callbacks]
 * @param {object} [callbacks.shellConfig] - Pre-loaded shell config (from loadShellConfig) to avoid duplicate fetch
 */
export async function init(availableModules, callbacks = {}) {
  // Store callbacks
  window.playlistTrayCallbacks = callbacks;
  modules = availableModules || [];

  // Get DOM elements
  tray = document.getElementById('playlist-tray');
  trayHeader = document.getElementById('playlist-tray-header');
  trayToggle = document.getElementById('playlist-tray-toggle');
  playlistItems = document.getElementById('playlist-items');
  addModuleModal = document.getElementById('add-module-modal');
  modalClose = document.getElementById('modal-close');
  availableModulesList = document.getElementById('available-modules-list');
  playBtn = document.getElementById('play-btn');
  pauseBtn = document.getElementById('pause-btn');
  stopBtn = document.getElementById('stop-btn');
  repeatBtn = document.getElementById('repeat-btn');
  fadeBtn = document.getElementById('fade-btn');
  clearBtn = document.getElementById('clear-btn');

  if (!tray || !playlistItems) {
    console.error('Playlist tray elements not found');
    return;
  }

  const cfg = callbacks.shellConfig || (await loadShellConfig());
  if (Array.isArray(cfg.playlist)) {
    playlist = cfg.playlist;
  }
  if (typeof cfg.repeat === 'boolean') {
    playlistModule.setRepeatMode(cfg.repeat);
  }
  if (typeof cfg.fade === 'boolean') {
    playlistModule.setFadeEnabled(cfg.fade);
  }

  if (cfg.savedPlaylists && typeof cfg.savedPlaylists === 'object') {
    savedPlaylists = cfg.savedPlaylists;
  }

  setupEventListeners();
  renderAvailableModules();
  renderPlaylist();
  updateRepeatButton();
  updateFadeButton();
  refreshPlaylistLucideIcons();
}

/**
 * Get favorites for a module (async – project JSON when using node serve.js).
 * @param {string} moduleId - Module ID
 * @returns {Promise<string[]>} Array of favorite names
 */
async function getModuleFavorites(moduleId) {
  try {
    return await getModuleFavoriteNames(moduleId);
  } catch {
    return [];
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Tray toggle — only the h2 title and the chevron button expand/collapse
  const trayTitle = trayHeader?.querySelector('h2');
  if (trayTitle) {
    trayTitle.style.cursor = 'pointer';
    trayTitle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTray();
    });
  }
  if (trayToggle) {
    trayToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTray();
    });
  }

  // Add module button is created dynamically in renderPlaylist

  // Modal close
  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }
  if (addModuleModal) {
    addModuleModal.addEventListener('click', (e) => {
      if (e.target === addModuleModal) {
        closeModal();
      }
    });
  }

  // Playback buttons (inside header — stop propagation to avoid toggling tray)
  if (playBtn) {
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isPaused) {
        resumePlayback();
      } else {
        startPlayback();
      }
    });
  }
  if (pauseBtn) {
    pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); pausePlayback(); });
  }
  if (stopBtn) {
    stopBtn.addEventListener('click', (e) => { e.stopPropagation(); stopPlayback(); });
  }
  if (repeatBtn) {
    repeatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playlistModule.toggleRepeatMode();
      updateRepeatButton();
      void persistShellPlaylistState();
    });
  }
  if (fadeBtn) {
    fadeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playlistModule.toggleFadeEnabled();
      updateFadeButton();
      void persistShellPlaylistState();
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => { e.stopPropagation(); clearPlaylist(); });
  }

  setupSavedPlaylists();

  // Listen for playlist module events
  checkPlaylistState();
  setInterval(checkPlaylistState, 500);
}

/**
 * Check playlist state from playlist.js module
 */
function checkPlaylistState() {
  const playlistIsPlaying = playlistModule.isPlayingPlaylist();
  const playlistIndex = playlistModule.getCurrentIndex();

  if (playlistIsPlaying !== isPlaying || playlistIndex !== currentIndex) {
    isPlaying = playlistIsPlaying;
    currentIndex = playlistIndex;
    updatePlaybackButtons();
    renderPlaylist();
  }
}

/**
 * Toggle tray open/closed
 */
function toggleTray() {
  if (!tray) return;
  const isOpening = !tray.classList.contains('open');
  tray.classList.toggle('open');
  tray.classList.toggle('closed');

  // Update overlay visibility
  if (window.updateOverlay) {
    window.updateOverlay();
  }

  if (isOpening && window.playlistTrayCallbacks && window.playlistTrayCallbacks.onOpen) {
    window.playlistTrayCallbacks.onOpen();
  }
}

/**
 * Close playlist tray
 */
export function closeTray() {
  if (!tray) return;
  if (tray.classList.contains('open')) {
    tray.classList.remove('open');
    tray.classList.add('closed');
    // Update overlay visibility
    if (window.updateOverlay) {
      window.updateOverlay();
    }
  }
}

/**
 * Render available modules in modal
 */
function renderAvailableModules() {
  if (!availableModulesList) return;

  availableModulesList.innerHTML = '';
  modules.forEach(module => {
    const card = document.createElement('div');
    card.className = 'available-module-card';
    card.innerHTML = `
      <h4>${module.name}</h4>
      <p>${module.description || 'No description available'}</p>
      <button onclick="window.addModuleToPlaylist('${module.id}')">Add to Playlist</button>
    `;
    availableModulesList.appendChild(card);
  });

  // Expose function globally
  window.addModuleToPlaylist = (moduleId) => {
    addModuleToPlaylist(moduleId);
  };
}

/**
 * Add module to playlist
 * @param {string} moduleId - Module ID to add
 */
async function addModuleToPlaylist(moduleId) {
  const module = modules.find(m => m.id === moduleId);
  if (!module) return;

  const favorites = await getModuleFavorites(moduleId);
  const defaultFavorite = favorites.length > 0 ? favorites[0] : 'Default';

  const playlistItem = {
    id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    moduleId: module.id,
    moduleName: module.name,
    path: module.path, // Note: playlist.js expects 'path', not 'modulePath'
    favorite: defaultFavorite,
    duration: 30, // seconds
    order: playlist.length
  };

  playlist.push(playlistItem);
  savePlaylistToStorage();
  renderPlaylist();
  closeModal();
}

/**
 * Render playlist items
 */
async function renderPlaylist() {
  if (!playlistItems) return;

  const version = ++playlistRenderVersion;
  playlistItems.innerHTML = '';

  // Array position is the source of truth (maintained by reorderPlaylist splice)
  const sortedPlaylist = [...playlist];

  const cards = await Promise.all(
    sortedPlaylist.map((item, index) => createPlaylistItemCard(item, index))
  );
  if (version !== playlistRenderVersion) return;

  for (const card of cards) {
    playlistItems.appendChild(card);
  }
  if (version !== playlistRenderVersion) return;

  // Add "Add Module" button after items (inline with items)
  const addBtn = document.createElement('div');
  addBtn.className = 'add-module-btn';
  addBtn.innerHTML = '<span>Add Module</span>';
  addBtn.addEventListener('click', openModal);
  playlistItems.appendChild(addBtn);

  updatePlaybackButtons();
}

/**
 * Create playlist item card
 * @param {Object} item - Playlist item
 * @param {number} index - Index in sorted playlist
 * @returns {HTMLElement} Card element
 */
async function createPlaylistItemCard(item, index) {
  const module = modules.find(m => m.id === item.moduleId);
  const favorites = await getModuleFavorites(item.moduleId);

  const card = document.createElement('div');
  card.className = 'playlist-item';
  card.dataset.itemId = item.id;
  card.dataset.order = item.order;
  card.draggable = true;

  if (currentIndex === index && isPlaying) {
    card.classList.add('playing');
  }

  // Build favorite options
  let favoriteOptions = '';
  const allFavorites = ['Default', ...favorites.filter(f => f !== 'Default')];
  allFavorites.forEach(fav => {
    const selected = item.favorite === fav ? 'selected' : '';
    favoriteOptions += `<option value="${fav}" ${selected}>${fav}</option>`;
  });

  card.innerHTML = `
    <button class="playlist-item-remove" onclick="window.removePlaylistItem('${item.id}')" title="Remove">&times;</button>
    <div class="playlist-item-drag-handle" title="Drag to reorder"></div>
    <div class="playlist-item-name" title="${item.moduleName}">${item.moduleName}</div>
    <div class="playlist-item-controls">
      <div class="playlist-item-control-group fav-group">
        <label>Favorite</label>
        <select onchange="window.updatePlaylistItemFavorite('${item.id}', this.value)">
          ${favoriteOptions}
        </select>
      </div>
      <div class="playlist-item-control-group dur-group">
        <label>Sec</label>
        <input type="number" min="5" max="300" step="5" value="${item.duration}"
               onchange="window.updatePlaylistItemDuration('${item.id}', this.value)"
               oninput="window.updatePlaylistItemDurationDisplay('${item.id}', this.value)">
      </div>
    </div>
  `;

  // Setup drag and drop with improved behavior
  setupDragAndDrop(card, item);

  // Expose update functions globally
  window.updatePlaylistItemFavorite = (itemId, favorite) => {
    updatePlaylistItemFavorite(itemId, favorite);
  };
  window.updatePlaylistItemDuration = (itemId, duration) => {
    updatePlaylistItemDuration(itemId, duration);
  };
  window.removePlaylistItem = (itemId) => {
    removePlaylistItem(itemId);
  };

  return card;
}

/**
 * Setup improved drag and drop
 * @param {HTMLElement} card - Card element
 * @param {Object} item - Playlist item
 */
function setupDragAndDrop(card, item) {
  const handle = card.querySelector('.playlist-item-drag-handle');

  if (!handle) return;

  // Make entire card draggable, but handle provides visual feedback
  card.addEventListener('dragstart', (e) => {
    draggedElement = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', card.innerHTML);
    e.dataTransfer.setData('item-id', item.id);
  });

  card.addEventListener('dragend', (e) => {
    card.classList.remove('dragging');
    if (dragOverElement) {
      dragOverElement.classList.remove('drag-over');
      dragOverElement = null;
    }
    draggedElement = null;
  });

  card.addEventListener('dragover', (e) => {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    // Highlight drop target
    if (dragOverElement && dragOverElement !== card) {
      dragOverElement.classList.remove('drag-over');
    }
    if (card !== draggedElement) {
      card.classList.add('drag-over');
      dragOverElement = card;
    }

    // Insert before/after based on position
    const rect = card.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const after = e.clientX > midX;

    if (draggedElement && draggedElement !== card) {
      if (after) {
        playlistItems.insertBefore(draggedElement, card.nextSibling);
      } else {
        playlistItems.insertBefore(draggedElement, card);
      }
    }

    return false;
  });

  card.addEventListener('dragenter', (e) => {
    if (card !== draggedElement) {
      card.classList.add('drag-over');
    }
  });

  card.addEventListener('dragleave', (e) => {
    card.classList.remove('drag-over');
  });

  card.addEventListener('drop', (e) => {
    if (e.stopPropagation) {
      e.stopPropagation();
    }

    e.preventDefault();

    if (draggedElement && draggedElement !== card) {
      // Reorder playlist
      const draggedItemId = draggedElement.dataset.itemId;
      const targetItemId = card.dataset.itemId;

      reorderPlaylist(draggedItemId, targetItemId, e.clientX > (card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2));
    }

    return false;
  });
}

/**
 * Reorder playlist items
 * @param {string} draggedId - ID of dragged item
 * @param {string} targetId - ID of target item
 * @param {boolean} after - Insert after target
 */
function reorderPlaylist(draggedId, targetId, after) {
  const draggedIndex = playlist.findIndex(p => p.id === draggedId);
  const targetIndex = playlist.findIndex(p => p.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return;
  }

  const dragged = playlist.splice(draggedIndex, 1)[0];
  const newIndex = after ? targetIndex + 1 : targetIndex;

  if (newIndex > draggedIndex) {
    playlist.splice(newIndex - 1, 0, dragged);
  } else {
    playlist.splice(newIndex, 0, dragged);
  }

  // Reassign order values
  playlist.forEach((item, index) => {
    item.order = index;
  });

  savePlaylistToStorage();
  renderPlaylist();
}

/**
 * Update playlist item favorite
 * @param {string} itemId - Item ID
 * @param {string} favorite - Favorite name
 */
function updatePlaylistItemFavorite(itemId, favorite) {
  const item = playlist.find(p => p.id === itemId);
  if (item) {
    item.favorite = favorite;
    savePlaylistToStorage();
  }
}

/**
 * Update playlist item duration
 * @param {string} itemId - Item ID
 * @param {number} duration - Duration in seconds
 */
function updatePlaylistItemDuration(itemId, duration) {
  const item = playlist.find(p => p.id === itemId);
  if (item) {
    item.duration = parseInt(duration) || 30;
    savePlaylistToStorage();
  }
}

/**
 * Update playlist item duration display (for real-time input)
 * @param {string} itemId - Item ID
 * @param {number} duration - Duration in seconds
 */
window.updatePlaylistItemDurationDisplay = function (itemId, duration) {
  // Just validate input, actual save happens on change
  const num = parseInt(duration);
  if (isNaN(num) || num < 5) {
    return;
  }
};

/**
 * Remove playlist item
 * @param {string} itemId - Item ID to remove
 */
function removePlaylistItem(itemId) {
  const itemIndex = playlist.findIndex(p => p.id === itemId);
  if (itemIndex === -1) return;

  playlist.splice(itemIndex, 1);

  // Reorder remaining items
  playlist.forEach((item, index) => {
    item.order = index;
  });

  // If removed item was playing, stop
  if (itemIndex === currentIndex || currentIndex >= playlist.length) {
    stopPlayback();
  }

  savePlaylistToStorage();
  renderPlaylist();
}

/**
 * Open modal
 */
function openModal() {
  if (addModuleModal) {
    addModuleModal.classList.add('open');
  }
}

/**
 * Close modal
 */
function closeModal() {
  if (addModuleModal) {
    addModuleModal.classList.remove('open');
  }
}

/**
 * Start playback
 */
async function startPlayback() {
  if (playlist.length === 0) {
    alert('Playlist is empty. Add modules first.');
    return;
  }

  // Ensure viewer is open — launch it if needed
  const ensureViewerOpen = window.ensureViewerOpen;
  if (ensureViewerOpen) {
    const ready = await ensureViewerOpen();
    if (!ready) {
      return; // ensureViewerOpen shows error on popup block or connection timeout
    }
  } else if (!window.isViewerConnected) {
    alert('Viewer window must be open to play playlist.');
    return;
  }

  // Use current array order (source of truth — no sort by order field)
  const playlistEntries = playlist.map(item => ({
    moduleId: item.moduleId,
    moduleName: item.moduleName,
    modulePath: item.path || item.modulePath,
    durationMs: item.duration * 1000,
    favorite: item.favorite
  }));

  const remotePlaylist = window.viewerWindow?.frissonPlaylist;
  if (!remotePlaylist) {
    alert('The viewer is not ready. Reopen it from this dashboard and try again.');
    return;
  }
  if (remotePlaylist && playlistModule !== remotePlaylist) {
    remotePlaylist.setRepeatMode(playlistModule.getRepeatMode());
    remotePlaylist.setFadeEnabled(playlistModule.getFadeEnabled());
    playlistModule.stop();
    playlistModule = remotePlaylist;
  }
  playlistModule.setPlaylist(playlistEntries);

  // Get viewer container
  const viewerWindow = window.viewerWindow;
  if (!viewerWindow || viewerWindow.closed) {
    alert('Viewer window is not open.');
    return;
  }

  // Get viewer container from viewer window
  let container;
  try {
    container = viewerWindow.document.getElementById('viewer-container');
  } catch (err) {
    console.error('Cannot access viewer container (cross-origin):', err);
    container = null;
  }

  if (!container) {
    alert('The viewer is not ready. Reopen it from this dashboard and try again.');
    return;
  }

  isPlaying = true;
  isPaused = false;
  currentIndex = 0;

  // Start playing using playlist module with callback and pre-start param loader
  playlistModule.play(container, async (moduleId, entry) => {
    // Update UI
    currentIndex = playlistModule.getCurrentIndex();
    renderPlaylist();
    updatePlaybackButtons();
  }, async (entry) => {
    // Fetch favorite params before module starts — no visible glitch
    if (entry.favorite && entry.favorite !== 'Default') {
      return await getModuleFavoriteParams(entry.moduleId, entry.favorite);
    }
    return null;
  });

  updatePlaybackButtons();
}

/**
 * Pause playback
 */
function pausePlayback() {
  playlistModule.stop();
  isPaused = true;
  updatePlaybackButtons();
}

/**
 * Resume playback
 */
async function resumePlayback() {
  if (playlist.length === 0) return;

  const viewerWindow = window.viewerWindow;
  if (!viewerWindow || viewerWindow.closed) return;

  let container;
  try {
    container = viewerWindow.document.getElementById('viewer-container');
  } catch (err) {
    alert('The viewer is not ready. Reopen it from this dashboard and try again.');
    return;
  }

  if (!container) {
    alert('The viewer is not ready. Reopen it from this dashboard and try again.');
    return;
  }

  isPaused = false;

  // Resume using playlist module — restarts in-place without reloading
  playlistModule.resume(container, async (entry) => {
    if (entry.favorite && entry.favorite !== 'Default') {
      return await getModuleFavoriteParams(entry.moduleId, entry.favorite);
    }
    return null;
  });

  updatePlaybackButtons();
}

/**
 * Stop playback
 */
function stopPlayback() {
  playlistModule.stop();
  isPlaying = false;
  isPaused = false;
  currentIndex = -1;


  renderPlaylist();
  updatePlaybackButtons();
}

/**
 * Update repeat button visual state
 */
function updateRepeatButton() {
  if (!repeatBtn) return;
  const enabled = playlistModule.getRepeatMode();
  repeatBtn.classList.toggle('active', enabled);
  repeatBtn.title = enabled ? 'Repeat: On (playlist loops)' : 'Repeat: Off';
}

/**
 * Update fade button visual state
 */
function updateFadeButton() {
  if (!fadeBtn) return;
  const enabled = playlistModule.getFadeEnabled();
  fadeBtn.classList.toggle('active', enabled);
  fadeBtn.title = enabled ? 'Fade: On (fade between modules)' : 'Fade: Off';
}

/**
 * Update playback buttons
 */
function updatePlaybackButtons() {
  if (!playBtn || !pauseBtn || !stopBtn) return;

  updateRepeatButton();
  updateFadeButton();

  if (isPlaying && !isPaused) {
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    playBtn.innerHTML = '<i data-lucide="play" aria-hidden="true"></i>';
  } else if (isPaused) {
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = false;
    playBtn.innerHTML = '<i data-lucide="play" aria-hidden="true"></i>';
  } else {
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    playBtn.innerHTML = '<i data-lucide="play" aria-hidden="true"></i>';
  }
  refreshPlaylistLucideIcons();
}

/** Persist master playlist + tray flags to data/shell/config.json (browser localStorage only if API is unavailable). */
async function persistShellPlaylistState() {
  try {
    await updateShellConfig({
      playlist: [...playlist],
      repeat: playlistModule.getRepeatMode(),
      fade: playlistModule.getFadeEnabled(),
    });
  } catch (err) {
    console.error('Error saving playlist state:', err);
  }
}

function savePlaylistToStorage() {
  void persistShellPlaylistState();
}

/* ── Saved Playlists ─────────────────────────────────────────── */

function setupSavedPlaylists() {
  populateSavedPlaylistDropdown();

  document.getElementById('save-saved-playlist-btn')?.addEventListener('click', () => {
    const input = document.getElementById('saved-playlist-name');
    const select = document.getElementById('saved-playlist-select');
    const name = input?.value.trim() || (select?.value || '');
    if (!name) return;
    saveCurrentPlaylist(name);
    input.value = '';
    if (select) select.value = name;
  });

  document.getElementById('saved-playlist-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const input = e.target;
      const select = document.getElementById('saved-playlist-select');
      const name = input.value.trim() || (select?.value || '');
      if (!name) return;
      saveCurrentPlaylist(name);
      input.value = '';
      if (select) select.value = name;
    }
  });

  document.getElementById('load-saved-playlist-btn')?.addEventListener('click', () => {
    const select = document.getElementById('saved-playlist-select');
    if (!select || !select.value) return;
    loadSavedPlaylist(select.value);
  });

  document.getElementById('delete-saved-playlist-btn')?.addEventListener('click', () => {
    const select = document.getElementById('saved-playlist-select');
    if (!select || !select.value) return;
    if (confirm(`Delete saved playlist "${select.value}"?`)) {
      deleteSavedPlaylist(select.value);
    }
  });
}

function populateSavedPlaylistDropdown() {
  const select = document.getElementById('saved-playlist-select');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- Saved Playlists --</option>';
  Object.keys(savedPlaylists).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  if (current && savedPlaylists[current]) {
    select.value = current;
  }
}

function saveCurrentPlaylist(name) {
  savedPlaylists[name] = playlist.map(item => ({ ...item }));
  populateSavedPlaylistDropdown();
  void persistSavedPlaylists();
}

function loadSavedPlaylist(name) {
  if (!name || !savedPlaylists[name]) return;
  if (isPlaying || isPaused) stopPlayback();
  playlist = savedPlaylists[name].map(item => ({ ...item }));
  const select = document.getElementById('saved-playlist-select');
  if (select) select.value = name;
  renderPlaylist();
  savePlaylistToStorage();
}

function deleteSavedPlaylist(name) {
  if (!name || !savedPlaylists[name]) return;
  delete savedPlaylists[name];
  populateSavedPlaylistDropdown();
  void persistSavedPlaylists();
}

async function persistSavedPlaylists() {
  try {
    await updateShellConfig({ savedPlaylists });
  } catch (err) {
    console.error('Error saving playlists:', err);
  }
}

/**
 * Clear all modules from playlist
 */
function clearPlaylist() {
  if (playlist.length === 0) {
    return; // Already empty
  }

  // Confirm with user
  if (!confirm(`Clear all ${playlist.length} module(s) from playlist?`)) {
    return;
  }

  // Stop playback if playing
  stopPlayback();

  // Clear playlist array
  playlist = [];

  // Clear from playlist.js module
  playlistModule.clearPlaylist();

  // Save to storage
  savePlaylistToStorage();

  // Re-render
  renderPlaylist();
}



