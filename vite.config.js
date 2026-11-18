import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// base './' so the build works from any GitHub Pages sub-path.
// Two pages: the home page (index.html) and the web app (app/index.html).
export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString()) },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: { input: { home: resolve(__dirname, 'index.html'), app: resolve(__dirname, 'app/index.html') } },
  },
});
