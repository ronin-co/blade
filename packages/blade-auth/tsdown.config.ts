import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/triggers/*.ts', './src/schema.ts'],
  dts: {
    resolve: true,
  },
  format: 'esm',
});
