import { describe, expect, test } from 'bun:test';
import { SyntaxKind, addSyntheticLeadingComment, factory } from 'typescript';

import { printNodes } from '@/src/utils/print';

describe('print', () => {
  test('a simple `type` to a string', () => {
    const basicTypeNode = factory.createTypeAliasDeclaration(
      undefined,
      'MyType',
      undefined,
      factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    );

    const output = printNodes([basicTypeNode]);

    expect(output).toStrictEqual('type MyType = string;\n');
  });

  test('an empty string', () => {
    const output = printNodes([]);

    expect(output).toStrictEqual('');
  });

  test('a simple `type` to a string with a comment', () => {
    const basicTypeNode = factory.createTypeAliasDeclaration(
      undefined,
      'MyType',
      undefined,
      factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    );
    const basicTypeNodeWithComment = addSyntheticLeadingComment(
      basicTypeNode,
      SyntaxKind.MultiLineCommentTrivia,
      'This is a basic type',
      true,
    );

    const output = printNodes([basicTypeNodeWithComment]);

    expect(output).toStrictEqual('/*This is a basic type*/\ntype MyType = string;\n');
  });

  test('a simple `type` to a string with comment removed', () => {
    const basicTypeNode = factory.createTypeAliasDeclaration(
      undefined,
      'MyType',
      undefined,
      factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    );
    const basicTypeNodeWithComment = addSyntheticLeadingComment(
      basicTypeNode,
      SyntaxKind.MultiLineCommentTrivia,
      'This is a basic type',
      true,
    );

    const output = printNodes([basicTypeNodeWithComment], {
      removeComments: true,
    });

    expect(output).toStrictEqual('type MyType = string;\n');
  });
});
