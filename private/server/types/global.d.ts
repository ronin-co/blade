declare module 'file-list' {
  import type { TriggersList, TreeItem } from './index';

  export const pages: Record<string, TreeItem | 'DIRECTORY'>;
  export const triggers: TriggersList;
}

declare module '@mapbox/timespace' {
  export const getFuzzyLocalTimeFromPoint: (
    time: number,
    point: [number, number],
  ) => null | { _z: { name: string } };
}
