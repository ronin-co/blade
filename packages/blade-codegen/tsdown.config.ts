import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: {
    resolve: true,
  },
  entry: {
    index: './src/index.ts',
    zod: './src/zod.ts',
  },
  format: 'esm',
});
