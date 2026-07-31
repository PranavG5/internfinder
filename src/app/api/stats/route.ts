import { handler, ok } from '@/lib/api';
import { isReadOnly } from '@/lib/db';
import { catalogStats } from '@/lib/query';
import { dashboardStats } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** GET /api/stats — everything the dashboard needs in one call. */
export const GET = handler(async () =>
  // `readOnly` lets the UI explain up front that saving is unavailable, rather
  // than letting the user discover it by having a click fail.
  ok({ dashboard: dashboardStats(), catalog: catalogStats(), readOnly: isReadOnly() }),
);
