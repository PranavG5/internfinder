import { fail, handler, ok, readJson, requireUserId } from '@/lib/api';
import { one } from '@/lib/db';
import { createApplication, listApplications, type ApplicationFilters } from '@/lib/repo';
import type { Internship } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/applications: the tracker list. */
export const GET = handler(async (request: Request) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const filters: ApplicationFilters = {
    status: params.getAll('status').flatMap((s) => s.split(',')).filter(Boolean),
    archived: params.get('archived') === '1',
    q: params.get('q') ?? undefined,
    sort: (params.get('sort') as ApplicationFilters['sort']) ?? undefined,
  };
  return ok({ applications: await listApplications(auth, filters) });
});

/**
 * POST /api/applications: add an application.
 *
 * Passing `internship_id` copies the company, role, location, and deadline
 * straight off the catalog entry, so tracking a role you found in search takes
 * one click and stays linked to the listing.
 */
export const POST = handler(async (request: Request) => {
  const auth = await requireUserId();
  if (auth instanceof Response) return auth;

  const body = await readJson(request);

  let company = typeof body.company === 'string' ? body.company.trim() : '';
  let role = typeof body.role === 'string' ? body.role.trim() : '';
  const internshipId = typeof body.internship_id === 'string' ? body.internship_id : null;

  const prefill: Record<string, unknown> = {};
  if (internshipId) {
    const listing = await one<Internship>('SELECT * FROM internships WHERE id = ?', [internshipId]);
    if (!listing) return fail('Internship not found', 404);

    // Refuse to silently create a second tracker row for the same listing.
    const existing = await one<{ id: number }>(
      'SELECT id FROM applications WHERE internship_id = ? AND user_id = ?',
      [internshipId, auth],
    );
    if (existing && body.allow_duplicate !== true) {
      return fail('You are already tracking this internship', 409, {
        application_id: existing.id,
        duplicate: true,
      });
    }

    company ||= listing.company;
    role ||= listing.title;
    prefill.apply_url = listing.apply_url;
    prefill.location = listing.primary_location;
    prefill.season = listing.season;
    prefill.year = listing.year;
    prefill.field = listing.field;
    prefill.deadline = listing.deadline;
  }

  if (!company || !role) return fail('company and role are required', 422);

  const application = await createApplication(auth, {
    ...prefill,
    ...body,
    internship_id: internshipId,
    company,
    role,
  } as { company: string; role: string });

  return ok({ application }, { status: 201 });
});
