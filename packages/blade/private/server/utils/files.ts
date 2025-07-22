import type { Query, QueryType, StoredObject } from 'blade-compiler';

/**
 * Replaces `StoredObject` references in a list of queries with real `File` instances
 * obtained from the stream of the incoming request body, which allows for re-creating
 * the queries exactly as they were when they were sent from the client of the app.
 */
export const assignFiles = (query: Query, files: Map<string, Blob>): Query => {
  const typeKey = Object.keys(query)[0] as QueryType;

  if (typeKey === 'add' || typeKey === 'set') {
    const typeContents = query[typeKey] as unknown as Record<
      string,
      Record<string, object>
    >;

    const schemaKey = Object.keys(typeContents)[0];
    const schemaContents = typeContents[schemaKey];

    const instructionKey = typeKey === 'add' ? 'with' : 'to';
    const instructionContents = schemaContents[instructionKey] as Record<
      string,
      StoredObject
    >;

    for (const fieldKey in instructionContents) {
      const fieldContents = instructionContents[fieldKey];
      const file = fieldContents?.key ? files.get(fieldContents.key) : null;

      if (file) {
        const renamedFile = new File([file], fieldContents.src as string, {
          type: file.type,
        });
        // @ts-expect-error This is valid. But the TS error is likely a glitch due to the
        // complex nature of the types inferred from the zod validator(s).
        query[typeKey][schemaKey][instructionKey][fieldKey] = renamedFile;
      }
    }
  }

  return query;
};
