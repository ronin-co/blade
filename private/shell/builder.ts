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
  transformToNetlifyOutput,
  transformToVercelBuildOutput,
} from '@/private/shell/utils/providers';
import { generateUniqueId } from '@/private/universal/utils/crypto';

import type { DeploymentProvider } from '@/private/universal/types/util';

const provider = import.meta.env.__BLADE_PROVIDER;
const bundleId = generateUniqueId();

await cleanUp();
await prepareClientAssets('production', bundleId, provider);

const serverSpinner = logSpinner('Performing server build (production)').start();
const customHandlers: Array<DeploymentProvider> = ['vercel'];

const buildEntrypoint = async (provider: DeploymentProvider): Promise<void> => {
  const output = await Bun.build({
    entrypoints: [path.join(serverInputFolder, `${provider}.js`)],
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
    define: mapProviderInlineDefinitions(provider),
  });

  handleBuildLogs(output);

  if (!output.success) {
    serverSpinner.fail();
    process.exit(1);
  }
};

await Promise.all([
  buildEntrypoint(customHandlers.includes(provider) ? provider : 'edge-worker'),
]);

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
}
