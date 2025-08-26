import fs from 'node:fs/promises';
import path from 'node:path';
import { resolve } from 'node:path';
import { getPath as getWasmPath } from '@dprint/typescript';
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
  hooks: {
    'build:done': async (): Promise<void> => {
      try {
        await fs.copyFile(
          getWasmPath(),
          path.resolve(__dirname, 'dist', 'private', 'shell', 'plugin.wasm'),
        );
        console.log('✓ Copied `@dprint/typescript` WASM module to dist/private/shell/');
      } catch (err) {
        if (err instanceof Error)
          return console.warn(
            '⚠ Failed to copy `@dprint/typescript` WASM module:',
            err.message,
          );

        throw err;
      }
    },
  },
  entries: [
    // These files are publicly accessible.
    './public/client/components.tsx',
    './public/client/hooks.ts',

    './public/server/hooks.ts',
    './public/server/utils/errors.ts',

    './public/universal/hooks.ts',
    './public/universal/schema.ts',
    './public/universal/types.ts',
    './public/universal/utils.ts',

    // These files are used internally by Blade.
    './private/shell/index.ts',
    './private/client/index.ts',
    './private/server/worker/providers/cloudflare.ts',
    './private/server/worker/providers/edge-worker.ts',
    './private/server/worker/providers/netlify.ts',
    './private/server/worker/providers/service-worker.ts',
    './private/server/worker/providers/vercel.ts',
  ],
  declaration: true,
  externals: ['server-list', 'client-list', 'react', 'react-dom', 'typescript'],
  failOnWarn: false,
  parallel: true,
  rollup: {
    esbuild: {
      define: {
        // Deno does not support `global` and certain dependencies that Blade uses are
        // using `global`, so we're aliasing it ourselves.
        global: 'globalThis',
      },
      // Add the `React` global for JSX support.
      jsx: 'automatic',
    },
    output: {
      format: 'es',
      entryFileNames: '[name].js', // Force .js extension
    },
  },
});
