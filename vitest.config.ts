import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    coverage: {
      enabled: true,
      all: false,
    },
  },
});
