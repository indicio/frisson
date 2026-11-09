import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function serverUp() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3010/shell/', (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
  });
}

const children = [];
function stop() {
  for (const child of children) child.kill('SIGTERM');
}
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });

if (!(await serverUp())) {
  const server = spawn(process.execPath, ['serve.js'], { cwd: root, stdio: 'inherit' });
  children.push(server);
  server.on('exit', (code) => {
    if (code) {
      console.error('Frisson server exited before the React dashboard was ready.');
      stop();
      process.exit(code);
    }
  });
}

const vite = spawn('npm', ['run', 'dev', '--prefix', 'client'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
children.push(vite);
vite.on('exit', (code) => {
  stop();
  process.exit(code ?? 0);
});
