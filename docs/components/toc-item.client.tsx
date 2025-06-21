import type { TableOfContents } from '@ronin/blade/types';

import { slugify } from '@/lib/utils';

export const TableOfContentsItem = ({
  heading,
  activeId,
}: {
  heading: TableOfContents[number];
  activeId: string;
}) => {
  const handleHeadingClick = (id: string) => {
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  return (
    <li
      key={heading.value}
      id={slugify(heading.value)}
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className="group/menu-item relative">
      <button
        type="button"
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        data-size="default"
        data-active={activeId === heading.value ? 'true' : 'false'}
        onClick={() => heading.value && handleHeadingClick(slugify(heading.value))}
        className={`peer/menu-button ${
          activeId === slugify(heading.value) ? 'text-primary' : 'text-muted-foreground'
        } after:-inset-y-1 relative flex h-[30px] 3xl:fixed:w-full w-fit 3xl:fixed:max-w-48 items-center gap-2 overflow-visible rounded-md p-2 text-left font-medium text-[0.8rem] outline-hidden ring-sidebar-ring transition-[width,height,padding,color] after:absolute after:inset-x-0 after:z-0 after:rounded-md hover:text-primary focus-visible:ring-2 active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:border-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0`}
        style={{
          paddingLeft: `${0.5 + (heading.depth - 1) * 0.5}rem`,
        }}>
        <span className="truncate">{heading.value}</span>
      </button>
      {heading.children && heading.children.length > 0 && (
        <ul className="flex w-full min-w-0 flex-col gap-0.5">
          {heading.children.map((child) => (
            <TableOfContentsItem
              key={child.value}
              heading={child}
              activeId={activeId}
            />
          ))}
        </ul>
      )}
    </li>
  );
};
