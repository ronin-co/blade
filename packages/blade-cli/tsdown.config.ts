import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: true,
  entry: {
    index: './src/index.ts',
    'commands/apply': './src/commands/apply.ts',
    'commands/diff': './src/commands/diff.ts',
    'commands/types': './src/commands/types.ts',
    flags: './src/flags.ts',
  },
  external: ['typescript', 'undici'],
  format: 'esm',
});
