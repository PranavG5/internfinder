import { handler, ok } from '@/lib/api';
import { getAuthUser } from '@/lib/auth';
import { catalogStats } from '@/lib/query';
import { dashboardStats } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** GET /api/stats — everything the dashboard needs in one call. */
export const GET = handler(async () => {
  const user = await getAuthUser();
  const [dashboard, catalog] = await Promise.all([
    user ? dashboardStats(user.id) : Promise.resolve(null),
    catalogStats(),
  ]);
  // `authenticated` lets the UI offer sign-in up front instead of letting the
  // user discover it by having a save fail.
  return ok({ dashboard, catalog, authenticated: !!user, email: user?.email ?? null });
});
