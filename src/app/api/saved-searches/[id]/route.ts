import { fail, handler, ok, parseId, readJson, requireUserId } from '@/lib/api';
import { exec, one } from '@/lib/db';
import { deleteSavedSearch, touchSavedSearch } from '@/lib/repo';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/saved-searches/:id: rename, toggle alerts, or mark as seen. */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);

  const body = await readJson(request);

  if (body.seen === true) await touchSavedSearch(auth, id);
  if (typeof body.name === 'string' && body.name.trim()) {
    await exec('UPDATE saved_searches SET name = ? WHERE id = ? AND user_id = ?', [
      body.name.trim().slice(0, 80),
      id,
      auth,
    ]);
  }
  if (typeof body.alert === 'boolean') {
    await exec('UPDATE saved_searches SET alert = ? WHERE id = ? AND user_id = ?', [
      body.alert ? 1 : 0,
      id,
      auth,
    ]);
  }

  const search = await one('SELECT * FROM saved_searches WHERE id = ? AND user_id = ?', [id, auth]);
  if (!search) return fail('Saved search not found', 404);
  return ok({ search });
});

/** DELETE /api/saved-searches/:id */
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);
  if (!(await deleteSavedSearch(auth, id))) return fail('Saved search not found', 404);
  return ok({ deleted: true });
});
