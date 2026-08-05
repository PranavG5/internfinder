import type { RawListing } from '../parse';
import { decodeHtmlEntities, isEscapedHtml } from '../util';
import { getJson } from './http';

/**
 * Adapters for applicant-tracking-system job boards.
 *
 * These are the highest-signal sources for openness: a role appears on a
 * company's own board only while that board is accepting applications, so
 * "present in the feed" is direct evidence the posting is live.
 */

const secs = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

// ---------------------------------------------------------------- Greenhouse

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  first_published?: string;
  application_deadline?: string | null;
  requisition_id?: string;
  company_name?: string;
  content?: string;
  location?: { name?: string };
  offices?: { name?: string; location?: string }[];
  departments?: { name?: string }[];
  metadata?: { name?: string; value?: unknown }[];
}

export async function fetchGreenhouse(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<{ jobs?: GreenhouseJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
  );
  if (!data?.jobs) return [];

  return data.jobs.map((job) => {
    const locations = [
      job.location?.name,
      ...(job.offices ?? []).map((o) => o.name ?? o.location),
    ].filter(Boolean) as string[];

    // Greenhouse returns entity-escaped HTML in `content`.
    const description = job.content
      ? isEscapedHtml(job.content)
        ? decodeHtmlEntities(job.content)
        : job.content
      : null;

    return {
      source: `greenhouse:${token}`,
      sourceKind: 'ats',
      sourceId: String(job.id),
      company: job.company_name?.trim() || label,
      companyUrl: null,
      title: job.title ?? '',
      applyUrl: job.absolute_url,
      description,
      locations,
      terms: [],
      datePosted: secs(job.first_published) ?? secs(job.updated_at),
      dateUpdated: secs(job.updated_at),
      deadline: secs(job.application_deadline),
      categoryHint: (job.departments ?? []).map((d) => d.name).filter(Boolean).join(', '),
      activeFlag: true,
    } satisfies RawListing;
  });
}

// --------------------------------------------------------------------- Lever

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  country?: string;
  workplaceType?: string;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  categories?: {
    commitment?: string;
    location?: string;
    team?: string;
    department?: string;
    allLocations?: string[];
  };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

const LEVER_INTERVAL: Record<string, string> = {
  'per-year-salary': 'year',
  'per-month-salary': 'month',
  'per-hour-wage': 'hour',
  'per-week-salary': 'month',
};

export async function fetchLever(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<LeverPosting[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
  );
  if (!Array.isArray(data)) return [];

  return data.map((post) => {
    const locations = [
      ...(post.categories?.allLocations ?? []),
      post.categories?.location,
    ].filter(Boolean) as string[];

    const body = [post.descriptionPlain ?? post.description, post.additionalPlain]
      .filter(Boolean)
      .join('\n\n');

    const period = post.salaryRange?.interval
      ? LEVER_INTERVAL[post.salaryRange.interval] ?? null
      : null;

    return {
      source: `lever:${token}`,
      sourceKind: 'ats',
      sourceId: post.id,
      company: label,
      title: post.text ?? '',
      applyUrl: post.applyUrl || post.hostedUrl,
      description: body || null,
      locations,
      remoteFlag: post.workplaceType ? /remote/i.test(post.workplaceType) : null,
      // Lever states the employment type outright, the strongest internship signal available.
      terms: [],
      datePosted: post.createdAt ? Math.floor(post.createdAt / 1000) : null,
      dateUpdated: post.createdAt ? Math.floor(post.createdAt / 1000) : null,
      categoryHint: [post.categories?.team, post.categories?.department]
        .filter(Boolean)
        .join(', '),
      salaryMin: post.salaryRange?.min ?? null,
      salaryMax: post.salaryRange?.max ?? null,
      salaryPeriod: period,
      salaryCurrency: post.salaryRange?.currency ?? null,
      activeFlag: true,
      tags: post.categories?.commitment ? [`commitment:${post.categories.commitment}`] : [],
    } satisfies RawListing;
  });
}

// --------------------------------------------------------------------- Ashby

interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  publishedAt?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  compensation?: {
    compensationTierSummary?: string;
    scrapeableCompensationSalarySummary?: string;
    summaryComponents?: {
      compensationType?: string;
      interval?: string;
      currencyCode?: string;
      minValue?: number;
      maxValue?: number;
    }[];
  };
}

const ASHBY_INTERVAL: Record<string, string> = {
  '1 YEAR': 'year',
  '1 MONTH': 'month',
  '1 HOUR': 'hour',
  '1 WEEK': 'month',
};

export async function fetchAshby(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<{ jobs?: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`,
  );
  if (!data?.jobs) return [];

  return data.jobs
    .filter((job) => job.isListed !== false)
    .map((job) => {
      const locations = [
        job.location,
        ...(job.secondaryLocations ?? []).map((l) => l.location),
      ].filter(Boolean) as string[];

      const salary = (job.compensation?.summaryComponents ?? []).find(
        (c) => c.compensationType === 'Salary' || c.minValue != null,
      );

      return {
        source: `ashby:${token}`,
        sourceKind: 'ats',
        sourceId: job.id,
        company: label,
        title: job.title ?? '',
        applyUrl: job.applyUrl || job.jobUrl || '',
        description: job.descriptionPlain ?? job.descriptionHtml ?? null,
        locations,
        remoteFlag: job.isRemote ?? (job.workplaceType ? /remote/i.test(job.workplaceType) : null),
        terms: [],
        datePosted: secs(job.publishedAt),
        dateUpdated: secs(job.publishedAt),
        categoryHint: [job.department, job.team].filter(Boolean).join(', '),
        salaryMin: salary?.minValue ?? null,
        salaryMax: salary?.maxValue ?? null,
        salaryPeriod: salary?.interval ? ASHBY_INTERVAL[salary.interval] ?? null : null,
        salaryCurrency: salary?.currencyCode ?? null,
        activeFlag: true,
        tags: job.employmentType ? [`employment:${job.employmentType}`] : [],
      } satisfies RawListing;
    })
    .filter((l) => l.applyUrl);
}

// ----------------------------------------------------------- SmartRecruiters

interface SrPosting {
  id: string;
  name: string;
  releasedDate?: string;
  company?: { name?: string };
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
  typeOfEmployment?: { label?: string };
  department?: { label?: string };
  ref?: string;
}

export async function fetchSmartRecruiters(token: string, label: string): Promise<RawListing[]> {
  const collected: SrPosting[] = [];
  const limit = 100;

  // The API pages with an offset and caps out at 100 per page.
  for (let offset = 0; offset < 500; offset += limit) {
    const page = await getJson<{ content?: SrPosting[]; totalFound?: number }>(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings?limit=${limit}&offset=${offset}&q=intern`,
    );
    const batch = page?.content ?? [];
    collected.push(...batch);
    if (batch.length < limit) break;
  }

  return collected.map((post) => {
    const loc = post.location ?? {};
    const locationParts = [loc.city, loc.region, loc.country].filter(Boolean) as string[];
    return {
      source: `smartrecruiters:${token}`,
      sourceKind: 'ats',
      sourceId: post.id,
      company: post.company?.name?.trim() || label,
      title: post.name ?? '',
      applyUrl: `https://jobs.smartrecruiters.com/${encodeURIComponent(token)}/${post.id}`,
      description: null, // full text needs a per-posting request; title carries the signal
      locations: locationParts.length ? [locationParts.join(', ')] : [],
      remoteFlag: loc.remote ?? null,
      terms: [],
      datePosted: secs(post.releasedDate),
      dateUpdated: secs(post.releasedDate),
      categoryHint: post.department?.label ?? '',
      activeFlag: true,
      tags: post.typeOfEmployment?.label ? [`employment:${post.typeOfEmployment.label}`] : [],
    } satisfies RawListing;
  });
}
