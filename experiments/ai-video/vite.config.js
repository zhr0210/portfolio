import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// 独立入口，不复制主站 public/，不更改正式 dist/。
const repository = fileURLToPath(new URL('../../', import.meta.url));
function legacyPreviewPath() {
  const attach = (server) => {
    server.middlewares.use((req, _res, next) => {
      if (req.url?.startsWith('/prototype-directions/')) {
        req.url = req.url.replace('/prototype-directions/', '/experiments/ai-video/');
      }
      next();
    });
  };
  return {
    name: 'video-preview-path',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  root: repository,
  cacheDir: 'node_modules/.vite-ai-video',
  base: './',
  publicDir: false,
  assetsInclude: ['**/*.glb'],
  plugins: [legacyPreviewPath()],
  server: { host: '127.0.0.1', port: 4184, strictPort: true },
  preview: { host: '127.0.0.1', port: 4184, strictPort: true },
  build: {
    target: 'es2022',
    outDir: 'dist-experiments',
    rollupOptions: {
      input: fileURLToPath(new URL('./ai-video.html', import.meta.url)),
    },
  },
});
