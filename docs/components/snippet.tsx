import { Icons } from '@/components/icons';

export const Snippet = () => {
  return (
    <button
      type="button"
      className="hidden cursor-pointer flex-row items-center gap-1.5 rounded-md border border-transparent p-2 font-medium font-mono text-muted-foreground text-xs transition duration-200 hover:border-border hover:bg-accent hover:text-primary hover:duration-0 sm:flex sm:py-1 sm:pr-2 sm:pl-1.5">
      <Icons.Terminal className="size-4" />

      <span>bun x @ronin/blade init</span>
    </button>
  );
};
