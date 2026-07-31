import { handler, ok, readJson, readOnlyBlock } from '@/lib/api';
import { getDb } from '@/lib/db';
import { catalogStats } from '@/lib/query';
import { runSync, verifyLinks } from '@/lib/sync';

export const dynamic = 'force-dynamic';
// A full sweep across every job board takes a while; allow for it.
export const maxDuration = 300;

/** GET /api/sync — recent runs and catalog totals. */
export const GET = handler(async () => {
  const runs = getDb()
    .prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 10')
    .all() as Record<string, unknown>[];
  return ok({ runs, stats: catalogStats() });
});

/**
 * POST /api/sync — refresh the catalog.
 *
 * Body options:
 *   kinds       string[]  restrict to source kinds, e.g. ["github","greenhouse"]
 *   maxBoards   number    cap on company boards touched (default 40, keeps it snappy)
 *   verify      number    also link-check this many listings afterwards
 */
export const POST = handler(async (request: Request) => {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;

  const body = await readJson(request);

  const kinds =
    Array.isArray(body.kinds) && body.kinds.length > 0 ? body.kinds.map(String) : undefined;
  const maxBoardsRaw = Number(body.maxBoards);
  const maxBoards = Number.isFinite(maxBoardsRaw) ? Math.max(0, Math.min(400, maxBoardsRaw)) : 40;
  const verifyRaw = Number(body.verify);
  const verifyCount = Number.isFinite(verifyRaw) ? Math.max(0, Math.min(500, verifyRaw)) : 0;

  // Link verification is useful on its own — it's the strongest openness check
  // and doesn't need a fetch pass first.
  if (body.verifyOnly === true) {
    const verified = await verifyLinks(verifyCount || 100);
    return ok({
      result: {
        durationMs: 0,
        inserted: 0,
        updated: 0,
        closed: verified.closed,
        duplicates: 0,
        discovered: 0,
        sources: [],
      },
      verified,
      stats: catalogStats(),
    });
  }

  const result = await runSync({
    kinds,
    maxBoards,
    trigger: 'web',
    noDiscover: body.noDiscover === true,
  });

  const verified = verifyCount > 0 ? await verifyLinks(verifyCount) : null;

  return ok({ result, verified, stats: catalogStats() });
});
