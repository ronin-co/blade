import { Icons } from '@/components/icons';
import { useLocation, useRedirect } from 'blade/hooks';
import { type FunctionComponent, useEffect, useRef, useState } from 'react';

interface SearchItem {
  id: string;
  title: string;
  href: string;
  description?: string;
  category: string;
}

const searchItems: SearchItem[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    href: '/',
    description: 'Get started with Blade - React framework for instant web apps',
    category: 'Get Started',
  },
  {
    id: 'hooks',
    title: 'Hooks',
    href: '/hooks',
    description: 'Learn about Blade hooks - useLocation, useRedirect, useParams',
    category: 'Get Started',
  },
  {
    id: 'components',
    title: 'Components',
    href: '/components',
    description: 'Building with components - client and server components',
    category: 'Get Started',
  },
  {
    id: 'pages',
    title: 'Pages',
    href: '/pages',
    description: 'Creating pages in Blade - file-based routing',
    category: 'Get Started',
  },
  {
    id: 'api-routes',
    title: 'API Routes',
    href: '/api-routes',
    description: 'Working with API routes - REST endpoints and triggers',
    category: 'Get Started',
  },
  {
    id: 'deploying',
    title: 'Deploying',
    href: '/deploying',
    description: 'Deploy your Blade app - production deployment guide',
    category: 'Get Started',
  },
  {
    id: 'client',
    title: 'Client',
    href: '/client',
    description: 'Client-side functionality - interactive components',
    category: 'Get Started',
  },
  {
    id: 'queries-overview',
    title: 'Queries Overview',
    href: '/queries',
    description: 'Learn about Blade queries - data fetching and mutations',
    category: 'Queries',
  },
  {
    id: 'queries-crud',
    title: 'CRUD Operations',
    href: '/queries/crud',
    description: 'Create, read, update, delete - database operations',
    category: 'Queries',
  },
  {
    id: 'queries-instructions',
    title: 'Instructions',
    href: '/queries/instructions',
    description: 'Query instructions and syntax - advanced querying',
    category: 'Queries',
  },
  {
    id: 'queries-functions',
    title: 'Functions',
    href: '/queries/functions',
    description: 'Query functions and utilities - built-in functions',
    category: 'Queries',
  },
  {
    id: 'models-overview',
    title: 'Models Overview',
    href: '/models',
    description: 'Understanding Blade models - data models and schemas',
    category: 'Models',
  },
  {
    id: 'models-fields',
    title: 'Fields',
    href: '/models/fields',
    description: 'Model field types and options - field definitions',
    category: 'Models',
  },
  {
    id: 'models-triggers',
    title: 'Triggers',
    href: '/models/triggers',
    description: 'Model triggers and events - before, during, after hooks',
    category: 'Models',
  },
];

export const Search: FunctionComponent = () => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const redirect = useRedirect();
  const _location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Filter search items based on search term
  const filteredItems = searchItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Reset selected index when search term changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }

      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setSearchTerm('');
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            handleSelect(filteredItems[selectedIndex].href);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredItems, selectedIndex]);

  const handleSelect = (href: string) => {
    setOpen(false);
    redirect(href);
  };

  const handleItemClick = (href: string) => {
    handleSelect(href);
  };

  // Close dialog when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex w-10 flex-row items-center justify-center gap-1 rounded-md border border-black/5 px-1 py-2 font-medium text-muted-foreground text-xs transition duration-200 hover:border-border hover:bg-accent hover:text-primary hover:duration-0 sm:w-32 sm:justify-start sm:gap-1.5 sm:px-2 sm:py-1.5 sm:pr-2 sm:pl-1.5 md:w-44 md:px-3">
        <Icons.Search className="size-3.5" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="pointer-events-none absolute top-1.2 right-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" />
          <div className="relative mx-auto mt-20 max-w-2xl">
            <div
              ref={dialogRef}
              className="relative overflow-hidden rounded-lg border bg-background shadow-2xl">
              <div className="flex items-center border-b px-3">
                <Icons.Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search documentation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto p-1">
                {filteredItems.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    No results found.
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.href)}
                      className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors duration-150 hover:bg-accent/50">
                      <div className="flex w-full flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.title}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
                            {item.category}
                          </span>
                        </div>
                        {item.description && (
                          <span className="text-muted-foreground text-xs leading-relaxed">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
