import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: {
    resolve: true,
  },
  format: 'esm',
  entry: {
    index: './src/index.ts',
    zod: './src/zod.ts',
  },
});
