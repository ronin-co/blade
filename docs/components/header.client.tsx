import { Icons } from '@/components/icons';
import type { NavGroup } from '@/components/nav';
import { NavSheet } from '@/components/nav-sheet.client';
import { Snippet } from '@/components/snippet.client';
import { cn } from '@/lib/utils';
import { type FunctionComponent, useEffect, useState } from 'react';

export const Header: FunctionComponent<{ nav: Array<NavGroup> }> = ({ nav }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);

    // Invoke the callback on first paint.
    onScroll();

    // Register the scroll event listener.
    window.addEventListener('scroll', onScroll, { passive: true });

    // Unregister the scroll event listener on unmount.
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex w-full items-start justify-center gap-x-12 border-b bg-background px-8 transition-all duration-200 lg:gap-x-16 lg:px-6',
        {
          'py-5': !scrolled,
          'py-3': scrolled,
        },
      )}>
      <div className="hidden w-48 shrink-0 md:block" />

      <div className="flex w-full max-w-3xl flex-row items-center justify-between 2xl:max-w-4xl">
        <a
          className={cn(
            'group font-medium font-mono text-muted-foreground/60 tracking-tight transition-all duration-200 hover:text-muted-foreground hover:duration-0',
            {
              'text-lg': !scrolled,
              'text-base': scrolled,
            },
          )}
          href="/">
          <span className="font-semibold text-primary">blade</span>
          <span>.im</span>
        </a>

        <div className="flex flex-row items-center gap-2">
          <Snippet />

          <a
            className="flex flex-row items-center gap-1.5 rounded-md border border-transparent px-3 py-2 font-medium text-muted-foreground text-xs transition duration-200 hover:border-border hover:bg-accent hover:text-primary hover:duration-0 sm:py-1 sm:pr-2 sm:pl-1.5"
            href="https://github.com/ronin-co/blade"
            target="_blank"
            rel="noreferrer">
            <Icons.Star className="size-3.5" />

            <span>317</span>
          </a>

          <div className="block sm:hidden">
            <NavSheet
              nav={nav}
              scrolled={scrolled}
            />
          </div>
        </div>
      </div>

      <div className="hidden w-48 shrink-0 xl:block" />
    </header>
  );
};
