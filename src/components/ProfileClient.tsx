'use client';

import { useRef, useState } from 'react';
import { CLASS_YEARS, DEGREES, FIELDS, SEASONS, type ProfileView } from '@/lib/types';
import { allSkills } from '@/lib/parse/skills';
import { fromDateInput, toDateInput } from '@/lib/util';
import { Field, PageHeader, SectionTitle } from './ui';

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  return [current, current + 1, current + 2, current + 3].map(String);
})();

/**
 * The profile is what makes results personal: it drives fit scores, the
 * "only roles I'm eligible for" filter, and default search preferences.
 */
export function ProfileClient({ initial }: { initial: ProfileView }) {
  const [profile, setProfile] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    // Reflect the change immediately; the server response is authoritative.
    setProfile((prev) => ({ ...prev, ...patch } as ProfileView));
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data.profile);
    } catch {
      flash('Could not save that change.');
    } finally {
      setSaving(false);
    }
  };

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': file.name.endsWith('.csv') ? 'text/csv' : 'application/json',
        },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      flash(
        `Imported ${data.created} application${data.created === 1 ? '' : 's'}` +
          (data.skipped ? `, skipped ${data.skipped} already present.` : '.'),
      );
    } catch (err) {
      flash((err as Error).message);
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const detectedSkills = allSkills();

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Drives fit scores, eligibility filtering, and your default search preferences."
        actions={
          saving ? (
            <span className="text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
              Saving…
            </span>
          ) : profile.onboarded ? (
            <span className="text-[0.75rem]" style={{ color: 'var(--good-text)' }}>
              ✓ Saved automatically
            </span>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => save({ onboarded: true })}
            >
              Finish setup
            </button>
          )
        }
      />

      <div className="max-w-4xl space-y-6 p-4 sm:p-6">
        {!profile.onboarded ? (
          <div
            className="card p-3.5 text-[0.8125rem]"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}
          >
            Fill in what you can — even just work authorization, class year, and target seasons make
            the search dramatically more useful. Every field is optional and saves as you type.
          </div>
        ) : null}

        {/* About you */}
        <section>
          <SectionTitle>About you</SectionTitle>
          <div className="card grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                className="input"
                defaultValue={profile.name ?? ''}
                onBlur={(e) => save({ name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                className="input"
                type="email"
                defaultValue={profile.email ?? ''}
                onBlur={(e) => save({ email: e.target.value })}
              />
            </Field>
            <Field label="School">
              <input
                className="input"
                defaultValue={profile.school ?? ''}
                onBlur={(e) => save({ school: e.target.value })}
              />
            </Field>
            <Field label="Major">
              <input
                className="input"
                defaultValue={profile.major ?? ''}
                onBlur={(e) => save({ major: e.target.value })}
              />
            </Field>
            <Field label="Degree level">
              <select
                className="select"
                value={profile.degree_level ?? ''}
                onChange={(e) => save({ degree_level: e.target.value || null })}
              >
                <option value="">—</option>
                {DEGREES.map((degree) => (
                  <option key={degree} value={degree}>
                    {degree}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Class year">
              <select
                className="select"
                value={profile.class_year ?? ''}
                onChange={(e) => save({ class_year: e.target.value || null })}
              >
                <option value="">—</option>
                {CLASS_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Graduation year">
              <input
                className="input"
                type="number"
                min="2024"
                max="2035"
                defaultValue={profile.grad_year ?? ''}
                onBlur={(e) => save({ grad_year: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field label="GPA" hint="Used to hide roles with a higher minimum">
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                max="4"
                defaultValue={profile.gpa ?? ''}
                onBlur={(e) => save({ gpa: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
          </div>
        </section>

        {/* Work authorization */}
        <section>
          <SectionTitle>Work authorization</SectionTitle>
          <div className="card space-y-3 p-4">
            <Field
              label="Status"
              hint="This is the single biggest filter — many internships are restricted by it."
            >
              <select
                className="select"
                value={profile.work_auth ?? ''}
                onChange={(e) => save({ work_auth: e.target.value || null })}
              >
                <option value="">Prefer not to say</option>
                <option value="us-citizen">U.S. citizen</option>
                <option value="permanent-resident">U.S. permanent resident</option>
                <option value="needs-sponsorship">
                  I need visa sponsorship / I&rsquo;m an international student
                </option>
                <option value="other">Other</option>
              </select>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
              <input
                type="checkbox"
                checked={!!profile.has_clearance}
                onChange={(e) => save({ has_clearance: e.target.checked })}
                style={{ accentColor: 'var(--accent)' }}
              />
              I hold an active security clearance
            </label>
          </div>
        </section>

        {/* What you're looking for */}
        <section>
          <SectionTitle>What you&rsquo;re looking for</SectionTitle>
          <div className="card space-y-4 p-4">
            <div>
              <p className="label">Target seasons</p>
              <ChipPicker
                options={SEASONS.filter((s) => s !== 'Unknown')}
                selected={profile.preferred_seasons}
                onToggle={(value) =>
                  save({ preferred_seasons: toggleIn(profile.preferred_seasons, value) })
                }
              />
            </div>

            <div>
              <p className="label">Target years</p>
              <ChipPicker
                options={YEAR_OPTIONS}
                selected={profile.preferred_years}
                onToggle={(value) =>
                  save({ preferred_years: toggleIn(profile.preferred_years, value) })
                }
              />
            </div>

            <div>
              <p className="label">Fields you&rsquo;re interested in</p>
              <ChipPicker
                options={[...FIELDS]}
                selected={profile.preferred_fields}
                onToggle={(value) =>
                  save({ preferred_fields: toggleIn(profile.preferred_fields, value) })
                }
              />
            </div>

            <Field
              label="Preferred locations"
              hint="Comma separated — cities, states, or countries. Used for fit scoring."
            >
              <input
                className="input"
                defaultValue={profile.preferred_locations.join(', ')}
                onBlur={(e) =>
                  save({
                    preferred_locations: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="New York, CA, Remote"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Work arrangement">
                <select
                  className="select"
                  value={profile.remote_pref}
                  onChange={(e) => save({ remote_pref: e.target.value })}
                >
                  <option value="any">No preference</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </Field>
              <Field label="Minimum hourly rate (USD)">
                <input
                  className="input"
                  type="number"
                  min="0"
                  defaultValue={profile.min_hourly ?? ''}
                  onBlur={(e) =>
                    save({ min_hourly: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
              <Field label="Earliest I can start">
                <input
                  className="input"
                  type="date"
                  defaultValue={toDateInput(profile.earliest_start)}
                  onBlur={(e) => save({ earliest_start: fromDateInput(e.target.value) })}
                />
              </Field>
              <Field label="Latest I can start">
                <input
                  className="input"
                  type="date"
                  defaultValue={toDateInput(profile.latest_start)}
                  onBlur={(e) => save({ latest_start: fromDateInput(e.target.value) })}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
                <input
                  type="checkbox"
                  checked={!!profile.willing_to_relocate}
                  onChange={(e) => save({ willing_to_relocate: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                I&rsquo;m willing to relocate
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
                <input
                  type="checkbox"
                  checked={!!profile.paid_only}
                  onChange={(e) => save({ paid_only: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Only paid roles
              </label>
            </div>

            <Field label="Weekly application goal" hint="Shown as a progress meter on your dashboard">
              <input
                className="input max-w-24"
                type="number"
                min="1"
                max="50"
                defaultValue={profile.weekly_goal}
                onBlur={(e) => save({ weekly_goal: Number(e.target.value) || 5 })}
              />
            </Field>
          </div>
        </section>

        {/* Skills & resume */}
        <section>
          <SectionTitle>Skills &amp; resume</SectionTitle>
          <div className="card space-y-4 p-4">
            <div>
              <p className="label">Your skills</p>
              <p className="mb-2 text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                Matched against the skills each posting asks for. Overlap raises the fit score.
              </p>
              <ChipPicker
                options={detectedSkills}
                selected={profile.skills}
                onToggle={(value) => save({ skills: toggleIn(profile.skills, value) })}
                collapsible
              />
            </div>

            <Field
              label="Resume text"
              hint="Paste your resume. Skills are extracted from it automatically and folded into fit scoring — it is never uploaded anywhere."
            >
              <textarea
                className="textarea"
                style={{ minHeight: '10rem' }}
                defaultValue={profile.resume_text ?? ''}
                onBlur={(e) => save({ resume_text: e.target.value })}
                placeholder="Paste the plain text of your resume here…"
              />
            </Field>
          </div>
        </section>

        {/* Data */}
        <section>
          <SectionTitle>Your data</SectionTitle>
          <div className="card space-y-3 p-4">
            <p className="text-[0.8125rem]" style={{ color: 'var(--ink-secondary)' }}>
              Everything lives in a local SQLite file. Export a full backup any time, or bring in
              applications you have been tracking elsewhere.
            </p>

            <div className="flex flex-wrap gap-2">
              <a className="btn btn-sm" href="/api/export?format=json">
                Export full backup (JSON)
              </a>
              <a className="btn btn-sm" href="/api/export?format=csv">
                Export applications (CSV)
              </a>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => fileInput.current?.click()}
                disabled={importing}
              >
                {importing ? 'Importing…' : 'Import JSON or CSV'}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,.csv,text/csv,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importFile(file);
                }}
              />
            </div>

            <p className="text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
              CSV import accepts a header row with any of: company, role, status, location, season,
              field, applied_at, deadline, notes, referral, url. Rows matching an application you
              already have are skipped, so re-importing is safe.
            </p>
          </div>
        </section>
      </div>

      {toast ? (
        <div
          className="no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3.5 py-2 text-[0.8125rem] shadow-lg"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--line-strong)' }}
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function ChipPicker({
  options,
  selected,
  onToggle,
  collapsible = false,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsible);
  // Keep chosen values visible even when the list is collapsed.
  const visible = expanded
    ? options
    : [...new Set([...selected, ...options.slice(0, 18)])];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              className="chip"
              onClick={() => onToggle(option)}
              aria-pressed={active}
              style={{
                cursor: 'pointer',
                background: active ? 'var(--accent)' : 'var(--surface-2)',
                borderColor: active ? 'var(--accent)' : 'var(--line)',
                color: active ? 'var(--accent-ink)' : 'var(--ink-secondary)',
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
      {collapsible ? (
        <button
          type="button"
          className="mt-1.5 text-[0.6875rem]"
          style={{ color: 'var(--accent)' }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show fewer' : `Show all ${options.length}`}
        </button>
      ) : null}
    </div>
  );
}
