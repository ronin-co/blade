import type { Asset } from '@/private/universal/types/util';

/**
 * Register the service worker for the application. This function must not make use of
 * other functions, since the function is serialized using `toString()`.
 *
 * @returns Nothing.
 */
const registerWorker = () => {
  if (!navigator.serviceWorker) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('WORKER_URL', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Registered:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newSW = registration.installing;
          if (!newSW) return;

          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              // A new SW is waiting—tell it to activate immediately:
              newSW.postMessage({ action: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(console.error);
  });
};

export const composeWorkerRegistration = (asset: Asset) => {
  const func = registerWorker.toString().replace('WORKER_URL', asset.source);
  const funcMinified = func.replace(/\s+/g, '');

  return `(${funcMinified})();`;
};
