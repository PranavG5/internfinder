import { handler, ok, readJson, requireUserId } from '@/lib/api';
import { q } from '@/lib/db';
import { catalogStats } from '@/lib/query';
import { runSync, sweepLifecycle, verifyLinks } from '@/lib/sync';

export const dynamic = 'force-dynamic';
// A full sweep across every job board takes a while; allow for it.
export const maxDuration = 300;

/** GET /api/sync — recent runs and catalog totals. */
export const GET = handler(async () => {
  const [runs, stats] = await Promise.all([
    q('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 10'),
    catalogStats(),
  ]);
  return ok({ runs, stats });
});

/** True for requests fired by the Vercel cron scheduler (or with the shared secret). */
function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * POST /api/sync — refresh the catalog.
 *
 * Callable by any signed-in user, or by a scheduler carrying CRON_SECRET.
 *
 * Body options:
 *   kinds       string[]  restrict to source kinds, e.g. ["github","greenhouse"]
 *   maxBoards   number    cap on company boards touched (default 40, keeps it snappy)
 *   verify      number    also link-check this many listings afterwards
 */
export const POST = handler(async (request: Request) => {
  if (!isCronRequest(request)) {
    const auth = await requireUserId();
    if (auth instanceof Response) return auth;
  }

  const body = await readJson(request);

  const kinds =
    Array.isArray(body.kinds) && body.kinds.length > 0 ? body.kinds.map(String) : undefined;
  const maxBoardsRaw = Number(body.maxBoards);
  const maxBoards = Number.isFinite(maxBoardsRaw) ? Math.max(0, Math.min(400, maxBoardsRaw)) : 40;
  const verifyRaw = Number(body.verify);
  const verifyCount = Number.isFinite(verifyRaw) ? Math.max(0, Math.min(500, verifyRaw)) : 0;

  // Link verification is useful on its own — it's the strongest openness check
  // and doesn't need a fetch pass first. The lifecycle sweep rides along so
  // passed deadlines drop off even without a full sync.
  if (body.verifyOnly === true) {
    const expired = await sweepLifecycle();
    const verified = await verifyLinks(verifyCount || 100);
    return ok({
      result: {
        durationMs: 0,
        inserted: 0,
        updated: 0,
        closed: verified.closed + expired,
        duplicates: 0,
        discovered: 0,
        sources: [],
      },
      verified,
      stats: await catalogStats(),
    });
  }

  const result = await runSync({
    kinds,
    maxBoards,
    trigger: isCronRequest(request) ? 'cron' : 'web',
    noDiscover: body.noDiscover === true,
  });

  const verified = verifyCount > 0 ? await verifyLinks(verifyCount) : null;

  return ok({ result, verified, stats: await catalogStats() });
});
