import type { RawListing } from '../parse';
import { fetchText, getJson } from './http';

/**
 * Adapters for employers big enough to run their own careers API.
 *
 * These do not sit on any shared ATS, so nothing else in the pipeline can reach
 * them, and they are exactly the companies people look for first. Each one is
 * a single source rather than a per-company board.
 */

// -------------------------------------------------------------------- Amazon

interface AmazonJob {
  id?: string;
  id_icims?: string;
  title?: string;
  job_path?: string;
  posted_date?: string;
  updated_time?: string;
  description?: string;
  description_short?: string;
  basic_qualifications?: string;
  preferred_qualifications?: string;
  normalized_location?: string;
  location?: string;
  city?: string;
  state?: string;
  country_code?: string;
  locations?: string[];
  job_category?: string;
  team?: { business_category?: string; label?: string } | string;
  business_category?: string;
  job_schedule_type?: string;
  is_intern?: boolean;
  university_job?: boolean | string;
}

const AMAZON_PAGE = 100;
const AMAZON_MAX_PAGES = 12;

/** Amazon's search matches whole phrases, so several passes cover the vocabulary. */
const AMAZON_QUERIES = ['internship', 'intern', 'co-op', 'student programs', 'apprenticeship'];

/** "July 31, 2026" or an ISO date, depending on which field it came from. */
const amazonDate = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

export async function fetchAmazon(): Promise<RawListing[]> {
  const found = new Map<string, AmazonJob>();

  for (const query of AMAZON_QUERIES) {
    for (let pageIndex = 0; pageIndex < AMAZON_MAX_PAGES; pageIndex++) {
      const url =
        `https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(query)}` +
        `&offset=${pageIndex * AMAZON_PAGE}&result_limit=${AMAZON_PAGE}&sort=recent`;
      const data = await getJson<{ jobs?: AmazonJob[]; hits?: number }>(url, {
        timeoutMs: 45_000,
      });
      const jobs = data?.jobs ?? [];
      for (const job of jobs) {
        const id = job.id_icims ?? job.id ?? job.job_path;
        if (id) found.set(String(id), job);
      }
      if (jobs.length < AMAZON_PAGE) break;
    }
  }

  return [...found.values()]
    .map((job): RawListing => {
      const team = typeof job.team === 'string' ? job.team : job.team?.label;
      const description = [job.description, job.basic_qualifications, job.preferred_qualifications]
        .filter(Boolean)
        .join('\n\n');

      return {
        source: 'amazon',
        sourceKind: 'ats',
        sourceId: String(job.id_icims ?? job.id ?? job.job_path),
        company: 'Amazon',
        companyUrl: 'https://www.amazon.jobs',
        title: job.title ?? '',
        applyUrl: `https://www.amazon.jobs${job.job_path ?? ''}`,
        description: description || job.description_short || null,
        locations: [
          job.normalized_location ?? job.location,
          ...(job.locations ?? []),
        ].filter(Boolean) as string[],
        remoteFlag: /virtual|remote/i.test(job.normalized_location ?? job.location ?? '')
          ? true
          : null,
        terms: [],
        datePosted: amazonDate(job.posted_date),
        dateUpdated: amazonDate(job.updated_time) ?? amazonDate(job.posted_date),
        categoryHint: [job.job_category, job.business_category, team].filter(Boolean).join(', '),
        activeFlag: true,
        // Amazon labels student roles outright; keep that as a searchable tag.
        tags: [
          job.is_intern ? 'amazon:intern' : null,
          job.university_job ? 'amazon:university' : null,
        ].filter(Boolean) as string[],
      };
    })
    .filter((l) => l.title && l.applyUrl !== 'https://www.amazon.jobs');
}

// --------------------------------------------------------------------- Ripple
// (Rippling's ATS, used by a few hundred startups on ats.rippling.com.)

interface RipplingJob {
  uuid?: string;
  name?: string;
  url?: string;
  department?: { label?: string };
  workLocation?: { label?: string };
  workLocations?: { label?: string }[];
  employmentType?: string;
  descriptionHtml?: string;
  description?: string;
  isRemote?: boolean;
  createdAt?: string;
  publishedAt?: string;
}

export async function fetchRippling(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<RipplingJob[]>(
    `https://api.rippling.com/platform/api/ats/v1/board/${encodeURIComponent(token)}/jobs`,
    { timeoutMs: 40_000 },
  );
  if (!Array.isArray(data)) return [];

  const secs = (iso: string | undefined) => {
    if (!iso) return null;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? Math.floor(t / 1000) : null;
  };

  return data
    .map((job): RawListing => ({
      source: `rippling:${token}`,
      sourceKind: 'ats',
      sourceId: job.uuid ?? job.name ?? '',
      company: label,
      title: job.name ?? '',
      applyUrl:
        job.url ?? `https://ats.rippling.com/${encodeURIComponent(token)}/jobs/${job.uuid}`,
      description: job.descriptionHtml ?? job.description ?? null,
      locations: [
        job.workLocation?.label,
        ...(job.workLocations ?? []).map((l) => l.label),
      ].filter(Boolean) as string[],
      remoteFlag: job.isRemote ?? null,
      terms: [],
      datePosted: secs(job.publishedAt ?? job.createdAt),
      dateUpdated: secs(job.publishedAt ?? job.createdAt),
      categoryHint: job.department?.label ?? '',
      activeFlag: true,
      tags: job.employmentType ? [`employment:${job.employmentType}`] : [],
    }))
    .filter((l) => l.title && l.sourceId);
}

// ------------------------------------------------------------------- BambooHR

interface BambooJob {
  id?: number | string;
  jobOpeningName?: string;
  departmentLabel?: string;
  employmentStatusLabel?: string;
  location?: { city?: string; state?: string };
  atsLocation?: { city?: string; state?: string; country?: string };
  isRemote?: boolean | string;
  locationType?: string | number;
}

export async function fetchBamboo(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<{ result?: BambooJob[] }>(
    `https://${encodeURIComponent(token)}.bamboohr.com/careers/list`,
    { timeoutMs: 30_000 },
  );
  const jobs = data?.result ?? [];

  return jobs
    .map((job): RawListing => {
      const place = job.atsLocation ?? job.location ?? {};
      const location = [place.city, place.state, (place as { country?: string }).country]
        .filter(Boolean)
        .join(', ');
      return {
        source: `bamboohr:${token}`,
        sourceKind: 'ats',
        sourceId: String(job.id ?? job.jobOpeningName),
        company: label,
        title: job.jobOpeningName ?? '',
        applyUrl: `https://${token}.bamboohr.com/careers/${job.id}`,
        description: null, // the list endpoint is metadata-only
        locations: location ? [location] : [],
        remoteFlag: job.isRemote === true || job.isRemote === 'true' ? true : null,
        terms: [],
        datePosted: null,
        dateUpdated: null,
        categoryHint: job.departmentLabel ?? '',
        activeFlag: true,
        tags: job.employmentStatusLabel ? [`employment:${job.employmentStatusLabel}`] : [],
      };
    })
    .filter((l) => l.title && l.sourceId);
}

// --------------------------------------------------------------------- Breezy

interface BreezyJob {
  id?: string;
  friendly_id?: string;
  name?: string;
  url?: string;
  published_date?: string;
  description?: string;
  type?: { name?: string };
  location?: {
    name?: string;
    city?: string;
    country?: { name?: string };
    is_remote?: boolean;
  };
  department?: string;
}

export async function fetchBreezy(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<BreezyJob[]>(
    `https://${encodeURIComponent(token)}.breezy.hr/json`,
    { timeoutMs: 30_000 },
  );
  if (!Array.isArray(data)) return [];

  return data
    .map((job): RawListing => {
      const location = [job.location?.city ?? job.location?.name, job.location?.country?.name]
        .filter(Boolean)
        .join(', ');
      const published = job.published_date ? Date.parse(job.published_date) : NaN;
      return {
        source: `breezy:${token}`,
        sourceKind: 'ats',
        sourceId: job.id ?? job.friendly_id ?? '',
        company: label,
        title: job.name ?? '',
        applyUrl: job.url ?? `https://${token}.breezy.hr/p/${job.friendly_id}`,
        description: job.description ?? null,
        locations: location ? [location] : [],
        remoteFlag: job.location?.is_remote ?? null,
        terms: [],
        datePosted: Number.isFinite(published) ? Math.floor(published / 1000) : null,
        dateUpdated: Number.isFinite(published) ? Math.floor(published / 1000) : null,
        categoryHint: job.department ?? '',
        activeFlag: true,
        tags: job.type?.name ? [`employment:${job.type.name}`] : [],
      };
    })
    .filter((l) => l.title && l.sourceId);
}

// ------------------------------------------------------------------- Personio

/**
 * Personio publishes an XML feed rather than JSON. It is the default ATS for
 * mid-size European employers, which is where most non-US internships live.
 */
export async function fetchPersonio(token: string, label: string): Promise<RawListing[]> {
  const xml = await fetchText(`https://${encodeURIComponent(token)}.jobs.personio.de/xml`, {
    timeoutMs: 30_000,
  });
  if (!xml) return [];

  const positions = xml.split(/<position>/i).slice(1);
  return positions
    .map((block): RawListing => {
      const tag = (name: string): string | null => {
        const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i').exec(block);
        if (!match) return null;
        return match[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim() || null;
      };
      const id = tag('id') ?? '';
      const created = tag('createdAt');
      const createdAt = created ? Date.parse(created) : NaN;
      return {
        source: `personio:${token}`,
        sourceKind: 'ats',
        sourceId: id,
        company: tag('subcompany') || label,
        title: tag('name') ?? '',
        applyUrl: `https://${token}.jobs.personio.de/job/${id}`,
        description: [tag('jobDescriptions'), tag('description')].filter(Boolean).join('\n') || null,
        locations: [tag('office'), tag('country')].filter(Boolean) as string[],
        terms: [],
        datePosted: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : null,
        dateUpdated: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : null,
        categoryHint: tag('department') ?? '',
        // Personio states the contract type, and "intern" is one of its values.
        activeFlag: true,
        tags: [tag('employmentType'), tag('schedule')]
          .filter(Boolean)
          .map((t) => `employment:${t}`),
      };
    })
    .filter((l) => l.title && l.sourceId);
}
