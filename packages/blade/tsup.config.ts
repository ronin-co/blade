import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    // These files are publicly accessible.
    './public/client/**/*.(ts|tsx)',
    './public/server/**/*.(ts|tsx)',
    './public/universal/**/*.(ts|tsx)',

    // These files are used internally by Blade.
    './private/shell/index.ts',
    './private/client/index.ts',
    './private/server/worker/providers/*.ts',
  ],
  format: 'esm',
  clean: true,
  dts: true,
  external: ['bun', 'server-list', 'build-meta', 'react', 'react-dom'],
  publicDir: './private/client/assets',
  treeshake: true,
});
