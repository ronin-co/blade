import { useContext } from 'react';

import { RootServerContext } from '@/private/server/context';

const useServerContext = () => {
  const serverContext = useContext(RootServerContext);
  if (!serverContext) throw new Error('Missing server context.');
  return serverContext;
};

export { useServerContext };
