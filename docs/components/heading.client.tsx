import { Button } from '@/components/ui/button';
import { LinkIcon } from 'lucide-react';

interface HeadingProps {
  children: React.ReactNode;
}

export const Heading = ({ children, ...props }: HeadingProps) => {
  return (
    <a
      data-heading={true}
      href={`#${children?.toString()?.toLowerCase()}`}
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
      <h1 {...props}>{children}</h1>
    </a>
  );
};
