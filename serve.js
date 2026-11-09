#!/usr/bin/env node
/** Local Frisson server: static assets and atomic JSON persistence. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
};
const fail = (status, message) => Object.assign(new Error(message), { status });
function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
function sendJSON(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        chunks.length = 0;
        reject(fail(413, 'Settings are too large to save'));
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > limit) return;
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString());
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        resolve(value);
      } catch { reject(fail(400, 'Expected a JSON object')); }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(fail(400, 'Request interrupted')));
  });
}
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return {};
    throw fail(500, 'Saved settings could not be read');
  }
}
function writeJSON(file, data) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
function projectIdFrom(pathname) {
  return pathname.slice('/api/projects/'.length);
}

function projectPath(root, id) {
  if (id === 'index' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw fail(400, 'Invalid project');
  const folder = path.join(root, 'data', 'projects');
  const file = path.join(folder, `${id}.json`);
  if (!inside(folder, file)) throw fail(403, 'Forbidden');
  return file;
}

function readProjectIndex(root) {
  const index = readJSON(path.join(root, 'data', 'projects', 'index.json'));
  const projects = Array.isArray(index.projects) ? index.projects.filter((item) => item && /^[A-Za-z0-9_-]{1,80}$/.test(item.id) && item.id !== 'index') : [];
  return {
    version: 1,
    activeId: typeof index.activeId === 'string' ? index.activeId : null,
    projects: projects.map((item) => ({
      id: item.id,
      name: String(item.name || 'Untitled').slice(0, 80),
      updatedAt: item.updatedAt || null,
    })),
  };
}

function writeProjectIndex(root, index) {
  writeJSON(path.join(root, 'data', 'projects', 'index.json'), index);
}

async function handleProject(req, res, root, pathname, maxBodyBytes) {
  if (pathname === '/api/projects') {
    if (req.method === 'GET' || req.method === 'HEAD') {
      sendJSON(res, 200, readProjectIndex(root));
      return;
    }
    if (req.method === 'PUT') {
      if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw fail(415, 'Expected application/json');
      const data = await readBody(req, maxBodyBytes);
      const projects = Array.isArray(data.projects) ? data.projects : [];
      writeProjectIndex(root, {
        version: 1,
        activeId: typeof data.activeId === 'string' && data.activeId !== 'index' ? data.activeId : null,
        projects: projects.filter((item) => item && /^[A-Za-z0-9_-]{1,80}$/.test(item.id) && item.id !== 'index').map((item) => ({
          id: item.id,
          name: String(item.name || 'Untitled').slice(0, 80),
          updatedAt: item.updatedAt || null,
        })),
      });
      sendJSON(res, 200, { ok: true });
      return;
    }
    throw fail(405, 'Method not allowed');
  }
  const id = projectIdFrom(pathname);
  const file = projectPath(root, id);
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (!fs.existsSync(file)) throw fail(404, 'Project not found');
    sendJSON(res, 200, readJSON(file));
    return;
  }
  if (req.method === 'PUT') {
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw fail(415, 'Expected application/json');
    const data = await readBody(req, maxBodyBytes);
    if (!Array.isArray(data.scene?.surfaces) || !data.scene?.output) throw fail(400, 'Project is missing a mapping scene');
    const saved = {
      version: 1,
      id,
      name: String(data.name || 'Untitled').slice(0, 80),
      updatedAt: new Date().toISOString(),
      scene: data.scene,
      view: data.view && typeof data.view === 'object' && !Array.isArray(data.view) ? data.view : {},
    };
    writeJSON(file, saved);
    const index = readProjectIndex(root);
    const entry = { id, name: saved.name, updatedAt: saved.updatedAt };
    const projects = index.projects.filter((item) => item.id !== id);
    projects.unshift(entry);
    writeProjectIndex(root, { ...index, projects });
    sendJSON(res, 200, { ok: true, updatedAt: saved.updatedAt });
    return;
  }
  if (req.method === 'DELETE') {
    fs.rmSync(file, { force: true });
    const index = readProjectIndex(root);
    writeProjectIndex(root, {
      ...index,
      activeId: index.activeId === id ? null : index.activeId,
      projects: index.projects.filter((item) => item.id !== id),
    });
    sendJSON(res, 200, { ok: true });
    return;
  }
  throw fail(405, 'Method not allowed');
}

function createServer({ root = __dirname, maxBodyBytes = 32 * 1024 * 1024 } = {}) {
  root = fs.realpathSync(root);
  for (const folder of ['favorites', 'shell', 'image-layer', 'module-state', 'projects']) {
    fs.mkdirSync(path.join(root, 'data', folder), { recursive: true });
  }
  async function handler(req, res) {
    // Bind to loopback and validate Host as well, including DNS-rebinding requests.
    let requestURL;
    try { requestURL = new URL(req.url, `http://${req.headers.host}`); }
    catch { throw fail(400, 'Invalid URL'); }
    const host = new URL(`http://${req.headers.host}`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname) || requestURL.origin !== host.origin) {
      throw fail(403, 'Local requests only');
    }
    if (req.headers.origin && req.headers.origin !== host.origin) throw fail(403, 'Cross-origin requests are not allowed');
    let pathname;
    try { pathname = decodeURIComponent(requestURL.pathname); }
    catch { throw fail(400, 'Invalid URL encoding'); }
    if (pathname.includes('\0') || pathname.includes('\\')) throw fail(400, 'Invalid path');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { Allow: 'GET, HEAD, PUT, DELETE, OPTIONS' });
      res.end();
      return;
    }
    if (pathname === '/api/projects' || /^\/api\/projects\/[A-Za-z0-9_-]{1,80}$/.test(pathname)) {
      await handleProject(req, res, root, pathname, maxBodyBytes);
      return;
    }
    let file;
    const match = pathname.match(/^\/api\/(favorites|module-state)\/([a-zA-Z0-9_-]+)$/);
    if (match) file = path.join(root, 'data', match[1], `${match[2]}.json`);
    if (pathname === '/api/shell/config') file = path.join(root, 'data/shell/config.json');
    if (pathname === '/api/shell/image-layer') file = path.join(root, 'data/image-layer/image-layer.json');
    if (file) {
      if (req.method === 'GET') {
        let data = readJSON(file);
        if (pathname === '/api/shell/image-layer' && Object.keys(data || {}).length === 0) data = readJSON(path.join(root, 'data/shell/image-layer.json'));
        sendJSON(res, 200, data);
      } else if (req.method === 'PUT') {
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw fail(415, 'Expected application/json');
        writeJSON(file, await readBody(req, maxBodyBytes));
        sendJSON(res, 200, { ok: true });
      } else throw fail(405, 'Method not allowed');
      return;
    }
    if (pathname.startsWith('/api/')) throw fail(404, 'Unknown API endpoint');
    if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, 'Method not allowed');
    const appIndex = path.join(root, 'client', 'dist', 'index.html');
    if ((pathname === '/app' || pathname.startsWith('/app/')) && fs.existsSync(appIndex)) {
      if (pathname === '/app') {
        res.writeHead(302, { Location: '/app/' });
        res.end();
        return;
      }
      const dist = path.join(root, 'client', 'dist');
      let rel = pathname.slice('/app/'.length) || 'index.html';
      if (rel.split('/').some(part => !part || part === '..' || part.startsWith('.'))) throw fail(403, 'Forbidden');
      file = path.resolve(dist, rel);
      if (!inside(dist, file)) throw fail(403, 'Forbidden');
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        if (path.extname(rel)) throw fail(404, 'Not found');
        file = appIndex;
      }
    } else {
    const relative = pathname === '/' ? 'shell/index.html' : pathname.slice(1);
    if (relative.split('/').some(part => part.startsWith('.'))) throw fail(403, 'Forbidden');
    file = path.resolve(root, relative);
    if (!inside(root, file)) throw fail(403, 'Forbidden');
    }
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      file = fs.realpathSync(file);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) throw fail(404, 'Not found');
      throw error;
    }
    if (!inside(root, file)) throw fail(403, 'Forbidden');
    const stat = fs.statSync(file);
    if (!stat.isFile()) throw fail(404, 'Not found');
    // Stream media instead of buffering entire clips; support seeking.
    let start = 0, end = stat.size - 1, status = 200;
    if (req.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!range || (!range[1] && !range[2])) throw fail(416, 'Invalid range');
      if (!range[1]) start = Math.max(0, stat.size - Number(range[2]));
      else { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])); }
      if (start > end || start >= stat.size) { res.setHeader('Content-Range', `bytes */${stat.size}`); throw fail(416, 'Range not satisfiable'); }
      status = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    }
    res.writeHead(status, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': Math.max(0, end - start + 1), 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD' || stat.size === 0) res.end();
    else pipeline(fs.createReadStream(file, { start, end }), res, () => {});
  }
  return http.createServer((req, res) => {
    handler(req, res).catch(error => {
      if (res.destroyed) return;
      if (res.headersSent) { res.destroy(); return; }
      sendJSON(res, error.status || 500, { error: error.status ? error.message : 'Unable to complete request' });
    });
  });
}
if (require.main === module) {
  const idx = process.argv.indexOf('--port');
  const port = idx === -1 ? 3010 : Number(process.argv[idx + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be between 1 and 65535');
  const server = createServer();
  server.on('error', error => { console.error(`Frisson could not start: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Frisson running at http://localhost:${port}/shell/`));
}
module.exports = { createServer };
