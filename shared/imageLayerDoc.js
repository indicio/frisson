/**
 * Image layer file format (data/image-layer/image-layer.json)
 * v2: multiple presets; v1: single flat blob (migrated to one "Default" preset).
 */

const DEFAULT_RASTER = {
  scaleSensitivity: 0.5,
  baseOpacity: 1.0,
  maxExpansion: 2.0,
};

const DEFAULT_SVG = {
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
    blendMode: 'normal',
  },
};

const DEFAULT_DROP_SHADOW = {
  enabled: false,
  offsetX: 0,
  offsetY: 6,
  blur: 14,
  color: '#000000',
  opacity: 0.35,
};

function defaultPresetBody() {
  return {
    mode: 'raster',
    imageData: null,
    width: 400,
    visibility: true,
    offsetX: 0,
    offsetY: 0,
    dropShadow: { ...DEFAULT_DROP_SHADOW },
    raster: { ...DEFAULT_RASTER },
    svg: {
      ...DEFAULT_SVG,
      colorSequence: { ...DEFAULT_SVG.colorSequence },
    },
  };
}

export function emptyImageLayerDoc() {
  return {
    version: 2,
    activePresetId: 'default',
    presets: [
      {
        id: 'default',
        name: 'Default',
        ...defaultPresetBody(),
      },
    ],
  };
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {boolean}
 */
function looksLikeV1Flat(raw) {
  if (raw.version === 2 || Array.isArray(raw.presets)) return false;
  return (
    'width' in raw ||
    'imageData' in raw ||
    'mode' in raw ||
    'raster' in raw ||
    'svg' in raw ||
    'offsetX' in raw
  );
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof emptyImageLayerDoc>}
 */
export function normalizeImageLayerDoc(raw) {
  if (!raw || typeof raw !== 'object') {
    return emptyImageLayerDoc();
  }

  const o = /** @type {Record<string, unknown>} */ (raw);

  if (o.version === 2 && Array.isArray(o.presets) && o.presets.length > 0) {
    const presets = o.presets.map((p) => normalizePresetEntry(p));
    const ids = new Set(presets.map((p) => p.id));
    let active =
      typeof o.activePresetId === 'string' && ids.has(o.activePresetId)
        ? o.activePresetId
        : presets[0].id;
    return { version: 2, activePresetId: active, presets };
  }

  if (looksLikeV1Flat(o)) {
    const body = defaultPresetBody();
    if (o.mode === 'raster' || o.mode === 'svg') body.mode = o.mode;
    if (o.imageData != null) body.imageData = o.imageData;
    if (typeof o.width === 'number') body.width = o.width;
    if (typeof o.visibility === 'boolean') body.visibility = o.visibility;
    if (typeof o.offsetX === 'number') body.offsetX = o.offsetX;
    if (typeof o.offsetY === 'number') body.offsetY = o.offsetY;
    if (o.raster && typeof o.raster === 'object') {
      body.raster = { ...body.raster, ...o.raster };
    }
    if (o.svg && typeof o.svg === 'object') {
      const s = /** @type {Record<string, unknown>} */ (o.svg);
      body.svg = {
        ...body.svg,
        ...s,
        colorSequence:
          s.colorSequence && typeof s.colorSequence === 'object'
            ? { ...body.svg.colorSequence, ...s.colorSequence }
            : body.svg.colorSequence,
      };
    }
    return {
      version: 2,
      activePresetId: 'default',
      presets: [{ id: 'default', name: 'Default', ...body }],
    };
  }

  return emptyImageLayerDoc();
}

/**
 * @param {unknown} p
 */
function normalizePresetEntry(p) {
  const base = defaultPresetBody();
  if (!p || typeof p !== 'object') {
    return { id: 'default', name: 'Default', ...base };
  }
  const o = /** @type {Record<string, unknown>} */ (p);
  const id = typeof o.id === 'string' && o.id ? o.id : 'default';
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : id;
  const body = { ...base };
  if (o.mode === 'raster' || o.mode === 'svg') body.mode = o.mode;
  if ('imageData' in o) body.imageData = o.imageData;
  if (typeof o.width === 'number') body.width = o.width;
  if (typeof o.visibility === 'boolean') body.visibility = o.visibility;
  if (typeof o.offsetX === 'number') body.offsetX = o.offsetX;
  if (typeof o.offsetY === 'number') body.offsetY = o.offsetY;
  if (o.raster && typeof o.raster === 'object') {
    body.raster = { ...body.raster, ...o.raster };
  }
  if (o.svg && typeof o.svg === 'object') {
    const s = /** @type {Record<string, unknown>} */ (o.svg);
    body.svg = {
      ...body.svg,
      ...s,
      colorSequence:
        s.colorSequence && typeof s.colorSequence === 'object'
          ? { ...body.svg.colorSequence, ...s.colorSequence }
          : body.svg.colorSequence,
    };
  }
  if (o.dropShadow && typeof o.dropShadow === 'object') {
    const d = /** @type {Record<string, unknown>} */ (o.dropShadow);
    body.dropShadow = {
      ...body.dropShadow,
      ...d,
    };
  }
  return { id, name, ...body };
}

/**
 * @param {ReturnType<typeof emptyImageLayerDoc>} doc
 */
export function getActivePreset(doc) {
  if (!doc.presets.length) return null;
  const id = doc.activePresetId;
  return doc.presets.find((p) => p.id === id) || doc.presets[0];
}

/**
 * Settings merge payload (no id/name)
 * @param {{ id: string, name: string } & Record<string, unknown>} preset
 */
export function presetToFlatSettings(preset) {
  const { id, name, ...rest } = preset;
  return rest;
}

/**
 * @param {ReturnType<typeof emptyImageLayerDoc>} doc
 * @param {string} presetId
 * @param {Record<string, unknown>} flat
 */
export function upsertPresetDataFromFlat(doc, presetId, flat) {
  const idx = doc.presets.findIndex((p) => p.id === presetId);
  if (idx === -1) return doc;
  const prev = doc.presets[idx];
  const { id, name } = prev;
  doc.presets[idx] = {
    id,
    name,
    mode: flat.mode === 'svg' ? 'svg' : 'raster',
    imageData: 'imageData' in flat ? flat.imageData : null,
    width: typeof flat.width === 'number' ? flat.width : prev.width,
    visibility: typeof flat.visibility === 'boolean' ? flat.visibility : prev.visibility,
    offsetX: typeof flat.offsetX === 'number' ? flat.offsetX : prev.offsetX ?? 0,
    offsetY: typeof flat.offsetY === 'number' ? flat.offsetY : prev.offsetY ?? 0,
    raster:
      flat.raster && typeof flat.raster === 'object'
        ? { ...prev.raster, ...flat.raster }
        : prev.raster,
    svg:
      flat.svg && typeof flat.svg === 'object'
        ? {
            ...prev.svg,
            ...flat.svg,
            colorSequence:
              flat.svg.colorSequence && typeof flat.svg.colorSequence === 'object'
                ? { ...prev.svg.colorSequence, ...flat.svg.colorSequence }
                : prev.svg.colorSequence,
          }
        : prev.svg,
    dropShadow: (() => {
      const baseDs =
        prev.dropShadow && typeof prev.dropShadow === 'object'
          ? prev.dropShadow
          : { ...DEFAULT_DROP_SHADOW };
      return flat.dropShadow && typeof flat.dropShadow === 'object'
        ? { ...baseDs, ...flat.dropShadow }
        : baseDs;
    })(),
  };
  return doc;
}

export function generatePresetId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `logo-${crypto.randomUUID()}`;
  }
  return `logo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
