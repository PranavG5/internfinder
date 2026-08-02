import { handler, ok, readJson, requireUserId } from '@/lib/api';
import { getProfile, updateProfile } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** GET /api/profile */
export const GET = handler(async () => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;
  return ok({ profile: await getProfile(auth) });
});

/** PATCH /api/profile — drives fit scoring, eligibility filters, and defaults. */
export const PATCH = handler(async (request: Request) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const profile = await updateProfile(auth, await readJson(request));
  return ok({ profile });
});
