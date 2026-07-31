import { NextResponse } from 'next/server';
import { isReadOnly } from './db';

/**
 * Guard for routes that write. On a read-only deployment the catalog is served
 * from a build-time snapshot, so saving is impossible — say so plainly instead
 * of surfacing a SQLite error.
 */
export function readOnlyBlock(): Response | null {
  if (!isReadOnly()) return null;
  return NextResponse.json(
    {
      error:
        'This is a read-only demo — browsing and filtering work, but nothing can be saved. Run InternFinder locally to track applications.',
      readOnly: true,
    },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
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
