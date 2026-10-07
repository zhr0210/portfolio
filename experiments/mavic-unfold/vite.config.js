import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));
export default defineConfig({
  root: path('./'),
  base: './',
  publicDir: false,
  cacheDir: path('../../node_modules/.vite-mavic'),
  assetsInclude: ['**/*.glb'],
  server: { host: '127.0.0.1', port: 4193, strictPort: true },
  preview: { host: '127.0.0.1', port: 4193, strictPort: true },
  build: { target: 'es2022', outDir: path('../../dist-mavic-preview'), emptyOutDir: true },
});
