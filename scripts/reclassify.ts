/**
 * Re-run the field classifier over listings already in the catalog.
 *
 *   npm run reclassify                                # move rows into Business Analytics
 *   npm run reclassify -- --field "Public Health"     # into any other field
 *   npm run reclassify -- --dry-run                   # report, change nothing
 *   npm run reclassify -- --force                     # even if this version already ran
 *
 * A sync reclassifies each listing whenever its board is fetched again, which
 * for a capped run can take a day or two to reach every board. This applies a
 * taxonomy change to the whole catalog at once.
 *
 * Only moves *into* the target field are applied. The catalog does not store
 * the category hints some feeds supply, so a blanket re-run would quietly move
 * rows that were classified on information it no longer has; restricting it
 * to the field that just changed keeps everything else exactly as it was.
 *
 * It reads every open listing's description, so it runs once per
 * CLASSIFIER_VERSION and is a no-op after that, which is what lets the
 * scheduled sync call it on every run.
 *
 * Writes to the Postgres database in SUPABASE_DB_URL (or DATABASE_URL).
 */
import { closePool, exec, meta, q, setMeta } from '../src/lib/db';
import { CLASSIFIER_VERSION, classifyField } from '../src/lib/parse/field';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : 'true';
}

const BATCH = 2000;

async function main() {
  const target = arg('field') ?? 'Business Analytics';
  const dryRun = arg('dry-run') === 'true';
  const includeClosed = arg('include-closed') === 'true';
  const stamp = `reclassify:${target}`;

  if (arg('force') !== 'true' && (await meta(stamp)) === CLASSIFIER_VERSION) {
    console.log(`Classifier ${CLASSIFIER_VERSION} already applied to ${target}; nothing to do.`);
    await closePool();
    return;
  }

  let after = '';
  let scanned = 0;
  const moves = new Map<string, number>();
  let changed = 0;

  for (;;) {
    const rows = await q<{ id: string; title: string; description: string | null; field: string; role_family: string }>(
      `SELECT id, title, description, field, role_family FROM internships
       WHERE id > ? ${includeClosed ? '' : 'AND is_open = 1'}
       ORDER BY id LIMIT ?`,
      [after, BATCH],
    );
    if (rows.length === 0) break;
    after = rows[rows.length - 1].id;
    scanned += rows.length;

    const updates: { id: string; field: string; role_family: string }[] = [];
    for (const row of rows) {
      const next = classifyField(row.title, row.description ?? '');
      if (next.field !== target) continue;
      if (next.field === row.field && next.roleFamily === row.role_family) continue;
      updates.push({ id: row.id, field: next.field, role_family: next.roleFamily });
      const key = `${row.role_family} -> ${next.roleFamily}`;
      moves.set(key, (moves.get(key) ?? 0) + 1);
    }

    if (updates.length && !dryRun) {
      await exec(
        `UPDATE internships i SET field = u.field, role_family = u.role_family
         FROM unnest(?::text[], ?::text[], ?::text[]) AS u(id, field, role_family)
         WHERE i.id = u.id`,
        [updates.map((u) => u.id), updates.map((u) => u.field), updates.map((u) => u.role_family)],
      );
    }
    changed += updates.length;
  }

  if (!dryRun) await setMeta(stamp, CLASSIFIER_VERSION);
  console.log(`Scanned ${scanned.toLocaleString()} listings; ${changed.toLocaleString()} ${dryRun ? 'would move' : 'moved'} into ${target}.`);
  for (const [move, n] of [...moves].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${String(n).padStart(6)}  ${move}`);
  }
  await closePool();
}

main().catch((err) => {
  console.error('Reclassify failed:', err);
  process.exit(1);
});
