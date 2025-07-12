import { SyntaxKind, factory } from 'typescript';

import { identifiers } from '@/src/constants/identifiers';

import type { TypeNode } from 'typescript';

import type { ModelField } from '@/src/types/model';
import type { DML_QUERY_TYPES } from '@ronin/compiler';

/**
 * A list of all model field types & their TypeScript type mapping.
 */
export const MODEL_TYPE_TO_SYNTAX_KIND_KEYWORD = {
  blob: factory.createTypeReferenceNode(identifiers.compiler.storedObject),
  boolean: factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword),
  date: factory.createTypeReferenceNode(identifiers.primitive.date),
  json: factory.createUnionTypeNode([
    factory.createTypeReferenceNode(identifiers.utils.jsonObject),
    factory.createTypeReferenceNode(identifiers.utils.jsonArray),
  ]),
  link: factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword),
  number: factory.createKeywordTypeNode(SyntaxKind.NumberKeyword),
  string: factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
} satisfies Record<ModelField['type'], TypeNode>;

/**
 * A simple object mapping all DML query types to their human readable string.
 */
export const READABLE_DML_QUERY_TYPES = {
  add: 'Add',
  count: 'Count',
  get: 'Get',
  remove: 'Remove',
  set: 'Set',
} satisfies Record<(typeof DML_QUERY_TYPES)[number], string>;
