'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { APP_STATUSES, STATUS_META, type AppStatus, type Application } from '@/lib/types';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  fromDateInput,
  relativeTime,
  titleCase,
  toDateInput,
} from '@/lib/util';
import { ExternalIcon, Field, PageHeader, SectionTitle, StatusBadge } from './ui';

interface EventRow {
  id: number;
  type: string;
  from_status: string | null;
  to_status: string | null;
  title: string | null;
  body: string | null;
  occurred_at: number;
}
interface InterviewRow {
  id: number;
  round: number;
  kind: string;
  scheduled_at: number | null;
  duration_min: number | null;
  location: string | null;
  interviewer: string | null;
  prep_notes: string | null;
  outcome: string | null;
  feedback: string | null;
}
interface ContactRow {
  id: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  relationship: string | null;
  notes: string | null;
}
interface OfferRow {
  id: number;
  pay_rate: number | null;
  pay_period: string | null;
  currency: string | null;
  hours_per_week: number | null;
  weeks: number | null;
  signing_bonus: number | null;
  housing_stipend: number | null;
  relocation: number | null;
  location: string | null;
  col_index: number | null;
  respond_by: number | null;
  status: string;
  notes: string | null;
}
interface TaskRow {
  id: number;
  title: string;
  done: number;
  due_at: number | null;
}

/** Suggested to-dos, so the checklist isn't a blank box. */
const TASK_SUGGESTIONS = [
  'Tailor resume to this posting',
  'Ask for a referral',
  'Write / adapt cover letter',
  'Research the team and product',
  'Prepare 3 questions for the interviewer',
  'Send a thank-you note',
  'Follow up if no reply in 2 weeks',
];

export function ApplicationDetail({
  application: initial,
  initialEvents,
  initialInterviews,
  initialContacts,
  initialOffers,
  initialTasks,
}: {
  application: Application;
  initialEvents: EventRow[];
  initialInterviews: InterviewRow[];
  initialContacts: ContactRow[];
  initialOffers: OfferRow[];
  initialTasks: TaskRow[];
}) {
  const router = useRouter();
  const [app, setApp] = useState(initial);
  const [events, setEvents] = useState(initialEvents);
  const [interviews, setInterviews] = useState(initialInterviews);
  const [contacts, setContacts] = useState(initialContacts);
  const [offers, setOffers] = useState(initialOffers);
  const [tasks, setTasks] = useState(initialTasks);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const patch = useCallback(
    async (changes: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/applications/${app.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        });
        if (!res.ok) throw new Error('Save failed');
        const data = await res.json();
        setApp(data.application);
        // A status change writes a timeline entry server-side; pick it up.
        if ('status' in changes) {
          const fresh = await fetch(`/api/applications/${app.id}/events`).then((r) => r.json());
          setEvents(fresh.events ?? []);
        }
        flash('Saved.');
      } catch {
        flash('Could not save.');
      } finally {
        setSaving(false);
      }
    },
    [app.id],
  );

  const addNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim()) return;
    const res = await fetch(`/api/applications/${app.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'note', body: note.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events ?? []);
      setNote('');
      flash('Note added.');
    }
  };

  const createChild = async (table: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/children/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, application_id: app.id }),
    });
    if (!res.ok) {
      flash('Could not add that.');
      return null;
    }
    const data = await res.json();
    return data.item;
  };

  const removeChild = async (table: string, id: number) => {
    await fetch(`/api/children/${table}/${id}`, { method: 'DELETE' });
  };

  const remove = async () => {
    if (!window.confirm(`Delete the ${app.company} application and all its history? This cannot be undone.`)) {
      return;
    }
    await fetch(`/api/applications/${app.id}`, { method: 'DELETE' });
    router.push('/tracker');
  };

  const openTasks = tasks.filter((t) => !t.done).length;

  return (
    <div>
      <PageHeader
        title={app.company}
        subtitle={
          <>
            {app.role}
            {app.location ? ` · ${app.location}` : ''}
            {app.season ? ` · ${app.season}${app.year ? ` ${app.year}` : ''}` : ''}
          </>
        }
        actions={
          <>
            <Link href="/tracker" className="btn btn-sm">
              ← All applications
            </Link>
            {app.apply_url ? (
              <a
                href={app.apply_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="btn btn-sm"
              >
                Posting <ExternalIcon />
              </a>
            ) : null}
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
              Delete
            </button>
          </>
        }
      />

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-3">
        {/* Left: status and the editable core fields */}
        <div className="space-y-5 lg:col-span-2">
          <section className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={app.status} />
                {saving ? (
                  <span className="text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                    saving…
                  </span>
                ) : null}
              </div>
              <span className="text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                Updated {relativeTime(app.updated_at)}
              </span>
            </div>

            {/* One-click advance through the pipeline. */}
            <p className="label">Move to</p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {APP_STATUSES.filter((status) => status !== app.status).map((status) => (
                <button
                  key={status}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => patch({ status })}
                >
                  {STATUS_META[status].label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Priority">
                <select
                  className="select"
                  value={app.priority}
                  onChange={(e) => patch({ priority: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 5 ? '(dream role)' : n === 1 ? '(low)' : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Date applied">
                <input
                  className="input"
                  type="date"
                  defaultValue={toDateInput(app.applied_at)}
                  onBlur={(e) => patch({ applied_at: fromDateInput(e.target.value) })}
                />
              </Field>

              <Field label="Deadline">
                <input
                  className="input"
                  type="date"
                  defaultValue={toDateInput(app.deadline)}
                  onBlur={(e) => patch({ deadline: fromDateInput(e.target.value) })}
                />
              </Field>

              <Field label="Resume version used" hint="Track which resume got results">
                <input
                  className="input"
                  defaultValue={app.resume_version ?? ''}
                  onBlur={(e) => patch({ resume_version: e.target.value })}
                  placeholder="e.g. swe-v3.pdf"
                />
              </Field>

              <Field label="Next action">
                <input
                  className="input"
                  defaultValue={app.next_action ?? ''}
                  onBlur={(e) => patch({ next_action: e.target.value })}
                  placeholder="e.g. email recruiter"
                />
              </Field>

              <Field label="Next action date">
                <input
                  className="input"
                  type="date"
                  defaultValue={toDateInput(app.next_action_at)}
                  onBlur={(e) => patch({ next_action_at: fromDateInput(e.target.value) })}
                />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap gap-4">
              <Toggle
                label="Cover letter sent"
                checked={!!app.cover_letter_sent}
                onChange={(v) => patch({ cover_letter_sent: v })}
              />
              <Toggle
                label="Portfolio sent"
                checked={!!app.portfolio_sent}
                onChange={(v) => patch({ portfolio_sent: v })}
              />
              <Toggle
                label="Referred"
                checked={!!app.referral}
                onChange={(v) => patch({ referral: v })}
              />
              <Toggle
                label="Archived"
                checked={!!app.archived}
                onChange={(v) => patch({ archived: v })}
              />
            </div>

            {app.referral ? (
              <div className="mt-3">
                <Field label="Referred by">
                  <input
                    className="input"
                    defaultValue={app.referrer ?? ''}
                    onBlur={(e) => patch({ referrer: e.target.value })}
                  />
                </Field>
              </div>
            ) : null}

            {app.status === 'rejected' ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Rejected at which stage" hint="Feeds your insights breakdown">
                  <select
                    className="select"
                    defaultValue={app.rejected_stage ?? ''}
                    onChange={(e) => patch({ rejected_stage: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="resume screen">Resume screen</option>
                    <option value="online assessment">Online assessment</option>
                    <option value="phone screen">Phone screen</option>
                    <option value="technical interview">Technical interview</option>
                    <option value="final round">Final round</option>
                    <option value="offer stage">Offer stage</option>
                  </select>
                </Field>
                <Field label="Reason given (if any)">
                  <input
                    className="input"
                    defaultValue={app.rejection_reason ?? ''}
                    onBlur={(e) => patch({ rejection_reason: e.target.value })}
                  />
                </Field>
              </div>
            ) : null}

            <div className="mt-3">
              <Field label="Notes">
                <textarea
                  className="textarea"
                  defaultValue={app.notes ?? ''}
                  onBlur={(e) => patch({ notes: e.target.value })}
                  placeholder="Anything worth remembering about this application…"
                />
              </Field>
            </div>
          </section>

          {/* Timeline */}
          <section>
            <SectionTitle>Timeline</SectionTitle>
            <div className="card p-4">
              <form onSubmit={addNote} className="mb-4 flex gap-2">
                <input
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Log a note, an email you sent, a call…"
                />
                <button type="submit" className="btn btn-sm" disabled={!note.trim()}>
                  Add
                </button>
              </form>

              {events.length === 0 ? (
                <p className="text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
                  Nothing logged yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {events.map((event) => (
                    <li key={event.id} className="flex gap-2.5">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background:
                            event.type === 'status_change' ? 'var(--accent)' : 'var(--line-strong)',
                        }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.8125rem]">
                          {event.title ?? titleCase(event.type)}
                        </p>
                        {event.body ? (
                          <p
                            className="mt-0.5 text-[0.75rem] whitespace-pre-line"
                            style={{ color: 'var(--ink-secondary)' }}
                          >
                            {event.body}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                          {formatDateTime(event.occurred_at)} · {relativeTime(event.occurred_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          {/* Interviews */}
          <section>
            <SectionTitle>Interviews</SectionTitle>
            <InterviewList
              interviews={interviews}
              onAdd={async (body) => {
                const item = await createChild('interviews', body);
                if (item) {
                  setInterviews((prev) => [...prev, item]);
                  flash('Interview added.');
                }
              }}
              onUpdate={async (id, body) => {
                const res = await fetch(`/api/children/interviews/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });
                if (res.ok) {
                  const data = await res.json();
                  setInterviews((prev) => prev.map((iv) => (iv.id === id ? data.item : iv)));
                }
              }}
              onDelete={async (id) => {
                await removeChild('interviews', id);
                setInterviews((prev) => prev.filter((iv) => iv.id !== id));
              }}
            />
          </section>
        </div>

        {/* Right rail: checklist, contacts, offer */}
        <div className="space-y-5">
          <section>
            <SectionTitle>
              Checklist{openTasks > 0 ? ` · ${openTasks} open` : ''}
            </SectionTitle>
            <TaskList
              tasks={tasks}
              suggestions={TASK_SUGGESTIONS.filter(
                (s) => !tasks.some((t) => t.title === s),
              )}
              onAdd={async (title, dueAt) => {
                const item = await createChild('tasks', { title, due_at: dueAt });
                if (item) setTasks((prev) => [...prev, item]);
              }}
              onToggle={async (task) => {
                setTasks((prev) =>
                  prev.map((t) => (t.id === task.id ? { ...t, done: task.done ? 0 : 1 } : t)),
                );
                await fetch(`/api/children/tasks/${task.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ done: !task.done }),
                });
              }}
              onDelete={async (id) => {
                await removeChild('tasks', id);
                setTasks((prev) => prev.filter((t) => t.id !== id));
              }}
            />
          </section>

          <section>
            <SectionTitle>Contacts</SectionTitle>
            <ContactList
              contacts={contacts}
              onAdd={async (body) => {
                const item = await createChild('contacts', body);
                if (item) setContacts((prev) => [item, ...prev]);
              }}
              onDelete={async (id) => {
                await removeChild('contacts', id);
                setContacts((prev) => prev.filter((c) => c.id !== id));
              }}
            />
          </section>

          <section>
            <SectionTitle>Offer</SectionTitle>
            <OfferPanel
              offers={offers}
              onAdd={async (body) => {
                const item = await createChild('offers', body);
                if (item) {
                  setOffers((prev) => [item, ...prev]);
                  flash('Offer recorded.');
                }
              }}
              onDelete={async (id) => {
                await removeChild('offers', id);
                setOffers((prev) => prev.filter((o) => o.id !== id));
              }}
            />
          </section>
        </div>
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--accent)' }}
      />
      {label}
    </label>
  );
}

function InterviewList({
  interviews,
  onAdd,
  onUpdate,
  onDelete,
}: {
  interviews: InterviewRow[];
  onAdd: (body: Record<string, unknown>) => void;
  onUpdate: (id: number, body: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kind: 'technical',
    round: 1,
    scheduled_at: '',
    duration_min: 60,
    location: '',
    interviewer: '',
    prep_notes: '',
  });

  return (
    <div className="card p-4">
      {interviews.length === 0 && !open ? (
        <p className="mb-3 text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
          No interviews yet. Add one when you get the invite — it shows up on your calendar and in
          the ICS feed.
        </p>
      ) : null}

      <ul className="space-y-3">
        {interviews.map((iv) => (
          <li key={iv.id} className="border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: 'var(--line)' }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-medium">
                  Round {iv.round} · {titleCase(iv.kind)}
                </p>
                <p className="text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                  {iv.scheduled_at ? formatDateTime(iv.scheduled_at) : 'Not scheduled'}
                  {iv.duration_min ? ` · ${iv.duration_min} min` : ''}
                  {iv.location ? ` · ${iv.location}` : ''}
                </p>
                {iv.interviewer ? (
                  <p className="text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                    With {iv.interviewer}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  className="select w-auto text-[0.6875rem]"
                  value={iv.outcome ?? 'pending'}
                  onChange={(e) => onUpdate(iv.id, { outcome: e.target.value })}
                  aria-label="Interview outcome"
                >
                  <option value="pending">Pending</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Didn&rsquo;t pass</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onDelete(iv.id)}
                  aria-label="Delete interview"
                >
                  ✕
                </button>
              </div>
            </div>

            {iv.prep_notes ? (
              <p
                className="mt-1.5 text-[0.75rem] whitespace-pre-line"
                style={{ color: 'var(--ink-secondary)' }}
              >
                {iv.prep_notes}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {open ? (
        <form
          className="mt-3 space-y-3 border-t pt-3"
          style={{ borderColor: 'var(--line)' }}
          onSubmit={(event) => {
            event.preventDefault();
            onAdd({
              ...form,
              scheduled_at: fromDateInput(form.scheduled_at),
              outcome: 'pending',
            });
            setOpen(false);
            setForm({ ...form, scheduled_at: '', interviewer: '', prep_notes: '', round: form.round + 1 });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <select
                className="select"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                <option value="recruiter_screen">Recruiter screen</option>
                <option value="online_assessment">Online assessment</option>
                <option value="technical">Technical</option>
                <option value="behavioral">Behavioral</option>
                <option value="system_design">System design</option>
                <option value="case">Case study</option>
                <option value="final">Final</option>
                <option value="superday">Superday</option>
              </select>
            </Field>
            <Field label="Round">
              <input
                className="input"
                type="number"
                min="1"
                value={form.round}
                onChange={(e) => setForm({ ...form, round: Number(e.target.value) })}
              />
            </Field>
            <Field label="When">
              <input
                className="input"
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              />
            </Field>
            <Field label="Duration (min)">
              <input
                className="input"
                type="number"
                min="15"
                step="15"
                value={form.duration_min}
                onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })}
              />
            </Field>
            <Field label="Where">
              <input
                className="input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Zoom link, phone, office…"
              />
            </Field>
            <Field label="Interviewer">
              <input
                className="input"
                value={form.interviewer}
                onChange={(e) => setForm({ ...form, interviewer: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Prep notes">
            <textarea
              className="textarea"
              value={form.prep_notes}
              onChange={(e) => setForm({ ...form, prep_notes: e.target.value })}
              placeholder="Topics to review, questions to ask…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Add interview
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-sm mt-3" onClick={() => setOpen(true)}>
          + Add interview
        </button>
      )}
    </div>
  );
}

function TaskList({
  tasks,
  suggestions,
  onAdd,
  onToggle,
  onDelete,
}: {
  tasks: TaskRow[];
  suggestions: string[];
  onAdd: (title: string, dueAt: number | null) => void;
  onToggle: (task: TaskRow) => void;
  onDelete: (id: number) => void;
}) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  return (
    <div className="card p-4">
      <ul className="space-y-1.5">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={!!task.done}
              onChange={() => onToggle(task)}
              style={{ accentColor: 'var(--accent)' }}
              aria-label={task.title}
            />
            <span className="min-w-0 flex-1">
              <span
                className="block text-[0.8125rem]"
                style={{
                  color: task.done ? 'var(--ink-muted)' : 'var(--ink-primary)',
                  textDecoration: task.done ? 'line-through' : 'none',
                }}
              >
                {task.title}
              </span>
              {task.due_at ? (
                <span className="text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                  due {formatDate(task.due_at)}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onDelete(task.id)}
              aria-label={`Delete task: ${task.title}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onAdd(title.trim(), fromDateInput(due));
          setTitle('');
          setDue('');
        }}
      >
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a to-do…"
        />
        <div className="flex gap-2">
          <input
            className="input"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Task due date"
          />
          <button type="submit" className="btn btn-sm" disabled={!title.trim()}>
            Add
          </button>
        </div>
      </form>

      {suggestions.length > 0 ? (
        <div className="mt-3">
          <p className="label">Common next steps</p>
          <div className="flex flex-wrap gap-1">
            {suggestions.slice(0, 4).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chip"
                style={{ cursor: 'pointer' }}
                onClick={() => onAdd(suggestion, null)}
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContactList({
  contacts,
  onAdd,
  onDelete,
}: {
  contacts: ContactRow[];
  onAdd: (body: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    role: '',
    email: '',
    linkedin: '',
    relationship: 'recruiter',
    notes: '',
  });

  return (
    <div className="card p-4">
      {contacts.length === 0 && !open ? (
        <p className="mb-3 text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
          No contacts yet. Recording the recruiter or an alum here makes following up much easier.
        </p>
      ) : null}

      <ul className="space-y-2.5">
        {contacts.map((contact) => (
          <li key={contact.id} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-medium">{contact.name}</p>
              <p className="text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                {[contact.role, contact.relationship].filter(Boolean).join(' · ')}
              </p>
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="link text-[0.75rem]">
                  {contact.email}
                </a>
              ) : null}
              {contact.linkedin ? (
                <a
                  href={contact.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link block text-[0.75rem]"
                >
                  LinkedIn
                </a>
              ) : null}
              {contact.notes ? (
                <p className="mt-0.5 text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                  {contact.notes}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onDelete(contact.id)}
              aria-label={`Delete contact ${contact.name}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {open ? (
        <form
          className="mt-3 space-y-2 border-t pt-3"
          style={{ borderColor: 'var(--line)' }}
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim()) return;
            onAdd(form);
            setForm({ name: '', role: '', email: '', linkedin: '', relationship: 'recruiter', notes: '' });
            setOpen(false);
          }}
        >
          <input
            className="input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="input"
            placeholder="Their role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          <select
            className="select"
            value={form.relationship}
            onChange={(e) => setForm({ ...form, relationship: e.target.value })}
          >
            <option value="recruiter">Recruiter</option>
            <option value="hiring_manager">Hiring manager</option>
            <option value="engineer">Team member</option>
            <option value="alum">Alum</option>
            <option value="referral">Referral</option>
            <option value="professor">Professor</option>
            <option value="other">Other</option>
          </select>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="input"
            type="url"
            placeholder="LinkedIn URL"
            value={form.linkedin}
            onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
          />
          <textarea
            className="textarea"
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Add contact
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-sm mt-3" onClick={() => setOpen(true)}>
          + Add contact
        </button>
      )}
    </div>
  );
}

function OfferPanel({
  offers,
  onAdd,
  onDelete,
}: {
  offers: OfferRow[];
  onAdd: (body: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    pay_rate: '',
    pay_period: 'hour',
    hours_per_week: '40',
    weeks: '12',
    signing_bonus: '',
    housing_stipend: '',
    relocation: '',
    location: '',
    col_index: '100',
    respond_by: '',
    status: 'received',
    notes: '',
  });

  return (
    <div className="card p-4">
      {offers.length === 0 && !open ? (
        <p className="mb-3 text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
          No offer recorded. When one arrives, log it here to compare packages side by side on the
          Insights page.
        </p>
      ) : null}

      <ul className="space-y-3">
        {offers.map((offer) => {
          const rate = offer.pay_rate ?? 0;
          const hours = offer.hours_per_week ?? 40;
          const weeks = offer.weeks ?? 12;
          const hourly =
            offer.pay_period === 'month'
              ? rate / (hours * 4.345)
              : offer.pay_period === 'year'
                ? rate / (hours * 52)
                : rate;
          const total =
            hourly * hours * weeks +
            (offer.signing_bonus ?? 0) +
            (offer.housing_stipend ?? 0) +
            (offer.relocation ?? 0);

          return (
            <li key={offer.id} className="border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[0.8125rem] font-medium">
                    {formatMoney(offer.pay_rate, offer.currency ?? 'USD')}
                    {offer.pay_period === 'hour' ? '/hr' : offer.pay_period === 'month' ? '/mo' : '/yr'}
                  </p>
                  <p className="text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                    ≈ {formatMoney(total, offer.currency ?? 'USD')} total over {weeks} weeks
                  </p>
                  {offer.respond_by ? (
                    <p className="text-[0.75rem]" style={{ color: 'var(--critical)' }}>
                      Respond by {formatDate(offer.respond_by)}
                    </p>
                  ) : null}
                  {offer.notes ? (
                    <p className="mt-0.5 text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                      {offer.notes}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onDelete(offer.id)}
                  aria-label="Delete offer"
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {open ? (
        <form
          className="mt-3 space-y-2 border-t pt-3"
          style={{ borderColor: 'var(--line)' }}
          onSubmit={(event) => {
            event.preventDefault();
            onAdd({
              pay_rate: form.pay_rate ? Number(form.pay_rate) : null,
              pay_period: form.pay_period,
              hours_per_week: Number(form.hours_per_week) || 40,
              weeks: Number(form.weeks) || 12,
              signing_bonus: form.signing_bonus ? Number(form.signing_bonus) : null,
              housing_stipend: form.housing_stipend ? Number(form.housing_stipend) : null,
              relocation: form.relocation ? Number(form.relocation) : null,
              location: form.location,
              col_index: Number(form.col_index) || 100,
              respond_by: fromDateInput(form.respond_by),
              status: form.status,
              notes: form.notes,
            });
            setOpen(false);
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Pay rate">
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.pay_rate}
                onChange={(e) => setForm({ ...form, pay_rate: e.target.value })}
                required
              />
            </Field>
            <Field label="Per">
              <select
                className="select"
                value={form.pay_period}
                onChange={(e) => setForm({ ...form, pay_period: e.target.value })}
              >
                <option value="hour">Hour</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </Field>
            <Field label="Hours / week">
              <input
                className="input"
                type="number"
                value={form.hours_per_week}
                onChange={(e) => setForm({ ...form, hours_per_week: e.target.value })}
              />
            </Field>
            <Field label="Weeks">
              <input
                className="input"
                type="number"
                value={form.weeks}
                onChange={(e) => setForm({ ...form, weeks: e.target.value })}
              />
            </Field>
            <Field label="Signing bonus">
              <input
                className="input"
                type="number"
                value={form.signing_bonus}
                onChange={(e) => setForm({ ...form, signing_bonus: e.target.value })}
              />
            </Field>
            <Field label="Housing stipend">
              <input
                className="input"
                type="number"
                value={form.housing_stipend}
                onChange={(e) => setForm({ ...form, housing_stipend: e.target.value })}
              />
            </Field>
            <Field label="Relocation">
              <input
                className="input"
                type="number"
                value={form.relocation}
                onChange={(e) => setForm({ ...form, relocation: e.target.value })}
              />
            </Field>
            <Field label="Cost of living" hint="100 = US average">
              <input
                className="input"
                type="number"
                value={form.col_index}
                onChange={(e) => setForm({ ...form, col_index: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Respond by">
            <input
              className="input"
              type="date"
              value={form.respond_by}
              onChange={(e) => setForm({ ...form, respond_by: e.target.value })}
            />
          </Field>
          <textarea
            className="textarea"
            placeholder="Notes on the offer…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save offer
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-sm mt-3" onClick={() => setOpen(true)}>
          + Record an offer
        </button>
      )}
    </div>
  );
}
