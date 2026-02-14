import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'tests/**',
        'node_modules/**',
        'dist/**',
        '*.config.*',
        '**/*.d.ts'
      ],
      all: true
    },
    deps: {
      inline: ['element-plus']
    },
    transforms: {
      '^.+\\.vue$': ['@vue/transformer-vue', {
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag.startsWith('el-')
          }
        }
      }]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'vue': resolve(__dirname, 'node_modules/vue'),
      'element-plus': resolve(__dirname, 'node_modules/element-plus')
    }
  },
  server: {
    port: 3000,
    host: true
  }
});
