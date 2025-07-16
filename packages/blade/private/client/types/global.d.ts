// It's extremely important that these remain globals instead of variables exported from
// a file, as they must remain persistent across different script loads for different
// client bundles performed by the browser.

declare interface Window {
  /** Contains a list of all the chunks that were loaded on the client so far. */
  BLADE_CHUNKS: Record<string, Record<string, unknown>>;
}

declare module 'client-list' {
  export const pages: import('./index').PageList;
}
