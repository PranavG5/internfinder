import { handler, ok, readJson, readOnlyBlock } from '@/lib/api';
import { toggleBookmark } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** POST /api/internships/:id/bookmark — toggle the shortlist flag. */
export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;

    const { id } = await params;
    const body = await readJson(request);
    const bookmarked = toggleBookmark(id, typeof body.note === 'string' ? body.note : undefined);
    return ok({ bookmarked });
  },
);
