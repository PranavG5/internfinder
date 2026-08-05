import { fail, handler, ok, parseId, readJson, requireUserId } from '@/lib/api';
import { exec, one } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/sources/:id: enable or disable a source, or rename it. */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);

  const body = await readJson(request);

  if (typeof body.enabled === 'boolean') {
    await exec('UPDATE source_configs SET enabled = ? WHERE id = ?', [body.enabled ? 1 : 0, id]);
  }
  if (typeof body.label === 'string' && body.label.trim()) {
    await exec('UPDATE source_configs SET label = ? WHERE id = ?', [body.label.trim(), id]);
  }

  const source = await one('SELECT * FROM source_configs WHERE id = ?', [id]);
  if (!source) return fail('Source not found', 404);
  return ok({ source });
});

/**
 * DELETE /api/sources/:id
 *
 * Listings already collected from the source are kept, so deleting a source stops
 * future fetches, it does not erase history.
 */
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const id = parseId((await params).id);
  if (!id) return fail('Invalid id', 422);
  const changes = await exec('DELETE FROM source_configs WHERE id = ?', [id]);
  if (changes === 0) return fail('Source not found', 404);
  return ok({ deleted: true });
});
