/**
 * Delete the local database so the next run starts from a clean schema.
 *
 *   npm run db:reset -- --yes             # wipe everything
 *   npm run db:reset -- --catalog --yes   # wipe listings only, keep applications
 *
 * Your applications, notes, interviews, and profile live in the same file, so a
 * full reset is destructive and requires --yes.
 */
/**
 * CLI scripts always own the database file, even when VERCEL=1 marks the
 * runtime as read-only — the whole point of the build step is to write the
 * catalog before the serverless runtime takes over.
 */
process.env.INTERNFINDER_READONLY = '0';

import fs from 'node:fs';
import { dbPath, getDb } from '../src/lib/db';

const args = process.argv.slice(2);
const confirmed = args.includes('--yes') || args.includes('-y');
const catalogOnly = args.includes('--catalog');

if (!confirmed) {
  console.error(
    catalogOnly
      ? 'This clears every internship listing (your applications are kept). Re-run with --yes to confirm.'
      : `This deletes ${dbPath()} entirely — applications, notes, interviews, and profile included.\nRe-run with --yes to confirm.`,
  );
  process.exit(1);
}

if (catalogOnly) {
  const db = getDb();
  const before = (
    db.prepare('SELECT COUNT(*) AS n FROM internships').get() as { n: number }
  ).n;

  // Applications keep their own copy of company/role, so clearing the catalog
  // only detaches the link rather than losing tracked work.
  db.exec(`
    DELETE FROM internships;
    DELETE FROM bookmarks;
    DELETE FROM hidden_listings;
    DELETE FROM sync_runs;
    UPDATE source_configs SET last_sync_at = NULL, last_count = NULL, last_error = NULL;
  `);

  const apps = (db.prepare('SELECT COUNT(*) AS n FROM applications').get() as { n: number }).n;
  console.log(`Cleared ${before.toLocaleString()} listings. Kept ${apps} application(s).`);
  console.log('Run `npm run sync` to rebuild the catalog.');
} else {
  const file = dbPath();
  let removed = 0;
  for (const path of [file, `${file}-wal`, `${file}-shm`, `${file}-journal`]) {
    if (fs.existsSync(path)) {
      fs.rmSync(path);
      removed++;
    }
  }
  console.log(
    removed > 0
      ? `Deleted ${removed} database file(s). The schema is recreated on next start.`
      : 'No database file found — nothing to delete.',
  );
}
