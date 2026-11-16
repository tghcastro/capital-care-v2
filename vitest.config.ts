import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: false,
        resolve: {
          // Tests of apps/api import the ledger module from source, so they never need a prior build.
          alias: {
            '@capital-care/ledger': fileURLToPath(new URL('./modules/ledger/src/index.ts', import.meta.url)),
          },
        },
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          include: ['**/__test__/**/*.test.ts', 'apps/api/test/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'apps/web/**'],
        },
      },
      {
        extends: false,
        test: {
          name: 'web',
          root: './apps/web',
          environment: 'jsdom',
          globals: true,
          include: ['src/**/__test__/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test-setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
      ],
    },
  },
});
