import { fail, handler } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { one, q } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar?token=… — an iCalendar feed of deadlines and interviews.
 *
 * Subscribe to this URL from Google Calendar, Apple Calendar, or Outlook and
 * every deadline you're tracking shows up alongside your classes. Calendar
 * apps can't send cookies, so the feed authenticates with the per-account
 * `calendar_token` embedded in the URL (shown on the Calendar page). A browser
 * session works too.
 */
export const GET = handler(async (request: Request) => {
  const url = new URL(request.url);
  const origin = url.origin;

  // Token first (calendar apps), session second (browser).
  let userId: string | null = null;
  const token = url.searchParams.get('token');
  if (token) {
    const row = await one<{ user_id: string }>(
      'SELECT user_id FROM profiles WHERE calendar_token = ?',
      [token],
    );
    userId = row?.user_id ?? null;
  }
  userId ??= await getUserId();
  if (!userId) return fail('This calendar feed needs the personal token from your Calendar page.', 401);

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
  const deadlines = await q<{
    id: number;
    company: string;
    role: string;
    deadline: number;
    status: string;
    apply_url: string | null;
  }>(
    `SELECT id, company, role, deadline, status, apply_url FROM applications
     WHERE user_id = ? AND deadline IS NOT NULL AND archived = 0`,
    [userId],
  );

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
  const interviews = await q<{
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
  }>(
    `SELECT iv.id, iv.kind, iv.round, iv.scheduled_at, iv.duration_min, iv.location,
            iv.interviewer, a.company, a.role, a.id AS application_id
     FROM interviews iv JOIN applications a ON a.id = iv.application_id
     WHERE iv.user_id = ? AND iv.scheduled_at IS NOT NULL`,
    [userId],
  );

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
  const tasks = await q<{ id: number; title: string; due_at: number; company: string | null }>(
    `SELECT t.id, t.title, t.due_at, a.company FROM tasks t
     LEFT JOIN applications a ON a.id = t.application_id
     WHERE t.user_id = ? AND t.done = 0 AND t.due_at IS NOT NULL`,
    [userId],
  );

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
