import { useLocation } from 'blade/hooks';

import { Icons } from '@/components/icons';
import { type Theme, ThemeToggle } from '@/components/theme-toggle.client';

function getEditUrl(location: URL): string {
  if (location.pathname === '/') return '/index';

  if (['/models', '/queries'].some((v) => v === location.pathname))
    return `${location.pathname}/index`;

  return location.pathname;
}

interface FooterProps {
  theme?: Theme | null;
}

export const Footer = (props: FooterProps) => {
  const location = useLocation();
  const pathname = getEditUrl(location);

  return (
    <footer className="flex w-full items-start justify-center gap-x-12 border-border border-t bg-background px-8 py-6 lg:gap-x-16 lg:px-6">
      <div className="hidden w-48 shrink-0 md:block" />

      <div className="flex w-full max-w-3xl flex-col justify-between gap-2 sm:flex-row sm:items-center 2xl:max-w-4xl">
        <p className="flex flex-row items-center gap-1 font-medium text-muted-foreground text-xs">
          <a
            className="transition duration-200 hover:text-primary hover:duration-0"
            href="https://ronin.co"
            rel="noreferrer"
            target="_blank">
            &copy; RONIN {new Date().getFullYear()}.
          </a>
          <span>All rights reserved.</span>
        </p>

        <div className="flex flex-row items-center gap-2">
          <a
            className="mr-auto font-medium text-muted-foreground text-xs transition duration-200 hover:text-primary hover:duration-0 sm:mr-4"
            href={`https://github.com/ronin-co/blade/edit/main/docs/pages${pathname}.mdx`}
            rel="noreferrer"
            target="_blank">
            Edit on GitHub
          </a>

          <ThemeToggle initial={props.theme} />

          <a
            className="rounded-md p-1.5 text-muted-foreground transition duration-200 hover:bg-accent hover:text-primary hover:duration-0"
            href="https://discord.gg/ronin"
            rel="noreferrer"
            target="_blank">
            <Icons.Discord className="size-4.5" />
          </a>

          <a
            className="rounded-md p-1.5 text-muted-foreground transition duration-200 hover:bg-accent hover:text-primary hover:duration-0"
            href="https://github.com/ronin-co/blade"
            rel="noreferrer"
            target="_blank">
            <Icons.GitHub className="size-4.5" />
          </a>
        </div>
      </div>

      <div className="hidden w-48 shrink-0 xl:block" />
    </footer>
  );
};
