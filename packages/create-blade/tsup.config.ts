import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: 'esm',
  clean: true,
  dts: true,
  treeshake: true,
});
