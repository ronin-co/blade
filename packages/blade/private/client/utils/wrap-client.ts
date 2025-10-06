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

  // @ts-expect-error The `Netlify` global only exists in the Netlify environment.
  const isNetlify = typeof Netlify !== 'undefined';
  if (typeof window === 'undefined' || isNetlify) {
    let target: Component | ForwardRefRenderFunction<unknown, unknown> | undefined =
      component;

    // Unwrap forwardRef(...) to its render function if present.
    if (target && (target as any).$$typeof === REACT_FORWARD_REF_TYPE) {
      target = (target as any).render as unknown as Component;
    }

    if (typeof target === 'function') {
      Object.defineProperties(target as object, {
        $$typeof: { value: CLIENT_REFERENCE },
        name: { value: name },
        chunk: { value: chunkId },
        id: { value: `native-${name}` },
      });
    }
  } else {
    if (!window['BLADE_CHUNKS']) window['BLADE_CHUNKS'] = {};
    window.BLADE_CHUNKS[chunkId] = { [name]: component };
  }
};
