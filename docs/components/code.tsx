import { CopyToClipboard } from '@/components/copy.client';
import { createHighlighter } from 'shiki';

const theme = 'github-dark';

const highlighter = await createHighlighter({
  themes: [theme],
  langs: ['ts', 'bash', 'tsx'],
});

interface CodeBlockProps extends React.ComponentPropsWithoutRef<'pre'> {
  language?: string;
}

export const CodeBlock = (props: CodeBlockProps) => {
  const { language, children: defaultChildren, ...restProps } = props;
  const children = Array.isArray(defaultChildren) ? defaultChildren[0] : defaultChildren;

  const html = highlighter.codeToHtml(children as string, {
    lang: language || 'text',
    theme: theme,
    structure: 'inline',
  });

  return (
    <div className="relative">
      <pre
        {...restProps}
        className="not-prose relative my-0! rounded-lg border p-5 text-sm">
        <code
          dangerouslySetInnerHTML={{ __html: html }}
          className="bg-none"
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
