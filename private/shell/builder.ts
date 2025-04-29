import path from 'node:path';

import { outputDirectory, serverInputFile, serverOutputFile } from './constants';
import {
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getReactAriaLoader,
} from './loaders';
import { cleanUp, handleBuildLogs, logSpinner, prepareClientAssets } from './utils';
import { transformToVercelBuildOutput } from './utils/providers';

await cleanUp();
await prepareClientAssets('production');

const serverSpinner = logSpinner('Performing server build (production)').start();

const IS_CLOUDFLARE = Bun.env['CF_PAGES'];
const IS_VERCEL = Bun.env['CF_PAGES'] === '1';

const getProvider = (): typeof Bun.env.__BLADE_PROVIDER => {
  if (IS_CLOUDFLARE) return 'cloudflare';
  if (IS_VERCEL) return 'vercel';
  return '';
};

// Inline all environment variables on Cloudflare Pages, because their runtime does not
// have support for `import.meta.env`. Everywhere else, only inline what is truly
// necessary (what cannot be made available at runtime).
const define: { [key: string]: string } = IS_CLOUDFLARE
  ? Object.fromEntries(
      Object.entries(import.meta.env)
        .filter(([key]) => key.startsWith('BLADE_') || key.startsWith('__BLADE_'))
        .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    )
  : {
      'import.meta.env.__BLADE_ASSETS': JSON.stringify(import.meta.env.__BLADE_ASSETS),
      'import.meta.env.__BLADE_ASSETS_ID': JSON.stringify(
        import.meta.env.__BLADE_ASSETS_ID,
      ),
      'import.meta.env.__BLADE_PROVIDER': getProvider(),
    };

const output = await Bun.build({
  entrypoints: [serverInputFile],
  outdir: outputDirectory,
  plugins: [
    getClientReferenceLoader('production'),
    getFileListLoader(true),
    getMdxLoader('production'),
    getReactAriaLoader(),
  ],
  naming: `[dir]/${path.basename(serverOutputFile)}`,
  // minify: true,
  sourcemap: 'external',
  target: 'browser',
  define,
});

if (output.success) {
  serverSpinner.succeed();
} else {
  serverSpinner.fail();
}

if (IS_VERCEL) await transformToVercelBuildOutput();

handleBuildLogs(output);
