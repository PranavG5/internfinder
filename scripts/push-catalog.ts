/**
 * Mirror the catalog from a local Postgres into a Supabase project over HTTPS.
 *
 * Useful when the machine that ran the sync cannot reach Supabase's Postgres
 * port directly (HTTPS-only egress). Goes through the `catalog_ingest` RPC,
 * which is guarded by the shared secret in app_meta('ingest_secret').
 *
 *   SOURCE_DB_URL=postgres://...local... \
 *   SUPABASE_URL=https://xyz.supabase.co \
 *   SUPABASE_ANON_KEY=... \
 *   INGEST_SECRET=... \
 *   npm run push-catalog
 */
import { Pool, types } from 'pg';

types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => parseFloat(v));

const SOURCE = process.env.SOURCE_DB_URL;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.INGEST_SECRET;

if (!SOURCE || !SUPABASE_URL || !ANON || !SECRET) {
  console.error('Set SOURCE_DB_URL, SUPABASE_URL, SUPABASE_ANON_KEY, and INGEST_SECRET.');
  process.exit(1);
}

const CHUNK = 250;

async function ingest(table: string, rows: Record<string, unknown>[]): Promise<number> {
  let pushed = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/catalog_ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON!,
        Authorization: `Bearer ${ANON}`,
      },
      body: JSON.stringify({ p_secret: SECRET, p_table: table, p_rows: chunk }),
    });
    if (!res.ok) {
      throw new Error(`${table} chunk ${i / CHUNK}: HTTP ${res.status} — ${await res.text()}`);
    }
    pushed += chunk.length;
    process.stdout.write(`\r  ${table}: ${pushed}/${rows.length}`);
  }
  if (rows.length) process.stdout.write('\n');
  return pushed;
}

async function main() {
  const pool = new Pool({ connectionString: SOURCE });

  const columns = async (table: string): Promise<string[]> =>
    (
      await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'
         ORDER BY ordinal_position`,
        [table],
      )
    ).rows.map((r) => r.column_name as string);

  for (const table of ['source_configs', 'internships', 'sync_runs']) {
    const cols = await columns(table);
    const { rows } = await pool.query(
      `SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM ${table}`,
    );
    console.log(`${table}: ${rows.length} rows`);
    await ingest(table, rows);
  }

  await pool.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
