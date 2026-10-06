import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  root: path('./'),
  base: './',
  publicDir: path('../../public/'),
  cacheDir: path('../../node_modules/.vite-afterimage/'),
  plugins: [react()],
  server: { host: '127.0.0.1', port: 4190, strictPort: true },
  preview: { host: '127.0.0.1', port: 4190, strictPort: true },
  build: {
    target: 'es2022',
    outDir: path('../../dist-design-preview/'),
    emptyOutDir: true,
    rollupOptions: {
      input: { index: path('./index.html'), chapters: path('./chapters.html') },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react')) return 'react-runtime';
          if (id.includes('/node_modules/gsap')) return 'motion-runtime';
        },
      },
    },
  },
});
