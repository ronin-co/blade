import { CopyText } from '@/components/copy-text.client';
import { Icons } from '@/components/icons';
import { Logo } from '@/components/logo';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { useLocation } from '@ronin/blade/universal/hooks';

export const Navbar = ({
  items,
}: { items: { [key: string]: { id: string; href: string; name: string }[] } }) => {
  const pathname = useLocation().pathname;

  let currentItem = null;
  let currentKey = null;

  for (const [key, itemList] of Object.entries(items)) {
    const foundItem = itemList.find((item) => item.href === pathname);
    if (foundItem) {
      currentItem = foundItem;
      currentKey = key;
      break;
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full flex-none bg-background-light p-4 backdrop-blur transition-colors duration-500 supports-backdrop-blur:bg-background-light/95 md:p-6 dark:bg-background-dark/75 ">
      <div className="container-wrapper 3xl:fixed:px-0 md:px-6">
        <div className="**:data-[slot=separator]:!h-4 3xl:fixed:container flex h-(--header-height) items-center gap-2 md:gap-6">
          <Logo />
          <Button
            asChild={true}
            variant="ghost"
            size="icon"
            className="w-fit px-2">
            <a
              href="https://github.com/ronin-co/blade"
              target="_blank"
              rel="noreferrer"
              className="w-fit px-0">
              <Icons.gitHub className="h-4 w-4" />
              <span className="text-muted-foreground text-xs tabular-nums">133</span>
              <span className="sr-only">GitHub</span>
            </a>
          </Button>
          <div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
            <div className="flex items-center gap-0.5">
              <p className="hidden font-mono text-xs md:block">
                <CopyText text="bunx @ronin/blade init">
                  <span className="text-primary/80">$ bunx @ronin/blade init</span>
                </CopyText>
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 block md:hidden">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink>{currentKey}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{currentItem?.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>
    </header>
  );
};
