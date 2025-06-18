import { highlight } from 'sugar-high';

import { CopyToClipboard } from '@/components/copy.client';

/**
 * This Set is a fork of the official JavaScript keywords preset.
 * The reason for this is that we are adding TypeScript keywords to the set.
 * @see https://github.com/huozhi/sugar-high/blob/main/lib/index.js#L4-L46
 */
const TypeScriptKeywords = new Set([
  'abstract',
  'as',
  'asserts',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'declare',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'infer',
  'instanceof',
  'interface',
  'is',
  'keyof',
  'let',
  'module',
  'namespace',
  'new',
  'readonly',
  'return',
  'satisfies',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

type SupportedLanguages = 'ts' | 'tsx' | 'typescript';

const MAPPED_LANGUAGE_KEYWORDS = {
  ts: TypeScriptKeywords,
  tsx: TypeScriptKeywords,
  typescript: TypeScriptKeywords,
} satisfies Record<SupportedLanguages, Set<string>>;

interface CodeBlockProps extends React.ComponentPropsWithoutRef<'pre'> {
  language?: string;
}

export const CodeBlock = (props: CodeBlockProps) => {
  const { language, children: defaultChildren, ...restProps } = props;
  const children = Array.isArray(defaultChildren) ? defaultChildren[0] : defaultChildren;

  const keywords = MAPPED_LANGUAGE_KEYWORDS[language as SupportedLanguages];
  const html = highlight(children, {
    keywords: keywords ?? new Set<string>(),
  });

  return (
    <div className="relative my-3">
      <pre
        {...restProps}
        className="not-prose relative my-0! overflow-x-auto rounded-lg border p-5 text-sm">
        <code
          className="bg-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="absolute top-3 right-2">
          <CopyToClipboard content={children as string} />
        </div>
      </pre>
    </div>
  );
};

const LANGUAGE_REGEX = /language-(\w+)/;

export interface CodeProps {
  children: React.ReactElement | Array<React.ReactElement>;
  className?: string;
}
export const Code = (props: CodeProps) => {
  if (props.children === null) return;

  const children = Array.isArray(props.children) ? props.children[0] : props.children;

  // @ts-expect-error - children is a ReactElement.
  const className = children?.props.className || '';
  const language = className.match(LANGUAGE_REGEX)?.[1] || undefined;

  return (
    <div>
      <CodeBlock
        // @ts-expect-error - props exist.
        {...children.props}
        language={language}
      />
    </div>
  );
};
