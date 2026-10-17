import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localDocsPlugin } from './server/vite-local-docs-plugin.mjs';

// Normal editing must not reload when documents, published pages, or shared
// platform source files change. Developers can opt in for an editing session.
const liveReload = process.env.DOC_STUDIO_LIVE_RELOAD === '1';

export default defineConfig(({ mode }) => ({
  base: mode === 'published' ? './' : '/',
  plugins: [react(), localDocsPlugin()],
  server: {
    host: '127.0.0.1',
    cors: false,
    hmr: liveReload,
    ws: liveReload,
    watch: liveReload ? {} : null,
  },
}));
