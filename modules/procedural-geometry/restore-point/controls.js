import { Favorites } from '../../shared/favorites.js';
import {
  DEFORM_TYPES,
  DESTINATIONS,
  PRESETS,
  SHAPES,
  SOURCES,
  cloneState,
  defaultDeform,
  defaultRoute,
  presetById,
  sanitizeState,
} from './engine.js';

const MODULE_ID = 'procedural-geometry';
let controlsChannel = null;
let state = sanitizeState(presetById('vortex-tunnel').state);
let selectedDeform = 0;
let selectedRoute = 0;
let applying = false;

function pathGet(object, path) {
  return path.split('.').reduce((current, key) => current?.[key], object);
}

function pathSet(object, path, value) {
  const keys = path.split('.');
  let current = object;
  for (let i = 0; i < keys.length - 1; i += 1) current = current[keys[i]];
  current[keys[keys.length - 1]] = value;
}

function send() {
  if (applying) return;
  const payload = { type: 'PARAM_CHANGE', param: 'state', value: cloneState(state) };
  controlsChannel?.postMessage(payload);
  if (window.parent && window.parent !== window) window.parent.postMessage(payload, '*');
}

function markCustom() {
  state.presetId = null;
  const preset = document.getElementById('preset');
  if (preset) preset.value = '';
}

const WAVE_SHAPE = {
  sine: 'sine',
  triangle: 'triangle-wave',
  saw: 'saw',
  square: 'square-wave',
  compound: 'compound',
};
const SHAPE_WAVE = Object.fromEntries(Object.entries(WAVE_SHAPE).map(([wave, shape]) => [shape, wave]));

function syncInputs() {
  applying = true;
  document.querySelectorAll('[data-path]').forEach((input) => {
    const value = pathGet(state, input.dataset.path);
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else if (value != null) input.value = value;
  });
  refreshLabels();
  const preset = document.getElementById('preset');
  if (preset) preset.value = state.presetId || '';
  const shape = SHAPES.find((item) => item.id === state.form.shape);
  const flags = new Set((shape?.show || '').split(' ').filter(Boolean));
  document.querySelectorAll('.when').forEach((node) => node.classList.toggle('on', flags.has(node.dataset.for)));
  renderProgress('width');
  renderProgress('gap');
  renderDeforms();
  renderRoutes();
  applying = false;
}

function refreshLabels() {
  document.querySelectorAll('[data-value]').forEach((node) => {
    const value = pathGet(state, node.dataset.value);
    node.textContent = typeof value === 'number' ? trim(value) : value ?? '';
  });
}

function trim(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function bindStatics() {
  document.querySelectorAll('[data-path]').forEach((input) => {
    const eventName = input.tagName === 'SELECT' || input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      if (applying) return;
      let value = input.type === 'checkbox' ? input.checked : input.value;
      if (input.type === 'range' || input.type === 'number') value = Number(value);
      pathSet(state, input.dataset.path, value);
      if (input.dataset.path === 'form.shape' && SHAPE_WAVE[value]) {
        state.form.waveType = SHAPE_WAVE[value];
        if (state.form.waveAmp < 8) state.form.waveAmp = 42;
      }
      if (input.dataset.path === 'form.waveType' && WAVE_SHAPE[value] && SHAPE_WAVE[state.form.shape]) {
        state.form.shape = WAVE_SHAPE[value];
      }
      markCustom();
      state = sanitizeState(state);
      const structural = input.tagName === 'SELECT' || input.type === 'checkbox';
      if (structural) syncInputs();
      else refreshLabels();
      send();
    });
  });
}

const CURVES = [
  ['uniform', 'Uniform'],
  ['linear', 'Linear'],
  ['triangle', 'Triangle'],
  ['sine', 'Sine'],
  ['sawtooth', 'Sawtooth'],
  ['exponential', 'Exponential'],
  ['alternating', 'Alternating'],
  ['stepped', 'Stepped'],
  ['random', 'Seeded random'],
  ['sequence', 'Custom sequence'],
];

function renderProgress(kind) {
  const host = document.getElementById(`${kind}-fields`);
  const spec = state[kind];
  host.innerHTML = `
    ${rangeField('Base', `${kind}.base`, spec.base, spec.min, spec.max, 0.5)}
    ${rangeField('Minimum', `${kind}.min`, spec.min, 0, 200, 0.5)}
    ${rangeField('Maximum', `${kind}.max`, spec.max, 1, 400, 1)}
    ${rangeField('Amplitude', `${kind}.amplitude`, spec.amplitude, 0, 200, 0.5)}
    ${rangeField('Period', `${kind}.period`, spec.period, 1, 32, 1)}
    ${rangeField('Phase', `${kind}.phase`, spec.phase, 0, 1, 0.01)}
    ${rangeField('Phase speed', `${kind}.phaseSpeed`, spec.phaseSpeed || 0, -2, 2, 0.01)}
    <div class="control-item"><label class="control-label">Curve</label><select data-spec="${kind}.curve">${labeledOptions(CURVES, spec.curve)}</select></div>
    <div class="control-item"><label class="control-label">Evaluate by</label><select data-spec="${kind}.space">${labeledOptions([['index', 'Element index'], ['spatial', 'Spatial position']], spec.space)}</select></div>
    <div class="control-item"><label class="control-label">Direction</label><select data-spec="${kind}.direction"><option value="1" ${spec.direction > 0 ? 'selected' : ''}>Forward</option><option value="-1" ${spec.direction < 0 ? 'selected' : ''}>Reverse</option></select></div>
    ${spec.curve === 'sequence' ? `<div class="control-item"><label class="control-label">Sequence</label><input data-spec="${kind}.sequence" type="text" value="${spec.sequence.join(', ')}"></div>` : ''}
    ${spec.curve === 'random' ? rangeField('Seed', `${kind}.seed`, spec.seed || 1, 1, 40, 1) : ''}
  `;
  host.querySelectorAll('[data-spec]').forEach((input) => {
    const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      const [group, key] = input.dataset.spec.split('.');
      if (key === 'sequence') state[group].sequence = input.value.split(',').map((part) => Number(part.trim())).filter((value) => Number.isFinite(value));
      else if (key === 'direction' || key === 'curve' || key === 'space') state[group][key] = key === 'direction' ? Number(input.value) : input.value;
      else state[group][key] = Number(input.value);
      markCustom();
      state = sanitizeState(state);
      send();
      if (key === 'curve') renderProgress(group);
      else {
        const label = input.parentElement?.querySelector('.value');
        if (label) label.textContent = trim(state[group][key]);
      }
    });
  });
}

function rangeField(label, spec, value, min, max, step) {
  return `<div class="control-item"><label class="control-label">${label} <span class="value">${trim(value)}</span></label><input data-spec="${spec}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}

function renderDeforms() {
  const list = document.getElementById('deform-list');
  list.innerHTML = state.deformations.map((item, index) => `
    <div class="stack-row">
      <input type="checkbox" data-deform-enabled="${index}" ${item.enabled ? 'checked' : ''}>
      <button type="button" class="name${index === selectedDeform ? ' active' : ''}" data-deform="${index}">${index + 1}. ${label(DEFORM_TYPES, item.type)}</button>
    </div>
  `).join('') || '<p class="hint">No deformation stages.</p>';
  list.querySelectorAll('[data-deform]').forEach((button) => {
    button.addEventListener('click', () => { selectedDeform = Number(button.dataset.deform); renderDeforms(); });
  });
  list.querySelectorAll('[data-deform-enabled]').forEach((input) => {
    input.addEventListener('change', () => {
      state.deformations[Number(input.dataset.deformEnabled)].enabled = input.checked;
      markCustom();
      send();
    });
  });
  const editor = document.getElementById('deform-editor');
  const stage = state.deformations[selectedDeform];
  if (!stage) { editor.innerHTML = ''; return; }
  const fields = {
    wave: ['strength', 'frequency', 'speed', 'phase', 'direction', 'wave'],
    turbulence: ['strength', 'scale', 'speed', 'octaves', 'seed'],
    twist: ['strength', 'speed', 'falloff', 'centerX', 'centerY'],
    ripple: ['strength', 'frequency', 'speed', 'falloff', 'centerX', 'centerY'],
    pinch: ['strength', 'falloff', 'centerX', 'centerY'],
    vortex: ['strength', 'speed', 'falloff', 'centerX', 'centerY'],
    shift: ['strength', 'speed', 'axis'],
    warp: ['strength', 'scale', 'speed', 'octaves', 'seed'],
  };
  const show = new Set(fields[stage.type] || fields.wave);
  const pieces = [`<div class="control-item"><label class="control-label">Type</label><select data-stage="type">${options(DEFORM_TYPES.map((item) => item.id), stage.type, DEFORM_TYPES)}</select></div>`];
  if (show.has('strength')) pieces.push(stageRange('Strength', 'strength', stage.strength, -200, 240, 1));
  if (show.has('scale')) pieces.push(stageRange('Scale', 'scale', stage.scale, 0.001, 0.08, 0.001));
  if (show.has('frequency')) pieces.push(stageRange('Frequency', 'frequency', stage.frequency, 0.1, 12, 0.1));
  if (show.has('speed')) pieces.push(stageRange('Speed', 'speed', stage.speed, -2, 3, 0.01));
  if (show.has('phase')) pieces.push(stageRange('Phase', 'phase', stage.phase, 0, 6.28, 0.01));
  if (show.has('direction')) pieces.push(stageRange('Direction', 'direction', stage.direction, 0, 360, 1));
  if (show.has('falloff')) pieces.push(stageRange('Falloff', 'falloff', stage.falloff, 20, 1200, 1));
  if (show.has('octaves')) pieces.push(stageRange('Octaves', 'octaves', stage.octaves, 1, 6, 1));
  if (show.has('seed')) pieces.push(stageRange('Seed', 'seed', stage.seed, 1, 40, 1));
  if (show.has('centerX')) pieces.push(stageRange('Center X', 'centerX', stage.centerX || 0, -600, 600, 1));
  if (show.has('centerY')) pieces.push(stageRange('Center Y', 'centerY', stage.centerY || 0, -600, 600, 1));
  if (show.has('wave')) pieces.push(`<div class="control-item"><label class="control-label">Wave</label><select data-stage="wave">${labeledOptions([['sine','Sine'],['triangle','Triangle'],['saw','Sawtooth'],['square','Square'],['compound','Compound']], stage.wave)}</select></div>`);
  if (show.has('axis')) pieces.push(`<div class="control-item"><label class="control-label">Axis</label><select data-stage="axis">${labeledOptions([['horizontal','Horizontal'],['vertical','Vertical'],['radial','Radial'],['tangential','Tangential']], stage.axis)}</select></div>`);
  editor.innerHTML = pieces.join('');
  editor.querySelectorAll('[data-stage]').forEach((input) => {
    const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      const key = input.dataset.stage;
      stage[key] = input.type === 'range' ? Number(input.value) : input.value;
      markCustom();
      send();
      const label = input.parentElement?.querySelector('.value');
      if (label) label.textContent = trim(stage[key]);
      if (key === 'type') renderDeforms();
    });
  });
}

function stageRange(label, key, value, min, max, step) {
  return `<div class="control-item"><label class="control-label">${label} <span class="value">${trim(value)}</span></label><input data-stage="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}

function renderRoutes() {
  const list = document.getElementById('route-list');
  list.innerHTML = state.routes.map((item, index) => `
    <div class="stack-row">
      <input type="checkbox" data-route-enabled="${index}" ${item.enabled ? 'checked' : ''}>
      <button type="button" class="name${index === selectedRoute ? ' active' : ''}" data-route="${index}">${label(SOURCES, item.source)} → ${label(DESTINATIONS, item.dest)}</button>
    </div>
  `).join('') || '<p class="hint">No modulation routes.</p>';
  list.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => { selectedRoute = Number(button.dataset.route); renderRoutes(); });
  });
  list.querySelectorAll('[data-route-enabled]').forEach((input) => {
    input.addEventListener('change', () => {
      state.routes[Number(input.dataset.routeEnabled)].enabled = input.checked;
      markCustom();
      send();
    });
  });
  const editor = document.getElementById('route-editor');
  const route = state.routes[selectedRoute];
  if (!route) { editor.innerHTML = ''; return; }
  editor.innerHTML = `
    <div class="control-item"><label class="control-label">Source</label><select data-route-key="source">${options(SOURCES.map((item) => item.id), route.source, SOURCES)}</select></div>
    <div class="control-item"><label class="control-label">Destination</label><select data-route-key="dest">${options(DESTINATIONS.map((item) => item.id), route.dest, DESTINATIONS)}</select></div>
    <div class="control-item"><label class="control-label">Depth <span class="value">${trim(route.depth)}</span></label><input data-route-key="depth" type="range" min="0" max="1" step="0.01" value="${route.depth}"></div>
    <div class="control-item"><label class="control-label">Curve</label><select data-route-key="curve">${options(['linear','exponential','logarithmic','stepped'], route.curve)}</select></div>
    <div class="control-item"><label class="control-label">Mode</label><select data-route-key="mode">${options(['add','multiply','replace'], route.mode)}</select></div>
    <div class="control-item"><label class="control-label">Attack <span class="value">${trim(route.attack)}</span></label><input data-route-key="attack" type="range" min="0.01" max="1" step="0.01" value="${route.attack}"></div>
    <div class="control-item"><label class="control-label">Release <span class="value">${trim(route.release)}</span></label><input data-route-key="release" type="range" min="0.01" max="1.5" step="0.01" value="${route.release}"></div>
    <div class="control-item"><label class="control-label">Input min <span class="value">${trim(route.inMin)}</span></label><input data-route-key="inMin" type="range" min="0" max="1" step="0.01" value="${route.inMin}"></div>
    <div class="control-item"><label class="control-label">Input max <span class="value">${trim(route.inMax)}</span></label><input data-route-key="inMax" type="range" min="0" max="1" step="0.01" value="${route.inMax}"></div>
    <div class="control-item"><label class="control-label">Output min</label><input data-route-key="outMin" type="number" step="0.1" value="${route.outMin}"></div>
    <div class="control-item"><label class="control-label">Output max</label><input data-route-key="outMax" type="number" step="0.1" value="${route.outMax}"></div>
    ${route.source === 'band' ? `<div class="control-item"><label class="control-label">Band low <span class="value">${trim(route.bandLow)}</span></label><input data-route-key="bandLow" type="range" min="0" max="1" step="0.01" value="${route.bandLow}"></div>
    <div class="control-item"><label class="control-label">Band high <span class="value">${trim(route.bandHigh)}</span></label><input data-route-key="bandHigh" type="range" min="0" max="1" step="0.01" value="${route.bandHigh}"></div>` : ''}
    <div class="control-item"><label class="control-label">Invert</label><input data-route-key="invert" type="checkbox" ${route.invert ? 'checked' : ''}></div>
  `;
  editor.querySelectorAll('[data-route-key]').forEach((input) => {
    const eventName = input.tagName === 'SELECT' || input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      const key = input.dataset.routeKey;
      route[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' || input.type === 'number' ? Number(input.value) : input.value;
      markCustom();
      send();
      const label = input.parentElement?.querySelector('.value');
      if (label) label.textContent = trim(route[key]);
      if (key === 'source' || key === 'dest') renderRoutes();
    });
  });
}

function labeledOptions(pairs, current) {
  return pairs.map(([id, text]) => `<option value="${id}" ${id === current ? 'selected' : ''}>${text}</option>`).join('');
}

function options(values, current, labeled) {
  return values.map((value) => {
    const id = typeof value === 'string' ? value : value.id;
    const text = labeled ? (labeled.find((item) => item.id === id)?.label || id) : id;
    return `<option value="${id}" ${id === current ? 'selected' : ''}>${text}</option>`;
  }).join('');
}

function label(list, id) {
  return list.find((item) => item.id === id)?.label || id;
}

function fillSelects() {
  const shape = document.getElementById('shape');
  shape.innerHTML = SHAPES.map((item) => `<option value="${item.id}">${item.label}</option>`).join('');
  const preset = document.getElementById('preset');
  preset.innerHTML = `<option value="">Custom</option>${PRESETS.map((item) => `<option value="${item.id}">${item.name}</option>`).join('')}`;
  preset.value = state.presetId || '';
  preset.addEventListener('change', () => { if (preset.value) applyPreset(preset.value); });
  document.getElementById('resetPreset').addEventListener('click', () => applyPreset(preset.value));
  document.getElementById('randomizeSettings')?.addEventListener('click', randomizeSettings);
}

function randomizeSettings() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const span = (min, max) => min + Math.random() * (max - min);
  const curves = ['uniform', 'linear', 'triangle', 'sine', 'sawtooth', 'exponential', 'alternating', 'stepped', 'random'];
  const palettes = ['none', 'cyan', 'magma', 'ice', 'complement'];
  const hex = (hue, sat, light) => {
    const amount = sat * Math.min(light, 1 - light);
    const channel = (offset) => {
      const k = (offset + hue / 30) % 12;
      const value = light - amount * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * value).toString(16).padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
  };
  const next = sanitizeState(state);
  const shape = pick(SHAPES);
  next.presetId = null;
  next.form.shape = shape.id;
  next.form.sides = Math.round(span(3, 12));
  next.form.starPoints = Math.round(span(3, 10));
  next.form.starInner = span(0.2, 0.7);
  next.form.ellipseAspect = span(0.6, 2.2);
  next.form.spiralArms = Math.round(span(1, 6));
  next.form.spiralPitch = span(8, 28);
  next.form.spiralTurns = span(2, 8);
  next.form.waveType = pick(['sine', 'triangle', 'saw', 'square', 'compound']);
  next.form.waveAmp = span(0, 80);
  next.form.waveFreq = span(0.5, 6);
  next.form.rotationStep = span(-20, 20);
  next.form.rotation = span(-180, 180);
  next.form.centerX = span(-0.3, 0.3);
  next.form.centerY = span(-0.3, 0.3);
  next.form.scale = span(0.6, 1.6);
  next.form.limit = Math.round(span(8, 40));
  next.form.quality = span(0.6, 1);
  next.form.seed = Math.round(span(1, 40));
  next.form.morph = span(0, 0.6);
  const widthMin = span(0.5, 8);
  const widthMax = span(12, 80);
  next.width.curve = pick(curves);
  next.width.min = widthMin;
  next.width.max = widthMax;
  next.width.base = span(widthMin, Math.min(widthMax, widthMin + 20));
  next.width.amplitude = span(0, 16);
  next.width.period = span(2, 16);
  next.width.phase = Math.random();
  next.width.phaseSpeed = span(-0.4, 0.4);
  next.width.seed = Math.round(span(1, 40));
  next.width.direction = Math.random() < 0.5 ? -1 : 1;
  const gapMin = span(0, 8);
  const gapMax = span(20, 80);
  next.gap.curve = pick(curves);
  next.gap.min = gapMin;
  next.gap.max = gapMax;
  next.gap.base = span(gapMin, Math.min(gapMax, gapMin + 30));
  next.gap.amplitude = span(0, 20);
  next.gap.period = span(2, 16);
  next.gap.phase = Math.random();
  next.gap.phaseSpeed = span(-0.4, 0.4);
  next.gap.seed = Math.round(span(1, 40));
  next.gap.direction = Math.random() < 0.5 ? -1 : 1;
  const count = 1 + Math.floor(Math.random() * 3);
  next.deformations = Array.from({ length: count }, () => defaultDeform(pick(DEFORM_TYPES).id, {
    strength: span(6, 40),
    frequency: span(1, 5),
    speed: span(0.05, 0.6),
    scale: span(0.004, 0.02),
    octaves: Math.round(span(1, 4)),
    seed: Math.round(span(1, 20)),
    falloff: span(200, 800),
  }));
  next.anim.speed = span(0.2, 1.6);
  next.anim.translateX = span(-40, 40);
  next.anim.translateY = span(-40, 40);
  next.anim.rotation = span(-30, 30);
  next.anim.expand = span(-20, 60);
  next.anim.wavePhase = span(-1, 1);
  next.anim.turbEvolve = span(0, 0.6);
  next.anim.ripple = span(0, 1.2);
  next.anim.hue = span(-20, 20);
  next.anim.polyRot = span(-20, 20);
  next.anim.morph = span(0, 0.8);
  next.color.hue = span(0, 360);
  next.color.bgHue = span(0, 360);
  next.color.saturation = span(0.3, 1.2);
  next.color.brightness = span(0.5, 1.2);
  next.color.bgBrightness = span(0, 0.2);
  next.color.opacity = span(0.7, 1);
  next.color.palette = pick(palettes);
  next.color.paletteMix = span(0.3, 1);
  next.color.fg = hex(next.color.hue, 0.7, 0.85);
  next.color.bg = hex(next.color.bgHue, 0.45, 0.08);
  next.audioGain = span(0.4, 1.6);
  state = sanitizeState(next);
  selectedDeform = 0;
  syncInputs();
  send();
}

function applyPreset(id) {
  state = sanitizeState(presetById(id).state);
  selectedDeform = 0;
  selectedRoute = 0;
  syncInputs();
  send();
}

function move(list, index, dir) {
  const next = index + dir;
  if (next < 0 || next >= list.length) return index;
  const [item] = list.splice(index, 1);
  list.splice(next, 0, item);
  return next;
}

function wireStacks() {
  document.getElementById('addDeform').onclick = () => {
    state.deformations.push(defaultDeform('wave'));
    selectedDeform = state.deformations.length - 1;
    markCustom();
    state = sanitizeState(state);
    renderDeforms();
    send();
  };
  document.getElementById('duplicateDeform').onclick = () => {
    const item = state.deformations[selectedDeform];
    if (!item) return;
    state.deformations.splice(selectedDeform + 1, 0, { ...cloneState(item), id: `d${Date.now().toString(36)}` });
    selectedDeform += 1;
    markCustom();
    renderDeforms();
    send();
  };
  document.getElementById('removeDeform').onclick = () => {
    state.deformations.splice(selectedDeform, 1);
    selectedDeform = Math.max(0, selectedDeform - 1);
    markCustom();
    renderDeforms();
    send();
  };
  document.getElementById('upDeform').onclick = () => { selectedDeform = move(state.deformations, selectedDeform, -1); markCustom(); renderDeforms(); send(); };
  document.getElementById('downDeform').onclick = () => { selectedDeform = move(state.deformations, selectedDeform, 1); markCustom(); renderDeforms(); send(); };
  document.getElementById('addRoute').onclick = () => {
    state.routes.push(defaultRoute());
    selectedRoute = state.routes.length - 1;
    markCustom();
    state = sanitizeState(state);
    renderRoutes();
    send();
  };
  document.getElementById('removeRoute').onclick = () => {
    state.routes.splice(selectedRoute, 1);
    selectedRoute = Math.max(0, selectedRoute - 1);
    markCustom();
    renderRoutes();
    send();
  };
}

function getAllParams() {
  return { state: cloneState(state) };
}

function applyParams(params) {
  const next = params?.state || params;
  if (!next?.form) return;
  state = sanitizeState(next);
  syncInputs();
  send();
}

async function init() {
  document.body.classList.add('pg-ready');
  controlsChannel = new BroadcastChannel('visualizer-controls');
  controlsChannel.onmessage = (event) => {
    if (event.data?.type === 'GEOMETRY_STATE' && event.data.state?.form) {
      state = sanitizeState(event.data.state);
      syncInputs();
    }
  };
  fillSelects();
  bindStatics();
  wireStacks();
  syncInputs();
  controlsChannel.postMessage({ type: 'REQUEST_STATE' });
  const favorites = new Favorites({
    moduleId: MODULE_ID,
    getAllParams,
    applyParams,
    saveButtonId: 'saveFavoriteBtn',
    nameInputId: 'favoriteName',
  });
  await favorites.init();
}

init().catch((error) => console.error('Procedural Geometry controls failed', error));
