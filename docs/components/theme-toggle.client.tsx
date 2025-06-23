import { useCookie } from '@ronin/blade/hooks';
import { useCallback, useState } from 'react';

import { Icons } from '@/components/icons';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  initial?: Theme | null;
}

export function ThemeToggle(props: ThemeToggleProps) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(props.initial ?? 'system');
  const [themeCookie, setThemeCookie] = useCookie<Theme>('theme');

  const setTheme = useCallback(
    (theme: Theme): void => {
      setCurrentTheme(theme);
      setThemeCookie(theme, { client: true });

      console.log({ theme });

      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.remove('light');
      }
    },
    [themeCookie, setThemeCookie],
  );

  return (
    <button
      type="button"
      className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition duration-200 hover:bg-accent hover:text-primary hover:duration-0"
      onClick={() =>
        setTheme(
          currentTheme === 'light'
            ? 'dark'
            : currentTheme === 'dark'
              ? 'system'
              : 'light',
        )
      }>
      {currentTheme === 'dark' ? (
        <Icons.Moon className="size-4.5" />
      ) : currentTheme === 'light' ? (
        <Icons.Sun className="size-4.5" />
      ) : (
        <Icons.System className="size-4.5" />
      )}
    </button>
  );
}
