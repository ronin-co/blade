import { useCookie } from '@ronin/blade/hooks';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export type Theme = 'light' | 'dark';

const MAPPED_ICON = {
  dark: MoonIcon,
  light: SunIcon,
} satisfies Record<Theme, React.ComponentType<any>>;

export function ThemeToggle() {
  const [themeCookie, setThemeCookie] = useCookie<Theme>('theme');

  // Set the initial theme based on the user's system preference if no cookie is set.
  useEffect(() => {
    if (themeCookie) return;

    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = systemPrefersDark ? 'dark' : 'light';
    setThemeCookie(initialTheme, { client: true });
  }, []);

  const Icon = MAPPED_ICON[themeCookie ?? 'light'];

  return (
    <Button
      className="group/toggle h-8 w-8 px-0"
      // onClick={toggleTheme}
      size="icon"
      variant="ghost">
      <Icon className="h-4 w-4 text-black dark:text-white" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
