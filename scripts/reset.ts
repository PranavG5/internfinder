/**
 * Clear catalog data so the next sync starts fresh.
 *
 *   npm run db:reset -- --catalog --yes   # wipe listings only, keep user data
 *   npm run db:reset -- --yes             # wipe listings AND every user's tracker data
 *
 * User accounts themselves live in Supabase Auth and are never touched here.
 */
import { closePool, exec, one } from '../src/lib/db';

async function main() {
  const args = process.argv.slice(2);
  const confirmed = args.includes('--yes') || args.includes('-y');
  const catalogOnly = args.includes('--catalog');

  if (!confirmed) {
    console.error(
      catalogOnly
        ? 'This clears every internship listing (user data is kept). Re-run with --yes to confirm.'
        : 'This clears the catalog AND every user\'s applications, notes, and bookmarks.\nRe-run with --yes to confirm.',
    );
    process.exit(1);
  }

  const before = (await one<{ n: number }>('SELECT COUNT(*) AS n FROM internships'))?.n ?? 0;

  if (!catalogOnly) {
    await exec('DELETE FROM applications');
    await exec('DELETE FROM saved_searches');
  }

  // Applications keep their own copy of company/role, so clearing the catalog
  // only detaches the link rather than losing tracked work.
  await exec('DELETE FROM internships');
  await exec('DELETE FROM sync_runs');
  await exec('UPDATE source_configs SET last_sync_at = NULL, last_count = NULL, last_error = NULL');

  console.log(`Cleared ${before.toLocaleString()} listings.`);
  console.log('Run `npm run sync` to rebuild the catalog.');
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
