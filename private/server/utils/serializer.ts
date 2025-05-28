/**
 * Copyright (c) Meta Platforms, Inc. and affiliates (partially).
 *
 * Forked and modified from: https://github.com/facebook/react
 */

// @ts-nocheck

import React from 'react';
import { REACT_CONTEXT } from '../worker/context';

const ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

function error(format) {
  for (
    let _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1;
    _key2 < _len2;
    _key2++
  ) {
    args[_key2 - 1] = arguments[_key2];
  }

  printWarning('error', format, args);
}

function printWarning(level, defaultFormat, defaultArgs) {
  let format = defaultFormat;
  let args = defaultArgs;

  const ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
  const stack = ReactDebugCurrentFrame.getStackAddendum();

  if (stack !== '') {
    format += '%s';
    args = args.concat([stack]);
  }

  const argsWithFormat = args.map((item) => String(item)); // Careful: RN currently depends on this prefix

  argsWithFormat.unshift(`Warning: ${format}`); // We intentionally don't use spread (or .apply) directly because it
  // breaks IE9: https://github.com/facebook/react/issues/13610

  Function.prototype.apply.call(console[level], console, argsWithFormat);
}

function scheduleWork(callback) {
  callback();
}

const VIEW_SIZE = 512;
let currentView = null;
let writtenBytes = 0;
function beginWriting(_destination) {
  currentView = new Uint8Array(VIEW_SIZE);
  writtenBytes = 0;
}
function writeChunk(destination, chunk) {
  if (chunk.length === 0) {
    return;
  }

  if (chunk.length > VIEW_SIZE) {
    // This chunk may overflow a single view which implies it was not
    // one that is cached by the streaming renderer. We will enqueue
    // it directly and expect it is not re-used.

    if (writtenBytes > 0) {
      destination.enqueue(new Uint8Array(currentView.buffer, 0, writtenBytes));
      currentView = new Uint8Array(VIEW_SIZE);
      writtenBytes = 0;
    }

    destination.enqueue(chunk);
    return;
  }

  let bytesToWrite = chunk;
  const allowableBytes = currentView.length - writtenBytes;

  if (allowableBytes < bytesToWrite.length) {
    // this chunk would overflow the current view. We enqueue a full view
    // and start a new view with the remaining chunk
    if (allowableBytes === 0) {
      // the current view is already full, send it
      destination.enqueue(currentView);
    } else {
      // fill up the current view and apply the remaining chunk bytes
      // to a new view.
      currentView.set(bytesToWrite.subarray(0, allowableBytes), writtenBytes); // writtenBytes += allowableBytes; // this can be skipped because we are going to immediately reset the view

      destination.enqueue(currentView);
      bytesToWrite = bytesToWrite.subarray(allowableBytes);
    }

    currentView = new Uint8Array(VIEW_SIZE);
    writtenBytes = 0;
  }

  currentView.set(bytesToWrite, writtenBytes);
  writtenBytes += bytesToWrite.length;
}
function writeChunkAndReturn(destination, chunk) {
  writeChunk(destination, chunk); // in web streams there is no backpressure so we can alwas write more

  return true;
}
function completeWriting(destination) {
  if (currentView && writtenBytes > 0) {
    destination.enqueue(new Uint8Array(currentView.buffer, 0, writtenBytes));
    currentView = null;
    writtenBytes = 0;
  }
}
function close(destination) {
  destination.close();
}
const textEncoder = new TextEncoder();
function stringToChunk(content) {
  return textEncoder.encode(content);
}

function closeWithError(destination, error) {
  if (typeof destination.error === 'function') {
    destination.error(error);
  } else {
    // Earlier implementations doesn't support this method. In that environment you're
    // supposed to throw from a promise returned but we don't return a promise in our
    // approach. We could fork this implementation but this is environment is an edge
    // case to begin with. It's even less common to run this in an older environment.
    // Even then, this is not where errors are supposed to happen and they get reported
    // to a global callback in addition to this anyway. So it's fine just to close this.
    destination.close();
  }
}

// This file is an intermediate layer to translate between Flight
const stringify = JSON.stringify;

function serializeRowHeader(tag, id) {
  return `${id.toString(16)}:${tag}`;
}

function processErrorChunkProd(_request, _id, _digest) {
  // These errors should never make it into a build so we don't need to encode them in codes.json
  throw new Error(
    'processErrorChunkProd should never be called while in development mode. Use processErrorChunkDev instead. This is a bug in React.',
  );
}
function processErrorChunkDev(_request, id, digest, message, stack) {
  const errorInfo = {
    digest: digest,
    message: message,
    stack: stack,
  };
  const row = `${serializeRowHeader('E', id) + stringify(errorInfo)}\n`;
  return stringToChunk(row);
}
function processModelChunk(request, id, model) {
  const json = stringify(model, request.toJSON);
  const row = `${id.toString(16)}:${json}\n`;
  return stringToChunk(row);
}
function processReferenceChunk(_request, id, reference) {
  const json = stringify(reference);
  const row = `${id.toString(16)}:${json}\n`;
  return stringToChunk(row);
}
function processModuleChunk(_request, id, moduleMetaData) {
  const json = stringify(moduleMetaData);
  const row = `${serializeRowHeader('I', id) + json}\n`;
  return stringToChunk(row);
}

const CLIENT_REFERENCE_TAG = Symbol.for('react.client.reference');
function getClientReferenceKey(reference) {
  return `${reference.id}#${reference.name}${reference.async ? '#async' : ''}`;
}
function isClientReference(reference) {
  return reference.$$typeof === CLIENT_REFERENCE_TAG;
}
function resolveModuleMetaData(clientReference) {
  return {
    id: clientReference.id,
    chunks: [clientReference.chunk],
    name: clientReference.name,
  };
}

// ATTENTION
// When adding new symbols to this file,
// Please consider also adding to 'react-devtools-shared/src/backend/ReactSymbols'
// The Symbol used to tag the ReactElement-like types.
const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_MEMO_TYPE = Symbol.for('react.memo');
const REACT_MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel');

// It is handled by React separately and shouldn't be written to the DOM.

const RESERVED = 0; // A simple string attribute.
// Attributes that aren't in the filter are presumed to have this type.

const STRING = 1; // A string attribute that accepts booleans in React. In HTML, these are called
// "enumerated" attributes with "true" and "false" as possible values.
// When true, it should be set to a "true" string.
// When false, it should be set to a "false" string.

const BOOLEANISH_STRING = 2; // A real boolean attribute.
// When true, it should be present (set either to an empty string or its name).
// When false, it should be omitted.

const BOOLEAN = 3; // An attribute that can be used as a flag as well as with a value.
// When true, it should be present (set either to an empty string or its name).
// When false, it should be omitted.
// For any other value, should be present with that value.

const OVERLOADED_BOOLEAN = 4; // An attribute that must be numeric or parse as a numeric.
// When falsy, it should be removed.

const NUMERIC = 5; // An attribute that must be positive numeric or parse as a positive numeric.
// When falsy, it should be removed.

const POSITIVE_NUMERIC = 6;

function PropertyInfoRecord(
  name,
  type,
  mustUseProperty,
  attributeName,
  attributeNamespace,
  sanitizeURL,
  removeEmptyString,
) {
  this.acceptsBooleans =
    type === BOOLEANISH_STRING || type === BOOLEAN || type === OVERLOADED_BOOLEAN;
  this.attributeName = attributeName;
  this.attributeNamespace = attributeNamespace;
  this.mustUseProperty = mustUseProperty;
  this.propertyName = name;
  this.type = type;
  this.sanitizeURL = sanitizeURL;
  this.removeEmptyString = removeEmptyString;
} // When adding attributes to this list, be sure to also add them to
// the `possibleStandardNames` module to ensure casing and incorrect
// name warnings.

const properties = {}; // These props are reserved by React. They shouldn't be written to the DOM.

const reservedProps = [
  'children',
  'dangerouslySetInnerHTML', // TODO: This prevents the assignment of defaultValue to regular
  // elements (not just inputs). Now that ReactDOMInput assigns to the
  // defaultValue property -- do we need this?
  'defaultValue',
  'defaultChecked',
  'innerHTML',
  'suppressContentEditableWarning',
  'suppressHydrationWarning',
  'style',
];

reservedProps.push('innerText', 'textContent');

reservedProps.forEach((name) => {
  properties[name] = new PropertyInfoRecord(
    name,
    RESERVED,
    false, // mustUseProperty
    name, // attributeName
    null, // attributeNamespace
    false, // sanitizeURL
    false,
  );
}); // A few React string attributes have a different name.
// This is a mapping from React prop names to the attribute names.

[
  ['acceptCharset', 'accept-charset'],
  ['className', 'class'],
  ['htmlFor', 'for'],
  ['httpEquiv', 'http-equiv'],
].forEach((_ref) => {
  const name = _ref[0];
  const attributeName = _ref[1];

  properties[name] = new PropertyInfoRecord(
    name,
    STRING,
    false, // mustUseProperty
    attributeName, // attributeName
    null, // attributeNamespace
    false, // sanitizeURL
    false,
  );
}); // These are "enumerated" HTML attributes that accept "true" and "false".
// In React, we let users pass `true` and `false` even though technically
// these aren't boolean attributes (they are coerced to strings).

['contentEditable', 'draggable', 'spellCheck', 'value'].forEach((name) => {
  properties[name] = new PropertyInfoRecord(
    name,
    BOOLEANISH_STRING,
    false, // mustUseProperty
    name.toLowerCase(), // attributeName
    null, // attributeNamespace
    false, // sanitizeURL
    false,
  );
}); // These are "enumerated" SVG attributes that accept "true" and "false".
// In React, we let users pass `true` and `false` even though technically
// these aren't boolean attributes (they are coerced to strings).
// Since these are SVG attributes, their attribute names are case-sensitive.

['autoReverse', 'externalResourcesRequired', 'focusable', 'preserveAlpha'].forEach(
  (name) => {
    properties[name] = new PropertyInfoRecord(
      name,
      BOOLEANISH_STRING,
      false, // mustUseProperty
      name, // attributeName
      null, // attributeNamespace
      false, // sanitizeURL
      false,
    );
  },
); // These are HTML boolean attributes.

[
  'allowFullScreen',
  'async', // Note: there is a special case that prevents it from being written to the DOM
  // on the client side because the browsers are inconsistent. Instead we call focus().
  'autoFocus',
  'autoPlay',
  'controls',
  'default',
  'defer',
  'disabled',
  'disablePictureInPicture',
  'disableRemotePlayback',
  'formNoValidate',
  'hidden',
  'loop',
  'noModule',
  'noValidate',
  'open',
  'playsInline',
  'readOnly',
  'required',
  'reversed',
  'scoped',
  'seamless', // Microdata
  'itemScope',
].forEach((name) => {
  properties[name] = new PropertyInfoRecord(
    name,
    BOOLEAN,
    false, // mustUseProperty
    name.toLowerCase(), // attributeName
    null, // attributeNamespace
    false, // sanitizeURL
    false,
  );
}); // These are the few React props that we set as DOM properties
// rather than attributes. These are all booleans.

[
  'checked', // Note: `option.selected` is not updated if `select.multiple` is
  // disabled with `removeAttribute`. We have special logic for handling this.
  'multiple',
  'muted',
  'selected', // NOTE: if you add a camelCased prop to this list,
  // you'll need to set attributeName to name.toLowerCase()
  // instead in the assignment below.
].forEach((name) => {
  properties[name] = new PropertyInfoRecord(
    name,
    BOOLEAN,
    true, // mustUseProperty
    name, // attributeName
    null, // attributeNamespace
    false, // sanitizeURL
    false,
  );
}); // These are HTML attributes that are "overloaded booleans": they behave like
// booleans, but can also accept a string value.

[
  'capture',
  'download', // NOTE: if you add a camelCased prop to this list,
  // you'll need to set attributeName to name.toLowerCase()
  // instead in the assignment below.
].forEach((name) => {
  properties[name] = new PropertyInfoRecord(
    name,
    OVERLOADED_BOOLEAN,
    false, // mustUseProperty
    name, // attributeName
    null, // attributeNamespace
    false, // sanitizeURL
    false,
  );
}); // These are HTML attributes that must be positive numbers.

[
  'cols',
  'rows',
  'size',
  'span', // NOTE: if you add a camelCased prop to this list,
  // you'll need to set attributeName to name.toLowerCase()
  // instead in the assignment below.
].forEach((name) => {
  properties[name] = new PropertyInfoRecord(
    name,
    POSITIVE_NUMERIC,
    false, // mustUseProperty
    name, // attributeName
    null, // attributeNamespace
    false, // sanitizeURL
    false,
  );
}); // These are HTML attributes that must be numbers.

['rowSpan', 'start'].forEach((name) => {
  properties[name] = new PropertyInfoRecord(
    name,
    NUMERIC,
    false, // mustUseProperty
    name.toLowerCase(), // attributeName
    null, // attributeNamespace
    false, // sanitizeURL
    false,
  );
});
const CAMELIZE = /[-:]([a-z])/g;

const capitalize = (token) => token[1].toUpperCase(); // This is a list of all SVG attributes that need special casing, namespacing,
// or boolean value assignment. Regular attributes that just accept strings
// and have the same names are omitted, just like in the HTML attribute filter.
// Some of these attributes can be hard to find. This list was created by
// scraping the MDN documentation.

[
  'accent-height',
  'alignment-baseline',
  'arabic-form',
  'baseline-shift',
  'cap-height',
  'clip-path',
  'clip-rule',
  'color-interpolation',
  'color-interpolation-filters',
  'color-profile',
  'color-rendering',
  'dominant-baseline',
  'enable-background',
  'fill-opacity',
  'fill-rule',
  'flood-color',
  'flood-opacity',
  'font-family',
  'font-size',
  'font-size-adjust',
  'font-stretch',
  'font-style',
  'font-variant',
  'font-weight',
  'glyph-name',
  'glyph-orientation-horizontal',
  'glyph-orientation-vertical',
  'horiz-adv-x',
  'horiz-origin-x',
  'image-rendering',
  'letter-spacing',
  'lighting-color',
  'marker-end',
  'marker-mid',
  'marker-start',
  'overline-position',
  'overline-thickness',
  'paint-order',
  'panose-1',
  'pointer-events',
  'rendering-intent',
  'shape-rendering',
  'stop-color',
  'stop-opacity',
  'strikethrough-position',
  'strikethrough-thickness',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'text-anchor',
  'text-decoration',
  'text-rendering',
  'underline-position',
  'underline-thickness',
  'unicode-bidi',
  'unicode-range',
  'units-per-em',
  'v-alphabetic',
  'v-hanging',
  'v-ideographic',
  'v-mathematical',
  'vector-effect',
  'vert-adv-y',
  'vert-origin-x',
  'vert-origin-y',
  'word-spacing',
  'writing-mode',
  'xmlns:xlink',
  'x-height', // NOTE: if you add a camelCased prop to this list,
  // you'll need to set attributeName to name.toLowerCase()
  // instead in the assignment below.
].forEach((attributeName) => {
  const name = attributeName.replace(CAMELIZE, capitalize);

  properties[name] = new PropertyInfoRecord(
    name,
    STRING,
    false, // mustUseProperty
    attributeName,
    null, // attributeNamespace
    false, // sanitizeURL
    false,
  );
}); // String SVG attributes with the xlink namespace.

[
  'xlink:actuate',
  'xlink:arcrole',
  'xlink:role',
  'xlink:show',
  'xlink:title',
  'xlink:type', // NOTE: if you add a camelCased prop to this list,
  // you'll need to set attributeName to name.toLowerCase()
  // instead in the assignment below.
].forEach((attributeName) => {
  const name = attributeName.replace(CAMELIZE, capitalize);

  properties[name] = new PropertyInfoRecord(
    name,
    STRING,
    false, // mustUseProperty
    attributeName,
    'http://www.w3.org/1999/xlink',
    false, // sanitizeURL
    false,
  );
}); // String SVG attributes with the xml namespace.

[
  'xml:base',
  'xml:lang',
  'xml:space', // NOTE: if you add a camelCased prop to this list,
  // you'll need to set attributeName to name.toLowerCase()
  // instead in the assignment below.
].forEach((attributeName) => {
  const name = attributeName.replace(CAMELIZE, capitalize);

  properties[name] = new PropertyInfoRecord(
    name,
    STRING,
    false, // mustUseProperty
    attributeName,
    'http://www.w3.org/XML/1998/namespace',
    false, // sanitizeURL
    false,
  );
}); // These attribute exists both in HTML and SVG.
// The attribute name is case-sensitive in SVG so we can't just use
// the React name like we do for attributes that exist only in HTML.

['tabIndex', 'crossOrigin'].forEach((attributeName) => {
  properties[attributeName] = new PropertyInfoRecord(
    attributeName,
    STRING,
    false, // mustUseProperty
    attributeName.toLowerCase(), // attributeName
    null, // attributeNamespace
    false, // sanitizeURL
    false,
  );
}); // These attributes accept URLs. These must not allow javascript: URLS.
// These will also need to accept Trusted Types object in the future.

const xlinkHref = 'xlinkHref';

properties[xlinkHref] = new PropertyInfoRecord(
  'xlinkHref',
  STRING,
  false, // mustUseProperty
  'xlink:href',
  'http://www.w3.org/1999/xlink',
  true, // sanitizeURL
  false,
);

['src', 'href', 'action', 'formAction'].forEach((attributeName) => {
  properties[attributeName] = new PropertyInfoRecord(
    attributeName,
    STRING,
    false, // mustUseProperty
    attributeName.toLowerCase(), // attributeName
    null, // attributeNamespace
    true, // sanitizeURL
    true,
  );
});

/**
 * CSS properties which accept numbers but are not in units of "px".
 */
const isUnitlessNumber = {
  animationIterationCount: true,
  aspectRatio: true,
  borderImageOutset: true,
  borderImageSlice: true,
  borderImageWidth: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  columns: true,
  flex: true,
  flexGrow: true,
  flexPositive: true,
  flexShrink: true,
  flexNegative: true,
  flexOrder: true,
  gridArea: true,
  gridRow: true,
  gridRowEnd: true,
  gridRowSpan: true,
  gridRowStart: true,
  gridColumn: true,
  gridColumnEnd: true,
  gridColumnSpan: true,
  gridColumnStart: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,
  // SVG-related properties
  fillOpacity: true,
  floodOpacity: true,
  stopOpacity: true,
  strokeDasharray: true,
  strokeDashoffset: true,
  strokeMiterlimit: true,
  strokeOpacity: true,
  strokeWidth: true,
};
/**
 * @param {string} prefix vendor-specific prefix, eg: Webkit
 * @param {string} key style name, eg: transitionDuration
 * @return {string} style name prefixed with `prefix`, properly camelCased, eg:
 * WebkitTransitionDuration
 */

function prefixKey(prefix, key) {
  return prefix + key.charAt(0).toUpperCase() + key.substring(1);
}
/**
 * Support style names that may come passed in prefixed by adding permutations
 * of vendor prefixes.
 */

const prefixes = ['Webkit', 'ms', 'Moz', 'O']; // Using Object.keys here, or else the vanilla for-in loop makes IE8 go into an
// infinite loop, because it iterates over the newly added props too.

Object.keys(isUnitlessNumber).forEach((prop) => {
  prefixes.forEach((prefix) => {
    isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
  });
});

const isArrayImpl = Array.isArray;

function isArray(a) {
  return isArrayImpl(a);
}

let currentActiveSnapshot = null;

function popProvider() {
  const prevSnapshot = currentActiveSnapshot;

  if (prevSnapshot === null) {
    throw new Error(
      'Tried to pop a Context at the root of the app. This is a bug in React.',
    );
  }

  prevSnapshot.context._currentValue = prevSnapshot.parentValue;
  currentActiveSnapshot = prevSnapshot.parent;

  return currentActiveSnapshot;
}

let currentRequest = null;
function prepareToUseHooksForRequest(request) {
  currentRequest = request;
}
function resetHooksForRequest() {
  currentRequest = null;
}
function prepareToUseHooksForComponent(prevThenableState) {
  thenableState = prevThenableState;
}

const HooksDispatcher = {
  useMemo: (nextCreate) => nextCreate(),
  useCallback: (callback) => callback,
  useDebugValue: () => {},
  useDeferredValue: unsupportedHook,
  useTransition: unsupportedHook,
  readContext: unsupportedContext,
  useContext: unsupportedContext,
  useReducer: unsupportedHook,
  useRef: unsupportedHook,
  useState: unsupportedHook,
  useInsertionEffect: unsupportedHook,
  useLayoutEffect: unsupportedHook,
  useImperativeHandle: unsupportedHook,
  useEffect: unsupportedHook,
  useId: useId,
  useMutableSource: unsupportedHook,
  useSyncExternalStore: unsupportedHook,
  useCacheRefresh: () => unsupportedRefresh,
  useMemoCache: (size) => {
    const data = new Array(size);

    for (let i = 0; i < size; i++) {
      data[i] = REACT_MEMO_CACHE_SENTINEL;
    }

    return data;
  },
};

function unsupportedHook(...args) {
  console.error('Attributes', ...args);
  throw new Error('This Hook is not supported in Server Components.');
}

function unsupportedRefresh() {
  throw new Error('Refreshing the cache is not supported in Server Components.');
}

function unsupportedContext(...args) {
  console.error('Attributes', ...args);
  throw new Error('Cannot read a Client Context from a Server Component.');
}

function useId() {
  if (currentRequest === null) {
    throw new Error('useId can only be used while React is rendering');
  }

  const id = currentRequest.identifierCount++; // use 'S' for Flight components to distinguish from 'R' and 'r' in Fizz/Client

  return `:${currentRequest.identifierPrefix}S${id.toString(32)}:`;
}

function createSignal() {
  return new AbortController().signal;
}

function resolveCache() {
  if (currentCache) return currentCache;

  const cache = REACT_CONTEXT.getStore();
  if (cache) return cache;

  // Since we override the dispatcher all the time, we're effectively always
  // active and so to support cache() and fetch() outside of render, we yield
  // an empty Map.
  return new Map();
}

const DefaultCacheDispatcher = {
  getCacheSignal: () => {
    const cache = resolveCache();
    let entry = cache.get(createSignal);

    if (entry === undefined) {
      entry = createSignal();
      cache.set(createSignal, entry);
    }

    return entry;
  },
  getCacheForType: (resourceType) => {
    const cache = resolveCache();
    let entry = cache.get(resourceType);

    if (entry === undefined) {
      entry = resourceType(); // TODO: Warn if undefined?

      cache.set(resourceType, entry);
    }

    return entry;
  },
};
let currentCache = null;
function setCurrentCache(cache) {
  currentCache = cache;
  return currentCache;
}
function getCurrentCache() {
  return currentCache;
}

const PENDING = 0;
const COMPLETED = 1;
const ABORTED = 3;
const ERRORED = 4;
const ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
const ReactCurrentCache = ReactSharedInternals.ReactCurrentCache;

function defaultErrorHandler(error) {
  console['error'](error); // Don't transform to our wrapper
}

const OPEN = 0;
const CLOSING = 1;
const CLOSED = 2;
function createRequest(model, onError, identifierPrefix) {
  if (
    ReactCurrentCache.current !== null &&
    ReactCurrentCache.current !== DefaultCacheDispatcher
  ) {
    throw new Error('Currently React only supports one RSC renderer at a time.');
  }

  ReactCurrentCache.current = DefaultCacheDispatcher;
  const abortSet = new Set();
  const pingedTasks = [];
  const request = {
    status: OPEN,
    fatalError: null,
    destination: null,
    cache: new Map(),
    nextChunkId: 0,
    pendingChunks: 0,
    abortableTasks: abortSet,
    pingedTasks: pingedTasks,
    completedModuleChunks: [],
    completedJSONChunks: [],
    completedErrorChunks: [],
    writtenSymbols: new Map(),
    writtenModules: new Map(),
    identifierPrefix: identifierPrefix || '',
    identifierCount: 1,
    onError: onError === undefined ? defaultErrorHandler : onError,
    toJSON: function (key, value) {
      return resolveModelToJSON(request, this, key, value);
    },
  };
  request.pendingChunks++;
  const rootTask = createTask(request, model, abortSet);
  pingedTasks.push(rootTask);
  return request;
}

const POP = {}; // Used for DEV messages to keep track of which parent rendered some props,
// in case they error.

const jsxPropsParents = new WeakMap();
const jsxChildrenParents = new WeakMap();

function attemptResolveElement(request, type, key, ref, props, prevThenableState) {
  if (ref !== null && ref !== undefined) {
    // When the ref moves to the regular props object this will implicitly
    // throw for functions. We could probably relax it to a DEV warning for other
    // cases.
    throw new Error(
      'Refs cannot be used in Server Components, nor passed to Client Components.',
    );
  }
  jsxPropsParents.set(props, type);

  if (typeof props.children === 'object' && props.children !== null) {
    jsxChildrenParents.set(props.children, type);
  }

  if (typeof type === 'function') {
    if (isClientReference(type)) {
      // This is a reference to a Client Component.
      return [REACT_ELEMENT_TYPE, type, key, props];
    } // This is a server-side component.

    prepareToUseHooksForComponent(prevThenableState);
    return type(props);
  }

  if (typeof type === 'string') {
    // This is a host element. E.g. HTML.
    return [REACT_ELEMENT_TYPE, type, key, props];
  }

  if (typeof type === 'symbol') {
    if (type === REACT_FRAGMENT_TYPE) {
      // For key-less fragments, we add a small optimization to avoid serializing
      // it as a wrapper.
      // TODO: If a key is specified, we should propagate its key to any children.
      // Same as if a Server Component has a key.
      return props.children;
    } // This might be a built-in React component. We'll let the client decide.
    // Any built-in works as long as its props are serializable.

    return [REACT_ELEMENT_TYPE, type, key, props];
  }

  if (type != null && typeof type === 'object') {
    if (isClientReference(type)) {
      // This is a reference to a Client Component.
      return [REACT_ELEMENT_TYPE, type, key, props];
    }

    switch (type.$$typeof) {
      case REACT_FORWARD_REF_TYPE: {
        const render = type.render;
        prepareToUseHooksForComponent(prevThenableState);
        return render(props, undefined);
      }

      case REACT_MEMO_TYPE: {
        return attemptResolveElement(
          request,
          type.type,
          key,
          ref,
          props,
          prevThenableState,
        );
      }
    }
  }

  throw new Error(
    `Unsupported Server Component type: ${describeValueForErrorMessage(type)}`,
  );
}

function pingTask(request, task) {
  const pingedTasks = request.pingedTasks;
  pingedTasks.push(task);

  if (pingedTasks.length === 1) {
    scheduleWork(() => performWork(request));
  }
}

function createTask(request, model, abortSet) {
  const id = request.nextChunkId++;
  const task = {
    id: id,
    status: PENDING,
    model: model,
    ping: () => pingTask(request, task),
    thenableState: null,
  };
  abortSet.add(task);
  return task;
}

function serializeByValueID(id) {
  return `$${id.toString(16)}`;
}

function serializeLazyID(id) {
  return `$L${id.toString(16)}`;
}

function serializeSymbolReference(name) {
  return `$S${name}`;
}

function serializeClientReference(request, parent, key, moduleReference) {
  const moduleKey = getClientReferenceKey(moduleReference);
  const writtenModules = request.writtenModules;
  const existingId = writtenModules.get(moduleKey);

  if (existingId !== undefined) {
    if (parent[0] === REACT_ELEMENT_TYPE && key === '1') {
      // If we're encoding the "type" of an element, we can refer
      // to that by a lazy reference instead of directly since React
      // knows how to deal with lazy values. This lets us suspend
      // on this component rather than its parent until the code has
      // loaded.
      return serializeLazyID(existingId);
    }

    return serializeByValueID(existingId);
  }

  try {
    const moduleMetaData = resolveModuleMetaData(moduleReference);
    request.pendingChunks++;
    const moduleId = request.nextChunkId++;
    emitModuleChunk(request, moduleId, moduleMetaData);
    writtenModules.set(moduleKey, moduleId);

    if (parent[0] === REACT_ELEMENT_TYPE && key === '1') {
      // If we're encoding the "type" of an element, we can refer
      // to that by a lazy reference instead of directly since React
      // knows how to deal with lazy values. This lets us suspend
      // on this component rather than its parent until the code has
      // loaded.
      return serializeLazyID(moduleId);
    }

    return serializeByValueID(moduleId);
  } catch (x) {
    request.pendingChunks++;
    const errorId = request.nextChunkId++;
    const digest = logRecoverableError(request, x);
    const _getErrorMessageAndSt3 = getErrorMessageAndStackDev(x);
    const message = _getErrorMessageAndSt3.message;
    const stack = _getErrorMessageAndSt3.stack;

    emitErrorChunkDev(request, errorId, digest, message, stack);

    return serializeByValueID(errorId);
  }
}

function escapeStringValue(value) {
  if (value[0] === '$') {
    // We need to escape $ or @ prefixed strings since we use those to encode
    // references to IDs and as special symbol values.
    return `$${value}`;
  }

  return value;
}

function isObjectPrototype(object) {
  if (!object) {
    return false;
  }

  const ObjectPrototype = Object.prototype;

  if (object === ObjectPrototype) {
    return true;
  } // It might be an object from a different Realm which is
  // still just a plain simple object.

  if (Object.getPrototypeOf(object)) {
    return false;
  }

  const names = Object.getOwnPropertyNames(object);

  for (let i = 0; i < names.length; i++) {
    if (!(names[i] in ObjectPrototype)) {
      return false;
    }
  }

  return true;
}

function isSimpleObject(object) {
  if (!isObjectPrototype(Object.getPrototypeOf(object))) {
    return false;
  }

  const names = Object.getOwnPropertyNames(object);

  for (let i = 0; i < names.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(object, names[i]);

    if (!descriptor) {
      return false;
    }

    if (!descriptor.enumerable) {
      if (
        (names[i] === 'key' || names[i] === 'ref') &&
        typeof descriptor.get === 'function'
      ) {
        // React adds key and ref getters to props objects to issue warnings.
        // Those getters will not be transferred to the client, but that's ok,
        // so we'll special case them.
        continue;
      }

      return false;
    }
  }

  return true;
}

function objectName(object) {
  const name = Object.prototype.toString.call(object);
  return name.replace(/^\[object (.*)\]$/, (_m, p0) => p0);
}

function describeKeyForErrorMessage(key) {
  const encodedKey = JSON.stringify(key);
  return `"${key}"` === encodedKey ? key : encodedKey;
}

function describeValueForErrorMessage(value) {
  switch (typeof value) {
    case 'string': {
      return JSON.stringify(value.length <= 10 ? value : `${value.substr(0, 10)}...`);
    }

    case 'object': {
      if (isArray(value)) {
        return '[...]';
      }

      const name = objectName(value);

      if (name === 'Object') {
        return '{...}';
      }

      return name;
    }

    case 'function':
      return 'function';

    default:
      return String(value);
  }
}

function describeElementType(type) {
  if (typeof type === 'string') {
    return type;
  }

  if (typeof type === 'object') {
    switch (type.$$typeof) {
      case REACT_FORWARD_REF_TYPE:
        return describeElementType(type.render);

      case REACT_MEMO_TYPE:
        return describeElementType(type.type);
    }
  }

  return '';
}

function describeObjectForErrorMessage(objectOrArray, expandedName) {
  const objKind = objectName(objectOrArray);

  if (objKind !== 'Object' && objKind !== 'Array') {
    return objKind;
  }

  let str = '';
  let start = -1;
  let length = 0;

  if (isArray(objectOrArray)) {
    if (jsxChildrenParents.has(objectOrArray)) {
      // Print JSX Children
      const type = jsxChildrenParents.get(objectOrArray);
      str = `<${describeElementType(type)}>`;
      const array = objectOrArray;

      for (let i = 0; i < array.length; i++) {
        const value = array[i];
        let substr;

        if (typeof value === 'string') {
          substr = value;
        } else if (typeof value === 'object' && value !== null) {
          substr = `{${describeObjectForErrorMessage(value)}}`;
        } else {
          substr = `{${describeValueForErrorMessage(value)}}`;
        }

        if (`${i}` === expandedName) {
          start = str.length;
          length = substr.length;
          str += substr;
        } else if (substr.length < 15 && str.length + substr.length < 40) {
          str += substr;
        } else {
          str += '{...}';
        }
      }

      str += `</${describeElementType(type)}>`;
    } else {
      // Print Array
      str = '[';
      const _array = objectOrArray;

      for (let _i = 0; _i < _array.length; _i++) {
        if (_i > 0) {
          str += ', ';
        }

        const _value = _array[_i];

        let _substr;

        if (typeof _value === 'object' && _value !== null) {
          _substr = describeObjectForErrorMessage(_value);
        } else {
          _substr = describeValueForErrorMessage(_value);
        }

        if (`${_i}` === expandedName) {
          start = str.length;
          length = _substr.length;
          str += _substr;
        } else if (_substr.length < 10 && str.length + _substr.length < 40) {
          str += _substr;
        } else {
          str += '...';
        }
      }

      str += ']';
    }
  } else if (objectOrArray.$$typeof === REACT_ELEMENT_TYPE) {
    str = `<${describeElementType(objectOrArray.type)}/>`;
  } else if (jsxPropsParents.has(objectOrArray)) {
    // Print JSX
    const _type = jsxPropsParents.get(objectOrArray);

    str = `<${describeElementType(_type) || '...'}`;
    const object = objectOrArray;
    const names = Object.keys(object);

    for (let _i2 = 0; _i2 < names.length; _i2++) {
      str += ' ';
      const name = names[_i2];
      str += `${describeKeyForErrorMessage(name)}=`;
      const _value2 = object[name];

      let _substr2;

      if (name === expandedName && typeof _value2 === 'object' && _value2 !== null) {
        _substr2 = describeObjectForErrorMessage(_value2);
      } else {
        _substr2 = describeValueForErrorMessage(_value2);
      }

      if (typeof _value2 !== 'string') {
        _substr2 = `{${_substr2}}`;
      }

      if (name === expandedName) {
        start = str.length;
        length = _substr2.length;
        str += _substr2;
      } else if (_substr2.length < 10 && str.length + _substr2.length < 40) {
        str += _substr2;
      } else {
        str += '...';
      }
    }

    str += '>';
  } else {
    // Print Object
    str = '{';
    const _object = objectOrArray;

    const _names = Object.keys(_object);

    for (let _i3 = 0; _i3 < _names.length; _i3++) {
      if (_i3 > 0) {
        str += ', ';
      }

      const _name = _names[_i3];
      str += `${describeKeyForErrorMessage(_name)}: `;
      const _value3 = _object[_name];

      let _substr3;

      if (typeof _value3 === 'object' && _value3 !== null) {
        _substr3 = describeObjectForErrorMessage(_value3);
      } else {
        _substr3 = describeValueForErrorMessage(_value3);
      }

      if (_name === expandedName) {
        start = str.length;
        length = _substr3.length;
        str += _substr3;
      } else if (_substr3.length < 10 && str.length + _substr3.length < 40) {
        str += _substr3;
      } else {
        str += '...';
      }
    }

    str += '}';
  }

  if (expandedName === undefined) {
    return str;
  }

  if (start > -1 && length > 0) {
    const highlight = ' '.repeat(start) + '^'.repeat(length);
    return `\n  ${str}\n  ${highlight}`;
  }

  return `\n  ${str}`;
}

function resolveModelToJSON(request, parent, key, defaultValue) {
  let value = defaultValue;
  const originalValue = parent[key];

  if (typeof originalValue === 'object' && originalValue !== value) {
    if (objectName(originalValue) !== 'Object') {
      const jsxParentType = jsxChildrenParents.get(parent);

      if (typeof jsxParentType === 'string') {
        error(
          '%s objects cannot be rendered as text children. Try formatting it using toString().%s',
          objectName(originalValue),
          describeObjectForErrorMessage(parent, key),
        );
      } else {
        // error('Only plain objects can be passed to Client Components from Server Components. ' + '%s objects are not supported.%s', objectName(originalValue), describeObjectForErrorMessage(parent, key));
      }
    } else {
      error(
        'Only plain objects can be passed to Client Components from Server Components. ' +
          'Objects with toJSON methods are not supported. Convert it manually ' +
          'to a simple value before passing it to props.%s',
        describeObjectForErrorMessage(parent, key),
      );
    }
  }

  switch (value) {
    case REACT_ELEMENT_TYPE:
      return '$';
  }

  while (
    typeof value === 'object' &&
    value !== null &&
    value.$$typeof === REACT_ELEMENT_TYPE
  ) {
    try {
      switch (value.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          // TODO: Concatenate keys of parents onto children.
          const element = value; // Attempt to render the Server Component.

          value = attemptResolveElement(
            request,
            element.type,
            element.key,
            element.ref,
            element.props,
            null,
          );
          break;
        }
      }
    } catch (thrownValue) {
      // Something errored. We'll still send everything we have up until this point.
      // We'll replace this element with a lazy reference that throws on the client
      // once it gets rendered.
      request.pendingChunks++;
      const errorId = request.nextChunkId++;
      const digest = logRecoverableError(request, thrownValue);
      const _getErrorMessageAndSt4 = getErrorMessageAndStackDev(thrownValue);
      const message = _getErrorMessageAndSt4.message;
      const stack = _getErrorMessageAndSt4.stack;

      emitErrorChunkDev(request, errorId, digest, message, stack);

      return serializeLazyID(errorId);
    }
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'object') {
    if (isClientReference(value)) {
      return serializeClientReference(request, parent, key, value);
    }
    if (value === POP) {
      popProvider();

      return undefined;
    }
    if (value !== null && !isArray(value)) {
      // Verify that this is a simple plain object.
      if (objectName(value) !== 'Object') {
        // error('Only plain objects can be passed to Client Components from Server Components. ' + '%s objects are not supported.%s', objectName(value), describeObjectForErrorMessage(parent, key));
      } else if (!isSimpleObject(value)) {
        error(
          'Only plain objects can be passed to Client Components from Server Components. ' +
            'Classes or other objects with methods are not supported.%s',
          describeObjectForErrorMessage(parent, key),
        );
      } else if (Object.getOwnPropertySymbols) {
        const symbols = Object.getOwnPropertySymbols(value);

        if (symbols.length > 0) {
          error(
            'Only plain objects can be passed to Client Components from Server Components. ' +
              'Objects with symbol properties like %s are not supported.%s',
            symbols[0].description,
            describeObjectForErrorMessage(parent, key),
          );
        }
      }
    }

    return value;
  }

  if (typeof value === 'string') {
    return escapeStringValue(value);
  }

  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'undefined'
  ) {
    return value;
  }

  if (typeof value === 'function') {
    if (isClientReference(value)) {
      return serializeClientReference(request, parent, key, value);
    }

    if (/^on[A-Z]/.test(key)) {
      throw new Error(
        `Event handlers cannot be passed to Client Component props.${describeObjectForErrorMessage(parent, key)}\nIf you need interactivity, consider converting part of this to a Client Component.`,
      );
    }
    throw new Error(
      `Functions cannot be passed directly to Client Components because they're not serializable.${describeObjectForErrorMessage(parent, key)}`,
    );
  }

  if (typeof value === 'symbol') {
    const writtenSymbols = request.writtenSymbols;
    const existingId = writtenSymbols.get(value);

    if (existingId !== undefined) {
      return serializeByValueID(existingId);
    }

    const name = value.description;

    if (Symbol.for(name) !== value) {
      throw new Error(
        `Only global symbols received from Symbol.for(...) can be passed to Client Components. The symbol Symbol.for(${value.description}) cannot be found among global symbols.${describeObjectForErrorMessage(parent, key)}`,
      );
    }

    request.pendingChunks++;
    const symbolId = request.nextChunkId++;
    emitSymbolChunk(request, symbolId, name);
    writtenSymbols.set(value, symbolId);
    return serializeByValueID(symbolId);
  }

  if (typeof value === 'bigint') {
    throw new Error(
      `BigInt (${value}) is not yet supported in Client Component props.${describeObjectForErrorMessage(parent, key)}`,
    );
  }

  throw new Error(
    `Type ${typeof value} is not supported in Client Component props.${describeObjectForErrorMessage(parent, key)}`,
  );
}

function logRecoverableError(request, error) {
  const onError = request.onError;
  const errorDigest = onError(error);

  if (errorDigest != null && typeof errorDigest !== 'string') {
    throw new Error(
      `onError returned something with a type other than "string". onError should return a string and may return null or undefined but must not return anything else. It received something of type "${typeof errorDigest}" instead`,
    );
  }

  return errorDigest || '';
}

function getErrorMessageAndStackDev(error) {
  let message;
  let stack = '';

  try {
    if (error instanceof Error) {
      message = String(error.message);

      stack = String(error.stack);
    } else {
      message = `Error: ${error}`;
    }
  } catch (_x) {
    message = 'An error occurred but serializing the error message failed.';
  }

  return {
    message: message,
    stack: stack,
  };
}

function fatalError(request, error) {
  // This is called outside error handling code such as if an error happens in React internals.
  if (request.destination !== null) {
    request.status = CLOSED;
    closeWithError(request.destination, error);
  } else {
    request.status = CLOSING;
    request.fatalError = error;
  }
}

function emitErrorChunkProd(request, id, digest) {
  const processedChunk = processErrorChunkProd(request, id, digest);
  request.completedErrorChunks.push(processedChunk);
}

function emitErrorChunkDev(request, id, digest, message, stack) {
  const processedChunk = processErrorChunkDev(request, id, digest, message, stack);
  request.completedErrorChunks.push(processedChunk);
}

function emitModuleChunk(request, id, moduleMetaData) {
  const processedChunk = processModuleChunk(request, id, moduleMetaData);
  request.completedModuleChunks.push(processedChunk);
}

function emitSymbolChunk(request, id, name) {
  const symbolReference = serializeSymbolReference(name);
  const processedChunk = processReferenceChunk(request, id, symbolReference);
  request.completedModuleChunks.push(processedChunk);
}

function retryTask(request, task) {
  if (task.status !== PENDING) {
    // We completed this by other means before we had a chance to retry it.
    return;
  }

  try {
    let value = task.model;

    if (
      typeof value === 'object' &&
      value !== null &&
      value.$$typeof === REACT_ELEMENT_TYPE
    ) {
      // TODO: Concatenate keys of parents onto children.
      const element = value; // When retrying a component, reuse the thenableState from the
      // previous attempt.

      const prevThenableState = task.thenableState; // Attempt to render the Server Component.
      // Doing this here lets us reuse this same task if the next component
      // also suspends.

      task.model = value;
      value = attemptResolveElement(
        request,
        element.type,
        element.key,
        element.ref,
        element.props,
        prevThenableState,
      ); // Successfully finished this component. We're going to keep rendering
      // using the same task, but we reset its thenable state before continuing.

      task.thenableState = null; // Keep rendering and reuse the same task. This inner loop is separate
      // from the render above because we don't need to reset the thenable state
      // until the next time something suspends and retries.

      while (
        typeof value === 'object' &&
        value !== null &&
        value.$$typeof === REACT_ELEMENT_TYPE
      ) {
        // TODO: Concatenate keys of parents onto children.
        const nextElement = value;
        task.model = value;
        value = attemptResolveElement(
          request,
          nextElement.type,
          nextElement.key,
          nextElement.ref,
          nextElement.props,
          null,
        );
      }
    }

    const processedChunk = processModelChunk(request, task.id, value);
    request.completedJSONChunks.push(processedChunk);
    request.abortableTasks.delete(task);
    task.status = COMPLETED;
  } catch (thrownValue) {
    request.abortableTasks.delete(task);
    task.status = ERRORED;
    const digest = logRecoverableError(request, thrownValue);
    const _getErrorMessageAndSt5 = getErrorMessageAndStackDev(thrownValue);
    const message = _getErrorMessageAndSt5.message;
    const stack = _getErrorMessageAndSt5.stack;

    emitErrorChunkDev(request, task.id, digest, message, stack);
  }
}

function performWork(request) {
  const prevDispatcher = ReactCurrentDispatcher.current;
  const prevCache = getCurrentCache();
  ReactCurrentDispatcher.current = HooksDispatcher;
  setCurrentCache(request.cache);
  prepareToUseHooksForRequest(request);

  try {
    const pingedTasks = request.pingedTasks;
    request.pingedTasks = [];

    for (let i = 0; i < pingedTasks.length; i++) {
      const task = pingedTasks[i];
      retryTask(request, task);
    }

    if (request.destination !== null) {
      flushCompletedChunks(request, request.destination);
    }
  } catch (error) {
    logRecoverableError(request, error);
    fatalError(request, error);
  } finally {
    ReactCurrentDispatcher.current = prevDispatcher;
    setCurrentCache(prevCache);
    resetHooksForRequest();
  }
}

function abortTask(task, request, errorId) {
  task.status = ABORTED; // Instead of emitting an error per task.id, we emit a model that only
  // has a single value referencing the error.

  const ref = serializeByValueID(errorId);
  const processedChunk = processReferenceChunk(request, task.id, ref);
  request.completedErrorChunks.push(processedChunk);
}

function flushCompletedChunks(request, destination) {
  beginWriting();

  try {
    // We emit module chunks first in the stream so that
    // they can be preloaded as early as possible.
    const moduleChunks = request.completedModuleChunks;
    let i = 0;

    for (; i < moduleChunks.length; i++) {
      request.pendingChunks--;
      const chunk = moduleChunks[i];
      const keepWriting = writeChunkAndReturn(destination, chunk);

      if (!keepWriting) {
        request.destination = null;
        i++;
        break;
      }
    }

    moduleChunks.splice(0, i); // Next comes model data.

    const jsonChunks = request.completedJSONChunks;
    i = 0;

    for (; i < jsonChunks.length; i++) {
      request.pendingChunks--;
      const _chunk = jsonChunks[i];

      const _keepWriting = writeChunkAndReturn(destination, _chunk);

      if (!_keepWriting) {
        request.destination = null;
        i++;
        break;
      }
    }

    jsonChunks.splice(0, i); // Finally, errors are sent. The idea is that it's ok to delay
    // any error messages and prioritize display of other parts of
    // the page.

    const errorChunks = request.completedErrorChunks;
    i = 0;

    for (; i < errorChunks.length; i++) {
      request.pendingChunks--;
      const _chunk2 = errorChunks[i];

      const _keepWriting2 = writeChunkAndReturn(destination, _chunk2);

      if (!_keepWriting2) {
        request.destination = null;
        i++;
        break;
      }
    }

    errorChunks.splice(0, i);
  } finally {
    completeWriting(destination);
  }

  if (request.pendingChunks === 0) {
    // We're done.
    close(destination);
  }
}

function startWork(request) {
  scheduleWork(() => REACT_CONTEXT.run(request.cache, performWork, request));
}
function startFlowing(request, destination) {
  if (request.status === CLOSING) {
    request.status = CLOSED;
    closeWithError(destination, request.fatalError);
    return;
  }

  if (request.status === CLOSED) {
    return;
  }

  if (request.destination !== null) {
    // We're already flowing.
    return;
  }

  request.destination = destination;

  try {
    flushCompletedChunks(request, destination);
  } catch (error) {
    logRecoverableError(request, error);
    fatalError(request, error);
  }
} // This is called to early terminate a request. It creates an error at all pending tasks.

function abort(request, reason) {
  try {
    const abortableTasks = request.abortableTasks;

    if (abortableTasks.size > 0) {
      // We have tasks to abort. We'll emit one error row and then emit a reference
      // to that row from every row that's still remaining.
      const error =
        reason === undefined
          ? new Error('The render was aborted by the server without a reason.')
          : reason;
      const digest = logRecoverableError(request, error);
      request.pendingChunks++;
      const errorId = request.nextChunkId++;

      if (import.meta.env.BLADE_ENV === 'development') {
        const _getErrorMessageAndSt6 = getErrorMessageAndStackDev(error);
        const message = _getErrorMessageAndSt6.message;
        const stack = _getErrorMessageAndSt6.stack;

        emitErrorChunkDev(request, errorId, digest, message, stack);
      } else {
        emitErrorChunkProd(request, errorId, digest);
      }

      abortableTasks.forEach((task) => abortTask(task, request, errorId));
      abortableTasks.clear();
    }

    if (request.destination !== null) {
      flushCompletedChunks(request, request.destination);
    }
  } catch (error) {
    logRecoverableError(request, error);
    fatalError(request, error);
  }
}

function renderToReadableStream(model, options) {
  const request = createRequest(
    model,
    options ? options.onError : undefined,
    options ? options.identifierPrefix : undefined,
  );

  if (options?.signal) {
    const signal = options.signal;

    if (signal.aborted) {
      abort(request, signal.reason);
    } else {
      const listener = () => {
        abort(request, signal.reason);
        signal.removeEventListener('abort', listener);
      };

      signal.addEventListener('abort', listener);
    }
  }

  const stream = new ReadableStream(
    {
      type: 'bytes',
      start: (_controller) => {
        startWork(request);
      },
      pull: (controller) => {
        startFlowing(request, controller);
      },
      cancel: (_reason) => {},
    },
    {
      highWaterMark: 0,
    },
  );
  return stream;
}

export { renderToReadableStream };
