import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { withAuthTimeout } from '@/lib/supabase/timeout';

/**
 * Paths reachable without a signed-in session.
 *
 * The two API routes carry their own credentials and cannot present a session
 * cookie: the calendar feed is fetched by calendar apps with a per-account
 * token in the URL, and the cron entrypoint is called by Vercel with
 * `CRON_SECRET`. Each still authorizes itself internally.
 */
const PUBLIC_PATHS = ['/login', '/auth', '/api/calendar', '/api/cron'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Requires an account, and keeps the Supabase session fresh.
 *
 * Expired access tokens are refreshed here and the new cookies attached to both
 * the forwarded request and the response, so server components always see a
 * live session. Requests without one are turned away before reaching any page
 * or data route: browsers are sent to /login with a `next` parameter so they
 * land back where they were headed, and API callers get a 401 rather than a
 * redirect they cannot follow.
 *
 * Failing closed is deliberate: when Supabase is unconfigured nobody can be
 * authenticated, so nothing but the public paths should be served.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  // A failed email link is bounced by Supabase to the project's Site URL, which
  // is the home page, a page that requires a session, so the reason would
  // otherwise be swallowed by the redirect to /login. Carry it to the confirm
  // screen instead, which knows how to explain it.
  if (searchParams.has('error_code') && !pathname.startsWith('/auth/confirm')) {
    const confirm = new URL('/auth/confirm', request.url);
    const description = searchParams.get('error_description') ?? searchParams.get('error');
    if (description) confirm.searchParams.set('error_description', description);
    return NextResponse.redirect(confirm);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return isPublic(pathname) ? response : deny(request, pathname, search);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Triggers the refresh when the access token has expired. Capped, because a
  // failing Auth server makes supabase-js retry for longer than middleware may
  // run, and a hung middleware is a 504 on every page of the site.
  let user;
  try {
    ({
      data: { user },
    } = await withAuthTimeout(supabase.auth.getUser()));
  } catch (error) {
    console.error('[middleware] session check failed:', error);
    if (isPublic(pathname)) return response;
    return unavailable(pathname);
  }

  if (!user && !isPublic(pathname)) return deny(request, pathname, search);

  return response;
}

/** Turn away an unauthenticated request in whatever form its caller understands. */
function deny(request: NextRequest, pathname: string, search: string) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  }
  const login = new URL('/login', request.url);
  login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

/**
 * Supabase Auth could not be reached, so we can't tell whether this visitor is
 * signed in. Say so plainly instead of bouncing a signed-in user to /login,
 * where signing in would fail for the same reason.
 */
function unavailable(pathname: string) {
  const message = 'InternIndex is having trouble reaching its sign-in service. Please try again in a minute.';
  const headers = { 'Retry-After': '60', 'Cache-Control': 'no-store' };
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: message }, { status: 503, headers });
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Temporarily unavailable</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:20vh auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.25rem">Temporarily unavailable</h1><p>${message}</p><p><a href="">Reload</a></p></body></html>`;
  return new NextResponse(html, {
    status: 503,
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export const config = {
  // Skip static assets; every page and API route participates.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
