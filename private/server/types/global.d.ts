declare module 'file-list' {
  import type { DataHooksList, TreeItem } from './index';

  export const pages: Record<string, TreeItem | 'DIRECTORY'>;
  export const hooks: DataHooksList;
}

declare module '@mapbox/timespace' {
  export const getFuzzyLocalTimeFromPoint: (
    time: number,
    point: [number, number],
  ) => null | { _z: { name: string } };
}
