import { exec, nowSec, one, q } from './db';
import { normalize, type NormalizedListing, type RawListing } from './parse';
import { fetchAshby, fetchGreenhouse, fetchLever, fetchSmartRecruiters } from './sources/ats';
import { fetchWorkable } from './sources/workable';
import {
  fetchAmazon,
  fetchBamboo,
  fetchBreezy,
  fetchMicrosoft,
  fetchPersonio,
  fetchRippling,
} from './sources/bigtech';
import { fetchEightfold } from './sources/eightfold';
import { fetchOracle } from './sources/oracle';
import { fetchWorkday } from './sources/workday';
import { fetchArbeitnow, fetchGithubList, fetchJobicy, fetchRemoteOk } from './sources/feeds';
import { checkLink, mapPool } from './sources/http';
import { boardFromUrl, fallbackLabel, SEED_BOARDS, SEED_FEEDS } from './sources/seed';
import { BOARD_KINDS } from './types';
import { DAY } from './util';

/**
 * How long a listing may go unseen before we stop trusting that it's open.
 * Aggregator feeds occasionally drop entries transiently, so this is generous.
 */
const STALE_UNSEEN_DAYS = 21;
/** A posting this old with no update is almost certainly filled. */
const STALE_POSTED_DAYS = 150;
/**
 * How far past its start date a term may be before we stop showing it. Sources
 * sometimes keep old cycles listed as active; you cannot apply to an internship
 * that began three months ago.
 */
const TERM_PASSED_DAYS = 90;

export interface SourceRow {
  id: number;
  kind: string;
  token: string;
  label: string;
  enabled: number;
  last_sync_at: number | null;
  last_count: number | null;
  last_error: string | null;
}

export interface SourceOutcome {
  source: string;
  kind: string;
  token: string;
  label: string;
  ok: boolean;
  fetched: number;
  internships: number;
  error?: string;
  ms: number;
}

export interface SyncResult {
  runId: number;
  ok: boolean;
  found: number;
  inserted: number;
  updated: number;
  reopened: number;
  closed: number;
  skipped: number;
  duplicates: number;
  discovered: number;
  durationMs: number;
  sources: SourceOutcome[];
  errors: string[];
}

export interface SyncOptions {
  /** Restrict to these source kinds. */
  kinds?: string[];
  /** Restrict to a specific "kind:token". */
  only?: string[];
  /** Max sources fetched in parallel. */
  concurrency?: number;
  /** Skip the ATS auto-discovery step. */
  noDiscover?: boolean;
  /** How the run was started, for the audit log. */
  trigger?: string;
  /** Cap on ATS boards touched in one run (keeps a manual sync quick). */
  maxBoards?: number;
  onProgress?: (message: string) => void;
}

/** Insert the built-in sources on first run. */
export async function ensureSeedSources(): Promise<void> {
  const all = [...SEED_FEEDS, ...SEED_BOARDS];
  const now = nowSec();
  await exec(
    `INSERT INTO source_configs (kind, token, label, enabled, created_at)
     SELECT kind, token, label, 1, ?
     FROM unnest(?::text[], ?::text[], ?::text[]) AS s(kind, token, label)
     ON CONFLICT (kind, token) DO NOTHING`,
    [now, all.map((s) => s.kind), all.map((s) => s.token), all.map((s) => s.label)],
  );
}

async function listSources(opts: SyncOptions): Promise<SourceRow[]> {
  let rows = await q<SourceRow>(
    'SELECT * FROM source_configs WHERE enabled = 1 ORDER BY kind, token',
  );

  if (opts.kinds?.length) rows = rows.filter((r) => opts.kinds!.includes(r.kind));
  if (opts.only?.length) {
    const wanted = new Set(opts.only);
    rows = rows.filter((r) => wanted.has(`${r.kind}:${r.token}`) || wanted.has(r.kind));
  }

  if (opts.maxBoards != null) {
    const feeds = rows.filter((r) => !isBoardKind(r.kind));
    const boards = rows.filter((r) => isBoardKind(r.kind));

    // Prefer boards we haven't synced in the longest time...
    boards.sort((a, b) => (a.last_sync_at ?? 0) - (b.last_sync_at ?? 0));

    // ...but round-robin across providers so one capped run samples every ATS
    // rather than exhausting whichever kind sorts first alphabetically.
    const byKind = new Map<string, SourceRow[]>();
    for (const board of boards) {
      const bucket = byKind.get(board.kind) ?? [];
      bucket.push(board);
      byKind.set(board.kind, bucket);
    }
    const queues = [...byKind.values()];
    const picked: SourceRow[] = [];
    for (let i = 0; picked.length < opts.maxBoards && queues.some((queue) => queue.length > i); i++) {
      for (const queue of queues) {
        if (picked.length >= opts.maxBoards) break;
        if (queue.length > i) picked.push(queue[i]);
      }
    }

    rows = [...feeds, ...picked];
  }

  return rows;
}

/** Sources that belong to one employer, as opposed to a cross-company feed. */
const PER_EMPLOYER_KINDS = new Set<string>(BOARD_KINDS);

function isBoardKind(kind: string): boolean {
  return PER_EMPLOYER_KINDS.has(kind);
}

async function fetchSource(row: SourceRow): Promise<RawListing[]> {
  switch (row.kind) {
    case 'greenhouse':
      return fetchGreenhouse(row.token, row.label);
    case 'lever':
      return fetchLever(row.token, row.label);
    case 'ashby':
      return fetchAshby(row.token, row.label);
    case 'smartrecruiters':
      return fetchSmartRecruiters(row.token, row.label);
    case 'workable':
      return fetchWorkable(row.token, row.label);
    case 'workday':
      return fetchWorkday(row.token, row.label);
    case 'oracle':
      return fetchOracle(row.token, row.label);
    case 'eightfold':
      return fetchEightfold(row.token, row.label);
    case 'rippling':
      return fetchRippling(row.token, row.label);
    case 'bamboohr':
      return fetchBamboo(row.token, row.label);
    case 'breezy':
      return fetchBreezy(row.token, row.label);
    case 'personio':
      return fetchPersonio(row.token, row.label);
    case 'amazon':
      return fetchAmazon();
    case 'microsoft':
      return fetchMicrosoft();
    case 'jobicy':
      return fetchJobicy();
    case 'github':
      return fetchGithubList(row.token);
    case 'remoteok':
      return fetchRemoteOk();
    case 'arbeitnow':
      return fetchArbeitnow();
    default:
      throw new Error(`Unknown source kind: ${row.kind}`);
  }
}

/**
 * Run a full sync: fetch every enabled source, normalize, upsert, and reconcile
 * which listings are still open.
 */
export async function runSync(opts: SyncOptions = {}): Promise<SyncResult> {
  await ensureSeedSources();

  const startedAt = nowSec();
  const t0 = Date.now();
  const log = opts.onProgress ?? (() => {});

  const runRow = await one<{ id: number }>(
    'INSERT INTO sync_runs (started_at, trigger) VALUES (?, ?) RETURNING id',
    [startedAt, opts.trigger ?? 'manual'],
  );
  const runId = runRow!.id;

  const sources = await listSources(opts);
  log(`Syncing ${sources.length} source${sources.length === 1 ? '' : 's'}…`);

  const outcomes: SourceOutcome[] = [];
  const errors: string[] = [];
  /** Listings keyed by source, so we only reconcile sources that succeeded. */
  const bySource = new Map<string, NormalizedListing[]>();
  /** Apply URLs plus the employer name the feed gave us, for board discovery. */
  const seenUrls: { url: string; company?: string }[] = [];

  await mapPool(sources, opts.concurrency ?? 6, async (row) => {
    const startMs = Date.now();
    const sourceKey = `${row.kind}:${row.token}`;
    try {
      const raw = await fetchSource(row);
      const listings: NormalizedListing[] = [];
      for (const item of raw) {
        // Only aggregator feeds carry a trustworthy employer name for a board
        // they don't own; an ATS reporting its own slug adds nothing.
        seenUrls.push({
          url: item.applyUrl,
          company: row.kind === 'github' ? item.company : undefined,
        });
        const normalized = normalize(item);
        if (normalized) listings.push(normalized);
      }

      // Group by the source string the adapter actually emitted, since
      // aggregator feeds carry their own per-source identity.
      for (const listing of listings) {
        const bucket = bySource.get(listing.source) ?? [];
        bucket.push(listing);
        bySource.set(listing.source, bucket);
      }
      // Register the source even when it produced nothing, so reconciliation
      // can close everything it used to carry.
      if (listings.length === 0) {
        const emitted = sourceKeyForRow(row);
        if (!bySource.has(emitted)) bySource.set(emitted, []);
      }

      await exec(
        'UPDATE source_configs SET last_sync_at = ?, last_count = ?, last_error = NULL WHERE id = ?',
        [nowSec(), listings.length, row.id],
      );

      outcomes.push({
        source: sourceKey,
        kind: row.kind,
        token: row.token,
        label: row.label,
        ok: true,
        fetched: raw.length,
        internships: listings.length,
        ms: Date.now() - startMs,
      });
      log(`  ${row.label}: ${listings.length} internships from ${raw.length} postings`);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      await exec('UPDATE source_configs SET last_sync_at = ?, last_error = ? WHERE id = ?', [
        nowSec(),
        message.slice(0, 400),
        row.id,
      ]);
      outcomes.push({
        source: sourceKey,
        kind: row.kind,
        token: row.token,
        label: row.label,
        ok: false,
        fetched: 0,
        internships: 0,
        error: message,
        ms: Date.now() - startMs,
      });
      errors.push(`${sourceKey}: ${message}`);
      log(`  ${row.label}: FAILED — ${message}`);
    }
  });

  // ---- Upsert everything we found. ----
  const all = [...bySource.values()].flat();
  const { inserted, updated, reopened, skipped } = await upsertListings(all);

  // ---- Close listings that vanished from a source that synced cleanly. ----
  const healthySources = [...bySource.keys()];
  const closed = await reconcileOpenness(bySource, healthySources);

  // ---- Lifecycle sweep + dedupe. ----
  const expired = await sweepLifecycle();
  const duplicates = await markDuplicates();

  // ---- Learn about new employers from the URLs we just saw. ----
  let discovered = 0;
  if (!opts.noDiscover) {
    discovered = await discoverBoards(seenUrls);
    if (discovered > 0) log(`Discovered ${discovered} new company job board(s) for future syncs.`);
  }

  const durationMs = Date.now() - t0;
  const ok = outcomes.length > 0 && outcomes.some((o) => o.ok);

  await exec(
    `UPDATE sync_runs SET finished_at = ?, ok = ?, found = ?, inserted = ?, updated = ?,
        closed = ?, skipped = ?, duration_ms = ?, sources_json = ?, errors_json = ?
     WHERE id = ?`,
    [
      nowSec(),
      ok ? 1 : 0,
      all.length,
      inserted,
      updated,
      closed + expired,
      skipped,
      durationMs,
      JSON.stringify(outcomes),
      JSON.stringify(errors),
      runId,
    ],
  );

  return {
    runId,
    ok,
    found: all.length,
    inserted,
    updated,
    reopened,
    closed: closed + expired,
    skipped,
    duplicates,
    discovered,
    durationMs,
    sources: outcomes,
    errors,
  };
}

/** Singleton feeds emit a bare kind as their source string; boards emit "kind:token". */
const SINGLETON_KINDS = new Set(['remoteok', 'arbeitnow', 'jobicy', 'amazon', 'microsoft']);

function sourceKeyForRow(row: SourceRow): string {
  if (SINGLETON_KINDS.has(row.kind)) return row.kind;
  return `${row.kind}:${row.token}`;
}

interface UpsertCounts {
  inserted: number;
  updated: number;
  reopened: number;
  skipped: number;
}

/** Column list shared by the bulk-upsert statement and its record definition. */
const UPSERT_COLUMNS: [name: string, pgType: string][] = [
  ['id', 'text'], ['source', 'text'], ['source_kind', 'text'], ['source_id', 'text'],
  ['company', 'text'], ['company_slug', 'text'], ['company_url', 'text'], ['title', 'text'],
  ['normalized_title', 'text'], ['apply_url', 'text'], ['description', 'text'],
  ['locations_json', 'text'], ['primary_location', 'text'], ['city', 'text'], ['region', 'text'],
  ['country', 'text'], ['location_type', 'text'], ['is_remote', 'smallint'], ['season', 'text'],
  ['year', 'integer'], ['terms_json', 'text'], ['start_date', 'bigint'], ['end_date', 'bigint'],
  ['duration_weeks', 'integer'], ['deadline', 'bigint'], ['field', 'text'], ['role_family', 'text'],
  ['program_type', 'text'], ['degrees_json', 'text'], ['class_years_json', 'text'],
  ['gpa_min', 'double precision'], ['sponsorship', 'text'], ['offers_sponsorship', 'smallint'],
  ['requires_citizenship', 'smallint'], ['requires_clearance', 'smallint'],
  ['requires_cover_letter', 'smallint'], ['requires_transcript', 'smallint'],
  ['requires_portfolio', 'smallint'], ['skills_json', 'text'], ['tags_json', 'text'],
  ['is_paid', 'smallint'], ['salary_min', 'double precision'], ['salary_max', 'double precision'],
  ['salary_period', 'text'], ['salary_currency', 'text'], ['comp_text', 'text'],
  ['status', 'text'], ['is_open', 'smallint'], ['first_seen_at', 'bigint'],
  ['last_seen_at', 'bigint'], ['date_posted', 'bigint'], ['date_updated', 'bigint'],
  ['dedupe_key', 'text'], ['quality', 'double precision'],
];

/** Columns whose new value should only overwrite when the new value is present. */
const COALESCE_ON_UPDATE = new Set(['company_url', 'description', 'date_posted']);
/** Columns never touched on update. */
const INSERT_ONLY = new Set(['id', 'first_seen_at']);

const UPSERT_SQL = (() => {
  const names = UPSERT_COLUMNS.map(([n]) => n);
  const recordDef = UPSERT_COLUMNS.map(([n, t]) => `${n} ${t}`).join(', ');
  const updates = names
    .filter((n) => !INSERT_ONLY.has(n))
    .map((n) =>
      COALESCE_ON_UPDATE.has(n)
        ? `${n} = COALESCE(EXCLUDED.${n}, internships.${n})`
        : `${n} = EXCLUDED.${n}`,
    );
  // Reopening clears the closed markers; closing keeps whatever reason applies.
  updates.push(
    'close_reason = CASE WHEN EXCLUDED.is_open = 1 THEN NULL ELSE internships.close_reason END',
    'closed_at = CASE WHEN EXCLUDED.is_open = 1 THEN NULL ELSE internships.closed_at END',
  );
  return `
    INSERT INTO internships (${names.join(', ')})
    SELECT ${names.map((n) => `r.${n}`).join(', ')}
    FROM jsonb_to_recordset(?::jsonb) AS r(${recordDef})
    ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}
    RETURNING id, (xmax = 0) AS was_insert
  `;
})();

/**
 * Insert new listings and refresh existing ones in bulk — one statement per
 * chunk, which matters when the database is across the network.
 *
 * A listing seen again is always marked open: reappearing on a live board is
 * evidence the role is accepting applications again.
 */
export async function upsertListings(listings: NormalizedListing[]): Promise<UpsertCounts> {
  const now = nowSec();
  let inserted = 0;
  let updated = 0;
  let reopened = 0;
  let skipped = 0;

  // The same listing can appear twice in one run (e.g. two aggregator entries
  // resolving to one id); a single multi-row upsert cannot touch a row twice.
  const byId = new Map<string, NormalizedListing>();
  for (const listing of listings) byId.set(listing.id, listing);
  const unique = [...byId.values()];

  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    const ids = chunk.map((l) => l.id);

    const existing = new Map(
      (
        await q<{ id: string; is_open: number }>(
          'SELECT id, is_open FROM internships WHERE id = ANY(?)',
          [ids],
        )
      ).map((r) => [r.id, r.is_open]),
    );

    const batch: Record<string, unknown>[] = [];
    for (const listing of chunk) {
      const prior = existing.get(listing.id);
      if (prior === undefined && !listing.active) {
        // A listing whose source already says it's inactive is not worth storing.
        skipped++;
        continue;
      }
      if (prior === 0 && listing.active) reopened++;
      batch.push(toParams(listing, now));
    }
    if (batch.length === 0) continue;

    const results = await q<{ id: string; was_insert: boolean }>(UPSERT_SQL, [
      JSON.stringify(batch),
    ]);
    for (const row of results) {
      if (row.was_insert) inserted++;
      else updated++;
    }
  }

  return { inserted, updated, reopened, skipped };
}

function toParams(l: NormalizedListing, now: number): Record<string, unknown> {
  const open = l.active ? 1 : 0;
  return {
    id: l.id,
    source: l.source,
    source_kind: l.source_kind,
    source_id: l.source_id,
    company: l.company,
    company_slug: l.company_slug,
    company_url: l.company_url,
    title: l.title,
    normalized_title: l.normalized_title,
    apply_url: l.apply_url,
    description: l.description,
    locations_json: JSON.stringify(l.locations),
    primary_location: l.primary_location,
    city: l.city,
    region: l.region,
    country: l.country,
    location_type: l.location_type,
    is_remote: l.is_remote,
    season: l.season,
    year: l.year,
    terms_json: JSON.stringify(l.terms),
    start_date: l.start_date,
    end_date: l.end_date,
    duration_weeks: l.duration_weeks,
    deadline: l.deadline,
    field: l.field,
    role_family: l.role_family,
    program_type: l.program_type,
    degrees_json: JSON.stringify(l.degrees),
    class_years_json: JSON.stringify(l.class_years),
    gpa_min: l.gpa_min,
    sponsorship: l.sponsorship,
    offers_sponsorship: l.offers_sponsorship,
    requires_citizenship: l.requires_citizenship,
    requires_clearance: l.requires_clearance,
    requires_cover_letter: l.requires_cover_letter,
    requires_transcript: l.requires_transcript,
    requires_portfolio: l.requires_portfolio,
    skills_json: JSON.stringify(l.skills),
    tags_json: JSON.stringify(l.tags),
    is_paid: l.is_paid,
    salary_min: l.salary_min,
    salary_max: l.salary_max,
    salary_period: l.salary_period,
    salary_currency: l.salary_currency,
    comp_text: l.comp_text,
    status: open ? 'open' : 'closed',
    is_open: open,
    first_seen_at: now,
    last_seen_at: now,
    date_posted: l.date_posted,
    date_updated: l.date_updated,
    dedupe_key: l.dedupe_key,
    quality: l.quality,
  };
}

/**
 * Close listings that a healthy source no longer carries.
 *
 * Only sources that fetched successfully in this run are reconciled — a network
 * failure must never be read as "this employer closed every role".
 */
export async function reconcileOpenness(
  bySource: Map<string, NormalizedListing[]>,
  healthySources: string[],
): Promise<number> {
  if (healthySources.length === 0) return 0;
  const now = nowSec();
  let closed = 0;

  for (const source of healthySources) {
    const seen = (bySource.get(source) ?? []).map((l) => l.id);
    closed += await exec(
      `UPDATE internships SET is_open = 0, status = 'closed', close_reason = 'delisted', closed_at = ?
       WHERE source = ? AND is_open = 1 AND NOT (id = ANY(?))`,
      [now, source, seen],
    );
  }
  return closed;
}

/**
 * Close listings on time-based signals: a passed deadline, a long absence, or
 * an ancient posting date. This is the safety net for sources whose feeds go
 * quiet without formally delisting anything.
 */
export async function sweepLifecycle(): Promise<number> {
  const now = nowSec();
  let count = 0;

  count += await exec(
    `UPDATE internships SET is_open = 0, status = 'expired', close_reason = 'deadline-passed', closed_at = ?
     WHERE is_open = 1 AND deadline IS NOT NULL AND deadline < ?`,
    [now, now - DAY],
  );

  count += await exec(
    `UPDATE internships SET is_open = 0, status = 'closed', close_reason = 'stale', closed_at = ?
     WHERE is_open = 1 AND last_seen_at < ?`,
    [now, now - STALE_UNSEEN_DAYS * DAY],
  );

  count += await exec(
    `UPDATE internships SET is_open = 0, status = 'closed', close_reason = 'stale', closed_at = ?
     WHERE is_open = 1 AND date_posted IS NOT NULL AND date_posted < ?
       AND (date_updated IS NULL OR date_updated < ?)`,
    [now, now - STALE_POSTED_DAYS * DAY, now - STALE_POSTED_DAYS * DAY],
  );

  // A term whose start is well behind us can't be applied to, even if the
  // source still flags it active — e.g. a "Spring 2025" listing seen in 2026.
  count += await exec(
    `UPDATE internships SET is_open = 0, status = 'expired', close_reason = 'term-passed', closed_at = ?
     WHERE is_open = 1 AND start_date IS NOT NULL AND start_date < ?`,
    [now, now - TERM_PASSED_DAYS * DAY],
  );

  return count;
}

/**
 * Collapse the same role found on multiple sources down to one canonical row.
 * Preference order: a company's own ATS board, then metadata completeness,
 * then the most recently posted copy.
 */
export async function markDuplicates(): Promise<number> {
  // Reset first so a previously-hidden row can be promoted when the winner closes.
  await exec('UPDATE internships SET duplicate_of = NULL WHERE is_open = 1');
  await exec(
    `UPDATE internships SET duplicate_of = NULL
     WHERE duplicate_of IS NOT NULL AND is_open = 1
       AND duplicate_of NOT IN (SELECT id FROM internships WHERE is_open = 1)`,
  );

  const rows = await q<{
    id: string;
    dedupe_key: string;
    source_kind: string;
    quality: number;
    date_posted: number | null;
    has_desc: number;
  }>(
    `SELECT id, dedupe_key, source_kind, quality, date_posted,
            CASE WHEN description IS NOT NULL THEN 1 ELSE 0 END AS has_desc
     FROM internships
     WHERE is_open = 1 AND dedupe_key <> ''
       AND dedupe_key IN (
         SELECT dedupe_key FROM internships
         WHERE is_open = 1 AND dedupe_key <> ''
         GROUP BY dedupe_key HAVING COUNT(*) > 1
       )`,
  );

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const bucket = groups.get(row.dedupe_key) ?? [];
    bucket.push(row);
    groups.set(row.dedupe_key, bucket);
  }

  const rank = (kind: string) => (kind === 'ats' ? 2 : kind === 'aggregator' ? 1 : 0);
  const pairs: { id: string; winner: string }[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(
      (a, b) =>
        rank(b.source_kind) - rank(a.source_kind) ||
        b.has_desc - a.has_desc ||
        b.quality - a.quality ||
        (b.date_posted ?? 0) - (a.date_posted ?? 0) ||
        a.id.localeCompare(b.id),
    );
    const winner = group[0];
    for (const loser of group.slice(1)) pairs.push({ id: loser.id, winner: winner.id });
  }

  if (pairs.length === 0) return 0;

  for (let i = 0; i < pairs.length; i += 2000) {
    const chunk = pairs.slice(i, i + 2000);
    await exec(
      `UPDATE internships i SET duplicate_of = m.winner
       FROM jsonb_to_recordset(?::jsonb) AS m(id text, winner text)
       WHERE i.id = m.id`,
      [JSON.stringify(chunk)],
    );
  }

  return pairs.length;
}

/**
 * Read apply URLs from this run and register any ATS board we don't track yet.
 * This is how the catalog grows past the seed list on its own.
 *
 * The employer name is carried alongside the URL because some ATS APIs (Ashby,
 * Lever) never return one — without this, the board slug becomes the displayed
 * company, so "k-id" would show up as "K Id" instead of the real name.
 */
export async function discoverBoards(seen: { url: string; company?: string }[]): Promise<number> {
  const found = new Map<string, { kind: string; token: string; label: string; fallback: string }>();

  for (const { url, company } of seen) {
    const board = boardFromUrl(url);
    if (!board) continue;
    const key = `${board.kind}:${board.token.toLowerCase()}`;
    const fallback = fallbackLabel(board);
    const name = company?.trim();
    // A real company name always beats a slug-derived label.
    if (name) found.set(key, { ...board, label: name, fallback });
    else if (!found.has(key)) found.set(key, { ...board, fallback });
  }
  if (found.size === 0) return 0;

  const boards = [...found.values()];
  const now = nowSec();
  const columns = (key: 'kind' | 'token' | 'label' | 'fallback') => boards.map((b) => b[key]);

  const added = await exec(
    `INSERT INTO source_configs (kind, token, label, enabled, created_at)
     SELECT kind, token, label, 1, ?
     FROM unnest(?::text[], ?::text[], ?::text[]) AS s(kind, token, label)
     ON CONFLICT (kind, token) DO NOTHING`,
    [now, columns('kind'), columns('token'), columns('label')],
  );

  // Backfill a real employer name onto boards we only ever saw as a slug.
  // This matters most for Workday and Oracle, whose tokens are hosting details
  // ("ibqbjb.fa.ocs.oraclecloud.com/CX_1") rather than anything a human would
  // recognize — and whose label becomes the company on every listing they own.
  await exec(
    `UPDATE source_configs sc SET label = s.label
     FROM unnest(?::text[], ?::text[], ?::text[], ?::text[]) AS s(kind, token, label, fallback)
     WHERE sc.kind = s.kind AND sc.token = s.token
       AND sc.label <> s.label AND sc.label = s.fallback`,
    [columns('kind'), columns('token'), columns('label'), columns('fallback')],
  );

  return added;
}

/**
 * Verify that application links still resolve, closing the ones that 404 or
 * show a "no longer accepting applications" banner.
 *
 * This is the strongest openness check available, but it costs one request per
 * listing, so it runs over the least-recently-checked rows in bounded batches.
 */
export async function verifyLinks(
  limit = 100,
  opts: { concurrency?: number; onProgress?: (msg: string) => void } = {},
): Promise<{ checked: number; closed: number; alive: number; errors: number }> {
  const now = nowSec();

  const rows = await q<{ id: string; apply_url: string }>(
    `SELECT id, apply_url FROM internships
     WHERE is_open = 1 AND duplicate_of IS NULL
     ORDER BY COALESCE(link_checked_at, 0) ASC, last_seen_at DESC
     LIMIT ?`,
    [limit],
  );

  let closed = 0;
  let alive = 0;
  let errors = 0;

  await mapPool(rows, opts.concurrency ?? 5, async (row) => {
    const result = await checkLink(row.apply_url);
    if (result.status === 0) {
      errors++;
      return; // couldn't reach it; leave the listing alone
    }
    if (result.closed || result.status >= 400) {
      await exec(
        `UPDATE internships SET is_open = 0, status = 'closed', close_reason = 'dead-link',
            closed_at = ?, link_status = ?, link_checked_at = ? WHERE id = ?`,
        [now, result.status, now, row.id],
      );
      closed++;
    } else {
      await exec('UPDATE internships SET link_status = ?, link_checked_at = ? WHERE id = ?', [
        result.status,
        now,
        row.id,
      ]);
      alive++;
    }
  });

  opts.onProgress?.(`Checked ${rows.length} links: ${alive} alive, ${closed} closed, ${errors} unreachable`);
  return { checked: rows.length, closed, alive, errors };
}
