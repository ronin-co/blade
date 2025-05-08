declare module 'server-list' {
  export const pages: import('./index').PageList;
  export const triggers: import('./index').TriggersList;
}

declare module '@mapbox/timespace' {
  export const getFuzzyLocalTimeFromPoint: (
    time: number,
    point: [number, number],
  ) => null | { _z: { name: string } };
}
