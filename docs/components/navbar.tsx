import { CopyText } from '@/components/copy-text.client';
import { Icons } from '@/components/icons';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full flex-none bg-background-light p-6 backdrop-blur transition-colors duration-500 supports-backdrop-blur:bg-background-light/95 dark:bg-background-dark/75 ">
      <div className="container-wrapper 3xl:fixed:px-0 px-6">
        <div className="**:data-[slot=separator]:!h-4 3xl:fixed:container flex h-(--header-height) items-center gap-6">
          <Logo />
          <Button
            asChild={true}
            variant="ghost"
            size="icon"
            className="w-fit px-2">
            <a
              href="https://github.com/ronin-co/blade"
              target="_blank"
              rel="noreferrer"
              className="w-fit px-0">
              <Icons.gitHub className="h-4 w-4" />
              <span className="text-muted-foreground text-xs tabular-nums">133</span>
              <span className="sr-only">GitHub</span>
            </a>
          </Button>
          <div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
            <div className="flex items-center gap-0.5">
              <p className="font-mono text-xs">
                <CopyText>
                  <span className="text-primary/80">$ bunx @ronin/blade init</span>
                </CopyText>
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
