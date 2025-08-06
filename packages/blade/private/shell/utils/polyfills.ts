import { Readable, Writable } from 'node:stream';
import { createDeflate, createDeflateRaw, createGzip } from 'node:zlib';

/**
 * Polyfills the global `CompressionStream` class for runtimes that don't support it.
 */
export const polyfillCompressionStream = () => {
  // Only Bun does not offer support.
  if (typeof Bun === 'undefined') return;

  const transformMap = {
    deflate: createDeflate,
    'deflate-raw': createDeflateRaw,
    gzip: createGzip,
  };

  globalThis.CompressionStream ??= class CompressionStream {
    readable: ReadableStream;
    writable: WritableStream;

    constructor(format: keyof typeof transformMap) {
      const handle = transformMap[format]();
      this.readable = Readable.toWeb(handle) as unknown as ReadableStream;
      this.writable = Writable.toWeb(handle) as unknown as WritableStream;
    }
  };
};
