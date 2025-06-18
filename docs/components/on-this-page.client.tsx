import { cn, slugify } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface Heading {
  id: string;
  text: string;
  level: number;
}

export const OnThisPage = () => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Extract all headings from the page.
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingData: Heading[] = [];

    headingElements.forEach((heading, index) => {
      const level = Number.parseInt(heading.tagName.charAt(1), 10);
      let id = heading.id;

      // Generate an ID if the heading doesn't have one.
      if (!id) {
        id = slugify(heading.textContent || `heading-${index}`);
        heading.id = id;
      }

      headingData.push({
        id,
        text: heading.textContent || '',
        level,
      });
    });

    setHeadings(headingData);
  }, []);

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

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  if (headings.length === 0) {
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
              {headings.map((heading) => (
                <li
                  key={heading.id}
                  data-slot="sidebar-menu-item"
                  data-sidebar="menu-item"
                  className="group/menu-item relative">
                  <button
                    type="button"
                    data-slot="sidebar-menu-button"
                    data-sidebar="menu-button"
                    data-size="default"
                    data-active={activeId === heading.id ? 'true' : 'false'}
                    onClick={() => {
                      const url = new URL(`#${heading.id}`, window.location.href);
                      window.location.href = url.href;
                    }}
                    className={cn(
                      activeId === heading.id ? 'text-primary' : 'text-muted-foreground',
                      'peer/menu-button after:-inset-y-1 relative flex h-[30px] 3xl:fixed:w-full w-fit 3xl:fixed:max-w-48 cursor-pointer items-center gap-2 overflow-visible rounded-md p-2 text-left font-medium text-[0.8rem] outline-hidden ring-sidebar-ring transition-[width,height,padding,color] after:absolute after:inset-x-0 after:z-0 after:rounded-md hover:text-primary focus-visible:ring-2 active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:border-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
                    )}
                    style={{
                      paddingLeft: `${0.5 + (heading.level - 1) * 0.5}rem`,
                    }}>
                    <span className="truncate">{heading.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
