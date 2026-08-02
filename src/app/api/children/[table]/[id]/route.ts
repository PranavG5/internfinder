import { fail, handler, ok, parseId, readJson, requireUserId } from '@/lib/api';
import { deleteChild, updateChild, type ChildTable } from '@/lib/repo';

export const dynamic = 'force-dynamic';

const ALLOWED: ChildTable[] = ['interviews', 'contacts', 'offers', 'tasks'];

type Ctx = { params: Promise<{ table: string; id: string }> };

async function resolve(params: Ctx['params']) {
  const { table, id } = await params;
  return {
    table: ALLOWED.includes(table as ChildTable) ? (table as ChildTable) : null,
    id: parseId(id),
  };
}

/** PATCH /api/children/:table/:id */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const { table, id } = await resolve(params);
  if (!table) return fail('Unknown collection', 404);
  if (!id) return fail('Invalid id', 422);
  return ok({ item: await updateChild(table, auth, id, await readJson(request)) });
});

/** DELETE /api/children/:table/:id */
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const { table, id } = await resolve(params);
  if (!table) return fail('Unknown collection', 404);
  if (!id) return fail('Invalid id', 422);
  if (!(await deleteChild(table, auth, id))) return fail('Not found', 404);
  return ok({ deleted: true });
});
