import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app/renderer'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@services': path.resolve(__dirname, 'services'),
    },
  },
});

