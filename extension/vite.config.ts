import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';

export default defineConfig({
  // Use empty base so built HTML files reference assets with relative paths.
  // Chrome extensions resolve from chrome-extension://ID/ — absolute /assets/ paths fail.
  base: '',
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
        micPermission: resolve(__dirname, 'src/mic-permission/mic-permission.html'),
      },
    },
  },
});
