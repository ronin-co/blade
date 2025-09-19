import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: {
    resolve: true,
  },
  entry: {
    schema: 'src/schema/index.ts',
    queries: 'src/queries/index.ts',
  },
  format: 'esm',
});
