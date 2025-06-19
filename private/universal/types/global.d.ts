declare module 'bun' {
  interface Env {
    // Can be provided manually.
    BLADE_DATA_WORKER: string;
    BLADE_STORAGE_WORKER: string;

    BLADE_PUBLIC_GIT_COMMIT?: string;
    BLADE_PUBLIC_GIT_BRANCH?: string;

    // Provided automatically by BLADE.
    BLADE_ENV: 'development' | 'production';

    // Provided automatically by BLADE, but only for internal use.
    __BLADE_DEBUG_LEVEL: 'verbose' | 'error';
    __BLADE_PROVIDER: import('./util').DeploymentProvider;
    __BLADE_SERVICE_WORKER: string;
  }
}

declare module 'build-meta' {
  export const bundleId: string;
}
