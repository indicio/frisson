const test = require('node:test');
const assert = require('node:assert/strict');

test('procedural geometry', async (t) => {
  const engine = await import('../modules/procedural-geometry/engine.js');

  await t.test('every shape produces strokes', () => {
    for (const shape of engine.SHAPES) {
      const state = engine.defaultState();
      state.form.shape = shape.id;
      const strokes = engine.buildStrokes(engine.sanitizeState(state), 1.2);
      assert.ok(strokes.length > 0, shape.id);
      assert.ok(strokes.every((stroke) => stroke.points.length > 1 && Number.isFinite(stroke.width)), shape.id);
    }
  });

  await t.test('extreme widths stay finite', () => {
    const state = engine.sanitizeState(engine.presetById('extreme-bands').state);
    state.width.sequence = [0.5, 300, 0, 160];
    const strokes = engine.buildStrokes(state, 4);
    assert.ok(strokes.every((stroke) => stroke.width >= 0.5 && stroke.width <= 300));
  });

  await t.test('deformation order changes the geometry', () => {
    const state = engine.defaultState();
    state.form.shape = 'circles';
    state.form.limit = 4;
    state.deformations = [
      engine.defaultDeform('wave', { strength: 40, frequency: 2, id: 'a' }),
      engine.defaultDeform('twist', { strength: 70, id: 'b' }),
    ];
    const first = engine.buildStrokes(engine.sanitizeState(state), 0.4)[0].points[3];
    state.deformations.reverse();
    const second = engine.buildStrokes(engine.sanitizeState(state), 0.4)[0].points[3];
    assert.ok(Math.hypot(first.x - second.x, first.y - second.y) > 0.5);
  });

  await t.test('modulation does not change the stored base values', () => {
    const base = engine.sanitizeState(engine.presetById('bass-reactor').state);
    const before = base.width.base;
    const modulator = engine.createModulator();
    const metrics = { rms: 1, peak: 1, bass: 1, mid: 0, treble: 0, centroid: 0.4, pitch: 0.5, midi: 0.5, pitchClass: 0.2, transient: 0, fft: new Uint8Array(32).fill(200), bins: 32 };
    const live = modulator.apply(base, metrics, 0.2, 1);
    assert.equal(base.width.base, before);
    assert.notEqual(live.width.base, before);
  });

  await t.test('pitch detection holds a low-confidence reading', () => {
    const track = engine.createAudioTracker();
    const wave = new Uint8Array(256);
    for (let i = 0; i < wave.length; i += 1) wave[i] = 128 + Math.round(Math.sin(i / 8) * 90);
    const confident = track(new Uint8Array(64).fill(20), wave, 0.4, 48000);
    const quiet = track(new Uint8Array(64), new Uint8Array(256).fill(128), 0, 48000);
    assert.ok(confident.pitch > 0);
    assert.equal(quiet.pitch, confident.pitch);
  });

  await t.test('wave shape selects change the waveform', () => {
    const sine = engine.defaultState();
    sine.form.shape = 'sine';
    sine.form.waveAmp = 48;
    sine.form.waveType = 'sine';
    const tri = engine.defaultState();
    tri.form.shape = 'triangle-wave';
    tri.form.waveAmp = 48;
    tri.form.waveType = 'sine';
    const sample = (state) => engine.buildStrokes(engine.sanitizeState(state), 0)[0].points.slice(8, 24).reduce((sum, point) => sum + point.y, 0);
    assert.ok(Math.abs(sample(sine) - sample(tri)) > 4);
  });

  await t.test('factory presets are complete', () => {
    assert.equal(engine.PRESETS.length, 18);
    const increase = engine.presetById('linear-increase').state;
    const decrease = engine.presetById('linear-decrease').state;
    const evenLines = engine.presetById('even-lines').state;
    const evenCircles = engine.presetById('even-circles').state;
    const sine = engine.presetById('sine-line-weight').state;
    const rings = engine.presetById('linear-rings').state;
    assert.equal(increase.form.shape, 'horizontal');
    assert.equal(increase.width.curve, 'sequence');
    assert.equal(increase.width.profile.mode, 'off');
    assert.equal(decrease.width.sequence[0], 64);
    assert.equal(evenLines.form.shape, 'horizontal');
    assert.equal(evenLines.width.curve, 'uniform');
    assert.equal(evenCircles.form.shape, 'circles');
    assert.equal(evenCircles.width.curve, 'uniform');
    assert.equal(sine.form.shape, 'sine');
    assert.equal(sine.width.profile.mode, 'wave');
    assert.equal(rings.form.shape, 'circles');
    assert.equal(rings.width.curve, 'linear');
    const band = (state) => engine.buildStrokes(engine.sanitizeState(state), 0)
      .filter((stroke) => Math.abs(stroke.points[0].y) < 160)
      .map((stroke) => stroke.width);
    const up = band(increase);
    const down = band(decrease);
    assert.ok(up.at(-1) > up[0] * 8);
    const seam = down.findIndex((width, index) => index && width > down[index - 1] + 8);
    const body = seam === -1 ? down : down.slice(0, seam);
    assert.ok(body.length >= 6);
    assert.ok(body[0] > body.at(-1) * 4);
    const flat = band(evenLines);
    assert.ok(flat.length > 4);
    assert.ok(Math.max(...flat) - Math.min(...flat) < 0.2);
    const wave = engine.buildStrokes(engine.sanitizeState(sine), 0)[0];
    assert.ok(Math.max(...wave.widths) > Math.min(...wave.widths) * 2);
    const ringWidths = engine.buildStrokes(engine.sanitizeState(rings), 0).map((stroke) => stroke.width);
    assert.ok(ringWidths.at(-1) > ringWidths[0]);
    assert.ok(engine.presetById('vortex-tunnel').state.deformations.length >= 2);
    assert.ok(engine.presetById('bass-reactor').state.routes.length >= 2);
  });

  await t.test('coarse audio graduates a flat width without storing it', () => {
    const base = engine.sanitizeState({
      audio: { graduation: 100, swell: 100, wave: 100, expansion: 100 },
      form: { shape: 'horizontal', waveAmp: 0 },
      width: { base: 8, amplitude: 0, curve: 'uniform' },
      deformations: [engine.defaultDeform('twist', { id: 'twist', strength: 20, audio: 100 })],
    });
    const live = engine.createModulator().apply(base, { rms: 1, peak: 1, bass: 1 }, 0.5, 1);
    assert.equal(base.width.curve, 'uniform');
    assert.equal(base.width.amplitude, 0);
    assert.equal(base.deformations[0].strength, 20);
    assert.equal(live.width.curve, 'linear');
    assert.ok(live.width.amplitude > 20);
    assert.ok(live.form.waveAmp > base.form.waveAmp);
    assert.ok(live.anim.expand > base.anim.expand);
    assert.ok(Math.abs(live.width.profile.phaseSpeed) > Math.abs(base.width.profile.phaseSpeed));
    assert.ok(live.deformations[0].strength > base.deformations[0].strength);
  });

  await t.test('expanding rings grow through the center without resetting', () => {
    const state = engine.sanitizeState(engine.presetById('breathing-rings').state);
    const speed = state.anim.expand;
    const radiiOf = (elapsed) => engine.buildStrokes(state, elapsed)
      .map((stroke) => Math.hypot(stroke.points[0].x, stroke.points[0].y))
      .filter((radius) => radius > 0 && radius < 420)
      .sort((a, b) => a - b);
    let previous = radiiOf(0);
    const dt = 0.05;
    for (let elapsed = dt; elapsed <= 6; elapsed += dt) {
      const radii = radiiOf(elapsed);
      assert.ok(radii.length > 3);
      assert.ok(radii[0] < 36, `center emptied at ${elapsed}: ${radii[0]}`);
      for (const radius of previous) {
        const expected = radius + speed * dt;
        if (expected >= 400) continue;
        let nearest = radii[0];
        for (const value of radii) {
          if (Math.abs(value - expected) < Math.abs(nearest - expected)) nearest = value;
        }
        assert.ok(Math.abs(nearest - expected) < 0.75, `jump at ${elapsed}: ${radius} -> ${nearest}, expected ${expected}`);
      }
      previous = radii;
    }
  });

  await t.test('along-stroke profile multiplies width by arc length', () => {
    const plain = engine.sanitizeState({ width: { base: 4 } });
    assert.equal(plain.width.profile.mode, 'off');
    assert.equal(engine.buildStrokes(plain, 0)[0].widths, null);

    const state = engine.defaultState();
    state.form.shape = 'horizontal';
    state.form.waveAmp = 0;
    state.form.limit = 3;
    state.deformations = [];
    state.width.profile = { mode: 'linear', start: 1, end: 0.2 };
    const stroke = engine.buildStrokes(engine.sanitizeState(state), 0)[0];
    assert.ok(Math.abs(stroke.widths[0] / stroke.width - 1) < 0.02);
    assert.ok(Math.abs(stroke.widths.at(-1) / stroke.width - 0.2) < 0.02);

    const linearMid = engine.alongStrokeScale(0.5, { mode: 'exponential', exponent: 1, start: 1, end: 0 }, 0);
    const sharpMid = engine.alongStrokeScale(0.5, { mode: 'exponential', exponent: 3, start: 1, end: 0 }, 0);
    assert.equal(linearMid, 0.5);
    assert.ok(sharpMid > 0.8);

    const waveStart = engine.alongStrokeScale(0, { mode: 'wave', wave: 'sine', repeats: 2, phase: 0, phaseSpeed: 0, start: 0.25, end: 1 }, 0);
    const waveEnd = engine.alongStrokeScale(1, { mode: 'wave', wave: 'sine', repeats: 2, phase: 0, phaseSpeed: 0, start: 0.25, end: 1 }, 0);
    assert.equal(waveStart, waveEnd);
  });

  await t.test('background swatch is the canvas color', () => {
    const fresh = engine.sanitizeState(engine.defaultState());
    fresh.color.bg = '#ff00aa';
    assert.equal(engine.backgroundColor(fresh), '#ff00aa');
    const legacy = engine.sanitizeState({ color: { bg: '#3366ff', bgHue: 220, bgBrightness: 0.04 } });
    assert.equal(legacy.color.bgHue, 0);
    assert.equal(legacy.color.bgBrightness, 1);
    assert.equal(engine.backgroundColor(legacy), '#3366ff');
    fresh.color.bgBrightness = 0;
    assert.equal(engine.backgroundColor(fresh), '#000000');
  });
});
