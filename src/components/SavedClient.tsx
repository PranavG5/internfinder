'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { InternshipCard } from './InternshipCard';
import { TrackDialog } from './TrackDialog';
import { EmptyState, PageHeader, SectionTitle } from './ui';
import type { InternshipView } from '@/lib/types';
import { relativeTime } from '@/lib/util';

interface SavedSearch {
  id: number;
  name: string;
  query: string;
  alert: number;
  last_seen_at: number | null;
  total: number;
  newCount: number;
}

/**
 * Saved searches behave like standing alerts: each is re-run on load so you can
 * see how many results it has now and how many appeared since you last looked.
 */
export function SavedClient() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [shortlist, setShortlist] = useState<InternshipView[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<InternshipView | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/saved-searches').then((r) => (r.ok ? r.json() : { searches: [] })),
      fetch('/api/internships?bookmarked=1&limit=100&sort=deadline').then((r) =>
        r.ok ? r.json() : { rows: [] },
      ),
    ])
      .then(([saved, bookmarked]) => {
        setSearches(saved.searches ?? []);
        setShortlist(bookmarked.rows ?? []);
      })
      .catch(() => flash('Could not load your saved items.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const remove = async (id: number) => {
    await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' });
    setSearches((prev) => prev.filter((search) => search.id !== id));
    flash('Saved search deleted.');
  };

  const markSeen = async (id: number) => {
    await fetch(`/api/saved-searches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seen: true }),
    });
    setSearches((prev) =>
      prev.map((search) => (search.id === id ? { ...search, newCount: 0 } : search)),
    );
  };

  const unbookmark = async (listing: InternshipView) => {
    setShortlist((prev) => prev.filter((row) => row.id !== listing.id));
    await fetch(`/api/internships/${listing.id}/bookmark`, { method: 'POST' });
    flash('Removed from your shortlist.');
  };

  const hide = async (listing: InternshipView) => {
    setShortlist((prev) => prev.filter((row) => row.id !== listing.id));
    await fetch(`/api/internships/${listing.id}/hide`, { method: 'POST' });
    setHiddenCount((n) => n + 1);
    flash('Hidden from future searches.');
  };

  return (
    <div>
      <PageHeader
        title="Saved &amp; shortlist"
        subtitle="Standing searches you can check for new postings, plus the roles you've starred."
        actions={
          <Link href="/" className="btn btn-primary btn-sm">
            Find more
          </Link>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        <section>
          <SectionTitle>Saved searches</SectionTitle>
          {searches.length === 0 ? (
            <EmptyState
              title="No saved searches yet"
              action={
                <Link href="/" className="btn btn-primary btn-sm">
                  Build a search
                </Link>
              }
            >
              Set up filters on the search page — season, field, location, pay, eligibility — then hit{' '}
              <strong>Save this search</strong>. Come back here to see how many new postings have
              appeared since you last checked.
            </EmptyState>
          ) : (
            <ul className="card divide-y" style={{ borderColor: 'var(--line)' }}>
              {searches.map((search) => (
                <li
                  key={search.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/?${search.query}`} className="link text-[0.875rem] font-medium">
                        {search.name}
                      </Link>
                      {search.newCount > 0 ? (
                        <span
                          className="tnum rounded-full px-1.5 py-px text-[0.6875rem] font-semibold"
                          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                        >
                          {search.newCount} new
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                      {search.total.toLocaleString()} open match
                      {search.total === 1 ? '' : 'es'}
                      {search.last_seen_at ? ` · last checked ${relativeTime(search.last_seen_at)}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/?${search.query}`}
                      className="btn btn-sm"
                      onClick={() => markSeen(search.id)}
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => remove(search.id)}
                      aria-label={`Delete saved search ${search.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle
            action={
              hiddenCount > 0 ? (
                <span className="text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
                  {hiddenCount} hidden this session
                </span>
              ) : undefined
            }
          >
            Shortlist{shortlist.length > 0 ? ` · ${shortlist.length}` : ''}
          </SectionTitle>

          {loading ? (
            <div className="card p-4 text-[0.8125rem]" style={{ color: 'var(--ink-muted)' }}>
              Loading…
            </div>
          ) : shortlist.length === 0 ? (
            <EmptyState title="Nothing shortlisted">
              Star a listing on the search page with <strong>☆ Shortlist</strong> to park it here
              while you decide. Shortlisted roles are sorted by deadline, so the ones closing soonest
              come first.
            </EmptyState>
          ) : (
            <div className="space-y-2.5">
              {shortlist.map((listing) => (
                <InternshipCard
                  key={listing.id}
                  listing={listing}
                  onTrack={setTracking}
                  onBookmark={unbookmark}
                  onHide={hide}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {tracking ? (
        <TrackDialog
          listing={tracking}
          onClose={() => setTracking(null)}
          onSaved={() => {
            setTracking(null);
            load();
            flash('Added to your tracker.');
          }}
        />
      ) : null}

      {toast ? (
        <div
          className="no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3.5 py-2 text-[0.8125rem] shadow-lg"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--line-strong)' }}
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
