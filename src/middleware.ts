import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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
 * Failing closed is deliberate — when Supabase is unconfigured nobody can be
 * authenticated, so nothing but the public paths should be served.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

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

  // Triggers the refresh when the access token has expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

export const config = {
  // Skip static assets; every page and API route participates.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
