import { fail, ok, handler } from '@/lib/api';
import { runSync, sweepLifecycle, verifyLinks } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/sync is the Vercel Cron entrypoint (cron invokes with GET).
 *
 * A deliberately bounded run so it fits a serverless time budget: the fast
 * feeds plus a small rotating slice of company boards, then the lifecycle
 * sweep and a link-check batch. The GitHub Actions workflow does the heavy
 * crawling; this keeps the catalog moving even without it.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when the
 * env var is set.
 */
export const GET = handler(async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return fail('Unauthorized', 401);
  }

  const result = await runSync({ maxBoards: 25, trigger: 'vercel-cron' });
  const expired = await sweepLifecycle();
  const verified = await verifyLinks(60, { concurrency: 8 });

  return ok({
    ok: result.ok,
    found: result.found,
    inserted: result.inserted,
    closed: result.closed + expired + verified.closed,
    verified,
  });
});
