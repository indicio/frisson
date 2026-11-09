const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
test('failed module initialization releases iframe and channel, then next load succeeds', async () => {
  const channels = []; const frames = []; let shouldFail = true; let destroys = 0;
  class Channel { constructor() { channels.push(this); } close() { this.closed = true; } postMessage() {} }
  const container = {
    ownerDocument: { createElement() {
      const frame = { style: {}, contentDocument: { body: {} }, contentWindow: {
        postMessage() {}, moduleAPI: { async initModule() { if (shouldFail) throw new Error('initialization failed'); }, destroy() { destroys++; }, start() {} },
      }, remove() { this.removed = true; } };
      frames.push(frame); return frame;
    } },
    replaceChildren(frame) { assert.equal(typeof frame.onload, 'function'); queueMicrotask(() => frame.onload()); },
  };
  const audio = { ensureAudioReady: async () => false, getFFTData() {}, getWaveformData() {}, getNormalizedFFTData() {}, getAudioLevel() {}, getAudioContext() {}, getAnalyser() {} };
  const loader = await loadModule('shell/loader.js', { BroadcastChannel: Channel }, { 'shell/audio.js': audio });
  await assert.rejects(loader.runTransition(() => loader.loadModule('first', container)), /initialization failed/);
  assert.equal(loader.getCurrentModule(), null); assert.equal(frames[0].removed, true); assert.equal(channels[0].closed, true); assert.equal(destroys, 1);
  shouldFail = false;
  await loader.runTransition(() => loader.loadModule('second', container));
  assert.ok(loader.getCurrentModule());
  await loader.runTransition(() => loader.unloadModule());
  assert.equal(channels[1].closed, true); assert.equal(frames[1].removed, true);
});
test('transition queue does not overlap and recovers after a rejection', async () => {
  const loader = await loadModule('shell/loader.js', {}, { 'shell/audio.js': {} });
  let release; const gate = new Promise(resolve => release = resolve); const events = [];
  const first = loader.runTransition(async () => { events.push('first'); await gate; throw new Error('failure'); });
  const second = loader.runTransition(() => { events.push('second'); });
  await new Promise(setImmediate); assert.deepEqual(events, ['first']);
  release(); await assert.rejects(first, /failure/); await second;
  assert.deepEqual(events, ['first', 'second']);
});
