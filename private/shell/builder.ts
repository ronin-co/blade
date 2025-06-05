import path from 'node:path';

import {
  outputDirectory,
  serverInputFile,
  serverNetlifyInputFile,
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
  transformToNetlifyOutput,
  transformToVercelBuildOutput,
} from '@/private/shell/utils/providers';

const provider = import.meta.env.__BLADE_PROVIDER;

await cleanUp();
await prepareClientAssets('production', provider);

const serverSpinner = logSpinner('Performing server build (production)').start();

function getEntrypointFile(): string {
  switch (provider) {
    case 'netlify':
      return serverNetlifyInputFile;
    case 'vercel':
      return serverVercelInputFile;
    default:
      return serverInputFile;
  }
}

const output = await Bun.build({
  entrypoints: [getEntrypointFile()],
  outdir: outputDirectory,
  plugins: [
    getClientReferenceLoader('production'),
    getFileListLoader(true),
    getMdxLoader('production'),
    getReactAriaLoader(),
  ],
  naming: `[dir]/${path.basename(serverOutputFile)}`,
  minify: true,
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
  case 'netlify': {
    await transformToNetlifyOutput();
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
