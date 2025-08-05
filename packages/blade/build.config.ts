import { resolve } from 'node:path';
import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  alias: {
    '@/private': resolve(__dirname, 'private'),
    '@/public': resolve(__dirname, 'public'),
  },
  entries: [
    // These files are publicly accessible.
    './public/client/components.tsx',
    './public/client/hooks.ts',

    './public/server/hooks.ts',
    './public/server/utils/errors.ts',

    './public/universal/example.ts',
    './public/universal/hooks.ts',
    './public/universal/schema.ts',
    './public/universal/types.ts',

    // These files are used internally by Blade.
    './private/shell/index.ts',
    './private/client/index.ts',
    './private/server/worker/providers/cloudflare.ts',
    './private/server/worker/providers/edge-worker.ts',
    './private/server/worker/providers/netlify.ts',
    './private/server/worker/providers/service-worker.ts',
    './private/server/worker/providers/vercel.ts',
  ],
  clean: true,
  declaration: true,
  externals: ['server-list', 'client-list', 'build-meta', 'react', 'react-dom'],
  failOnWarn: false,
  parallel: true,
  rollup: {
    alias: {
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
    emitCJS: false,
    esbuild: {
      define: {
        // Deno does not support `global` and certain dependencies that Blade uses are
        // using `global`, so we're aliasing it ourselves.
        global: 'globalThis',
      },
    },
  },
});
