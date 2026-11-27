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
          alias: {
            '@capital-care/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
          },
          environment: 'jsdom',
          globals: true,
          include: ['src/**/__test__/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test-setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['{apps,modules,packages}/*/src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'dist/',
        // Test code is not product code: it must not count toward (or inflate) coverage.
        '**/__test__/**',
        '**/test-setup.ts',
        '**/mocks/**',
        '**/*.d.ts',
      ],
      // Per-glob thresholds are measured over the files each glob matches; the top-level
      // numbers apply to every other file. See docs/tech/definitions/testing.md#coverage.
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
        'modules/*/src/**/*.service.ts': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
