/**
 * Orbs Module
 * Instanced emissive spheres arranged as orbiting shell layers with bloom and audio reactivity
 */

// Note: This module uses CDN imports for Three.js (via importmap in index.html)
// The actual implementation is in index.html's script tag
// This file serves as a placeholder for the module API structure

// The module logic is currently embedded in index.html
// To fully modularize, the Three.js code from index.html should be moved here
// For now, we'll expose a basic API that works with the existing structure

let container = null;
let controlsChannel = null;
let audioAPI = null;
let animationId = null;

/**
 * Initialize the module
 */
export async function initModule({ container: containerElement, audio, controlsChannel: channel }) {
  container = containerElement;
  audioAPI = audio;
  controlsChannel = channel;
  
  // The actual initialization happens in index.html's script tag
  // This is a placeholder that ensures the module API is available
  console.log('Orbs module initialized', {
    hasContainer: !!container,
    hasAudio: !!audio,
    hasChannel: !!channel
  });
  
  // If controlsChannel is provided, set up message handling
  if (controlsChannel) {
    controlsChannel.onmessage = handleControlMessage;
  }
  
  // Listen for window messages
  window.addEventListener('message', handleWindowMessage);
}

/**
 * Handle control messages from controls panel
 */
function handleControlMessage(event) {
  if (!event.data) return;
  
  // Forward control messages to the main script
  // The actual handling is done in index.html's script tag
  if (event.data.type === 'PARAM_CHANGE') {
    // The UI in index.html handles these directly
    // This is a pass-through for shell integration
    window.dispatchEvent(new CustomEvent('orbs-param-change', {
      detail: event.data
    }));
  }
}

/**
 * Handle window messages
 */
function handleWindowMessage(event) {
  // Handle messages from shell/loader
  if (event.data && event.data.type === 'PARAM_CHANGE') {
    handleControlMessage(event);
  }
}

/**
 * Start the module
 */
export function start() {
  // Animation is already running from index.html
  // This is a placeholder for API consistency
  if (!animationId) {
    // The animate function is defined in index.html
    // This ensures the module API is consistent
    console.log('Orbs module started');
  }
}

/**
 * Stop the module
 */
export function stop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

/**
 * Destroy the module
 */
export function destroy() {
  stop();
  window.removeEventListener('message', handleWindowMessage);
  
  if (controlsChannel) {
    controlsChannel.close();
  }
}

// Expose module API to window (for loader.js)
if (typeof window !== 'undefined') {
  window.moduleAPI = {
    initModule,
    start,
    stop,
    destroy
  };
}

console.log('Orbs module API exposed');



