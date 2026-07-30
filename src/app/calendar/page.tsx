import Link from 'next/link';
import { getDb } from '@/lib/db';
import { EmptyState, PageHeader, SectionTitle, StatusBadge } from '@/components/ui';
import { CalendarCopyLink } from '@/components/CalendarCopyLink';
import type { AppStatus } from '@/lib/types';
import { DAY, formatDate, formatDateTime, relativeTime, titleCase } from '@/lib/util';

export const dynamic = 'force-dynamic';

interface CalendarEntry {
  key: string;
  at: number;
  kind: 'deadline' | 'interview' | 'task' | 'offer';
  title: string;
  detail: string;
  href: string;
  status?: AppStatus;
  allDay: boolean;
}

/** Pull every dated thing the student needs to show up for into one list. */
function loadEntries(): CalendarEntry[] {
  const db = getDb();
  const entries: CalendarEntry[] = [];

  for (const row of db
    .prepare(
      `SELECT id, company, role, deadline, status FROM applications
       WHERE deadline IS NOT NULL AND archived = 0`,
    )
    .all() as { id: number; company: string; role: string; deadline: number; status: AppStatus }[]) {
    entries.push({
      key: `deadline-${row.id}`,
      at: row.deadline,
      kind: 'deadline',
      title: `${row.role} closes`,
      detail: row.company,
      href: `/tracker/${row.id}`,
      status: row.status,
      allDay: true,
    });
  }

  for (const row of db
    .prepare(
      `SELECT iv.id, iv.kind, iv.round, iv.scheduled_at, iv.location, iv.duration_min,
              a.company, a.role, a.id AS application_id
       FROM interviews iv JOIN applications a ON a.id = iv.application_id
       WHERE iv.scheduled_at IS NOT NULL`,
    )
    .all() as {
    id: number;
    kind: string;
    round: number;
    scheduled_at: number;
    location: string | null;
    duration_min: number | null;
    company: string;
    role: string;
    application_id: number;
  }[]) {
    entries.push({
      key: `interview-${row.id}`,
      at: row.scheduled_at,
      kind: 'interview',
      title: `${titleCase(row.kind)} · round ${row.round}`,
      detail: [row.company, row.location, row.duration_min ? `${row.duration_min} min` : null]
        .filter(Boolean)
        .join(' · '),
      href: `/tracker/${row.application_id}`,
      allDay: false,
    });
  }

  for (const row of db
    .prepare(
      `SELECT t.id, t.title, t.due_at, t.application_id, a.company FROM tasks t
       LEFT JOIN applications a ON a.id = t.application_id
       WHERE t.done = 0 AND t.due_at IS NOT NULL`,
    )
    .all() as {
    id: number;
    title: string;
    due_at: number;
    application_id: number | null;
    company: string | null;
  }[]) {
    entries.push({
      key: `task-${row.id}`,
      at: row.due_at,
      kind: 'task',
      title: row.title,
      detail: row.company ?? 'Task',
      href: row.application_id ? `/tracker/${row.application_id}` : '/tracker',
      allDay: true,
    });
  }

  for (const row of db
    .prepare(
      `SELECT o.id, o.respond_by, a.company, a.id AS application_id FROM offers o
       JOIN applications a ON a.id = o.application_id
       WHERE o.respond_by IS NOT NULL AND o.status IN ('received', 'negotiating')`,
    )
    .all() as { id: number; respond_by: number; company: string; application_id: number }[]) {
    entries.push({
      key: `offer-${row.id}`,
      at: row.respond_by,
      kind: 'offer',
      title: 'Offer decision due',
      detail: row.company,
      href: `/tracker/${row.application_id}`,
      allDay: true,
    });
  }

  return entries.sort((a, b) => a.at - b.at);
}

const KIND_LABEL: Record<CalendarEntry['kind'], string> = {
  deadline: 'Deadline',
  interview: 'Interview',
  task: 'To-do',
  offer: 'Offer',
};

export default function CalendarPage() {
  const entries = loadEntries();
  const now = Math.floor(Date.now() / 1000);
  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  })();

  const overdue = entries.filter((entry) => entry.at < todayStart);
  const upcoming = entries.filter((entry) => entry.at >= todayStart);

  const thisWeek = upcoming.filter((entry) => entry.at < todayStart + 7 * DAY);
  const later = upcoming.filter((entry) => entry.at >= todayStart + 7 * DAY);

  // Group the "later" bucket by month so a long list stays scannable.
  const byMonth = new Map<string, CalendarEntry[]>();
  for (const entry of later) {
    const label = new Date(entry.at * 1000).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
    const bucket = byMonth.get(label) ?? [];
    bucket.push(entry);
    byMonth.set(label, bucket);
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Every deadline, interview, and to-do you're tracking, in date order."
        actions={<CalendarCopyLink />}
      />

      <div className="max-w-3xl space-y-6 p-4 sm:p-6">
        {entries.length === 0 ? (
          <EmptyState
            title="Nothing scheduled yet"
            action={
              <Link href="/" className="btn btn-primary btn-sm">
                Find internships
              </Link>
            }
          >
            Deadlines from applications you track, interviews you schedule, and to-dos with due dates
            all show up here. You can also subscribe to the feed from Google Calendar or Apple
            Calendar so they sit alongside your classes.
          </EmptyState>
        ) : (
          <>
            {overdue.length > 0 ? (
              <section>
                <SectionTitle>Past due</SectionTitle>
                <EntryList entries={overdue.slice(-10).reverse()} now={now} muted />
              </section>
            ) : null}

            <section>
              <SectionTitle>Next 7 days</SectionTitle>
              {thisWeek.length === 0 ? (
                <div className="card p-4 text-[0.8125rem]" style={{ color: 'var(--ink-muted)' }}>
                  Nothing due this week.
                </div>
              ) : (
                <EntryList entries={thisWeek} now={now} />
              )}
            </section>

            {[...byMonth.entries()].map(([month, monthEntries]) => (
              <section key={month}>
                <SectionTitle>{month}</SectionTitle>
                <EntryList entries={monthEntries} now={now} />
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function EntryList({
  entries,
  now,
  muted = false,
}: {
  entries: CalendarEntry[];
  now: number;
  muted?: boolean;
}) {
  return (
    <ul className="card divide-y" style={{ borderColor: 'var(--line)' }}>
      {entries.map((entry) => {
        const urgent = !muted && entry.at - now < 3 * DAY;
        return (
          <li key={entry.key} style={{ borderColor: 'var(--line)' }}>
            <Link
              href={entry.href}
              className="flex items-start gap-3 p-3"
              style={{ opacity: muted ? 0.65 : 1 }}
            >
              <div className="w-24 shrink-0">
                <p
                  className="tnum text-[0.75rem] font-medium"
                  style={{ color: urgent ? 'var(--critical)' : 'var(--ink-primary)' }}
                >
                  {formatDate(entry.at, { year: undefined })}
                </p>
                <p className="text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                  {entry.allDay
                    ? relativeTime(entry.at)
                    : formatDateTime(entry.at).split(', ').slice(-1)[0]}
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[0.8125rem] font-medium">{entry.title}</p>
                <p className="truncate text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                  {entry.detail}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="chip">{KIND_LABEL[entry.kind]}</span>
                {entry.status ? <StatusBadge status={entry.status} small /> : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
