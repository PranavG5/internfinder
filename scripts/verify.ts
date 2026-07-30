/**
 * Open every application link and close the ones that are dead.
 *
 * This is the strongest "is it still open?" check available, but it costs one
 * HTTP request per listing, so it runs in bounded batches over the
 * least-recently-checked rows.
 *
 *   npm run verify              # 100 listings
 *   npm run verify -- 500       # 500 listings
 *   npm run verify -- 200 --concurrency 8
 */
import { verifyLinks } from '../src/lib/sync';

async function main() {
  const positional = process.argv.slice(2).find((a) => /^\d+$/.test(a));
  const limit = positional ? Number(positional) : 100;

  const concurrencyIndex = process.argv.indexOf('--concurrency');
  const concurrency =
    concurrencyIndex !== -1 ? Number(process.argv[concurrencyIndex + 1]) || 5 : 5;

  console.log(`Verifying up to ${limit} application links (concurrency ${concurrency})…`);

  const result = await verifyLinks(limit, {
    concurrency,
    onProgress: (message) => console.log(`  ${message}`),
  });

  console.log('\n─── Verification summary ─────────────────────');
  console.log(`  Checked      : ${result.checked}`);
  console.log(`  Still open   : ${result.alive}`);
  console.log(`  Closed       : ${result.closed}`);
  console.log(`  Unreachable  : ${result.errors} (left alone — a network blip is not a closure)`);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
