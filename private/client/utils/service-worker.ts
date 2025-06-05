import type { Asset } from '@/private/universal/types/util';

/**
 * Register the service worker for the application. This function must not make use of
 * other functions, since the function is serialized using `toString()`.
 *
 * @returns Nothing.
 */
const registerWorker = (): void => {
  if (!navigator.serviceWorker) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('WORKER_URL', { scope: '/', type: 'module' })
      .then(({ scope, installing, addEventListener }) => {
        console.log('[SW] Registered:', scope);

        addEventListener('updatefound', () => {
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              // A new SW is waiting — tell it to activate immediately:
              installing.postMessage({ action: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(console.error);
  });
};

export const composeWorkerRegistration = (asset: Asset): string => {
  const func = registerWorker.toString().replace('WORKER_URL', asset.source);
  const funcMinified = func.replace(/\s+/g, '');

  return `(${funcMinified})();`;
};
