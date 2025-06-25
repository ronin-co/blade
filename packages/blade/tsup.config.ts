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
  external: ['server-list', 'client-list', 'build-meta', 'react', 'react-dom'],
  publicDir: './private/client/assets',
  treeshake: true,
  esbuildPlugins: [
    // Deno requires Node.js primitives to be imported with the `node:` prefix
    // and certain dependencies that Blade uses don't do that, so we're aliasing
    // them ourselves.
    {
      name: 'alias-native-modules',
      setup(build) {
        const items = [
          'stream',
          'crypto',
          'http2',
          'http',
          'os',
          'events',
          'path',
          'fs',
          'fs/promises',
        ];

        for (const item of items) {
          build.onResolve({ filter: new RegExp(`^${item}$`) }, () => ({
            path: `node:${item}`,
            external: true,
            namespace: 'node-builtin',
          }));
        }
      },
    },
  ],
  define: {
    // Deno does not support `global` and certain dependencies that Blade uses are
    // using `global`, so we're aliasing it ourselves.
    global: 'globalThis'
  }
});
