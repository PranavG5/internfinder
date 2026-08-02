/**
 * Fetch open internships from every configured source.
 *
 *   npm run sync                          # everything
 *   npm run sync -- --kinds github        # only the GitHub community lists
 *   npm run sync -- --only greenhouse:figma
 *   npm run sync -- --max-boards 25       # cap ATS boards touched this run
 *   npm run sync -- --verify 200          # then link-check 200 listings
 *
 * Writes to the Postgres database in SUPABASE_DB_URL (or DATABASE_URL).
 */
import { runSync, verifyLinks } from '../src/lib/sync';
import { closePool, one } from '../src/lib/db';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : 'true';
}

async function main() {
  const kinds = arg('kinds')?.split(',').map((s) => s.trim()).filter(Boolean);
  const only = arg('only')?.split(',').map((s) => s.trim()).filter(Boolean);
  const maxBoards = arg('max-boards') ? Number(arg('max-boards')) : undefined;
  const concurrency = arg('concurrency') ? Number(arg('concurrency')) : undefined;
  const verifyCount = arg('verify') ? Number(arg('verify') === 'true' ? 100 : arg('verify')) : 0;

  const started = Date.now();
  const result = await runSync({
    kinds,
    only,
    maxBoards: Number.isFinite(maxBoards) ? maxBoards : undefined,
    concurrency: Number.isFinite(concurrency) ? concurrency : undefined,
    noDiscover: arg('no-discover') === 'true',
    trigger: 'cli',
    onProgress: (message) => console.log(message),
  });

  console.log('\n─── Sync summary ─────────────────────────────');
  console.log(`  Internships found : ${result.found.toLocaleString()}`);
  console.log(`  New               : ${result.inserted.toLocaleString()}`);
  console.log(`  Refreshed         : ${result.updated.toLocaleString()}`);
  console.log(`  Reopened          : ${result.reopened.toLocaleString()}`);
  console.log(`  Closed            : ${result.closed.toLocaleString()}`);
  console.log(`  Duplicates merged : ${result.duplicates.toLocaleString()}`);
  console.log(`  Boards discovered : ${result.discovered.toLocaleString()}`);
  console.log(`  Sources OK        : ${result.sources.filter((s) => s.ok).length}/${result.sources.length}`);
  console.log(`  Duration          : ${(result.durationMs / 1000).toFixed(1)}s`);

  if (result.errors.length) {
    console.log(`\n  ${result.errors.length} source error(s):`);
    for (const error of result.errors.slice(0, 15)) console.log(`    · ${error}`);
  }

  const open = await one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM internships WHERE is_open = 1 AND duplicate_of IS NULL',
  );
  console.log(`\n  Open internships in catalog: ${(open?.n ?? 0).toLocaleString()}`);

  if (verifyCount > 0) {
    console.log(`\nVerifying ${verifyCount} application links…`);
    const v = await verifyLinks(verifyCount, { onProgress: (m) => console.log(`  ${m}`) });
    console.log(`  ${v.alive} alive · ${v.closed} closed · ${v.errors} unreachable`);
  }

  await closePool();
  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
