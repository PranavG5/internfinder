import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Funnel, GoalMeter, HBarChart, WeeklyColumns } from '@/components/charts';
import { AlertIcon, EmptyState, PageHeader, SectionTitle, StatTile, StatusBadge } from '@/components/ui';
import { getUserId } from '@/lib/auth';
import { catalogStats } from '@/lib/query';
import { dashboardStats } from '@/lib/repo';
import { STATUS_META } from '@/lib/types';
import { formatDate, formatDateTime, relativeTime, titleCase } from '@/lib/util';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const userId = await getUserId();
  if (!userId) redirect('/login?next=/dashboard');

  const [stats, catalog] = await Promise.all([dashboardStats(userId), catalogStats()]);

  const statusBars = stats.byStatus
    .filter((row) => row.count > 0)
    .map((row) => ({ label: STATUS_META[row.status].label, value: row.count }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          stats.total === 0
            ? 'Track your first application to see your pipeline here.'
            : `${stats.total} applications tracked · ${stats.active} active right now`
        }
        actions={
          <>
            <Link href="/tracker" className="btn btn-sm">
              Open tracker
            </Link>
            <Link href="/" className="btn btn-primary btn-sm">
              Find internships
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        {/* Catalog state, which answers "is there anything to apply to right now?" */}
        <section>
          <SectionTitle
            action={
              <Link href="/sources" className="link text-[0.75rem]">
                {catalog.lastSync
                  ? `Last synced ${relativeTime(catalog.lastSync.finished_at)}`
                  : 'Never synced, run one'}
              </Link>
            }
          >
            Open internships available
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Open now"
              value={catalog.open.toLocaleString()}
              hint={`across ${catalog.companies.toLocaleString()} companies`}
              tone="accent"
            />
            <StatTile
              label="Posted this week"
              value={catalog.freshWeek.toLocaleString()}
              hint="new since 7 days ago"
            />
            <StatTile
              label="Closing in 14 days"
              value={catalog.closingSoon.toLocaleString()}
              hint="with a stated deadline"
              tone={catalog.closingSoon > 0 ? 'warning' : 'neutral'}
            />
            <StatTile
              label="With listed pay"
              value={catalog.withPay.toLocaleString()}
              hint={
                catalog.open > 0
                  ? `${Math.round((catalog.withPay / catalog.open) * 100)}% of open roles`
                  : undefined
              }
            />
          </div>
        </section>

        {stats.total === 0 ? (
          <EmptyState
            title="Your tracker is empty"
            action={
              <Link href="/" className="btn btn-primary btn-sm">
                Browse open internships
              </Link>
            }
          >
            Find a role you like and hit <strong>Track this</strong>. Once applications land here,
            this page shows your funnel, response rate, upcoming deadlines, and what to do next.
          </EmptyState>
        ) : (
          <>
            {/* Pipeline KPIs */}
            <section>
              <SectionTitle>Your pipeline</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatTile label="Submitted" value={stats.submitted} />
                <StatTile label="Active" value={stats.active} hint="awaiting an outcome" tone="accent" />
                <StatTile
                  label="Response rate"
                  value={`${stats.responseRate}%`}
                  hint={`${stats.responded} of ${stats.submitted} heard back`}
                  tone={stats.responseRate >= 15 ? 'good' : 'neutral'}
                />
                <StatTile
                  label="Interview rate"
                  value={`${stats.interviewRate}%`}
                  hint="reached a screen or beyond"
                />
                <StatTile
                  label="Offers"
                  value={stats.offers}
                  tone={stats.offers > 0 ? 'good' : 'neutral'}
                  hint={`${stats.offerRate}% of submissions`}
                />
                <StatTile
                  label="Median reply time"
                  value={stats.medianDaysToResponse != null ? `${stats.medianDaysToResponse}d` : '–'}
                  hint="submission to first response"
                />
              </div>
            </section>

            {/* Charts */}
            {/* items-start so each card sizes to its content instead of
                stretching to match the tallest one in the row. */}
            <section className="grid items-start gap-4 lg:grid-cols-3">
              <div className="card p-4">
                <h2 className="mb-3 text-[0.8125rem] font-semibold">Funnel by stage</h2>
                <Funnel stages={stats.funnel} />
              </div>

              <div className="card p-4">
                <h2 className="mb-3 text-[0.8125rem] font-semibold">
                  Applications submitted per week
                </h2>
                <WeeklyColumns data={stats.weeklyActivity} goal={stats.weeklyGoal} />
              </div>

              <div className="card p-4">
                <h2 className="mb-1 text-[0.8125rem] font-semibold">This week&rsquo;s goal</h2>
                <p className="mb-3 text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                  Applications submitted since Sunday.
                </p>
                <GoalMeter current={stats.appliedThisWeek} goal={stats.weeklyGoal} />

                <h3 className="mt-5 mb-2 text-[0.8125rem] font-semibold">Where everything sits</h3>
                <HBarChart data={statusBars} caption="Applications by status" valueLabel="Applications" />
              </div>
            </section>

            {/* Action lists, the "what do I do today" half of the page. */}
            <section className="grid gap-4 lg:grid-cols-2">
              <Panel
                title="Deadlines coming up"
                empty="No deadlines on anything you haven't applied to yet."
                items={stats.upcomingDeadlines.map((app) => ({
                  key: `dl-${app.id}`,
                  href: `/tracker/${app.id}`,
                  primary: `${app.role} · ${app.company}`,
                  secondary: `Closes ${formatDate(app.deadline)}, ${relativeTime(app.deadline)}`,
                  badge: <StatusBadge status={app.status} small />,
                }))}
              />

              <Panel
                title="Next actions"
                empty="No next actions set. Add one on any application to plan your week."
                items={stats.nextActions.map((app) => ({
                  key: `na-${app.id}`,
                  href: `/tracker/${app.id}`,
                  primary: app.next_action ?? '',
                  secondary: `${app.company} · ${app.next_action_at ? formatDate(app.next_action_at) : 'no date'}`,
                  badge: <StatusBadge status={app.status} small />,
                }))}
              />

              <Panel
                title="Time to follow up"
                hint="Submitted 10–30 days ago with no reply. A short, polite nudge to the recruiter is normal and often works."
                empty="Nothing needs a nudge right now."
                items={stats.needsFollowUp.map((app) => ({
                  key: `fu-${app.id}`,
                  href: `/tracker/${app.id}`,
                  primary: `${app.role} · ${app.company}`,
                  secondary: `Applied ${app.daysSince} days ago`,
                }))}
              />

              <Panel
                title="Probably ghosted"
                hint="No response in over 30 days. Consider marking these ghosted so your response rate reflects reality."
                empty="Nothing has gone quiet on you."
                items={stats.possiblyGhosted.map((app) => ({
                  key: `gh-${app.id}`,
                  href: `/tracker/${app.id}`,
                  primary: `${app.role} · ${app.company}`,
                  secondary: `Applied ${app.daysSince} days ago`,
                  warn: true,
                }))}
              />

              <Panel
                title="Upcoming interviews"
                empty="No interviews scheduled. Add one from an application when you get the invite."
                items={stats.upcomingInterviews.map((iv) => ({
                  key: `iv-${iv.id}`,
                  href: `/tracker/${iv.application_id}`,
                  primary: `${titleCase(iv.kind)} · ${iv.company}`,
                  secondary: `${formatDateTime(iv.scheduled_at)}${iv.location ? ` · ${iv.location}` : ''}`,
                }))}
              />

              <Panel
                title="Open tasks"
                empty="No open tasks. Add them per application: tailor a resume, ask for a referral, send a thank-you note."
                items={stats.openTasks.map((task) => ({
                  key: `tk-${task.id}`,
                  href: task.application_id ? `/tracker/${task.application_id}` : '/tracker',
                  primary: task.title,
                  secondary: [task.company, task.due_at ? `due ${formatDate(task.due_at)}` : null]
                    .filter(Boolean)
                    .join(' · '),
                }))}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

interface PanelItem {
  key: string;
  href: string;
  primary: string;
  secondary?: string;
  badge?: React.ReactNode;
  warn?: boolean;
}

function Panel({
  title,
  items,
  empty,
  hint,
}: {
  title: string;
  items: PanelItem[];
  empty: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <h2 className="text-[0.8125rem] font-semibold">{title}</h2>
      {hint ? (
        <p className="mt-0.5 mb-2 text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
          {hint}
        </p>
      ) : (
        <div className="mb-2" />
      )}

      {items.length === 0 ? (
        <p className="py-3 text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
          {empty}
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--line)' }}>
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-start justify-between gap-3 py-2 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium">
                    {item.warn ? (
                      <span style={{ color: 'var(--warning)' }} aria-hidden>
                        <AlertIcon />
                      </span>
                    ) : null}
                    <span className="truncate">{item.primary}</span>
                  </span>
                  {item.secondary ? (
                    <span
                      className="mt-0.5 block truncate text-[0.75rem]"
                      style={{ color: 'var(--ink-secondary)' }}
                    >
                      {item.secondary}
                    </span>
                  ) : null}
                </span>
                {item.badge}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
