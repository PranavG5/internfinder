'use client';

import { useEffect, useState } from 'react';
import { APP_STATUSES, FIELDS, SEASONS, STATUS_META } from '@/lib/types';
import { fromDateInput } from '@/lib/util';
import { Field } from './ui';

/**
 * Manual entry, for roles found outside this app: a career fair, a referral, a
 * professor's email. Only company and role are required; everything else is
 * optional so adding something takes seconds.
 */
export function AddApplicationDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    company: '',
    role: '',
    status: 'applied',
    priority: 3,
    origin: 'manual',
    location: '',
    season: '',
    year: '',
    field: '',
    apply_url: '',
    applied_at: '',
    deadline: '',
    next_action: '',
    referral: false,
    referrer: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) {
      setError('Company and role are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          company: form.company.trim(),
          role: form.role.trim(),
          year: form.year ? Number(form.year) : null,
          applied_at: fromDateInput(form.applied_at),
          deadline: fromDateInput(form.deadline),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Could not save');
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Add an application"
    >
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-4">
        <h2 className="mb-3 text-[0.9375rem] font-semibold">Add an application</h2>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company *">
              <input
                className="input"
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Role *">
              <input
                className="input"
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                required
              />
            </Field>
            <Field label="Status">
              <select
                className="select"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {APP_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_META[status].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="How did you find it?">
              <select
                className="select"
                value={form.origin}
                onChange={(e) => set('origin', e.target.value)}
              >
                <option value="manual">Found it myself</option>
                <option value="internindex">InternIndex</option>
                <option value="referral">Referral</option>
                <option value="career-fair">Career fair</option>
                <option value="recruiter">Recruiter reached out</option>
                <option value="linkedin">LinkedIn</option>
                <option value="school">School / career center</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Location">
              <input
                className="input"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="San Francisco, CA"
              />
            </Field>
            <Field label="Field">
              <select
                className="select"
                value={form.field}
                onChange={(e) => set('field', e.target.value)}
              >
                <option value="">–</option>
                {FIELDS.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Season">
              <select
                className="select"
                value={form.season}
                onChange={(e) => set('season', e.target.value)}
              >
                <option value="">–</option>
                {SEASONS.filter((s) => s !== 'Unknown').map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Year">
              <input
                className="input"
                type="number"
                min="2020"
                max="2035"
                value={form.year}
                onChange={(e) => set('year', e.target.value)}
              />
            </Field>
            <Field label="Date applied">
              <input
                className="input"
                type="date"
                value={form.applied_at}
                onChange={(e) => set('applied_at', e.target.value)}
              />
            </Field>
            <Field label="Deadline">
              <input
                className="input"
                type="date"
                value={form.deadline}
                onChange={(e) => set('deadline', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Posting URL">
            <input
              className="input"
              type="url"
              value={form.apply_url}
              onChange={(e) => set('apply_url', e.target.value)}
              placeholder="https://…"
            />
          </Field>

          <Field label="Priority" hint="5 means dream role">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="btn btn-sm flex-1"
                  onClick={() => set('priority', value)}
                  aria-pressed={form.priority === value}
                  style={
                    form.priority === value
                      ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)' }
                      : undefined
                  }
                >
                  {value}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Next action">
            <input
              className="input"
              value={form.next_action}
              onChange={(e) => set('next_action', e.target.value)}
              placeholder="e.g. follow up with recruiter"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
              <input
                type="checkbox"
                checked={form.referral}
                onChange={(e) => set('referral', e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              I have a referral
            </label>
            {form.referral ? (
              <input
                className="input"
                value={form.referrer}
                onChange={(e) => set('referrer', e.target.value)}
                placeholder="Who referred you?"
              />
            ) : null}
          </div>

          <Field label="Notes">
            <textarea
              className="textarea"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>

          {error ? (
            <p className="text-[0.75rem]" style={{ color: 'var(--critical)' }}>
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : 'Add application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
