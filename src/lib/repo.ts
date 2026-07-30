import { getDb, jsonArray, nowSec, type DB } from './db';
import {
  APP_STATUSES,
  RESPONDED_STATUSES,
  SUBMITTED_STATUSES,
  type AppStatus,
  type Application,
  type Profile,
  type ProfileView,
} from './types';
import { DAY, toHourly } from './util';

// ------------------------------------------------------------------- Profile

export function getProfile(db: DB = getDb()): ProfileView {
  const row = db.prepare('SELECT * FROM profile WHERE id = 1').get() as Profile;
  return {
    ...row,
    skills: jsonArray(row.skills_json),
    preferred_seasons: jsonArray(row.preferred_seasons_json),
    preferred_years: jsonArray(row.preferred_years_json),
    preferred_fields: jsonArray(row.preferred_fields_json),
    preferred_locations: jsonArray(row.preferred_locations_json),
  };
}

const PROFILE_SCALARS = [
  'name', 'email', 'school', 'major', 'minor', 'degree_level', 'class_year',
  'grad_month', 'grad_year', 'gpa', 'work_auth', 'has_clearance', 'remote_pref',
  'willing_to_relocate', 'min_hourly', 'paid_only', 'earliest_start', 'latest_start',
  'resume_text', 'weekly_goal', 'onboarded',
] as const;

const PROFILE_ARRAYS: Record<string, string> = {
  skills: 'skills_json',
  preferred_seasons: 'preferred_seasons_json',
  preferred_years: 'preferred_years_json',
  preferred_fields: 'preferred_fields_json',
  preferred_locations: 'preferred_locations_json',
};

export function updateProfile(patch: Record<string, unknown>, db: DB = getDb()): ProfileView {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const key of PROFILE_SCALARS) {
    if (!(key in patch)) continue;
    sets.push(`${key} = ?`);
    const value = patch[key];
    params.push(typeof value === 'boolean' ? (value ? 1 : 0) : (value ?? null));
  }

  for (const [key, column] of Object.entries(PROFILE_ARRAYS)) {
    if (!(key in patch)) continue;
    const value = patch[key];
    sets.push(`${column} = ?`);
    params.push(JSON.stringify(Array.isArray(value) ? value.map(String) : []));
  }

  if (sets.length > 0) {
    sets.push('updated_at = ?');
    params.push(nowSec());
    db.prepare(`UPDATE profile SET ${sets.join(', ')} WHERE id = 1`).run(...params);
  }
  return getProfile(db);
}

// -------------------------------------------------------------- Applications

export interface ApplicationFilters {
  status?: string[];
  archived?: boolean;
  q?: string;
  season?: string[];
  field?: string[];
  sort?: 'updated' | 'created' | 'deadline' | 'applied' | 'company' | 'priority' | 'status';
}

const APP_SORTS: Record<string, string> = {
  updated: 'updated_at DESC',
  created: 'created_at DESC',
  deadline: 'CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC',
  applied: 'CASE WHEN applied_at IS NULL THEN 1 ELSE 0 END, applied_at DESC',
  company: 'company COLLATE NOCASE ASC',
  priority: 'priority DESC, updated_at DESC',
  status: 'status ASC, updated_at DESC',
};

export function listApplications(
  filters: ApplicationFilters = {},
  db: DB = getDb(),
): Application[] {
  const where: string[] = [];
  const params: unknown[] = [];

  where.push('archived = ?');
  params.push(filters.archived ? 1 : 0);

  if (filters.status?.length) {
    where.push(`status IN (${filters.status.map(() => '?').join(',')})`);
    params.push(...filters.status);
  }
  if (filters.season?.length) {
    where.push(`season IN (${filters.season.map(() => '?').join(',')})`);
    params.push(...filters.season);
  }
  if (filters.field?.length) {
    where.push(`field IN (${filters.field.map(() => '?').join(',')})`);
    params.push(...filters.field);
  }
  if (filters.q) {
    where.push('(company LIKE ? OR role LIKE ? OR notes LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }

  const order = APP_SORTS[filters.sort ?? 'updated'] ?? APP_SORTS.updated;
  return db
    .prepare(`SELECT * FROM applications WHERE ${where.join(' AND ')} ORDER BY ${order}`)
    .all(...params) as Application[];
}

export function getApplication(id: number, db: DB = getDb()): Application | null {
  return (db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Application) ?? null;
}

const APP_FIELDS = [
  'internship_id', 'company', 'role', 'apply_url', 'location', 'season', 'year', 'field',
  'status', 'priority', 'excitement', 'origin', 'applied_at', 'deadline', 'next_action',
  'next_action_at', 'resume_version', 'cover_letter_sent', 'portfolio_sent', 'referral',
  'referrer', 'comp_offered', 'rejected_stage', 'rejection_reason', 'notes', 'archived',
] as const;

function coerce(key: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === '') return null;
  if (key === 'status' && typeof value === 'string') {
    return APP_STATUSES.includes(value as AppStatus) ? value : 'interested';
  }
  if (key === 'priority') {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 3;
  }
  return value;
}

export interface CreateApplicationInput extends Record<string, unknown> {
  company: string;
  role: string;
}

export function createApplication(input: CreateApplicationInput, db: DB = getDb()): Application {
  const now = nowSec();
  const status = (coerce('status', input.status ?? 'interested') as AppStatus) ?? 'interested';

  const columns: string[] = [];
  const values: unknown[] = [];
  for (const key of APP_FIELDS) {
    const value = coerce(key, input[key]);
    if (value === undefined) continue;
    columns.push(key);
    values.push(value);
  }
  // Submitting straight away should date-stamp the application.
  if (!columns.includes('applied_at') && SUBMITTED_STATUSES.includes(status)) {
    columns.push('applied_at');
    values.push(now);
  }

  columns.push('created_at', 'updated_at', 'last_activity_at');
  values.push(now, now, now);

  const id = Number(
    (
      db
        .prepare(
          `INSERT INTO applications (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        )
        .run(...values) as { lastInsertRowid: number | bigint }
    ).lastInsertRowid,
  );

  addEvent(
    {
      application_id: id,
      type: 'created',
      to_status: status,
      title: `Added to tracker as ${status.replace(/_/g, ' ')}`,
      occurred_at: now,
    },
    db,
  );

  return getApplication(id, db)!;
}

/**
 * Patch an application. Status transitions are recorded in the event log and
 * date-stamp `applied_at` the first time the role is actually submitted.
 */
export function updateApplication(
  id: number,
  patch: Record<string, unknown>,
  db: DB = getDb(),
): Application | null {
  const before = getApplication(id, db);
  if (!before) return null;

  const now = nowSec();
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const key of APP_FIELDS) {
    if (!(key in patch)) continue;
    const value = coerce(key, patch[key]);
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }

  const newStatus = patch.status as AppStatus | undefined;
  const statusChanged = newStatus != null && newStatus !== before.status;

  if (statusChanged && SUBMITTED_STATUSES.includes(newStatus) && before.applied_at == null) {
    sets.push('applied_at = ?');
    params.push(now);
  }

  if (sets.length === 0) return before;

  sets.push('updated_at = ?', 'last_activity_at = ?');
  params.push(now, now, id);
  db.prepare(`UPDATE applications SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  if (statusChanged) {
    addEvent(
      {
        application_id: id,
        type: 'status_change',
        from_status: before.status,
        to_status: newStatus,
        title: `${label(before.status)} → ${label(newStatus)}`,
        occurred_at: now,
      },
      db,
    );
  }

  return getApplication(id, db);
}

function label(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function deleteApplication(id: number, db: DB = getDb()): boolean {
  return db.prepare('DELETE FROM applications WHERE id = ?').run(id).changes > 0;
}

// -------------------------------------------------------------------- Events

export interface EventInput {
  application_id: number;
  type: string;
  from_status?: string | null;
  to_status?: string | null;
  title?: string | null;
  body?: string | null;
  occurred_at?: number | null;
}

export function addEvent(input: EventInput, db: DB = getDb()) {
  const now = nowSec();
  const id = db
    .prepare(
      `INSERT INTO application_events
         (application_id, type, from_status, to_status, title, body, occurred_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.application_id,
      input.type,
      input.from_status ?? null,
      input.to_status ?? null,
      input.title ?? null,
      input.body ?? null,
      input.occurred_at ?? now,
      now,
    ).lastInsertRowid;

  db.prepare('UPDATE applications SET last_activity_at = ?, updated_at = ? WHERE id = ?').run(
    now,
    now,
    input.application_id,
  );

  return Number(id);
}

export function listEvents(applicationId: number, db: DB = getDb()) {
  return db
    .prepare(
      'SELECT * FROM application_events WHERE application_id = ? ORDER BY occurred_at DESC, id DESC',
    )
    .all(applicationId);
}

export function deleteEvent(id: number, db: DB = getDb()): boolean {
  return db.prepare('DELETE FROM application_events WHERE id = ?').run(id).changes > 0;
}

// -------------------------------------------------- Interviews / contacts / offers / tasks

const CHILD_TABLES = {
  interviews: [
    'application_id', 'round', 'kind', 'scheduled_at', 'duration_min', 'location',
    'interviewer', 'prep_notes', 'outcome', 'feedback',
  ],
  contacts: [
    'application_id', 'name', 'company', 'role', 'email', 'phone', 'linkedin',
    'relationship', 'notes', 'last_contacted_at',
  ],
  offers: [
    'application_id', 'pay_rate', 'pay_period', 'currency', 'hours_per_week', 'weeks',
    'signing_bonus', 'housing_stipend', 'relocation', 'other_perks', 'location',
    'col_index', 'start_date', 'respond_by', 'status', 'notes',
  ],
  tasks: ['application_id', 'title', 'done', 'due_at', 'completed_at'],
} as const;

export type ChildTable = keyof typeof CHILD_TABLES;

const HAS_UPDATED_AT: Record<ChildTable, boolean> = {
  interviews: true,
  contacts: false,
  offers: true,
  tasks: false,
};

export function listChildren(table: ChildTable, applicationId?: number, db: DB = getDb()) {
  const order =
    table === 'interviews'
      ? 'COALESCE(scheduled_at, 0) ASC, round ASC'
      : table === 'tasks'
        ? 'done ASC, COALESCE(due_at, 9e18) ASC'
        : 'id DESC';

  if (applicationId == null) {
    return db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all();
  }
  return db
    .prepare(`SELECT * FROM ${table} WHERE application_id = ? ORDER BY ${order}`)
    .all(applicationId);
}

export function createChild(table: ChildTable, input: Record<string, unknown>, db: DB = getDb()) {
  const now = nowSec();
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const key of CHILD_TABLES[table]) {
    if (!(key in input)) continue;
    const value = input[key];
    if (value === undefined) continue;
    columns.push(key);
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value === '' ? null : value);
  }

  columns.push('created_at');
  values.push(now);
  if (HAS_UPDATED_AT[table]) {
    columns.push('updated_at');
    values.push(now);
  }

  const id = db
    .prepare(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    )
    .run(...values).lastInsertRowid;

  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id));
}

export function updateChild(
  table: ChildTable,
  id: number,
  patch: Record<string, unknown>,
  db: DB = getDb(),
) {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const key of CHILD_TABLES[table]) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value === '' ? null : value);
  }

  // Completing a task stamps the time automatically.
  if (table === 'tasks' && 'done' in patch && !('completed_at' in patch)) {
    sets.push('completed_at = ?');
    params.push(patch.done ? nowSec() : null);
  }

  if (sets.length === 0) return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);

  if (HAS_UPDATED_AT[table]) {
    sets.push('updated_at = ?');
    params.push(nowSec());
  }
  params.push(id);
  db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

export function deleteChild(table: ChildTable, id: number, db: DB = getDb()): boolean {
  return db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes > 0;
}

// ------------------------------------------------- Bookmarks / hidden / saved searches

export function toggleBookmark(internshipId: string, note?: string, db: DB = getDb()): boolean {
  const existing = db
    .prepare('SELECT 1 FROM bookmarks WHERE internship_id = ?')
    .get(internshipId);
  if (existing) {
    db.prepare('DELETE FROM bookmarks WHERE internship_id = ?').run(internshipId);
    return false;
  }
  db.prepare('INSERT INTO bookmarks (internship_id, note, created_at) VALUES (?, ?, ?)').run(
    internshipId,
    note ?? null,
    nowSec(),
  );
  return true;
}

export function hideListing(internshipId: string, reason?: string, db: DB = getDb()): void {
  db.prepare(
    `INSERT INTO hidden_listings (internship_id, reason, created_at) VALUES (?, ?, ?)
     ON CONFLICT(internship_id) DO UPDATE SET reason = excluded.reason`,
  ).run(internshipId, reason ?? null, nowSec());
}

export function unhideListing(internshipId: string, db: DB = getDb()): void {
  db.prepare('DELETE FROM hidden_listings WHERE internship_id = ?').run(internshipId);
}

export function listSavedSearches(db: DB = getDb()) {
  return db.prepare('SELECT * FROM saved_searches ORDER BY created_at DESC').all() as {
    id: number;
    name: string;
    query_json: string;
    alert: number;
    last_seen_at: number | null;
    created_at: number;
  }[];
}

export function createSavedSearch(name: string, query: string, alert = true, db: DB = getDb()) {
  const id = db
    .prepare(
      'INSERT INTO saved_searches (name, query_json, alert, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(name, query, alert ? 1 : 0, nowSec(), nowSec()).lastInsertRowid;
  return db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(Number(id));
}

export function deleteSavedSearch(id: number, db: DB = getDb()): boolean {
  return db.prepare('DELETE FROM saved_searches WHERE id = ?').run(id).changes > 0;
}

export function touchSavedSearch(id: number, db: DB = getDb()): void {
  db.prepare('UPDATE saved_searches SET last_seen_at = ? WHERE id = ?').run(nowSec(), id);
}

// ---------------------------------------------------------------- Dashboard

export interface DashboardStats {
  total: number;
  active: number;
  submitted: number;
  responded: number;
  offers: number;
  rejections: number;
  interviews: number;
  responseRate: number;
  offerRate: number;
  interviewRate: number;
  byStatus: { status: AppStatus; count: number }[];
  funnel: { stage: string; count: number }[];
  weeklyActivity: { weekStart: number; applied: number }[];
  appliedThisWeek: number;
  weeklyGoal: number;
  upcomingDeadlines: Application[];
  nextActions: Application[];
  needsFollowUp: (Application & { daysSince: number })[];
  possiblyGhosted: (Application & { daysSince: number })[];
  upcomingInterviews: {
    id: number;
    application_id: number;
    kind: string;
    round: number;
    scheduled_at: number | null;
    location: string | null;
    company: string;
    role: string;
  }[];
  openTasks: { id: number; title: string; due_at: number | null; application_id: number | null; company: string | null }[];
  medianDaysToResponse: number | null;
}

export function dashboardStats(db: DB = getDb()): DashboardStats {
  const now = nowSec();
  const apps = db.prepare('SELECT * FROM applications WHERE archived = 0').all() as Application[];

  const byStatusMap = new Map<AppStatus, number>();
  for (const status of APP_STATUSES) byStatusMap.set(status, 0);
  for (const app of apps) byStatusMap.set(app.status, (byStatusMap.get(app.status) ?? 0) + 1);

  const submitted = apps.filter((a) => SUBMITTED_STATUSES.includes(a.status));
  const responded = apps.filter((a) => RESPONDED_STATUSES.includes(a.status));
  const offers = apps.filter((a) => a.status === 'offer' || a.status === 'accepted');
  const rejections = apps.filter((a) => a.status === 'rejected');
  const interviewing = apps.filter((a) =>
    ['phone_screen', 'interviewing', 'final_round'].includes(a.status),
  );
  const active = apps.filter((a) => {
    const kind = ['interested', 'preparing'].includes(a.status)
      ? 'pre'
      : ['rejected', 'withdrawn', 'ghosted', 'accepted'].includes(a.status)
        ? 'done'
        : 'active';
    return kind === 'active';
  });

  const rate = (numerator: number, denominator: number) =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

  // The funnel counts everyone who *reached at least* each stage, which is what
  // makes stage-to-stage conversion meaningful.
  const reached = (statuses: AppStatus[]) =>
    apps.filter((a) => statuses.includes(a.status)).length;

  const funnel = [
    { stage: 'Submitted', count: submitted.length },
    {
      stage: 'Assessment',
      count: reached([
        'online_assessment',
        'phone_screen',
        'interviewing',
        'final_round',
        'offer',
        'accepted',
      ]),
    },
    {
      stage: 'Interview',
      count: reached(['phone_screen', 'interviewing', 'final_round', 'offer', 'accepted']),
    },
    { stage: 'Final round', count: reached(['final_round', 'offer', 'accepted']) },
    { stage: 'Offer', count: offers.length },
  ];

  // Applications per week over the last 12 weeks.
  const weekMs = 7 * DAY;
  const startOfWeek = (t: number) => {
    const d = new Date(t * 1000);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return Math.floor(d.getTime() / 1000);
  };
  const thisWeek = startOfWeek(now);
  const weeklyActivity: { weekStart: number; applied: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = thisWeek - i * weekMs;
    const weekEnd = weekStart + weekMs;
    weeklyActivity.push({
      weekStart,
      applied: apps.filter((a) => a.applied_at != null && a.applied_at >= weekStart && a.applied_at < weekEnd).length,
    });
  }

  const upcomingDeadlines = db
    .prepare(
      `SELECT * FROM applications
       WHERE archived = 0 AND deadline IS NOT NULL AND deadline >= ?
         AND status IN ('interested', 'preparing')
       ORDER BY deadline ASC LIMIT 8`,
    )
    .all(now - DAY) as Application[];

  const nextActions = db
    .prepare(
      `SELECT * FROM applications
       WHERE archived = 0 AND next_action IS NOT NULL AND next_action <> ''
       ORDER BY CASE WHEN next_action_at IS NULL THEN 1 ELSE 0 END, next_action_at ASC LIMIT 8`,
    )
    .all() as Application[];

  // Submitted 10-29 days ago with no response: time for a nudge.
  const withDays = (rows: Application[]) =>
    rows.map((a) => ({
      ...a,
      daysSince: a.applied_at ? Math.floor((now - a.applied_at) / DAY) : 0,
    }));

  const needsFollowUp = withDays(
    db
      .prepare(
        `SELECT * FROM applications
         WHERE archived = 0 AND status = 'applied' AND applied_at IS NOT NULL
           AND applied_at <= ? AND applied_at > ?
         ORDER BY applied_at ASC LIMIT 10`,
      )
      .all(now - 10 * DAY, now - 30 * DAY) as Application[],
  );

  const possiblyGhosted = withDays(
    db
      .prepare(
        `SELECT * FROM applications
         WHERE archived = 0 AND status = 'applied' AND applied_at IS NOT NULL AND applied_at <= ?
         ORDER BY applied_at ASC LIMIT 10`,
      )
      .all(now - 30 * DAY) as Application[],
  );

  const upcomingInterviews = db
    .prepare(
      `SELECT iv.id, iv.application_id, iv.kind, iv.round, iv.scheduled_at, iv.location,
              a.company, a.role
       FROM interviews iv JOIN applications a ON a.id = iv.application_id
       WHERE iv.scheduled_at IS NOT NULL AND iv.scheduled_at >= ?
         AND (iv.outcome IS NULL OR iv.outcome = 'pending')
       ORDER BY iv.scheduled_at ASC LIMIT 8`,
    )
    .all(now - DAY) as DashboardStats['upcomingInterviews'];

  const openTasks = db
    .prepare(
      `SELECT t.id, t.title, t.due_at, t.application_id, a.company
       FROM tasks t LEFT JOIN applications a ON a.id = t.application_id
       WHERE t.done = 0
       ORDER BY CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END, t.due_at ASC LIMIT 10`,
    )
    .all() as DashboardStats['openTasks'];

  // Median days from submitting to the first sign of life.
  const responseGaps = (
    db
      .prepare(
        `SELECT a.applied_at, MIN(e.occurred_at) AS first_response
         FROM applications a
         JOIN application_events e ON e.application_id = a.id
         WHERE a.applied_at IS NOT NULL AND e.type = 'status_change'
           AND e.to_status IN ('online_assessment', 'phone_screen', 'interviewing', 'final_round', 'offer', 'accepted', 'rejected')
         GROUP BY a.id`,
      )
      .all() as { applied_at: number; first_response: number }[]
  )
    .map((r) => Math.round((r.first_response - r.applied_at) / DAY))
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);

  const medianDaysToResponse =
    responseGaps.length > 0 ? responseGaps[Math.floor(responseGaps.length / 2)] : null;

  const profile = getProfile(db);

  return {
    total: apps.length,
    active: active.length,
    submitted: submitted.length,
    responded: responded.length,
    offers: offers.length,
    rejections: rejections.length,
    interviews: interviewing.length,
    responseRate: rate(responded.length, submitted.length),
    offerRate: rate(offers.length, submitted.length),
    interviewRate: rate(
      reached(['phone_screen', 'interviewing', 'final_round', 'offer', 'accepted']),
      submitted.length,
    ),
    byStatus: APP_STATUSES.map((status) => ({ status, count: byStatusMap.get(status) ?? 0 })),
    funnel,
    weeklyActivity,
    appliedThisWeek: weeklyActivity[weeklyActivity.length - 1]?.applied ?? 0,
    weeklyGoal: profile.weekly_goal,
    upcomingDeadlines,
    nextActions,
    needsFollowUp,
    possiblyGhosted,
    upcomingInterviews,
    openTasks,
    medianDaysToResponse,
  };
}

// ----------------------------------------------------------------- Insights

export interface InsightGroup {
  key: string;
  total: number;
  submitted: number;
  responded: number;
  offers: number;
  rejected: number;
  responseRate: number;
}

export function insights(db: DB = getDb()) {
  const apps = db.prepare('SELECT * FROM applications').all() as Application[];

  const group = (pick: (a: Application) => string | null): InsightGroup[] => {
    const map = new Map<string, Application[]>();
    for (const app of apps) {
      const key = pick(app) || 'Unspecified';
      const bucket = map.get(key) ?? [];
      bucket.push(app);
      map.set(key, bucket);
    }
    return [...map.entries()]
      .map(([key, rows]) => {
        const submitted = rows.filter((a) => SUBMITTED_STATUSES.includes(a.status)).length;
        const responded = rows.filter((a) => RESPONDED_STATUSES.includes(a.status)).length;
        return {
          key,
          total: rows.length,
          submitted,
          responded,
          offers: rows.filter((a) => a.status === 'offer' || a.status === 'accepted').length,
          rejected: rows.filter((a) => a.status === 'rejected').length,
          responseRate: submitted > 0 ? Math.round((responded / submitted) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  };

  const byOrigin = group((a) => a.origin);
  const referralRows = apps.filter((a) => a.referral === 1);
  const referralSubmitted = referralRows.filter((a) => SUBMITTED_STATUSES.includes(a.status));
  const nonReferralSubmitted = apps.filter(
    (a) => a.referral === 0 && SUBMITTED_STATUSES.includes(a.status),
  );

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

  return {
    byField: group((a) => a.field),
    bySeason: group((a) => (a.season && a.year ? `${a.season} ${a.year}` : a.season)),
    byCompany: group((a) => a.company).slice(0, 15),
    byOrigin,
    byPriority: group((a) => `P${a.priority}`),
    referralEffect: {
      referralRate: pct(
        referralSubmitted.filter((a) => RESPONDED_STATUSES.includes(a.status)).length,
        referralSubmitted.length,
      ),
      coldRate: pct(
        nonReferralSubmitted.filter((a) => RESPONDED_STATUSES.includes(a.status)).length,
        nonReferralSubmitted.length,
      ),
      referralCount: referralSubmitted.length,
      coldCount: nonReferralSubmitted.length,
    },
    rejectionsByStage: group((a) => a.rejected_stage).filter((g) => g.key !== 'Unspecified'),
  };
}

export interface OfferComparison {
  id: number;
  application_id: number;
  company: string;
  role: string;
  pay_rate: number | null;
  pay_period: string | null;
  currency: string | null;
  hours_per_week: number | null;
  weeks: number | null;
  location: string | null;
  col_index: number | null;
  respond_by: number | null;
  status: string;
  notes: string | null;
  /** Pay normalized to an hourly figure so periods are comparable. */
  hourly: number;
  earnings: number;
  extras: number;
  total: number;
  /** Total divided by the cost-of-living index (100 = US average). */
  adjustedTotal: number;
}

/** Compare offers on a like-for-like basis, adjusted for cost of living. */
export function offerComparison(db: DB = getDb()): OfferComparison[] {
  const rows = db
    .prepare(
      `SELECT o.*, a.company, a.role, a.id AS application_id
       FROM offers o JOIN applications a ON a.id = o.application_id
       ORDER BY o.created_at DESC`,
    )
    .all() as (Omit<OfferComparison, 'hourly' | 'earnings' | 'extras' | 'total' | 'adjustedTotal'> & {
    signing_bonus: number | null;
    housing_stipend: number | null;
    relocation: number | null;
  })[];

  return rows.map((row): OfferComparison => {
    const rate = Number(row.pay_rate) || 0;
    const hours = Number(row.hours_per_week) || 40;
    const weeks = Number(row.weeks) || 12;
    const hourly = toHourly(rate, String(row.pay_period ?? 'hour'), hours) ?? rate;

    const earnings = hourly * hours * weeks;
    const extras =
      (Number(row.signing_bonus) || 0) +
      (Number(row.housing_stipend) || 0) +
      (Number(row.relocation) || 0);
    const total = earnings + extras;
    const col = Number(row.col_index) || 100;

    return {
      ...row,
      hourly: Math.round(hourly * 100) / 100,
      earnings: Math.round(earnings),
      extras: Math.round(extras),
      total: Math.round(total),
      // What the package is worth in an average-cost city.
      adjustedTotal: Math.round((total * 100) / col),
    };
  });
}
