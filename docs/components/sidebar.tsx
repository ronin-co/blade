import { useLocation } from '@ronin/blade/universal/hooks';

import { cn } from '@/lib/utils';

export const Sidebar = ({
  items,
  title,
}: {
  items: { id: string; href: string; name: string; parentItem: string }[];
  title: string;
}) => {
  const location = useLocation();

  return (
    <div className="sticky top-[calc(var(--header-height)+1px)] z-30 hidden h-[calc(100svh-var(--header-height)-var(--footer-height))] w-(--sidebar-width) flex-col bg-transparent text-sidebar-foreground lg:flex">
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 pb-12 group-data-[collapsible=icon]:overflow-hidden">
        <div
          data-slot="sidebar-group"
          data-sidebar="group"
          className="relative flex w-full min-w-0 flex-col p-2">
          <div
            data-slot="sidebar-group-label"
            data-sidebar="group-label"
            className="group-data-[collapsible=icon]:-mt-8 flex h-8 shrink-0 items-center rounded-md px-2 font-medium text-muted-foreground text-xs outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 group-data-[collapsible=icon]:opacity-0 [&amp;&gt;svg]:size-4 [&amp;&gt;svg]:shrink-0">
            {title}
          </div>
          <div
            data-slot="sidebar-group-content"
            data-sidebar="group-content"
            className="w-full text-sm">
            <ul
              data-slot="sidebar-menu"
              data-sidebar="menu"
              className="flex w-full min-w-0 flex-col gap-0.5">
              {items.map((item) => {
                console.log({ item, currentLocation: location });

                return (
                  <li
                    key={item.id}
                    data-slot="sidebar-menu-item"
                    data-sidebar="menu-item"
                    className="group/menu-item relative">
                    <a
                      data-slot="sidebar-menu-button"
                      data-sidebar="menu-button"
                      data-size="default"
                      data-active="false"
                      className={cn(
                        'peer/menu-button after:-inset-y-1 relative flex h-[30px] 3xl:fixed:w-full w-fit 3xl:fixed:max-w-48 items-center gap-2 overflow-visible rounded-md border border-transparent p-2 text-left font-medium text-[0.8rem] outline-hidden ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:border-accent data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&amp;&gt;span:last-child]:truncate [&amp;&gt;svg]:size-4 [&amp;&gt;svg]:shrink-0',
                        'after:absolute after:inset-x-0 after:z-0 after:rounded-md',
                        'active:bg-sidebar-accent active:text-sidebar-accent-foreground',
                        'disabled:pointer-events-none disabled:opacity-50',
                        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        item.href === location.pathname
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : null,
                      )}
                      href={item.href}>
                      {item.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
