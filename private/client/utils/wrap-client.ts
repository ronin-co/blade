import type { ComponentType } from 'react';

const CLIENT_REFERENCE = Symbol.for('react.client.reference');

/**
 * Used to mark internal framework components as client components.
 *
 * @param component - The React component to mark as a client component.
 * @param name - The name of the React component.
 *
 * @returns Nothing.
 */
export const wrapClientComponent = (component: ComponentType<any>, name: string) => {
  const chunkId = name.toLowerCase();

  if (typeof window === 'undefined') {
    Object.defineProperties(component, {
      $$typeof: { value: CLIENT_REFERENCE },
      name: { value: name },
      chunk: { value: chunkId },
      id: { value: `native-${name}` },
    });
  } else {
    window.BLADE_CHUNKS[chunkId] = { [name]: component };
  }
};
