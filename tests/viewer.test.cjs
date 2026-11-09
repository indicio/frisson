const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
test('viewer announces readiness without microphone access and exposes viewer-owned playlist playback', async () => {
  const messages = []; let init; let micCalls = 0; let playbackCalls = 0;
  const window = { addEventListener() {} };
  const elements = {
    'status-message': { textContent: '' },
    'status-overlay': { classList: { remove() {}, add() {} } },
  };
  const document = { readyState: 'loading', getElementById: id => elements[id], addEventListener(event, callback) { if (event === 'DOMContentLoaded') init = callback; } };
  class Channel { postMessage(message) { messages.push(message); } close() {} }
  await loadModule('shell/viewer.js', { window, document, BroadcastChannel: Channel, setTimeout() {} }, {
    'shell/audio.js': { ensureAudioReady() { micCalls++; }, destroyAudio() {} },
    'shell/loader.js': {},
    'shell/imageLayer.js': {},
    'shell/playlist.js': { play(container, onChange) { playbackCalls++; onChange('orbs', { moduleName: 'Orbs' }); }, stop() {} },
  });
  await init();
  assert.equal(messages.some(message => message.type === 'VIEWER_READY'), true);
  assert.equal(micCalls, 0);
  window.frissonPlaylist.play({}, () => {});
  assert.equal(playbackCalls, 1);
  assert.equal(elements['status-message'].textContent, 'Orbs loaded');
});
