import { redirect } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase/server';
import ConfirmClient from './confirm-client';

export const dynamic = 'force-dynamic';

/** Only allow same-origin paths through, so `next` can't be used as an open redirect. */
function safeNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/**
 * Lands email links (signup confirmation, password recovery, magic links).
 *
 * Supabase can deliver these in three different shapes depending on the email
 * template, so all three are handled here:
 *
 *  1. `?token_hash=…&type=…` — the `{{ .TokenHash }}` template. Verified here
 *     on the server.
 *  2. `?code=…` — the PKCE template. Exchanged for a session on the server.
 *  3. `#access_token=…&refresh_token=…` — the default `{{ .ConfirmationURL }}`
 *     template, where Supabase verifies the token itself and hands back the
 *     session in the URL fragment. A fragment never reaches the server, so
 *     that case is picked up by the client component below.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = safeNext(one(params.next));
  const tokenHash = one(params.token_hash);
  const type = one(params.type) as EmailOtpType | undefined;
  const code = one(params.code);
  const errorDescription = one(params.error_description) ?? one(params.error);

  if (!errorDescription) {
    const supabase = await createSupabaseServer();

    if (supabase && tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) redirect(next);
    }

    if (supabase && code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) redirect(next);
    }
  }

  // Either the session is in the URL fragment (case 3), or the link failed and
  // we want to explain that rather than bounce to a bare error page.
  return <ConfirmClient next={next} serverError={errorDescription ?? null} />;
}
