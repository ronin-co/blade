import type { ComponentType } from 'react';

const CLIENT_REFERENCE = Symbol.for('react.client.reference');

export const wrapClientComponent = (component: ComponentType<any>, name: string) => {
  const chunkId = name.toLowerCase();
  window.BLADE_CHUNKS[chunkId] = { [name]: component };

  Object.defineProperties(component, {
    $$typeof: { value: CLIENT_REFERENCE },
    name: { value: name },
    chunk: { value: chunkId },
    id: { value: 'testing' },
  });
};
