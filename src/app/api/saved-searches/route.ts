import { fail, handler, ok, readJson, requireUserId } from '@/lib/api';
import { parseSearchParams, searchInternships, toSearchParams } from '@/lib/query';
import { createSavedSearch, getProfile, listSavedSearches } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/saved-searches
 *
 * Each saved search is re-run to report how many results it has now and how
 * many are new since you last opened it, which is what makes saved searches
 * useful as a standing alert rather than a bookmark.
 */
export const GET = handler(async () => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const profile = await getProfile(auth);
  const rows = await listSavedSearches(auth);
  const searches = await Promise.all(
    rows.map(async (row) => {
      const params = new URLSearchParams(row.query_json);
      const query = parseSearchParams(params);
      const total = (await searchInternships({ ...query, limit: 1, page: 1 }, profile, auth)).total;

      // "New" means posted since the last time this search was viewed.
      const fresh = row.last_seen_at
        ? (
            await searchInternships(
              {
                ...query,
                limit: 1,
                page: 1,
                postedWithinDays: Math.max(1, Math.ceil((Date.now() / 1000 - row.last_seen_at) / 86400)),
              },
              profile,
              auth,
            )
          ).total
        : 0;

      return { ...row, query: params.toString(), total, newCount: fresh };
    }),
  );
  return ok({ searches });
});

/** POST /api/saved-searches: save the current filter set. */
export const POST = handler(async (request: Request) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const body = await readJson(request);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!name) return fail('name is required', 422);

  // Normalize through the parser so stored queries are always canonical.
  const raw = typeof body.query === 'string' ? body.query : '';
  const canonical = toSearchParams(parseSearchParams(new URLSearchParams(raw))).toString();

  const search = await createSavedSearch(auth, name, canonical, body.alert !== false);
  return ok({ search }, { status: 201 });
});
