import { fail, handler, ok, readJson, requireUserId } from '@/lib/api';
import { createChild, listChildren, type ChildTable } from '@/lib/repo';

export const dynamic = 'force-dynamic';

const ALLOWED: ChildTable[] = ['interviews', 'contacts', 'offers', 'tasks'];

function validTable(raw: string): ChildTable | null {
  return ALLOWED.includes(raw as ChildTable) ? (raw as ChildTable) : null;
}

type Ctx = { params: Promise<{ table: string }> };

/** GET /api/children/:table?application_id=1: interviews, contacts, offers, or tasks. */
export const GET = handler(async (request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const table = validTable((await params).table);
  if (!table) return fail('Unknown collection', 404);

  const raw = new URL(request.url).searchParams.get('application_id');
  const applicationId = raw ? Number(raw) : undefined;
  if (raw && !Number.isInteger(applicationId)) return fail('Invalid application_id', 422);

  return ok({ items: await listChildren(table, auth, applicationId) });
});

/** POST /api/children/:table */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const table = validTable((await params).table);
  if (!table) return fail('Unknown collection', 404);

  const body = await readJson(request);
  if (table !== 'tasks' && !Number.isInteger(Number(body.application_id))) {
    return fail('application_id is required', 422);
  }
  if (table === 'contacts' && !String(body.name ?? '').trim()) {
    return fail('name is required', 422);
  }
  if (table === 'tasks' && !String(body.title ?? '').trim()) {
    return fail('title is required', 422);
  }

  const item = await createChild(table, auth, body);
  if (!item) return fail('Application not found', 404);
  return ok({ item }, { status: 201 });
});
