import type { ReactNode } from 'react';
import { STATUS_META, type AppStatus } from '@/lib/types';
import { daysUntil } from '@/lib/util';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-10 border-b px-4 py-4 backdrop-blur sm:px-6"
      style={{ background: 'color-mix(in srgb, var(--surface-page) 88%, transparent)', borderColor: 'var(--line)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-[0.8125rem]" style={{ color: 'var(--ink-secondary)' }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="no-print flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/**
 * A single headline number. No plot, because per the dataviz guidance a lone metric
 * reads better as a figure than as a one-bar chart.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'good' | 'warning' | 'critical' | 'accent';
}) {
  const toneColor =
    tone === 'good'
      ? 'var(--good-text)'
      : tone === 'warning'
        ? 'var(--ink-primary)'
        : tone === 'critical'
          ? 'var(--critical)'
          : tone === 'accent'
            ? 'var(--accent)'
            : 'var(--ink-primary)';

  return (
    <div className="card p-3.5">
      <div
        className="text-[0.6875rem] font-semibold tracking-wide uppercase"
        style={{ color: 'var(--ink-muted)' }}
      >
        {label}
      </div>
      <div className="mt-1.5 text-2xl leading-none font-semibold" style={{ color: toneColor }}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** Status pill. Colour plus the written label, never colour alone. */
export function StatusBadge({ status, small }: { status: AppStatus; small?: boolean }) {
  const meta = STATUS_META[status] ?? STATUS_META.interested;
  const palette: Record<string, { bg: string; fg: string }> = {
    won: { bg: 'var(--good-soft)', fg: 'var(--good-text)' },
    lost: { bg: 'var(--critical-soft)', fg: 'var(--critical)' },
    active: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
    pre: { bg: 'var(--surface-2)', fg: 'var(--ink-secondary)' },
  };
  const colors = palette[meta.kind];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${
        small ? 'px-1.5 py-px text-[0.6875rem]' : 'px-2 py-0.5 text-[0.75rem]'
      }`}
      style={{ background: colors.bg, color: colors.fg }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: 'currentColor' }}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}

/** Fit score badge. The number and grade word both appear, so it never relies on hue. */
export function FitBadge({
  score,
  grade,
  eligible,
}: {
  score: number;
  grade: string;
  eligible: boolean;
}) {
  const tone = !eligible
    ? { bg: 'var(--surface-2)', fg: 'var(--ink-muted)' }
    : score >= 80
      ? { bg: 'var(--good-soft)', fg: 'var(--good-text)' }
      : score >= 60
        ? { bg: 'var(--accent-soft)', fg: 'var(--accent)' }
        : { bg: 'var(--surface-2)', fg: 'var(--ink-secondary)' };

  return (
    <span
      className="tnum inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
      title={eligible ? `Fit score ${score}/100 (${grade})` : 'You may not be eligible for this role'}
    >
      {eligible ? `${score} fit` : 'check eligibility'}
    </span>
  );
}

/** Deadline countdown. Urgency is carried by the words, with colour as support. */
export function DeadlineBadge({ deadline }: { deadline: number | null }) {
  const days = daysUntil(deadline);
  if (days == null) return null;

  const { text, bg, fg } =
    days < 0
      ? { text: 'closed', bg: 'var(--surface-2)', fg: 'var(--ink-muted)' }
      : days === 0
        ? { text: 'closes today', bg: 'var(--critical-soft)', fg: 'var(--critical)' }
        : days <= 3
          ? { text: `${days}d left`, bg: 'var(--critical-soft)', fg: 'var(--critical)' }
          : days <= 14
            ? { text: `${days}d left`, bg: 'var(--warning-soft)', fg: 'var(--ink-primary)' }
            : { text: `${days}d left`, bg: 'var(--surface-2)', fg: 'var(--ink-secondary)' };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {days >= 0 && days <= 3 ? <AlertIcon /> : null}
      {text}
    </span>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-[0.9375rem] font-medium">{title}</p>
      {children ? (
        <div
          className="max-w-md text-[0.8125rem] leading-relaxed"
          style={{ color: 'var(--ink-secondary)' }}
        >
          {children}
        </div>
      ) : null}
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 className="text-[0.8125rem] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-muted)' }}>
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/** Small warning icon, so status colour is never the only signal. */
export function AlertIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 3 1.8 21h20.4Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  );
}

export function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 4h6v6M20 4 11 13M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}
