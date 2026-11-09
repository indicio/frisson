/**
 * Viewer Window Application
 * Handles module loading and display in a separate viewer window
 */

import * as audio from './audio.js';
import * as loader from './loader.js';
import * as playlist from './playlist.js';

import * as imageLayer from './imageLayer.js';
import * as mapping from './mappingOutput.js';

let loadRevision = 0;

let currentModule = null;
let isFullscreen = false;

// Communication channel with dashboard
const dashboardChannel = new BroadcastChannel('visualizer-dashboard');

// Playback stays in this window, with one audio system and module lifecycle.
window.frissonPlaylist = {
  ...playlist,
  play(container, onModuleChange, getEntryParams) {
    ++loadRevision;
    return playlist.play(container, (moduleId, entry) => {
      currentModule = { id: moduleId, name: entry.moduleName || moduleId };
      updateStatus(`${currentModule.name} loaded`);
      onModuleChange?.(moduleId, entry);
    }, getEntryParams);
  },
};

/**
 * Update status message
 */
function updateStatus(message) {
  const statusEl = document.getElementById('status-message');
  const overlay = document.getElementById('status-overlay');
  
  if (statusEl) {
    statusEl.textContent = message;
  }
  
  if (overlay) {
    overlay.classList.remove('hidden');
    // Hide after 3 seconds if there's a module loaded
    if (currentModule && message !== 'No module loaded') {
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 3000);
    }
  }
}

/**
 * Initialize viewer
 */
async function init() {
  try {
    console.log('Viewer initializing...');
    
    // Announce readiness before any microphone prompt; the loader initializes
    // audio when a module is selected, so permission cannot block connection.
    // Listen for messages from dashboard
    dashboardChannel.onmessage = handleDashboardMessage;
    audio.restoreInputs().catch(() => {});
    
    // Notify dashboard that viewer is ready
    dashboardChannel.postMessage({
      type: 'VIEWER_READY',
      data: {}
    });
    
    mapping.attach();

    // Initialize image layer
    const imageLayerContainer = document.getElementById('image-layer-container');
    if (imageLayerContainer) {
      imageLayer.init(imageLayerContainer);
    }
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Request fullscreen immediately when viewer opens (kiosk mode)
    setTimeout(() => {
      requestFullscreen();
    }, 300);
    
    updateStatus('Viewer ready - waiting for module');
    console.log('Viewer initialized');
  } catch (error) {
    console.error('Failed to initialize viewer:', error);
    updateStatus('Viewer initialization failed');
  }
}

/**
 * Handle messages from dashboard
 */
async function handleDashboardMessage(event) {
  const { type, data } = event.data;
  
  switch (type) {
    case 'LOAD_MODULE':
      playlist.stop();
      await loadModule(data.module, data.initialParams);
      break;
    
    case 'STOP_MODULE':
      await stopModule();
      break;
    
    case 'REQUEST_FULLSCREEN':
      await requestFullscreen();
      break;
    
    case 'EXIT_FULLSCREEN':
      exitFullscreen();
      break;
    
    case 'IMAGE_LAYER_TOGGLE':
      imageLayer.toggleVisibility();
      break;
    
    case 'IMAGE_LAYER_UPDATE':
      imageLayer.updateSettings(data.settings);
      break;
    
    case 'IMAGE_LAYER_LOAD_FILE':
      // Handle file data passed from shell
      if (data.file && data.file.data) {
        // Pass the file-like object directly (imageLayer handles both File and object)
        await imageLayer.loadImageFromFile(data.file);
      }
      break;
    
    case 'IMAGE_LAYER_RESET_POSITION':
      imageLayer.resetPosition();
      break;
    
    case 'IMAGE_LAYER_LOAD_SVG':
      imageLayer.loadSVGFromCode(data.svgCode);
      break;
    
    case 'IMAGE_LAYER_CLEAR':
      imageLayer.clear();
      break;

    case 'IMAGE_LAYER_APPLY_PRESET':
      if (data.activePresetId) {
        imageLayer.setActivePresetId(data.activePresetId);
      }
      if (data.settings) {
        imageLayer.applyPresetSnapshot(data.settings, {
          skipPortableSave: data.skipPortableSave === true,
        });
      }
      break;

    case 'IMAGE_LAYER_REQUEST_STATE':
      dashboardChannel.postMessage({
        type: 'IMAGE_LAYER_STATE_RESPONSE',
        data: {
          state: imageLayer.getSettingsForSave(),
          activePresetId: imageLayer.getActivePresetId(),
        },
      });
      break;

    case 'MEDIA_INPUT':
      await audio.setAudioEnabled(!!data?.audio);
      await audio.setVideoEnabled(!!data?.video);
      break;

    case 'MAPPING_MODE':
      if (data.mode === 'map') {
        mapping.setActive(true);
        await playlist.stop();
      } else {
        mapping.setActive(false);
        await loader.startModule();
        loader.resumeAudioUpdates();
      }
      break;

    case 'MAPPING_SCENE':
      mapping.setScene(data.scene);
      break;

    case 'MAPPING_OUTPUT':
      mapping.setOptions(data);
      break;

    default:
      console.warn('Unknown message type:', type);
  }
}

/**
 * Load a module in the viewer
 */
async function loadModule(module, initialParams) {
  const revision = ++loadRevision;
  return loader.runTransition(async () => {
    if (revision !== loadRevision) return;
    try {
      updateStatus(`Loading ${module.name}...`);

      // Stop current module if any
      await loader.stopModule();
      currentModule = null;

      const container = document.getElementById('viewer-container');
      if (!container) {
        throw new Error('Viewer container not found');
      }

      // Load the module
      await loader.loadModule(module.path, container);
      if (revision !== loadRevision) return;

      // Apply favorite params before first frame renders
      if (initialParams) {
        await loader.applyInitialParams(initialParams);
      }

      if (revision !== loadRevision) return;
      await loader.startModule();
      if (revision !== loadRevision) return;
      if (mapping.isActive()) await loader.stopModule();
    
      currentModule = module;
      updateStatus(`${module.name} loaded`);
    
      // Request fullscreen again when module loads (in case initial request failed)
      // This uses the user interaction from clicking the module card
      if (!isFullscreen) {
        setTimeout(() => {
          requestFullscreen();
        }, 100);
      }
    
      // Notify dashboard
      dashboardChannel.postMessage({
        type: 'MODULE_LOADED',
        data: { module: module }
      });
    
      console.log(`Module loaded in viewer: ${module.name}`);
    } catch (error) {
      if (revision !== loadRevision) return;
      console.error('Failed to load module in viewer:', error);
      updateStatus(`Failed to load ${module.name}`);
    
      // Notify dashboard
      dashboardChannel.postMessage({
        type: 'MODULE_LOAD_ERROR',
        data: { module: module, error: error.message }
      });
    }
  });
}

/**
 * Stop current module
 */
async function stopModule() {
  ++loadRevision;
  playlist.stop();
  return loader.runTransition(async () => {
    await loader.stopModule();
    await loader.unloadModule();
    currentModule = null;
    updateStatus('Module stopped');
    document.getElementById('viewer-container')?.replaceChildren();
  });
}

/**
 * Request fullscreen (kiosk mode)
 */
async function requestFullscreen() {
  // Try document element first for true fullscreen
  const element = document.documentElement;
  
  try {
    if (!isFullscreen) {
      // Try standard fullscreen API
      if (element.requestFullscreen) {
        await element.requestFullscreen();
        isFullscreen = true;
      } 
      // WebKit/Safari
      else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
        isFullscreen = true;
      } 
      // iOS Safari
      else if (element.webkitRequestFullScreen) {
        await element.webkitRequestFullScreen();
        isFullscreen = true;
      }
      // MS Edge
      else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
        isFullscreen = true;
      }
      // Fallback: try container
      else {
        const container = document.getElementById('viewer-container');
        if (container) {
          if (container.requestFullscreen) {
            await container.requestFullscreen();
            isFullscreen = true;
          }
        }
      }
      
      if (isFullscreen) {
        console.log('Entered fullscreen/kiosk mode');
      }
    }
  } catch (error) {
    console.error('Fullscreen error:', error);
    // Some browsers require user interaction - that's okay
    // Fullscreen will be requested when user interacts with viewer
  }
}

/**
 * Exit fullscreen
 */
function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
  isFullscreen = false;
}

/**
 * Handle fullscreen change
 */
function handleFullscreenChange() {
  const isCurrentlyFullscreen = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );
  
  isFullscreen = isCurrentlyFullscreen;
  
  // Notify dashboard
  dashboardChannel.postMessage({
    type: 'FULLSCREEN_CHANGED',
    data: { isFullscreen: isFullscreen }
  });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    // F11 or F for fullscreen
    if (event.key === 'F11') {
      event.preventDefault();
      if (isFullscreen) {
        exitFullscreen();
      } else {
        requestFullscreen();
      }
    } else if (event.key === 'f' && !event.ctrlKey && !event.metaKey) {
      if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        if (isFullscreen) {
          exitFullscreen();
        } else {
          requestFullscreen();
        }
      }
    }
    
    // Escape to exit fullscreen
    if (event.key === 'Escape' && isFullscreen) {
      exitFullscreen();
    }
    
    // I key to toggle image layer
    if (event.key === 'i' || event.key === 'I') {
      if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        console.log('I key pressed', { shiftKey: event.shiftKey });
        if (event.shiftKey) {
          // Shift+I - toggle modal (handled in shell)
          console.log('Shift+I: toggling modal');
          dashboardChannel.postMessage({
            type: 'IMAGE_LAYER_MODAL_TOGGLE',
            data: {}
          });
        } else {
          // I - toggle visibility
          console.log('I: toggling visibility');
          const visible = imageLayer.toggleVisibility();
          console.log('I: visibility toggled', { visible });
          dashboardChannel.postMessage({
            type: 'IMAGE_LAYER_VISIBILITY_CHANGED',
            data: { visible: visible }
          });
        }
        event.preventDefault();
      } else {
        console.log('I key ignored (in input field)');
      }
    }
    
    // S key to rotate image on z-axis
    if (event.key === 's' || event.key === 'S') {
      if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        imageLayer.rotateZ();
        event.preventDefault();
      }
    }
    
    // P key to push/scale image
    if (event.key === 'p' || event.key === 'P') {
      if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        imageLayer.pushScale();
        event.preventDefault();
      }
    }
  });
  
  // Fullscreen change events
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('msfullscreenchange', handleFullscreenChange);
}

/**
 * Cleanup on window close
 */
window.addEventListener('beforeunload', async () => {
  playlist.stop();
  audio.destroyAudio();
  dashboardChannel.close();
});

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

