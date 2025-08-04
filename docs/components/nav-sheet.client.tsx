import { Icons } from '@/components/icons';
import { Nav, type NavGroup } from '@/components/nav';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useLocation } from 'blade/hooks';
import { useEffect, useState } from 'react';

export const NavSheet = ({
  nav,
  scrolled,
}: { nav: Array<NavGroup>; scrolled: boolean }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the sheet when the page changes.
  useEffect(() => {
    if (open && location.pathname) {
      setOpen(false);
    }
  }, [location.pathname]);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer flex-row items-center gap-1.5 rounded-md border border-transparent p-2 font-medium font-mono text-muted-foreground text-xs transition duration-200 hover:border-border hover:bg-accent hover:text-primary hover:duration-0 sm:p-1">
          <span className="sr-only">Menu</span>
          <Icons.Menu className="size-4" />
        </button>
      </SheetTrigger>

      <SheetContent>
        <div className="relative flex h-full flex-col gap-6 overflow-y-auto pb-12">
          <div
            className={cn(
              'sticky top-0 z-10 flex flex-row items-center justify-between gap-2 border-border border-b bg-background px-8',
              {
                'py-5': !scrolled,
                'py-3': scrolled,
              },
            )}>
            <SheetClose asChild>
              <a
                className={cn(
                  'group font-medium font-mono text-base text-muted-foreground/60 tracking-tight transition-all duration-200 hover:text-muted-foreground hover:duration-0',
                  {
                    'text-lg': !scrolled,
                    'text-base': scrolled,
                  },
                )}
                href="/">
                <span className="font-semibold text-primary">blade</span>
                <span>.im</span>
              </a>
            </SheetClose>

            <SheetClose asChild>
              <button
                type="button"
                className="flex cursor-pointer flex-row items-center gap-1.5 rounded-md border border-transparent p-2 font-medium font-mono text-muted-foreground text-xs transition duration-200 hover:border-border hover:bg-accent hover:text-primary hover:duration-0 sm:p-1">
                <Icons.Close className="size-4" />
              </button>
            </SheetClose>
          </div>
          <div className="px-8">
            <Nav nav={nav} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
