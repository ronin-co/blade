import { Icons } from '@/components/icons';
import { slugify } from '@/lib/utils';
import { clsx } from 'clsx';
import { type JSX, type ReactNode, isValidElement, useState } from 'react';

interface HeadingProps {
  children: ReactNode;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

// Helper function to extract text content from React nodes.
const extractTextContent = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }

  if (isValidElement(node)) {
    return extractTextContent((node.props as any).children);
  }

  return '';
};

export const Heading = ({ children, level, ...props }: HeadingProps) => {
  const NativeHeading = `h${level}` as keyof JSX.IntrinsicElements;

  const textContent = extractTextContent(children);
  const id = slugify(textContent);

  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    navigator.clipboard.writeText(`${window.location.href}#${id}`);
    setCopied(true);

    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="group relative mb-6 flex flex-row items-center [&:not(:first-child)]:mt-10">
      <button
        type="button"
        aria-label="Copy link to clipboard"
        className="-left-8 absolute cursor-pointer p-1 text-muted-foreground opacity-0 transition duration-200 hover:text-primary group-hover:opacity-100 group-hover:duration-0"
        onClick={handleCopy}>
        {copied ? (
          <Icons.Check className="size-4.5" />
        ) : (
          <Icons.Quote className="size-4.5" />
        )}
      </button>

      <a
        data-heading={true}
        href={`#${id}`}
        id={id}
        className={clsx('font-semibold', {
          'text-3xl': level === 1,
          'text-2xl': level === 2,
          'text-xl': level === 3,
          'text-lg': level === 4,
          'text-base': level === 5,
          'text-sm': level === 6,
        })}>
        <NativeHeading {...props}>{children}</NativeHeading>
      </a>
    </span>
  );
};
