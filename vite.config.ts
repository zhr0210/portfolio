import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.PORTFOLIO_BASE || './',
  plugins: [react()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react')) return 'react-runtime';
          if (id.includes('/node_modules/gsap')) return 'motion-runtime';
        },
      },
    },
  },
});
