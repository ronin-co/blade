import path from 'node:path';

import {
  outputDirectory,
  serverInputFile,
  serverOutputFile,
  serverVercelInputFile,
} from '@/private/shell/constants';
import {
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getReactAriaLoader,
} from '@/private/shell/loaders';
import {
  cleanUp,
  handleBuildLogs,
  logSpinner,
  prepareClientAssets,
} from '@/private/shell/utils';
import {
  mapProviderInlineDefinitions,
  transformToCloudflareOutput,
  transformToVercelBuildOutput,
} from '@/private/shell/utils/providers';

const provider = import.meta.env.__BLADE_PROVIDER;

await cleanUp();
await prepareClientAssets('production', provider);

const serverSpinner = logSpinner('Performing server build (production)').start();

const output = await Bun.build({
  entrypoints: [provider === 'vercel' ? serverVercelInputFile : serverInputFile],
  outdir: outputDirectory,
  plugins: [
    getClientReferenceLoader('production'),
    getFileListLoader(true),
    getMdxLoader('production'),
    getReactAriaLoader(),
  ],
  naming: `[dir]/${path.basename(serverOutputFile)}`,
  minify: false,
  sourcemap: 'external',
  target: provider === 'vercel' ? 'node' : 'browser',
  define: mapProviderInlineDefinitions(),
});

if (output.success) {
  serverSpinner.succeed();
} else {
  serverSpinner.fail();
}

switch (provider) {
  case 'cloudflare': {
    await transformToCloudflareOutput();
    break;
  }
  case 'vercel': {
    await transformToVercelBuildOutput();
    break;
  }
  default:
    break;
}

handleBuildLogs(output);
