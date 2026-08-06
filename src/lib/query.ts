import { getPool, jsonArray, one, q } from './db';
import { computeFit, type FitCandidate } from './fit';
import {
  toFtsQuery,
  type FacetBucket,
  type Facets,
  type SearchQuery,
  type SearchResult,
  type SortKey,
} from './search-query';
import { FIELDS, ROLE_FAMILIES } from './types';
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
 *
 * `userId` scopes the personal dimensions (shortlist, dismissals, tracked
 * roles); anonymous visitors simply don't have those filters applied.
 */
function buildClauses(
  query: SearchQuery,
  profile: ProfileView | null = null,
  userId: string | null = null,
): Map<string, Clause> {
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
      set('q', "i.fts @@ to_tsquery('english', ?)", [fts]);
    } else {
      const like = `%${query.q}%`;
      set('q', '(i.title ILIKE ? OR i.company ILIKE ?)', [like, like]);
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
    set('location', '(i.primary_location ILIKE ? OR i.locations_json ILIKE ? OR i.city ILIKE ? OR i.region ILIKE ?)', [
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
      .map(() => '(i.title NOT ILIKE ? AND i.company NOT ILIKE ?)')
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
    if (userId) {
      set('bookmarked', 'i.id IN (SELECT internship_id FROM bookmarks WHERE user_id = ?)', [userId]);
    } else {
      // An anonymous visitor has no shortlist; asking for it yields nothing.
      set('bookmarked', '1 = 0');
    }
  }
  if (query.hideApplied && userId) {
    set(
      'hideApplied',
      'i.id NOT IN (SELECT internship_id FROM applications WHERE internship_id IS NOT NULL AND user_id = ?)',
      [userId],
    );
  }
  // Dismissed listings never come back.
  if (userId) {
    set('hidden', 'i.id NOT IN (SELECT internship_id FROM hidden_listings WHERE user_id = ?)', [userId]);
  }

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
  company: 'lower(i.company) ASC, lower(i.title) ASC',
  title: 'lower(i.title) ASC',
  fit: 'i.quality DESC', // re-sorted in JS after fit scores are computed
};

/** How many rows a fit-sorted search will score in memory before ranking. */
const FIT_SORT_CEILING = 4000;

export async function searchInternships(
  query: SearchQuery,
  profile: ProfileView | null,
  userId: string | null = null,
): Promise<SearchResult> {
  const clauses = buildClauses(query, profile, userId);
  const { where, params } = combine(clauses);

  const total =
    (await one<{ n: number }>(`SELECT COUNT(*) AS n FROM internships i ${where}`, params))?.n ?? 0;

  const offset = (query.page - 1) * query.limit;
  let rows: Internship[];

  const needsFitRanking = query.sort === 'fit' && profile != null;
  if (needsFitRanking) {
    // Fit depends on the profile, so it can't be expressed in SQL. Score a
    // bounded slice of matches and rank those.
    rows = await q<Internship>(
      `SELECT i.* FROM internships i ${where} ORDER BY ${ORDER_BY.relevance} LIMIT ?`,
      [...params, FIT_SORT_CEILING],
    );
  } else {
    rows = await q<Internship>(
      `SELECT i.* FROM internships i ${where} ORDER BY ${ORDER_BY[query.sort]} LIMIT ? OFFSET ?`,
      [...params, query.limit, offset],
    );
  }

  let views = await toViews(rows, profile, userId);

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
 * rather than per row; anonymous visitors skip both.
 */
export async function toViews(
  rows: Internship[],
  profile: ProfileView | null,
  userId: string | null = null,
): Promise<InternshipView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const bookmarked = new Set<string>();
  const apps = new Map<string, { id: number; status: string }>();

  if (userId) {
    const [bookmarkRows, appRows] = await Promise.all([
      q<{ internship_id: string }>(
        'SELECT internship_id FROM bookmarks WHERE user_id = ? AND internship_id = ANY(?)',
        [userId, ids],
      ),
      q<{ internship_id: string; id: number; status: string }>(
        `SELECT internship_id, id, status FROM applications
         WHERE user_id = ? AND internship_id = ANY(?) ORDER BY id ASC`,
        [userId, ids],
      ),
    ]);
    for (const row of bookmarkRows) bookmarked.add(row.internship_id);
    // Later rows win, so the newest application for a listing is the one shown.
    for (const row of appRows) apps.set(row.internship_id, { id: row.id, status: row.status });
  }

  return rows.map((row) => toView(row, profile, bookmarked, apps));
}

/** Convert a DB row into the client-facing shape, attaching fit and tracker state. */
export function toView(
  row: Internship,
  profile: ProfileView | null,
  bookmarked: Set<string> = new Set(),
  apps: Map<string, { id: number; status: string }> = new Map(),
): InternshipView {
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

  const app = apps.get(row.id);

  const {
    locations_json: _l,
    terms_json: _t,
    degrees_json: _d,
    class_years_json: _c,
    skills_json: _s,
    tags_json: _g,
    raw_json: _r,
    fts: _f,
    ...rest
  } = row as Internship & { fts?: unknown };

  return {
    ...rest,
    locations,
    terms: jsonArray(row.terms_json),
    degrees,
    class_years: classYears,
    skills,
    tags: jsonArray(row.tags_json),
    bookmarked: bookmarked.has(row.id),
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
export async function computeFacets(
  query: SearchQuery,
  profile: ProfileView | null = null,
  userId: string | null = null,
): Promise<Facets> {
  const clauses = buildClauses(query, profile, userId);

  /** Append an extra condition to a WHERE clause that may be empty. */
  const and = (where: string, extra: string): string =>
    where ? `${where} AND ${extra}` : `WHERE ${extra}`;

  const countBy = async (column: string, skip: string, limit = 40): Promise<FacetBucket[]> => {
    const { where, params } = combine(clauses, skip);
    const rows = await q<{ value: string | number; count: number }>(
      `SELECT ${column} AS value, COUNT(*) AS count FROM internships i
       ${and(where, `${column} IS NOT NULL AND ${column}::text <> ''`)}
       GROUP BY ${column} ORDER BY count DESC, value ASC LIMIT ?`,
      [...params, limit],
    );
    return rows.map((r) => ({ value: String(r.value), label: String(r.value), count: r.count }));
  };

  // JSON array columns: unnest the array and count listings containing each
  // value. One aggregate query per column instead of one count per candidate.
  const countJsonValues = async (
    column: string,
    skip: string,
    limit: number,
  ): Promise<FacetBucket[]> => {
    const { where, params } = combine(clauses, skip);
    const rows = await q<{ value: string; count: number }>(
      `SELECT v.value AS value, COUNT(DISTINCT i.id) AS count
       FROM internships i
       CROSS JOIN LATERAL jsonb_array_elements_text(${column}::jsonb) AS v(value)
       ${and(where, `${column} LIKE '[%'`)}
       GROUP BY v.value ORDER BY count DESC, v.value ASC LIMIT ?`,
      [...params, limit],
    );
    return rows.map((r) => ({ value: r.value, label: r.value, count: r.count }));
  };

  const companiesPromise = (async () => {
    const { where, params } = combine(clauses, 'company');
    return q<{ value: string; label: string; count: number }>(
      `SELECT company_slug AS value, MIN(company) AS label, COUNT(*) AS count
       FROM internships i ${where}
       GROUP BY company_slug ORDER BY count DESC, label ASC LIMIT 60`,
      params,
    );
  })();

  const sourcesPromise = (async () => {
    const { where, params } = combine(clauses, 'source');
    return q<{ value: string; count: number }>(
      `SELECT
         CASE
           WHEN position(':' in i.source) > 0 THEN substr(i.source, 1, position(':' in i.source) - 1)
           ELSE i.source
         END AS value,
         COUNT(*) AS count
       FROM internships i ${where}
       GROUP BY value ORDER BY count DESC LIMIT 20`,
      params,
    );
  })();

  const totalPromise = (async () => {
    const { where, params } = combine(clauses);
    return (await one<{ n: number }>(`SELECT COUNT(*) AS n FROM internships i ${where}`, params))?.n ?? 0;
  })();

  const [
    seasons, years, fields, roleFamilies, programTypes, locationTypes,
    countries, regions, sponsorship, degrees, classYears, skills,
    companyRows, sourceRows, total,
  ] = await Promise.all([
    countBy('i.season', 'season', 8),
    countBy('i.year', 'year', 10),
    // Sized from the taxonomy rather than a fixed number, because a facet is
    // ordered by count and truncated from the bottom. A cap smaller than the
    // vocabulary silently hides the rarest values, which are exactly the ones
    // a newly added family starts out as: adding a role family used to remove
    // it from the filter it was added for. The headroom covers values left in
    // the catalog by earlier versions of the classifier.
    countBy('i.field', 'field', FIELDS.length + 10),
    countBy('i.role_family', 'role', ROLE_FAMILIES.length + 10),
    countBy('i.program_type', 'programType', 8),
    countBy('i.location_type', 'locationType', 6),
    countBy('i.country', 'country', 40),
    countBy('i.region', 'region', 60),
    countBy('i.sponsorship', 'sponsorship', 6),
    countJsonValues('i.degrees_json', 'degree', 12),
    countJsonValues('i.class_years_json', 'classYear', 12),
    countJsonValues('i.skills_json', 'skill', 40),
    companiesPromise,
    sourcesPromise,
    totalPromise,
  ]);

  return {
    seasons,
    years,
    fields,
    roleFamilies,
    programTypes,
    locationTypes,
    countries,
    regions,
    sponsorship,
    degrees,
    classYears,
    companies: companyRows,
    skills,
    sources: sourceRows.map((r) => ({ value: r.value, label: r.value, count: r.count })),
    total,
  };
}

/** Catalog-wide stats for the dashboard and sources page. */
export async function catalogStats() {
  const pool = getPool();
  void pool;
  const now = Math.floor(Date.now() / 1000);

  const [openRow, closedRow, companiesRow, withPayRow, freshRow, closingRow, lastSync, sourcesRow] =
    await Promise.all([
      one<{ n: number }>(
        'SELECT COUNT(*) AS n FROM internships WHERE is_open = 1 AND duplicate_of IS NULL',
      ),
      one<{ n: number }>('SELECT COUNT(*) AS n FROM internships WHERE is_open = 0'),
      one<{ n: number }>(
        'SELECT COUNT(DISTINCT company_slug) AS n FROM internships WHERE is_open = 1',
      ),
      one<{ n: number }>(
        'SELECT COUNT(*) AS n FROM internships WHERE is_open = 1 AND duplicate_of IS NULL AND salary_min IS NOT NULL',
      ),
      one<{ n: number }>(
        'SELECT COUNT(*) AS n FROM internships WHERE is_open = 1 AND duplicate_of IS NULL AND COALESCE(date_posted, first_seen_at) >= ?',
        [now - 7 * DAY],
      ),
      one<{ n: number }>(
        'SELECT COUNT(*) AS n FROM internships WHERE is_open = 1 AND duplicate_of IS NULL AND deadline IS NOT NULL AND deadline BETWEEN ? AND ?',
        [now, now + 14 * DAY],
      ),
      one<{
        id: number;
        started_at: number;
        finished_at: number;
        ok: number;
        found: number;
        inserted: number;
        closed: number;
        duration_ms: number;
      }>('SELECT * FROM sync_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1'),
      one<{ n: number }>('SELECT COUNT(*) AS n FROM source_configs WHERE enabled = 1'),
    ]);

  return {
    open: openRow?.n ?? 0,
    closed: closedRow?.n ?? 0,
    companies: companiesRow?.n ?? 0,
    withPay: withPayRow?.n ?? 0,
    freshWeek: freshRow?.n ?? 0,
    closingSoon: closingRow?.n ?? 0,
    lastSync: lastSync ?? undefined,
    sourceCount: sourcesRow?.n ?? 0,
  };
}
