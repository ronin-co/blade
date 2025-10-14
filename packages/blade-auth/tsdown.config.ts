import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/triggers/*.ts', './src/schema.ts', './src/utils/index.ts'],
  dts: {
    resolve: true,
  },
  format: 'esm',
  external: [/^blade\//],
});
