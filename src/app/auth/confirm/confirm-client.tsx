'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

/**
 * Finishes an email link whose session arrived in the URL fragment, which the
 * server can never see. Falls back to a readable explanation when the link is
 * expired or already used, which is the common case since these tokens are one-shot
 * and a page reload burns them.
 */
export default function ConfirmClient({
  next,
  serverError,
}: {
  next: string;
  serverError: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(
    serverError ? humanize(serverError) : null,
  );

  useEffect(() => {
    if (serverError) return;

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const fragment = new URLSearchParams(hash);
    const hashError = fragment.get('error_description') ?? fragment.get('error');
    if (hashError) {
      setMessage(humanize(hashError));
      return;
    }

    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    if (!accessToken || !refreshToken) {
      setMessage(
        'This confirmation link is missing its sign-in token. If you have already confirmed your email, just sign in.',
      );
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (cancelled) return;
      if (error) {
        setMessage(humanize(error.message));
        return;
      }
      // Drop the tokens from the address bar before moving on.
      window.history.replaceState(null, '', window.location.pathname);
      router.replace(next);
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [next, router, serverError]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {message ? 'That link did not work' : 'Confirming your email…'}
      </h1>
      <p className="mt-2 text-[0.8125rem]" style={{ color: 'var(--ink-secondary)' }}>
        {message ?? 'One moment while we finish signing you in.'}
      </p>
      {message ? (
        <Link href="/login" className="btn btn-primary mt-6 w-full justify-center">
          Go to sign in
        </Link>
      ) : null}
    </div>
  );
}

function humanize(raw: string): string {
  const text = raw.replace(/\+/g, ' ');
  if (/expired|invalid|not found/i.test(text)) {
    return 'This link has already been used or has expired. Confirmation links work once. If you already clicked it, your email is confirmed and you can sign in normally.';
  }
  return text;
}
