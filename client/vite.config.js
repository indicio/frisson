import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = 'http://127.0.0.1:3010';

// Module scripts send Origin. The API compares that to its own Host, and the
// dev proxy rewrites Host to 127.0.0.1:3010, so the viewer script was rejected.
function devProxy() {
  return {
    target: api,
    changeOrigin: true,
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin');
      });
    },
  };
}

const proxy = {
  '/api': devProxy(),
  '/modules': devProxy(),
  '/shared': devProxy(),
  '/media': devProxy(),
  '/data': devProxy(),
  '/shell': devProxy(),
};

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/app/' : '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy, fs: { allow: ['..'] } },
  preview: { port: 4173, proxy },
}));
