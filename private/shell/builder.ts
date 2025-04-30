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
  define: mapProviderInlineDefinitions(),
});

if (output.success) {
  serverSpinner.succeed();
} else {
  serverSpinner.fail();
}

if (import.meta.env.__BLADE_PROVIDER === 'vercel') await transformToVercelBuildOutput();

handleBuildLogs(output);
