import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
  test: {
    watch: false,
    coverage: {
      enabled: true,
      all: false,
    },
  },
});
