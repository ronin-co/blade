import type { ReactElement, ReactNode } from 'react';

const REACT_ELEMENT_TYPE = Symbol.for('react.element');

const PENDING = 'pending';
const BLOCKED = 'blocked';
const RESOLVED_MODEL = 'resolved_model';
const RESOLVED_MODULE = 'resolved_module';
const INITIALIZED = 'fulfilled';
const ERRORED = 'rejected';

declare class Chunk {
  constructor(
    status: Chunk['status'],
    value: Chunk['value'],
    reason: Chunk['reason'],
    response: Chunk['_response'],
  );

  status:
    | typeof PENDING
    | typeof BLOCKED
    | typeof RESOLVED_MODEL
    | typeof RESOLVED_MODULE
    | typeof INITIALIZED
    | typeof ERRORED;
  value: {
    chunks: number[];
    name: string;
  } | null;
  reason: Error | ((reason: any) => unknown)[] | null;
  _response: ChunkResponse;
  deps: number;

  then: (...args: Parameters<typeof Promise.prototype.then>) => void;
}
interface ChunkResponse {
  _chunks: Map<number, Chunk>;
  _partialRow: string;
  _fromJSON?: Parameters<typeof JSON.parse>[1];
}

// We subclass `Promise.prototype` so that we get other methods like `.catch`.
function Chunk(
  this: Chunk,
  status: Chunk['status'],
  value: Chunk['value'],
  reason: Chunk['reason'],
  response: Chunk['_response'],
) {
  this.status = status;
  this.value = value;
  this.reason = reason;
  this._response = response;
}

// TODO: This doesn't return a new Promise chain unlike the real `.then`.
Chunk.prototype = Object.create(Promise.prototype);

Chunk.prototype.then = function (resolve, reject) {
  // If we have resolved content, we try to initialize it first, which might put us back
  // into one of the other states.

  switch (this.status) {
    case INITIALIZED:
      resolve?.(this.value);
      break;

    case PENDING:
    case BLOCKED:
      if (resolve) {
        if (this.value === null) this.value = [] as unknown as Chunk['value'];
        if (Array.isArray(this.value)) this.value?.push(resolve);
      }

      if (reject) {
        if (this.reason === null) this.reason = [];
        if (Array.isArray(this.reason)) this.reason?.push(reject);
      }

      break;

    default:
      reject?.(this.reason);
      break;
  }
};

const parseModel = (
  response: ChunkResponse,
  json: string,
): {
  chunks: number[];
  name: string;
} => JSON.parse(json, response._fromJSON);

const createPendingChunk = (response: ChunkResponse) =>
  new Chunk(PENDING, null, null, response);
const createErrorChunk = (response: ChunkResponse, error: Error) =>
  new Chunk(ERRORED, null, error, response);

const triggerErrorOnChunk = (chunk: Chunk, error: Error) => {
  // We already resolved. We didn't expect to see this.
  if (chunk.status !== PENDING && chunk.status !== BLOCKED) return;

  const erroredChunk = chunk;

  erroredChunk.status = ERRORED;
  erroredChunk.reason = error;
};

const reportGlobalError = (response: ChunkResponse, error: Error) => {
  response._chunks.forEach((chunk: Chunk) => {
    // If this chunk was already resolved or errored, it won't trigger an error but if it
    // wasn't then we need to because we won't be getting any new data to resolve it.
    if (chunk.status === PENDING) triggerErrorOnChunk(chunk, error);
  });
};

const createElement = (
  type: ReactElement['type'],
  key: ReactElement['key'],
  props: ReactElement['props'],
): ReactElement => {
  const element = {
    // This tag allows us to uniquely identify this as a React Element.
    $$typeof: REACT_ELEMENT_TYPE,
    // Built-in properties that belong on the element.
    type: type,
    key: key,
    ref: null,
    props: props,
    // Record the component responsible for creating this element.
    _owner: null,

    // We don't really need to add any of these but keeping them for good measure.
    // Unfortunately, `_store` is enumerable in jest matchers so for equality to work, we
    // need to keep it or make `_store` non-enumerable in the other file.
    _store: {},
  };

  Object.defineProperty(element._store, 'validated', {
    configurable: false,
    enumerable: false,
    writable: true,
    value: true, // This element has already been validated on the server.
  });

  Object.defineProperty(element, '_self', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: null,
  });

  Object.defineProperty(element, '_source', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: null,
  });

  return element;
};

const getChunk = (response: ChunkResponse, id: number): Chunk => {
  const chunks = response._chunks;
  let chunk = chunks.get(id);

  if (!chunk) {
    chunk = createPendingChunk(response);
    chunks.set(id, chunk);
  }

  return chunk;
};

const parseModelString = (
  response: ChunkResponse,
  _parentObject: Record<string, string>,
  _key: string,
  value: string,
) => {
  if (value === '$') return REACT_ELEMENT_TYPE;
  if (value[0] !== '$') return value;

  switch (value[1]) {
    // This was an escaped string value.
    case '$': {
      return value.substring(1);
    }

    case 'S': {
      return Symbol.for(value.substring(2));
    }

    default: {
      // We assume that anything else is a reference ID.
      const id = Number.parseInt(value.substring(1), 16);
      const chunk = getChunk(response, id);

      switch (chunk.status) {
        case INITIALIZED:
          return chunk.value;

        default:
          throw chunk.reason;
      }
    }
  }
};

const parseModelTuple = (_response: ChunkResponse, value: any) => {
  return value[0] === REACT_ELEMENT_TYPE
    ? createElement(value[1], value[2], value[3])
    : value;
};

const resolveModel = (response: ChunkResponse, id: number, model: string) => {
  const chunks = response._chunks;
  const chunk = chunks.get(id);

  if (chunk) {
    // We already resolved. We didn't expect to see this.
    if (chunk.status !== PENDING) return;

    const resolveListeners = chunk.value as unknown as ((
      reason: Chunk['value'] | Error,
    ) => void)[];
    const resolvedChunk = chunk;

    resolvedChunk.status = RESOLVED_MODEL;
    resolvedChunk.value = model as unknown as Chunk['value'];

    if (resolveListeners !== null) {
      const value = parseModel(chunk._response, chunk.value as unknown as string);

      const initializedChunk = chunk;

      initializedChunk.status = INITIALIZED;
      initializedChunk.value = value;

      for (let i = 0; i < resolveListeners.length; i++) {
        const listener = resolveListeners[i];
        listener(value);
      }
    }
  }
};

const resolveModule = (response: ChunkResponse, id: number, model: string) => {
  const chunks = response._chunks;
  const chunk = getChunk(response, id);
  const moduleReference = parseModel(response, model);

  try {
    const moduleExports = window['BLADE_CHUNKS'][moduleReference.chunks[0]];
    const value = moduleExports[moduleReference.name] as Chunk['value'];
    const initializedChunk = chunk;

    initializedChunk.status = INITIALIZED;
    initializedChunk.value = value;
  } catch (error) {
    const erroredChunk = chunk;

    erroredChunk.status = ERRORED;
    erroredChunk.reason = error as Error;
  }

  chunks.set(id, chunk);
};

const resolveErrorDev = (
  response: ChunkResponse,
  id: number,
  digest: string,
  message: string,
  stack: Error['stack'],
) => {
  const details = message || 'A Server Components error occurred without a message';
  const error: Error & { digest?: string } = new Error(details);

  error.stack = stack;
  error.digest = digest;

  const errorWithDigest = error;
  const chunks = response._chunks;
  const chunk = chunks.get(id);

  if (chunk) {
    triggerErrorOnChunk(chunk, errorWithDigest);
  } else {
    chunks.set(id, createErrorChunk(response, errorWithDigest));
  }
};

const processFullRow = (response: ChunkResponse, row: string) => {
  if (row === '') return;

  const colon = row.indexOf(':', 0);
  const id = Number.parseInt(row.substring(0, colon), 16);
  const tag = row[colon + 1];

  switch (tag) {
    case 'I': {
      resolveModule(response, id, row.substring(colon + 2));
      return;
    }

    case 'E': {
      const errorInfo = JSON.parse(row.substring(colon + 2));
      resolveErrorDev(response, id, errorInfo.digest, errorInfo.message, errorInfo.stack);

      return;
    }

    default: {
      // We assume anything else is JSON.
      resolveModel(response, id, row.substring(colon + 1));
      return;
    }
  }
};

const processBinaryChunk = (response: ChunkResponse, defaultChunk: Buffer) => {
  let chunk = defaultChunk;

  const stringDecoder = new TextDecoder();
  let linebreak = chunk.indexOf(10); // newline

  while (linebreak > -1) {
    const fullrow =
      response._partialRow + stringDecoder.decode(chunk.subarray(0, linebreak));
    processFullRow(response, fullrow);
    response._partialRow = '';
    chunk = chunk.subarray(linebreak + 1);
    linebreak = chunk.indexOf(10); // newline
  }

  response._partialRow += stringDecoder.decode(chunk, {
    stream: true,
  });
};

const createFromJSONCallback =
  (response: ChunkResponse) => (key: string, value: unknown) => {
    // We can't use `.bind` here because we need the "this" value.
    if (typeof value === 'string')
      return parseModelString(
        response,
        this as unknown as Record<string, string>,
        key,
        value,
      );
    if (typeof value === 'object' && value !== null)
      return parseModelTuple(response, value);

    return value;
  };

const startReadingFromStream = (response: ChunkResponse, stream: ReadableStream) => {
  const reader = stream.getReader();

  const progress = (
    chunk: Awaited<ReturnType<ReadableStreamDefaultReader['read']>>,
  ): Promise<void> | undefined => {
    const { done, value } = chunk;

    if (done) {
      // In case there are any remaining unresolved chunks, they won't be resolved now,
      // so we need to issue an error to those. Ideally, we should be able to early bail
      // out if we kept a ref count of pending chunks.
      reportGlobalError(response, new Error('Connection closed.'));
      return;
    }

    processBinaryChunk(response, value);
    return reader.read().then(progress).catch(error);
  };

  const error = (err: Error) => reportGlobalError(response, err);

  reader.read().then(progress).catch(error);
};

export const createFromReadableStream = (stream: ReadableStream): Promise<ReactNode> => {
  const response: ChunkResponse = {
    _chunks: new Map(),
    _partialRow: '',
  };

  response._fromJSON = createFromJSONCallback(response);

  startReadingFromStream(response, stream);

  return getChunk(response, 0) as unknown as Promise<ReactNode>;
};
