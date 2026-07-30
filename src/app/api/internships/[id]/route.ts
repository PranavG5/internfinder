import { fail, handler, ok } from '@/lib/api';
import { getDb } from '@/lib/db';
import { toView } from '@/lib/query';
import { getProfile } from '@/lib/repo';
import type { Internship } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/internships/:id — one listing, with fit and tracker state. */
export const GET = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const row = getDb().prepare('SELECT * FROM internships WHERE id = ?').get(id) as
      | Internship
      | undefined;
    if (!row) return fail('Internship not found', 404);
    return ok(toView(row, getProfile()));
  },
);
