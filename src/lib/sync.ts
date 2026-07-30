import { getDb, nowSec, type DB } from './db';
import { normalize, type NormalizedListing, type RawListing } from './parse';
import { fetchAshby, fetchGreenhouse, fetchLever, fetchSmartRecruiters } from './sources/ats';
import { fetchArbeitnow, fetchGithubList, fetchRemoteOk } from './sources/feeds';
import { checkLink, mapPool } from './sources/http';
import { boardFromUrl, SEED_BOARDS, SEED_FEEDS } from './sources/seed';
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
export function ensureSeedSources(db: DB = getDb()): void {
  const insert = db.prepare(
    `INSERT INTO source_configs (kind, token, label, enabled, created_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(kind, token) DO NOTHING`,
  );
  const now = nowSec();
  const tx = db.transaction(() => {
    for (const feed of SEED_FEEDS) insert.run(feed.kind, feed.token, feed.label, now);
    for (const board of SEED_BOARDS) insert.run(board.kind, board.token, board.label, now);
  });
  tx();
}

function listSources(db: DB, opts: SyncOptions): SourceRow[] {
  let rows = db
    .prepare('SELECT * FROM source_configs WHERE enabled = 1 ORDER BY kind, token')
    .all() as SourceRow[];

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
    for (let i = 0; picked.length < opts.maxBoards && queues.some((q) => q.length > i); i++) {
      for (const queue of queues) {
        if (picked.length >= opts.maxBoards) break;
        if (queue.length > i) picked.push(queue[i]);
      }
    }

    rows = [...feeds, ...picked];
  }

  return rows;
}

function isBoardKind(kind: string): boolean {
  return kind === 'greenhouse' || kind === 'lever' || kind === 'ashby' || kind === 'smartrecruiters';
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
  const db = getDb();
  ensureSeedSources(db);

  const startedAt = nowSec();
  const t0 = Date.now();
  const log = opts.onProgress ?? (() => {});

  const runId = Number(
    (
      db
        .prepare('INSERT INTO sync_runs (started_at, trigger) VALUES (?, ?)')
        .run(startedAt, opts.trigger ?? 'manual') as { lastInsertRowid: number | bigint }
    ).lastInsertRowid,
  );

  const sources = listSources(db, opts);
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

      db.prepare(
        'UPDATE source_configs SET last_sync_at = ?, last_count = ?, last_error = NULL WHERE id = ?',
      ).run(nowSec(), listings.length, row.id);

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
      db.prepare('UPDATE source_configs SET last_sync_at = ?, last_error = ? WHERE id = ?').run(
        nowSec(),
        message.slice(0, 400),
        row.id,
      );
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
  const { inserted, updated, reopened, skipped } = upsertListings(db, all);

  // ---- Close listings that vanished from a source that synced cleanly. ----
  const healthySources = [...bySource.keys()];
  const closed = reconcileOpenness(db, bySource, healthySources);

  // ---- Lifecycle sweep + dedupe. ----
  const expired = sweepLifecycle(db);
  const duplicates = markDuplicates(db);

  // ---- Learn about new employers from the URLs we just saw. ----
  let discovered = 0;
  if (!opts.noDiscover) {
    discovered = discoverBoards(db, seenUrls);
    if (discovered > 0) log(`Discovered ${discovered} new company job board(s) for future syncs.`);
  }

  const durationMs = Date.now() - t0;
  const ok = outcomes.length > 0 && outcomes.some((o) => o.ok);

  db.prepare(
    `UPDATE sync_runs SET finished_at = ?, ok = ?, found = ?, inserted = ?, updated = ?,
        closed = ?, skipped = ?, duration_ms = ?, sources_json = ?, errors_json = ?
     WHERE id = ?`,
  ).run(
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

function sourceKeyForRow(row: SourceRow): string {
  if (row.kind === 'remoteok' || row.kind === 'arbeitnow') return row.kind;
  return `${row.kind}:${row.token}`;
}

interface UpsertCounts {
  inserted: number;
  updated: number;
  reopened: number;
  skipped: number;
}

/**
 * Insert new listings and refresh existing ones.
 *
 * A listing seen again is always marked open: reappearing on a live board is
 * evidence the role is accepting applications again.
 */
export function upsertListings(db: DB, listings: NormalizedListing[]): UpsertCounts {
  const now = nowSec();
  let inserted = 0;
  let updated = 0;
  let reopened = 0;
  let skipped = 0;

  const existing = db.prepare('SELECT id, is_open FROM internships WHERE id = ?');

  const insert = db.prepare(`
    INSERT INTO internships (
      id, source, source_kind, source_id, company, company_slug, company_url, title,
      normalized_title, apply_url, description, locations_json, primary_location, city, region,
      country, location_type, is_remote, season, year, terms_json, start_date, end_date,
      duration_weeks, deadline, field, role_family, program_type, degrees_json, class_years_json,
      gpa_min, sponsorship, offers_sponsorship, requires_citizenship, requires_clearance,
      requires_cover_letter, requires_transcript, requires_portfolio, skills_json, tags_json,
      is_paid, salary_min, salary_max, salary_period, salary_currency, comp_text,
      status, is_open, close_reason, closed_at, first_seen_at, last_seen_at,
      date_posted, date_updated, dedupe_key, quality
    ) VALUES (
      @id, @source, @source_kind, @source_id, @company, @company_slug, @company_url, @title,
      @normalized_title, @apply_url, @description, @locations_json, @primary_location, @city, @region,
      @country, @location_type, @is_remote, @season, @year, @terms_json, @start_date, @end_date,
      @duration_weeks, @deadline, @field, @role_family, @program_type, @degrees_json, @class_years_json,
      @gpa_min, @sponsorship, @offers_sponsorship, @requires_citizenship, @requires_clearance,
      @requires_cover_letter, @requires_transcript, @requires_portfolio, @skills_json, @tags_json,
      @is_paid, @salary_min, @salary_max, @salary_period, @salary_currency, @comp_text,
      @status, @is_open, NULL, NULL, @first_seen_at, @last_seen_at,
      @date_posted, @date_updated, @dedupe_key, @quality
    )
  `);

  const update = db.prepare(`
    UPDATE internships SET
      title = @title, normalized_title = @normalized_title, apply_url = @apply_url,
      company = @company, company_slug = @company_slug,
      company_url = COALESCE(@company_url, company_url),
      description = COALESCE(@description, description),
      locations_json = @locations_json, primary_location = @primary_location,
      city = @city, region = @region, country = @country,
      location_type = @location_type, is_remote = @is_remote,
      season = @season, year = @year, terms_json = @terms_json,
      start_date = @start_date, end_date = @end_date, duration_weeks = @duration_weeks,
      deadline = @deadline, field = @field, role_family = @role_family,
      program_type = @program_type, degrees_json = @degrees_json,
      class_years_json = @class_years_json, gpa_min = @gpa_min,
      sponsorship = @sponsorship, offers_sponsorship = @offers_sponsorship,
      requires_citizenship = @requires_citizenship, requires_clearance = @requires_clearance,
      requires_cover_letter = @requires_cover_letter, requires_transcript = @requires_transcript,
      requires_portfolio = @requires_portfolio, skills_json = @skills_json, tags_json = @tags_json,
      is_paid = @is_paid, salary_min = @salary_min, salary_max = @salary_max,
      salary_period = @salary_period, salary_currency = @salary_currency, comp_text = @comp_text,
      status = @status, is_open = @is_open,
      close_reason = CASE WHEN @is_open = 1 THEN NULL ELSE close_reason END,
      closed_at = CASE WHEN @is_open = 1 THEN NULL ELSE closed_at END,
      last_seen_at = @last_seen_at,
      date_posted = COALESCE(@date_posted, date_posted),
      date_updated = @date_updated, dedupe_key = @dedupe_key, quality = @quality
    WHERE id = @id
  `);

  const tx = db.transaction((batch: NormalizedListing[]) => {
    for (const listing of batch) {
      const params = toParams(listing, now);
      const prior = existing.get(listing.id) as { id: string; is_open: number } | undefined;

      if (!prior) {
        // A listing whose source already says it's inactive is not worth storing.
        if (!listing.active) {
          skipped++;
          continue;
        }
        insert.run(params);
        inserted++;
      } else {
        if (prior.is_open === 0 && listing.active) reopened++;
        update.run(params);
        updated++;
      }
    }
  });

  // Chunk so a single huge feed doesn't hold one enormous transaction.
  for (let i = 0; i < listings.length; i += 2000) {
    tx(listings.slice(i, i + 2000));
  }

  return { inserted, updated, reopened, skipped };
}

function toParams(l: NormalizedListing, now: number) {
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
export function reconcileOpenness(
  db: DB,
  bySource: Map<string, NormalizedListing[]>,
  healthySources: string[],
): number {
  if (healthySources.length === 0) return 0;
  const now = nowSec();
  let closed = 0;

  const tx = db.transaction(() => {
    for (const source of healthySources) {
      const seen = new Set((bySource.get(source) ?? []).map((l) => l.id));

      const openRows = db
        .prepare('SELECT id FROM internships WHERE source = ? AND is_open = 1')
        .all(source) as { id: string }[];

      const gone = openRows.filter((r) => !seen.has(r.id)).map((r) => r.id);
      if (gone.length === 0) continue;

      const close = db.prepare(
        `UPDATE internships SET is_open = 0, status = 'closed', close_reason = 'delisted', closed_at = ?
         WHERE id = ?`,
      );
      for (const id of gone) {
        close.run(now, id);
        closed++;
      }
    }
  });
  tx();
  return closed;
}

/**
 * Close listings on time-based signals: a passed deadline, a long absence, or
 * an ancient posting date. This is the safety net for sources whose feeds go
 * quiet without formally delisting anything.
 */
export function sweepLifecycle(db: DB): number {
  const now = nowSec();
  let count = 0;

  const expired = db
    .prepare(
      `UPDATE internships SET is_open = 0, status = 'expired', close_reason = 'deadline-passed', closed_at = ?
       WHERE is_open = 1 AND deadline IS NOT NULL AND deadline < ?`,
    )
    .run(now, now - DAY);
  count += expired.changes;

  const unseen = db
    .prepare(
      `UPDATE internships SET is_open = 0, status = 'closed', close_reason = 'stale', closed_at = ?
       WHERE is_open = 1 AND last_seen_at < ?`,
    )
    .run(now, now - STALE_UNSEEN_DAYS * DAY);
  count += unseen.changes;

  const ancient = db
    .prepare(
      `UPDATE internships SET is_open = 0, status = 'closed', close_reason = 'stale', closed_at = ?
       WHERE is_open = 1 AND date_posted IS NOT NULL AND date_posted < ?
         AND (date_updated IS NULL OR date_updated < ?)`,
    )
    .run(now, now - STALE_POSTED_DAYS * DAY, now - STALE_POSTED_DAYS * DAY);
  count += ancient.changes;

  // A term whose start is well behind us can't be applied to, even if the
  // source still flags it active — e.g. a "Spring 2025" listing seen in 2026.
  const termPassed = db
    .prepare(
      `UPDATE internships SET is_open = 0, status = 'expired', close_reason = 'term-passed', closed_at = ?
       WHERE is_open = 1 AND start_date IS NOT NULL AND start_date < ?`,
    )
    .run(now, now - TERM_PASSED_DAYS * DAY);
  count += termPassed.changes;

  return count;
}

/**
 * Collapse the same role found on multiple sources down to one canonical row.
 * Preference order: a company's own ATS board, then metadata completeness,
 * then the most recently posted copy.
 */
export function markDuplicates(db: DB): number {
  const groups = db
    .prepare(
      `SELECT dedupe_key FROM internships
       WHERE is_open = 1 AND dedupe_key <> ''
       GROUP BY dedupe_key HAVING COUNT(*) > 1`,
    )
    .all() as { dedupe_key: string }[];

  if (groups.length === 0) {
    db.prepare(
      `UPDATE internships SET duplicate_of = NULL
       WHERE duplicate_of IS NOT NULL AND is_open = 1
         AND duplicate_of NOT IN (SELECT id FROM internships WHERE is_open = 1)`,
    ).run();
    return 0;
  }

  const rank = (kind: string) => (kind === 'ats' ? 2 : kind === 'aggregator' ? 1 : 0);
  let marked = 0;

  const tx = db.transaction(() => {
    // Reset first so a previously-hidden row can be promoted when the winner closes.
    db.prepare('UPDATE internships SET duplicate_of = NULL WHERE is_open = 1').run();

    const rowsFor = db.prepare(
      `SELECT id, source_kind, quality, date_posted, description IS NOT NULL AS has_desc
       FROM internships WHERE dedupe_key = ? AND is_open = 1`,
    );
    const setDup = db.prepare('UPDATE internships SET duplicate_of = ? WHERE id = ?');

    for (const { dedupe_key } of groups) {
      const rows = rowsFor.all(dedupe_key) as {
        id: string;
        source_kind: string;
        quality: number;
        date_posted: number | null;
        has_desc: number;
      }[];
      if (rows.length < 2) continue;

      rows.sort(
        (a, b) =>
          rank(b.source_kind) - rank(a.source_kind) ||
          b.has_desc - a.has_desc ||
          b.quality - a.quality ||
          (b.date_posted ?? 0) - (a.date_posted ?? 0) ||
          a.id.localeCompare(b.id),
      );

      const winner = rows[0];
      for (const loser of rows.slice(1)) {
        setDup.run(winner.id, loser.id);
        marked++;
      }
    }
  });
  tx();

  return marked;
}

/**
 * Read apply URLs from this run and register any ATS board we don't track yet.
 * This is how the catalog grows past the seed list on its own.
 *
 * The employer name is carried alongside the URL because some ATS APIs (Ashby,
 * Lever) never return one — without this, the board slug becomes the displayed
 * company, so "k-id" would show up as "K Id" instead of the real name.
 */
export function discoverBoards(db: DB, seen: { url: string; company?: string }[]): number {
  const found = new Map<string, { kind: string; token: string; label: string }>();

  for (const { url, company } of seen) {
    const board = boardFromUrl(url);
    if (!board) continue;
    const key = `${board.kind}:${board.token.toLowerCase()}`;
    const name = company?.trim();
    // A real company name always beats a slug-derived label.
    if (name) found.set(key, { ...board, label: name });
    else if (!found.has(key)) found.set(key, board);
  }
  if (found.size === 0) return 0;

  const insert = db.prepare(
    `INSERT INTO source_configs (kind, token, label, enabled, created_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(kind, token) DO NOTHING`,
  );
  // Backfill a better label onto boards we already track under a slug-derived name.
  const relabel = db.prepare(
    `UPDATE source_configs SET label = ?
     WHERE kind = ? AND token = ? AND lower(replace(label, ' ', '')) = lower(replace(?, '-', ''))`,
  );
  const now = nowSec();
  let added = 0;

  const tx = db.transaction(() => {
    for (const board of found.values()) {
      const result = insert.run(board.kind, board.token, board.label, now);
      if (result.changes > 0) added++;
      else relabel.run(board.label, board.kind, board.token, board.token);
    }
  });
  tx();

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
  const db = getDb();
  const now = nowSec();

  const rows = db
    .prepare(
      `SELECT id, apply_url FROM internships
       WHERE is_open = 1 AND duplicate_of IS NULL
       ORDER BY COALESCE(link_checked_at, 0) ASC, last_seen_at DESC
       LIMIT ?`,
    )
    .all(limit) as { id: string; apply_url: string }[];

  let closed = 0;
  let alive = 0;
  let errors = 0;

  const markChecked = db.prepare(
    'UPDATE internships SET link_status = ?, link_checked_at = ? WHERE id = ?',
  );
  const markClosed = db.prepare(
    `UPDATE internships SET is_open = 0, status = 'closed', close_reason = 'dead-link',
        closed_at = ?, link_status = ?, link_checked_at = ? WHERE id = ?`,
  );

  await mapPool(rows, opts.concurrency ?? 5, async (row) => {
    const result = await checkLink(row.apply_url);
    if (result.status === 0) {
      errors++;
      return; // couldn't reach it; leave the listing alone
    }
    if (result.closed || result.status >= 400) {
      markClosed.run(now, result.status, now, row.id);
      closed++;
    } else {
      markChecked.run(result.status, now, row.id);
      alive++;
    }
  });

  opts.onProgress?.(`Checked ${rows.length} links: ${alive} alive, ${closed} closed, ${errors} unreachable`);
  return { checked: rows.length, closed, alive, errors };
}
