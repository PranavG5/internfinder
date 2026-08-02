'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Browser-side Supabase client, used only for auth (sign in/up/out). */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
