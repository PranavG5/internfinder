import { handler, ok } from '@/lib/api';
import { insights, offerComparison } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** GET /api/insights — conversion breakdowns and offer comparison. */
export const GET = handler(async () => ok({ insights: insights(), offers: offerComparison() }));
