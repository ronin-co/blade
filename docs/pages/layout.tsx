import type { CodeProps } from '@/components/code';
import { Code } from '@/components/code';
import { Heading } from '@/components/heading.client';
import { Navbar } from '@/components/navbar';
import { OnThisPage } from '@/components/on-this-page.client';
import { Sidebar } from '@/components/sidebar';
import { useMetadata } from '@ronin/blade/server/hooks';

const menuItems = [
  {
    id: 'introduction',
    name: 'Introduction',
    href: '/',
    parentItem: '',
  },
  {
    id: 'hooks',
    name: 'Hooks',
    href: '/hooks',
    parentItem: '',
  },
  {
    id: 'components',
    name: 'Components',
    href: '/components',
    parentItem: '',
  },
  {
    id: 'queries',
    name: 'Queries',
    href: '/queries',
    parentItem: '',
  },
  {
    id: 'crud',
    name: 'CRUD',
    href: '/queries/crud',
    parentItem: 'queries',
  },
  {
    id: 'instructions',
    name: 'Instructions',
    href: '/queries/instructions',
    parentItem: 'queries',
  },
  {
    id: 'functions',
    name: 'Functions',
    href: '/queries/functions',
    parentItem: 'queries',
  },
  {
    id: 'models',
    name: 'Models',
    href: '/models',
    parentItem: '',
  },
  {
    id: 'Fields',
    name: 'Fields',
    href: '/models/fields',
    parentItem: 'models',
  },
  {
    id: 'triggers',
    name: 'Triggers',
    href: '/models/triggers',
    parentItem: 'models',
  },
  {
    id: 'types',
    name: 'Types',
    href: '/types',
    parentItem: '',
  },
  {
    id: 'client',
    name: 'Client',
    href: '/client',
    parentItem: '',
  },
];

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
      <Navbar />
      <div className="fixed top-24 left-6 w-fit">
        <Sidebar
          title="Get Started"
          items={menuItems}
        />
      </div>
      <div className="docs-content prose mx-auto flex w-full min-w-0 max-w-2xl flex-1 flex-col px-4 py-6 text-neutral-800 md:px-0 lg:py-8 dark:text-neutral-300">
        {children}
      </div>
      <div className="fixed top-24 right-20 w-40">
        <OnThisPage />
      </div>
    </div>
  );
};

// biome-ignore lint/nursery/useComponentExportOnlyModules: This is needed for the docs.
export const components = {
  pre: (props: CodeProps) => <Code {...props} />,
  h1: (props: HeadingProps) => <Heading {...props} />,
};

export default DocsLayout;
