import { fail, handler, ok, parseId, readJson } from '@/lib/api';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/sources/:id — enable or disable a source, or rename it. */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);

  const body = await readJson(request);
  const db = getDb();

  if (typeof body.enabled === 'boolean') {
    db.prepare('UPDATE source_configs SET enabled = ? WHERE id = ?').run(body.enabled ? 1 : 0, id);
  }
  if (typeof body.label === 'string' && body.label.trim()) {
    db.prepare('UPDATE source_configs SET label = ? WHERE id = ?').run(body.label.trim(), id);
  }

  const source = db.prepare('SELECT * FROM source_configs WHERE id = ?').get(id);
  if (!source) return fail('Source not found', 404);
  return ok({ source });
});

/**
 * DELETE /api/sources/:id
 *
 * Listings already collected from the source are kept — deleting a source stops
 * future fetches, it does not erase history.
 */
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);
  const changes = getDb().prepare('DELETE FROM source_configs WHERE id = ?').run(id).changes;
  if (changes === 0) return fail('Source not found', 404);
  return ok({ deleted: true });
});
