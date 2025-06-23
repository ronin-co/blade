import { Link } from '@ronin/blade/client/components';
import { useLocation } from '@ronin/blade/hooks';

import { cn } from '@/lib/utils';

export const Sidebar = ({
  items,
}: {
  items: {
    [key: string]: { id: string; href: string; name: string }[];
  };
}) => {
  const location = useLocation();

  return (
    <div className="sticky w-full">
      <div className="flex flex-col gap-6">
        {Object.entries(items).map(([title, items]) => (
          <div
            key={title}
            className="flex w-full flex-col gap-2">
            <p className="font-medium text-muted-foreground/60 text-xs">{title}</p>

            <div className="flex w-full flex-col gap-0.5">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    '-mx-2.5 block cursor-pointer rounded-md px-2.5 py-1.5 text-muted-foreground text-sm transition-colors duration-200 hover:bg-accent hover:text-primary hover:duration-0',
                    {
                      'bg-accent text-primary': item.href === location.pathname,
                    },
                  )}>
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
