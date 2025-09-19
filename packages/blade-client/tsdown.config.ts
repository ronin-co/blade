import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  format: 'esm',
  entry: [
    'src/index.ts',
    'src/bin/index.ts',
    'src/types/index.ts',
    'src/schema/index.ts',
    'src/utils/index.ts',
  ],
});
