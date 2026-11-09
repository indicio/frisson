const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule, storage } = require('./helpers.cjs');
test('failed HTTP saves retain recovery data across reload and retry clears it', async () => {
  const localStorage = storage(); let ok = false;
  const globals = { localStorage, fetch: async () => ({ ok, status: ok ? 200 : 500 }) };
  let module = await loadModule('shared/saveQueue.js', globals);
  assert.equal(await module.saveJSON('/api/shell/config', { fade: false }), false);
  module = await loadModule('shared/saveQueue.js', globals);
  assert.equal(module.pendingSave('/api/shell/config').fade, false);
  ok = true;
  assert.equal(await module.saveJSON('/api/shell/config', module.pendingSave('/api/shell/config')), true);
  assert.equal(module.pendingSave('/api/shell/config'), null);
});
test('saves snapshot objects and send updates in order', async () => {
  const localStorage = storage(); const bodies = []; let release;
  const gate = new Promise(r => release = r);
  const module = await loadModule('shared/saveQueue.js', { localStorage, fetch: async (url, options) => { bodies.push(options.body); if (bodies.length === 1) await gate; return { ok: true }; } });
  const state = { version: 1 };
  const first = module.saveJSON('/api/shell/config', state);
  state.version = 2;
  const second = module.saveJSON('/api/shell/config', state);
  await new Promise(setImmediate);
  assert.deepEqual(bodies, ['{"version":1}']);
  assert.equal(module.pendingSave('/api/shell/config').version, 2);
  release(); await Promise.all([first, second]);
  assert.deepEqual(bodies, ['{"version":1}', '{"version":2}']);
  assert.equal(module.pendingSave('/api/shell/config'), null);
});
test('shell config loads unsaved recovery copy instead of silently losing edits', async () => {
  const localStorage = storage();
  localStorage.setItem('frisson-pending-save:/api/shell/config', '{"playlist":[{"moduleId":"orbs"}]}');
  const mod = await loadModule('shared/portableStorage.js', { localStorage, fetch: async () => { throw new Error('offline'); } });
  const config = await mod.loadShellConfig();
  assert.equal(config.playlist[0].moduleId, 'orbs');
});
