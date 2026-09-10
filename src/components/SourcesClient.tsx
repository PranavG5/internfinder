'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmptyState, PageHeader, SectionTitle, StatTile } from './ui';
import { formatDateTime, relativeTime } from '@/lib/util';
import { KIND_LABELS } from '@/lib/sources/seed';

interface SourceRow {
  id: number;
  kind: string;
  token: string;
  label: string;
  enabled: number;
  last_sync_at: number | null;
  last_count: number | null;
  last_error: string | null;
  open_count: number;
}

interface SyncRun {
  id: number;
  started_at: number;
  finished_at: number | null;
  ok: number;
  trigger: string;
  found: number;
  inserted: number;
  updated: number;
  closed: number;
  duration_ms: number | null;
  errors_json: string;
}

interface CatalogStats {
  open: number;
  closed: number;
  companies: number;
  withPay: number;
  freshWeek: number;
  closingSoon: number;
  sourceCount: number;
}


export function SourcesClient() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/sources').then((r) => (r.ok ? r.json() : { sources: [] })),
      fetch('/api/sync').then((r) => (r.ok ? r.json() : { runs: [], stats: null })),
    ])
      .then(([sourceData, syncData]) => {
        setSources(sourceData.sources ?? []);
        setRuns(syncData.runs ?? []);
        setStats(syncData.stats ?? null);
      })
      .catch(() => flash('Could not load sources.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const runSync = async (body: Record<string, unknown>, description: string) => {
    setSyncing(true);
    setSyncMessage(`${description}… this can take a minute.`);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');

      const r = data.result;
      const v = data.verified;

      if (body.verifyOnly && v) {
        setSyncMessage(
          `Checked ${v.checked} links: ${v.alive} still open, ${v.closed} closed and removed from search` +
            (v.errors ? `, ${v.errors} unreachable (left untouched).` : '.'),
        );
      } else {
        const failed = r.sources.filter((s: { ok: boolean }) => !s.ok).length;
        setSyncMessage(
          `Done in ${(r.durationMs / 1000).toFixed(0)}s: ${r.inserted} new, ${r.updated} refreshed, ` +
            `${r.closed} closed, ${r.duplicates} duplicates merged` +
            (r.discovered ? `, ${r.discovered} new boards discovered` : '') +
            (failed ? `. ${failed} source${failed === 1 ? '' : 's'} failed.` : '.'),
        );
      }
      load();
    } catch (err) {
      setSyncMessage(`Sync failed: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const addSource = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newUrl.trim()) return;
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newUrl.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      flash(data.error ?? 'Could not add that board.');
      return;
    }
    setNewUrl('');
    flash(`Tracking ${data.source.label}. Run a sync to pull its listings in.`);
    load();
  };

  const toggle = async (source: SourceRow) => {
    setSources((prev) =>
      prev.map((row) => (row.id === source.id ? { ...row, enabled: row.enabled ? 0 : 1 } : row)),
    );
    await fetch(`/api/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !source.enabled }),
    });
  };

  const byKind = sources.reduce<Record<string, number>>((acc, source) => {
    acc[source.kind] = (acc[source.kind] ?? 0) + 1;
    return acc;
  }, {});

  const needle = filter.trim().toLowerCase();
  const visible = sources
    .filter(
      (source) =>
        !needle ||
        source.label.toLowerCase().includes(needle) ||
        source.token.toLowerCase().includes(needle) ||
        source.kind.includes(needle),
    )
    .slice(0, showAll ? undefined : 40);

  const failing = sources.filter((source) => source.last_error);

  return (
    <div>
      <PageHeader
        title="Sources &amp; sync"
        subtitle="Where listings come from, and how the catalog stays limited to roles that are actually open."
        actions={
          <>
            <button
              type="button"
              className="btn btn-sm"
              disabled={syncing}
              onClick={() => runSync({ kinds: ['github', 'remoteok', 'arbeitnow'] }, 'Refreshing community feeds')}
            >
              Quick sync
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={syncing}
              onClick={() => runSync({ maxBoards: 120 }, 'Syncing all feeds and 120 company boards')}
            >
              {syncing ? 'Syncing…' : 'Full sync'}
            </button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        {syncMessage ? (
          <div
            className="card p-3.5 text-[0.8125rem]"
            style={{
              background: syncing ? 'var(--surface-2)' : 'var(--accent-soft)',
              borderColor: syncing ? 'var(--line)' : 'var(--accent)',
            }}
            role="status"
          >
            {syncMessage}
          </div>
        ) : null}

        {/* How openness is guaranteed, which is worth stating plainly. */}
        <section className="card p-4">
          <h2 className="text-[0.8125rem] font-semibold">How &ldquo;only open roles&rdquo; works</h2>
          <ul
            className="mt-2 space-y-1.5 text-[0.8125rem] leading-relaxed"
            style={{ color: 'var(--ink-secondary)' }}
          >
            <li>
              <strong style={{ color: 'var(--ink-primary)' }}>Live boards.</strong> Most listings come
              straight from a company&rsquo;s own applicant-tracking system. A role appears there only
              while the board is accepting applications.
            </li>
            <li>
              <strong style={{ color: 'var(--ink-primary)' }}>Delisting.</strong> When a source that
              synced cleanly no longer carries a role, it&rsquo;s marked closed. A source that failed
              to fetch is never treated as evidence that its roles closed.
            </li>
            <li>
              <strong style={{ color: 'var(--ink-primary)' }}>Deadlines and staleness.</strong>{' '}
              Anything past its stated deadline, unseen for 21 days, or posted over 150 days ago with
              no update is closed automatically.
            </li>
            <li>
              <strong style={{ color: 'var(--ink-primary)' }}>Link checking.</strong> Optional
              verification opens each application link and closes any that 404s or says it&rsquo;s no
              longer accepting applications.
            </li>
          </ul>
          <button
            type="button"
            className="btn btn-sm mt-3"
            disabled={syncing}
            onClick={() => runSync({ verifyOnly: true, verify: 150 }, 'Verifying 150 application links')}
          >
            Verify 150 application links now
          </button>
        </section>

        {stats ? (
          <section>
            <SectionTitle>Catalog</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Open listings" value={stats.open.toLocaleString()} tone="accent" />
              <StatTile label="Companies" value={stats.companies.toLocaleString()} />
              <StatTile
                label="Closed / archived"
                value={stats.closed.toLocaleString()}
                hint="kept for history, hidden from search"
              />
              <StatTile label="Active sources" value={stats.sourceCount.toLocaleString()} />
            </div>
          </section>
        ) : null}

        {/* Add a board */}
        <section>
          <SectionTitle>Add a company&rsquo;s job board</SectionTitle>
          <form className="card space-y-2 p-4" onSubmit={addSource}>
            <p className="text-[0.8125rem]" style={{ color: 'var(--ink-secondary)' }}>
              Paste a posting URL from any supported provider (Workday, Greenhouse, Oracle Cloud
              Recruiting, Ashby, Lever, SmartRecruiters, Workable, Recruitee, Teamtailor, UKG,
              Rippling and more) and the board behind it gets tracked from then on.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                className="input max-w-md"
                type="url"
                placeholder="https://job-boards.greenhouse.io/company/jobs/123456"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                aria-label="Job board URL"
              />
              <button type="submit" className="btn btn-sm" disabled={!newUrl.trim()}>
                Track this board
              </button>
            </div>
            <p className="text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
              New boards are also discovered automatically: every sync reads the apply links it sees
              and starts following any employer board it recognizes.
            </p>
          </form>
        </section>

        {failing.length > 0 ? (
          <section>
            <SectionTitle>Sources reporting errors ({failing.length})</SectionTitle>
            <ul className="card divide-y" style={{ borderColor: 'var(--line)' }}>
              {failing.slice(0, 8).map((source) => (
                <li key={source.id} className="p-3" style={{ borderColor: 'var(--line)' }}>
                  <p className="text-[0.8125rem] font-medium">
                    {source.label}{' '}
                    <span className="chip">{KIND_LABELS[source.kind] ?? source.kind}</span>
                  </p>
                  <p className="mt-0.5 text-[0.75rem]" style={{ color: 'var(--critical)' }}>
                    {source.last_error}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
              A failing source is skipped, never treated as &ldquo;everything closed&rdquo;. Boards
              that stay broken can be disabled below.
            </p>
          </section>
        ) : null}

        {/* Source list */}
        <section>
          <SectionTitle
            action={
              <span className="text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
                {Object.entries(byKind)
                  .map(([kind, count]) => `${KIND_LABELS[kind] ?? kind}: ${count}`)
                  .join(' · ')}
              </span>
            }
          >
            All sources ({sources.length})
          </SectionTitle>

          <input
            className="input mb-3 max-w-xs"
            type="search"
            placeholder="Filter sources…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter sources"
          />

          {loading ? (
            <div className="card p-4 text-[0.8125rem]" style={{ color: 'var(--ink-muted)' }}>
              Loading…
            </div>
          ) : visible.length === 0 ? (
            <EmptyState title="No sources match that filter" />
          ) : (
            <>
              <div className="card scroll-x">
                <table className="w-full text-[0.8125rem]">
                  <thead>
                    <tr
                      className="border-b text-left"
                      style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
                    >
                      <th className="px-3 py-2 font-medium">Source</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Open now</th>
                      <th className="px-3 py-2 font-medium">Last sync</th>
                      <th className="px-3 py-2 font-medium">Enabled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((source) => (
                      <tr key={source.id} className="border-b last:border-0" style={{ borderColor: 'var(--line)' }}>
                        <td className="px-3 py-2">
                          <span className="font-medium">{source.label}</span>
                          <span className="ml-1.5 text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                            {source.token !== '-' ? source.token : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--ink-secondary)' }}>
                          {KIND_LABELS[source.kind] ?? source.kind}
                        </td>
                        <td className="tnum px-3 py-2">{source.open_count || '–'}</td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-secondary)' }}>
                          {source.last_sync_at ? relativeTime(source.last_sync_at) : 'never'}
                          {source.last_count != null ? (
                            <span style={{ color: 'var(--ink-muted)' }}> · {source.last_count} found</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={!!source.enabled}
                              onChange={() => toggle(source)}
                              style={{ accentColor: 'var(--accent)' }}
                              aria-label={`Enable ${source.label}`}
                            />
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!showAll && sources.length > 40 ? (
                <button
                  type="button"
                  className="btn btn-sm mt-3"
                  onClick={() => setShowAll(true)}
                >
                  Show all {sources.length} sources
                </button>
              ) : null}
            </>
          )}
        </section>

        {/* Sync history */}
        <section>
          <SectionTitle>Recent syncs</SectionTitle>
          {runs.length === 0 ? (
            <EmptyState title="No syncs yet">
              Hit <strong>Full sync</strong> above to build the catalog. On the command line,{' '}
              <code>npm run sync</code> does the same thing and can be put on a cron schedule.
            </EmptyState>
          ) : (
            <div className="card scroll-x">
              <table className="w-full text-[0.8125rem]">
                <thead>
                  <tr
                    className="border-b text-left"
                    style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
                  >
                    <th className="px-3 py-2 font-medium">Started</th>
                    <th className="px-3 py-2 font-medium">Trigger</th>
                    <th className="px-3 py-2 font-medium">Found</th>
                    <th className="px-3 py-2 font-medium">New</th>
                    <th className="px-3 py-2 font-medium">Closed</th>
                    <th className="px-3 py-2 font-medium">Took</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const errors = safeParse(run.errors_json);
                    return (
                      <tr key={run.id} className="border-b last:border-0" style={{ borderColor: 'var(--line)' }}>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(run.started_at)}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--ink-secondary)' }}>
                          {run.trigger}
                        </td>
                        <td className="tnum px-3 py-2">{run.found.toLocaleString()}</td>
                        <td className="tnum px-3 py-2">{run.inserted.toLocaleString()}</td>
                        <td className="tnum px-3 py-2">{run.closed.toLocaleString()}</td>
                        <td className="tnum px-3 py-2">
                          {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '–'}
                        </td>
                        <td className="px-3 py-2">
                          {run.ok ? (
                            <span style={{ color: 'var(--good-text)' }}>
                              ✓ ok
                              {errors.length > 0 ? (
                                <span style={{ color: 'var(--ink-muted)' }}> ({errors.length} source errors)</span>
                              ) : null}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--critical)' }}>failed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

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

function safeParse(json: string): unknown[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
