import { fail, handler, ok, readJson, readOnlyBlock } from '@/lib/api';
import { getDb, nowSec } from '@/lib/db';
import { boardFromUrl } from '@/lib/sources/seed';
import { ensureSeedSources } from '@/lib/sync';

export const dynamic = 'force-dynamic';

const KINDS = ['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'github', 'remoteok', 'arbeitnow'];

/** GET /api/sources — every configured source with its last sync outcome. */
export const GET = handler(async () => {
  const db = getDb();
  ensureSeedSources(db);

  const sources = db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM internships i
                WHERE i.is_open = 1 AND i.duplicate_of IS NULL
                  AND (i.source = s.kind || ':' || s.token OR i.source = s.kind)) AS open_count
       FROM source_configs s
       ORDER BY s.enabled DESC, open_count DESC, s.kind, s.token`,
    )
    .all() as Record<string, unknown>[];

  return ok({ sources });
});

/**
 * POST /api/sources — track a new job board.
 *
 * Accepts either an explicit `{ kind, token }` or a `url` pasted straight from
 * a company's careers page, which is parsed into the right board.
 */
export const POST = handler(async (request: Request) => {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;

  const body = await readJson(request);
  const db = getDb();

  let kind = typeof body.kind === 'string' ? body.kind.toLowerCase() : '';
  let token = typeof body.token === 'string' ? body.token.trim() : '';
  let label = typeof body.label === 'string' ? body.label.trim() : '';

  if (typeof body.url === 'string' && body.url.trim()) {
    const detected = boardFromUrl(body.url.trim());
    if (!detected) {
      return fail(
        'Could not recognize that URL. Supported boards: Greenhouse, Lever, Ashby, SmartRecruiters.',
        422,
      );
    }
    kind = detected.kind;
    token = detected.token;
    label ||= detected.label;
  }

  if (!KINDS.includes(kind)) return fail(`kind must be one of: ${KINDS.join(', ')}`, 422);
  if (!token) return fail('token is required', 422);
  label ||= token;

  const result = db
    .prepare(
      `INSERT INTO source_configs (kind, token, label, enabled, created_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(kind, token) DO UPDATE SET enabled = 1, label = excluded.label`,
    )
    .run(kind, token, label, nowSec());

  const source = db
    .prepare('SELECT * FROM source_configs WHERE kind = ? AND token = ?')
    .get(kind, token);

  return ok({ source, created: result.changes > 0 }, { status: 201 });
});
