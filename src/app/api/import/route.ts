import { fail, handler, ok } from '@/lib/api';
import { getDb } from '@/lib/db';
import { createApplication, updateProfile } from '@/lib/repo';
import { APP_STATUSES, type AppStatus } from '@/lib/types';
import { fromDateInput, parseCsv } from '@/lib/util';

export const dynamic = 'force-dynamic';

/**
 * POST /api/import
 *
 * Accepts either a JSON backup produced by `/api/export`, or a CSV of
 * applications (from a spreadsheet, Notion, or another tracker).
 *
 * Import is additive and skips rows that already exist — company + role is
 * treated as the identity — so re-importing the same file is safe.
 */
export const POST = handler(async (request: Request) => {
  const contentType = request.headers.get('content-type') ?? '';
  const raw = await request.text();
  if (!raw.trim()) return fail('Request body was empty', 422);

  const db = getDb();
  const existing = new Set(
    (
      db.prepare('SELECT company, role FROM applications').all() as {
        company: string;
        role: string;
      }[]
    ).map((r) => key(r.company, r.role)),
  );

  let created = 0;
  let skipped = 0;
  const warnings: string[] = [];

  const isCsv = contentType.includes('csv') || (!raw.trimStart().startsWith('{') && raw.includes(','));

  if (isCsv) {
    const rows = parseCsv(raw);
    if (rows.length === 0) return fail('No rows found in the CSV', 422);

    for (const row of rows) {
      const company = pick(row, ['company', 'Company', 'employer', 'Employer']);
      const role = pick(row, ['role', 'Role', 'position', 'Position', 'title', 'Title', 'job']);
      if (!company || !role) {
        skipped++;
        continue;
      }
      if (existing.has(key(company, role))) {
        skipped++;
        continue;
      }

      createApplication({
        company,
        role,
        status: normalizeStatus(pick(row, ['status', 'Status'])),
        location: pick(row, ['location', 'Location']) || null,
        season: pick(row, ['season', 'Season']) || null,
        field: pick(row, ['field', 'Field', 'category']) || null,
        apply_url: pick(row, ['apply_url', 'url', 'URL', 'link', 'Link']) || null,
        notes: pick(row, ['notes', 'Notes', 'comments']) || null,
        referrer: pick(row, ['referrer', 'Referrer']) || null,
        referral: /^(yes|true|1)$/i.test(pick(row, ['referral', 'Referral'])) ? 1 : 0,
        applied_at: fromDateInput(pick(row, ['applied_at', 'applied', 'date_applied', 'Applied'])),
        deadline: fromDateInput(pick(row, ['deadline', 'Deadline', 'due'])),
        origin: 'manual',
      });
      existing.add(key(company, role));
      created++;
    }

    return ok({ created, skipped, warnings, format: 'csv' });
  }

  // ---- JSON backup ----
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return fail('Body was neither valid JSON nor CSV', 422);
  }

  const applications = [
    ...(Array.isArray(payload.applications) ? payload.applications : []),
    ...(Array.isArray(payload.archived_applications) ? payload.archived_applications : []),
  ] as Record<string, unknown>[];

  /** Old application id -> new id, so child records can be re-parented. */
  const idMap = new Map<number, number>();

  for (const app of applications) {
    const company = String(app.company ?? '').trim();
    const role = String(app.role ?? '').trim();
    if (!company || !role) {
      skipped++;
      continue;
    }
    if (existing.has(key(company, role))) {
      skipped++;
      continue;
    }
    const inserted = createApplication({
      ...app,
      company,
      role,
      status: normalizeStatus(String(app.status ?? '')),
    } as { company: string; role: string });

    if (typeof app.id === 'number') idMap.set(app.id, inserted.id);
    existing.add(key(company, role));
    created++;
  }

  // Child records, remapped onto the newly created applications.
  const childCounts = {
    events: copyChildren(payload.application_events, 'application_events', idMap, [
      'type', 'from_status', 'to_status', 'title', 'body', 'occurred_at', 'created_at',
    ]),
    interviews: copyChildren(payload.interviews, 'interviews', idMap, [
      'round', 'kind', 'scheduled_at', 'duration_min', 'location', 'interviewer',
      'prep_notes', 'outcome', 'feedback', 'created_at', 'updated_at',
    ]),
    contacts: copyChildren(payload.contacts, 'contacts', idMap, [
      'name', 'company', 'role', 'email', 'phone', 'linkedin', 'relationship', 'notes',
      'last_contacted_at', 'created_at',
    ]),
    offers: copyChildren(payload.offers, 'offers', idMap, [
      'pay_rate', 'pay_period', 'currency', 'hours_per_week', 'weeks', 'signing_bonus',
      'housing_stipend', 'relocation', 'other_perks', 'location', 'col_index',
      'start_date', 'respond_by', 'status', 'notes', 'created_at', 'updated_at',
    ]),
    tasks: copyChildren(payload.tasks, 'tasks', idMap, [
      'title', 'done', 'due_at', 'created_at', 'completed_at',
    ]),
  };

  if (payload.profile && typeof payload.profile === 'object') {
    updateProfile(payload.profile as Record<string, unknown>);
  }

  if (Array.isArray(payload.bookmarks)) {
    const stmt = db.prepare(
      'INSERT INTO bookmarks (internship_id, note, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    );
    for (const b of payload.bookmarks as Record<string, unknown>[]) {
      // Only restore bookmarks for listings still in the catalog.
      const exists = db.prepare('SELECT 1 FROM internships WHERE id = ?').get(String(b.internship_id));
      if (exists) stmt.run(String(b.internship_id), b.note ?? null, Number(b.created_at) || Date.now() / 1000);
    }
  }

  if (Array.isArray(payload.saved_searches)) {
    const stmt = db.prepare(
      'INSERT INTO saved_searches (name, query_json, alert, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    for (const s of payload.saved_searches as Record<string, unknown>[]) {
      if (!s.name) continue;
      stmt.run(
        String(s.name),
        String(s.query_json ?? ''),
        s.alert ? 1 : 0,
        s.last_seen_at ?? null,
        Number(s.created_at) || Math.floor(Date.now() / 1000),
      );
    }
  }

  return ok({ created, skipped, childCounts, warnings, format: 'json' });
});

function key(company: string, role: string): string {
  return `${company.trim().toLowerCase()}|${role.trim().toLowerCase()}`;
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (row[k]) return row[k].trim();
  }
  return '';
}

/** Map loose status text onto the pipeline's vocabulary. */
function normalizeStatus(raw: string): AppStatus {
  const s = (raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (APP_STATUSES.includes(s as AppStatus)) return s as AppStatus;

  const aliases: Record<string, AppStatus> = {
    submitted: 'applied',
    apply: 'applied',
    applied_online: 'applied',
    in_progress: 'applied',
    oa: 'online_assessment',
    assessment: 'online_assessment',
    hackerrank: 'online_assessment',
    screen: 'phone_screen',
    recruiter_screen: 'phone_screen',
    phone: 'phone_screen',
    interview: 'interviewing',
    onsite: 'final_round',
    superday: 'final_round',
    final: 'final_round',
    offered: 'offer',
    accept: 'accepted',
    reject: 'rejected',
    denied: 'rejected',
    declined: 'withdrawn',
    withdrew: 'withdrawn',
    no_response: 'ghosted',
    saved: 'interested',
    wishlist: 'interested',
    bookmarked: 'interested',
    waiting: 'applied',
  };
  return aliases[s] ?? 'interested';
}

/** Copy child rows for applications that were actually imported. */
function copyChildren(
  input: unknown,
  table: string,
  idMap: Map<number, number>,
  columns: string[],
): number {
  if (!Array.isArray(input) || idMap.size === 0) return 0;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO ${table} (application_id, ${columns.join(', ')})
     VALUES (?, ${columns.map(() => '?').join(', ')})`,
  );

  let count = 0;
  for (const row of input as Record<string, unknown>[]) {
    const oldId = Number(row.application_id);
    const newId = idMap.get(oldId);
    if (!newId) continue;
    try {
      stmt.run(newId, ...columns.map((c) => normalizeValue(row[c])));
      count++;
    } catch {
      // A malformed child row shouldn't abort the whole import.
    }
  }
  return count;
}

function normalizeValue(v: unknown): string | number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return JSON.stringify(v);
}
