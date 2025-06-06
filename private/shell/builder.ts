import path from 'node:path';

import {
  defaultDeploymentProvider,
  outputDirectory,
  serverInputFolder,
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
import type { DeploymentProvider } from '@/private/universal/types/util';
import { generateUniqueId } from '@/private/universal/utils/crypto';

const provider = import.meta.env.__BLADE_PROVIDER;
const bundleId = generateUniqueId();

await cleanUp();
await prepareClientAssets('production', bundleId, provider);

const customHandlers: Array<DeploymentProvider> = ['netlify', 'vercel'];

const buildEntrypoint = async (provider: DeploymentProvider): Promise<void> => {
  const serverSpinner = logSpinner('Performing server build (production)').start();

  const output = await Bun.build({
    entrypoints: [path.join(serverInputFolder, `${provider}.js`)],
    outdir: outputDirectory,
    plugins: [
      getClientReferenceLoader('production'),
      getFileListLoader(true),
      getMdxLoader('production'),
      getReactAriaLoader(),
    ],
    naming: `[dir]/${provider.endsWith('-worker') ? provider : defaultDeploymentProvider}.js`,
    minify: true,
    sourcemap: 'external',
    target: provider === 'vercel' ? 'node' : 'browser',
    define: mapProviderInlineDefinitions(provider),
  });

  handleBuildLogs(output);

  if (output.success) {
    serverSpinner.succeed();
    return;
  }

  serverSpinner.fail();
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
