import fs from 'node:fs/promises';
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
import { generateUniqueId } from '@/private/universal/utils/crypto';

const provider = import.meta.env.__BLADE_PROVIDER;
const bundleId = generateUniqueId();

await cleanUp();
await prepareClientAssets('production', bundleId, provider);

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

await fs.copyFile(serverOutputFile, path.join(outputDirectory, `worker.${bundleId}.js`));

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
