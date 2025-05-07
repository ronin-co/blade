declare module 'file-list' {
  export const pages: Record<string, import('./index').TreeItem | 'DIRECTORY'>;
  export const triggers: import('./index').TriggersList;
}

declare module '@mapbox/timespace' {
  export const getFuzzyLocalTimeFromPoint: (
    time: number,
    point: [number, number],
  ) => null | { _z: { name: string } };
}
