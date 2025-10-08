import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: true,
  entry: [
    'src/index.ts',
    'src/bin/index.ts',
    'src/types/index.ts',
    'src/schema/index.ts',
    'src/utils/index.ts',
  ],
  format: 'esm',
  external: ['undici', 'hive/disk-storage'],
});
