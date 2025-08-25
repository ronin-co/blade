declare module 'server-list' {
  export const pages: import('./index').PageList;
  export const triggers: import('./index').TriggersList;
  export const schema: import('./index').ModelList;
  export const router: import('hono').Hono | null;
}
