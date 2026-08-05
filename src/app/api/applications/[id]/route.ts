import { fail, handler, ok, parseId, readJson, requireUserId } from '@/lib/api';
import {
  deleteApplication,
  getApplication,
  listChildren,
  listEvents,
  updateApplication,
} from '@/lib/repo';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/applications/:id: the application plus its timeline and children. */
export const GET = handler(async (_request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);

  const application = await getApplication(auth, id);
  if (!application) return fail('Application not found', 404);

  const [events, interviews, contacts, offers, tasks] = await Promise.all([
    listEvents(auth, id),
    listChildren('interviews', auth, id),
    listChildren('contacts', auth, id),
    listChildren('offers', auth, id),
    listChildren('tasks', auth, id),
  ]);

  return ok({ application, events, interviews, contacts, offers, tasks });
});

/** PATCH /api/applications/:id: update fields. Status changes are logged. */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);

  const application = await updateApplication(auth, id, await readJson(request));
  if (!application) return fail('Application not found', 404);
  return ok({ application });
});

/** DELETE /api/applications/:id */
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);
  if (!(await deleteApplication(auth, id))) return fail('Application not found', 404);
  return ok({ deleted: true });
});
