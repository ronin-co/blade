import { bundleId as clientBundleId } from 'build-meta';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import { omit } from 'radash';
import type { ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { fetchRetry } from '@/private/client/utils/data';
import { createFromReadableStream } from '@/private/client/utils/parser';
import type { PageFetchingOptions } from '@/private/universal/types/util';
import { getOutputFile } from '@/private/universal/utils/paths';

/**
 * Downloads a CSS or JS bundle from the server, without evaluating it.
 *
 * @param bundleId - The ID of the bundle to download.
 * @param type - The type of the bundle to download. Can be either 'style' or 'script'.
 *
 * @returns A promise that resolves once the bundle is downloaded.
 */
const loadResource = async (bundleId: string, type: 'style' | 'script') => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');

    link.rel = 'preload';
    link.as = type;
    link.onload = resolve;
    link.onerror = reject;
    link.href = `/${getOutputFile(bundleId, type === 'style' ? 'css' : 'js')}`;

    document.head.appendChild(link);
  });
};

type EventCallback = ({ data, id }: { data: string; id: string }) => void;

export interface EventStream {
  addEventListener: (type: string, callback: EventCallback) => void;
  close: () => void;
}

/**
 * Sends a request for rendering a page to the server, which opens a readable stream.
 *
 * @param url - The URL of the page to render.
 * @param body - An optional body for the outgoing request.
 *
 * @returns A readable stream of events, with a new event getting submitted for every
 * server-side page render.
 */
export const createStreamSource = async (
  url: string,
  body?: FormData,
): Promise<EventStream> => {
  const response = await fetchRetry(url, {
    method: 'POST',
    body,
    headers: {
      Accept: 'text/event-stream',
      'X-Bundle-Id': clientBundleId,
    },
  });

  // If the status code is not in the 200-299 range, we want to throw an error that will
  // be caught and rendered further upwards in the code.
  if (!response.ok) throw new Error(await response.text());
  if (!response.body) throw new Error('Empty response body');

  const eventStream = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream());

  const reader = eventStream.getReader();
  const listeners = new Map<string, Array<EventCallback>>();

  const dispatchStreamEvent = (type: string, data: string, id: string) => {
    return (listeners.get(type) || []).forEach((cb) => cb({ data, id }));
  };

  // Start reading the stream, but don't block the execution of the current scope.
  (async () => {
    let done = false;

    while (!done) {
      let value;
      ({ value, done } = await reader.read());
      dispatchStreamEvent(value?.event!, value?.data!, value?.id!);
    }
  })();

  return {
    addEventListener: (type: string, callback: EventCallback) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(callback);
    },
    close: () => {
      // reader.cancel()
    },
  };
};

const SESSION: {
  root?: import('react-dom/client').Root;
  source?: import('../utils/page').EventStream;
} = {};

/**
 * Receives a React node and renders it at the root of the page.
 *
 * @param content - The React node to render.
 *
 * @returns Nothing.
 */
export const renderRoot = (content: ReactNode): void => {
  if (SESSION.root) {
    SESSION.root.render(content);
    return;
  }

  SESSION.root = hydrateRoot(document, content, {
    onRecoverableError(error, errorInfo) {
      console.error('Hydration error occurred:', error, errorInfo);
    },
  });
};

/**
 * Resolves a new page from the server-side of Blade.
 *
 * @param path - The path of the page.
 * @param subscribe - Whether to subscribe to subsequent updates from the server.
 * @param options - Additional options for how to resolve the page.
 *
 * @returns A promise that resolves to a page if `subscribe` is `false`. If it is `true`,
 * the promise will never resolve. Instead, the function will render the subsequent
 * updates directly.
 */
export const fetchPage = async (
  path: string,
  subscribe: boolean,
  options?: PageFetchingOptions,
): Promise<ReactNode> => {
  let body;

  if (options && Object.keys(options).length > 0) {
    const formData = new FormData();

    formData.append('options', JSON.stringify(omit(options, ['files'])));

    // Since binary data cannot be serialized into JSON, we need to send it separately
    // as form data fields.
    if (options.files) {
      for (const [identifier, value] of options.files.entries()) {
        formData.append('files', value, identifier);
      }
    }

    body = formData;
  }

  // Close the previous stream, since we're opening a new one.
  if (subscribe) SESSION.source?.close();

  // Open a new stream.
  const stream = await createStreamSource(path, body);

  // Immmediately start tracking the latest stream.
  if (subscribe) SESSION.source = stream;

  return new Promise((resolve) => {
    stream.addEventListener('update', async (event) => {
      const dataStream = new Blob([event.data]).stream();
      const content = await createFromReadableStream(dataStream);

      if (subscribe) return renderRoot(content);

      stream.close();
      resolve(content);
    });

    stream.addEventListener('update-bundle', (event) => {
      const serverBundleId = event.id.split('-').pop() as string;
      mountNewBundle(serverBundleId, event.data);
    });
  });
};

export const mountNewBundle = async (bundleId: string, markup: string) => {
  // Immediately close the connection, since we don't want to receive further updates
  // from the server, now that we know that the client bundles are outdated.
  SESSION.source?.close();
  delete SESSION.source;

  // Download the new markup, CSS, and JS at the same time, but don't execute any of them
  // just yet.
  const [newMarkup] = await Promise.all([
    markup,
    loadResource(bundleId, 'style'),
    loadResource(bundleId, 'script'),
  ]);

  // Unmount React and replace the DOM with the static HTML markup, which then also loads
  // the updated CSS and JS bundles and mounts a new React root. This ensures that not
  // only the CSS and JS bundles can be upgraded, but also React itself.
  SESSION.root?.unmount();
  delete SESSION.root;

  const parser = new DOMParser();
  const newDocument = parser.parseFromString(newMarkup, 'text/html');

  // Replace the inner markup of the document element, since it is not possible to
  // replace the document element itself using DOM APIs.
  document.documentElement.innerHTML = newDocument.documentElement.innerHTML;

  // Copy over every attribute from the new document element to the current one, due to
  // the constraint mentioned further above.
  [...Array.from(newDocument.documentElement.attributes)].forEach(({ name, value }) => {
    document.documentElement.setAttribute(name, value);
  });

  // Since rendering the markup above only evaluates the CSS, we have to separately
  // explicitly run the JS as well.
  for (const oldScript of Array.from(document.querySelectorAll('script.blade-script'))) {
    // Cloning the old element will not cause the script to be executed. Instead, we must
    // creae a new element with the same attributes and append it to the DOM.
    const newScript = document.createElement('script');
    // Copy over every attribute
    for (const attr of Array.from(oldScript.attributes)) {
      newScript.setAttribute(attr.name, attr.value);
    }
    document.head.appendChild(newScript);
    oldScript.remove();
  }

  // Print debugging information.
  console.debug('Mounted new client bundles');
};
