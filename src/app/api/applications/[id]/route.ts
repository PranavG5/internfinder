import { fail, handler, ok, parseId, readJson, readOnlyBlock } from '@/lib/api';
import {
  deleteApplication,
  getApplication,
  listChildren,
  listEvents,
  updateApplication,
} from '@/lib/repo';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/applications/:id — the application plus its timeline and children. */
export const GET = handler(async (_request: Request, { params }: Ctx) => {
  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);

  const application = getApplication(id);
  if (!application) return fail('Application not found', 404);

  return ok({
    application,
    events: listEvents(id),
    interviews: listChildren('interviews', id),
    contacts: listChildren('contacts', id),
    offers: listChildren('offers', id),
    tasks: listChildren('tasks', id),
  });
});

/** PATCH /api/applications/:id — update fields; status changes are logged. */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);

  const application = updateApplication(id, await readJson(request));
  if (!application) return fail('Application not found', 404);
  return ok({ application });
});

/** DELETE /api/applications/:id */
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);
  if (!deleteApplication(id)) return fail('Application not found', 404);
  return ok({ deleted: true });
});
