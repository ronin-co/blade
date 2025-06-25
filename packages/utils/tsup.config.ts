import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    log: './src/log.ts',
    string: './src/string.ts',
  },
  format: 'esm',
  clean: true,
  dts: true,
  treeshake: true,
});
