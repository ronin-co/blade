import { useCookie } from '@ronin/blade/hooks';
import { useMetadata } from '@ronin/blade/server/hooks';
import type { TableOfContents } from '@ronin/blade/types';

import type { CodeProps } from '@/components/code.client';
import { Code } from '@/components/code.client';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header.client';
import { Heading } from '@/components/heading.client';
import { Nav, type NavGroup } from '@/components/nav';
import { TableOfContentsSidebar } from '@/components/table-of-contents.client';
import type { Theme } from '@/components/theme-toggle.client';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

const NAV: Array<NavGroup> = [
  {
    name: 'Get Started',
    items: [
      {
        id: 'introduction',
        name: 'Introduction',
        href: '/',
      },
      {
        id: 'hooks',
        name: 'Hooks',
        href: '/hooks',
      },
      {
        id: 'components',
        name: 'Components',
        href: '/components',
      },
      {
        id: 'pages',
        name: 'Pages',
        href: '/pages',
      },
      {
        id: 'api',
        name: 'API Routes',
        href: '/api-routes',
      },
      {
        id: 'deploying',
        name: 'Deploying',
        href: '/deploying',
      },
      {
        id: 'client',
        name: 'Client',
        href: '/client',
      },
    ],
  },
  {
    name: 'Queries',
    items: [
      {
        id: 'queries',
        name: 'Overview',
        href: '/queries',
      },
      {
        id: 'crud',
        name: 'CRUD',
        href: '/queries/crud',
      },
      {
        id: 'instructions',
        name: 'Instructions',
        href: '/queries/instructions',
      },
      {
        id: 'functions',
        name: 'Functions',
        href: '/queries/functions',
      },
    ],
  },
  {
    name: 'Models',
    items: [
      {
        id: 'models',
        name: 'Overview',
        href: '/models',
      },
      {
        id: 'Fields',
        name: 'Fields',
        href: '/models/fields',
      },
      {
        id: 'triggers',
        name: 'Triggers',
        href: '/models/triggers',
      },
    ],
  },
];

interface HeadingProps {
  children: React.ReactNode;
  id?: string;
}

const DocsLayout = ({
  children,
  tableOfContents,
}: {
  children: React.ReactNode;
  tableOfContents: TableOfContents;
}) => {
  const [theme] = useCookie<Theme>('theme');

  const title = 'Blade Documentation';
  const description = 'Build instant web apps.';

  useMetadata({
    htmlClassName: cn(
      'scroll-smooth antialiased',
      theme && ['dark', 'light'].includes(theme) ? theme : undefined,
    ),
    title,
    description,
    icon: 'https://blade.im/static/black.png',
    openGraph: {
      title,
      description,
      siteName: title,
      images: [
        {
          url: 'https://blade.im/static/banner.png',
          width: 1280,
          height: 720,
        },
      ],
    },
    x: {
      title,
      description,
      card: 'summary_large_image',
      // `creator` is the author and `site` is the site on which a post was
      // shared. In our case, we'll use the same handle for both of them.
      creator: '@ronin',
      site: '@ronin',
      images: ['https://blade.im/static/banner.png'],
    },
  });

  return (
    <>
      <div className="flex min-h-svh flex-col bg-background">
        <Header nav={NAV} />

        <div className="flex w-full items-start justify-center gap-x-12 px-8 lg:px-6">
          <div className="sticky top-22 mt-24 hidden w-48 sm:block lg:w-64">
            <Nav nav={NAV} />
          </div>

          <div className="flex w-full min-w-0 max-w-3xl flex-1 flex-col pt-12 pb-24 text-neutral-800 2xl:max-w-4xl dark:text-neutral-300">
            {children}
          </div>

          <div className="sticky top-22 mt-24 hidden w-48 lg:w-64 xl:block">
            <TableOfContentsSidebar toc={tableOfContents} />
          </div>
        </div>

        <Footer theme={theme} />
      </div>

      {import.meta.env.BLADE_ENV === 'production' && (
        <script
          data-cf-beacon='{"token": "173532820a6a4edbb501f7ff2305ab48"}'
          defer={true}
          src="https://static.cloudflareinsights.com/beacon.min.js"
        />
      )}
    </>
  );
};

// biome-ignore lint/nursery/useComponentExportOnlyModules: This is needed for the docs.
export const components = {
  pre: (props: CodeProps) => <Code {...props} />,
  h1: (props: HeadingProps) => (
    <Heading
      level={1}
      {...props}
    />
  ),
  h2: (props: HeadingProps) => (
    <Heading
      level={2}
      {...props}
    />
  ),
  h3: (props: HeadingProps) => (
    <Heading
      level={3}
      {...props}
    />
  ),
  h4: (props: HeadingProps) => (
    <Heading
      level={4}
      {...props}
    />
  ),
  h5: (props: HeadingProps) => (
    <Heading
      level={5}
      {...props}
    />
  ),
  h6: (props: HeadingProps) => (
    <Heading
      level={6}
      {...props}
    />
  ),
  p: (props: ComponentProps<'p'>) => (
    <p
      className="my-2 text-muted-foreground"
      {...props}
    />
  ),
  ul: (props: ComponentProps<'ul'>) => (
    <ul
      className="mb-4 list-disc pl-6 text-muted-foreground"
      {...props}
    />
  ),
  li: (props: ComponentProps<'li'>) => (
    <li
      className="mb-2 text-muted-foreground"
      {...props}
    />
  ),
};

export default DocsLayout;
