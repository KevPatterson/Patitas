import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext } from './theme-context';
import type { Theme, ThemeContextValue } from './theme-types';

const STORAGE_KEY = 'patitas-theme';

function updateThemeColorMeta(isDark: boolean) {
  const meta = document.getElementById('theme-color-meta');
  if (meta) {
    meta.setAttribute('content', isDark ? '#1c0e05' : '#ff8c42');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = stored ?? (prefersDark ? 'dark' : 'light');
    setThemeState(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
    updateThemeColorMeta(initial === 'dark');
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    updateThemeColorMeta(newTheme === 'dark');
  };

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const value: ThemeContextValue = { theme, toggleTheme, setTheme, mounted };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}