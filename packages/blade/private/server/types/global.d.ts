declare global {
  var HMR_SESSIONS: Map<string, () => void>;
}

export {};
