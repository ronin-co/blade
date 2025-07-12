import {
  ListFormat,
  NewLineKind,
  ScriptKind,
  ScriptTarget,
  createPrinter,
  createSourceFile,
  factory,
} from 'typescript';

import { DEFAULT_FILE_NAME } from '@/src/constants/file';

import type { Node } from 'typescript';

interface PrintNodesOptions {
  /**
   * The name of the source file.
   *
   * @default 'index.d.ts'
   */
  fileName?: string;
  /**
   * Whether to remove comments from the output.
   *
   * @default false
   */
  removeComments?: boolean;
}

/**
 * Prints a list of nodes to a string.
 *
 * This is primarily used to actually output code pragmatically
 * generated to a string.
 *
 * @param nodes - The nodes to print.
 *
 * @returns The string representation of the nodes.
 */
export const printNodes = (nodes: Array<Node>, options?: PrintNodesOptions): string => {
  const { fileName = DEFAULT_FILE_NAME, removeComments = false } = options ?? {};

  // This is a mock file that is entirely in memory & blank. It is just
  // required for the printer to work. The printer will add the nodes to
  // this file & then return the string representation of the file.
  const sourceFile = createSourceFile(
    fileName,
    '',
    ScriptTarget.ESNext,
    true,
    ScriptKind.TS,
  );

  const printer = createPrinter({
    newLine: NewLineKind.LineFeed,
    removeComments,
  });

  const nodesArray = factory.createNodeArray(nodes);

  return printer.printList(ListFormat.MultiLine, nodesArray, sourceFile);
};
