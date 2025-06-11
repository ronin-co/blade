import { Button } from '@/components/ui/button';
import { LinkIcon } from 'lucide-react';
import type { JSX } from 'react';

interface HeadingProps {
  children: React.ReactNode;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export const Heading = ({ children, level, ...props }: HeadingProps) => {
  const HeadingComponent = `h${level}` as keyof JSX.IntrinsicElements;

  const id = children?.toString()?.toLowerCase();

  return (
    <a
      data-heading={true}
      href={`#${id}`}
      id={id}
      className="group -ml-11 not-prose relative flex items-center gap-2">
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
