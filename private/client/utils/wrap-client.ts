import type { ComponentType, ExoticComponent, ForwardRefRenderFunction } from 'react';

const CLIENT_REFERENCE = Symbol.for('react.client.reference');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');

type Component = ComponentType<any> &
  Partial<ExoticComponent & { render: ForwardRefRenderFunction<unknown, unknown> }>;

/**
 * Used to mark internal framework components as client components.
 *
 * @param component - The React component to mark as a client component.
 * @param name - The name of the React component.
 *
 * @returns Nothing.
 */
export const wrapClientComponent = (component: Component, name: string) => {
  const chunkId = name.toLowerCase();

  if (typeof window === 'undefined') {
    Object.defineProperties(
      component.$$typeof === REACT_FORWARD_REF_TYPE ? component.render : component,
      {
        $$typeof: { value: CLIENT_REFERENCE },
        name: { value: name },
        chunk: { value: chunkId },
        id: { value: `native-${name}` },
      },
    );
  } else {
    window.BLADE_CHUNKS[chunkId] = { [name]: component };
  }
};
