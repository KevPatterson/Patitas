'use client';

import { useTheme } from '../../app/use-theme';

export function ThemeSwitch({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`theme-switch${compact ? ' theme-switch--compact' : ''} ${className}`.trim()}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <span className="theme-switch__track" aria-hidden="true">
        <svg className="theme-switch__sun" viewBox="0 0 18 18" width="18" height="18" style={{ color: 'hsl(var(--primary))' }}>
          <circle cx="9" cy="9" r="3.6" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" />
          </g>
        </svg>
        <svg className="theme-switch__moon" viewBox="0 0 18 18" width="18" height="18" style={{ color: 'hsl(var(--primary))' }}>
          <path d="M14.5 11A6.2 6.2 0 1 1 7 3.5 5.2 5.2 0 0 0 14.5 11Z" fill="currentColor" />
        </svg>
        <i className="theme-switch__star theme-switch__star--1" />
        <i className="theme-switch__star theme-switch__star--2" />
        <i className="theme-switch__star theme-switch__star--3" />
      </span>
      <span className="theme-switch__thumb" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor">
          <ellipse cx="12" cy="16" rx="5" ry="4" />
          <circle cx="5.5" cy="11" r="2" />
          <circle cx="9.5" cy="6.5" r="2" />
          <circle cx="14.5" cy="6.5" r="2" />
          <circle cx="18.5" cy="11" r="2" />
        </svg>
      </span>
    </button>
  );
}

export default ThemeSwitch;