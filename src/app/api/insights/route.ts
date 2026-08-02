import { handler, ok, requireUserId } from '@/lib/api';
import { insights, offerComparison } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** GET /api/insights — conversion breakdowns and offer comparison. */
export const GET = handler(async () => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;
  const [data, offers] = await Promise.all([insights(auth), offerComparison(auth)]);
  return ok({ insights: data, offers });
});
