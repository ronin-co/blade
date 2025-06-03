declare module 'server-list' {
  export const pages: import('./index').PageList;
  export const triggers: import('./index').TriggersList;
  export const router: import('hono').Hono | null;
}
