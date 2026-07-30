import { handler } from '@/lib/api';
import { getDb } from '@/lib/db';
import { getProfile, listApplications } from '@/lib/repo';
import { formatDate, toCsv } from '@/lib/util';

export const dynamic = 'force-dynamic';

/**
 * GET /api/export?format=json|csv&what=applications|all
 *
 * Your data is yours. JSON is a complete backup that `/api/import` can restore;
 * CSV is the spreadsheet-friendly view of the tracker.
 */
export const GET = handler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const format = params.get('format') === 'csv' ? 'csv' : 'json';
  const what = params.get('what') ?? 'all';
  const db = getDb();
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const applications = listApplications({ archived: params.get('archived') === '1' });
    const rows = applications.map((a) => ({
      company: a.company,
      role: a.role,
      status: a.status,
      priority: a.priority,
      season: a.season ?? '',
      year: a.year ?? '',
      field: a.field ?? '',
      location: a.location ?? '',
      applied_at: formatDate(a.applied_at),
      deadline: formatDate(a.deadline),
      referral: a.referral ? 'yes' : 'no',
      referrer: a.referrer ?? '',
      resume_version: a.resume_version ?? '',
      next_action: a.next_action ?? '',
      next_action_at: formatDate(a.next_action_at),
      rejected_stage: a.rejected_stage ?? '',
      notes: (a.notes ?? '').replace(/\s+/g, ' '),
      apply_url: a.apply_url ?? '',
    }));

    return new Response(toCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="internfinder-applications-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const payload: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    version: 1,
    applications: listApplications({ archived: false }),
    archived_applications: listApplications({ archived: true }),
    application_events: db.prepare('SELECT * FROM application_events').all(),
    interviews: db.prepare('SELECT * FROM interviews').all(),
    contacts: db.prepare('SELECT * FROM contacts').all(),
    offers: db.prepare('SELECT * FROM offers').all(),
    tasks: db.prepare('SELECT * FROM tasks').all(),
    profile: getProfile(),
    saved_searches: db.prepare('SELECT * FROM saved_searches').all(),
    bookmarks: db.prepare('SELECT * FROM bookmarks').all(),
    hidden_listings: db.prepare('SELECT * FROM hidden_listings').all(),
  };

  // The catalog is re-fetchable, so it's opt-in to keep backups small.
  if (what === 'all-with-catalog') {
    payload.internships = db
      .prepare('SELECT * FROM internships WHERE is_open = 1')
      .all();
  }

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="internfinder-backup-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
