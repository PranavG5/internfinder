import { createSupabaseServer } from './supabase/server';

export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * The signed-in user for the current request, or null.
 *
 * Uses `getUser()`, which validates the session against Supabase rather than
 * trusting the cookie contents. This id is what scopes every per-user query,
 * so it must be verified.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServer();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

export async function getUserId(): Promise<string | null> {
  return (await getAuthUser())?.id ?? null;
}
