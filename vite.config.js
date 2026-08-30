import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localDocsPlugin } from './server/vite-local-docs-plugin.mjs';

export default defineConfig(({ mode }) => ({
  base: mode === 'published' ? './' : '/',
  plugins: [react(), localDocsPlugin()],
  server: {
    host: '127.0.0.1',
  },
}));
