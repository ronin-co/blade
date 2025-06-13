import { useCookie } from '@ronin/blade/hooks';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

export type Theme = 'light' | 'dark';

interface ThemeToggleProps {
  initial?: Theme | null;
}

export function ThemeToggle(props: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme | null>(props.initial ?? null);
  const [themeCookie, setThemeCookie] = useCookie<Theme>('theme');

  const toggleTheme = useCallback((): void => {
    const updatedTheme = themeCookie === 'dark' ? 'light' : 'dark';

    setTheme(updatedTheme);
    setThemeCookie(updatedTheme, { client: true, path: '/' });

    if (document.documentElement.classList.contains('dark' satisfies Theme)) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [themeCookie, setThemeCookie]);

  // Set the initial theme based on the user's system preference if no cookie is set.
  useEffect(() => {
    if (themeCookie) {
      setTheme(themeCookie);
      return;
    }

    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = systemPrefersDark ? 'dark' : 'light';
    setTheme(initialTheme);
    setThemeCookie(initialTheme, { client: true, path: '/' });
  }, []);

  return (
    <Button
      className="group/toggle h-8 w-8 cursor-pointer px-0"
      onClick={toggleTheme}
      size="icon"
      variant="ghost">
      {theme === 'dark' ? (
        <MoonIcon className="h-4 w-4 text-black dark:text-white" />
      ) : null}
      {theme === 'light' ? (
        <SunIcon className="h-4 w-4 text-black dark:text-white" />
      ) : null}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
