import { CopyToClipboard } from '@/components/copy.client';

interface CodeBlockProps extends React.ComponentPropsWithoutRef<'pre'> {
  language?: string;
}

export const CodeBlock = (props: CodeBlockProps) => {
  const { language, children: defaultChildren, ...restProps } = props;
  const children = Array.isArray(defaultChildren) ? defaultChildren[0] : defaultChildren;

  return (
    <div className="relative">
      <pre
        {...restProps}
        className="not-prose relative my-0! overflow-x-auto whitespace-pre-wrap rounded-lg border p-5 text-sm">
        <code className="bg-none">{children}</code>
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
