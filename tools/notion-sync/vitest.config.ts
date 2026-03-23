import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.{test,spec}.ts'],
    setupFiles: ['test/setup.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['lib/**/*.ts', 'commands/**/*.ts'],
      exclude: ['test/**', '**/*.d.ts'],
      thresholds: {
        'lib/**/*.ts': {
          functions: 90,
          branches: 80,
          lines: 85,
        },
        'commands/**/*.ts': {
          functions: 85,
          branches: 75,
          lines: 80,
        },
      },
    },
  },
});
