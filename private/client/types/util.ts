type DeferredPromise<T> = {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
};

export type DeferredPromises<T = unknown> = Record<string, DeferredPromise<T>>;

export type RevalidationReason =
  | 'window focused'
  | 'went online'
  | 'interval'
  | 'page changed'
  | 'files updated';
