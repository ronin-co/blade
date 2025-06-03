import path from 'node:path';

import { outputDirectory, serverInputFolder } from '@/private/shell/constants';
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
import type { DeploymentProvider } from '@/private/universal/types/util';
import { generateUniqueId } from '@/private/universal/utils/crypto';

const provider = import.meta.env.__BLADE_PROVIDER;
const bundleId = generateUniqueId();

await cleanUp();
await prepareClientAssets('production', bundleId, provider);

const serverSpinner = logSpinner('Performing server build (production)').start();
const customHandlers: Array<DeploymentProvider> = ['vercel', 'service-worker'];

const getEntrypoint = (name: DeploymentProvider | 'default') => {
  return path.join(serverInputFolder, `${name}.js`);
};

const output = await Bun.build({
  entrypoints: [
    getEntrypoint(customHandlers.includes(provider) ? provider : 'default'),
    getEntrypoint('service-worker'),
  ],
  outdir: outputDirectory,
  plugins: [
    getClientReferenceLoader('production'),
    getFileListLoader(true),
    getMdxLoader('production'),
    getReactAriaLoader(),
  ],
  minify: true,
  sourcemap: 'external',
  target: provider === 'vercel' ? 'node' : 'browser',
  define: mapProviderInlineDefinitions(),
});

handleBuildLogs(output);

if (!output.success) {
  serverSpinner.fail();
  process.exit(1);
}

serverSpinner.succeed();

switch (provider) {
  case 'cloudflare': {
    await transformToCloudflareOutput();
    break;
  }
  case 'vercel': {
    await transformToVercelBuildOutput();
    break;
  }
}
