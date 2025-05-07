import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    './public/client/hooks.ts',
    './public/client/components.client.tsx',
    './public/server/hooks.ts',
    './public/server/utils/data.ts',
    './public/server/utils/errors.ts',
    './public/universal/hooks.ts',
    './public/universal/schema.ts',
    './public/universal/types.ts',

    './private/shell/index.ts',
    './private/shell/builder.ts',
    './private/shell/listener.ts',
    './private/client/index.ts',
    './private/client/components/history.client.tsx',
    './private/client/components/error-boundary.client.tsx',
    './private/server/worker/index.ts',
    './private/server/worker/vercel.ts',
  ],
  format: 'esm',
  clean: true,
  dts: true,
  external: ['bun', 'react', 'react-dom', 'client-list', 'file-list'],
  publicDir: './private/client/assets',
});
