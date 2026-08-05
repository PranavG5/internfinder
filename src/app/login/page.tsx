'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/*
  `submitting` covers the auth round-trip; `redirecting` covers the navigation
  that follows it. They are separate because the second one used to be invisible:
  `router.push` resolves long before the destination has rendered, so clearing
  the busy flag at the end of `submit` dropped the button back to its resting
  state while the browser was still working.
*/
type Phase = 'idle' | 'submitting' | 'redirecting';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = phase !== 'idle';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhase('submitting');
    setError(null);
    setNotice(null);
    const supabase = createSupabaseBrowser();

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice('Check your email for a confirmation link, then sign in.');
          setMode('signin');
          setPhase('idle');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // Authenticated. Hold the loading state rather than clearing it — this
      // component is about to unmount, and the wait is not over until it does.
      setPhase('redirecting');
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message || 'Something went wrong.');
      setPhase('idle');
    }
  };

  const submitLabel = () => {
    if (phase === 'redirecting') return 'Signing you in…';
    if (phase === 'submitting') return mode === 'signin' ? 'Checking…' : 'Creating account…';
    return mode === 'signin' ? 'Sign in' : 'Sign up';
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center p-6">
      {busy ? <div className="loading-bar" role="progressbar" aria-label="Signing in" /> : null}

      {/* The spinner and bar are decorative; this is what actually gets announced. */}
      <p aria-live="polite" className="sr-only">
        {phase === 'submitting'
          ? 'Checking your details, please wait.'
          : phase === 'redirecting'
            ? 'Signed in. Taking you to your account.'
            : ''}
      </p>

      <h1 className="text-xl font-semibold tracking-tight">
        {mode === 'signin' ? 'Sign in' : 'Create your account'}
      </h1>
      <p className="mt-1 text-[0.8125rem]" style={{ color: 'var(--ink-secondary)' }}>
        {mode === 'signin'
          ? 'Your profile, shortlist, and application tracker live in your account.'
          : 'A free account keeps your profile, shortlist, and tracker synced across devices.'}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-[0.8125rem] font-medium">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            className="input mt-1 w-full"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-[0.8125rem] font-medium">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className="input mt-1 w-full"
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? (
          <p role="alert" className="text-[0.8125rem]" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-[0.8125rem]" style={{ color: 'var(--accent)' }}>
            {notice}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full" disabled={busy} data-busy={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {submitLabel()}
        </button>
      </form>

      <button
        type="button"
        className="link mt-4 text-[0.8125rem]"
        disabled={busy}
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setError(null);
        }}
      >
        {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
      </button>

      <p className="mt-6 text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
        An account is required to use InternIndex. It keeps your shortlist, fit preferences, and
        application tracker private to you.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
