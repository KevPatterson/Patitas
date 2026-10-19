'use client';

import { useTheme } from '../../app/use-theme';
import { Sun, Moon } from 'lucide-react';

/**
 * Switch animado para alternar modo claro/oscuro.
 * Usa CSS personalizado con animaciones suaves.
 */
export function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="theme-switch"
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-pressed={isDark}
      role="switch"
      type="button"
    >
      <span className="theme-switch__track" aria-hidden="true">
        <span className="theme-switch__thumb" aria-hidden="true">
          <Sun className="theme-switch__icon theme-switch__icon--sun" size={14} />
          <Moon className="theme-switch__icon theme-switch__icon--moon" size={14} />
        </span>
      </span>
      <span className="theme-switch__sr">Tema: {isDark ? 'oscuro' : 'claro'}</span>
    </button>
  );
}

export default ThemeSwitch;