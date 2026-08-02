import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { TrackerClient } from '@/components/TrackerClient';
import { getUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function TrackerPage() {
  if (!(await getUserId())) redirect('/login?next=/tracker');
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[0.8125rem]" style={{ color: 'var(--ink-muted)' }}>
          Loading your applications…
        </div>
      }
    >
      <TrackerClient />
    </Suspense>
  );
}
