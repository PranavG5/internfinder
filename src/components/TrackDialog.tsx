'use client';

import { useEffect, useRef, useState } from 'react';
import type { InternshipView } from '@/lib/types';
import { APP_STATUSES, STATUS_META } from '@/lib/types';
import { toDateInput, fromDateInput } from '@/lib/util';
import { Field } from './ui';

/**
 * Adds a listing to the tracker. Company, role, deadline, and season are copied
 * from the listing, so the only real decision is where it sits in your pipeline.
 */
export function TrackDialog({
  listing,
  onClose,
  onSaved,
}: {
  listing: InternshipView;
  onClose: () => void;
  onSaved: (applicationId: number, status: string) => void;
}) {
  const [status, setStatus] = useState<string>('applied');
  const [priority, setPriority] = useState(3);
  const [deadline, setDeadline] = useState(toDateInput(listing.deadline));
  const [notes, setNotes] = useState('');
  const [referral, setReferral] = useState(false);
  const [nextAction, setNextAction] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    dialog.current?.querySelector<HTMLElement>('select, input')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internship_id: listing.id,
          status,
          priority,
          deadline: fromDateInput(deadline),
          notes: notes.trim() || null,
          referral,
          next_action: nextAction.trim() || null,
          origin: 'internindex',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Already tracking it — send the user to the existing entry instead of
        // silently creating a duplicate.
        if (data.duplicate && data.application_id) {
          onSaved(data.application_id, status);
          return;
        }
        throw new Error(data.error ?? 'Could not save');
      }
      onSaved(data.application.id, data.application.status);
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
      aria-label="Add to tracker"
    >
      <div
        ref={dialog}
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-4"
        style={{ borderRadius: '12px 12px 0 0' }}
      >
        <div className="mb-3">
          <h2 className="text-[0.9375rem] font-semibold">Add to tracker</h2>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: 'var(--ink-secondary)' }}>
            {listing.title} · {listing.company}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Status">
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {APP_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_META[value].label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority" hint="5 means dream role — used to sort your tracker">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="btn btn-sm flex-1"
                  onClick={() => setPriority(value)}
                  aria-pressed={priority === value}
                  style={
                    priority === value
                      ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)' }
                      : undefined
                  }
                >
                  {value}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Deadline">
            <input
              className="input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>

          <Field label="Next action" hint="e.g. tailor resume, ask for a referral">
            <input
              className="input"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
            <input
              type="checkbox"
              checked={referral}
              onChange={(e) => setReferral(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            I have a referral for this
          </label>

          <Field label="Notes">
            <textarea
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering…"
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
              {saving ? 'Saving…' : 'Add to tracker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
