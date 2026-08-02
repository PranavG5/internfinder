import { handler, requireUserId } from '@/lib/api';
import { q } from '@/lib/db';
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
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const format = params.get('format') === 'csv' ? 'csv' : 'json';
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const applications = await listApplications(auth, { archived: params.get('archived') === '1' });
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
        'Content-Disposition': `attachment; filename="internindex-applications-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const [active, archived, events, interviews, contacts, offers, tasks, profile, savedSearches, bookmarks, hidden] =
    await Promise.all([
      listApplications(auth, { archived: false }),
      listApplications(auth, { archived: true }),
      q('SELECT * FROM application_events WHERE user_id = ?', [auth]),
      q('SELECT * FROM interviews WHERE user_id = ?', [auth]),
      q('SELECT * FROM contacts WHERE user_id = ?', [auth]),
      q('SELECT * FROM offers WHERE user_id = ?', [auth]),
      q('SELECT * FROM tasks WHERE user_id = ?', [auth]),
      getProfile(auth),
      q('SELECT * FROM saved_searches WHERE user_id = ?', [auth]),
      q('SELECT * FROM bookmarks WHERE user_id = ?', [auth]),
      q('SELECT * FROM hidden_listings WHERE user_id = ?', [auth]),
    ]);

  const payload: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    version: 1,
    applications: active,
    archived_applications: archived,
    application_events: events,
    interviews,
    contacts,
    offers,
    tasks,
    profile,
    saved_searches: savedSearches,
    bookmarks,
    hidden_listings: hidden,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="internindex-backup-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
