/**
 * How long a request may wait on Supabase Auth before we give up.
 *
 * When Auth is unhealthy (for example the database is in read-only mode and
 * every token refresh returns a 500), supabase-js keeps retrying the refresh
 * with backoff for about 30 seconds. That is longer than Vercel lets
 * middleware run, so without a cap one sick dependency takes the whole site
 * down with a 504 instead of failing a single sign-in check.
 */
export const AUTH_TIMEOUT_MS = 5000;

export class AuthTimeoutError extends Error {
  constructor() {
    super(`Supabase Auth did not answer within ${AUTH_TIMEOUT_MS}ms`);
    this.name = 'AuthTimeoutError';
  }
}

/** Resolve with `promise`, or reject with AuthTimeoutError once `ms` passes. */
export function withAuthTimeout<T>(promise: Promise<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AuthTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
