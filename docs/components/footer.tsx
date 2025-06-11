import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

export const Footer = () => (
  <footer className="mx-auto w-full max-w-2xl space-y-10 pb-16 lg:max-w-5xl">
    <div className="flex flex-col items-center justify-between gap-5 border-zinc-900/5 border-t pt-8 sm:flex-row dark:border-white/5">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        &copy; Copyright {new Date().getFullYear()}. All rights reserved.
      </p>

      <div className="flex gap-4">
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
