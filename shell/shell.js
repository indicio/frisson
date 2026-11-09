/**
 * Main Shell Application
 * Coordinates module loading, UI, and user interactions
 */

import * as playlistTray from './playlist-tray.js';
import * as imageLayerUI from './imageLayerUI.js';
import {
  loadShellConfig,
  updateShellConfig,
  isShellConfigFromProjectFile,
} from '../shared/portableStorage.js';
import { getMostRecentFavoriteParams } from '../shared/favorites.js';
import { applyControlColumns, startControlPreview } from '../shared/controlPreview.js';
import { mountPreviewImage } from '../shared/previewImageLayer.js';
import * as audio from './audio.js';

// Module IDs to hide from the shell (can reactivate by removing from this list)
const DISABLED_MODULE_IDS = ['shake', 'mosh', 'gradientmap', 'eidolon'];

let modules = [];
let currentModuleId = null;
let selectedModule = null;
let previewHandle = null;
let previewPath = '';
let previewPending = false;
let previewToken = 0;
const PREVIEW_KEY = 'frisson-control-preview';
let viewerWindow = null;
let viewerChannel = null;
let isViewerConnected = false;
let currentControlsPath = null;
let filteredModules = [];
let currentSort = 'alpha-asc';
let currentFilter = 'all';
let currentView = 'grid'; // 'grid' or 'list'

/**
 * Initialize the shell application
 */
export async function init() {
  try {
    console.log('Starting shell initialization...');

    // Load modules manifest
    console.log('Loading modules.json...');
    const response = await fetch('./modules.json');
    if (!response.ok) {
      throw new Error(`Failed to load modules.json: ${response.status} ${response.statusText}`);
    }
    const allModules = await response.json();
    modules = allModules.filter(m => !DISABLED_MODULE_IDS.includes(m.id));
    console.log(`Loaded ${modules.length} module(s) from modules.json (${DISABLED_MODULE_IDS.length} disabled)`);

    // Set up BroadcastChannel for viewer communication
    viewerChannel = new BroadcastChannel('visualizer-dashboard');
    viewerChannel.onmessage = handleViewerMessage;
    bindInputToggles();
    const previewFrame = document.getElementById('controls-preview-frame');
    if (previewFrame) mountPreviewImage(previewFrame);

    // Initialize filtered modules
    filteredModules = [...modules];

    // Set up filter options
    setupFilterOptions();

    // Portable shell config (data/shell/config.json when using node serve.js)
    const shellCfg = await loadShellConfig();
    if (shellCfg.viewMode === 'list' || shellCfg.viewMode === 'grid') {
      setView(shellCfg.viewMode, { skipPortableSave: true });
    } else {
      setView('grid', { skipPortableSave: true });
    }

    // Set up event listeners, then initial sort/filter pass + grid render
    console.log('Setting up event listeners...');
    setupEventListeners();
    syncSortToggleUI();
    refreshHeaderLucideIcons();
    console.log('Rendering module grid...');
    applyFiltersAndSort();

    // Initialize playlist tray
    console.log('Initializing playlist tray...');
    await playlistTray.init(modules, {
      onOpen: () => {
        closeControlsTray();
      },
      shellConfig: shellCfg
    });

    // Initialize image layer UI
    console.log('Initializing image layer UI...');
    await imageLayerUI.init(viewerChannel);

    refreshToggleControlsLucideIcons();

    // Expose necessary functions to playlist tray
    window.loadModuleInViewer = loadModule;
    window.ensureViewerOpen = ensureViewerOpen;
    window.isViewerConnected = false;
    Object.defineProperty(window, 'isViewerConnected', {
      get: () => isViewerConnected,
      set: (val) => { isViewerConnected = val; }
    });
    window.viewerWindow = null;
    Object.defineProperty(window, 'viewerWindow', {
      get: () => viewerWindow,
      set: (val) => { viewerWindow = val; }
    });

    // Don't auto-open viewer window - user will open it when selecting a module
    console.log('Shell initialized successfully');
  } catch (error) {
    console.error('Failed to initialize shell:', error);
    console.error('Error details:', error.stack);
    showError(`Failed to initialize application: ${error.message}. Please check console for details.`);
  }
}

/**
 * Set up filter options from module tags
 */
function setupFilterOptions() {
  const filterSelect = document.getElementById('filter-select');
  if (!filterSelect) return;

  // Collect all unique tags from modules
  const allTags = new Set();
  modules.forEach(module => {
    if (module.tags && Array.isArray(module.tags)) {
      module.tags.forEach(tag => allTags.add(tag));
    }
  });

  // Sort tags alphabetically
  const sortedTags = Array.from(allTags).sort();

  // Add tag options to filter select
  sortedTags.forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' ');
    filterSelect.appendChild(option);
  });
}

/**
 * Apply filters and sorting to modules
 */
function applyFiltersAndSort() {
  // Start with all modules
  filteredModules = [...modules];

  // Apply filter by tag
  if (currentFilter !== 'all') {
    filteredModules = filteredModules.filter(module => {
      return module.tags && module.tags.includes(currentFilter);
    });
  }

  // Apply sorting (A–Z or Z–A only)
  switch (currentSort) {
    case 'alpha-desc':
      filteredModules.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'alpha-asc':
    default:
      filteredModules.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  // Update clear filters button visibility (type filter only)
  const clearBtn = document.getElementById('clear-filters-btn');
  if (clearBtn) {
    clearBtn.style.display = currentFilter !== 'all' ? 'inline-block' : 'none';
  }

  // Re-render grid
  renderModuleGrid();
}

/**
 * Render the module selection grid
 */
function renderModuleGrid() {
  const grid = document.getElementById('module-grid');
  if (!grid) {
    console.error('Module grid element not found!');
    return;
  }

  grid.innerHTML = '';

  if (!filteredModules || filteredModules.length === 0) {
    grid.innerHTML = '<p style="text-align: center; color: #888; padding: 2rem; grid-column: 1 / -1;">No modules match the current filters.</p>';
    return;
  }

  console.log(`Rendering ${filteredModules.length} module(s)`);
  filteredModules.forEach(module => {
    try {
      const card = createModuleCard(module);
      grid.appendChild(card);
    } catch (error) {
      console.error(`Error creating card for module ${module.id}:`, error);
    }
  });
}

/**
 * Create a module card element
 * @param {Object} module - Module definition from modules.json
 * @returns {HTMLElement}
 */
function createModuleCard(module) {
  const card = document.createElement('div');
  card.className = 'module-card';
  card.dataset.moduleId = module.id;

  const preview = document.createElement('div');
  preview.className = 'module-preview';

  // Try to load preview image, fallback to placeholder
  const img = document.createElement('img');
  const placeholderSvg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="%231a1a1a"/><rect x="50" y="50" width="200" height="100" fill="%232a2a2a" rx="8"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-family="Arial" font-size="18">' + module.name + '</text><text x="50%25" y="75%25" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-family="Arial" font-size="12">No Preview</text></svg>';
  img.src = module.previewImage || placeholderSvg;
  img.alt = module.name;
  img.onerror = function () {
    this.src = placeholderSvg;
  };

  preview.appendChild(img);

  const info = document.createElement('div');
  info.className = 'module-info';

  const name = document.createElement('h3');
  name.textContent = module.name;

  const description = document.createElement('p');
  description.textContent = module.description || 'No description available';

  // Tags are hidden - uncomment below to show them
  // const tags = document.createElement('div');
  // tags.className = 'module-tags';
  // if (module.tags && module.tags.length > 0) {
  //   module.tags.forEach(tag => {
  //     const tagSpan = document.createElement('span');
  //     tagSpan.className = 'tag';
  //     tagSpan.textContent = tag;
  //     tags.appendChild(tagSpan);
  //   });
  // }

  info.appendChild(name);
  info.appendChild(description);
  // info.appendChild(tags);

  card.appendChild(preview);
  card.appendChild(info);

  // Add click handler
  card.addEventListener('click', () => {
    loadModule(module);
  });

  return card;
}

/**
 * Load a module in the viewer window
 * @param {Object} module - Module definition
 */
let moduleSelectionRevision = 0;
async function loadModule(module) {
  const revision = ++moduleSelectionRevision;
  try {
    selectedModule = module;
    currentModuleId = module.id;
    syncModulePicker();
    if (module.controlsPath) openControlsTray(module.controlsPath, module.name);

    // The projector stays closed until the user opens it. If it is already
    // open, keep it on the module they just chose.
    if (viewerWindow && !viewerWindow.closed && isViewerConnected) {
      void publishModuleToViewer(module, revision);
    }
  } catch (error) {
    console.error('Failed to load module:', error);
    showError(`Failed to load module: ${module.name}`);
  }
}

/**
 * Ensure viewer window is open and connected. Opens it if needed.
 * @returns {Promise<boolean>} True if viewer is ready, false if failed (e.g. popup blocked)
 */
async function publishModuleToViewer(module, revision) {
  if (!module || !viewerWindow || viewerWindow.closed || !isViewerConnected) return;
  let initialParams = null;
  try {
    initialParams = await getMostRecentFavoriteParams(module.id);
  } catch (e) {
    console.warn('Could not pre-fetch favorite params:', e);
  }
  if (revision !== undefined && revision !== moduleSelectionRevision) return;
  if (selectedModule?.id !== module.id) return;
  viewerChannel.postMessage({
    type: 'LOAD_MODULE',
    data: { module, initialParams }
  });
}

async function ensureViewerOpen() {
  if (viewerWindow && !viewerWindow.closed && isViewerConnected) {
    return true;
  }

  openViewerWindow();
  if (!viewerWindow || viewerWindow.closed) {
    return false;
  }

  // Wait for viewer to connect (with timeout)
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds
  while (!isViewerConnected && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (!isViewerConnected) {
    showError('Failed to connect to viewer window. Please allow popups and try again.');
  }
  return isViewerConnected;
}

/**
 * Open viewer window in kiosk/fullscreen mode
 */
function openViewerWindow() {
  // If viewer window already exists and is open, just focus it
  if (viewerWindow && !viewerWindow.closed) {
    viewerWindow.focus();
    return;
  }

  // Calculate screen dimensions for fullscreen window
  const width = window.screen.availWidth || window.screen.width || 1920;
  const height = window.screen.availHeight || window.screen.height || 1080;

  // Open window with kiosk-like features (as much as browser allows)
  // Note: True kiosk mode requires OS-level settings, but we can get close
  viewerWindow = window.open(
    './viewer.html',
    'visualizer-viewer',
    `width=${width},height=${height},left=0,top=0,` +
    `menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no,` +
    `fullscreen=yes`
  );

  if (!viewerWindow) {
    showError('Failed to open viewer window. Please allow popups for this site.');
    return;
  }

  // Move window to top-left and maximize
  try {
    viewerWindow.moveTo(0, 0);
    viewerWindow.resizeTo(width, height);
  } catch (e) {
    // May fail due to browser security - that's okay
    console.log('Could not resize viewer window (security restriction)');
  }

  // Check if viewer is connected
  checkViewerConnection();

  // Note: Viewer will automatically request fullscreen when it initializes
}

/**
 * Check viewer connection status
 */
function checkViewerConnection() {
  const statusEl = document.getElementById('viewer-status');
  if (statusEl) {
    if (viewerWindow && !viewerWindow.closed && isViewerConnected) {
      statusEl.textContent = 'Viewer: Connected';
      statusEl.className = 'viewer-status connected';
    } else if (viewerWindow && !viewerWindow.closed) {
      statusEl.textContent = 'Viewer: Opening...';
      statusEl.className = 'viewer-status';
      // Keep checking
      setTimeout(checkViewerConnection, 500);
    } else {
      statusEl.textContent = 'Viewer: Not Connected';
      statusEl.className = 'viewer-status disconnected';
    }
  }
}

/**
 * Request fullscreen in viewer window
 */
async function requestViewerFullscreen() {
  if (!isViewerConnected) {
    showError('Viewer window is not connected.');
    return;
  }

  viewerChannel.postMessage({
    type: 'REQUEST_FULLSCREEN',
    data: {}
  });
}

/**
 * Update overlay visibility based on tray states
 */
function updateOverlay() {
  const overlay = document.getElementById('tray-overlay');
  const controlsTray = document.getElementById('controls-tray');
  const playlistTrayEl = document.getElementById('playlist-tray');

  if (!overlay) return;

  const controlsOpen = controlsTray && controlsTray.classList.contains('open');
  const playlistOpen = playlistTrayEl && playlistTrayEl.classList.contains('open');

  if (controlsOpen || playlistOpen) {
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

// Expose globally so playlist-tray.js can call it
window.updateOverlay = updateOverlay;

/**
 * Tell the controls iframe that the viewer module is ready so favorites can apply without racing init.
 */
function syncModulePicker() {
  const picker = document.getElementById('controls-module-picker');
  if (picker && selectedModule) picker.value = selectedModule.id;
}

function previewEnabled() {
  return localStorage.getItem(PREVIEW_KEY) !== 'off';
}

function mountFavoritesPanel() {
  const host = document.getElementById('controls-favorites');
  const doc = document.getElementById('controls-iframe')?.contentDocument;
  if (!host) return;
  const panel = doc?.querySelector('.favorites-panel');
  if (panel && panel.parentElement !== host) host.replaceChildren(panel);
}

function prepareControlsDocument() {
  const doc = document.getElementById('controls-iframe')?.contentDocument;
  doc?.documentElement?.classList.add('in-tray');
  doc?.body?.classList.add('in-tray');
  mountFavoritesPanel();
  syncRandomizeButton();
}

function syncRandomizeButton() {
  const button = document.getElementById('controls-randomize');
  const doc = document.getElementById('controls-iframe')?.contentDocument;
  if (button) button.hidden = !doc?.querySelector('[data-randomize-settings]');
}

function runRandomizeSettings() {
  document.getElementById('controls-iframe')?.contentDocument
    ?.querySelector('[data-randomize-settings]')
    ?.click();
}

function syncImageVisibility(visible) {
  const box = document.getElementById('visibility-checkbox');
  if (box && typeof visible === 'boolean') box.checked = visible;
}

function syncControlPreview() {
  const host = document.getElementById('controls-preview-stage');
  const tray = document.getElementById('controls-tray');
  const open = tray?.classList.contains('open');
  const enabled = previewEnabled() && open && Boolean(selectedModule?.path);
  document.getElementById('controls-preview')?.classList.toggle('is-off', !enabled);
  const content = document.querySelector('#controls-stage .controls-tray-content');
  applyControlColumns(content, true);
  const src = enabled ? new URL(selectedModule.path, window.location.href).href : '';
  if (src && src === previewPath && (previewHandle || previewPending)) return;
  const token = ++previewToken;
  previewPath = src;
  previewPending = Boolean(src);
  previewHandle?.stop();
  previewHandle = null;
  if (!enabled || !host) return;
  startControlPreview(host, src).then((handle) => {
    if (token !== previewToken) {
      handle.stop();
      return;
    }
    previewPending = false;
    previewHandle = handle;
  });
}

function notifyControlsIframeReady() {
  const controlsIframe = document.getElementById('controls-iframe');
  if (!controlsIframe?.contentWindow || !currentModuleId) return;
  // Defer so controls' async init (fetch favorites) can finish before apply.
  setTimeout(() => {
    try {
      controlsIframe.contentWindow.postMessage(
        { type: 'frisson-controls-ready', moduleId: currentModuleId },
        '*'
      );
    } catch (e) {
      console.warn('notifyControlsIframeReady:', e);
    }
  }, 120);
}

/**
 * Open controls in tray
 */
function openControlsTray(controlsPath, moduleName) {
  const tray = document.getElementById('controls-tray');
  const trayTitle = document.getElementById('controls-tray-title');
  const controlsIframe = document.getElementById('controls-iframe');

  if (!tray || !controlsIframe) {
    console.error('Controls tray elements not found');
    return;
  }

  // Update title
  if (trayTitle && moduleName) {
    trayTitle.textContent = `${moduleName} Controls`;
  }

  const newHref = new URL(controlsPath, window.location.href).href;
  const pathChanged = controlsIframe.src !== newHref;

  // Load controls in iframe if path changed
  if (pathChanged) {
    document.getElementById('controls-favorites')?.replaceChildren();
    controlsIframe.src = controlsPath;
    controlsIframe.addEventListener('load', notifyControlsIframeReady, { once: true });
  } else {
    // Same module / controls already in iframe — still signal (favorites handshake).
    requestAnimationFrame(() => notifyControlsIframeReady());
  }
  currentControlsPath = controlsPath;

  // Close playlist tray if open
  if (playlistTray && playlistTray.closeTray) {
    playlistTray.closeTray();
  }

  // Open tray
  tray.classList.add('open');
  syncControlPreview();
  
  // Update overlay visibility
  updateOverlay();

  // Update toggle button state
  updateToggleButtonState(true);
}

/**
 * Close controls tray
 */
function closeControlsTray() {
  const tray = document.getElementById('controls-tray');

  if (tray) {
    tray.classList.remove('open');
    
    // Update overlay visibility
    updateOverlay();

    // Don't clear iframe src when toggling - keep it loaded
    // Only clear when module is stopped

    // Update toggle button state
    updateToggleButtonState(false);
    syncControlPreview();
  }
}

/**
 * Toggle controls tray
 */
function toggleControlsTray() {
  const tray = document.getElementById('controls-tray');

  if (!tray) {
    return;
  }

  // Check if tray is currently open
  const isOpen = tray.classList.contains('open');

  if (isOpen) {
    closeControlsTray();
  } else {
    // Try to open tray - need current module
    const currentModule = selectedModule || modules.find(m => m.id === currentModuleId);
    if (currentModule && currentModule.controlsPath) {
      openControlsTray(currentModule.controlsPath, currentModule.name);
    } else {
      showError('No module is currently loaded. Load a module first to open controls.');
    }
  }
}

/**
 * Render Lucide icons inside the controls tray puck toggle (UMD script in index.html).
 */
function refreshToggleControlsLucideIcons() {
  const L = globalThis.lucide;
  const root = document.getElementById('toggle-controls-btn');
  if (!root || typeof L?.createIcons !== 'function') return;
  L.createIcons({
    attrs: { class: 'lucide lucide-icon', 'stroke-width': 1.75 },
    root,
  });
}

/**
 * Update toggle button state
 */
function updateToggleButtonState(isOpen) {
  const toggleBtn = document.getElementById('toggle-controls-btn');
  if (!toggleBtn) return;

  const iconName = isOpen ? 'chevron-right' : 'chevron-left';
  toggleBtn.innerHTML = `<i data-lucide="${iconName}" class="toggle-controls-icon" aria-hidden="true"></i>`;
  refreshToggleControlsLucideIcons();

  toggleBtn.title = isOpen ? 'Close Controls' : 'Open Controls';
}

function syncSortToggleUI() {
  const az = document.getElementById('sort-az-btn');
  const za = document.getElementById('sort-za-btn');
  if (!az || !za) return;
  const isAsc = currentSort === 'alpha-asc';
  az.classList.toggle('active', isAsc);
  za.classList.toggle('active', !isAsc);
  az.setAttribute('aria-pressed', isAsc ? 'true' : 'false');
  za.setAttribute('aria-pressed', isAsc ? 'false' : 'true');
}

function refreshHeaderLucideIcons() {
  const L = globalThis.lucide;
  const root = document.getElementById('header');
  if (!root || typeof L?.createIcons !== 'function') return;
  L.createIcons({
    attrs: { class: 'lucide lucide-icon', 'stroke-width': 1.75 },
    root,
  });
}

function publishInputs() {
  if (!viewerChannel) return;
  viewerChannel.postMessage({ type: 'MEDIA_INPUT', data: audio.getInputState() });
}

function bindInputToggles() {
  const audioBox = document.getElementById('audio-input-toggle');
  const videoBox = document.getElementById('video-input-toggle');
  const sync = (state) => {
    if (audioBox) audioBox.checked = !!state.audio;
    if (videoBox) videoBox.checked = !!state.video;
  };
  audio.subscribeInputs(sync);
  audioBox?.addEventListener('change', async () => {
    await audio.setAudioEnabled(audioBox.checked);
    publishInputs();
  });
  videoBox?.addEventListener('change', async () => {
    await audio.setVideoEnabled(videoBox.checked);
    publishInputs();
  });
  audio.restoreInputs().catch(() => {});
}

/**
 * Handle messages from viewer
 */
function handleViewerMessage(event) {
  const { type, data } = event.data;

  switch (type) {
    case 'VIEWER_READY':
      console.log('Viewer is ready');
      isViewerConnected = true;
      window.isViewerConnected = true;
      checkViewerConnection();
      publishInputs();
      if (selectedModule) void publishModuleToViewer(selectedModule);
      break;

    case 'MODULE_LOADED':
      console.log('Module loaded in viewer:', data.module.name);
      if (data.module?.id) {
        const known = modules.find((item) => item.id === data.module.id);
        if (known) {
          selectedModule = known;
          currentModuleId = known.id;
          syncModulePicker();
        }
      }
      // Open controls only after viewer confirms module init.
      // This avoids favorites default PARAM_CHANGE messages racing module startup.
      if (data.module?.controlsPath) {
        openControlsTray(data.module.controlsPath, data.module.name);
      }
      break;

    case 'MODULE_LOAD_ERROR':
      console.error('Failed to load module in viewer:', data.error);
      showError(`Failed to load module: ${data.module.name}`);
      break;

    case 'FULLSCREEN_CHANGED':
      // Viewer fullscreen status changed
      break;

    case 'IMAGE_LAYER_MODAL_TOGGLE':
      imageLayerUI.toggleModal();
      break;

    case 'IMAGE_LAYER_VISIBILITY_CHANGED':
      syncImageVisibility(data?.visible);
      break;

    case 'IMAGE_LAYER_UPDATE':
      if (typeof data?.settings?.visibility === 'boolean') syncImageVisibility(data.settings.visibility);
      break;

    case 'IMAGE_LAYER_STATE_RESPONSE':
      imageLayerUI.onViewerStateResponse(data);
      break;

    default:
      console.warn('Unknown message from viewer:', type);
  }
}

/**
 * Handle viewer window close
 */
function handleViewerClose() {
  isViewerConnected = false;
  window.isViewerConnected = false;
  checkViewerConnection();
  currentModuleId = null;

  // Check periodically if viewer was closed
  const checkInterval = setInterval(() => {
    if (viewerWindow && viewerWindow.closed) {
      clearInterval(checkInterval);
      handleViewerClose();
    } else if (!viewerWindow || viewerWindow.closed) {
      clearInterval(checkInterval);
    }
  }, 1000);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Open viewer button
  const openViewerBtn = document.getElementById('open-viewer-btn');
  if (openViewerBtn) {
    openViewerBtn.addEventListener('click', openViewerWindow);
  }
  document.getElementById('controls-open-viewer')?.addEventListener('click', openViewerWindow);
  document.getElementById('controls-randomize')?.addEventListener('click', runRandomizeSettings);

  // Toggle controls tray button
  const toggleControlsBtn = document.getElementById('toggle-controls-btn');
  if (toggleControlsBtn) {
    toggleControlsBtn.addEventListener('click', toggleControlsTray);
  }

  // Close controls tray button (inside tray)
  const closeControlsBtn = document.getElementById('close-controls-btn');
  if (closeControlsBtn) {
    closeControlsBtn.addEventListener('click', closeControlsTray);
  }

  const modulePicker = document.getElementById('controls-module-picker');
  if (modulePicker && !modulePicker.dataset.ready) {
    modulePicker.dataset.ready = '1';
    [...modules].sort((a, b) => a.name.localeCompare(b.name)).forEach((module) => {
      const option = document.createElement('option');
      option.value = module.id;
      option.textContent = module.name;
      modulePicker.appendChild(option);
    });
    modulePicker.addEventListener('change', () => {
      const module = modules.find((item) => item.id === modulePicker.value);
      if (module) loadModule(module);
    });
  }

  const previewToggle = document.getElementById('preview-toggle');
  if (previewToggle) {
    previewToggle.checked = previewEnabled();
    document.getElementById('controls-preview')?.classList.toggle('is-off', !previewEnabled());
    previewToggle.addEventListener('change', () => {
      localStorage.setItem(PREVIEW_KEY, previewToggle.checked ? 'on' : 'off');
      syncControlPreview();
    });
  }
  const controlsContent = document.querySelector('#controls-stage .controls-tray-content');
  if (controlsContent && window.ResizeObserver) {
    const observer = new ResizeObserver(() => {
      applyControlColumns(controlsContent, true);
    });
    observer.observe(controlsContent);
    controlsContent.querySelector('iframe')?.addEventListener('load', () => {
      applyControlColumns(controlsContent, true);
      prepareControlsDocument();
    });
  }

  // Close trays when overlay is clicked
  const overlay = document.getElementById('tray-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      // Close controls tray if open
      const controlsTray = document.getElementById('controls-tray');
      if (controlsTray && controlsTray.classList.contains('open')) {
        closeControlsTray();
      }
      
      // Close playlist tray if open
      const playlistTrayEl = document.getElementById('playlist-tray');
      if (playlistTrayEl && playlistTrayEl.classList.contains('open')) {
        playlistTrayEl.classList.remove('open');
        playlistTrayEl.classList.add('closed');
        updateOverlay();
      }
    });
  }

  // Close tray on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const controlsTray = document.getElementById('controls-tray');
      if (controlsTray && controlsTray.classList.contains('open')) {
        closeControlsTray();
      }
      const playlistTrayEl = document.getElementById('playlist-tray');
      if (playlistTrayEl && playlistTrayEl.classList.contains('open')) {
        playlistTrayEl.classList.remove('open');
        playlistTrayEl.classList.add('closed');
        updateOverlay();
      }
      const imageModal = document.getElementById('image-layer-modal');
      if (imageModal && imageModal.classList.contains('open')) {
        imageLayerUI.toggleModal();
      }
    }
  });

  const sortAzBtn = document.getElementById('sort-az-btn');
  const sortZaBtn = document.getElementById('sort-za-btn');
  if (sortAzBtn) {
    sortAzBtn.addEventListener('click', () => {
      if (currentSort === 'alpha-asc') return;
      currentSort = 'alpha-asc';
      syncSortToggleUI();
      applyFiltersAndSort();
    });
  }
  if (sortZaBtn) {
    sortZaBtn.addEventListener('click', () => {
      if (currentSort === 'alpha-desc') return;
      currentSort = 'alpha-desc';
      syncSortToggleUI();
      applyFiltersAndSort();
    });
  }

  // Filter select
  const filterSelect = document.getElementById('filter-select');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      applyFiltersAndSort();
    });
  }

  // Clear filters button
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      currentSort = 'alpha-asc';
      currentFilter = 'all';
      if (filterSelect) filterSelect.value = 'all';
      syncSortToggleUI();
      applyFiltersAndSort();
    });
  }

  // View Toggle Buttons
  const viewGridBtn = document.getElementById('view-grid-btn');
  const viewListBtn = document.getElementById('view-list-btn');

  if (viewGridBtn) {
    viewGridBtn.addEventListener('click', () => setView('grid'));
  }

  if (viewListBtn) {
    viewListBtn.addEventListener('click', () => setView('list'));
  }

  // Check viewer connection periodically
  setInterval(checkViewerConnection, 1000);

  // Monitor viewer window close
  if (viewerWindow) {
    handleViewerClose();
  }
}

/**
 * Show error message
 * @param {string} message
 */
function showError(message) {
  alert(message);
}

/**
 * Set the current view mode
 * @param {string} viewMode - 'grid' or 'list'
 * @param {{ skipPortableSave?: boolean }} [opts] - skip when applying config loaded from disk
 */
function setView(viewMode, opts = {}) {
  currentView = viewMode;

  if (!isShellConfigFromProjectFile()) {
    try {
      localStorage.setItem('shell-view-preference', viewMode);
    } catch {}
  }
  if (!opts.skipPortableSave) {
    void updateShellConfig({ viewMode });
  }

  // Update UI buttons
  const viewGridBtn = document.getElementById('view-grid-btn');
  const viewListBtn = document.getElementById('view-list-btn');
  const grid = document.getElementById('module-grid');

  if (viewGridBtn && viewListBtn) {
    if (viewMode === 'list') {
      viewGridBtn.classList.remove('active');
      viewListBtn.classList.add('active');
    } else {
      viewGridBtn.classList.add('active');
      viewListBtn.classList.remove('active');
    }
  }

  // Update grid class
  if (grid) {
    if (viewMode === 'list') {
      grid.classList.add('list-view');
    } else {
      grid.classList.remove('list-view');
    }
  }
}

// Initialize on load
// Make sure DOM is ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => {
      console.error('Shell initialization error:', err);
      showError('Failed to initialize application. Please check console for details.');
    });
  });
} else {
  // DOM is already ready
  init().catch(err => {
    console.error('Shell initialization error:', err);
    showError('Failed to initialize application. Please check console for details.');
  });
}

