import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules/**', 'dist/**', '**/*.d.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'tests/**',
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*'
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    },
    testTimeout: 10000,
    hookTimeout: 5000
  },
  resolve: {
    alias: {
      '@': __dirname + '/src',
      '@/services': __dirname + '/services',
      '@/lib': __dirname + '/lib',
      '@/api': __dirname + '/api',
      '@/types': __dirname + '/types',
      '@/middleware': __dirname + '/middleware'
    }
  },
  esbuild: {
    target: 'node18'
  },
  build: {
    target: 'node18'
  }
});
