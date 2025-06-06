import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    // These files are publicly accessible.
    './public/client/**/*.ts',
    './public/server/**/*.ts',
    './public/universal/**/*.ts',

    // These files are used internally by Blade.
    './private/shell/index.ts',
    './private/shell/builder.ts',
    './private/shell/listener.ts',
    './private/client/index.ts',
    './private/server/worker/providers/*.ts',
  ],
  format: 'esm',
  clean: true,
  dts: true,
  external: ['bun', 'server-list', 'client-list', 'react', 'react-dom'],
  publicDir: './private/client/assets',
  treeshake: true,
});
