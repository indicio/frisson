import { Favorites } from '../../shared/favorites.js';
import {
  DEFORM_TYPES,
  PRESETS,
  SHAPES,
  cloneState,
  defaultDeform,
  presetById,
  sanitizeState,
} from './engine.js';

const MODULE_ID = 'procedural-geometry';
let controlsChannel = null;
let state = sanitizeState(presetById('vortex-tunnel').state);
let selectedDeform = 0;
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
  const open = Boolean(host.querySelector('.advanced')?.open);
  const curveDetail = spec.curve === 'sequence'
    ? `<div class="control-item"><label class="control-label">Sequence</label><input data-spec="${kind}.sequence" type="text" value="${spec.sequence.join(', ')}"></div>`
    : spec.curve === 'random'
      ? rangeField('Seed', `${kind}.seed`, spec.seed || 1, 1, 40, 1)
      : '';
  host.innerHTML = `
    ${rangeField('Base', `${kind}.base`, spec.base, spec.min, spec.max, 0.5)}
    <div class="control-item"><label class="control-label">Curve</label><select data-spec="${kind}.curve">${labeledOptions(CURVES, spec.curve)}</select></div>
    ${curveDetail}
    ${kind === 'width' ? profileFields(spec.profile) : ''}
    <details class="advanced"${open ? ' open' : ''}>
      <summary>Advanced</summary>
      ${rangeField('Minimum', `${kind}.min`, spec.min, 0, 200, 0.5)}
      ${rangeField('Maximum', `${kind}.max`, spec.max, 1, 400, 1)}
      ${rangeField('Amplitude', `${kind}.amplitude`, spec.amplitude, 0, 200, 0.5)}
      ${rangeField('Period', `${kind}.period`, spec.period, 1, 32, 1)}
      ${rangeField('Phase', `${kind}.phase`, spec.phase, 0, 1, 0.01)}
      ${rangeField('Phase speed', `${kind}.phaseSpeed`, spec.phaseSpeed || 0, -2, 2, 0.01)}
      <div class="control-item"><label class="control-label">Evaluate by</label><select data-spec="${kind}.space">${labeledOptions([['index', 'Element index'], ['spatial', 'Spatial position']], spec.space)}</select></div>
      <div class="control-item"><label class="control-label">Direction</label><select data-spec="${kind}.direction"><option value="1" ${spec.direction > 0 ? 'selected' : ''}>Forward</option><option value="-1" ${spec.direction < 0 ? 'selected' : ''}>Reverse</option></select></div>
    </details>
  `;
  host.querySelectorAll('[data-spec]').forEach((input) => {
    const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      const specPath = input.dataset.spec;
      const dot = specPath.indexOf('.');
      const group = specPath.slice(0, dot);
      const key = specPath.slice(dot + 1);
      if (key.startsWith('profile.')) {
        const field = key.slice('profile.'.length);
        if (field === 'mode' || field === 'wave') state[group].profile[field] = input.value;
        else state[group].profile[field] = Number(input.value);
      } else if (key === 'sequence') state[group].sequence = input.value.split(',').map((part) => Number(part.trim())).filter((value) => Number.isFinite(value));
      else if (key === 'direction' || key === 'curve' || key === 'space') state[group][key] = key === 'direction' ? Number(input.value) : input.value;
      else state[group][key] = Number(input.value);
      markCustom();
      state = sanitizeState(state);
      send();
      if (key === 'curve' || key === 'profile.mode') renderProgress(group);
      else {
        const label = input.parentElement?.querySelector('.value');
        const shown = key.startsWith('profile.') ? state[group].profile[key.slice('profile.'.length)] : state[group][key];
        if (label && typeof shown === 'number') label.textContent = trim(shown);
      }
    });
  });
}

function profileFields(profile) {
  const spec = profile || { mode: 'off', start: 1, end: 0.2, exponent: 2, wave: 'sine', repeats: 2, phase: 0, phaseSpeed: 0 };
  const mode = spec.mode || 'off';
  const extra = mode === 'off' ? '' : `
    ${rangeField('Start', 'width.profile.start', spec.start, 0, 2, 0.01)}
    ${rangeField('End', 'width.profile.end', spec.end, 0, 2, 0.01)}
    ${mode === 'exponential' ? rangeField('Exponent', 'width.profile.exponent', spec.exponent, 0.25, 6, 0.05) : ''}
    ${mode === 'wave' ? `
      <div class="control-item"><label class="control-label">Wave</label><select data-spec="width.profile.wave">${labeledOptions([['sine', 'Sine'], ['triangle', 'Triangle'], ['saw', 'Sawtooth']], spec.wave)}</select></div>
      ${rangeField('Repeats', 'width.profile.repeats', spec.repeats, 0.25, 12, 0.25)}
      ${rangeField('Phase', 'width.profile.phase', spec.phase, 0, 1, 0.01)}
      ${rangeField('Phase speed', 'width.profile.phaseSpeed', spec.phaseSpeed, -2, 2, 0.01)}
    ` : ''}
  `;
  return `
    <div class="control-item"><label class="control-label">Along stroke</label><select data-spec="width.profile.mode">${labeledOptions([['off', 'Off'], ['linear', 'Linear'], ['exponential', 'Exponential'], ['wave', 'Wave']], mode)}</select></div>
    ${extra}
  `;
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
  const advancedKeys = new Set(['speed', 'phase', 'direction', 'falloff', 'octaves', 'seed', 'centerX', 'centerY']);
  const primary = [`<div class="control-item"><label class="control-label">Type</label><select data-stage="type">${options(DEFORM_TYPES.map((item) => item.id), stage.type, DEFORM_TYPES)}</select></div>`];
  const advanced = [];
  const place = (key, html) => (advancedKeys.has(key) ? advanced : primary).push(html);
  if (show.has('strength')) place('strength', stageRange('Strength', 'strength', stage.strength, -200, 240, 1));
  if (show.has('scale')) place('scale', stageRange('Scale', 'scale', stage.scale, 0.001, 0.08, 0.001));
  if (show.has('frequency')) place('frequency', stageRange('Frequency', 'frequency', stage.frequency, 0.1, 12, 0.1));
  if (show.has('speed')) place('speed', stageRange('Speed', 'speed', stage.speed, -2, 3, 0.01));
  if (show.has('phase')) place('phase', stageRange('Phase', 'phase', stage.phase, 0, 6.28, 0.01));
  if (show.has('direction')) place('direction', stageRange('Direction', 'direction', stage.direction, 0, 360, 1));
  if (show.has('falloff')) place('falloff', stageRange('Falloff', 'falloff', stage.falloff, 20, 1200, 1));
  if (show.has('octaves')) place('octaves', stageRange('Octaves', 'octaves', stage.octaves, 1, 6, 1));
  if (show.has('seed')) place('seed', stageRange('Seed', 'seed', stage.seed, 1, 40, 1));
  if (show.has('centerX')) place('centerX', stageRange('Center X', 'centerX', stage.centerX || 0, -600, 600, 1));
  if (show.has('centerY')) place('centerY', stageRange('Center Y', 'centerY', stage.centerY || 0, -600, 600, 1));
  if (show.has('wave')) place('wave', `<div class="control-item"><label class="control-label">Wave</label><select data-stage="wave">${labeledOptions([['sine','Sine'],['triangle','Triangle'],['saw','Sawtooth'],['square','Square'],['compound','Compound']], stage.wave)}</select></div>`);
  if (show.has('axis')) place('axis', `<div class="control-item"><label class="control-label">Axis</label><select data-stage="axis">${labeledOptions([['horizontal','Horizontal'],['vertical','Vertical'],['radial','Radial'],['tangential','Tangential']], stage.axis)}</select></div>`);
  const open = Boolean(editor.querySelector('.advanced')?.open);
  editor.innerHTML = primary.join('') + (advanced.length
    ? `<details class="advanced"${open ? ' open' : ''}><summary>Advanced</summary>${advanced.join('')}</details>`
    : '');
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
  renderAudioDeforms();
}

function renderAudioDeforms() {
  const host = document.getElementById('audio-deforms');
  if (!host) return;
  host.innerHTML = state.deformations.map((stage, index) => {
    const name = label(DEFORM_TYPES, stage.type);
    const count = state.deformations.filter((item) => item.type === stage.type).length;
    const nth = state.deformations.slice(0, index + 1).filter((item) => item.type === stage.type).length;
    const title = count > 1 ? `${name} ${nth}` : name;
    return `<div class="control-item"><label class="control-label">${title} <span class="value">${trim(stage.audio || 0)}</span></label><input data-deform-audio="${index}" type="range" min="0" max="100" step="5" value="${stage.audio || 0}"></div>`;
  }).join('');
  host.querySelectorAll('[data-deform-audio]').forEach((input) => {
    input.addEventListener('input', () => {
      const stage = state.deformations[Number(input.dataset.deformAudio)];
      if (!stage) return;
      stage.audio = Number(input.value);
      markCustom();
      send();
      const value = input.parentElement?.querySelector('.value');
      if (value) value.textContent = trim(stage.audio);
    });
  });
}

function stageRange(label, key, value, min, max, step) {
  return `<div class="control-item"><label class="control-label">${label} <span class="value">${trim(value)}</span></label><input data-stage="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
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
  const ordered = [...PRESETS].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  preset.innerHTML = `<option value="">Custom</option>${ordered.map((item) => `<option value="${item.id}">${item.name}</option>`).join('')}`;
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
  next.width.profile.mode = pick(['off', 'off', 'linear', 'exponential', 'wave']);
  next.width.profile.start = span(0.15, 1.6);
  next.width.profile.end = span(0.05, 1.4);
  next.width.profile.exponent = span(1, 4);
  next.width.profile.wave = pick(['sine', 'triangle', 'saw']);
  next.width.profile.repeats = span(1, 5);
  next.width.profile.phase = Math.random();
  next.width.profile.phaseSpeed = span(-0.6, 0.6);
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
  next.color.bgHue = 0;
  next.color.saturation = span(0.3, 1.2);
  next.color.brightness = span(0.5, 1.2);
  next.color.bgBrightness = 1;
  next.color.opacity = span(0.7, 1);
  next.color.palette = pick(palettes);
  next.color.paletteMix = span(0.3, 1);
  next.color.fg = hex(next.color.hue, 0.7, 0.85);
  next.color.bg = hex(span(0, 360), 0.45, 0.12);
  next.audioGain = span(0.5, 2);
  next.audio.graduation = Math.round(span(0, 80) / 5) * 5;
  next.audio.swell = Math.round(span(0, 80) / 5) * 5;
  next.audio.wave = Math.round(span(0, 80) / 5) * 5;
  next.audio.expansion = Math.round(span(0, 80) / 5) * 5;
  next.deformations.forEach((stage) => { stage.audio = Math.round(span(0, 70) / 5) * 5; });
  state = sanitizeState(next);
  selectedDeform = 0;
  syncInputs();
  send();
}

function applyPreset(id) {
  state = sanitizeState(presetById(id).state);
  selectedDeform = 0;
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
