import type { Asset } from '@/private/universal/types/util';

const PLACEHOLDER = 'WORKER_URL';

/**
 * Register the service worker for the application. This function must not make use of
 * other functions, since the function is serialized using `toString()`.
 *
 * @returns Nothing.
 */
const registerWorker = () => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(PLACEHOLDER, { scope: '/' })
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
  return registerWorker.toString().replace(PLACEHOLDER, JSON.stringify(asset.source));
};
