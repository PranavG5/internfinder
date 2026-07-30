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

export function dbPath(): string {
  if (process.env.INTERNFINDER_DB) return process.env.INTERNFINDER_DB;
  return path.join(process.cwd(), 'data', 'internfinder.db');
}

/**
 * Opens (and on first call, creates) the local SQLite database.
 * The connection is cached for the lifetime of the process.
 */
export function getDb(): DB {
  if (cached) return cached;

  const file = dbPath();
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
