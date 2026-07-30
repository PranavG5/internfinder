import { handler, ok } from '@/lib/api';
import { parseSearchParams, searchInternships } from '@/lib/query';
import { getProfile } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** GET /api/internships — faceted search over open internships. */
export const GET = handler(async (request: Request) => {
  const url = new URL(request.url);
  const query = parseSearchParams(url.searchParams);
  const profile = getProfile();
  const result = searchInternships(query, profile);
  return ok({ ...result, query });
});
