import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    './private/shell/index.ts',

    './public/client/hooks.ts',
    './public/client/components/link.client.tsx',

    './public/server/hooks.ts',
    './public/server/utils/data.ts',
    './public/server/utils/errors.ts',

    './public/universal/hooks.ts',
    './public/universal/schema.ts',
    './public/universal/types.ts',
  ],
  format: 'esm',
  clean: true,
  dts: true,
  external: ['bun', 'react', 'react-dom', 'file-list'],
});
