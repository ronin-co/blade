import { build as buildContext } from '@/private/shell/utils/build';
import type { BuildOptions, BuildResult } from 'esbuild';

interface BuildConfig {
  environment?: 'development' | 'production';
}

export const build = async (config?: BuildConfig): Promise<BuildResult<BuildOptions>> => {
  const environment = config?.environment || 'development';
  const mainBuild = await buildContext(environment);

  return mainBuild.rebuild();
};
