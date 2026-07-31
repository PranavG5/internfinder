import { fail, handler, ok, parseId, readJson, readOnlyBlock } from '@/lib/api';
import { getDb } from '@/lib/db';
import { deleteSavedSearch, touchSavedSearch } from '@/lib/repo';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/saved-searches/:id — rename, toggle alerts, or mark as seen. */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);

  const body = await readJson(request);
  const db = getDb();

  if (body.seen === true) touchSavedSearch(id);
  if (typeof body.name === 'string' && body.name.trim()) {
    db.prepare('UPDATE saved_searches SET name = ? WHERE id = ?').run(body.name.trim().slice(0, 80), id);
  }
  if (typeof body.alert === 'boolean') {
    db.prepare('UPDATE saved_searches SET alert = ? WHERE id = ?').run(body.alert ? 1 : 0, id);
  }

  const search = db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(id);
  if (!search) return fail('Saved search not found', 404);
  return ok({ search });
});

/** DELETE /api/saved-searches/:id */
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);
  if (!deleteSavedSearch(id)) return fail('Saved search not found', 404);
  return ok({ deleted: true });
});
