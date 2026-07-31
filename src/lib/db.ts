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

export function dbPath(): string {
  const override = env('INTERNFINDER_DB');
  if (override) return override;
  return path.join(process.cwd(), 'data', 'internfinder.db');
}

/**
 * True when the database must be treated as read-only.
 *
 * Serverless hosts (Vercel, Lambda) give a function a read-only filesystem, so
 * the catalog can be built at deploy time and served, but nothing can be
 * written back. The app degrades to a browse-only mode rather than failing.
 * Set INTERNFINDER_READONLY=0 to override the auto-detection.
 */
export function isReadOnly(): boolean {
  const flag = env('INTERNFINDER_READONLY');
  if (flag === '0') return false;
  if (flag) return true;
  // During the build itself we need writes, so only lock down at runtime.
  return env('VERCEL') === '1' && env('NEXT_PHASE') !== 'phase-production-build';
}

/**
 * Opens (and on first call, creates) the local SQLite database.
 * The connection is cached for the lifetime of the process.
 */
export function getDb(): DB {
  if (cached) return cached;

  const file = dbPath();
  const readonly = isReadOnly();

  if (readonly) {
    if (!fs.existsSync(file)) {
      throw new Error(
        `No database found at ${file}. In read-only mode the catalog must be built ` +
          `before deploy (npm run sync).`,
      );
    }
    // No schema exec, no WAL: both need write access.
    const db = new Database(file, { readonly: true, fileMustExist: true });
    cached = db;
    return db;
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(fs.readFileSync(resolveSchemaPath(), 'utf8'));

  seedProfileRow(db);

  cached = db;
  return db;
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
