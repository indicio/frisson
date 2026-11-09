const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; }
async function setup(overrides = {}) {
  let current = null, queue = Promise.resolve();
  const calls = [];
  let now = 100;
  const timers = new Map(); let id = 0;
  const loader = {
    runTransition(work) { const result = queue.then(work); queue = result.catch(() => {}); return result; },
    getCurrentModule: () => current,
    loadModule: async name => { calls.push(`load:${name}`); current = {}; },
    startModule: async () => { calls.push('start'); },
    stopModule: async () => { calls.push('stop'); },
    unloadModule: async () => { calls.push('unload'); current = null; },
    resumeAudioUpdates() { calls.push('audio'); },
    applyInitialParams: async () => {}, ...overrides,
  };
  const playlist = await loadModule('shell/playlist.js', { performance: { now: () => now }, setTimeout: (fn, delay) => { timers.set(++id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id) }, { 'shell/loader.js': loader });
  playlist.setFadeEnabled(false);
  playlist.setPlaylist([{ moduleId: 'a', modulePath: 'a', durationMs: 1000 }, { moduleId: 'b', modulePath: 'b', durationMs: 1000 }]);
  return { playlist, calls, timers, loader, advance: ms => { now += ms; }, container: { style: {} } };
}
test('pause/resume restarts retained module and preserves time across repeated pauses', async () => {
  const { playlist: p, calls, timers, advance, container } = await setup();
  await p.play(container); advance(200); await p.stop();
  await p.resume(container);
  assert.equal(p.isPlayingPlaylist(), true);
  assert.equal(calls.filter(c => c === 'start').length, 2);
  assert.equal([...timers.values()][0].delay, 800);
  advance(300); await p.stop(); await p.resume(container);
  assert.equal([...timers.values()][0].delay, 500);
  assert.equal(calls.filter(c => c.startsWith('load:')).length, 1);
  await p.stop();
});
test('stop during initialization cannot restart or reschedule playback', async () => {
  const gate = deferred(), entered = deferred();
  const { playlist: p, calls, timers, container } = await setup({ loadModule: async () => { entered.resolve(); await gate.promise; } });
  const playing = p.play(container); await entered.promise;
  const stopped = p.stop(); gate.resolve(); await Promise.all([playing, stopped]);
  assert.equal(calls.includes('start'), false); assert.equal(timers.size, 0); assert.equal(p.isPlayingPlaylist(), false);
});
test('rapid skips discard stale work and leave one active timer', async () => {
  const gate = deferred(), entered = deferred(); let loads = 0;
  const { playlist: p, calls, timers, container } = await setup({ loadModule: async () => { if (++loads === 1) { entered.resolve(); await gate.promise; } } });
  const first = p.play(container); await entered.promise;
  const second = p.next(container); gate.resolve(); await Promise.all([first, second]);
  assert.equal(calls.filter(c => c === 'start').length, 1); assert.equal(timers.size, 1); assert.equal(p.getCurrentIndex(), 1);
  await p.stop();
});
test('repeat stops after one failed pass instead of retrying forever', async () => {
  let loads = 0;
  const { playlist: p, container } = await setup({ loadModule: async () => { loads++; throw new Error('missing module'); } });
  p.setRepeatMode(true); await p.play(container);
  assert.equal(loads, 2); assert.equal(p.isPlayingPlaylist(), false);
});
test('a nonrepeating playlist stops rendering when its final duration ends', async () => {
  const { playlist: p, calls, timers, container, loader } = await setup();
  p.setPlaylist([{ moduleId: 'a', modulePath: 'a', durationMs: 100 }]);
  await p.play(container);
  const before = calls.filter(c => c === 'stop').length;
  [...timers.values()][0].fn();
  await loader.runTransition(() => {});
  assert.equal(p.isPlayingPlaylist(), false);
  assert.equal(calls.filter(c => c === 'stop').length, before + 1);
});
