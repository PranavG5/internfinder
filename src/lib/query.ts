import { getDb, jsonArray } from './db';
import { computeFit, type FitCandidate } from './fit';
import {
  toFtsQuery,
  type FacetBucket,
  type Facets,
  type SearchQuery,
  type SearchResult,
  type SortKey,
} from './search-query';
import type { Internship, InternshipView, ProfileView } from './types';
import { DAY } from './util';

// Re-exported so existing server imports of `@/lib/query` keep working.
export * from './search-query';

interface Clause {
  sql: string;
  params: unknown[];
}

/**
 * Build the WHERE clauses, keyed by the filter dimension they came from.
 * Keying them lets the facet counts leave out a dimension's own filter, so
 * each facet shows what you'd get if you changed just that one choice.
 */
function buildClauses(query: SearchQuery, profile: ProfileView | null = null): Map<string, Clause> {
  const clauses = new Map<string, Clause>();
  const set = (key: string, sql: string, params: unknown[] = []) =>
    clauses.set(key, { sql, params });

  const now = Math.floor(Date.now() / 1000);
  const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');

  // Openness. This is the app's core promise, so it is always applied unless
  // the caller explicitly asks to see the archive.
  if (!query.showClosed) {
    set('open', 'i.is_open = 1');
  }
  // Duplicates are always hidden; the canonical row represents the role.
  set('dupe', 'i.duplicate_of IS NULL');

  if (query.q) {
    const fts = toFtsQuery(query.q);
    if (fts) {
      set('q', 'i.rowid IN (SELECT rowid FROM internships_fts WHERE internships_fts MATCH ?)', [fts]);
    } else {
      const like = `%${query.q}%`;
      set('q', '(i.title LIKE ? OR i.company LIKE ?)', [like, like]);
    }
  }

  if (query.seasons.length) {
    set('season', `i.season IN (${placeholders(query.seasons.length)})`, query.seasons);
  }
  if (query.years.length) {
    // Listings with an unknown year shouldn't vanish when filtering by year.
    set('year', `(i.year IN (${placeholders(query.years.length)}) OR i.year IS NULL)`, query.years);
  }
  if (query.fields.length) {
    set('field', `i.field IN (${placeholders(query.fields.length)})`, query.fields);
  }
  if (query.roleFamilies.length) {
    set('role', `i.role_family IN (${placeholders(query.roleFamilies.length)})`, query.roleFamilies);
  }
  if (query.programTypes.length) {
    set('programType', `i.program_type IN (${placeholders(query.programTypes.length)})`, query.programTypes);
  }
  if (query.companies.length) {
    set(
      'company',
      `i.company_slug IN (${placeholders(query.companies.length)})`,
      query.companies.map((c) => c.toLowerCase()),
    );
  }
  if (query.location) {
    const like = `%${query.location}%`;
    set('location', '(i.primary_location LIKE ? OR i.locations_json LIKE ? OR i.city LIKE ? OR i.region LIKE ?)', [
      like,
      like,
      like,
      like,
    ]);
  }
  if (query.countries.length) {
    set('country', `i.country IN (${placeholders(query.countries.length)})`, query.countries);
  }
  if (query.regions.length) {
    set('region', `i.region IN (${placeholders(query.regions.length)})`, query.regions);
  }
  if (query.locationTypes.length) {
    set('locationType', `i.location_type IN (${placeholders(query.locationTypes.length)})`, query.locationTypes);
  }
  if (query.sponsorship.length) {
    set('sponsorship', `i.sponsorship IN (${placeholders(query.sponsorship.length)})`, query.sponsorship);
  }
  if (query.excludeCitizenship) {
    set('excludeCitizenship', 'i.requires_citizenship = 0');
  }
  if (query.excludeClearance) {
    set('excludeClearance', 'i.requires_clearance = 0');
  }
  if (query.degrees.length) {
    // Empty degree lists mean "unspecified", which shouldn't be excluded.
    const ors = query.degrees.map(() => 'i.degrees_json LIKE ?').join(' OR ');
    set('degree', `(i.degrees_json = '[]' OR ${ors})`, query.degrees.map((d) => `%"${d}"%`));
  }
  if (query.classYears.length) {
    const ors = query.classYears.map(() => 'i.class_years_json LIKE ?').join(' OR ');
    set('classYear', `(i.class_years_json = '[]' OR ${ors})`, query.classYears.map((c) => `%"${c}"%`));
  }
  if (query.gpa != null) {
    set('gpa', '(i.gpa_min IS NULL OR i.gpa_min <= ?)', [query.gpa]);
  }
  if (query.paidOnly) {
    set('paidOnly', '(i.is_paid = 1 OR i.salary_min IS NOT NULL)');
  }
  if (query.minPay != null) {
    // Normalize each row's pay to hourly inside SQL so the comparison is fair.
    set(
      'minPay',
      `(i.salary_min IS NOT NULL AND CASE i.salary_period
          WHEN 'hour' THEN i.salary_min
          WHEN 'month' THEN i.salary_min / 173.8
          WHEN 'year'  THEN i.salary_min / 2080.0
          ELSE NULL END >= ?)`,
      [query.minPay],
    );
  }
  if (query.hasSalary) {
    set('hasSalary', 'i.salary_min IS NOT NULL');
  }
  if (query.startAfter != null) {
    set('startAfter', '(i.start_date IS NULL OR i.start_date >= ?)', [query.startAfter]);
  }
  if (query.startBefore != null) {
    set('startBefore', '(i.start_date IS NULL OR i.start_date <= ?)', [query.startBefore]);
  }
  if (query.deadlineBefore != null) {
    set('deadlineBefore', '(i.deadline IS NOT NULL AND i.deadline <= ?)', [query.deadlineBefore]);
  }
  if (query.hasDeadline) {
    set('hasDeadline', 'i.deadline IS NOT NULL');
  }
  if (query.noDeadlinePassed) {
    set('noDeadlinePassed', '(i.deadline IS NULL OR i.deadline >= ?)', [now - DAY]);
  }
  if (query.postedWithinDays != null) {
    set('postedWithin', '(i.date_posted IS NOT NULL AND i.date_posted >= ?)', [
      now - query.postedWithinDays * DAY,
    ]);
  }
  if (query.minDuration != null) {
    set('minDuration', '(i.duration_weeks IS NULL OR i.duration_weeks >= ?)', [query.minDuration]);
  }
  if (query.maxDuration != null) {
    set('maxDuration', '(i.duration_weeks IS NULL OR i.duration_weeks <= ?)', [query.maxDuration]);
  }
  if (query.skills.length) {
    const ors = query.skills.map(() => 'i.skills_json LIKE ?').join(' OR ');
    set('skill', `(${ors})`, query.skills.map((s) => `%"${s}"%`));
  }
  if (query.sources.length) {
    const ors = query.sources.map(() => 'i.source LIKE ?').join(' OR ');
    set('source', `(${ors})`, query.sources.map((s) => `${s}%`));
  }
  if (query.excludeKeywords.length) {
    const ands = query.excludeKeywords
      .map(() => '(i.title NOT LIKE ? AND i.company NOT LIKE ?)')
      .join(' AND ');
    set(
      'exclude',
      `(${ands})`,
      query.excludeKeywords.flatMap((k) => [`%${k}%`, `%${k}%`]),
    );
  }
  if (query.requiresNoCoverLetter) {
    set('noCoverLetter', 'i.requires_cover_letter = 0');
  }
  if (query.bookmarkedOnly) {
    set('bookmarked', 'i.id IN (SELECT internship_id FROM bookmarks)');
  }
  if (query.hideApplied) {
    set(
      'hideApplied',
      'i.id NOT IN (SELECT internship_id FROM applications WHERE internship_id IS NOT NULL)',
    );
  }
  // Dismissed listings never come back.
  set('hidden', 'i.id NOT IN (SELECT internship_id FROM hidden_listings)');

  // "Only roles I'm eligible for" is expressed in SQL rather than filtered
  // afterwards, so result counts and pagination stay correct.
  if (query.eligibleOnly && profile) {
    const parts: string[] = [];
    const args: unknown[] = [];

    if (profile.work_auth === 'needs-sponsorship') {
      parts.push("i.requires_citizenship = 0", "i.sponsorship NOT IN ('us-citizenship', 'does-not-offer')");
    }
    if (!profile.has_clearance) parts.push('i.requires_clearance = 0');
    if (profile.gpa != null) {
      parts.push('(i.gpa_min IS NULL OR i.gpa_min <= ?)');
      args.push(profile.gpa);
    }
    if (profile.paid_only) parts.push('(i.is_paid IS NULL OR i.is_paid <> 0)');
    if (profile.degree_level === 'Bachelors' || profile.degree_level === 'Associate') {
      // Drop postings open only to graduate students.
      parts.push(
        `NOT (
           (i.degrees_json LIKE '%"PhD"%' OR i.degrees_json LIKE '%"Masters"%' OR i.degrees_json LIKE '%"MBA"%')
           AND i.degrees_json NOT LIKE '%"Bachelors"%'
           AND i.degrees_json NOT LIKE '%"Associate"%'
         )`,
      );
    }
    if (parts.length) set('eligibleOnly', `(${parts.join(' AND ')})`, args);
  }

  return clauses;
}

function combine(clauses: Map<string, Clause>, skip?: string): { where: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const [key, clause] of clauses) {
    if (key === skip) continue;
    parts.push(clause.sql);
    params.push(...clause.params);
  }
  return { where: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

const ORDER_BY: Record<SortKey, string> = {
  relevance:
    // Fresh, well-described, deadline-bearing listings first.
    `i.quality DESC, COALESCE(i.date_posted, i.first_seen_at) DESC`,
  newest: 'COALESCE(i.date_posted, i.first_seen_at) DESC',
  deadline: 'CASE WHEN i.deadline IS NULL THEN 1 ELSE 0 END, i.deadline ASC',
  pay: `CASE WHEN i.salary_min IS NULL THEN 1 ELSE 0 END,
        CASE i.salary_period
          WHEN 'hour' THEN i.salary_min
          WHEN 'month' THEN i.salary_min / 173.8
          WHEN 'year' THEN i.salary_min / 2080.0
          ELSE 0 END DESC`,
  company: 'i.company COLLATE NOCASE ASC, i.title COLLATE NOCASE ASC',
  title: 'i.title COLLATE NOCASE ASC',
  fit: 'i.quality DESC', // re-sorted in JS after fit scores are computed
};

/** How many rows a fit-sorted search will score in memory before ranking. */
const FIT_SORT_CEILING = 4000;

export function searchInternships(query: SearchQuery, profile: ProfileView | null): SearchResult {
  const db = getDb();
  const clauses = buildClauses(query, profile);
  const { where, params } = combine(clauses);

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM internships i ${where}`).get(...params) as { n: number }
  ).n;

  const offset = (query.page - 1) * query.limit;
  let rows: Internship[];

  const needsFitRanking = query.sort === 'fit' && profile != null;
  if (needsFitRanking) {
    // Fit depends on the profile, so it can't be expressed in SQL. Score a
    // bounded slice of matches and rank those.
    rows = db
      .prepare(`SELECT i.* FROM internships i ${where} ORDER BY ${ORDER_BY.relevance} LIMIT ?`)
      .all(...params, FIT_SORT_CEILING) as Internship[];
  } else {
    rows = db
      .prepare(
        `SELECT i.* FROM internships i ${where} ORDER BY ${ORDER_BY[query.sort]} LIMIT ? OFFSET ?`,
      )
      .all(...params, query.limit, offset) as Internship[];
  }

  let views = toViews(rows, profile);

  if (needsFitRanking) {
    views.sort((a, b) => (b.fit?.score ?? 0) - (a.fit?.score ?? 0));
    views = views.slice(offset, offset + query.limit);
  }

  return {
    rows: views,
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

/**
 * Convert DB rows into client-facing views.
 * Bookmark and application state is loaded in two queries for the whole batch
 * rather than per row.
 */
export function toViews(rows: Internship[], profile: ProfileView | null): InternshipView[] {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const bookmarked = new Set(
    (
      db
        .prepare(`SELECT internship_id FROM bookmarks WHERE internship_id IN (${placeholders})`)
        .all(...ids) as { internship_id: string }[]
    ).map((r) => r.internship_id),
  );

  const apps = new Map<string, { id: number; status: string }>();
  for (const row of db
    .prepare(
      `SELECT internship_id, id, status FROM applications
       WHERE internship_id IN (${placeholders}) ORDER BY id ASC`,
    )
    .all(...ids) as { internship_id: string; id: number; status: string }[]) {
    // Later rows win, so the newest application for a listing is the one shown.
    apps.set(row.internship_id, { id: row.id, status: row.status });
  }

  return rows.map((row) => toView(row, profile, bookmarked, apps));
}

/** Convert a DB row into the client-facing shape, attaching fit and tracker state. */
export function toView(
  row: Internship,
  profile: ProfileView | null,
  bookmarked?: Set<string>,
  apps?: Map<string, { id: number; status: string }>,
): InternshipView {
  const db = getDb();
  const locations = jsonArray(row.locations_json);
  const skills = jsonArray(row.skills_json);
  const degrees = jsonArray(row.degrees_json);
  const classYears = jsonArray(row.class_years_json);

  const candidate: FitCandidate = {
    season: row.season,
    year: row.year,
    field: row.field,
    role_family: row.role_family,
    locations,
    location_type: row.location_type,
    is_remote: row.is_remote,
    primary_location: row.primary_location,
    country: row.country,
    region: row.region,
    city: row.city,
    degrees,
    class_years: classYears,
    gpa_min: row.gpa_min,
    sponsorship: row.sponsorship,
    requires_citizenship: row.requires_citizenship,
    requires_clearance: row.requires_clearance,
    skills,
    is_paid: row.is_paid,
    salary_min: row.salary_min,
    salary_period: row.salary_period,
    deadline: row.deadline,
    date_posted: row.date_posted,
    start_date: row.start_date,
    quality: row.quality,
  };

  // Use the preloaded batch when available; fall back to a lookup for single rows.
  const isBookmarked = bookmarked
    ? bookmarked.has(row.id)
    : !!db.prepare('SELECT 1 FROM bookmarks WHERE internship_id = ?').get(row.id);
  const app = apps
    ? apps.get(row.id)
    : (db
        .prepare(
          'SELECT id, status FROM applications WHERE internship_id = ? ORDER BY id DESC LIMIT 1',
        )
        .get(row.id) as { id: number; status: string } | undefined);

  const {
    locations_json: _l,
    terms_json: _t,
    degrees_json: _d,
    class_years_json: _c,
    skills_json: _s,
    tags_json: _g,
    raw_json: _r,
    ...rest
  } = row;

  return {
    ...rest,
    locations,
    terms: jsonArray(row.terms_json),
    degrees,
    class_years: classYears,
    skills,
    tags: jsonArray(row.tags_json),
    bookmarked: isBookmarked,
    applied: !!app,
    application_id: app?.id ?? null,
    application_status: (app?.status as InternshipView['application_status']) ?? null,
    fit: computeFit(candidate, profile),
  };
}

/**
 * Count how many listings each filter value would return.
 * Each facet ignores its own filter, so the counts answer "what if I picked
 * this instead" rather than "how many of what I already chose".
 */
export function computeFacets(query: SearchQuery, profile: ProfileView | null = null): Facets {
  const db = getDb();
  const clauses = buildClauses(query, profile);

  /** Append an extra condition to a WHERE clause that may be empty. */
  const and = (where: string, extra: string): string =>
    where ? `${where} AND ${extra}` : `WHERE ${extra}`;

  const countBy = (column: string, skip: string, limit = 40): FacetBucket[] => {
    const { where, params } = combine(clauses, skip);
    const rows = db
      .prepare(
        `SELECT ${column} AS value, COUNT(*) AS count FROM internships i
         ${and(where, `${column} IS NOT NULL AND ${column} <> ''`)}
         GROUP BY ${column} ORDER BY count DESC, value ASC LIMIT ?`,
      )
      .all(...params, limit) as { value: string | number; count: number }[];
    return rows.map((r) => ({ value: String(r.value), label: String(r.value), count: r.count }));
  };

  // JSON array columns need a different treatment: count listings containing each value.
  const countJsonValues = (
    column: string,
    skip: string,
    candidates: string[],
  ): FacetBucket[] => {
    const { where, params } = combine(clauses, skip);
    const stmt = db.prepare(
      `SELECT COUNT(*) AS n FROM internships i ${and(where, `${column} LIKE ?`)}`,
    );
    return candidates
      .map((value) => ({
        value,
        label: value,
        count: (stmt.get(...params, `%"${value}"%`) as { n: number }).n,
      }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count);
  };

  const { where: totalWhere, params: totalParams } = combine(clauses);
  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM internships i ${totalWhere}`).get(...totalParams) as {
      n: number;
    }
  ).n;

  // Only offer values that exist in the catalog, so the sidebar never shows dead options.
  const distinct = (column: string): string[] =>
    (
      db
        .prepare(
          `SELECT DISTINCT ${column} AS v FROM internships WHERE is_open = 1 AND ${column} IS NOT NULL AND ${column} <> '[]'`,
        )
        .all() as { v: string }[]
    ).map((r) => r.v);

  const degreeCandidates = [
    ...new Set(distinct('degrees_json').flatMap((v) => jsonArray(v))),
  ].slice(0, 12);
  const classYearCandidates = [
    ...new Set(distinct('class_years_json').flatMap((v) => jsonArray(v))),
  ].slice(0, 12);
  const skillCandidates = [
    ...new Set(distinct('skills_json').flatMap((v) => jsonArray(v))),
  ].slice(0, 60);

  const companyRows = (() => {
    const { where, params } = combine(clauses, 'company');
    return db
      .prepare(
        `SELECT company_slug AS value, company AS label, COUNT(*) AS count
         FROM internships i ${where}
         GROUP BY company_slug ORDER BY count DESC, label ASC LIMIT 60`,
      )
      .all(...params) as { value: string; label: string; count: number }[];
  })();

  const sourceRows = (() => {
    const { where, params } = combine(clauses, 'source');
    return db
      .prepare(
        `SELECT
           CASE
             WHEN instr(i.source, ':') > 0 THEN substr(i.source, 1, instr(i.source, ':') - 1)
             ELSE i.source
           END AS value,
           COUNT(*) AS count
         FROM internships i ${where}
         GROUP BY value ORDER BY count DESC LIMIT 20`,
      )
      .all(...params) as { value: string; count: number }[];
  })();

  return {
    seasons: countBy('i.season', 'season', 8),
    years: countBy('i.year', 'year', 10),
    fields: countBy('i.field', 'field', 30),
    roleFamilies: countBy('i.role_family', 'role', 45),
    programTypes: countBy('i.program_type', 'programType', 8),
    locationTypes: countBy('i.location_type', 'locationType', 6),
    countries: countBy('i.country', 'country', 40),
    regions: countBy('i.region', 'region', 60),
    sponsorship: countBy('i.sponsorship', 'sponsorship', 6),
    degrees: countJsonValues('i.degrees_json', 'degree', degreeCandidates),
    classYears: countJsonValues('i.class_years_json', 'classYear', classYearCandidates),
    companies: companyRows,
    skills: countJsonValues('i.skills_json', 'skill', skillCandidates).slice(0, 40),
    sources: sourceRows.map((r) => ({ value: r.value, label: r.value, count: r.count })),
    total,
  };
}

/** Catalog-wide stats for the dashboard and sources page. */
export function catalogStats() {
  const db = getDb();
  const one = <T>(sql: string, ...params: unknown[]): T => db.prepare(sql).get(...params) as T;

  const open = one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM internships WHERE is_open = 1 AND duplicate_of IS NULL',
  ).n;
  const closed = one<{ n: number }>('SELECT COUNT(*) AS n FROM internships WHERE is_open = 0').n;
  const companies = one<{ n: number }>(
    'SELECT COUNT(DISTINCT company_slug) AS n FROM internships WHERE is_open = 1',
  ).n;
  const withPay = one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM internships WHERE is_open = 1 AND duplicate_of IS NULL AND salary_min IS NOT NULL',
  ).n;
  const now = Math.floor(Date.now() / 1000);
  const freshWeek = one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM internships WHERE is_open = 1 AND duplicate_of IS NULL AND COALESCE(date_posted, first_seen_at) >= ?',
    now - 7 * DAY,
  ).n;
  const closingSoon = one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM internships WHERE is_open = 1 AND duplicate_of IS NULL AND deadline IS NOT NULL AND deadline BETWEEN ? AND ?',
    now,
    now + 14 * DAY,
  ).n;
  const lastSync = db
    .prepare('SELECT * FROM sync_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1')
    .get() as
    | {
        id: number;
        started_at: number;
        finished_at: number;
        ok: number;
        found: number;
        inserted: number;
        closed: number;
        duration_ms: number;
      }
    | undefined;

  const sourceCount = one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM source_configs WHERE enabled = 1',
  ).n;

  return { open, closed, companies, withPay, freshWeek, closingSoon, lastSync, sourceCount };
}
