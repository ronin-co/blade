import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { highlight } from 'sugar-high';

export const InlineCode = (props: React.ComponentPropsWithoutRef<'code'>) => {
  return (
    <code
      className="rounded-md bg-accent px-1.5 py-0.5 font-mono"
      {...props}
    />
  );
};

/**
 * This Set is a fork of the official JavaScript keywords preset.
 * The reason for this is that we are adding TypeScript keywords to the set.
 * @see https://github.com/huozhi/sugar-high/blob/main/lib/index.js#L4-L46
 */
const TYPESCRIPT_KEYWORDS = new Set([
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
  ts: TYPESCRIPT_KEYWORDS,
  tsx: TYPESCRIPT_KEYWORDS,
  typescript: TYPESCRIPT_KEYWORDS,
} satisfies Record<SupportedLanguages, Set<string>>;

interface CodeBlockProps extends React.ComponentPropsWithoutRef<'pre'> {
  language?: string;
}

export const CodeBlock = (props: CodeBlockProps) => {
  const { language, children: defaultChildren, ...restProps } = props;

  const [copied, setCopied] = useState(false);

  const children = Array.isArray(defaultChildren) ? defaultChildren[0] : defaultChildren;

  const keywords = MAPPED_LANGUAGE_KEYWORDS[language as SupportedLanguages];

  const html = highlight(children, {
    keywords: keywords ?? new Set<string>(),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);

    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative my-3">
      <pre
        {...restProps}
        className="not-prose relative my-0! overflow-x-auto rounded-xl border border-border px-4 py-3 pr-3 text-sm">
        <code
          className="bg-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="absolute top-[7px] right-[7px]">
          <span className="group relative">
            <button
              type="button"
              className={cn(
                'relative flex cursor-pointer flex-row items-center gap-1.5 rounded-md border bg-background p-1.5 font-medium font-mono text-muted-foreground text-xs transition duration-200 hover:text-primary hover:duration-0',
                {
                  'border-transparent hover:border-border hover:bg-accent': !copied,
                  'border-green-600/20 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10':
                    copied,
                },
              )}
              onClick={handleCopy}>
              <span className="sr-only">Copy</span>

              <Icons.Copy
                className={cn('size-4', {
                  'opacity-0': copied,
                  'opacity-100': !copied,
                })}
              />
            </button>

            <span
              className={cn(
                'pointer-events-none absolute inset-0 flex items-center justify-center text-green-700 transition-opacity duration-200 group-hover:duration-0 dark:text-green-400',
                {
                  'opacity-0': !copied,
                  'opacity-100': copied,
                },
              )}>
              <Icons.Check className="size-4" />
            </span>
          </span>
        </div>
      </pre>
    </div>
  );
};

const LANGUAGE_REGEX = /language-(\w+)/;

interface CodeProps {
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
