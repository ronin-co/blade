import path from 'node:path';

import { outputDirectory, serverInputFile, serverOutputFile } from './constants';
import {
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getReactAriaLoader,
} from './loaders';
import { cleanUp, handleBuildLogs, logSpinner, prepareClientAssets } from './utils';
import {
  mapProviderInlineDefinitions,
  transformToVercelBuildOutput,
} from './utils/providers';

await cleanUp();
await prepareClientAssets('production');

const serverSpinner = logSpinner('Performing server build (production)').start();

const IS_VERCEL = import.meta.env.__BLADE_PROVIDER === 'vercel';

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
  target: IS_VERCEL ? 'node' : 'browser',
  define: mapProviderInlineDefinitions(),
});

if (output.success) {
  serverSpinner.succeed();
} else {
  serverSpinner.fail();
}

if (IS_VERCEL) await transformToVercelBuildOutput();

handleBuildLogs(output);
