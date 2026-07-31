import { fail, handler, ok, parseId, readJson, readOnlyBlock } from '@/lib/api';
import { addEvent, getApplication, listEvents } from '@/lib/repo';
import { EVENT_TYPES } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/applications/:id/events */
export const GET = handler(async (_request: Request, { params }: Ctx) => {
  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);
  return ok({ events: listEvents(id) });
});

/** POST /api/applications/:id/events — log a note, email, call, or milestone. */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);
  if (!getApplication(id)) return fail('Application not found', 404);

  const body = await readJson(request);
  const type = typeof body.type === 'string' && EVENT_TYPES.includes(body.type as never)
    ? body.type
    : 'note';

  const eventId = addEvent({
    application_id: id,
    type,
    title: typeof body.title === 'string' ? body.title : null,
    body: typeof body.body === 'string' ? body.body : null,
    occurred_at: typeof body.occurred_at === 'number' ? body.occurred_at : null,
  });

  return ok({ id: eventId, events: listEvents(id) }, { status: 201 });
});
