import { handler } from '@/lib/api';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar — an iCalendar feed of deadlines and interviews.
 *
 * Subscribe to this URL from Google Calendar, Apple Calendar, or Outlook and
 * every deadline you're tracking shows up alongside your classes.
 */
export const GET = handler(async (request: Request) => {
  const db = getDb();
  const origin = new URL(request.url).origin;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InternFinder//Application Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:InternFinder',
    'X-WR-CALDESC:Internship application deadlines and interviews',
  ];

  // Application deadlines, as all-day events.
  const deadlines = db
    .prepare(
      `SELECT id, company, role, deadline, status, apply_url FROM applications
       WHERE deadline IS NOT NULL AND archived = 0`,
    )
    .all() as {
    id: number;
    company: string;
    role: string;
    deadline: number;
    status: string;
    apply_url: string | null;
  }[];

  for (const row of deadlines) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:deadline-${row.id}@internfinder`,
      `DTSTAMP:${icsStamp(Math.floor(Date.now() / 1000))}`,
      `DTSTART;VALUE=DATE:${icsDate(row.deadline)}`,
      `DTEND;VALUE=DATE:${icsDate(row.deadline + 86400)}`,
      `SUMMARY:${esc(`Deadline: ${row.role} @ ${row.company}`)}`,
      `DESCRIPTION:${esc(
        [
          `Status: ${row.status.replace(/_/g, ' ')}`,
          row.apply_url ? `Apply: ${row.apply_url}` : '',
          `Tracker: ${origin}/tracker/${row.id}`,
        ]
          .filter(Boolean)
          .join('\n'),
      )}`,
      'CATEGORIES:Internship deadline',
      // Nudge the day before at 9am local.
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`${row.role} @ ${row.company} closes tomorrow`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  // Scheduled interviews, as timed events.
  const interviews = db
    .prepare(
      `SELECT iv.id, iv.kind, iv.round, iv.scheduled_at, iv.duration_min, iv.location,
              iv.interviewer, a.company, a.role, a.id AS application_id
       FROM interviews iv JOIN applications a ON a.id = iv.application_id
       WHERE iv.scheduled_at IS NOT NULL`,
    )
    .all() as {
    id: number;
    kind: string;
    round: number;
    scheduled_at: number;
    duration_min: number | null;
    location: string | null;
    interviewer: string | null;
    company: string;
    role: string;
    application_id: number;
  }[];

  for (const row of interviews) {
    const duration = (row.duration_min ?? 60) * 60;
    lines.push(
      'BEGIN:VEVENT',
      `UID:interview-${row.id}@internfinder`,
      `DTSTAMP:${icsStamp(Math.floor(Date.now() / 1000))}`,
      `DTSTART:${icsStamp(row.scheduled_at)}`,
      `DTEND:${icsStamp(row.scheduled_at + duration)}`,
      `SUMMARY:${esc(`${title(row.kind)} (Round ${row.round}): ${row.company}`)}`,
      row.location ? `LOCATION:${esc(row.location)}` : '',
      `DESCRIPTION:${esc(
        [
          `Role: ${row.role}`,
          row.interviewer ? `Interviewer: ${row.interviewer}` : '',
          `Tracker: ${origin}/tracker/${row.application_id}`,
        ]
          .filter(Boolean)
          .join('\n'),
      )}`,
      'CATEGORIES:Interview',
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`Interview with ${row.company} in 1 hour`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  // Open tasks with due dates.
  const tasks = db
    .prepare(
      `SELECT t.id, t.title, t.due_at, a.company FROM tasks t
       LEFT JOIN applications a ON a.id = t.application_id
       WHERE t.done = 0 AND t.due_at IS NOT NULL`,
    )
    .all() as { id: number; title: string; due_at: number; company: string | null }[];

  for (const row of tasks) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:task-${row.id}@internfinder`,
      `DTSTAMP:${icsStamp(Math.floor(Date.now() / 1000))}`,
      `DTSTART;VALUE=DATE:${icsDate(row.due_at)}`,
      `DTEND;VALUE=DATE:${icsDate(row.due_at + 86400)}`,
      `SUMMARY:${esc(row.company ? `${row.title} (${row.company})` : row.title)}`,
      'CATEGORIES:Task',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  return new Response(lines.filter(Boolean).join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="internfinder.ics"',
      'Cache-Control': 'no-store',
    },
  });
});

/** UTC timestamp in iCalendar basic format. */
function icsStamp(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Date-only value. Uses local date so an all-day event lands on the right day. */
function icsDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** Escape per RFC 5545: backslashes, semicolons, commas, and newlines. */
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function title(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
