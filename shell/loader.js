/**
 * Module Loader System
 * Handles loading, initialization, and lifecycle of visualization modules
 */

import * as audio from './audio.js';

let currentModule = null;
let currentModuleWindow = null;
let unwatchInputs = null;
let currentControlsWindow = null;
let controlsChannel = null;
let audioUpdateInterval = null;
let currentIframe = null;
let transitionQueue = Promise.resolve();

/** Serialize whole load/parameter/start transitions, including cleanup. */
export function runTransition(work) {
  const task = transitionQueue.then(work);
  transitionQueue = task.catch(() => {});
  return task;
}

/**
 * Module interface that all modules should implement
 * @typedef {Object} ModuleInstance
 * @property {Function} initModule - Initialize the module
 * @property {Function} start - Start the module
 * @property {Function} stop - Stop the module
 * @property {Function} destroy - Clean up resources
 */

/**
 * Load a module from its path
 * @param {string} modulePath - Path to module's index.html
 * @param {HTMLElement} container - Container element for the module
 * @returns {Promise<ModuleInstance>}
 */
export async function loadModule(modulePath, container) {
  try {
    // Clean up previous module
    await unloadModule();

    await audio.ensureAudioReady();
    
    // Create iframe for module
    const iframe = container.ownerDocument.createElement('iframe');
    currentIframe = iframe;
    iframe.src = modulePath;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = '#000';
    
    // Register handlers before insertion, including cached local pages.
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timeout);
        iframe.onload = null;
        iframe.onerror = null;
        error ? reject(error) : resolve();
      };
      const timeout = setTimeout(() => finish(new Error('Module load timeout')), 5000);
      iframe.onload = () => finish();
      iframe.onerror = () => finish(new Error('Module failed to load'));
      container.replaceChildren(iframe);
    });

    // Get module instance from iframe
    const moduleWindow = iframe.contentWindow;
    currentModuleWindow = moduleWindow;
    unwatchInputs?.();
    unwatchInputs = audio.watchWindow(moduleWindow);
    
    // Wait for contentDocument to be accessible and body to be ready
    // ES modules load asynchronously, so we need to wait a bit
    await waitForIframeReady(iframe);
    
    // Set up BroadcastChannel for communication
    controlsChannel = new BroadcastChannel('visualizer-controls');
    
    // Listen for control messages
    controlsChannel.onmessage = (event) => {
      if (event.data.type === 'PARAM_CHANGE' && currentModule) {
        if (moduleWindow.postMessage) {
          moduleWindow.postMessage(event.data, '*');
        }
      } else if (event.data.type === 'LOAD_PLY_FILE' && currentModule) {
        if (moduleWindow.postMessage) {
          moduleWindow.postMessage(event.data, '*');
        }
      }
    };
    
    // Wait for module to be ready and get its API
    const moduleAPI = await waitForModuleAPI(moduleWindow);
    
    // Store reference to API
    currentModule = moduleAPI;
    
    // Get container element - ensure it's accessible
    let containerElement;
    try {
      containerElement = iframe.contentDocument.body;
      if (!containerElement) {
        throw new Error('iframe body not found');
      }
    } catch (error) {
      console.error('Failed to access iframe contentDocument:', error);
      throw new Error(`Cannot access module container: ${error.message}`);
    }
    
    // Initialize module with container and audio
    await moduleAPI.initModule({
      container: containerElement,
      audio: {
        getFFTData: audio.getFFTData,
        getWaveformData: audio.getWaveformData,
        getNormalizedFFTData: audio.getNormalizedFFTData,
        getAudioLevel: audio.getAudioLevel,
        getAudioContext: audio.getAudioContext,
        getAnalyser: audio.getAnalyser
      },
      controlsChannel: controlsChannel
    });
    
    // Start audio updates
    startAudioUpdates(moduleWindow);
    
    console.log('Module loaded successfully');
    return moduleAPI;
  } catch (error) {
    await unloadModule().catch(cleanupError => console.warn('Module cleanup failed', cleanupError));
    console.error('Failed to load module:', modulePath, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
}

/**
 * Wait for iframe to be ready (contentDocument accessible and body available)
 * @param {HTMLIFrameElement} iframe - The iframe element
 * @returns {Promise<void>}
 */
function waitForIframeReady(iframe) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      try {
        // Check if contentDocument is accessible
        if (iframe.contentDocument && iframe.contentDocument.body) {
          clearInterval(checkInterval);
          resolve();
          return;
        }
      } catch (e) {
        // Cross-origin or not ready yet - continue waiting
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        reject(new Error('iframe contentDocument not accessible after timeout'));
      }
    }, 100);
  });
}

/**
 * Wait for module to expose its API
 * @param {Window} moduleWindow - Module's window object
 * @returns {Promise<ModuleInstance>}
 */
function waitForModuleAPI(moduleWindow) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds max (modules might take time to load Three.js)
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      // Check if module exposes API
      // Modules expose API either:
      // 1. Immediately when module.js loads (via export)
      // 2. After initModule is called (sets window.moduleAPI)
      try {
        if (moduleWindow.moduleAPI) {
          clearInterval(checkInterval);
          resolve(moduleWindow.moduleAPI);
          return;
        }
      } catch (e) {
        // Cross-origin or not ready yet
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        const error = new Error('Module API not found after timeout. Ensure module.js exports the API via window.moduleAPI.');
        console.error('Module API timeout:', {
          moduleWindow: moduleWindow,
          hasModuleAPI: moduleWindow?.moduleAPI ? 'yes' : 'no',
          attempts: attempts
        });
        reject(error);
      }
    }, 100);
  });
}

/**
 * Start sending audio updates to module
 * @param {Window} moduleWindow - Module's window object
 */
function startAudioUpdates(moduleWindow) {
  if (audioUpdateInterval) {
    clearInterval(audioUpdateInterval);
  }
  
  // Update at ~60fps
  audioUpdateInterval = setInterval(() => {
    if (moduleWindow && moduleWindow.postMessage) {
      moduleWindow.postMessage({
        type: 'AUDIO_UPDATE',
        fftData: audio.getFFTData(),
        waveformData: audio.getWaveformData(),
        audioLevel: audio.getAudioLevel()
      }, '*');
    }
  }, 16); // ~60fps
}

/**
 * Stop audio updates
 */
function stopAudioUpdates() {
  if (audioUpdateInterval) {
    clearInterval(audioUpdateInterval);
    audioUpdateInterval = null;
  }
}

/**
 * Apply initial parameters to the module before starting
 * @param {Object} params - Key/value pairs to apply
 */
export async function applyInitialParams(params) {
  if (!params) return;

  // Use module API when available (avoids BroadcastChannel round-trip).
  // Some modules (e.g. photosome) are channel-driven and do not expose moduleAPI.
  if (currentModule?.updateParams) {
    await currentModule.updateParams(params);
  }

  // Always send via BroadcastChannel so channel-driven modules receive initial params.
  if (controlsChannel) {
    Object.entries(params).forEach(([param, value]) => {
      controlsChannel.postMessage({ type: 'PARAM_CHANGE', param, value });
    });
  }
}

/**
 * Start the current module
 */
export async function startModule() {
  if (currentModule && currentModule.start) {
    await currentModule.start();
  }
}

/**
 * Stop the current module
 */
export async function stopModule() {
  if (currentModule && currentModule.stop) {
    await currentModule.stop();
  }
  stopAudioUpdates();
}

/**
 * Unload the current module
 */
export async function unloadModule() {
  stopAudioUpdates();
  unwatchInputs?.();
  unwatchInputs = null;
  const module = currentModule;
  currentModule = null;
  currentModuleWindow = null;
  try {
    if (module?.destroy) await module.destroy();
  } finally {
    controlsChannel?.close();
    controlsChannel = null;
    currentIframe?.remove();
    currentIframe = null;
    if (currentControlsWindow && !currentControlsWindow.closed) currentControlsWindow.close();
    currentControlsWindow = null;
  }
}

/**
 * Open control window for a module
 * @param {string} controlsPath - Path to controls.html
 * @returns {Window|null}
 */
export function openControlsWindow(controlsPath) {
  // Close existing controls window
  if (currentControlsWindow && !currentControlsWindow.closed) {
    currentControlsWindow.close();
  }
  
  // Open new controls window
  currentControlsWindow = window.open(
    controlsPath,
    'module-controls',
    'width=400,height=600,resizable=yes,scrollbars=yes'
  );
  
  return currentControlsWindow;
}

/**
 * Get current module instance
 * @returns {ModuleInstance|null}
 */
export function getCurrentModule() {
  return currentModule;
}

export function resumeAudioUpdates() {
  if (currentModuleWindow) {
    startAudioUpdates(currentModuleWindow);
  }
}

