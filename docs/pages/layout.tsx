import type { CodeProps } from '@/components/code';
import { Code } from '@/components/code';
import { Heading } from '@/components/heading.client';
import { Navbar } from '@/components/navbar';
import { OnThisPage } from '@/components/on-this-page.client';
import { Sidebar } from '@/components/sidebar';
import { useMetadata } from '@ronin/blade/server/hooks';

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

  const menuItems = [
    {
      id: 'introduction',
      name: 'Introduction',
      href: '/docs',
      parentItem: '',
    },
  ];

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
        {/*     <Bookmark
          title="On this page"
          items={onThisPage}
        /> */}
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
