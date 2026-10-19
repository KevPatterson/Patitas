import { createContext } from 'react';
import type { ThemeContextValue } from './theme-types';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export { ThemeContext };