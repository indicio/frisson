import { useEffect, useRef, useState } from 'react';
import { CopyPlus, Pencil, Save, Trash2 } from 'lucide-react';
import {
  emptyImageLayerDoc,
  generatePresetId,
  getActivePreset,
  presetToFlatSettings,
  upsertPresetDataFromFlat,
} from '../../shared/imageLayerDoc.js';
import { loadImageLayerPortable, saveImageLayerDocument } from '../../shared/portableStorage.js';
import { postToViewer, subscribeViewer } from './bridge/viewerBridge.js';
import { CheckControl, ColorControl, RangeControl, SelectControl } from './controls/kit.jsx';

const BLEND_MODES = [
  ['normal', 'Normal'],
  ['multiply', 'Multiply'],
  ['screen', 'Screen'],
  ['overlay', 'Overlay'],
  ['difference', 'Difference'],
  ['exclusion', 'Exclusion'],
  ['color-dodge', 'Color Dodge'],
  ['color-burn', 'Color Burn'],
  ['hard-light', 'Hard Light'],
  ['soft-light', 'Soft Light'],
];

function defaultSettings() {
  return {
    mode: 'raster',
    width: 400,
    visibility: true,
    offsetX: 0,
    offsetY: 0,
    raster: { scaleSensitivity: 0.5, baseOpacity: 1, maxExpansion: 2 },
    svg: {
      scale: 1,
      fillColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 0,
      colorSequence: {
        enabled: false,
        colors: ['#ff00ff', '#00ffff', '#ffffff'],
        cycleSpeed: 1,
        transitionRate: 0.5,
        audioReactive: false,
        blendMode: 'normal',
      },
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
}

function mergeFlat(current, data) {
  if (!data || typeof data !== 'object') return current;
  const next = { ...current };
  if (typeof data.offsetX === 'number') next.offsetX = data.offsetX;
  if (typeof data.offsetY === 'number') next.offsetY = data.offsetY;
  if (typeof data.width === 'number') next.width = data.width;
  if (typeof data.visibility === 'boolean') next.visibility = data.visibility;
  if (data.mode === 'raster' || data.mode === 'svg') next.mode = data.mode;
  if (data.raster && typeof data.raster === 'object') next.raster = { ...current.raster, ...data.raster };
  if (data.svg && typeof data.svg === 'object') {
    next.svg = {
      ...current.svg,
      ...data.svg,
      colorSequence: data.svg.colorSequence
        ? { ...current.svg.colorSequence, ...data.svg.colorSequence }
        : current.svg.colorSequence,
    };
  }
  if (data.dropShadow && typeof data.dropShadow === 'object') {
    next.dropShadow = { ...current.dropShadow, ...data.dropShadow };
  }
  return next;
}

function formatNumber(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : String(value);
}

function imagePayload(imageData) {
  if (!imageData || typeof imageData.data !== 'string') return null;
  const data = imageData.data.trim();
  if (!data) return null;
  if (data.startsWith('data:image/svg+xml')) {
    const comma = data.indexOf(',');
    if (comma < 0) return null;
    const meta = data.slice(0, comma);
    const body = data.slice(comma + 1);
    try {
      const text = meta.includes(';base64') ? atob(body) : decodeURIComponent(body);
      return { kind: 'svg', text };
    } catch {
      return { kind: 'url', url: data };
    }
  }
  if (data.startsWith('<') || data.startsWith('<?xml')) return { kind: 'svg', text: data };
  if (data.startsWith('data:')) return { kind: 'url', url: data };
  return null;
}

function tintedSvg(svgText, fill) {
  if (typeof DOMParser === 'undefined') return svgText;
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (!svg || svg.localName !== 'svg') return null;
  svg.querySelectorAll('script, foreignObject').forEach((node) => node.remove());
  if (fill) {
    svg.querySelectorAll('path, circle, rect, ellipse, polygon, polyline, line, text, tspan').forEach((el) => {
      if (el.closest('defs')) return;
      el.style.setProperty('fill', fill);
      el.removeAttribute('stroke');
      el.removeAttribute('stroke-width');
    });
  }
  return new XMLSerializer().serializeToString(svg);
}

function previewSrc(imageData, settings) {
  const payload = imagePayload(imageData);
  if (!payload) return '';
  if (payload.kind === 'url') return payload.url;
  const fill = settings.mode === 'svg' && !settings.svg?.colorSequence?.enabled
    ? (settings.svg?.fillColor || '#ffffff')
    : '';
  const markup = tintedSvg(payload.text, fill);
  if (!markup) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function previewShadow(settings) {
  const shadow = settings.dropShadow;
  if (!shadow?.enabled) return 'none';
  const scale = 0.4;
  const ox = Math.round((Number(shadow.offsetX) || 0) * scale);
  const oy = Math.round((Number(shadow.offsetY) || 0) * scale);
  const blur = Math.max(0, Math.round((Number(shadow.blur) || 0) * scale));
  const hex = String(shadow.color || '#000000').trim();
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const opacity = Number.isFinite(Number(shadow.opacity)) ? Number(shadow.opacity) : 0.35;
  const color = match
    ? `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${opacity})`
    : `rgba(0,0,0,${opacity})`;
  return `drop-shadow(${ox}px ${oy}px ${blur}px ${color})`;
}

export function ImageLayerPanel({ open, onClose }) {
  const settingsRef = useRef(defaultSettings());
  const docRef = useRef(emptyImageLayerDoc());
  const pendingIntent = useRef(null);
  const previewStamp = useRef(0);
  const [settings, setSettings] = useState(settingsRef.current);
  const [doc, setDoc] = useState(docRef.current);
  const [svgCode, setSvgCode] = useState('');
  const [draftColor, setDraftColor] = useState('#ff00ff');
  const [imageData, setImageData] = useState(null);

  function showImage(next) {
    previewStamp.current += 1;
    setImageData(next && typeof next.data === 'string' && next.data.trim() ? next : null);
  }

  function adopt(next) {
    settingsRef.current = next;
    setSettings(next);
  }

  function commit(partial) {
    const current = settingsRef.current;
    const merged = { ...current, ...partial };
    if (partial.raster) merged.raster = { ...current.raster, ...partial.raster };
    if (partial.svg) {
      merged.svg = {
        ...current.svg,
        ...partial.svg,
        colorSequence: partial.svg.colorSequence
          ? { ...current.svg.colorSequence, ...partial.svg.colorSequence }
          : current.svg.colorSequence,
      };
    }
    if (partial.dropShadow) merged.dropShadow = { ...current.dropShadow, ...partial.dropShadow };
    adopt(merged);
    postToViewer('IMAGE_LAYER_UPDATE', { settings: merged });
  }

  function applyPreset(preset, { skipPortableSave = true } = {}) {
    const flat = presetToFlatSettings(preset);
    adopt(mergeFlat(settingsRef.current, flat));
    showImage(preset.imageData);
    postToViewer('IMAGE_LAYER_APPLY_PRESET', {
      settings: flat,
      activePresetId: preset.id,
      skipPortableSave,
    });
  }

  function rememberDoc(next) {
    docRef.current = next;
    setDoc(next);
  }

  useEffect(() => {
    let cancelled = false;
    const stamp = previewStamp.current;
    loadImageLayerPortable().then((loaded) => {
      if (cancelled) return;
      const next = loaded || emptyImageLayerDoc();
      rememberDoc(next);
      const active = getActivePreset(next);
      if (!active) return;
      adopt(mergeFlat(settingsRef.current, presetToFlatSettings(active)));
      if (previewStamp.current === stamp) showImage(active.imageData);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const stamp = previewStamp.current;
    loadImageLayerPortable().then((fresh) => {
      if (cancelled || !fresh) return;
      rememberDoc(fresh);
      const active = getActivePreset(fresh);
      if (!active) return;
      adopt(mergeFlat(settingsRef.current, presetToFlatSettings(active)));
      if (previewStamp.current === stamp) showImage(active.imageData);
    });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => subscribeViewer((message) => {
    if (message?.type === 'IMAGE_LAYER_UPDATE' && typeof message.data?.settings?.visibility === 'boolean') {
      adopt(mergeFlat(settingsRef.current, { visibility: message.data.settings.visibility }));
    }
    if (message?.type === 'IMAGE_LAYER_VISIBILITY_CHANGED' && typeof message.data?.visible === 'boolean') {
      adopt(mergeFlat(settingsRef.current, { visibility: message.data.visible }));
    }
    if (message?.type !== 'IMAGE_LAYER_STATE_RESPONSE') return;
    const payload = message.data;
    const intent = pendingIntent.current;
    pendingIntent.current = null;
    if (!payload?.state) return;
    const { state, activePresetId: viewerActiveId } = payload;
    const imageDoc = docRef.current;

    if (intent === 'save') {
      showImage(state.imageData);
      const targetId = viewerActiveId || imageDoc.activePresetId;
      if (!targetId) return;
      upsertPresetDataFromFlat(imageDoc, targetId, state);
      imageDoc.activePresetId = targetId;
      rememberDoc({ ...imageDoc, presets: [...imageDoc.presets] });
      void saveImageLayerDocument(imageDoc);
      adopt(mergeFlat(settingsRef.current, state));
      return;
    }

    if (intent === 'saveAs') {
      showImage(state.imageData);
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
        raster: state.raster && typeof state.raster === 'object'
          ? structuredClone(state.raster)
          : { ...settingsRef.current.raster },
        svg: state.svg && typeof state.svg === 'object'
          ? structuredClone(state.svg)
          : { ...settingsRef.current.svg },
        dropShadow: state.dropShadow && typeof state.dropShadow === 'object'
          ? structuredClone(state.dropShadow)
          : { ...settingsRef.current.dropShadow },
      };
      imageDoc.presets.push(preset);
      imageDoc.activePresetId = newId;
      rememberDoc({ ...imageDoc, presets: [...imageDoc.presets] });
      void saveImageLayerDocument(imageDoc);
      adopt(mergeFlat(settingsRef.current, presetToFlatSettings(preset)));
      postToViewer('IMAGE_LAYER_APPLY_PRESET', {
        settings: state,
        activePresetId: newId,
        skipPortableSave: true,
      });
    }
  }), []);

  async function onFile(file) {
    if (!file) return;
    const data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) reader.readAsText(file);
      else reader.readAsDataURL(file);
    });
    const text = typeof data === 'string' ? data.trim() : '';
    const svgMarkup = text.startsWith('<') || text.startsWith('<?xml');
    showImage({
      type: svgMarkup ? 'svg-code' : 'file',
      data: typeof data === 'string' ? data : '',
      filename: file.name,
    });
    postToViewer('IMAGE_LAYER_LOAD_FILE', { file: { name: file.name, type: file.type, data } });
  }

  async function selectPreset(id) {
    const preset = docRef.current.presets.find((entry) => entry.id === id);
    if (!preset) return;
    docRef.current.activePresetId = id;
    rememberDoc({ ...docRef.current, presets: [...docRef.current.presets] });
    await saveImageLayerDocument(docRef.current);
    applyPreset(preset);
  }

  function renamePreset() {
    const preset = getActivePreset(docRef.current);
    if (!preset) return;
    const name = window.prompt('Logo name', preset.name);
    if (name === null) return;
    preset.name = name.trim() || preset.name;
    rememberDoc({ ...docRef.current, presets: [...docRef.current.presets] });
    void saveImageLayerDocument(docRef.current);
  }

  async function deletePreset() {
    const imageDoc = docRef.current;
    if (imageDoc.presets.length <= 1) {
      window.alert('Keep at least one logo preset.');
      return;
    }
    if (!window.confirm('Delete this logo preset?')) return;
    const index = imageDoc.presets.findIndex((entry) => entry.id === imageDoc.activePresetId);
    if (index < 0) return;
    imageDoc.presets.splice(index, 1);
    const next = imageDoc.presets[0];
    imageDoc.activePresetId = next.id;
    rememberDoc({ ...imageDoc, presets: [...imageDoc.presets] });
    await saveImageLayerDocument(imageDoc);
    applyPreset(next);
  }

  const sequence = settings.svg.colorSequence;
  const activeId = doc.presets.some((preset) => preset.id === doc.activePresetId)
    ? doc.activePresetId
    : doc.presets[0]?.id;
  const currentPreview = previewSrc(imageData, settings);

  return (
    <div className={`image-layer-modal${open ? ' open' : ''}`} id="image-layer-modal" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="image-layer-modal-content">
        <div className="image-layer-modal-header">
          <h3>Image Layer</h3>
          <button type="button" className="image-layer-modal-close" id="image-layer-modal-close" title="Close" onClick={onClose}>×</button>
        </div>
        <div className="image-layer-modal-body" id="image-layer-modal-body">
          <div className="image-layer-controls image-layer-controls--cols frisson-controls">
            <div className="image-layer-col image-layer-presets">
              <h3>Logos</h3>
              <p className="image-layer-hint">Pick a saved logo. Save writes the viewer’s current state into the active preset.</p>
              <div className="control-item">
                <label className="control-label" htmlFor="preset-select">Active logo</label>
                <select id="preset-select" className="filter-select" value={activeId || ''} onChange={(event) => selectPreset(event.target.value)}>
                  {doc.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </select>
              </div>
              <div className="control-item preset-actions preset-actions--row" role="toolbar" aria-label="Logo preset actions">
                <button type="button" className="btn secondary btn-icon-label" title="Save viewer state to this preset" onClick={() => { pendingIntent.current = 'save'; postToViewer('IMAGE_LAYER_REQUEST_STATE', {}); }}>
                  <Save className="lucide-icon" strokeWidth={1.75} aria-hidden /><span>Save</span>
                </button>
                <button type="button" className="btn secondary btn-icon-label" title="Save as a new preset" onClick={() => { pendingIntent.current = 'saveAs'; postToViewer('IMAGE_LAYER_REQUEST_STATE', {}); }}>
                  <CopyPlus className="lucide-icon" strokeWidth={1.75} aria-hidden /><span>Save as</span>
                </button>
                <button type="button" className="btn secondary btn-icon-label" title="Rename this preset" onClick={renamePreset}>
                  <Pencil className="lucide-icon" strokeWidth={1.75} aria-hidden /><span>Rename</span>
                </button>
                <button type="button" className="btn secondary btn-icon-label" title="Delete this preset" onClick={deletePreset}>
                  <Trash2 className="lucide-icon" strokeWidth={1.75} aria-hidden /><span>Delete</span>
                </button>
              </div>
              <div className="image-layer-preview">
                {currentPreview
                  ? <img src={currentPreview} alt="Current logo" style={{ filter: previewShadow(settings) }} />
                  : <p className="image-layer-hint">No image loaded.</p>}
              </div>
            </div>

            <div className="image-layer-col image-layer-col--source">
              <div className="control-group image-layer-mode-group">
                <h3>Logo source & mode</h3>
                <p className="image-layer-hint">The source type and the controls below work together: pick a mode, then set options for that mode.</p>
                <SelectControl
                  label="Source type"
                  value={settings.mode}
                  options={[
                    { value: 'raster', label: 'Raster image (PNG / JPG / SVG file)' },
                    { value: 'svg', label: 'Inline SVG' },
                  ]}
                  onChange={(mode) => commit({ mode })}
                />
                <div className="image-layer-mode-panels">
                  {settings.mode === 'raster' ? (
                    <div className="control-group mode-controls image-layer-mode-panel" id="raster-controls">
                      <h4 className="image-layer-subheading">Raster image</h4>
                      <p className="image-layer-hint image-layer-hint--sub">Upload and tune a bitmap or SVG loaded as a file.</p>
                      <div className="control-item">
                        <label className="control-label">Upload File (PNG, JPG, SVG)</label>
                        <input type="file" accept="image/png,image/jpeg,image/svg+xml,.svg" onChange={(event) => onFile(event.target.files?.[0])} />
                      </div>
                      <RangeControl label="Scale Sensitivity" min="0" max="2" step="0.1" value={settings.raster.scaleSensitivity} onChange={(value) => commit({ raster: { scaleSensitivity: parseFloat(value) } })} />
                      <RangeControl label="Base Opacity" min="0" max="1" step="0.05" value={settings.raster.baseOpacity} onChange={(value) => commit({ raster: { baseOpacity: parseFloat(value) } })} />
                      <RangeControl label="Max Expansion Limit" min="1" max="5" step="0.1" suffix="x" value={settings.raster.maxExpansion} onChange={(value) => commit({ raster: { maxExpansion: parseFloat(value) } })} />
                    </div>
                  ) : (
                    <div className="control-group mode-controls image-layer-mode-panel" id="svg-controls">
                      <h4 className="image-layer-subheading">Inline SVG</h4>
                      <p className="image-layer-hint image-layer-hint--sub">Paste SVG markup and configure fill and color behavior.</p>
                      <div className="control-item">
                        <label className="control-label">Paste SVG Code</label>
                        <textarea rows={5} placeholder="Paste SVG code here..." value={svgCode} onChange={(event) => setSvgCode(event.target.value)} />
                        <button type="button" className="btn primary" style={{ marginTop: '0.5rem' }} onClick={() => {
                          if (!svgCode.trim()) return;
                          showImage({ type: 'svg-code', data: svgCode });
                          postToViewer('IMAGE_LAYER_LOAD_SVG', { svgCode });
                        }}>Load SVG</button>
                      </div>
                      <RangeControl label="Scale" min="0.1" max="5" step="0.1" value={settings.svg.scale} onChange={(value) => commit({ svg: { scale: parseFloat(value) } })} />
                      <div className="control-item image-layer-choices">
                        <label className="control-label">
                          <input type="radio" name="fill-mode" checked={!sequence.enabled} onChange={() => commit({ svg: { colorSequence: { enabled: false } } })} />
                          Solid fill
                        </label>
                        <label className="control-label">
                          <input type="radio" name="fill-mode" checked={sequence.enabled} onChange={() => commit({ svg: { colorSequence: { enabled: true } } })} />
                          Color sequence
                        </label>
                      </div>
                      {sequence.enabled ? (
                        <div id="color-sequence-controls">
                          <div className="color-sequence-list">
                            {sequence.colors.length === 0 ? (
                              <div style={{ color: 'var(--text-secondary, #aaa)', fontSize: '0.875rem', padding: '0.5rem' }}>No colors added. Add colors to create a sequence.</div>
                            ) : sequence.colors.map((color, index) => (
                              <div key={`${color}-${index}`} className="color-sequence-item">
                                <input type="color" value={color} onChange={(event) => {
                                  const colors = sequence.colors.map((entry, colorIndex) => colorIndex === index ? event.target.value : entry);
                                  commit({ svg: { colorSequence: { colors } } });
                                }} style={{ width: 40, height: 40, border: 'none', borderRadius: 4 }} />
                                <div style={{ flex: 1 }}>
                                  <span style={{ display: 'block' }}>{color}</span>
                                  <span style={{ color: 'var(--text-secondary, #aaa)', fontSize: '0.75rem' }}>Step {index + 1}</span>
                                </div>
                                <button type="button" className="btn secondary" onClick={() => {
                                  const colors = sequence.colors.filter((_, colorIndex) => colorIndex !== index);
                                  commit({ svg: { colorSequence: { colors } } });
                                }}>Remove</button>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <input type="color" value={draftColor} onChange={(event) => setDraftColor(event.target.value)} />
                            <button type="button" className="btn secondary" onClick={() => commit({ svg: { colorSequence: { colors: [...sequence.colors, draftColor] } } })}>Add Color</button>
                          </div>
                          <RangeControl label="Cycle Speed" min="0" max="5" step="0.1" value={formatNumber(sequence.cycleSpeed)} onChange={(value) => commit({ svg: { colorSequence: { cycleSpeed: parseFloat(value) } } })} />
                          <RangeControl label="Transition Rate" min="0" max="3" step="0.1" suffix="s" value={formatNumber(sequence.transitionRate)} onChange={(value) => commit({ svg: { colorSequence: { transitionRate: parseFloat(value) } } })} />
                          <CheckControl label="Audio-Reactive Cycling" checked={sequence.audioReactive} onChange={(audioReactive) => commit({ svg: { colorSequence: { audioReactive } } })} />
                          <SelectControl label="Blend Mode" value={sequence.blendMode} options={BLEND_MODES.map(([value, label]) => ({ value, label }))} onChange={(blendMode) => commit({ svg: { colorSequence: { blendMode } } })} />
                        </div>
                      ) : (
                        <ColorControl label="Fill color" value={settings.svg.fillColor} onChange={(fillColor) => commit({ svg: { fillColor } })} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="image-layer-col image-layer-col--placement">
              <div className="control-group">
                <h3>Size</h3>
                <p className="image-layer-hint">Width and visibility apply to either source.</p>
                <RangeControl label="Image Width" min="50" max="2000" step="10" suffix="px" value={settings.width} onChange={(value) => commit({ width: parseInt(value, 10) })} />
                <div className="control-item image-layer-inline">
                  <CheckControl label="Visible" checked={settings.visibility} onChange={(visibility) => commit({ visibility })} />
                  <button type="button" className="btn secondary" onClick={() => { showImage(null); postToViewer('IMAGE_LAYER_CLEAR', {}); }}>Clear Image</button>
                </div>
              </div>
              <div className="control-group">
                <h3>Logo position</h3>
                <p className="image-layer-hint">Pixel offset from center; (0, 0) is centered on screen.</p>
                <RangeControl label="Offset X" min="-800" max="800" step="1" suffix="px" value={settings.offsetX} onChange={(value) => commit({ offsetX: parseInt(value, 10) })} />
                <RangeControl label="Offset Y" min="-800" max="800" step="1" suffix="px" value={settings.offsetY} onChange={(value) => commit({ offsetY: parseInt(value, 10) })} />
                <button type="button" className="btn secondary" onClick={() => commit({ offsetX: 0, offsetY: 0 })}>Reset position</button>
              </div>
              <div className="control-group">
                <h3>Drop shadow</h3>
                <CheckControl label="Enabled" checked={settings.dropShadow.enabled} onChange={(enabled) => commit({ dropShadow: { enabled } })} />
                {settings.dropShadow.enabled ? (
                  <div className="drop-shadow-detail">
                    <RangeControl label="Offset X" min="-48" max="48" step="1" suffix="px" value={settings.dropShadow.offsetX} onChange={(value) => commit({ dropShadow: { offsetX: parseInt(value, 10) } })} />
                    <RangeControl label="Offset Y" min="-48" max="48" step="1" suffix="px" value={settings.dropShadow.offsetY} onChange={(value) => commit({ dropShadow: { offsetY: parseInt(value, 10) } })} />
                    <RangeControl label="Blur" min="0" max="80" step="1" suffix="px" value={settings.dropShadow.blur} onChange={(value) => commit({ dropShadow: { blur: parseInt(value, 10) } })} />
                    <ColorControl label="Color" value={settings.dropShadow.color} onChange={(color) => commit({ dropShadow: { color } })} />
                    <RangeControl label="Opacity" min="0" max="1" step="0.05" value={settings.dropShadow.opacity} onChange={(value) => commit({ dropShadow: { opacity: parseFloat(value) } })} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
