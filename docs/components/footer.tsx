import { useLocation } from '@ronin/blade/hooks';
import { Edit } from 'lucide-react';

import { Icons } from '@/components/icons';
import { ThemeToggle } from '@/components/theme-toggle.client';
import { Button } from '@/components/ui/button';

function getEditUrl(location: URL): string {
  if (location.pathname === '/') return '/index';

  if (['/models', '/queries'].some((v) => v === location.pathname))
    return `${location.pathname}/index`;

  return location.pathname;
}

export const Footer = () => {
  const location = useLocation();
  const pathname = getEditUrl(location);

  return (
    <footer className="mx-auto w-full max-w-2xl space-y-10 pb-16">
      <div className="flex flex-col items-center justify-between gap-5 border-zinc-900/5 sm:flex-row">
        <a
          className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          href={`https://github.com/ronin-co/blade/edit/main/docs/pages${pathname}.mdx`}
          rel="noreferrer"
          target="_blank">
          <Edit className="h-4 w-4" />
          <span>Edit this page</span>
        </a>
      </div>

      <div className="flex flex-col items-center justify-between gap-5 border-zinc-900/5 border-t pt-8 sm:flex-row dark:border-white/5">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          &copy; Copyright {new Date().getFullYear()}. All rights reserved.
        </p>

        <div className="flex gap-4">
          <ThemeToggle />

          <Button
            asChild={true}
            className="w-fit px-2"
            size="icon"
            variant="ghost">
            <a
              className="w-fit px-0"
              href="https://github.com/ronin-co/blade"
              rel="noreferrer"
              target="_blank">
              <Icons.gitHub className="h-4 w-4" />
              <span className="sr-only">GitHub</span>
            </a>
          </Button>
        </div>
      </div>
    </footer>
  );
};
