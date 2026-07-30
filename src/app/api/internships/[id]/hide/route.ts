import { handler, ok, readJson } from '@/lib/api';
import { hideListing, unhideListing } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** POST /api/internships/:id/hide — dismiss a listing so it stops appearing. */
export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await readJson(request);
    hideListing(id, typeof body.reason === 'string' ? body.reason : undefined);
    return ok({ hidden: true });
  },
);

/** DELETE /api/internships/:id/hide — undo a dismissal. */
export const DELETE = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    unhideListing(id);
    return ok({ hidden: false });
  },
);
