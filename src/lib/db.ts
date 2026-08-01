import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type DB = Database.Database;

let cached: DB | null = null;

function resolveSchemaPath(): string {
  const candidates = [
    path.join(process.cwd(), 'src', 'lib', 'schema.sql'),
    path.join(process.cwd(), 'schema.sql'),
    path.join(import.meta.dirname ?? '.', 'schema.sql'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    `Could not locate schema.sql. Looked in:\n${candidates.map((c) => `  - ${c}`).join('\n')}`,
  );
}

/**
 * Read an environment variable at runtime.
 *
 * Next.js statically replaces `process.env.SOME_NAME` in the server bundle with
 * whatever the value was at *build* time, which silently freezes runtime
 * configuration. Indexing with a non-literal key defeats that substitution, so
 * the value is genuinely read when the function runs.
 */
function env(name: string): string | undefined {
  const key = String(name);
  return process.env[key];
}

/**
 * Where the database lives.
 *
 * On a serverless host the working directory is not always the project root, so
 * an existing file is looked up across the plausible locations before falling
 * back to the canonical path used when creating one.
 */
function dbCandidates(): string[] {
  return [
    path.join(process.cwd(), 'data', 'internfinder.db'),
    path.join(process.cwd(), '.next', 'server', 'data', 'internfinder.db'),
    path.join(import.meta.dirname ?? '.', '..', '..', 'data', 'internfinder.db'),
    '/var/task/data/internfinder.db',
  ];
}

export function dbPath(): string {
  const override = env('INTERNFINDER_DB');
  if (override) return override;

  const candidates = dbCandidates();
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // An unreadable candidate is simply not the one.
    }
  }
  return candidates[0];
}

/**
 * Explain a missing database in terms of what was actually on disk.
 *
 * A bare "unable to open database file" from SQLite says nothing about whether
 * the catalog was never built or simply landed somewhere unexpected, which is
 * the only thing worth knowing when a deploy fails.
 */
function missingDbError(): Error {
  const lines = dbCandidates().map((candidate) => {
    const dir = path.dirname(candidate);
    let detail: string;
    try {
      detail = fs.existsSync(dir)
        ? `directory exists, contains: ${fs.readdirSync(dir).slice(0, 8).join(', ') || '(empty)'}`
        : 'directory does not exist';
    } catch (err) {
      detail = `could not read directory (${(err as Error).message})`;
    }
    return `  - ${candidate}\n      ${detail}`;
  });

  return new Error(
    'No internship catalog found. It is built during deploy by "npm run vercel-build" — ' +
      'if this is a serverless host, check that the build command actually ran the sync step. ' +
      `Locally, run "npm run sync".\nLooked in:\n${lines.join('\n')}\ncwd: ${process.cwd()}`,
  );
}

/** Set once the database is actually open, from how it opened rather than a guess. */
let readOnlyMode: boolean | null = null;

/**
 * Best guess at read-only-ness *before* the database has been opened.
 * Only a hint: the authoritative answer comes from actually opening the file.
 */
function readOnlyHint(): boolean {
  const flag = env('INTERNFINDER_READONLY');
  if (flag === '0') return false;
  if (flag) return true;
  // During the build itself we need writes, so only lock down at runtime.
  return env('VERCEL') === '1' && env('NEXT_PHASE') !== 'phase-production-build';
}

/**
 * True when the database cannot be written to.
 *
 * This is deliberately derived from how the file actually opened rather than
 * from environment sniffing. Detecting the host by environment variable proved
 * unreliable — Vercel only exposes VERCEL=1 at runtime when a project setting is
 * enabled — and getting it wrong meant every request died on a raw SQLite
 * "unable to open database file" instead of degrading to browse-only.
 */
export function isReadOnly(): boolean {
  const flag = env('INTERNFINDER_READONLY');
  if (flag === '0') return false;
  if (flag) return true;

  if (readOnlyMode === null) {
    try {
      getDb();
    } catch {
      // Fall through to the hint; the caller will surface the real error.
    }
  }
  return readOnlyMode ?? readOnlyHint();
}

/**
 * Opens (and on first call, creates) the database.
 *
 * Tries read-write first, then falls back to read-only if the filesystem won't
 * allow it — which is what makes a serverless deploy work without any
 * host-specific configuration. The connection is cached for the process.
 */
export function getDb(): DB {
  if (cached) return cached;

  const file = dbPath();

  if (!readOnlyHint()) {
    try {
      cached = openWritable(file);
      readOnlyMode = false;
      return cached;
    } catch (err) {
      // Only a missing catalog is fatal. Anything else (a read-only mount, no
      // permission to create the WAL) means we can still serve what shipped.
      if (!fs.existsSync(file)) throw missingDbError();
      void err;
    }
  }

  if (!fs.existsSync(file)) throw missingDbError();

  // No schema exec and no WAL here: both need write access.
  cached = new Database(file, { readonly: true, fileMustExist: true });
  readOnlyMode = true;
  return cached;
}

function openWritable(file: string): DB {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);

  // better-sqlite3 opens the file lazily, so a read-only filesystem is not
  // reported by the constructor — it surfaces on the first statement, long
  // after the caller could have fallen back. Force the question now by taking a
  // write lock and immediately releasing it.
  try {
    db.exec('BEGIN IMMEDIATE; ROLLBACK;');
  } catch (err) {
    db.close();
    throw err;
  }

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(fs.readFileSync(resolveSchemaPath(), 'utf8'));

  seedProfileRow(db);
  return db;
}

/**
 * Collapse the write-ahead log into the main file and leave the database in
 * rollback-journal mode.
 *
 * A WAL-mode database cannot be opened on a read-only filesystem at all: WAL
 * needs a writable `-shm` companion file. Shipping the catalog to a serverless
 * host therefore requires taking it out of WAL first. Local use is unaffected —
 * the next writable open turns WAL straight back on.
 */
export function finalizeForReadOnly(db: DB = getDb()): void {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.pragma('journal_mode = DELETE');
  } catch {
    // Best effort: a database that is already read-only needs no finalizing.
  }
}

function seedProfileRow(db: DB) {
  const exists = db.prepare('SELECT 1 FROM profile WHERE id = 1').get();
  if (exists) return;
  const now = nowSec();
  db.prepare(
    `INSERT INTO profile (id, created_at, updated_at, preferred_seasons_json, preferred_years_json,
       preferred_fields_json, preferred_locations_json, skills_json)
     VALUES (1, ?, ?, '[]', '[]', '[]', '[]', '[]')`,
  ).run(now, now);
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function meta(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(key, value);
}

/** Parse a JSON column that may be null/malformed, always returning an array. */
export function jsonArray(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
