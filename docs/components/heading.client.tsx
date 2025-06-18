import { Button } from '@/components/ui/button';
import { LinkIcon } from 'lucide-react';
import { type JSX, type ReactNode, isValidElement } from 'react';

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
  const HeadingComponent = `h${level}` as keyof JSX.IntrinsicElements;

  const textContent = extractTextContent(children);
  const id = textContent
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return (
    <a
      data-heading={true}
      href={`#${id}`}
      id={id}
      className="group -ml-11 not-prose relative mt-4 flex scroll-mt-25 items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="cursor-pointer text-muted-foreground opacity-0 transition duration-200 hover:text-primary group-hover:opacity-100 "
        onClick={() => {
          navigator.clipboard.writeText(`${window.location.href}`);
        }}>
        <LinkIcon
          width={12}
          height={12}
        />
      </Button>
      <HeadingComponent {...props}>{children}</HeadingComponent>
    </a>
  );
};
