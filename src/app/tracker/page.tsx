import { Suspense } from 'react';
import { TrackerClient } from '@/components/TrackerClient';

export const dynamic = 'force-dynamic';

export default function TrackerPage() {
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
