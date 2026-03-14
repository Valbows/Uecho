import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    'mcp-stdio-server': 'src/mcp-stdio-server.ts',
  },
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  splitting: true,
  sourcemap: true,
  dts: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
