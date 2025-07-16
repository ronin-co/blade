// It's extremely important that these remain globals instead of variables exported from
// a file, as they must remain persistent across different script loads for different
// client bundles performed by the browser.

declare interface Window {
  /** Contains a list of all the chunks that were loaded on the client so far. */
  BLADE_CHUNKS: Record<string, Record<string, unknown>>;

  /** An ongoing browser session (an open browser tab). */
  BLADE_SESSION?: {
    root: import('react-dom/client').Root;
    source: import('../utils/page').EventStream;
  };
}

declare module 'client-list' {
  export const pages: import('./index').PageList;
}
