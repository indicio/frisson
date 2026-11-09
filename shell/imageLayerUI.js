/**
 * Image Layer UI Management
 * Handles the configuration modal and user interactions
 */

import {
  loadImageLayerPortable,
  saveImageLayerDocument,
} from '../shared/portableStorage.js';
import {
  emptyImageLayerDoc,
  getActivePreset,
  presetToFlatSettings,
  generatePresetId,
  upsertPresetDataFromFlat,
} from '../shared/imageLayerDoc.js';

let imageLayerModal = null;
let viewerChannel = null;
/** @type {ReturnType<typeof emptyImageLayerDoc>} */
let imageLayerDoc = emptyImageLayerDoc();
/** 'save' | 'saveAs' | null */
let pendingStateIntent = null;
let currentSettings = {
  mode: 'raster',
  width: 400,
  visibility: true,
  offsetX: 0,
  offsetY: 0,
  raster: {
    scaleSensitivity: 0.5,
    baseOpacity: 1.0,
    maxExpansion: 2.0
  },
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
  },
  dropShadow: {
    enabled: false,
    offsetX: 0,
    offsetY: 6,
    blur: 14,
    color: '#000000',
    opacity: 0.35,
  },
};

function mergePortableIntoCurrentSettings(data) {
  if (!data || typeof data !== 'object') return;
  if (typeof data.offsetX === 'number') currentSettings.offsetX = data.offsetX;
  if (typeof data.offsetY === 'number') currentSettings.offsetY = data.offsetY;
  if (typeof data.width === 'number') currentSettings.width = data.width;
  if (typeof data.visibility === 'boolean') currentSettings.visibility = data.visibility;
  if (data.mode === 'raster' || data.mode === 'svg') currentSettings.mode = data.mode;
  if (data.raster && typeof data.raster === 'object') {
    currentSettings.raster = { ...currentSettings.raster, ...data.raster };
  }
  if (data.svg && typeof data.svg === 'object') {
    currentSettings.svg = {
      ...currentSettings.svg,
      ...data.svg,
      colorSequence: data.svg.colorSequence
        ? { ...currentSettings.svg.colorSequence, ...data.svg.colorSequence }
        : currentSettings.svg.colorSequence,
    };
  }
  if (data.dropShadow && typeof data.dropShadow === 'object') {
    currentSettings.dropShadow = {
      ...currentSettings.dropShadow,
      ...data.dropShadow,
    };
  }
}

/**
 * Initialize image layer UI
 */
export async function init(channel) {
  viewerChannel = channel;
  imageLayerModal = document.getElementById('image-layer-modal');

  const loaded = await loadImageLayerPortable();
  imageLayerDoc = loaded || emptyImageLayerDoc();
  const active = getActivePreset(imageLayerDoc);
  if (active) {
    mergePortableIntoCurrentSettings(presetToFlatSettings(active));
  }

  setupModal();
  setupEventListeners();
}

/**
 * Setup modal structure
 */
function setupModal() {
  if (!imageLayerModal) return;
  
  // Close on overlay click
  imageLayerModal.addEventListener('click', (e) => {
    if (e.target === imageLayerModal) {
      closeModal();
    }
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Image Layer button
  const imageLayerBtn = document.getElementById('image-layer-btn');
  if (imageLayerBtn) {
    imageLayerBtn.addEventListener('click', () => {
      toggleModal();
    });
  }
  
  // Close button
  const closeBtn = document.getElementById('image-layer-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeModal();
    });
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'I' && e.shiftKey) {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        toggleModal();
        e.preventDefault();
      }
    }
  });
}

/**
 * Toggle modal visibility
 */
export function toggleModal() {
  if (!imageLayerModal) return;
  
  if (imageLayerModal.classList.contains('open')) {
    closeModal();
  } else {
    void openModal();
  }
}

/**
 * Open modal
 */
async function openModal() {
  if (!imageLayerModal) return;
  imageLayerModal.classList.add('open');
  const fresh = await loadImageLayerPortable();
  if (fresh) {
    imageLayerDoc = fresh;
    const active = getActivePreset(imageLayerDoc);
    if (active) {
      mergePortableIntoCurrentSettings(presetToFlatSettings(active));
    }
  }
  renderModalContent();
  setTimeout(() => {
    renderColorSequence();
    updateModeDisplay();
  }, 100);
}

/**
 * Close modal
 */
function closeModal() {
  if (!imageLayerModal) return;
  imageLayerModal.classList.remove('open');
}

/**
 * Render modal content
 */
function renderModalContent() {
  const body = document.getElementById('image-layer-modal-body');
  if (!body) return;
  
  body.innerHTML = `
    <div class="image-layer-controls image-layer-controls--cols">
      <div class="control-group image-layer-presets image-layer-span-cols">
        <h3>Logos</h3>
        <p class="image-layer-hint">Pick a saved logo. Save writes the viewer&rsquo;s current state into the active preset.</p>
        <div class="control-item">
          <label class="control-label" for="preset-select">Active logo</label>
          <select id="preset-select" class="filter-select"></select>
        </div>
        <div class="control-item preset-actions preset-actions--row" role="toolbar" aria-label="Logo preset actions">
          <button type="button" id="preset-save-btn" class="btn secondary btn-icon-label" title="Save viewer state to this preset">
            <i data-lucide="save" aria-hidden="true"></i><span>Save</span>
          </button>
          <button type="button" id="preset-save-as-btn" class="btn secondary btn-icon-label" title="Save as a new preset">
            <i data-lucide="copy-plus" aria-hidden="true"></i><span>Save as</span>
          </button>
          <button type="button" id="preset-rename-btn" class="btn secondary btn-icon-label" title="Rename this preset">
            <i data-lucide="pencil" aria-hidden="true"></i><span>Rename</span>
          </button>
          <button type="button" id="preset-delete-btn" class="btn secondary btn-icon-label" title="Delete this preset">
            <i data-lucide="trash-2" aria-hidden="true"></i><span>Delete</span>
          </button>
        </div>
      </div>

      <div class="image-layer-col image-layer-col--source">
      <div class="control-group image-layer-mode-group">
        <h3>Logo source &amp; mode</h3>
        <p class="image-layer-hint">The source type and the controls below work together: pick a mode, then set options for that mode.</p>
        <div class="control-item">
          <label class="control-label" for="mode-select">Source type</label>
          <select id="mode-select">
            <option value="raster">Raster image (PNG / JPG / SVG file)</option>
            <option value="svg">Inline SVG</option>
          </select>
        </div>
        <div class="image-layer-mode-panels">
      <div class="control-group mode-controls image-layer-mode-panel" id="raster-controls" style="display: none;">
        <h4 class="image-layer-subheading">Raster image</h4>
        <p class="image-layer-hint image-layer-hint--sub">Upload and tune a bitmap or SVG loaded as a file.</p>
        <div class="control-item">
          <label class="control-label">Upload File (PNG, JPG, SVG)</label>
          <input type="file" id="image-file-input" accept="image/png,image/jpeg,image/svg+xml,.svg">
        </div>
        <div class="control-item">
          <label class="control-label">
            Scale Sensitivity
            <span class="value" id="scale-sensitivity-value">0.5</span>
          </label>
          <input type="range" id="scale-sensitivity-slider" min="0" max="2" value="0.5" step="0.1">
        </div>
        <div class="control-item">
          <label class="control-label">
            Base Opacity
            <span class="value" id="base-opacity-value">1.0</span>
          </label>
          <input type="range" id="base-opacity-slider" min="0" max="1" value="1.0" step="0.05">
        </div>
        <div class="control-item">
          <label class="control-label">
            Max Expansion Limit
            <span class="value" id="max-expansion-value">2.0</span>x
          </label>
          <input type="range" id="max-expansion-slider" min="1" max="5" value="2.0" step="0.1">
        </div>
      </div>

      <!-- Inline SVG Mode Controls - Dynamic -->
      <div class="control-group mode-controls image-layer-mode-panel" id="svg-controls" style="display: none;">
        <h4 class="image-layer-subheading">Inline SVG</h4>
        <p class="image-layer-hint image-layer-hint--sub">Paste SVG markup and configure fill and color behavior.</p>
        <div class="control-item">
          <label class="control-label">Paste SVG Code</label>
          <textarea id="svg-code-input" rows="8" placeholder="Paste SVG code here..."></textarea>
          <button id="load-svg-btn" class="btn primary" style="margin-top: 0.5rem;">Load SVG</button>
        </div>
        <div class="control-item">
          <label class="control-label">
            Scale
            <span class="value" id="svg-scale-value">1.0</span>
          </label>
          <input type="range" id="svg-scale-slider" min="0.1" max="5" value="1.0" step="0.1">
        </div>
        
        <!-- Fill Mode Toggle -->
        <div class="control-item">
          <label class="control-label">Fill Mode</label>
          <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="radio" name="fill-mode" id="fill-mode-solid" value="solid" checked>
              <span>Solid Fill</span>
            </label>
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="radio" name="fill-mode" id="fill-mode-sequence" value="sequence">
              <span>Color Sequence</span>
            </label>
          </div>
        </div>

        <!-- Solid Fill Controls -->
        <div id="solid-fill-controls">
          <div class="control-item">
            <label class="control-label">Fill Color</label>
            <input type="color" id="svg-fill-color" value="#ffffff">
          </div>
        </div>

        <!-- Color Sequence Controls -->
        <div id="color-sequence-controls" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color, #444);">
          <div class="control-item">
            <label class="control-label">Color Sequence</label>
            <div id="color-sequence-list" class="color-sequence-list"></div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
              <input type="color" id="color-sequence-add-color" value="#ff00ff">
              <button id="color-sequence-add-btn" class="btn secondary">Add Color</button>
            </div>
          </div>
          <div class="control-item">
            <label class="control-label">
              Cycle Speed
              <span class="value" id="cycle-speed-value">1.0</span>
            </label>
            <input type="range" id="cycle-speed-slider" min="0" max="5" value="1.0" step="0.1">
          </div>
          <div class="control-item">
            <label class="control-label">
              Transition Rate
              <span class="value" id="transition-rate-value">0.5</span>s
            </label>
            <input type="range" id="transition-rate-slider" min="0" max="3" value="0.5" step="0.1">
            <small style="color: var(--text-secondary, #aaa); font-size: 0.75rem; display: block; margin-top: 0.25rem;">Time to transition between colors</small>
          </div>
          <div class="control-item">
            <label class="control-label">
              <input type="checkbox" id="audio-reactive-cycling"> Audio-Reactive Cycling
            </label>
          </div>
          <div class="control-item">
            <label class="control-label">Blend Mode</label>
            <select id="blend-mode-select">
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
              <option value="difference">Difference</option>
              <option value="exclusion">Exclusion</option>
              <option value="color-dodge">Color Dodge</option>
              <option value="color-burn">Color Burn</option>
              <option value="hard-light">Hard Light</option>
              <option value="soft-light">Soft Light</option>
            </select>
          </div>
        </div>
      </div>
        </div>
      </div>

      <div class="control-group">
        <h3>General Settings</h3>
        <p class="image-layer-hint image-layer-hint--sub">Size and visibility apply regardless of source type.</p>
        <div class="control-item">
          <label class="control-label">
            Image Width
            <span class="value" id="width-value">400</span>px
          </label>
          <input type="range" id="width-slider" min="50" max="2000" value="400" step="10">
        </div>
        <div class="control-item" style="display: flex; justify-content: space-between; align-items: center;">
          <label class="control-label" style="margin-bottom: 0;">
            <input type="checkbox" id="visibility-checkbox" checked>
            Visible
          </label>
          <button id="clear-image-btn" class="btn secondary">Clear Image</button>
        </div>
      </div>
      </div>

      <div class="image-layer-col image-layer-col--placement">
      <div class="control-group">
        <h3>Logo position</h3>
        <p class="image-layer-hint">Pixel offset from center; (0, 0) is centered on screen.</p>
        <div class="control-item">
          <label class="control-label">
            Delta X
            <span class="value" id="offset-x-value">0</span>px
          </label>
          <input type="range" id="offset-x-slider" min="-800" max="800" value="0" step="1">
        </div>
        <div class="control-item">
          <label class="control-label">
            Delta Y
            <span class="value" id="offset-y-value">0</span>px
          </label>
          <input type="range" id="offset-y-slider" min="-800" max="800" value="0" step="1">
        </div>
        <div class="control-item">
          <button type="button" id="reset-offset-btn" class="btn secondary">Reset position</button>
        </div>
      </div>

      <div class="control-group">
        <h3>Drop shadow</h3>
        <p class="image-layer-hint">CSS <code>filter: drop-shadow(&hellip;)</code> on the logo (alpha from opacity).</p>
        <div class="control-item">
          <label class="control-label" style="margin-bottom:0;">
            <input type="checkbox" id="drop-shadow-enabled">
            Enable drop shadow
          </label>
        </div>
        <div id="drop-shadow-detail" class="drop-shadow-detail">
          <div class="control-item">
            <label class="control-label">
              Shadow X
              <span class="value" id="dshadow-ox-value">0</span>px
            </label>
            <input type="range" id="dshadow-ox-slider" min="-48" max="48" value="0" step="1">
          </div>
          <div class="control-item">
            <label class="control-label">
              Shadow Y
              <span class="value" id="dshadow-oy-value">6</span>px
            </label>
            <input type="range" id="dshadow-oy-slider" min="-48" max="48" value="6" step="1">
          </div>
          <div class="control-item">
            <label class="control-label">
              Blur
              <span class="value" id="dshadow-blur-value">14</span>px
            </label>
            <input type="range" id="dshadow-blur-slider" min="0" max="80" value="14" step="1">
          </div>
          <div class="control-item" style="display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
            <div>
              <label class="control-label">Shadow color</label>
              <input type="color" id="dshadow-color" value="#000000">
            </div>
            <div style="flex:1; min-width:120px;">
              <label class="control-label">
                Opacity
                <span class="value" id="dshadow-opacity-value">0.35</span>
              </label>
              <input type="range" id="dshadow-opacity-slider" min="0" max="1" value="0.35" step="0.05">
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  `;
  
  setupControlListeners();
  populatePresetSelect();

  // Sync UI with current settings first
  syncUIWithSettings();

  // Then update mode display (this will show the correct mode controls)
  updateModeDisplay();
  refreshImageLayerLucideIcons();
}

function refreshImageLayerLucideIcons() {
  const L = globalThis.lucide;
  if (typeof L?.createIcons === 'function') {
    L.createIcons({
      attrs: { class: 'lucide lucide-icon', 'stroke-width': 1.75 },
    });
  }
}

function updateDropShadowDetailVisibility() {
  const detail = document.getElementById('drop-shadow-detail');
  const en = document.getElementById('drop-shadow-enabled');
  if (!detail || !en) return;
  detail.style.display = en.checked ? 'block' : 'none';
}

/**
 * Setup control event listeners
 */
function setupControlListeners() {
  setupPresetControlListeners();

  // File input
  const fileInput = document.getElementById('image-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await loadImageFile(file);
      }
    });
  }
  
  // SVG code input
  const loadSvgBtn = document.getElementById('load-svg-btn');
  if (loadSvgBtn) {
    loadSvgBtn.addEventListener('click', () => {
      const svgCode = document.getElementById('svg-code-input').value;
      if (svgCode.trim()) {
        loadSVGCode(svgCode);
      }
    });
  }
  
  // Clear button (moved to general controls)
  const clearBtn = document.getElementById('clear-image-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (viewerChannel) {
        viewerChannel.postMessage({
          type: 'IMAGE_LAYER_CLEAR',
          data: {}
        });
      }
    });
  }
  
  // General controls
  setupSlider('width-slider', 'width-value', (value) => {
    updateSettings({ width: parseInt(value) });
  });

  setupSlider('offset-x-slider', 'offset-x-value', (value) => {
    updateSettings({ offsetX: parseInt(value, 10) });
  });

  setupSlider('offset-y-slider', 'offset-y-value', (value) => {
    updateSettings({ offsetY: parseInt(value, 10) });
  });

  const resetOffsetBtn = document.getElementById('reset-offset-btn');
  if (resetOffsetBtn) {
    resetOffsetBtn.addEventListener('click', () => {
      updateSettings({ offsetX: 0, offsetY: 0 });
      const ox = document.getElementById('offset-x-slider');
      const oy = document.getElementById('offset-y-slider');
      const vx = document.getElementById('offset-x-value');
      const vy = document.getElementById('offset-y-value');
      if (ox) ox.value = '0';
      if (oy) oy.value = '0';
      if (vx) vx.textContent = '0';
      if (vy) vy.textContent = '0';
    });
  }

  const visibilityCheckbox = document.getElementById('visibility-checkbox');
  if (visibilityCheckbox) {
    visibilityCheckbox.addEventListener('change', (e) => {
      updateSettings({ visibility: e.target.checked });
    });
  }

  const dropShadowEn = document.getElementById('drop-shadow-enabled');
  if (dropShadowEn) {
    dropShadowEn.addEventListener('change', (e) => {
      updateSettings({
        dropShadow: {
          ...currentSettings.dropShadow,
          enabled: e.target.checked,
        },
      });
      updateDropShadowDetailVisibility();
    });
  }

  setupSlider('dshadow-ox-slider', 'dshadow-ox-value', (value) => {
    updateSettings({
      dropShadow: {
        ...currentSettings.dropShadow,
        offsetX: parseInt(value, 10),
      },
    });
  });
  setupSlider('dshadow-oy-slider', 'dshadow-oy-value', (value) => {
    updateSettings({
      dropShadow: {
        ...currentSettings.dropShadow,
        offsetY: parseInt(value, 10),
      },
    });
  });
  setupSlider('dshadow-blur-slider', 'dshadow-blur-value', (value) => {
    updateSettings({
      dropShadow: {
        ...currentSettings.dropShadow,
        blur: parseInt(value, 10),
      },
    });
  });
  setupSlider('dshadow-opacity-slider', 'dshadow-opacity-value', (value) => {
    updateSettings({
      dropShadow: {
        ...currentSettings.dropShadow,
        opacity: parseFloat(value),
      },
    });
  });

  const dshadowColor = document.getElementById('dshadow-color');
  if (dshadowColor) {
    dshadowColor.addEventListener('input', (e) => {
      updateSettings({
        dropShadow: {
          ...currentSettings.dropShadow,
          color: e.target.value,
        },
      });
    });
  }

  // Mode selection
  const modeSelect = document.getElementById('mode-select');
  if (modeSelect) {
    // Set initial mode if not set
    if (!currentSettings.mode) {
      currentSettings.mode = 'raster';
    }
    modeSelect.value = currentSettings.mode;
    
    modeSelect.addEventListener('change', (e) => {
      const newMode = e.target.value;
      currentSettings.mode = newMode;
      updateModeDisplay();
      // Update settings to reflect mode change
      updateSettings({ mode: newMode });
    });
  }
  
  // Raster controls
  setupSlider('scale-sensitivity-slider', 'scale-sensitivity-value', (value) => {
    updateSettings({
      raster: {
        ...currentSettings?.raster,
        scaleSensitivity: parseFloat(value)
      }
    });
  });
  
  setupSlider('base-opacity-slider', 'base-opacity-value', (value) => {
    updateSettings({
      raster: {
        ...currentSettings?.raster,
        baseOpacity: parseFloat(value)
      }
    });
  });
  
  setupSlider('max-expansion-slider', 'max-expansion-value', (value) => {
    updateSettings({
      raster: {
        ...currentSettings?.raster,
        maxExpansion: parseFloat(value)
      }
    });
  });
  
  // SVG controls
  setupSlider('svg-scale-slider', 'svg-scale-value', (value) => {
    updateSettings({
      svg: {
        ...currentSettings?.svg,
        scale: parseFloat(value)
      }
    });
  });
  
  // Fill mode toggle (radio buttons)
  const fillModeSolid = document.getElementById('fill-mode-solid');
  const fillModeSequence = document.getElementById('fill-mode-sequence');
  const solidFillControls = document.getElementById('solid-fill-controls');
  const colorSequenceControls = document.getElementById('color-sequence-controls');
  
  if (fillModeSolid && fillModeSequence) {
    // Set initial state
    const initialFillMode = currentSettings?.svg?.colorSequence?.enabled ? 'sequence' : 'solid';
    if (initialFillMode === 'solid') {
      fillModeSolid.checked = true;
      if (solidFillControls) solidFillControls.style.display = 'block';
      if (colorSequenceControls) colorSequenceControls.style.display = 'none';
    } else {
      fillModeSequence.checked = true;
      if (solidFillControls) solidFillControls.style.display = 'none';
      if (colorSequenceControls) colorSequenceControls.style.display = 'block';
    }
    
    fillModeSolid.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (solidFillControls) solidFillControls.style.display = 'block';
        if (colorSequenceControls) colorSequenceControls.style.display = 'none';
        updateSettings({
          svg: {
            ...currentSettings?.svg,
            colorSequence: {
              ...currentSettings?.svg?.colorSequence,
              enabled: false
            }
          }
        });
      }
    });
    
    fillModeSequence.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (solidFillControls) solidFillControls.style.display = 'none';
        if (colorSequenceControls) colorSequenceControls.style.display = 'block';
        updateSettings({
          svg: {
            ...currentSettings?.svg,
            colorSequence: {
              ...currentSettings?.svg?.colorSequence,
              enabled: true
            }
          }
        });
        renderColorSequence();
      }
    });
  }
  
  const fillColorInput = document.getElementById('svg-fill-color');
  if (fillColorInput) {
    fillColorInput.addEventListener('change', (e) => {
      updateSettings({
        svg: {
          ...currentSettings?.svg,
          fillColor: e.target.value
        }
      });
    });
  }
  
  const addColorBtn = document.getElementById('color-sequence-add-btn');
  if (addColorBtn) {
    addColorBtn.addEventListener('click', () => {
      const colorInput = document.getElementById('color-sequence-add-color');
      if (colorInput && currentSettings?.svg?.colorSequence) {
        const colors = [...(currentSettings.svg.colorSequence.colors || []), colorInput.value];
        updateSettings({
          svg: {
            ...currentSettings.svg,
            colorSequence: {
              ...currentSettings.svg.colorSequence,
              colors: colors
            }
          }
        });
        renderColorSequence();
      }
    });
  }
  
  setupSlider('cycle-speed-slider', 'cycle-speed-value', (value) => {
    updateSettings({
      svg: {
        ...currentSettings?.svg,
        colorSequence: {
          ...currentSettings?.svg?.colorSequence,
          cycleSpeed: parseFloat(value)
        }
      }
    });
  });
  
  setupSlider('transition-rate-slider', 'transition-rate-value', (value) => {
    updateSettings({
      svg: {
        ...currentSettings?.svg,
        colorSequence: {
          ...currentSettings?.svg?.colorSequence,
          transitionRate: parseFloat(value)
        }
      }
    });
  });
  
  const audioReactiveCheckbox = document.getElementById('audio-reactive-cycling');
  if (audioReactiveCheckbox) {
    audioReactiveCheckbox.addEventListener('change', (e) => {
      updateSettings({
        svg: {
          ...currentSettings?.svg,
          colorSequence: {
            ...currentSettings?.svg?.colorSequence,
            audioReactive: e.target.checked
          }
        }
      });
    });
  }
  
  const blendModeSelect = document.getElementById('blend-mode-select');
  if (blendModeSelect) {
    blendModeSelect.addEventListener('change', (e) => {
      updateSettings({
        svg: {
          ...currentSettings?.svg,
          colorSequence: {
            ...currentSettings?.svg?.colorSequence,
            blendMode: e.target.value
          }
        }
      });
    });
  }
}

/**
 * Setup slider with value display
 */
function setupSlider(sliderId, valueId, callback) {
  const slider = document.getElementById(sliderId);
  const valueDisplay = document.getElementById(valueId);
  
  if (slider && valueDisplay) {
    slider.addEventListener('input', (e) => {
      valueDisplay.textContent = e.target.value;
      if (callback) callback(e.target.value);
    });
  }
}

/**
 * Update mode display
 */
function updateModeDisplay() {
  const modeSelect = document.getElementById('mode-select');
  const rasterControls = document.getElementById('raster-controls');
  const svgControls = document.getElementById('svg-controls');
  
  if (!modeSelect) return;
  
  // Hide all mode controls first
  document.querySelectorAll('.mode-controls').forEach(control => {
    control.style.display = 'none';
    control.style.opacity = '0';
  });
  
  // Show selected mode controls with smooth transition
  if (modeSelect.value === 'raster') {
    if (rasterControls) {
      rasterControls.style.display = 'block';
      setTimeout(() => {
        rasterControls.style.transition = 'opacity 0.3s ease';
        rasterControls.style.opacity = '1';
      }, 10);
    }
  } else {
    if (svgControls) {
      svgControls.style.display = 'block';
      setTimeout(() => {
        svgControls.style.transition = 'opacity 0.3s ease';
        svgControls.style.opacity = '1';
      }, 10);
    }
  }
}

/**
 * Load image file
 */
async function loadImageFile(file) {
  if (!viewerChannel) return;
  
  // Convert file to base64 or send as File object
  // For simplicity, we'll send it via message (in production, might want to use FileReader)
  const reader = new FileReader();
  reader.onload = (e) => {
    viewerChannel.postMessage({
      type: 'IMAGE_LAYER_LOAD_FILE',
      data: {
        file: {
          name: file.name,
          type: file.type,
          data: e.target.result
        }
      }
    });
  };
  
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    reader.readAsText(file);
  } else {
    reader.readAsDataURL(file);
  }
}

/**
 * Load SVG code
 */
function loadSVGCode(svgCode) {
  if (!viewerChannel) return;
  
  viewerChannel.postMessage({
    type: 'IMAGE_LAYER_LOAD_SVG',
    data: { svgCode: svgCode }
  });
}

/**
 * Update settings
 */
function updateSettings(newSettings) {
  if (!currentSettings) {
    currentSettings = {};
  }

  const merged = { ...currentSettings, ...newSettings };
  if (newSettings.dropShadow && typeof newSettings.dropShadow === 'object') {
    merged.dropShadow = {
      ...currentSettings.dropShadow,
      ...newSettings.dropShadow,
    };
  }
  currentSettings = merged;

  if (viewerChannel) {
    viewerChannel.postMessage({
      type: 'IMAGE_LAYER_UPDATE',
      data: { settings: currentSettings },
    });
  }
}

/**
 * Sync UI with current settings
 */
function syncUIWithSettings() {
  if (!currentSettings) return;
  
  // Update mode select first
  const modeSelect = document.getElementById('mode-select');
  if (modeSelect && currentSettings.mode) {
    modeSelect.value = currentSettings.mode;
  }
  
  // Update all inputs with current settings
  const widthSlider = document.getElementById('width-slider');
  if (widthSlider) {
    widthSlider.value = currentSettings.width || 400;
    const widthValue = document.getElementById('width-value');
    if (widthValue) widthValue.textContent = widthSlider.value;
  }
  
  const visibilityCheckbox = document.getElementById('visibility-checkbox');
  if (visibilityCheckbox) {
    visibilityCheckbox.checked = currentSettings.visibility !== false;
  }

  const offsetXSlider = document.getElementById('offset-x-slider');
  if (offsetXSlider) {
    offsetXSlider.value = String(currentSettings.offsetX ?? 0);
    const oxv = document.getElementById('offset-x-value');
    if (oxv) oxv.textContent = offsetXSlider.value;
  }
  const offsetYSlider = document.getElementById('offset-y-slider');
  if (offsetYSlider) {
    offsetYSlider.value = String(currentSettings.offsetY ?? 0);
    const oyv = document.getElementById('offset-y-value');
    if (oyv) oyv.textContent = offsetYSlider.value;
  }

  const ds = currentSettings.dropShadow || {};
  const dEn = document.getElementById('drop-shadow-enabled');
  if (dEn) {
    dEn.checked = !!ds.enabled;
  }
  const dOx = document.getElementById('dshadow-ox-slider');
  if (dOx) {
    dOx.value = String(ds.offsetX ?? 0);
    const v = document.getElementById('dshadow-ox-value');
    if (v) v.textContent = dOx.value;
  }
  const dOy = document.getElementById('dshadow-oy-slider');
  if (dOy) {
    dOy.value = String(ds.offsetY ?? 6);
    const v = document.getElementById('dshadow-oy-value');
    if (v) v.textContent = dOy.value;
  }
  const dBl = document.getElementById('dshadow-blur-slider');
  if (dBl) {
    dBl.value = String(ds.blur ?? 14);
    const v = document.getElementById('dshadow-blur-value');
    if (v) v.textContent = dBl.value;
  }
  const dCol = document.getElementById('dshadow-color');
  if (dCol) {
    dCol.value = ds.color && /^#/.test(ds.color) ? ds.color : '#000000';
  }
  const dOp = document.getElementById('dshadow-opacity-slider');
  if (dOp) {
    dOp.value = String(ds.opacity ?? 0.35);
    const v = document.getElementById('dshadow-opacity-value');
    if (v) v.textContent = dOp.value;
  }
  updateDropShadowDetailVisibility();

  // Raster settings
  if (currentSettings.raster) {
    const scaleSensitivity = document.getElementById('scale-sensitivity-slider');
    if (scaleSensitivity) {
      scaleSensitivity.value = currentSettings.raster.scaleSensitivity || 0.5;
      const value = document.getElementById('scale-sensitivity-value');
      if (value) value.textContent = scaleSensitivity.value;
    }
    
    const baseOpacity = document.getElementById('base-opacity-slider');
    if (baseOpacity) {
      baseOpacity.value = currentSettings.raster.baseOpacity || 1.0;
      const value = document.getElementById('base-opacity-value');
      if (value) value.textContent = baseOpacity.value;
    }
    
    const maxExpansion = document.getElementById('max-expansion-slider');
    if (maxExpansion) {
      maxExpansion.value = currentSettings.raster.maxExpansion || 2.0;
      const value = document.getElementById('max-expansion-value');
      if (value) value.textContent = maxExpansion.value;
    }
  }
  
  // SVG settings
  if (currentSettings.svg) {
    const svgScale = document.getElementById('svg-scale-slider');
    if (svgScale) {
      svgScale.value = currentSettings.svg.scale || 1.0;
      const value = document.getElementById('svg-scale-value');
      if (value) value.textContent = svgScale.value;
    }
    
    const fillColor = document.getElementById('svg-fill-color');
    if (fillColor) {
      fillColor.value = currentSettings.svg.fillColor || '#ffffff';
    }
    
    // Fill mode (solid vs sequence)
    const fillModeSolid = document.getElementById('fill-mode-solid');
    const fillModeSequence = document.getElementById('fill-mode-sequence');
    const solidFillControls = document.getElementById('solid-fill-controls');
    const colorSequenceControls = document.getElementById('color-sequence-controls');
    
    if (currentSettings.svg.colorSequence) {
      const isSequenceEnabled = currentSettings.svg.colorSequence.enabled || false;
      
      if (fillModeSolid && fillModeSequence) {
        if (isSequenceEnabled) {
          fillModeSequence.checked = true;
          if (solidFillControls) solidFillControls.style.display = 'none';
          if (colorSequenceControls) colorSequenceControls.style.display = 'block';
        } else {
          fillModeSolid.checked = true;
          if (solidFillControls) solidFillControls.style.display = 'block';
          if (colorSequenceControls) colorSequenceControls.style.display = 'none';
        }
      }
      
      const cycleSpeed = document.getElementById('cycle-speed-slider');
      if (cycleSpeed) {
        cycleSpeed.value = currentSettings.svg.colorSequence.cycleSpeed || 1.0;
        const value = document.getElementById('cycle-speed-value');
        if (value) value.textContent = cycleSpeed.value;
      }
      
      const transitionRate = document.getElementById('transition-rate-slider');
      if (transitionRate) {
        transitionRate.value = currentSettings.svg.colorSequence.transitionRate || 0.5;
        const value = document.getElementById('transition-rate-value');
        if (value) value.textContent = transitionRate.value;
      }
      
      const audioReactive = document.getElementById('audio-reactive-cycling');
      if (audioReactive) {
        audioReactive.checked = currentSettings.svg.colorSequence.audioReactive || false;
      }
      
      const blendMode = document.getElementById('blend-mode-select');
      if (blendMode) {
        blendMode.value = currentSettings.svg.colorSequence.blendMode || 'normal';
      }
    }
  }
}

/**
 * Render color sequence list
 */
function renderColorSequence() {
  const list = document.getElementById('color-sequence-list');
  if (!list) return;
  
  if (!currentSettings?.svg?.colorSequence) {
    list.innerHTML = '';
    return;
  }
  
  const colors = currentSettings.svg.colorSequence.colors || [];
  
  if (colors.length === 0) {
    list.innerHTML = '<div style="color: var(--text-secondary, #aaa); font-size: 0.875rem; padding: 0.5rem;">No colors added. Add colors to create a sequence.</div>';
    return;
  }
  
  list.innerHTML = colors.map((color, index) => `
    <div class="color-sequence-item" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-secondary, #2a2a2a); border-radius: 4px; border: 1px solid var(--border-color, #444);">
      <div style="position: relative;">
        <input type="color" value="${color}" data-index="${index}" class="color-sequence-color" style="width: 40px; height: 40px; border: none; border-radius: 4px; cursor: pointer;">
      </div>
      <div style="flex: 1; display: flex; flex-direction: column;">
        <span style="color: var(--text-primary, #fff); font-size: 0.875rem; font-weight: 500;">${color}</span>
        <span style="color: var(--text-secondary, #aaa); font-size: 0.75rem;">Step ${index + 1}</span>
      </div>
      <button class="btn secondary" data-index="${index}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Remove</button>
    </div>
  `).join('');
  
  // Add event listeners
  list.querySelectorAll('.color-sequence-color').forEach(input => {
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      const colors = [...currentSettings.svg.colorSequence.colors];
      colors[index] = e.target.value;
      updateSettings({
        svg: {
          ...currentSettings.svg,
          colorSequence: {
            ...currentSettings.svg.colorSequence,
            colors: colors
          }
        }
      });
      renderColorSequence();
    });
  });
  
  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      const colors = [...currentSettings.svg.colorSequence.colors];
      colors.splice(index, 1);
      updateSettings({
        svg: {
          ...currentSettings.svg,
          colorSequence: {
            ...currentSettings.svg.colorSequence,
            colors: colors
          }
        }
      });
      renderColorSequence();
    });
  });
}

function escapePresetOptionLabel(name) {
  return String(name)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function populatePresetSelect() {
  const sel = document.getElementById('preset-select');
  if (!sel || !imageLayerDoc.presets.length) return;
  sel.innerHTML = imageLayerDoc.presets
    .map((p) => {
      const vid = String(p.id).replace(/"/g, '&quot;');
      return `<option value="${vid}">${escapePresetOptionLabel(p.name)}</option>`;
    })
    .join('');
  if (imageLayerDoc.presets.some((p) => p.id === imageLayerDoc.activePresetId)) {
    sel.value = imageLayerDoc.activePresetId;
  } else {
    sel.value = imageLayerDoc.presets[0].id;
  }
}

function setupPresetControlListeners() {
  const presetSelect = document.getElementById('preset-select');
  if (presetSelect) {
    presetSelect.addEventListener('change', onPresetSelectChange);
  }

  const saveBtn = document.getElementById('preset-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!viewerChannel) return;
      pendingStateIntent = 'save';
      viewerChannel.postMessage({ type: 'IMAGE_LAYER_REQUEST_STATE', data: {} });
    });
  }

  const saveAsBtn = document.getElementById('preset-save-as-btn');
  if (saveAsBtn) {
    saveAsBtn.addEventListener('click', () => {
      if (!viewerChannel) return;
      pendingStateIntent = 'saveAs';
      viewerChannel.postMessage({ type: 'IMAGE_LAYER_REQUEST_STATE', data: {} });
    });
  }

  const renameBtn = document.getElementById('preset-rename-btn');
  if (renameBtn) {
    renameBtn.addEventListener('click', () => {
      const preset = getActivePreset(imageLayerDoc);
      if (!preset) return;
      const name = window.prompt('Logo name', preset.name);
      if (name === null) return;
      preset.name = name.trim() || preset.name;
      void saveImageLayerDocument(imageLayerDoc);
      populatePresetSelect();
    });
  }

  const deleteBtn = document.getElementById('preset-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (imageLayerDoc.presets.length <= 1) {
        window.alert('Keep at least one logo preset.');
        return;
      }
      if (!window.confirm('Delete this logo preset?')) return;
      const id = imageLayerDoc.activePresetId;
      const idx = imageLayerDoc.presets.findIndex((p) => p.id === id);
      if (idx === -1) return;
      imageLayerDoc.presets.splice(idx, 1);
      const next = imageLayerDoc.presets[0];
      imageLayerDoc.activePresetId = next.id;
      await saveImageLayerDocument(imageLayerDoc);
      mergePortableIntoCurrentSettings(presetToFlatSettings(next));
      syncUIWithSettings();
      updateModeDisplay();
      setTimeout(() => renderColorSequence(), 50);
      populatePresetSelect();
      if (viewerChannel) {
        viewerChannel.postMessage({
          type: 'IMAGE_LAYER_APPLY_PRESET',
          data: {
            settings: presetToFlatSettings(next),
            activePresetId: next.id,
            skipPortableSave: true,
          },
        });
      }
    });
  }
}

async function onPresetSelectChange(e) {
  const id = e.target.value;
  const preset = imageLayerDoc.presets.find((p) => p.id === id);
  if (!preset) return;
  imageLayerDoc.activePresetId = id;
  await saveImageLayerDocument(imageLayerDoc);
  mergePortableIntoCurrentSettings(presetToFlatSettings(preset));
  syncUIWithSettings();
  updateModeDisplay();
  setTimeout(() => renderColorSequence(), 50);
  if (viewerChannel) {
    viewerChannel.postMessage({
      type: 'IMAGE_LAYER_APPLY_PRESET',
      data: {
        settings: presetToFlatSettings(preset),
        activePresetId: id,
        skipPortableSave: true,
      },
    });
  }
}

/**
 * @param {{ state?: object, activePresetId?: string }|null|undefined} payload
 */
export function onViewerStateResponse(payload) {
  if (!payload?.state) {
    pendingStateIntent = null;
    return;
  }
  const { state, activePresetId: viewerActiveId } = payload;
  const intent = pendingStateIntent;
  pendingStateIntent = null;

  if (intent === 'save') {
    const targetId = viewerActiveId || imageLayerDoc.activePresetId;
    if (!targetId) return;
    upsertPresetDataFromFlat(imageLayerDoc, targetId, state);
    imageLayerDoc.activePresetId = targetId;
    void saveImageLayerDocument(imageLayerDoc);
    mergePortableIntoCurrentSettings(state);
    populatePresetSelect();
    return;
  }

  if (intent === 'saveAs') {
    const name = window.prompt('Name for new logo', 'New logo');
    if (name === null) return;
    const newId = generatePresetId();
    const preset = {
      id: newId,
      name: name.trim() || 'Untitled',
      mode: state.mode === 'svg' ? 'svg' : 'raster',
      imageData: state.imageData ?? null,
      width: typeof state.width === 'number' ? state.width : 400,
      visibility: state.visibility !== false,
      offsetX: typeof state.offsetX === 'number' ? state.offsetX : 0,
      offsetY: typeof state.offsetY === 'number' ? state.offsetY : 0,
      raster:
        state.raster && typeof state.raster === 'object'
          ? JSON.parse(JSON.stringify(state.raster))
          : { ...currentSettings.raster },
      svg:
        state.svg && typeof state.svg === 'object'
          ? JSON.parse(JSON.stringify(state.svg))
          : { ...currentSettings.svg },
      dropShadow:
        state.dropShadow && typeof state.dropShadow === 'object'
          ? JSON.parse(JSON.stringify(state.dropShadow))
          : { ...currentSettings.dropShadow },
    };
    imageLayerDoc.presets.push(preset);
    imageLayerDoc.activePresetId = newId;
    void saveImageLayerDocument(imageLayerDoc);
    mergePortableIntoCurrentSettings(presetToFlatSettings(preset));
    syncUIWithSettings();
    updateModeDisplay();
    setTimeout(() => renderColorSequence(), 50);
    populatePresetSelect();
    if (viewerChannel) {
      viewerChannel.postMessage({
        type: 'IMAGE_LAYER_APPLY_PRESET',
        data: {
          settings: state,
          activePresetId: newId,
          skipPortableSave: true,
        },
      });
    }
  }
}
