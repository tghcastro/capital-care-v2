import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@capital-care/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    // Same-origin in development: the dev server forwards API calls to the API.
    proxy: {
      '/health': 'http://localhost:3000',
      '/categories': 'http://localhost:3000',
      '/accounts': 'http://localhost:3000',
      '/transactions': 'http://localhost:3000',
    },
  },
});
