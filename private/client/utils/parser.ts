import type { ReactElement, ReactNode } from 'react';

const REACT_ELEMENT_TYPE = Symbol.for('react.element');

/** The shape of a chunk's resolved value. */
type ChunkValue =
  | {
      chunks: number[];
      name: string;
    }
  | ReactElement
  | ReactNode
  | string
  | symbol
  | null;

/** The shape of an enhanced Promise that includes our custom properties. */
interface EnhancedPromise<T> extends Promise<T> {
  resolve: (value: T) => void;
  _result?: T;
}

interface ChunkResponse {
  _chunks: Map<number, EnhancedPromise<ChunkValue>>;
  _partialRow: string;
  _fromJSON?: Parameters<typeof JSON.parse>[1];
}

const parseModel = (
  response: ChunkResponse,
  json: string,
): {
  chunks: number[];
  name: string;
} => JSON.parse(json, response._fromJSON);

const createPendingChunk = (): EnhancedPromise<ChunkValue> => {
  let resolve!: (value: ChunkValue) => void;
  const promise = new Promise<ChunkValue>((r) => {
    resolve = r;
  }) as EnhancedPromise<ChunkValue>;
  promise.resolve = resolve;
  return promise;
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
  };

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

const parseModelString = (
  response: ChunkResponse,
  _parentObject: Record<string, string>,
  _key: string,
  value: string,
): ChunkValue => {
  if (value === '$') return REACT_ELEMENT_TYPE;
  if (value[0] !== '$') return value;

  switch (value[1]) {
    case '$': {
      return value.substring(1);
    }
    case 'S': {
      return Symbol.for(value.substring(2));
    }
    default: {
      const id = Number.parseInt(value.substring(1), 16);
      const chunk = response._chunks.get(id);
      if (!chunk) {
        throw new Error(`Missing chunk with id: ${id}`);
      }
      if (chunk._result !== undefined) {
        return chunk._result;
      }
      throw chunk;
    }
  }
};

const parseModelTuple = (
  _response: ChunkResponse,
  value:
    | [symbol, ReactElement['type'], ReactElement['key'], ReactElement['props']]
    | unknown,
): ReactElement | unknown => {
  return Array.isArray(value) && value[0] === REACT_ELEMENT_TYPE
    ? createElement(value[1], value[2], value[3])
    : value;
};

const resolveModel = (response: ChunkResponse, id: number, model: string): void => {
  const chunks = response._chunks;
  const chunk = chunks.get(id);

  if (chunk) {
    const value = parseModel(response, model);
    chunk._result = value;
    chunk.resolve(value);
  }
};

const resolveModule = (response: ChunkResponse, id: number, model: string): void => {
  const chunks = response._chunks;
  const chunk = createPendingChunk();
  const moduleReference = parseModel(response, model);

  const moduleExports = (
    window as unknown as { BLADE_CHUNKS: Record<number, Record<string, ChunkValue>> }
  )['BLADE_CHUNKS'][moduleReference.chunks[0]];
  const value = moduleExports[moduleReference.name];

  chunk._result = value;
  chunk.resolve(value);
  chunks.set(id, chunk);
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
      new Error('Connection closed.');
      return;
    }

    processBinaryChunk(response, value);
    return reader.read().then(progress);
  };

  reader.read().then(progress);
};

export const createFromReadableStream = (stream: ReadableStream): Promise<ReactNode> => {
  const response: ChunkResponse = {
    _chunks: new Map(),
    _partialRow: '',
  };

  response._fromJSON = createFromJSONCallback(response);

  startReadingFromStream(response, stream);

  const chunk = createPendingChunk();
  response._chunks.set(0, chunk);

  return chunk as Promise<ReactNode>;
};
