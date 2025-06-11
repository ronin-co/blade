import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { SidebarItem } from '@/pages/layout';
import { useRedirect } from '@ronin/blade/universal/hooks';

import { MenuIcon } from 'lucide-react';

export const Menu = ({ items }: { items: SidebarItem }) => {
  const redirect = useRedirect();

  return (
    <div className="block md:hidden ">
      <Sheet>
        <SheetTrigger asChild={true}>
          <Button
            variant="ghost"
            size="lg">
            <span className="sr-only">Menu</span>
            <MenuIcon />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <div className="h-full overflow-y-auto p-8">
            {Object.entries(items).map(([title, items]) => (
              <div
                key={title}
                className="flex flex-col gap-12">
                <div className="flex flex-col gap-3">
                  <div className="group-data-[collapsible=icon]:-mt-8 flex h-8 shrink-0 items-center rounded-md px-2 text-muted-foreground text-sm outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 group-data-[collapsible=icon]:opacity-0 [&amp;&gt;svg]:size-4 [&amp;&gt;svg]:shrink-0">
                    {title}
                  </div>
                  <div className="w-full">
                    <ul className="flex w-full min-w-0 flex-col gap-3">
                      {items.map((item) => (
                        <SheetClose
                          key={item.id}
                          asChild={true}>
                          <li
                            key={item.id}
                            className="group/menu-item relative">
                            <Button
                              variant="ghost"
                              className={cn(
                                'peer/menu-button after:-inset-y-1 relative flex h-[30px] 3xl:fixed:w-full w-fit 3xl:fixed:max-w-48 items-center gap-2 overflow-visible rounded-md border border-transparent p-2 text-left font-medium text-2xl outline-hidden ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:border-accent data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&amp;&gt;span:last-child]:truncate [&amp;&gt;svg]:size-4 [&amp;&gt;svg]:shrink-0',
                                'after:absolute after:inset-x-0 after:z-0 after:rounded-md',
                                'active:bg-sidebar-accent active:text-sidebar-accent-foreground',
                                'disabled:pointer-events-none disabled:opacity-50',
                              )}
                              onClick={() => {
                                redirect(item.href);
                              }}>
                              {item.name}
                            </Button>
                          </li>
                        </SheetClose>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
