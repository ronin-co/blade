import type { BuildOptions, BuildResult } from 'esbuild';

import { build as buildContext } from '@/private/shell/utils/build';

interface BuildConfig {
  environment?: 'development' | 'production';
}

interface BuildOutput
  extends Pick<BuildResult<BuildOptions>, 'errors' | 'warnings' | 'outputFiles'> {}

export const build = async (config?: BuildConfig): Promise<BuildOutput> => {
  const environment = config?.environment || 'development';
  const mainBuild = await buildContext(environment);
  const { errors, warnings, outputFiles } = await mainBuild.rebuild();

  return { errors, warnings, outputFiles };
};
