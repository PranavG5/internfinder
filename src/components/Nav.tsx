'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { href: '/', label: 'Find internships', icon: SearchIcon, exact: true },
  { href: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { href: '/tracker', label: 'Applications', icon: ListIcon },
  { href: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { href: '/insights', label: 'Insights', icon: ChartIcon },
  { href: '/saved', label: 'Saved & shortlist', icon: StarIcon },
  { href: '/profile', label: 'Profile', icon: UserIcon },
  { href: '/sources', label: 'Sources & sync', icon: RefreshIcon },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<{ open: number; active: number } | null>(null);

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setCounts({ open: data.catalog?.open ?? 0, active: data.dashboard?.active ?? 0 });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Mobile bar */}
      <div
        className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 border-b px-4 py-2.5 lg:hidden"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--line)' }}
      >
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold">InternFinder</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      <nav
        className={`no-print z-20 w-full shrink-0 border-b lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:border-r lg:border-b-0 ${
          open ? 'block' : 'hidden lg:block'
        }`}
        style={{ background: 'var(--surface-1)', borderColor: 'var(--line)' }}
        aria-label="Main navigation"
      >
        <div className="flex h-full flex-col">
          <div className="hidden items-center justify-between px-4 py-4 lg:flex">
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="text-[0.9375rem] font-semibold tracking-tight">InternFinder</span>
            </Link>
            <ThemeToggle />
          </div>

          <ul className="flex-1 space-y-0.5 p-2">
            {LINKS.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium transition-colors"
                    style={{
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--ink-secondary)',
                    }}
                  >
                    <Icon />
                    <span className="flex-1">{label}</span>
                    {href === '/' && counts?.open ? (
                      <span className="tnum text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                        {counts.open.toLocaleString()}
                      </span>
                    ) : null}
                    {href === '/tracker' && counts?.active ? (
                      <span className="tnum text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                        {counts.active}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div
            className="border-t p-3 text-[0.6875rem] leading-relaxed"
            style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
          >
            <p>
              Everything is stored locally in <code>data/internfinder.db</code>. No account, no
              cloud, no tracking.
            </p>
          </div>
        </div>
      </nav>
    </>
  );
}

function Logo() {
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[0.8125rem] font-bold"
      style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      aria-hidden
    >
      if
    </span>
  );
}

/* Inline 16px icons — no icon dependency, and they inherit currentColor. */
const s = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

function SearchIcon() {
  return (
    <svg {...s}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg {...s}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg {...s}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg {...s}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg {...s}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg {...s}>
      <path d="m12 3 2.9 5.9 6.1.9-4.5 4.4 1.1 6.4L12 17.7 6.4 20.6l1.1-6.4L3 9.8l6.1-.9Z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg {...s}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg {...s}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg {...s}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg {...s}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
