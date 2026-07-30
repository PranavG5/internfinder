import { Suspense } from 'react';
import { SearchClient } from '@/components/SearchClient';

export const dynamic = 'force-dynamic';

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[0.8125rem]" style={{ color: 'var(--ink-muted)' }}>
          Loading internships…
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  );
}
