'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, PageHeader, StatusBadge } from './ui';
import { AddApplicationDialog } from './AddApplicationDialog';
import { APP_STATUSES, STATUS_META, type AppStatus, type Application } from '@/lib/types';
import { daysUntil, formatDate, relativeTime } from '@/lib/util';

type View = 'board' | 'table';

/** Kanban columns. Terminal states are grouped so the board stays readable. */
const BOARD_COLUMNS: { key: string; label: string; statuses: AppStatus[] }[] = [
  { key: 'interested', label: 'Interested', statuses: ['interested'] },
  { key: 'preparing', label: 'Preparing', statuses: ['preparing'] },
  { key: 'applied', label: 'Submitted', statuses: ['applied'] },
  { key: 'assessment', label: 'Assessment', statuses: ['online_assessment'] },
  { key: 'interview', label: 'Interviewing', statuses: ['phone_screen', 'interviewing', 'final_round'] },
  { key: 'offer', label: 'Offer', statuses: ['offer', 'accepted'] },
  { key: 'closed', label: 'Closed', statuses: ['rejected', 'withdrawn', 'ghosted'] },
];

export function TrackerClient() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('board');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sort, setSort] = useState('updated');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (showArchived) params.set('archived', '1');
    fetch(`/api/applications?${params}`)
      .then((r) => (r.ok ? r.json() : { applications: [] }))
      .then((data) => setApplications(data.applications ?? []))
      .catch(() => setToast('Could not load your applications.'))
      .finally(() => setLoading(false));
  }, [showArchived, sort]);

  useEffect(load, [load]);

  useEffect(() => {
    // Remember the view choice, since most people settle on one and stay there.
    const saved = localStorage.getItem('internindex-tracker-view');
    if (saved === 'board' || saved === 'table') setView(saved);
  }, []);

  const chooseView = (next: View) => {
    setView(next);
    localStorage.setItem('internindex-tracker-view', next);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return applications;
    return applications.filter((app) =>
      [app.company, app.role, app.location, app.notes, app.next_action]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [applications, search]);

  /** Move an application to a new status, updating the UI before the round-trip. */
  const setStatus = async (app: Application, status: AppStatus) => {
    if (app.status === status) return;
    setApplications((prev) =>
      prev.map((row) => (row.id === app.id ? { ...row, status } : row)),
    );
    try {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApplications((prev) =>
        prev.map((row) => (row.id === app.id ? data.application : row)),
      );
      setToast(`${app.company} → ${STATUS_META[status].label}`);
    } catch {
      setApplications((prev) =>
        prev.map((row) => (row.id === app.id ? { ...row, status: app.status } : row)),
      );
      setToast('Could not update that application.');
    }
  };

  const columnFor = (status: AppStatus) =>
    BOARD_COLUMNS.find((column) => column.statuses.includes(status)) ?? BOARD_COLUMNS[0];

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle={
          loading
            ? 'Loading…'
            : `${filtered.length} ${showArchived ? 'archived' : 'tracked'} application${filtered.length === 1 ? '' : 's'}`
        }
        actions={
          <>
            <div
              className="flex rounded-lg border p-0.5"
              style={{ borderColor: 'var(--line-strong)' }}
              role="group"
              aria-label="View"
            >
              {(['board', 'table'] as View[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => chooseView(option)}
                  aria-pressed={view === option}
                  style={
                    view === option
                      ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)' }
                      : { border: 'none', background: 'transparent' }
                  }
                >
                  {option === 'board' ? 'Board' : 'Table'}
                </button>
              ))}
            </div>
            <a className="btn btn-sm" href="/api/export?format=csv">
              Export CSV
            </a>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
              Add application
            </button>
          </>
        }
      />

      <div className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            className="input max-w-xs"
            type="search"
            placeholder="Filter by company, role, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter applications"
          />
          {view === 'table' ? (
            <select
              className="select w-auto"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort"
            >
              <option value="updated">Recently updated</option>
              <option value="created">Recently added</option>
              <option value="deadline">Deadline soonest</option>
              <option value="applied">Recently applied</option>
              <option value="priority">Priority</option>
              <option value="company">Company A–Z</option>
              <option value="status">Status</option>
            </select>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 text-[0.75rem]">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            Show archived
          </label>
        </div>

        {filtered.length === 0 && !loading ? (
          <EmptyState
            title={search ? 'Nothing matches that filter' : 'No applications yet'}
            action={
              search ? (
                <button type="button" className="btn btn-sm" onClick={() => setSearch('')}>
                  Clear filter
                </button>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/" className="btn btn-primary btn-sm">
                    Find internships
                  </Link>
                  <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>
                    Add one manually
                  </button>
                </div>
              )
            }
          >
            {search
              ? 'Try a different search term.'
              : 'Track roles from the search page, add them by hand, or import a CSV from your profile page.'}
          </EmptyState>
        ) : view === 'board' ? (
          <div className="scroll-x pb-2">
            <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
              {BOARD_COLUMNS.map((column) => {
                const items = filtered.filter((app) => column.statuses.includes(app.status));
                return (
                  <div
                    key={column.key}
                    className="w-64 shrink-0"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const app = filtered.find((row) => row.id === dragging);
                      if (app) setStatus(app, column.statuses[0]);
                      setDragging(null);
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                      <h2 className="text-[0.75rem] font-semibold">{column.label}</h2>
                      <span className="tnum text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                        {items.length}
                      </span>
                    </div>

                    <div
                      className="min-h-24 space-y-2 rounded-lg p-1.5"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      {items.map((app) => (
                        <BoardCard
                          key={app.id}
                          app={app}
                          onDragStart={() => setDragging(app.id)}
                          onStatusChange={(status) => setStatus(app, status)}
                        />
                      ))}
                      {items.length === 0 ? (
                        <p
                          className="px-1.5 py-3 text-center text-[0.6875rem]"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          Drop here
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
              Drag a card between columns to change its status, or use the dropdown on each card.
            </p>
          </div>
        ) : (
          <div className="card scroll-x">
            <table className="w-full text-[0.8125rem]">
              <thead>
                <tr
                  className="border-b text-left"
                  style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
                >
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Applied</th>
                  <th className="px-3 py-2 font-medium">Deadline</th>
                  <th className="px-3 py-2 font-medium">Next action</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => {
                  const dl = daysUntil(app.deadline);
                  return (
                    <tr key={app.id} className="border-b last:border-0" style={{ borderColor: 'var(--line)' }}>
                      <td className="px-3 py-2 font-medium">
                        <Link href={`/tracker/${app.id}`} className="link">
                          {app.company}
                        </Link>
                      </td>
                      <td className="max-w-56 truncate px-3 py-2" title={app.role}>
                        {app.role}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="select text-[0.75rem]"
                          value={app.status}
                          onChange={(e) => setStatus(app, e.target.value as AppStatus)}
                          aria-label={`Status for ${app.company}`}
                        >
                          {APP_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_META[status].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="tnum px-3 py-2">{'★'.repeat(app.priority)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-secondary)' }}>
                        {formatDate(app.applied_at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {app.deadline ? (
                          <span style={{ color: dl != null && dl <= 7 ? 'var(--critical)' : 'var(--ink-secondary)' }}>
                            {formatDate(app.deadline)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ink-muted)' }}>–</span>
                        )}
                      </td>
                      <td className="max-w-48 truncate px-3 py-2" style={{ color: 'var(--ink-secondary)' }}>
                        {app.next_action ?? '–'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/tracker/${app.id}`} className="btn btn-ghost btn-sm">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding ? (
        <AddApplicationDialog
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
            setToast('Application added.');
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

function BoardCard({
  app,
  onDragStart,
  onStatusChange,
}: {
  app: Application;
  onDragStart: () => void;
  onStatusChange: (status: AppStatus) => void;
}) {
  const dl = daysUntil(app.deadline);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="card cursor-grab p-2.5 active:cursor-grabbing"
      style={{ background: 'var(--surface-1)' }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <Link href={`/tracker/${app.id}`} className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-medium">{app.company}</p>
          <p className="clamp-2 text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
            {app.role}
          </p>
        </Link>
        {app.priority >= 4 ? (
          <span className="text-[0.6875rem]" title={`Priority ${app.priority}`}>
            ★
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {app.referral ? <span className="chip">referral</span> : null}
        {dl != null ? (
          <span
            className="chip"
            style={dl <= 7 ? { color: 'var(--critical)' } : undefined}
          >
            {dl < 0 ? 'closed' : dl === 0 ? 'today' : `${dl}d`}
          </span>
        ) : null}
        {app.applied_at ? (
          <span className="chip" title={formatDate(app.applied_at)}>
            {relativeTime(app.applied_at)}
          </span>
        ) : null}
      </div>

      <select
        className="select mt-2 text-[0.6875rem]"
        value={app.status}
        onChange={(e) => onStatusChange(e.target.value as AppStatus)}
        aria-label={`Status for ${app.company}`}
      >
        {APP_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_META[status].label}
          </option>
        ))}
      </select>
    </div>
  );
}
