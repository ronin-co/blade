import { cleanUp, prepareClientAssets, prepareServerAssets } from '@/private/shell/utils';
import { generateUniqueId } from '@/private/universal/utils/crypto';

const provider = import.meta.env.__BLADE_PROVIDER;
const bundleId = generateUniqueId();

await cleanUp();

await prepareClientAssets('production', bundleId, provider);
await prepareServerAssets(provider);
