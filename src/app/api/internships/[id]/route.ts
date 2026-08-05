import { fail, handler, ok } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { one } from '@/lib/db';
import { toViews } from '@/lib/query';
import { getProfile } from '@/lib/repo';
import type { Internship } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/internships/:id: one listing, with fit and tracker state. */
export const GET = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const row = await one<Internship>('SELECT * FROM internships WHERE id = ?', [id]);
    if (!row) return fail('Internship not found', 404);

    const userId = await getUserId();
    const profile = userId ? await getProfile(userId) : null;
    const [view] = await toViews([row], profile, userId);
    return ok(view);
  },
);
