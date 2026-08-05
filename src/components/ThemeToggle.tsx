'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'internindex-theme';
/** Pre-rebrand key, read once so an existing choice survives the rename. */
const LEGACY_STORAGE_KEY = 'internfinder-theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') setTheme(saved);
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    if (next === 'system') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      document.documentElement.removeAttribute('data-theme');
    } else {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute('data-theme', next);
    }
  };

  // Cycle light -> dark -> follow the OS.
  const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const labels: Record<Theme, string> = {
    light: 'Light theme',
    dark: 'Dark theme',
    system: 'Following system theme',
  };

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => apply(next)}
      title={`${labels[theme]}. Click for ${labels[next].toLowerCase()}`}
      aria-label={`${labels[theme]}. Switch to ${labels[next].toLowerCase()}.`}
    >
      {theme === 'light' ? <SunIcon /> : theme === 'dark' ? <MoonIcon /> : <AutoIcon />}
    </button>
  );
}

const s = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function SunIcon() {
  return (
    <svg {...s}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg {...s}>
      <path d="M21 13a8 8 0 1 1-10-10 7 7 0 0 0 10 10Z" />
    </svg>
  );
}
function AutoIcon() {
  return (
    <svg {...s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
