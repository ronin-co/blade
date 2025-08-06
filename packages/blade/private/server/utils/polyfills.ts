/**
 * Polyfills the global `CompressionStream` class for runtimes that don't support it.
 */
export const polyfillCompressionStream = async () => {
    // Only Bun does not offer support.
    if (typeof Bun === 'undefined') return;

  // We use dynamic imports to prevent `esbuild` from detecting and inlining them.
  const prefix = 'node:';
  const { Readable, Writable } = await import(`${prefix}stream`);
  const zlib = await import(`${prefix}zlib`);

  const transformMap = {
    deflate: zlib.createDeflate,
    'deflate-raw': zlib.createDeflateRaw,
    gzip: zlib.createGzip,
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
