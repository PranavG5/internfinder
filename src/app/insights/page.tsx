import Link from 'next/link';
import { HBarChart, PairBars } from '@/components/charts';
import { EmptyState, PageHeader, SectionTitle, StatTile } from '@/components/ui';
import { dashboardStats, insights, offerComparison, type InsightGroup } from '@/lib/repo';
import { formatMoney, titleCase } from '@/lib/util';

export const dynamic = 'force-dynamic';

export default function InsightsPage() {
  const data = insights();
  const offers = offerComparison();
  const stats = dashboardStats();

  const hasData = data.byField.some((group) => group.total > 0);

  return (
    <div>
      <PageHeader
        title="Insights"
        subtitle="What's actually working in your search — and where applications are stalling."
      />

      <div className="space-y-6 p-4 sm:p-6">
        {!hasData ? (
          <EmptyState
            title="Not enough data yet"
            action={
              <Link href="/" className="btn btn-primary btn-sm">
                Find internships to apply to
              </Link>
            }
          >
            Once you have a handful of applications with outcomes, this page breaks down your
            response rate by field, season, and company, shows whether referrals are helping, and
            tells you which stage is costing you the most.
          </EmptyState>
        ) : (
          <>
            <section>
              <SectionTitle>Headline numbers</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  label="Response rate"
                  value={`${stats.responseRate}%`}
                  hint={`${stats.responded} of ${stats.submitted} submissions`}
                  tone={stats.responseRate >= 15 ? 'good' : 'neutral'}
                />
                <StatTile
                  label="Offer rate"
                  value={`${stats.offerRate}%`}
                  tone={stats.offers > 0 ? 'good' : 'neutral'}
                />
                <StatTile
                  label="Median reply time"
                  value={stats.medianDaysToResponse != null ? `${stats.medianDaysToResponse} days` : '—'}
                />
                <StatTile
                  label="Rejections"
                  value={stats.rejections}
                  hint="explicit no's — not counting silence"
                />
              </div>
            </section>

            {/* Does a referral help? This is the most actionable comparison here. */}
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="card p-4">
                <h2 className="text-[0.8125rem] font-semibold">Do referrals help you?</h2>
                <p className="mt-0.5 mb-3 text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
                  Response rate on referred applications versus cold ones.
                </p>
                {data.referralEffect.referralCount === 0 ? (
                  <p className="py-3 text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
                    No referred applications yet. Mark one as referred to see the comparison — for
                    most students this is the single biggest lever.
                  </p>
                ) : (
                  <PairBars
                    a={{
                      label: 'With a referral',
                      value: data.referralEffect.referralRate,
                      detail: `${data.referralEffect.referralCount} submitted`,
                    }}
                    b={{
                      label: 'Cold application',
                      value: data.referralEffect.coldRate,
                      detail: `${data.referralEffect.coldCount} submitted`,
                    }}
                  />
                )}
              </div>

              <div className="card p-4">
                <h2 className="mb-3 text-[0.8125rem] font-semibold">Where you get rejected</h2>
                {data.rejectionsByStage.length === 0 ? (
                  <p className="py-3 text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
                    No rejection stages recorded. When you mark an application rejected, set the
                    stage — knowing whether you fail at the resume screen or the final round changes
                    what you should practise.
                  </p>
                ) : (
                  <HBarChart
                    data={data.rejectionsByStage.map((group) => ({
                      label: titleCase(group.key),
                      value: group.total,
                    }))}
                    caption="Rejections by stage"
                    valueLabel="Rejections"
                  />
                )}
              </div>
            </section>

            <GroupSection
              title="By field"
              hint="Response rate per field. A low rate with high volume usually means the resume needs tailoring for that field."
              groups={data.byField}
            />

            <GroupSection
              title="By season"
              hint="Which recruiting cycles you've engaged with."
              groups={data.bySeason}
            />

            <GroupSection
              title="By how you found the role"
              hint="Career fairs and referrals often convert far better than cold applications."
              groups={data.byOrigin.map((g) => ({ ...g, key: titleCase(g.key) }))}
            />

            <section>
              <SectionTitle>Top companies by applications</SectionTitle>
              <div className="card p-4">
                <HBarChart
                  data={data.byCompany.map((group) => ({
                    label: group.key,
                    value: group.total,
                    detail: `${group.submitted} submitted · ${group.responded} responded · ${group.offers} offers`,
                  }))}
                  caption="Applications per company"
                  valueLabel="Applications"
                />
              </div>
            </section>

            {/* Offer comparison */}
            <section>
              <SectionTitle>Offer comparison</SectionTitle>
              <div className="card p-4">
                {offers.length === 0 ? (
                  <p className="text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
                    No offers recorded yet. Add one from an application and this table compares total
                    packages side by side, including a cost-of-living adjustment so a New York offer
                    and a Austin offer can be compared honestly.
                  </p>
                ) : (
                  <div className="scroll-x">
                    <table className="w-full text-[0.8125rem]">
                      <thead>
                        <tr
                          className="border-b text-left"
                          style={{ borderColor: 'var(--line)', color: 'var(--ink-muted)' }}
                        >
                          <th className="py-2 pr-3 font-medium">Company</th>
                          <th className="py-2 pr-3 font-medium">Rate</th>
                          <th className="py-2 pr-3 font-medium">Hourly equiv.</th>
                          <th className="py-2 pr-3 font-medium">Extras</th>
                          <th className="py-2 pr-3 font-medium">Total</th>
                          <th className="py-2 pr-3 font-medium">COL adjusted</th>
                          <th className="py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offers.map((offer) => (
                          <tr
                            key={offer.id as number}
                            className="border-b last:border-0"
                            style={{ borderColor: 'var(--line)' }}
                          >
                            <td className="py-2 pr-3 font-medium">
                              <Link href={`/tracker/${offer.application_id}`} className="link">
                                {offer.company}
                              </Link>
                            </td>
                            <td className="tnum py-2 pr-3">
                              {formatMoney(Number(offer.pay_rate), String(offer.currency ?? 'USD'))}
                              {offer.pay_period === 'hour' ? '/hr' : offer.pay_period === 'month' ? '/mo' : '/yr'}
                            </td>
                            <td className="tnum py-2 pr-3">${offer.hourly}/hr</td>
                            <td className="tnum py-2 pr-3">
                              {offer.extras > 0 ? formatMoney(offer.extras) : '—'}
                            </td>
                            <td className="tnum py-2 pr-3 font-medium">{formatMoney(offer.total)}</td>
                            <td className="tnum py-2 pr-3">{formatMoney(offer.adjustedTotal)}</td>
                            <td className="py-2">{titleCase(String(offer.status))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
                      COL adjusted divides the total package by the cost-of-living index you entered
                      (100 = US average), so offers in expensive cities are compared fairly.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function GroupSection({
  title,
  hint,
  groups,
}: {
  title: string;
  hint: string;
  groups: InsightGroup[];
}) {
  const withSubmissions = groups.filter((group) => group.submitted > 0);

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="card p-4">
        <p className="mb-3 text-[0.75rem]" style={{ color: 'var(--ink-secondary)' }}>
          {hint}
        </p>
        {withSubmissions.length === 0 ? (
          <p className="text-[0.75rem]" style={{ color: 'var(--ink-muted)' }}>
            No submitted applications in this breakdown yet.
          </p>
        ) : (
          <HBarChart
            data={withSubmissions.map((group) => ({
              label: group.key,
              value: group.responseRate,
              detail: `${group.responded} of ${group.submitted} responded · ${group.offers} offers`,
            }))}
            valueSuffix="%"
            valueLabel="Response rate"
            caption={`Response rate ${title.toLowerCase()}`}
            max={100}
          />
        )}
      </div>
    </section>
  );
}
