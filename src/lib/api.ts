import { NextResponse } from 'next/server';
import { getUserId } from './auth';

/**
 * Guard for routes that touch per-user data. Browsing the catalog is open to
 * everyone; saving anything requires an account, and the 401 body carries a
 * flag so the UI can offer the sign-in flow instead of a bare error.
 */
export async function requireUserId(): Promise<string | Response> {
  const userId = await getUserId();
  if (userId) return userId;
  return NextResponse.json(
    {
      error: 'Sign in to save things. Your profile, shortlist, and applications are stored per account.',
      authRequired: true,
    },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Standard JSON success response. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...(init?.headers ?? {}) },
  });
}

/** Standard JSON error response. */
export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Parse a JSON request body, returning `{}` rather than throwing on bad input. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Wrap a handler so unexpected errors become a 500 instead of an opaque crash. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response> | Response,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[api]', message, err);
      return fail(message, 500);
    }
  };
}

export function parseId(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
