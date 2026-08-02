'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
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
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {mode === 'signin' ? 'Sign in' : 'Create your account'}
      </h1>
      <p className="mt-1 text-[0.8125rem]" style={{ color: 'var(--ink-secondary)' }}>
        {mode === 'signin'
          ? 'Your profile, shortlist, and application tracker live in your account.'
          : 'Free account — it keeps your profile, shortlist, and tracker synced across devices.'}
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
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? (
          <p className="text-[0.8125rem]" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-[0.8125rem]" style={{ color: 'var(--accent)' }}>
            {notice}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      </form>

      <button
        type="button"
        className="link mt-4 text-[0.8125rem]"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setError(null);
        }}
      >
        {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
      </button>

      <p className="mt-6 text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
        You can <Link href="/" className="link">browse every internship without an account</Link> —
        signing in is only needed to save things.
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
