import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export const Snippet = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('bunx blade init');
    setCopied(true);

    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      className={cn(
        'group relative hidden cursor-pointer flex-row items-center gap-1.5 rounded-md border p-2 font-medium font-mono text-muted-foreground text-xs transition duration-200 hover:text-primary hover:duration-0 sm:flex sm:py-1 sm:pr-2 sm:pl-1.5',
        {
          'border-transparent hover:border-border hover:bg-accent': !copied,
          'border-green-600/20 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10':
            copied,
        },
      )}
      onClick={handleCopy}>
      <span
        className={cn('flex flex-row items-center gap-1.5', {
          'opacity-0': copied,
          'opacity-100': !copied,
        })}>
        <span className="relative size-4">
          <span className="absolute inset-0 opacity-100 transition-opacity duration-200 group-hover:opacity-0 group-hover:duration-0">
            <Icons.Terminal className="size-4" />
          </span>

          <span className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-hover:duration-0">
            <Icons.Copy className="size-4" />
          </span>
        </span>

        <span>bunx blade init</span>
      </span>

      <span
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-center space-x-1 text-green-700 transition-opacity duration-200 group-hover:duration-0 dark:text-green-400',
          {
            'opacity-0': !copied,
            'opacity-100': copied,
          },
        )}>
        <Icons.Check className="size-4" />
        <span>Copied</span>
      </span>
    </button>
  );
};
