import { useCookie } from '@ronin/blade/hooks';
import { Monitor, MoonIcon, SunIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';

import type { LucideProps } from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  initial?: Theme | null;
}

const MAPPED_THEME_ICON = {
  dark: MoonIcon,
  light: SunIcon,
  system: Monitor,
} satisfies Record<
  Theme,
  ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>
>;

export function ThemeToggle(props: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(props.initial ?? 'system');
  const [themeCookie, setThemeCookie] = useCookie<Theme>('theme');

  const toggleTheme = useCallback((): void => {
    const updatedTheme = themeCookie === 'dark' ? 'light' : 'dark';

    setTheme(updatedTheme);
    setThemeCookie(updatedTheme, { client: true });

    if (document.documentElement.classList.contains('dark' satisfies Theme)) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [themeCookie, setThemeCookie]);

  const Icon = MAPPED_THEME_ICON[theme ?? 'system'];

  return (
    <Button
      className="group/toggle h-8 w-8 cursor-pointer px-0"
      onClick={toggleTheme}
      size="icon"
      variant="ghost">
      <Icon className="h-4 w-4 text-black dark:text-white" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
