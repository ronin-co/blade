import { cn, slugify } from '@/lib/utils';
import { Link } from '@ronin/blade/client/components';
import type { TableOfContents } from '@ronin/blade/types';
import { useEffect, useState } from 'react';

export const TableOfContentsSidebarItem = ({
  item,
  active,
  indent,
}: {
  item: TableOfContents[number];
  active: string;
  indent: number;
}) => {
  const slug = slugify(item.value);

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.location.hash = slug;

    const element = document.getElementById(slug);

    if (element)
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
  };

  return (
    <div
      className={cn('flex flex-col gap-0.5', {
        'pl-3': indent === 1,
        'pl-6': indent === 2,
      })}>
      <Link
        key={item.value}
        href={`#${slug}`}
        onClick={onClick}
        className={cn(
          '-mx-2.5 block cursor-pointer rounded-md px-2.5 py-1.5 text-muted-foreground text-sm transition-colors duration-200 hover:bg-accent hover:text-primary hover:duration-0',
          {
            'bg-accent text-primary': active === slug,
          },
        )}>
        <span>{item.value}</span>
      </Link>

      {item.children && (
        <div className="flex flex-col gap-0.5">
          {item.children.map((child) => (
            <TableOfContentsSidebarItem
              key={child.value}
              item={child}
              active={active}
              indent={indent + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TableOfContentsSidebar = ({ toc }: { toc: TableOfContents }) => {
  const [activeId, setActiveId] = useState<string>('');

  // If there are no headings, don't render the sidebar.
  if (!toc || toc.length === 0) return null;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Abort if there are no entries.
        if (entries.length === 0) return;

        // Find the heading closest to the top of the viewport.
        let mostVisible = entries[0];
        let maxRatio = entries[0]?.intersectionRatio || 0;

        for (const entry of entries) {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisible = entry;
          }
        }

        // Update the active item.
        if (mostVisible?.isIntersecting) setActiveId(mostVisible.target.id);
      },
      {
        rootMargin: '-80px 0px -80% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    // Flatten the tree structure to get all headings
    const flattenHeadings = (items: TableOfContents): TableOfContents => {
      return items.reduce((acc: TableOfContents, item) => {
        acc.push(item);
        if (item.children && item.children.length > 0) {
          acc.push(...flattenHeadings(item.children));
        }
        return acc;
      }, []);
    };

    const allHeadings = flattenHeadings(toc);

    for (const item of allHeadings) {
      if (item.value) {
        const element = document.getElementById(slugify(item.value));
        if (element) {
          observer.observe(element);
        }
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [toc]);

  return (
    <div className="sticky hidden w-full lg:block">
      <div className="flex flex-col gap-2">
        <p className="font-medium text-muted-foreground/60 text-xs">On This Page</p>

        <div className="flex w-full flex-col gap-2">
          <div className="flex w-full flex-col gap-0.5">
            {toc.map((item) => (
              <TableOfContentsSidebarItem
                key={item.value}
                item={item}
                active={activeId}
                indent={0}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
