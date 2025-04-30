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
  getProvider,
  mapProviderInlineDefinitions,
  transformToVercelBuildOutput,
} from './utils/providers';

await cleanUp();
await prepareClientAssets('production');

const serverSpinner = logSpinner('Performing server build (production)').start();

const provider = getProvider();

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
  define: mapProviderInlineDefinitions(provider),
});

if (output.success) {
  serverSpinner.succeed();
} else {
  serverSpinner.fail();
}

if (provider === 'vercel') await transformToVercelBuildOutput();

handleBuildLogs(output);
