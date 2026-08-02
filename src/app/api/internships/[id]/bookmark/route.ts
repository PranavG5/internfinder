import { handler, ok, readJson, requireUserId } from '@/lib/api';
import { toggleBookmark } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** POST /api/internships/:id/bookmark — toggle the shortlist flag. */
export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const auth = await requireUserId();
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const body = await readJson(request);
    const bookmarked = await toggleBookmark(auth, id, typeof body.note === 'string' ? body.note : undefined);
    return ok({ bookmarked });
  },
);
