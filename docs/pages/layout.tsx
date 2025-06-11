import type { CodeProps } from '@/components/code';
import { Code } from '@/components/code';
import { Footer } from '@/components/footer';
import { Heading } from '@/components/heading.client';
import { Navbar } from '@/components/navbar';
import { OnThisPage } from '@/components/on-this-page.client';
import { Sidebar } from '@/components/sidebar';
import { useMetadata } from '@ronin/blade/server/hooks';

type MenuItem = {
  id: string;
  name: string;
  href: string;
};

export type SidebarItem = { [key: string]: MenuItem[] };

const menuItems: SidebarItem = {
  'Get Started': [
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
      id: 'types',
      name: 'Types',
      href: '/types',
    },
    {
      id: 'client',
      name: 'Client',
      href: '/client',
    },
    {
      id: 'deploying',
      name: 'Deploying',
      href: '/deploying',
    },
  ],
  Queries: [
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
  Models: [
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
};

interface HeadingProps {
  children: React.ReactNode;
  id?: string;
}

const DocsLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  useMetadata({ htmlClassName: 'dark' });

  return (
    <div className="relative z-10 flex min-h-svh w-full flex-col bg-background">
      <Navbar items={menuItems} />
      <div className="fixed top-24 left-6 w-fit">
        <Sidebar items={menuItems} />
      </div>
      <div className="docs-content prose mx-auto flex w-full min-w-0 max-w-2xl flex-1 flex-col px-4 py-6 text-neutral-800 md:px-0 lg:py-8 dark:text-neutral-300">
        {children}
      </div>
      <div className="fixed top-24 right-20 w-40">
        <OnThisPage />
      </div>
      <div className="mt-16">
        <Footer />
      </div>
    </div>
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
};

export default DocsLayout;
