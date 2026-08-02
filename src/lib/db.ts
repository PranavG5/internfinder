import { Pool, types, type PoolClient } from 'pg';

/**
 * Postgres connection layer (Supabase).
 *
 * The app carries two SQLite-era conventions on purpose, so the query code
 * stays small and portable:
 *   - timestamps are unix seconds in bigint columns
 *   - boolean-ish flags are 0/1 smallints
 *
 * int8/numeric come back as JS numbers (values here are unix seconds and
 * counts, all far below 2^53), and queries are written with `?` placeholders
 * which are rewritten to `$n` before execution.
 */

// int8 (counts, unix seconds) and numeric → number.
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => parseFloat(v));

let pool: Pool | null = null;

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

export function databaseUrl(): string {
  const url = env('SUPABASE_DB_URL') ?? env('DATABASE_URL');
  if (!url) {
    throw new Error(
      'No database configured. Set SUPABASE_DB_URL (or DATABASE_URL) to your Supabase ' +
        'Postgres connection string — Dashboard → Connect → Session pooler. ' +
        'Locally you can point it at any Postgres 14+ database.',
    );
  }
  return url;
}

/** True when talking to a local (non-TLS) database. */
function isLocalUrl(url: string): boolean {
  return /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || !/@/.test(url);
}

export function getPool(): Pool {
  if (pool) return pool;
  const url = databaseUrl();
  pool = new Pool({
    connectionString: url,
    max: Number(env('INTERNINDEX_PG_POOL') ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Supabase requires TLS; its chain is not in the default trust store.
    ssl: isLocalUrl(url) ? undefined : { rejectUnauthorized: false },
  });
  return pool;
}

/** Rewrite `?` placeholders to Postgres `$1, $2, …`. */
export function toDollarParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

/** Run a query and return all rows. */
export async function q<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  client: Queryable = getPool(),
): Promise<T[]> {
  const result = await client.query(toDollarParams(sql), params as unknown[]);
  return result.rows as T[];
}

/** Run a query and return the first row, or null. */
export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  client: Queryable = getPool(),
): Promise<T | null> {
  const rows = await q<T>(sql, params, client);
  return rows[0] ?? null;
}

/** Run a statement and return the affected-row count. */
export async function exec(
  sql: string,
  params: unknown[] = [],
  client: Queryable = getPool(),
): Promise<number> {
  const result = await client.query(toDollarParams(sql), params as unknown[]);
  return result.rowCount ?? 0;
}

/** Run `fn` inside a transaction on a dedicated connection. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The original error is the one worth reporting.
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Close the pool (used by CLI scripts so the process can exit). */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export async function meta(key: string): Promise<string | null> {
  const row = await one<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await exec(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
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
