import { TableOfContentsItem } from '@/components/toc-item.client';
import type { TableOfContents } from '@ronin/blade/types';
import { useEffect, useState } from 'react';

export const TableOfContentsSidebar = ({
  tableOfContents,
}: { tableOfContents: TableOfContents }) => {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.length === 0) return;

        // Find the heading that's most visible.
        let mostVisible = entries[0];
        let maxRatio = entries[0]?.intersectionRatio || 0;

        entries.forEach((entry) => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisible = entry;
          }
        });

        if (mostVisible?.isIntersecting) {
          setActiveId(mostVisible.target.id);
        }
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

    const allHeadings = flattenHeadings(tableOfContents);

    allHeadings.forEach((item) => {
      if (item.value) {
        const element = document.getElementById(item.value);
        if (element) {
          observer.observe(element);
        }
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [tableOfContents]);

  if (tableOfContents.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-[calc(var(--header-height)+1px)] z-30 hidden h-[calc(100svh-var(--header-height)-var(--footer-height))] w-[--sidebar-width] flex-col bg-transparent text-sidebar-foreground lg:flex">
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 pb-12 group-data-[collapsible=icon]:overflow-hidden">
        <div
          data-slot="sidebar-group"
          data-sidebar="group"
          className="relative flex w-full min-w-0 flex-col p-2">
          <div
            data-slot="sidebar-group-label"
            data-sidebar="group-label"
            className="group-data-[collapsible=icon]:-mt-8 flex h-8 shrink-0 items-center rounded-md px-2 font-medium text-muted-foreground text-xs outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 group-data-[collapsible=icon]:opacity-0 [&>svg]:size-4 [&>svg]:shrink-0">
            On This Page
          </div>
          <div
            data-slot="sidebar-group-content"
            data-sidebar="group-content"
            className="w-full text-sm">
            <ul
              data-slot="sidebar-menu"
              data-sidebar="menu"
              className="flex w-full min-w-0 flex-col gap-0.5">
              {tableOfContents.map((heading) => (
                <TableOfContentsItem
                  key={heading.value}
                  heading={heading}
                  activeId={activeId}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
