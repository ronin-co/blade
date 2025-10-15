import { Link } from 'blade/client/components';
import { useLocation } from 'blade/hooks';

import { cn } from '@/lib/utils';

export type NavItem = {
  id: string;
  href: string;
  name: string;
};

export type NavGroup = {
  name: string;
  items: Array<NavItem>;
};

export const Nav = ({
  nav,
}: {
  nav: Array<NavGroup>;
}) => {
  const location = useLocation();

  return (
    <div className="flex flex-col gap-6">
      {nav.map((group) => (
        <div
          key={group.name}
          className="flex w-full flex-col gap-2">
          <p className="font-medium text-muted-foreground/60 text-xs">{group.name}</p>

          <div className="flex w-full flex-col gap-0.5">
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  '-ml-2.5 block cursor-pointer rounded-md px-2.5 py-1.5 text-muted-foreground text-sm transition-colors duration-200 hover:bg-accent hover:text-primary hover:duration-0',
                  {
                    'bg-accent text-primary': item.href === location.pathname,
                  },
                )}>
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
