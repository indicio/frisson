/**
 * Image Layer System
 * Handles image upload, rendering, and audio-reactive effects
 */

import * as audio from './audio.js';
import { loadImageLayerPortable, mergeActivePresetIntoFile } from '../shared/portableStorage.js';
import {
  emptyImageLayerDoc,
  getActivePreset,
  presetToFlatSettings,
} from '../shared/imageLayerDoc.js';

let imageLayerContainer = null;
let imageElement = null;
let svgElement = null;
let currentImageData = null;
let currentMode = 'raster'; // 'raster' or 'svg'
let isVisible = true;
let settings = {
  // General
  width: 400,
  visibility: true,
  /** Pixels from centered position (0 = centered). */
  offsetX: 0,
  offsetY: 0,

  /** CSS filter drop-shadow on the logo wrapper (not module content). */
  dropShadow: {
    enabled: false,
    offsetX: 0,
    offsetY: 6,
    blur: 14,
    color: '#000000',
    opacity: 0.35,
  },

  // Raster mode
  raster: {
    scaleSensitivity: 0.5,
    baseOpacity: 1.0,
    maxExpansion: 2.0
  },
  
  // SVG mode
  svg: {
    scale: 1.0,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 0,
    colorSequence: {
      enabled: false,
      colors: ['#ff00ff', '#00ffff', '#ffffff'],
      cycleSpeed: 1.0,
      transitionRate: 0.5,
      audioReactive: false,
      blendMode: 'normal'
    }
  }
};

let animationFrameId = null;
let activeAnimation = null; // 'rotateZ' | 'pushScale' | null — locks out audio-reactive conflicts
let colorSequenceIndex = 0;
let colorSequenceTime = 0;
let currentInterpolatedColor = null;
let colorTransitionStartTime = 0;
let colorTransitionStartColor = null;
let colorTransitionEndColor = null;

let portableSaveTimer = null;
let activePresetId = 'default';

function mergeSettingsFromPortable(data) {
  if (!data || typeof data !== 'object') return;
  if (typeof data.offsetX === 'number') settings.offsetX = data.offsetX;
  if (typeof data.offsetY === 'number') settings.offsetY = data.offsetY;
  if (typeof data.width === 'number') settings.width = data.width;
  if (typeof data.visibility === 'boolean') settings.visibility = data.visibility;
  if (data.mode === 'raster' || data.mode === 'svg') currentMode = data.mode;
  if (data.raster && typeof data.raster === 'object') {
    settings.raster = { ...settings.raster, ...data.raster };
  }
  if (data.svg && typeof data.svg === 'object') {
    settings.svg = {
      ...settings.svg,
      ...data.svg,
      colorSequence: data.svg.colorSequence
        ? { ...settings.svg.colorSequence, ...data.svg.colorSequence }
        : settings.svg.colorSequence,
    };
  }
  if (data.dropShadow && typeof data.dropShadow === 'object') {
    settings.dropShadow = { ...settings.dropShadow, ...data.dropShadow };
  }
}

function schedulePortableSave() {
  if (portableSaveTimer) clearTimeout(portableSaveTimer);
  portableSaveTimer = setTimeout(() => {
    portableSaveTimer = null;
    void mergeActivePresetIntoFile(getSettingsForSave(), activePresetId);
  }, 400);
}

/**
 * @returns {string}
 */
export function getActivePresetId() {
  return activePresetId;
}

/**
 * @param {string} id
 */
export function setActivePresetId(id) {
  activePresetId = id;
}

/**
 * Replace viewer state from a preset snapshot (flat settings + imageData + mode).
 * @param {Record<string, unknown>} flat
 * @param {{ skipPortableSave?: boolean }} [options]
 */
export function applyPresetSnapshot(flat, options = {}) {
  const skipPortable = options.skipPortableSave === true;
  mergeSettingsFromPortable(flat);
  if (flat.mode === 'raster' || flat.mode === 'svg') {
    currentMode = flat.mode;
  }
  currentImageData = flat.imageData != null ? flat.imageData : null;
  isVisible = true;

  if (imageElement) {
    imageElement.remove();
    imageElement = null;
  }
  if (svgElement) {
    svgElement.remove();
    svgElement = null;
  }
  if (imageLayerContainer) {
    imageLayerContainer.innerHTML = '';
  }

  if (currentImageData && currentImageData.data) {
    if (currentImageData.type === 'svg-code') {
      loadSVGFromCode(currentImageData.data, true);
    } else if (currentMode === 'svg') {
      loadSVGFromCode(currentImageData.data, true);
    } else {
      loadRasterImage(currentImageData.data, true);
    }
  }

  try {
    if (currentImageData) {
      localStorage.setItem('imageLayer_data', JSON.stringify(currentImageData));
    } else {
      localStorage.removeItem('imageLayer_data');
      localStorage.removeItem('imageLayer_mode');
    }
    localStorage.setItem('imageLayer_mode', currentMode);
  } catch (e) {
    console.warn('applyPresetSnapshot localStorage', e);
  }

  applySettings();
  if (!skipPortable) {
    schedulePortableSave();
  }
}

function mountWithOffset(contentNode) {
  if (!imageLayerContainer) return;
  imageLayerContainer.innerHTML = '';
  const offsetDiv = document.createElement('div');
  offsetDiv.className = 'image-layer-offset';
  offsetDiv.style.cssText = 'transform-origin: center center;';
  offsetDiv.appendChild(contentNode);
  imageLayerContainer.appendChild(offsetDiv);
  applyPositionOffset();
}

function hexToRgba(hex, opacity) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  if (!m) return `rgba(0,0,0,${opacity})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${opacity})`;
}

/**
 * CSS filter fragment for the logo drop-shadow (used on &lt;img&gt; or inline &lt;svg&gt;, not the offset wrapper).
 */
function getDropShadowFilterString() {
  const ds = settings.dropShadow;
  if (!ds || !ds.enabled) return '';
  const ox = typeof ds.offsetX === 'number' ? ds.offsetX : 0;
  const oy = typeof ds.offsetY === 'number' ? ds.offsetY : 6;
  const blur = typeof ds.blur === 'number' ? ds.blur : 14;
  const op = typeof ds.opacity === 'number' ? ds.opacity : 0.35;
  const colorHex = typeof ds.color === 'string' ? ds.color : '#000000';
  const rgba = hexToRgba(colorHex, op);
  return `drop-shadow(${ox}px ${oy}px ${blur}px ${rgba})`;
}

/**
 * Logo drop-shadow on the raster &lt;img&gt; (parent filter is unreliable for images).
 */
function applyRasterCompositeFilter() {
  if (!imageElement) return;
  const logo = getDropShadowFilterString();
  imageElement.style.filter = logo || '';
}

function applyLayerContentFilters() {
  if (currentMode === 'raster' && imageElement) {
    applyRasterCompositeFilter();
  } else if (currentMode === 'svg' && svgElement) {
    svgElement.style.filter = getDropShadowFilterString() || '';
  }
}

function applyPositionOffset() {
  const el = imageLayerContainer?.querySelector('.image-layer-offset');
  if (!el) return;
  const x = settings.offsetX ?? 0;
  const y = settings.offsetY ?? 0;
  el.style.transform = `translate(${x}px, ${y}px)`;
  el.style.filter = '';
  applyLayerContentFilters();
}

/**
 * Initialize the image layer system
 * @param {HTMLElement} container - Container element for the image layer
 */
export function init(container) {
  imageLayerContainer = container;
  
  // Create image layer element
  const layer = document.createElement('div');
  layer.id = 'image-layer';
  layer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    transition: opacity 0.3s ease;
    perspective: 1000px;
    transform-style: preserve-3d;
  `;
  
  container.appendChild(layer);
  imageLayerContainer = layer;

  // Portable JSON (data/image-layer/image-layer.json) then localStorage
  void (async () => {
    const doc = (await loadImageLayerPortable()) || emptyImageLayerDoc();
    activePresetId = doc.activePresetId;
    const ap = getActivePreset(doc);
    if (ap) {
      mergeSettingsFromPortable(presetToFlatSettings(ap));
    }
    loadSavedImage();
    applySettings();
  })();

  // Start animation loop
  startAnimationLoop();
  
  console.log('imageLayer initialized', {
    hasContainer: !!imageLayerContainer,
    hasImageElement: !!imageElement,
    hasSvgElement: !!svgElement,
    currentMode: currentMode,
    isVisible: isVisible,
    settingsVisibility: settings.visibility
  });
}

/**
 * Load an image from file
 * @param {File|Object} file - Image file (PNG, JPG, SVG) or file-like object with data property
 */
export async function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    // Handle file-like object from message passing
    if (file.data && typeof file.data === 'string') {
      const dataUrl = file.data;
      const fileName = file.name || 'image';
      const fileType = file.type || 'image/png';
      
      if (fileType === 'image/svg+xml' || fileName.toLowerCase().endsWith('.svg')) {
        // If it's SVG data, check if it's already SVG code or data URL
        if (dataUrl.startsWith('<svg') || dataUrl.startsWith('<?xml')) {
          // It's SVG code
          loadSVGFromCode(dataUrl);
          currentMode = 'svg';
        } else {
          // It's a data URL
          loadSVGFromDataUrl(dataUrl, false);
          currentMode = 'raster';
        }
      } else {
        // Load raster image
        loadRasterImage(dataUrl);
        currentMode = 'raster';
      }
      
      currentImageData = {
        type: 'file',
        data: dataUrl,
        filename: fileName
      };
      
      // Save to localStorage
      saveImageToStorage(currentImageData);
      
      resolve();
      return;
    }
    
    // Handle actual File object
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        // Load SVG as file
        loadSVGFromDataUrl(dataUrl, false);
        currentMode = 'raster';
      } else {
        // Load raster image
        loadRasterImage(dataUrl);
        currentMode = 'raster';
      }
      
      currentImageData = {
        type: 'file',
        data: dataUrl,
        filename: file.name
      };
      
      // Save to localStorage
      saveImageToStorage(currentImageData);
      
      resolve();
    };
    
    reader.onerror = reject;
    
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Load SVG from inline code
 * @param {string} svgCode - Raw SVG code
 * @param {boolean} skipSave - If true, skip saving to localStorage (used when loading from storage)
 */
export function loadSVGFromCode(svgCode, skipSave = false) {
  currentMode = 'svg';
  currentImageData = {
    type: 'svg-code',
    data: svgCode
  };
  
  // Save to localStorage (unless loading from storage)
  if (!skipSave) {
    saveImageToStorage(currentImageData);
  }
  
  // Clear existing elements
  if (imageElement) {
    imageElement.remove();
    imageElement = null;
  }
  
  if (!imageLayerContainer) return;
  
  // Create SVG element
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: relative;
    max-width: 100%;
    max-height: 100%;
    transform-origin: center center;
    transform-style: preserve-3d;
  `;
  
  // Parse and inject SVG
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgCode, 'image/svg+xml');
  const svg = svgDoc.documentElement;
  
  if (svg.tagName !== 'svg') {
    throw new Error('Invalid SVG code');
  }
  
  // Clone and style SVG
  svgElement = svg.cloneNode(true);
  svgElement.style.width = `${settings.width}px`;
  svgElement.style.height = 'auto';
  svgElement.style.display = 'block';
  
  wrapper.appendChild(svgElement);
  mountWithOffset(wrapper);
  applySVGSettings();
  applyLayerContentFilters();

  console.log('loadSVGFromCode: SVG element created', { 
    hasSvgElement: !!svgElement,
    hasWrapper: !!wrapper,
    wrapperParent: wrapper.parentElement?.tagName
  });
}

/**
 * Load SVG from data URL (as raster)
 */
function loadSVGFromDataUrl(dataUrl, isInline = false) {
  if (!imageLayerContainer) return;
  
  // Clear existing elements
  if (svgElement) {
    svgElement.remove();
    svgElement = null;
  }
  
  // Create image element
  imageElement = document.createElement('img');
  imageElement.src = dataUrl;
  imageElement.style.cssText = `
    max-width: ${settings.width}px;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
    transform-origin: center center;
    transform-style: preserve-3d;
  `;
  
  mountWithOffset(imageElement);
}

/**
 * Load raster image
 * @param {string} dataUrl - Image data URL
 * @param {boolean} skipSave - If true, skip saving to localStorage (used when loading from storage)
 */
function loadRasterImage(dataUrl, skipSave = false) {
  if (!imageLayerContainer) return;
  
  // Clear existing elements
  if (svgElement) {
    svgElement.remove();
    svgElement = null;
  }
  
  // Create image element
  imageElement = document.createElement('img');
  imageElement.src = dataUrl;
  imageElement.style.cssText = `
    max-width: ${settings.width}px;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
    transform-origin: center center;
    transform-style: preserve-3d;
  `;
  
  mountWithOffset(imageElement);

  // Save to localStorage (unless loading from storage)
  if (!skipSave && currentImageData) {
    saveImageToStorage(currentImageData);
  }

  console.log('loadRasterImage: image element created', { 
    hasImageElement: !!imageElement,
    src: imageElement.src.substring(0, 50) + '...'
  });
}

/**
 * Update settings
 * @param {Object} newSettings - New settings object
 */
export function updateSettings(newSettings) {
  settings = { ...settings, ...newSettings };

  // Update mode if specified
  if (newSettings.mode) {
    currentMode = newSettings.mode;
  }

  applySettings();
  schedulePortableSave();
}

/**
 * Apply current settings to the image layer
 */
function applySettings() {
  if (!imageLayerContainer) {
    console.warn('applySettings: imageLayerContainer not initialized');
    return;
  }
  
  // Update visibility with smooth transition
  const shouldBeVisible = settings.visibility && isVisible;
  console.log('applySettings: updating visibility', { 
    shouldBeVisible, 
    settingsVisibility: settings.visibility, 
    isVisible,
    containerDisplay: imageLayerContainer.style.display
  });
  
  if (shouldBeVisible) {
    imageLayerContainer.style.display = 'flex';
    // Trigger reflow to ensure transition works
    void imageLayerContainer.offsetHeight;
    imageLayerContainer.style.opacity = '1';
    console.log('applySettings: showing image layer');
  } else {
    imageLayerContainer.style.opacity = '0';
    console.log('applySettings: hiding image layer');
    // Hide after transition completes
    setTimeout(() => {
      if (!settings.visibility || !isVisible) {
        imageLayerContainer.style.display = 'none';
        console.log('applySettings: image layer display set to none');
      }
    }, 300);
  }
  
  if (currentMode === 'raster' && imageElement) {
    applyRasterSettings();
  } else if (currentMode === 'svg' && svgElement) {
    applySVGSettings();
  }

  applyPositionOffset();
}

/**
 * Apply raster image settings
 */
function applyRasterSettings() {
  if (!imageElement) return;

  const baseWidth = settings.width;
  imageElement.style.maxWidth = `${baseWidth}px`;
}

/**
 * Apply SVG settings
 */
function applySVGSettings() {
  if (!svgElement) return;

  // Scale
  svgElement.style.width = `${settings.width * settings.svg.scale}px`;

  const fillColor = settings.svg.fillColor || '#ffffff';
  const shapeSelector =
    'path, circle, rect, ellipse, polygon, polyline, line, text, tspan';

  svgElement.querySelectorAll(shapeSelector).forEach((el) => {
    if (el.closest('defs')) return;
    if (settings.svg.colorSequence.enabled) {
      // Filled by updateColorSequence
    } else {
      el.style.setProperty('fill', fillColor, 'important');
    }
    el.style.removeProperty('stroke');
    el.removeAttribute('stroke');
    el.removeAttribute('stroke-width');
  });
}

/**
 * Start animation loop for audio-reactive effects
 */
function startAnimationLoop() {
  function animate() {
    if (currentMode === 'raster' && imageElement && settings.visibility && isVisible) {
      applyAudioReactiveRaster();
    } else if (currentMode === 'svg' && svgElement && settings.visibility && isVisible) {
      applyAudioReactiveSVG();
    }
    
    animationFrameId = requestAnimationFrame(animate);
  }
  
  animate();
}

/**
 * Apply audio-reactive effects to raster image
 */
function applyAudioReactiveRaster() {
  if (!imageElement || !audio) return;

  // Skip style changes that would conflict with active keypress animations
  if (activeAnimation) return;

  const audioLevel = audio.getAudioLevel();

  // Calculate scale based on audio
  const scaleMultiplier = 1 + (audioLevel * settings.raster.scaleSensitivity * settings.raster.maxExpansion);
  const baseWidth = settings.width;
  const currentWidth = baseWidth * Math.min(scaleMultiplier, settings.raster.maxExpansion);

  imageElement.style.maxWidth = `${currentWidth}px`;
  imageElement.style.opacity = settings.raster.baseOpacity;

  applyRasterCompositeFilter();
}

/**
 * Apply audio-reactive effects to SVG
 */
function applyAudioReactiveSVG() {
  if (!svgElement) return;
  
  // Color sequence cycling
  if (settings.svg.colorSequence.enabled) {
    updateColorSequence();
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

/**
 * Interpolate between two colors
 */
function interpolateColor(color1, color2, t) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return color1;
  
  const r = rgb1.r + (rgb2.r - rgb1.r) * t;
  const g = rgb1.g + (rgb2.g - rgb1.g) * t;
  const b = rgb1.b + (rgb2.b - rgb1.b) * t;
  
  return rgbToHex(r, g, b);
}

/**
 * Update color sequence for SVG
 */
function updateColorSequence() {
  if (!svgElement || !settings.svg.colorSequence.enabled) return;
  
  const colors = settings.svg.colorSequence.colors;
  if (colors.length === 0) return;
  
  const transitionRate = settings.svg.colorSequence.transitionRate || 0.5;
  const now = performance.now() / 1000; // Current time in seconds
  
  let targetIndex;
  let targetColor;
  
  if (settings.svg.colorSequence.audioReactive) {
    // Use audio to drive color selection
    const audioLevel = audio.getAudioLevel();
    const normalizedFFT = audio.getNormalizedFFTData();
    
    // Use average FFT as color index
    let sum = 0;
    for (let i = 0; i < normalizedFFT.length; i++) {
      sum += normalizedFFT[i];
    }
    const avg = sum / normalizedFFT.length;
    
    targetIndex = Math.floor((avg * colors.length) % colors.length);
    targetColor = colors[targetIndex];
  } else {
    // Time-based cycling
    colorSequenceTime += 0.016 * settings.svg.colorSequence.cycleSpeed; // ~60fps
    targetIndex = Math.floor(colorSequenceTime % colors.length);
    targetColor = colors[targetIndex];
  }
  
  // Check if we need to start a new transition
  if (targetIndex !== colorSequenceIndex || !colorTransitionStartColor) {
    colorTransitionStartColor = currentInterpolatedColor || colors[colorSequenceIndex] || colors[0];
    colorTransitionEndColor = targetColor;
    colorTransitionStartTime = now;
    colorSequenceIndex = targetIndex;
  }
  
  // Calculate interpolation factor based on transition rate
  const elapsed = now - colorTransitionStartTime;
  const t = Math.min(1, elapsed / transitionRate);
  
  // Interpolate between start and end colors
  currentInterpolatedColor = interpolateColor(colorTransitionStartColor, colorTransitionEndColor, t);
  
  const shapeSelector =
    'path, circle, rect, ellipse, polygon, polyline, line, text, tspan';
  svgElement.querySelectorAll(shapeSelector).forEach((el) => {
    if (el.closest('defs')) return;
    el.style.transition = `fill ${transitionRate}s ease`;
    el.style.setProperty('fill', currentInterpolatedColor, 'important');
  });
  
  // Apply blend mode if supported
  if (settings.svg.colorSequence.blendMode !== 'normal') {
    svgElement.style.mixBlendMode = settings.svg.colorSequence.blendMode;
  } else {
    svgElement.style.mixBlendMode = 'normal';
  }
}

/**
 * Toggle visibility
 */
export function toggleVisibility() {
  console.log('toggleVisibility called', { 
    beforeToggle: isVisible, 
    settingsVisibility: settings.visibility,
    hasImageLayerContainer: !!imageLayerContainer,
    hasImageElement: !!imageElement,
    hasSvgElement: !!svgElement,
    currentMode: currentMode
  });
  
  if (!imageLayerContainer) {
    console.warn('toggleVisibility: imageLayerContainer not initialized');
    return false;
  }
  
  // Check if there's actually an image to show/hide
  if (!imageElement && !svgElement) {
    console.warn('toggleVisibility: No image or SVG element loaded');
    return false;
  }
  
  isVisible = !isVisible;
  console.log('toggleVisibility: toggled to', isVisible);
  applySettings();
  return isVisible;
}

/**
 * Set visibility
 * @param {boolean} visible
 */
export function setVisibility(visible) {
  isVisible = visible;
  applySettings();
}

/**
 * Reset position / fit to screen
 */
export function resetPosition() {
  if (!imageLayerContainer) return;
  settings.offsetX = 0;
  settings.offsetY = 0;
  applyPositionOffset();
  schedulePortableSave();
}

/**
 * Get current settings
 * @returns {Object}
 */
export function getSettings() {
  return {
    ...JSON.parse(JSON.stringify(settings)),
    visibility: isVisible && settings.visibility
  };
}

/**
 * Load settings from JSON
 * @param {Object} savedSettings
 */
export function loadSettings(savedSettings) {
  settings = { ...settings, ...savedSettings };
  applySettings();
  
  // Reload image if data is present
  if (savedSettings.imageData) {
    currentImageData = savedSettings.imageData;
    if (currentImageData.type === 'svg-code') {
      loadSVGFromCode(currentImageData.data);
    } else if (currentImageData.data) {
      if (currentMode === 'svg') {
        loadSVGFromCode(currentImageData.data);
      } else {
        loadRasterImage(currentImageData.data);
      }
    }
  }
}

/**
 * Get settings for saving (includes image data)
 * @returns {Object}
 */
export function getSettingsForSave() {
  return {
    ...settings,
    imageData: currentImageData,
    mode: currentMode
  };
}

/**
 * Save image data to localStorage + data/image-layer/image-layer.json (when API available)
 */
function saveImageToStorage(imageData) {
  try {
    localStorage.setItem('imageLayer_data', JSON.stringify(imageData));
    localStorage.setItem('imageLayer_mode', currentMode);
    console.log('Image saved', { type: imageData.type });
  } catch (error) {
    console.warn('Failed to save image to localStorage:', error);
  }
  void mergeActivePresetIntoFile(getSettingsForSave(), activePresetId);
}

/**
 * Load saved image from localStorage
 */
function loadSavedImage() {
  try {
    const savedData = localStorage.getItem('imageLayer_data');
    const savedMode = localStorage.getItem('imageLayer_mode');
    
    if (!savedData) {
      console.log('No saved image found in localStorage');
      return;
    }
    
    const imageData = JSON.parse(savedData);
    currentImageData = imageData;
    
    if (savedMode) {
      currentMode = savedMode;
    }
    
    // Load the image based on type (skipSave=true to avoid recursive saving)
    if (imageData.type === 'svg-code') {
      loadSVGFromCode(imageData.data, true);
    } else if (imageData.data) {
      if (currentMode === 'svg') {
        loadSVGFromCode(imageData.data, true);
      } else {
        loadRasterImage(imageData.data, true);
      }
    }
    
    console.log('Saved image loaded from localStorage', { type: imageData.type, mode: currentMode });
  } catch (error) {
    console.warn('Failed to load saved image from localStorage:', error);
  }
}

/**
 * Clear image layer
 */
export function clear() {
  if (imageElement) {
    imageElement.remove();
    imageElement = null;
  }
  if (svgElement) {
    svgElement.remove();
    svgElement = null;
  }
  if (imageLayerContainer) {
    imageLayerContainer.innerHTML = '';
  }
  currentImageData = null;
  
  try {
    localStorage.removeItem('imageLayer_data');
    localStorage.removeItem('imageLayer_mode');
    console.log('Image cleared');
  } catch (error) {
    console.warn('Failed to clear image from localStorage:', error);
  }
  void mergeActivePresetIntoFile(getSettingsForSave(), activePresetId);
}

/**
 * Rotate image on z-axis (2D rotation)
 * Note: Z-axis rotation means rotating the image in the plane (like a normal "rotate").
 */
export function rotateZ(degrees = 360) {
  console.log('rotateZ called', { degrees, currentMode, hasImageLayerContainer: !!imageLayerContainer });
  
  if (!imageLayerContainer) {
    console.warn('rotateZ: imageLayerContainer not initialized');
    return;
  }

  let targetElement = null;
  if (currentMode === 'svg') {
    // For SVG, target the wrapper div
    targetElement = svgElement?.parentElement;
    console.log('rotateZ: SVG mode', { hasSvgElement: !!svgElement, hasWrapper: !!targetElement });
  } else {
    targetElement = imageElement;
    console.log('rotateZ: Raster mode', { hasImageElement: !!imageElement });
  }

  if (!targetElement) {
    console.warn('rotateZ: targetElement not found', { 
      currentMode, 
      hasSvgElement: !!svgElement, 
      hasImageElement: !!imageElement,
      containerChildren: imageLayerContainer?.children?.length
    });
    return;
  }
  
  console.log('rotateZ: targetElement found', { 
    tagName: targetElement.tagName,
    id: targetElement.id,
    className: targetElement.className
  });

  // Get the current rotation in deg (if any)
  const currentTransform = targetElement.style.transform || '';
  // Match rotate with optional spaces: rotate(360deg) or rotate( 360 deg )
  const rotationMatch = currentTransform.match(/rotate\([\s]*([0-9.]+)[\s]*deg[\s]*\)/i);
  const currentRotation = rotationMatch ? parseFloat(rotationMatch[1]) : 0;

  // Add rotation by the specified amount (default 360)
  const newRotation = currentRotation + degrees;

  // Remove any previous rotate() from transforms, preserve others (like scale)
  const otherTransforms = currentTransform.replace(/rotate\([^)]*\)/gi, '').trim();
  const newTransform = otherTransforms ? `rotate(${newRotation}deg) ${otherTransforms}` : `rotate(${newRotation}deg)`;

  // Lock out audio-reactive loop during animation
  activeAnimation = 'rotateZ';

  // Apply rotation with transition
  targetElement.style.transition = 'transform 1s ease-in-out';
  targetElement.style.transform = newTransform.trim();

  console.log('rotateZ applied:', {
    currentTransform,
    newTransform,
    newRotation,
    element: targetElement.tagName,
    hasTransform: !!targetElement.style.transform
  });

  // Reset transition and unlock after animation completes
  setTimeout(() => {
    if (targetElement) {
      targetElement.style.transition = '';
    }
    activeAnimation = null;
  }, 1000);
}

/**
 * Push/scale image animation
 * Scales to 200% over 10s, then resets size/position and fades back in over 1s
 */
export function pushScale() {
  console.log('pushScale called', { currentMode, hasImageLayerContainer: !!imageLayerContainer });
  
  if (!imageLayerContainer) {
    console.warn('pushScale: imageLayerContainer not initialized');
    return;
  }
  
  let targetElement = null;
  if (currentMode === 'svg') {
    // For SVG, target the wrapper div
    targetElement = svgElement?.parentElement;
    console.log('pushScale: SVG mode', { hasSvgElement: !!svgElement, hasWrapper: !!targetElement });
  } else {
    targetElement = imageElement;
    console.log('pushScale: Raster mode', { hasImageElement: !!imageElement });
  }
  
  if (!targetElement) {
    console.warn('pushScale: targetElement not found', { 
      currentMode, 
      hasSvgElement: !!svgElement, 
      hasImageElement: !!imageElement,
      containerChildren: imageLayerContainer?.children?.length
    });
    return;
  }
  
  console.log('pushScale: targetElement found', { 
    tagName: targetElement.tagName,
    id: targetElement.id,
    className: targetElement.className
  });
  
  // Store original transform and opacity
  const originalTransform = targetElement.style.transform || '';
  const originalOpacity = targetElement.style.opacity || '1';
  
  // Remove any existing scale from transform, but preserve rotate and other transforms
  const transformWithoutScale = originalTransform.replace(/scale\([^)]*\)/gi, '').trim();
  const baseTransform = transformWithoutScale || '';
  
  // Lock out audio-reactive loop during entire animation
  activeAnimation = 'pushScale';

  // Step 1: Scale to 200% over 10 seconds
  // Combine scale with existing transforms (like rotate)
  const scaleTransform = baseTransform ? `scale(2) ${baseTransform}` : 'scale(2)';
  targetElement.style.transition = 'transform 10s ease-out';
  targetElement.style.transform = scaleTransform.trim();

  console.log('pushScale started:', {
    originalTransform,
    baseTransform,
    scaleTransform,
    element: targetElement.tagName,
    hasTransform: !!targetElement.style.transform
  });

  // Step 2: After scale completes (10s), reset size/position and fade back in over 1s
  setTimeout(() => {
    if (!targetElement) return; // Check if element still exists

    // Reset transform immediately (no transition for reset)
    targetElement.style.transition = 'none';
    targetElement.style.transform = baseTransform || '';
    targetElement.style.opacity = '0';

    // Trigger reflow to ensure reset is applied
    void targetElement.offsetHeight;

    // Fade back in over 1 second
    targetElement.style.transition = 'opacity 1s ease-in';
    targetElement.style.opacity = originalOpacity;

    // Clean up transition and unlock after fade completes
    setTimeout(() => {
      if (targetElement) {
        targetElement.style.transition = '';
      }
      activeAnimation = null;
    }, 1000);
  }, 10000);
}

/**
 * Cleanup
 */
export function destroy() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  clear();
}

