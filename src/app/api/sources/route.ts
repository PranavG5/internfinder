import { fail, handler, ok, readJson, requireUserId } from '@/lib/api';
import { exec, nowSec, one, q } from '@/lib/db';
import { boardFromUrl, KIND_LABELS, SOURCE_KINDS } from '@/lib/sources/seed';
import { ensureSeedSources } from '@/lib/sync';

export const dynamic = 'force-dynamic';

/** GET /api/sources — every configured source with its last sync outcome. */
export const GET = handler(async () => {
  await ensureSeedSources();

  const sources = await q(
    `SELECT s.*,
            (SELECT COUNT(*) FROM internships i
              WHERE i.is_open = 1 AND i.duplicate_of IS NULL
                AND (i.source = s.kind || ':' || s.token OR i.source = s.kind)) AS open_count
     FROM source_configs s
     ORDER BY s.enabled DESC, open_count DESC, s.kind, s.token`,
  );

  return ok({ sources });
});

/**
 * POST /api/sources — track a new job board.
 *
 * Accepts either an explicit `{ kind, token }` or a `url` pasted straight from
 * a company's careers page, which is parsed into the right board.
 */
export const POST = handler(async (request: Request) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const body = await readJson(request);

  let kind = typeof body.kind === 'string' ? body.kind.toLowerCase() : '';
  let token = typeof body.token === 'string' ? body.token.trim() : '';
  let label = typeof body.label === 'string' ? body.label.trim() : '';

  if (typeof body.url === 'string' && body.url.trim()) {
    const detected = boardFromUrl(body.url.trim());
    if (!detected) {
      const providers = SOURCE_KINDS.filter((k) => KIND_LABELS[k] && k !== 'github')
        .map((k) => KIND_LABELS[k])
        .join(', ');
      return fail(`Could not recognize that URL. Supported boards: ${providers}.`, 422);
    }
    kind = detected.kind;
    token = detected.token;
    label ||= detected.label;
  }

  if (!SOURCE_KINDS.includes(kind)) return fail(`kind must be one of: ${SOURCE_KINDS.join(', ')}`, 422);
  if (!token) return fail('token is required', 422);
  label ||= token;

  const created = await exec(
    `INSERT INTO source_configs (kind, token, label, enabled, created_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT (kind, token) DO UPDATE SET enabled = 1, label = excluded.label`,
    [kind, token, label, nowSec()],
  );

  const source = await one('SELECT * FROM source_configs WHERE kind = ? AND token = ?', [kind, token]);

  return ok({ source, created: created > 0 }, { status: 201 });
});
