declare global {
  var SERVER_SESSIONS: Map<string, import('hono/streaming').SSEStreamingApi>;
}

export {};
