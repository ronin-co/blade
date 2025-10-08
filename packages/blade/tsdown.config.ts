import { defineConfig } from 'tsdown';

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
  dts: { resolve: true },
  external: [
    'server-list',
    'client-list',
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    'react-dom/server.edge',
    'typescript',
    'undici',
    'hive/disk-storage',
  ],
  treeshake: true,
  define: {
    // Deno does not support `global` and certain dependencies that Blade uses are
    // using `global`, so we're aliasing it ourselves.
    global: 'globalThis',
  },
  // Deno requires Node.js primitives to be imported with the `node:` prefix and certain
  // dependencies that Blade uses don't do that, so we're aliasin them ourselves.
  nodeProtocol: true,
});
