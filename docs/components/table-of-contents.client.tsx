import { cn, slugify } from '@/lib/utils';
import { Link } from 'blade/components';
import type { TableOfContents } from 'blade/types';
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

    const element = document.getElementById(slug);

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      // Update the URL hash after the scroll animation completes.
      const handleScrollEnd = () => {
        document.location.hash = slug;
        document.removeEventListener('scrollend', handleScrollEnd);
      };

      document.addEventListener('scrollend', handleScrollEnd);
    }
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
          '-ml-2.5 block cursor-pointer rounded-md px-2.5 py-1.5 text-muted-foreground text-sm transition-colors duration-200 hover:text-primary hover:duration-0',
          {
            'text-primary': active === slug,
          },
        )}>
        {item.value}
      </Link>

      {item.children && item.depth < 3 && (
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

  // Parse the provided Table of Contents and elevate all headings nested under the first
  // level heading to the first level.
  const adjustedToc = toc.reduce((acc, item) => {
    if (item.depth === 1) {
      acc.push(...(item.children ?? []));
    } else {
      acc.push(item);
    }

    return acc;
  }, [] as TableOfContents);

  useEffect(() => {
    // Flatten the `adjustedToc` to include all nested children.
    const flattenToc = (items: TableOfContents): TableOfContents => {
      const flattened: TableOfContents = [];

      for (const item of items) {
        flattened.push(item);
        if (item.children) {
          flattened.push(...flattenToc(item.children));
        }
      }

      return flattened;
    };

    const flattenedToc = flattenToc(adjustedToc);

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

    for (const item of flattenedToc) {
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
  }, [adjustedToc]);

  return (
    <div className="sticky hidden w-full lg:block">
      <div className="flex flex-col gap-2">
        <p className="font-medium text-muted-foreground/60 text-xs">On This Page</p>

        <div className="flex w-full flex-col gap-2">
          <div className="flex w-full flex-col gap-0.5">
            {adjustedToc.map((item) => (
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
