'use client';

import { useState, type ReactNode } from 'react';

/**
 * Charts are deliberately hand-built: single-series, one hue, recessive chrome,
 * hover tooltips, and a table fallback for every figure. Values and labels wear
 * text tokens; only the mark carries the series colour.
 */

const ORDINAL = ['var(--ord-1)', 'var(--ord-2)', 'var(--ord-3)', 'var(--ord-4)', 'var(--ord-5)'];

function TableFallback({
  caption,
  rows,
  valueLabel = 'Value',
}: {
  caption: string;
  rows: { label: string; value: ReactNode }[];
  valueLabel?: string;
}) {
  return (
    <details className="mt-3">
      <summary
        className="cursor-pointer text-[0.6875rem] select-none"
        style={{ color: 'var(--ink-muted)' }}
      >
        View as table
      </summary>
      <div className="scroll-x mt-2">
        <table className="w-full text-[0.75rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr style={{ color: 'var(--ink-muted)' }}>
              <th className="py-1 text-left font-medium">Label</th>
              <th className="py-1 text-right font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t" style={{ borderColor: 'var(--line)' }}>
                <td className="py-1">{row.label}</td>
                <td className="tnum py-1 text-right">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  /** Optional secondary text shown in the tooltip. */
  detail?: string;
  href?: string;
}

/**
 * Horizontal bars — the right form when category labels are words rather than
 * dates, because the labels get real horizontal room.
 */
export function HBarChart({
  data,
  valueSuffix = '',
  valueLabel = 'Count',
  caption,
  max,
  emptyMessage = 'No data yet.',
}: {
  data: BarDatum[];
  valueSuffix?: string;
  valueLabel?: string;
  caption: string;
  max?: number;
  emptyMessage?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const peak = max ?? Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-[0.8125rem]" style={{ color: 'var(--ink-muted)' }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-1.5" role="img" aria-label={caption}>
        {data.map((datum, index) => {
          const pct = peak > 0 ? (datum.value / peak) * 100 : 0;
          const active = hover === index;
          return (
            <div
              key={datum.label}
              className="group relative grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-2"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              tabIndex={0}
            >
              <span
                className="truncate text-[0.75rem]"
                style={{ color: active ? 'var(--ink-primary)' : 'var(--ink-secondary)' }}
                title={datum.label}
              >
                {datum.label}
              </span>

              {/* Track + bar. The bar is anchored to the baseline at left. */}
              <span
                className="relative block h-4 rounded-sm"
                style={{ background: 'var(--surface-2)' }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-300"
                  style={{
                    width: `${Math.max(pct, datum.value > 0 ? 1.5 : 0)}%`,
                    background: 'var(--series-1)',
                    opacity: active ? 1 : 0.9,
                  }}
                />
              </span>

              <span className="tnum w-14 text-right text-[0.75rem] font-medium">
                {datum.value.toLocaleString()}
                {valueSuffix}
              </span>

              {active && datum.detail ? (
                <span
                  className="pointer-events-none absolute -top-1 left-[10rem] z-10 -translate-y-full rounded-md border px-2 py-1 text-[0.6875rem] whitespace-nowrap shadow-sm"
                  style={{
                    background: 'var(--surface-1)',
                    borderColor: 'var(--line-strong)',
                    color: 'var(--ink-primary)',
                  }}
                  role="tooltip"
                >
                  {datum.detail}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <TableFallback
        caption={caption}
        valueLabel={valueLabel}
        rows={data.map((d) => ({
          label: d.label,
          value: `${d.value.toLocaleString()}${valueSuffix}`,
        }))}
      />
    </div>
  );
}

/**
 * Application funnel. Stages use an ordinal single-hue ramp (validated
 * light→dark with visible steps) and each stage shows its conversion from the
 * previous one, which is the number that actually tells you where you're losing.
 */
export function Funnel({ stages }: { stages: { stage: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = stages[0]?.count ?? 0;

  if (top === 0) {
    return (
      <p className="py-6 text-center text-[0.8125rem]" style={{ color: 'var(--ink-muted)' }}>
        Submit your first application and the funnel fills in here.
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-1.5" role="img" aria-label="Application funnel by stage">
        {stages.map((stage, index) => {
          const pct = top > 0 ? (stage.count / top) * 100 : 0;
          const previous = index > 0 ? stages[index - 1].count : null;
          const conversion =
            previous && previous > 0 ? Math.round((stage.count / previous) * 100) : null;
          const active = hover === index;

          return (
            <div
              key={stage.stage}
              className="grid grid-cols-[minmax(5.5rem,7rem)_1fr_auto] items-center gap-2"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              tabIndex={0}
            >
              <span
                className="truncate text-[0.75rem]"
                style={{ color: active ? 'var(--ink-primary)' : 'var(--ink-secondary)' }}
              >
                {stage.stage}
              </span>
              <span className="relative block h-5 rounded-sm" style={{ background: 'var(--surface-2)' }}>
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-300"
                  style={{
                    width: `${Math.max(pct, stage.count > 0 ? 2 : 0)}%`,
                    background: ORDINAL[Math.min(index, ORDINAL.length - 1)],
                  }}
                />
              </span>
              <span className="tnum flex w-24 items-baseline justify-end gap-1.5 text-[0.75rem]">
                <span className="font-medium">{stage.count}</span>
                {conversion != null ? (
                  <span style={{ color: 'var(--ink-muted)' }}>{conversion}%</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
        The grey percentage is conversion from the previous stage.
      </p>
      <TableFallback
        caption="Application funnel by stage"
        rows={stages.map((s) => ({ label: s.stage, value: s.count }))}
      />
    </div>
  );
}

/**
 * Applications submitted per week. A single series over time, so no legend —
 * the title names it. A dashed reference line marks the weekly goal.
 */
export function WeeklyColumns({
  data,
  goal,
}: {
  data: { weekStart: number; applied: number }[];
  goal: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const peak = Math.max(...data.map((d) => d.applied), goal, 1);
  const height = 96;

  return (
    <div>
      <div
        className="relative"
        style={{ height }}
        role="img"
        aria-label="Applications submitted per week over the last 12 weeks"
      >
        {/* Goal reference line, drawn behind the marks. */}
        {goal > 0 ? (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed"
            style={{ bottom: `${(goal / peak) * 100}%`, borderColor: 'var(--axis)' }}
          >
            <span
              className="absolute -top-4 right-0 text-[0.625rem]"
              style={{ color: 'var(--ink-muted)' }}
            >
              goal {goal}
            </span>
          </div>
        ) : null}

        <div className="flex h-full items-end gap-[2px]">
          {data.map((week, index) => {
            const pct = peak > 0 ? (week.applied / peak) * 100 : 0;
            const active = hover === index;
            return (
              <div
                key={week.weekStart}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
                tabIndex={0}
              >
                <span
                  className="w-full rounded-t-[4px] transition-all duration-300"
                  style={{
                    height: `${Math.max(pct, week.applied > 0 ? 4 : 1.5)}%`,
                    background: week.applied > 0 ? 'var(--series-1)' : 'var(--surface-3)',
                    opacity: active ? 1 : 0.9,
                  }}
                />
                {active ? (
                  <span
                    className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 text-[0.6875rem] whitespace-nowrap shadow-sm"
                    style={{
                      background: 'var(--surface-1)',
                      borderColor: 'var(--line-strong)',
                      color: 'var(--ink-primary)',
                    }}
                    role="tooltip"
                  >
                    {new Date(week.weekStart * 1000).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' · '}
                    {week.applied} submitted
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="mt-1.5 flex justify-between text-[0.625rem]"
        style={{ color: 'var(--ink-muted)' }}
      >
        <span>12 weeks ago</span>
        <span>this week</span>
      </div>

      <TableFallback
        caption="Applications submitted per week"
        valueLabel="Submitted"
        rows={data.map((d) => ({
          label: new Date(d.weekStart * 1000).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
          value: d.applied,
        }))}
      />
    </div>
  );
}

/**
 * Two-bar comparison. This is the one place two categorical hues appear
 * together; the pair is direct-labelled and validated for CVD separation.
 */
export function PairBars({
  a,
  b,
  suffix = '%',
}: {
  a: { label: string; value: number; detail?: string };
  b: { label: string; value: number; detail?: string };
  suffix?: string;
}) {
  const peak = Math.max(a.value, b.value, 1);
  const series = ['var(--series-1)', 'var(--series-2)'];

  return (
    <div className="space-y-2.5">
      {[a, b].map((datum, index) => (
        <div key={datum.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[0.75rem]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: series[index] }}
                aria-hidden
              />
              {datum.label}
            </span>
            <span className="tnum text-[0.75rem] font-medium">
              {datum.value}
              {suffix}
            </span>
          </div>
          <span className="relative block h-3 rounded-sm" style={{ background: 'var(--surface-2)' }}>
            <span
              className="absolute inset-y-0 left-0 rounded-r-[4px]"
              style={{
                width: `${Math.max((datum.value / peak) * 100, datum.value > 0 ? 2 : 0)}%`,
                background: series[index],
              }}
            />
          </span>
          {datum.detail ? (
            <p className="mt-0.5 text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
              {datum.detail}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Progress meter toward the weekly application goal. */
export function GoalMeter({ current, goal }: { current: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const met = goal > 0 && current >= goal;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="tnum text-2xl leading-none font-semibold">
          {current}
          <span className="text-sm font-normal" style={{ color: 'var(--ink-muted)' }}>
            {' / '}
            {goal}
          </span>
        </span>
        <span
          className="text-[0.75rem] font-medium"
          style={{ color: met ? 'var(--good-text)' : 'var(--ink-secondary)' }}
        >
          {met ? '✓ goal met' : `${pct}%`}
        </span>
      </div>
      <span
        className="relative mt-2 block h-2 rounded-full"
        style={{ background: 'var(--surface-2)' }}
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-label="Applications submitted this week versus goal"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.max(pct, current > 0 ? 3 : 0)}%`,
            background: met ? 'var(--good)' : 'var(--series-1)',
          }}
        />
      </span>
    </div>
  );
}
