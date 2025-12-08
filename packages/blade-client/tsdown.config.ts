import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: true,
  entry: [
    'src/index.ts',
    'src/types/index.ts',
    'src/utils/index.ts',
  ],
  format: 'esm',
});
