import type { DML_QUERY_TYPES } from 'blade-compiler';

export type QueryType = (typeof DML_QUERY_TYPES)[number] | 'use' | 'useMutation';
