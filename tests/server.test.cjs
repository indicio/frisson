const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createServer } = require('../serve.js');

test('local server protects files and persists settings without damaging existing data', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'frisson-test-'));
  const root = path.join(temp, 'frisson');
  const sibling = path.join(temp, 'frisson-private');
  fs.mkdirSync(path.join(root, 'shell'), { recursive: true });
  fs.mkdirSync(sibling);
  fs.writeFileSync(path.join(root, 'shell/index.html'), 'frisson');
  fs.writeFileSync(path.join(sibling, 'secret.txt'), 'private');
  fs.symlinkSync(path.join(sibling, 'secret.txt'), path.join(root, 'escape.txt'));
  fs.writeFileSync(path.join(root, '.private'), 'private');
  const server = createServer({ root, maxBodyBytes: 128 });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true }); });
  const port = server.address().port;
  function request(url, { method = 'GET', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: url, method, headers }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      });
      req.on('error', reject); req.end(body);
    });
  }
  assert.equal((await request('/')).body, 'frisson');
  assert.equal((await request('/%ZZ')).status, 400);
  assert.equal((await request('/')).status, 200, 'server survives malformed URL');
  for (const url of ['/..%2ffrisson-private/secret.txt', '/escape.txt', '/.private']) assert.equal((await request(url)).status, 403, url);
  assert.equal((await request('/api/shell/config', { headers: { Origin: 'https://example.com' } })).status, 403);
  assert.equal((await request('/', { headers: { Host: 'evil.example' } })).status, 403);
  assert.equal((await request('/api/favorites/a.b')).status, 404);
  const put = body => request('/api/shell/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
  assert.equal((await put('{"playlist":[1],"fade":true}')).status, 200);
  assert.equal((await put('bad json')).status, 400);
  assert.equal((await put('[]')).status, 400);
  assert.equal((await put(JSON.stringify({ large: 'a'.repeat(200) }))).status, 413);
  assert.deepEqual(JSON.parse((await request('/api/shell/config')).body), { playlist: [1], fade: true });
  assert.deepEqual(fs.readdirSync(path.join(root, 'data/shell')), ['config.json'], 'atomic save leaves no temporary file');
  const range = await request('/', { headers: { Range: 'bytes=1-3' } });
  assert.equal(range.status, 206); assert.equal(range.body, 'ris');
  assert.equal((await request('/', { method: 'HEAD' })).body, '');
  fs.writeFileSync(path.join(root, 'data/shell/config.json'), 'corrupt');
  assert.equal((await request('/api/shell/config')).status, 500, 'corrupt settings are not treated as an empty config');
});

test('mapping projects can be saved, listed, and deleted', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'frisson-projects-'));
  const server = createServer({ root: temp, maxBodyBytes: 1024 * 1024 });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true }); });
  const port = server.address().port;
  function request(url, { method = 'GET', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: url, method, headers }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      });
      req.on('error', reject);
      req.end(body);
    });
  }
  const empty = JSON.parse((await request('/api/projects')).body);
  assert.deepEqual(empty.projects, []);
  const scene = { version: 1, output: { width: 1920, height: 1080 }, surfaces: [{ id: 'a', name: 'Surface 1' }] };
  const saved = await request('/api/projects/booth-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Booth', scene, view: { playing: false, grid: true } }),
  });
  assert.equal(saved.status, 200);
  const doc = JSON.parse((await request('/api/projects/booth-1')).body);
  assert.equal(doc.name, 'Booth');
  assert.equal(doc.scene.surfaces[0].id, 'a');
  assert.equal(doc.view.playing, false);
  const listed = JSON.parse((await request('/api/projects')).body);
  assert.equal(listed.projects[0].id, 'booth-1');
  assert.equal((await request('/api/projects/index', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
  assert.equal((await request('/api/projects/booth-1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"name":"Nope"}' })).status, 400);
  assert.equal((await request('/api/projects/booth-1', { method: 'DELETE' })).status, 200);
  assert.equal((await request('/api/projects/booth-1')).status, 404);
  assert.deepEqual(JSON.parse((await request('/api/projects')).body).projects, []);
});
