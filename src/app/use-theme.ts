import { useContext } from 'react';
import { ThemeContext } from './theme-context';
import type { ThemeContextValue } from './theme-types';

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}