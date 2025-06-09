import { cn } from '@/lib/utils';
import { Button } from './ui/button';

export function MainNav({
  items,
  className,
  ...props
}: React.ComponentProps<'nav'> & {
  items: { href: string; label: string }[];
}) {
  return (
    <nav
      className={cn('items-center gap-0.5', className)}
      {...props}>
      {items.map((item) => (
        <Button
          key={item.href}
          variant="ghost"
          asChild={true}
          size="sm">
          <a href={item.href}>{item.label}</a>
        </Button>
      ))}
    </nav>
  );
}
