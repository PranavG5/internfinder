import { handler, ok } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { parseSearchParams, searchInternships } from '@/lib/query';
import { getProfile } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** GET /api/internships — faceted search over open internships. */
export const GET = handler(async (request: Request) => {
  const url = new URL(request.url);
  const query = parseSearchParams(url.searchParams);
  const userId = await getUserId();
  const profile = userId ? await getProfile(userId) : null;
  const result = await searchInternships(query, profile, userId);
  return ok({ ...result, query });
});
