import { handler, ok } from '@/lib/api';
import { catalogStats } from '@/lib/query';
import { dashboardStats } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** GET /api/stats — everything the dashboard needs in one call. */
export const GET = handler(async () =>
  ok({ dashboard: dashboardStats(), catalog: catalogStats() }),
);
