declare global {
  var SHELL_SERVER_STATE: Promise<{ default: Hono; channels: SSEStreamingApi }>;
}

export {};
