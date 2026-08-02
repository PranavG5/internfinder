import { redirect } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Lands email links (signup confirmation, password recovery, magic links).
 * Verifies the one-time token and redirects into the app with a session set.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = url.searchParams.get('next') ?? '/';

  if (tokenHash && type) {
    const supabase = await createSupabaseServer();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) redirect(next.startsWith('/') ? next : '/');
    }
  }

  redirect('/login?error=confirm');
}
