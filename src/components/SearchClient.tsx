'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filters, type QueryPatch } from './Filters';
import { InternshipCard } from './InternshipCard';
import { TrackDialog } from './TrackDialog';
import { EmptyState, PageHeader } from './ui';
import {
  parseSearchParams,
  toSearchParams,
  type Facets,
  type SearchQuery,
  type SearchResult,
  type SortKey,
} from '@/lib/search-query';
import type { InternshipView, ProfileView } from '@/lib/types';
import { pluralize } from '@/lib/util';

const SORT_LABELS: Record<SortKey, string> = {
  relevance: 'Most relevant',
  fit: 'Best fit for me',
  newest: 'Newest first',
  deadline: 'Deadline soonest',
  pay: 'Highest pay',
  company: 'Company A–Z',
  title: 'Title A–Z',
};

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The URL is the source of truth, so any search is shareable and bookmarkable.
  const query = useMemo(
    () => parseSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [result, setResult] = useState<SearchResult | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(query.q);
  const [showFilters, setShowFilters] = useState(false);
  const [tracking, setTracking] = useState<InternshipView | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => setText(query.q), [query.q]);

  /** Push a filter change into the URL, resetting to page 1. */
  const update = useCallback(
    (patch: QueryPatch, keepPage = false) => {
      const next: SearchQuery = { ...query, ...patch, page: keepPage ? (patch.page ?? query.page) : 1 };
      router.replace(`/?${toSearchParams(next).toString()}`, { scroll: false });
    },
    [query, router],
  );

  const reset = useCallback(() => router.replace('/', { scroll: false }), [router]);

  // Fetch results whenever the query changes.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const qs = toSearchParams(query).toString();

    Promise.all([
      fetch(`/api/internships?${qs}`, { signal: controller.signal }).then(async (r) => {
        if (r.ok) return r.json();
        // Surface what the server actually said — a bare status code sends you
        // digging through logs for something the response already told you.
        const detail = await r
          .json()
          .then((body) => body?.error as string | undefined)
          .catch(() => undefined);
        throw new Error(detail ? `${detail} (${r.status})` : `Search failed (${r.status})`);
      }),
      fetch(`/api/internships/facets?${qs}`, { signal: controller.signal }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([searchData, facetData]) => {
        setResult(searchData);
        if (facetData) setFacets(facetData);
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setProfile(data.profile))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // "/" focuses search, Escape blurs it — standard for a search-first app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === searchInput.current) {
        searchInput.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Optimistically flip a card's state, then confirm with the server. */
  const patchRow = (id: string, patch: Partial<InternshipView>) => {
    setResult((prev) =>
      prev
        ? { ...prev, rows: prev.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) }
        : prev,
    );
  };

  const onBookmark = async (listing: InternshipView) => {
    patchRow(listing.id, { bookmarked: !listing.bookmarked });
    try {
      const res = await fetch(`/api/internships/${listing.id}/bookmark`, { method: 'POST' });
      const data = await res.json();
      patchRow(listing.id, { bookmarked: data.bookmarked });
      setToast(data.bookmarked ? 'Added to your shortlist.' : 'Removed from your shortlist.');
    } catch {
      patchRow(listing.id, { bookmarked: listing.bookmarked });
      setToast('Could not update the shortlist.');
    }
  };

  const onHide = async (listing: InternshipView) => {
    setResult((prev) =>
      prev ? { ...prev, rows: prev.rows.filter((row) => row.id !== listing.id) } : prev,
    );
    try {
      await fetch(`/api/internships/${listing.id}/hide`, { method: 'POST' });
      setToast(`Hidden: ${listing.title}. It won't appear again.`);
    } catch {
      setToast('Could not hide that listing.');
    }
  };

  const onTracked = (listing: InternshipView, applicationId: number, status: string) => {
    patchRow(listing.id, {
      applied: true,
      application_id: applicationId,
      application_status: status as InternshipView['application_status'],
    });
    setTracking(null);
    setToast(`Added ${listing.company} to your tracker.`);
  };

  const saveSearch = async () => {
    const name = window.prompt('Name this search (you can check it for new results later):');
    if (!name?.trim()) return;
    const res = await fetch('/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), query: toSearchParams(query).toString() }),
    });
    setToast(res.ok ? `Saved "${name.trim()}".` : 'Could not save that search.');
  };

  const total = result?.total ?? 0;
  const pages = result?.pages ?? 1;

  return (
    <div>
      <PageHeader
        title="Find internships"
        subtitle={
          loading && !result
            ? 'Searching…'
            : error
              ? 'Something went wrong.'
              : `${pluralize(total, 'open internship')} matching your filters`
        }
        actions={
          <>
            <button type="button" className="btn btn-sm lg:hidden" onClick={() => setShowFilters((v) => !v)}>
              {showFilters ? 'Hide filters' : 'Filters'}
            </button>
            <button type="button" className="btn btn-sm" onClick={saveSearch}>
              Save this search
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-5 p-4 sm:p-6 lg:flex-row">
        {/* Filter rail */}
        <aside
          className={`no-print shrink-0 lg:block lg:w-64 ${showFilters ? 'block' : 'hidden'}`}
        >
          <div className="card sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-3">
            <Filters query={query} facets={facets} onChange={update} onReset={reset} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Search + sort */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                update({ q: text });
              }}
            >
              <input
                ref={searchInput}
                className="input"
                type="search"
                placeholder="Search title, company, skills…  (press / to focus)"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="Search internships"
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Search
              </button>
            </form>

            <select
              className="select w-auto"
              value={query.sort}
              onChange={(e) => update({ sort: e.target.value as SortKey })}
              aria-label="Sort results"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {profile && !profile.onboarded ? (
            <div
              className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-3.5"
              style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}
            >
              <p className="text-[0.8125rem]">
                <strong>Set up your profile</strong> to get fit scores, eligibility filtering, and
                personalized ranking.
              </p>
              <a href="/profile" className="btn btn-primary btn-sm">
                Set up profile
              </a>
            </div>
          ) : null}

          {error ? (
            <EmptyState title="Search failed" action={<button type="button" className="btn btn-sm" onClick={() => update({})}>Try again</button>}>
              {error}
            </EmptyState>
          ) : total === 0 && !loading ? (
            <EmptyState
              title="No open internships match these filters"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className="btn btn-sm" onClick={reset}>
                    Clear filters
                  </button>
                  <a href="/sources" className="btn btn-primary btn-sm">
                    Sync more sources
                  </a>
                </div>
              }
            >
              Try widening the season or field, or run a sync to pull in fresh listings. If the
              catalog is empty, no sync has run yet.
            </EmptyState>
          ) : (
            <>
              <div className={`space-y-2.5 ${loading ? 'opacity-60' : ''}`}>
                {result?.rows.map((listing) => (
                  <InternshipCard
                    key={listing.id}
                    listing={listing}
                    onTrack={setTracking}
                    onBookmark={onBookmark}
                    onHide={onHide}
                  />
                ))}
              </div>

              {pages > 1 ? (
                <nav className="mt-5 flex items-center justify-center gap-2" aria-label="Pagination">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={query.page <= 1}
                    onClick={() => update({ page: query.page - 1 }, true)}
                  >
                    ← Previous
                  </button>
                  <span className="tnum text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                    Page {query.page} of {pages.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={query.page >= pages}
                    onClick={() => update({ page: query.page + 1 }, true)}
                  >
                    Next →
                  </button>
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>

      {tracking ? (
        <TrackDialog
          listing={tracking}
          onClose={() => setTracking(null)}
          onSaved={(id, status) => onTracked(tracking, id, status)}
        />
      ) : null}

      {toast ? (
        <div
          className="no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-3.5 py-2 text-[0.8125rem] shadow-lg"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--line-strong)',
            color: 'var(--ink-primary)',
          }}
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
