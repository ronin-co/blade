interface Window {
  // It's extremely important that this remains a global instead of a variable exported
  // from a file, as it must remain persistent across different script loads performed by
  // the browser.
  BLADE_ROOT: import('react-dom/client').Root | null;

  // Contains a list of all the chunks that were loaded on the client so far.
  BLADE_CHUNKS: Record<string, Record<string, unknown>>;
}
