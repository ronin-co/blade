export { processStorableObjects, isStorableObject } from '@/src/storage';
export { ClientError } from '@/src/utils/errors';
export * from '@/src/triggers/errors';

// When invoking the client and capturing errors, it must be guaranteed that the error
// class imported by the client is the same that is imported by its invoker.
export { CompilerError } from 'blade-compiler';
