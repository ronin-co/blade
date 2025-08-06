import { resolve } from 'node:path';
import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  alias: {
    '@/private': resolve(__dirname, 'private'),
    '@/public': resolve(__dirname, 'public'),

    // Deno requires Node.js primitives to be imported with the `node:` prefix
    // and certain dependencies that Blade uses don't do that, so we're aliasing
    // them ourselves.
    'fs/promises': 'node:fs/promises',
    crypto: 'node:crypto',
    events: 'node:events',
    fs: 'node:fs',
    http: 'node:http',
    http2: 'node:http2',
    os: 'node:os',
    path: 'node:path',
    stream: 'node:stream',
  },
  entries: [
    // These files are publicly accessible.
    {
      input: './public/client/',
      outDir: './dist/public/client/',
      ext: 'js',
    },
    {
      input: './public/server/',
      outDir: './dist/public/server/',
      ext: 'js',
    },
    {
      input: './public/server/utils/',
      outDir: './dist/public/server/utils/',
      ext: 'js',
    },
    {
      input: './public/universal/',
      outDir: './dist/public/universal/',
      ext: 'js',
    },

    // These files are used internally by Blade.
    {
      input: './private/shell/index.ts',
      outDir: './dist/private/shell/',
    },
    {
      input: './private/client/index.ts',
      outDir: './dist/private/client/',
    },
    {
      input: './private/server/worker/providers/',
      outDir: './dist/private/server/worker/providers/',
      ext: 'js',
    },
  ],
  declaration: true,
  externals: ['server-list', 'client-list', 'build-meta', 'react', 'react-dom'],
  failOnWarn: false,
  parallel: true,
  rollup: {
    esbuild: {
      define: {
        // Deno does not support `global` and certain dependencies that Blade uses are
        // using `global`, so we're aliasing it ourselves.
        global: 'globalThis',
      },
      // Add the `React` global for JSX support
      jsx: 'automatic',
    },
    output: {
      format: 'es',
      entryFileNames: '[name].js', // Force .js extension
    },
  },
});
