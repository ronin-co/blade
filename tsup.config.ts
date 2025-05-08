import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    // These files are publicly accessible.
    './public/client/hooks.ts',
    './public/client/components.tsx',
    './public/server/hooks.ts',
    './public/server/utils/data.ts',
    './public/server/utils/errors.ts',
    './public/universal/hooks.ts',
    './public/universal/schema.ts',
    './public/universal/types.ts',

    // These files are used internally by Blade.
    './private/shell/index.ts',
    './private/shell/builder.ts',
    './private/shell/listener.ts',
    './private/client/index.ts',
    './private/server/worker/index.ts',
    './private/server/worker/vercel.ts',
  ],
  format: 'esm',
  clean: true,
  dts: true,
  external: ['bun', 'server-list', 'client-list', 'react', 'react-dom'],
  publicDir: './private/client/assets',
});
