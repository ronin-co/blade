import { SERVER_CONTEXT } from '@/private/server/worker/context';

const useServerContext = () => {
  const serverContext = SERVER_CONTEXT.getStore();
  if (!serverContext) throw new Error('Missing server context.');
  return serverContext;
};

export { useServerContext };
