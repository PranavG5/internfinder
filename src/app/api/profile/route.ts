import { handler, ok, readJson, readOnlyBlock } from '@/lib/api';
import { getProfile, updateProfile } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** GET /api/profile */
export const GET = handler(async () => ok({ profile: getProfile() }));

/** PATCH /api/profile — drives fit scoring, eligibility filters, and defaults. */
export const PATCH = handler(async (request: Request) => {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;

  const profile = updateProfile(await readJson(request));
  return ok({ profile });
});
