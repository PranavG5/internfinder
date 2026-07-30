import { handler, ok } from '@/lib/api';
import { computeFacets, parseSearchParams } from '@/lib/query';
import { getProfile } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/internships/facets — counts for every filter value.
 * Each facet ignores its own filter so the numbers answer "what if I picked
 * this instead of my current choice".
 */
export const GET = handler(async (request: Request) => {
  const url = new URL(request.url);
  const query = parseSearchParams(url.searchParams);
  return ok(computeFacets(query, getProfile()));
});
