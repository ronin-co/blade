declare global {
  var SHELL_STATE: Promise<{ default: Hono; channels: SSEStreamingApi }>;
}

export {};
