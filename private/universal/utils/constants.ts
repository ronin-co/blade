export const SENTRY_ENVIRONMENT = import.meta.env.BLADE_PUBLIC_GIT_BRANCH
  ? import.meta.env.BLADE_PUBLIC_GIT_BRANCH === 'main'
    ? 'production'
    : 'preview'
  : 'development';

export const CLIENT_ASSET_PREFIX = '/client';

export const DEFAULT_PAGE_PATH = 'blade-default-pages';
