import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin in development: the dev server forwards API calls to the API.
    proxy: {
      '/health': 'http://localhost:3000',
    },
  },
});
