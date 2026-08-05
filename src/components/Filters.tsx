'use client';

import { useState, type ReactNode } from 'react';
import type { Facets, SearchQuery } from '@/lib/search-query';
import { CLASS_YEARS, DEGREES, PROGRAM_TYPES } from '@/lib/types';
import { toDateInput, fromDateInput, titleCase } from '@/lib/util';

export type QueryPatch = Partial<SearchQuery>;

/**
 * The filter rail. Every group is collapsible and shows live result counts, so
 * you can see what a choice would do before making it.
 */
export function Filters({
  query,
  facets,
  onChange,
  onReset,
}: {
  query: SearchQuery;
  facets: Facets | null;
  onChange: (patch: QueryPatch) => void;
  onReset: () => void;
}) {
  const activeCount = countActive(query);

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[0.75rem] font-semibold">
          Filters
          {activeCount > 0 ? (
            <span className="ml-1.5 rounded-full px-1.5 py-px text-[0.6875rem]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {activeCount}
            </span>
          ) : null}
        </span>
        {activeCount > 0 ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
            Clear all
          </button>
        ) : null}
      </div>

      {/* Quick toggles that students reach for most. */}
      <Group title="Quick filters" defaultOpen>
        <div className="space-y-1.5">
          <Check
            label="Only roles I'm eligible for"
            hint="Uses your work authorization, GPA, and degree level"
            checked={query.eligibleOnly}
            onChange={(v) => onChange({ eligibleOnly: v })}
          />
          <Check
            label="Paid only"
            checked={query.paidOnly}
            onChange={(v) => onChange({ paidOnly: v })}
          />
          <Check
            label="Has a listed salary"
            checked={query.hasSalary}
            onChange={(v) => onChange({ hasSalary: v })}
          />
          <Check
            label="No visa sponsorship needed from me"
            hint="Excludes roles restricted to US citizens"
            checked={query.excludeCitizenship}
            onChange={(v) => onChange({ excludeCitizenship: v })}
          />
          <Check
            label="No security clearance required"
            checked={query.excludeClearance}
            onChange={(v) => onChange({ excludeClearance: v })}
          />
          <Check
            label="No cover letter required"
            checked={query.requiresNoCoverLetter}
            onChange={(v) => onChange({ requiresNoCoverLetter: v })}
          />
          <Check
            label="Shortlisted only"
            checked={query.bookmarkedOnly}
            onChange={(v) => onChange({ bookmarkedOnly: v })}
          />
          <Check
            label="Hide ones I've already tracked"
            checked={query.hideApplied}
            onChange={(v) => onChange({ hideApplied: v })}
          />
        </div>
      </Group>

      <Group title="Season & year" defaultOpen count={query.seasons.length + query.years.length}>
        <CheckList
          buckets={facets?.seasons ?? []}
          selected={query.seasons}
          onChange={(seasons) => onChange({ seasons })}
        />
        {facets?.years.length ? (
          <div className="mt-2">
            <p className="label">Year</p>
            <CheckList
              buckets={facets.years}
              selected={query.years.map(String)}
              onChange={(years) => onChange({ years: years.map(Number) })}
            />
          </div>
        ) : null}
      </Group>

      <Group title="Field" defaultOpen count={query.fields.length}>
        <CheckList
          buckets={facets?.fields ?? []}
          selected={query.fields}
          onChange={(fields) => onChange({ fields })}
          searchable
        />
      </Group>

      <Group title="Specific role" count={query.roleFamilies.length}>
        <CheckList
          buckets={(facets?.roleFamilies ?? []).map((b) => ({ ...b, label: titleCase(b.label) }))}
          selected={query.roleFamilies}
          onChange={(roleFamilies) => onChange({ roleFamilies })}
          searchable
        />
      </Group>

      <Group title="Location" count={
        query.locationTypes.length + query.countries.length + query.regions.length + (query.location ? 1 : 0)
      }>
        <input
          className="input mb-2"
          placeholder="City, state, or country…"
          value={query.location}
          onChange={(e) => onChange({ location: e.target.value })}
        />
        <p className="label">Work arrangement</p>
        <CheckList
          buckets={facets?.locationTypes ?? []}
          selected={query.locationTypes}
          onChange={(locationTypes) => onChange({ locationTypes })}
        />
        {facets?.countries.length ? (
          <div className="mt-2">
            <p className="label">Country</p>
            <CheckList
              buckets={facets.countries}
              selected={query.countries}
              onChange={(countries) => onChange({ countries })}
              searchable
            />
          </div>
        ) : null}
        {facets?.regions.length ? (
          <div className="mt-2">
            <p className="label">State / region</p>
            <CheckList
              buckets={facets.regions}
              selected={query.regions}
              onChange={(regions) => onChange({ regions })}
              searchable
            />
          </div>
        ) : null}
      </Group>

      <Group
        title="Eligibility & prerequisites"
        count={query.degrees.length + query.classYears.length + (query.gpa != null ? 1 : 0) + query.sponsorship.length}
      >
        <p className="label">My GPA is at least</p>
        <input
          className="input mb-2"
          type="number"
          step="0.01"
          min="0"
          max="4"
          placeholder="e.g. 3.4, which hides roles asking for more"
          value={query.gpa ?? ''}
          onChange={(e) => onChange({ gpa: e.target.value ? Number(e.target.value) : null })}
        />

        <p className="label">Degree level</p>
        <CheckList
          buckets={
            facets?.degrees.length
              ? facets.degrees
              : DEGREES.map((d) => ({ value: d, label: d, count: 0 }))
          }
          selected={query.degrees}
          onChange={(degrees) => onChange({ degrees })}
        />

        <p className="label mt-2">Class year</p>
        <CheckList
          buckets={
            facets?.classYears.length
              ? facets.classYears
              : CLASS_YEARS.map((c) => ({ value: c, label: c, count: 0 }))
          }
          selected={query.classYears}
          onChange={(classYears) => onChange({ classYears })}
        />

        <p className="label mt-2">Work authorization</p>
        <CheckList
          buckets={(facets?.sponsorship ?? []).map((b) => ({
            ...b,
            label: SPONSORSHIP_LABELS[b.value] ?? b.label,
          }))}
          selected={query.sponsorship}
          onChange={(sponsorship) => onChange({ sponsorship })}
        />
      </Group>

      <Group title="Pay" count={query.minPay != null ? 1 : 0}>
        <p className="label">Minimum hourly rate (USD)</p>
        <input
          className="input"
          type="number"
          min="0"
          step="1"
          placeholder="e.g. 25"
          value={query.minPay ?? ''}
          onChange={(e) => onChange({ minPay: e.target.value ? Number(e.target.value) : null })}
        />
        <p className="mt-1 text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
          Monthly and annual figures are converted to an hourly equivalent.
        </p>
      </Group>

      <Group
        title="Dates & duration"
        count={
          (query.startAfter ? 1 : 0) +
          (query.startBefore ? 1 : 0) +
          (query.deadlineBefore ? 1 : 0) +
          (query.hasDeadline ? 1 : 0) +
          (query.postedWithinDays ? 1 : 0) +
          (query.minDuration ? 1 : 0) +
          (query.maxDuration ? 1 : 0)
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="label">Starts after</p>
            <input
              className="input"
              type="date"
              value={toDateInput(query.startAfter)}
              onChange={(e) => onChange({ startAfter: fromDateInput(e.target.value) })}
            />
          </div>
          <div>
            <p className="label">Starts before</p>
            <input
              className="input"
              type="date"
              value={toDateInput(query.startBefore)}
              onChange={(e) => onChange({ startBefore: fromDateInput(e.target.value) })}
            />
          </div>
        </div>

        <p className="label mt-2">Deadline before</p>
        <input
          className="input"
          type="date"
          value={toDateInput(query.deadlineBefore)}
          onChange={(e) => onChange({ deadlineBefore: fromDateInput(e.target.value) })}
        />

        <div className="mt-2">
          <Check
            label="Has a stated deadline"
            checked={query.hasDeadline}
            onChange={(v) => onChange({ hasDeadline: v })}
          />
          <Check
            label="Hide listings whose deadline has passed"
            checked={query.noDeadlinePassed}
            onChange={(v) => onChange({ noDeadlinePassed: v })}
          />
        </div>

        <p className="label mt-2">Posted within</p>
        <select
          className="select"
          value={query.postedWithinDays ?? ''}
          onChange={(e) =>
            onChange({ postedWithinDays: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">Any time</option>
          <option value="1">Last 24 hours</option>
          <option value="3">Last 3 days</option>
          <option value="7">Last week</option>
          <option value="14">Last 2 weeks</option>
          <option value="30">Last month</option>
          <option value="90">Last 3 months</option>
        </select>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <p className="label">Min weeks</p>
            <input
              className="input"
              type="number"
              min="1"
              max="78"
              value={query.minDuration ?? ''}
              onChange={(e) =>
                onChange({ minDuration: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
          <div>
            <p className="label">Max weeks</p>
            <input
              className="input"
              type="number"
              min="1"
              max="78"
              value={query.maxDuration ?? ''}
              onChange={(e) =>
                onChange({ maxDuration: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
        </div>
      </Group>

      <Group title="Program type" count={query.programTypes.length}>
        <CheckList
          buckets={
            facets?.programTypes.length
              ? facets.programTypes.map((b) => ({ ...b, label: titleCase(b.label) }))
              : PROGRAM_TYPES.map((p) => ({ value: p, label: titleCase(p), count: 0 }))
          }
          selected={query.programTypes}
          onChange={(programTypes) => onChange({ programTypes })}
        />
      </Group>

      <Group title="Skills" count={query.skills.length}>
        <CheckList
          buckets={facets?.skills ?? []}
          selected={query.skills}
          onChange={(skills) => onChange({ skills })}
          searchable
        />
      </Group>

      <Group title="Company" count={query.companies.length}>
        <CheckList
          buckets={facets?.companies ?? []}
          selected={query.companies}
          onChange={(companies) => onChange({ companies })}
          searchable
        />
      </Group>

      <Group title="Source" count={query.sources.length}>
        <CheckList
          buckets={facets?.sources ?? []}
          selected={query.sources}
          onChange={(sources) => onChange({ sources })}
        />
      </Group>

      <Group title="Exclude keywords" count={query.excludeKeywords.length}>
        <input
          className="input"
          placeholder="Comma separated, e.g. sales, unpaid"
          defaultValue={query.excludeKeywords.join(', ')}
          onBlur={(e) =>
            onChange({
              excludeKeywords: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
        <p className="mt-1 text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
          Hides listings whose title or company contains any of these.
        </p>
      </Group>

      <Group title="Archive" count={query.showClosed ? 1 : 0}>
        <Check
          label="Include closed listings"
          hint="Off by default, because the point of this app is roles you can still apply to"
          checked={query.showClosed}
          onChange={(v) => onChange({ showClosed: v })}
        />
      </Group>
    </div>
  );
}

const SPONSORSHIP_LABELS: Record<string, string> = {
  offers: 'Offers sponsorship',
  'does-not-offer': 'No sponsorship',
  'us-citizenship': 'US citizenship required',
  clearance: 'Clearance required',
  unknown: 'Not stated',
};

function countActive(q: SearchQuery): number {
  let n = 0;
  n += q.seasons.length + q.years.length + q.fields.length + q.roleFamilies.length;
  n += q.programTypes.length + q.companies.length + q.countries.length + q.regions.length;
  n += q.locationTypes.length + q.sponsorship.length + q.degrees.length + q.classYears.length;
  n += q.skills.length + q.sources.length + q.excludeKeywords.length;
  if (q.location) n++;
  if (q.gpa != null) n++;
  if (q.minPay != null) n++;
  if (q.paidOnly) n++;
  if (q.hasSalary) n++;
  if (q.eligibleOnly) n++;
  if (q.excludeCitizenship) n++;
  if (q.excludeClearance) n++;
  if (q.requiresNoCoverLetter) n++;
  if (q.bookmarkedOnly) n++;
  if (q.hideApplied) n++;
  if (q.showClosed) n++;
  if (q.hasDeadline) n++;
  if (q.startAfter) n++;
  if (q.startBefore) n++;
  if (q.deadlineBefore) n++;
  if (q.postedWithinDays) n++;
  if (q.minDuration) n++;
  if (q.maxDuration) n++;
  return n;
}

function Group({
  title,
  children,
  defaultOpen = false,
  count = 0,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen || count > 0);

  return (
    <div className="border-b pb-1" style={{ borderColor: 'var(--line)' }}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 py-2 text-left text-[0.8125rem] font-medium"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          {title}
          {count > 0 ? (
            <span
              className="tnum rounded-full px-1.5 py-px text-[0.625rem]"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {count}
            </span>
          ) : null}
        </span>
        <span style={{ color: 'var(--ink-muted)' }} aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? <div className="pb-2.5">{children}</div> : null}
    </div>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 py-0.5 text-[0.75rem] leading-snug">
      <input
        type="checkbox"
        className="mt-0.5 shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--accent)' }}
      />
      <span>
        {label}
        {hint ? (
          <span className="block text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function CheckList({
  buckets,
  selected,
  onChange,
  searchable = false,
}: {
  buckets: { value: string; label: string; count: number }[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);

  if (buckets.length === 0) {
    return (
      <p className="text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
        Nothing to filter on yet.
      </p>
    );
  }

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? buckets.filter((b) => b.label.toLowerCase().includes(needle))
    : buckets;
  const limit = showAll ? visible.length : 8;

  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  };

  return (
    <div>
      {searchable && buckets.length > 8 ? (
        <input
          className="input mb-1.5"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      ) : null}

      <div className="space-y-0.5">
        {visible.slice(0, limit).map((bucket) => (
          <label
            key={bucket.value}
            className="flex cursor-pointer items-center gap-2 py-px text-[0.75rem]"
          >
            <input
              type="checkbox"
              className="shrink-0"
              checked={selected.includes(bucket.value)}
              onChange={() => toggle(bucket.value)}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span className="min-w-0 flex-1 truncate" title={bucket.label}>
              {bucket.label}
            </span>
            {bucket.count > 0 ? (
              <span className="tnum text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                {bucket.count.toLocaleString()}
              </span>
            ) : null}
          </label>
        ))}
      </div>

      {visible.length > 8 ? (
        <button
          type="button"
          className="mt-1 text-[0.6875rem]"
          style={{ color: 'var(--accent)' }}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show fewer' : `Show all ${visible.length}`}
        </button>
      ) : null}
    </div>
  );
}
