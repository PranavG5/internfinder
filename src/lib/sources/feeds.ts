import type { RawListing } from '../parse';
import { decodeHtmlEntities } from '../util';
import { getJson } from './http';

/**
 * Community-maintained and public job feeds.
 *
 * These give broad coverage across thousands of employers. Each carries its own
 * openness signal, which the pipeline respects:
 *   - the GitHub internship lists publish an `active` flag per listing
 *   - RemoteOK and Arbeitnow only serve currently-posted roles
 */

// -------------------------------------------------- GitHub internship lists

interface GithubListing {
  id: string;
  title: string;
  company_name: string;
  company_url?: string;
  url: string;
  locations?: string[];
  terms?: string[];
  season?: string;
  sponsorship?: string;
  degrees?: string[];
  category?: string;
  active?: boolean;
  is_visible?: boolean;
  date_posted?: number;
  date_updated?: number;
  source?: string;
}

const GITHUB_FEEDS: Record<string, { url: string; label: string }> = {
  'simplify-summer': {
    url: 'https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json',
    label: 'SimplifyJobs Summer 2026',
  },
  'vansh-summer': {
    url: 'https://raw.githubusercontent.com/vanshb03/Summer2026-Internships/dev/.github/scripts/listings.json',
    label: 'vanshb03 Summer 2026',
  },
  // New-grad postings are mostly not internships and get filtered out on the
  // way in, but the archive names ~2,600 employer job boards, and every one it
  // reveals is a board the discovery pass can crawl for internships directly.
  'simplify-newgrad': {
    url: 'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json',
    label: 'SimplifyJobs New Grad',
  },
  // Same schema, separately maintained, and its employers barely overlap with
  // the Simplify archive above.
  'cvrve-newgrad': {
    url: 'https://raw.githubusercontent.com/cvrve/New-Grad/dev/.github/scripts/listings.json',
    label: 'cvrve New Grad',
  },
};

export async function fetchGithubList(token: string): Promise<RawListing[]> {
  const feed = GITHUB_FEEDS[token];
  if (!feed) return [];

  const data = await getJson<GithubListing[]>(feed.url, { timeoutMs: 90_000 });
  if (!Array.isArray(data)) return [];

  return data
    // Hidden entries are editorial removals; drop them outright.
    .filter((item) => item.is_visible !== false && item.url && item.title && item.company_name)
    .map((item) => {
      const terms = item.terms?.length ? item.terms : item.season ? [item.season] : [];
      return {
        source: `github:${token}`,
        sourceKind: 'aggregator',
        sourceId: item.id,
        company: item.company_name,
        companyUrl: item.company_url || null,
        title: item.title,
        applyUrl: item.url,
        description: null, // these feeds are metadata-only
        locations: item.locations ?? [],
        terms,
        datePosted: item.date_posted ?? null,
        dateUpdated: item.date_updated ?? item.date_posted ?? null,
        categoryHint: item.category ?? '',
        sponsorshipHint: item.sponsorship ?? null,
        degreeHints: item.degrees ?? [],
        // The feed's own flag is authoritative: false means delisted upstream.
        activeFlag: item.active !== false,
      } satisfies RawListing;
    });
}

// ------------------------------------------------------------------ RemoteOK

interface RemoteOkJob {
  id?: string;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  salary_min?: number;
  salary_max?: number;
}

export async function fetchRemoteOk(): Promise<RawListing[]> {
  const data = await getJson<RemoteOkJob[]>('https://remoteok.com/api');
  if (!Array.isArray(data)) return [];

  return data
    // The first element of this feed is a legal/attribution notice, not a job.
    .filter((job) => job.id && job.position && job.company)
    .map((job): RawListing => ({
      source: 'remoteok',
      sourceKind: 'board',
      sourceId: String(job.id),
      company: decodeHtmlEntities(job.company ?? ''),
      title: decodeHtmlEntities(job.position ?? ''),
      applyUrl: job.apply_url || job.url || `https://remoteok.com/remote-jobs/${job.slug}`,
      description: job.description ?? null,
      locations: job.location ? [job.location] : ['Remote'],
      remoteFlag: true,
      terms: [],
      datePosted: job.epoch ?? (job.date ? Math.floor(Date.parse(job.date) / 1000) : null),
      dateUpdated: job.epoch ?? null,
      categoryHint: (job.tags ?? []).slice(0, 6).join(', '),
      // RemoteOK quotes annual USD figures.
      salaryMin: job.salary_min ?? null,
      salaryMax: job.salary_max ?? null,
      salaryPeriod: job.salary_min ? 'year' : null,
      salaryCurrency: 'USD',
      activeFlag: true,
      tags: (job.tags ?? []).slice(0, 8),
    }))
    .filter((l) => l.applyUrl && l.company && l.title);
}

// -------------------------------------------------------------------- Jobicy

interface JobicyJob {
  id?: number | string;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  companyLogo?: string;
  jobIndustry?: string[] | string;
  jobType?: string[] | string;
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  annualSalaryMin?: number;
  annualSalaryMax?: number;
  salaryCurrency?: string;
}

export async function fetchJobicy(): Promise<RawListing[]> {
  // Jobicy caps count at 100; the internship tag keeps the feed on-topic.
  const data = await getJson<{ jobs?: JobicyJob[] }>(
    'https://jobicy.com/api/v2/remote-jobs?count=100&tag=intern',
  );
  const jobs = data?.jobs ?? [];

  return jobs
    .filter((job) => job.id && job.jobTitle && job.companyName && job.url)
    .map((job): RawListing => {
      const asList = (v: string[] | string | undefined): string[] =>
        Array.isArray(v) ? v : v ? [v] : [];
      return {
        source: 'jobicy',
        sourceKind: 'board',
        sourceId: String(job.id),
        company: decodeHtmlEntities(job.companyName ?? ''),
        title: decodeHtmlEntities(job.jobTitle ?? ''),
        applyUrl: job.url ?? '',
        description: job.jobDescription ?? job.jobExcerpt ?? null,
        locations: job.jobGeo ? [job.jobGeo] : ['Remote'],
        remoteFlag: true,
        terms: [],
        datePosted: job.pubDate ? Math.floor(Date.parse(job.pubDate) / 1000) || null : null,
        dateUpdated: null,
        categoryHint: [...asList(job.jobIndustry), ...asList(job.jobType)].slice(0, 6).join(', '),
        salaryMin: job.annualSalaryMin ?? null,
        salaryMax: job.annualSalaryMax ?? null,
        salaryPeriod: job.annualSalaryMin ? 'year' : null,
        salaryCurrency: job.salaryCurrency ?? 'USD',
        activeFlag: true,
        tags: asList(job.jobType).slice(0, 6),
      };
    });
}

// ---------------------------------------------------------------- The Muse

interface MuseJob {
  id?: number;
  name?: string;
  contents?: string;
  publication_date?: string;
  type?: string;
  short_name?: string;
  company?: { name?: string; short_name?: string };
  locations?: { name?: string }[];
  categories?: { name?: string }[];
  levels?: { name?: string; short_name?: string }[];
  tags?: { name?: string; short_name?: string }[];
  refs?: { landing_page?: string };
}

/**
 * The Muse indexes employers that the ATS crawlers never reach: hospital
 * systems, health insurers, clinics, school districts and government agencies
 * post here even when their own careers site is a closed portal.
 *
 * The catalog is queried once broadly and once per category that a private
 * board search would otherwise miss, because the API returns at most 100 pages
 * for any single query.
 */
const MUSE_QUERIES: { category?: string; label: string }[] = [
  { label: 'all internships' },
  { category: 'Healthcare', label: 'healthcare' },
  { category: 'Science and Engineering', label: 'science' },
  { category: 'Education', label: 'education' },
  // One query can only reach 100 pages, so every category worth naming is
  // asked for separately. These are the categories the catalog actually
  // answers for at the internship level; the ones that come back empty are
  // left out rather than spending a request on nothing.
  { category: 'Software Engineering', label: 'software' },
  { category: 'Data and Analytics', label: 'data' },
  { category: 'Human Resources and Recruitment', label: 'people' },
  { category: 'Business Operations', label: 'operations' },
  { category: 'Accounting and Finance', label: 'finance' },
  { category: 'Project Management', label: 'project management' },
  { category: 'Product Management', label: 'product' },
  { category: 'Sales', label: 'sales' },
  { category: 'Transportation and Logistics', label: 'logistics' },
  { category: 'Design and UX', label: 'design' },
  { category: 'Legal Services', label: 'legal' },
  { category: 'Media, PR, and Communications', label: 'communications' },
  { category: 'Customer Service', label: 'customer service' },
  { category: 'Retail', label: 'retail' },
  { category: 'Construction', label: 'construction' },
  { category: 'Real Estate', label: 'real estate' },
  { category: 'Personal Care and Services', label: 'personal care' },
  { category: 'Protective Services', label: 'protective services' },
];

/**
 * Pages per query. The API serves 20 per page and refuses page 100 or higher.
 *
 * Healthcare alone runs past 170 pages, so anything short of the ceiling is
 * throwing away listings that the catalog is being asked for by name.
 */
const MUSE_MAX_PAGES = 99;

export async function fetchMuse(): Promise<RawListing[]> {
  const found = new Map<number, MuseJob>();

  for (const query of MUSE_QUERIES) {
    for (let page = 0; page < MUSE_MAX_PAGES; page++) {
      const url =
        `https://www.themuse.com/api/public/jobs?page=${page}&level=Internship` +
        (query.category ? `&category=${encodeURIComponent(query.category)}` : '');

      // A page past the end answers 400, which means "done", not "broken".
      const data = await getJson<{ results?: MuseJob[]; page_count?: number }>(url, {
        timeoutMs: 30_000,
        tolerate: [400, 403, 404],
      });
      const batch = data?.results ?? [];
      for (const job of batch) if (job.id) found.set(job.id, job);
      if (batch.length === 0 || page + 1 >= (data?.page_count ?? 0)) break;
    }
  }

  return [...found.values()]
    .map((job): RawListing => ({
      source: 'muse',
      sourceKind: 'aggregator',
      sourceId: String(job.id),
      company: decodeHtmlEntities(job.company?.name ?? ''),
      title: decodeHtmlEntities(job.name ?? ''),
      applyUrl: job.refs?.landing_page ?? '',
      description: job.contents ?? null,
      locations: (job.locations ?? []).map((l) => l.name).filter(Boolean) as string[],
      terms: [],
      datePosted: job.publication_date ? Math.floor(Date.parse(job.publication_date) / 1000) || null : null,
      dateUpdated: null,
      categoryHint: (job.categories ?? []).map((c) => c.name).filter(Boolean).join(', '),
      activeFlag: true,
      tags: (job.tags ?? []).map((t) => t.name).filter(Boolean).slice(0, 6) as string[],
    }))
    .filter((l) => l.applyUrl && l.company && l.title);
}

// ----------------------------------------------------------------- Arbeitnow

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

export async function fetchArbeitnow(): Promise<RawListing[]> {
  const collected: ArbeitnowJob[] = [];

  // Paginate deep; the feed is ordered newest-first and Europe posts steadily.
  for (let page = 1; page <= 12; page++) {
    const data = await getJson<{ data?: ArbeitnowJob[] }>(
      `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
    );
    const batch = data?.data ?? [];
    if (batch.length === 0) break;
    collected.push(...batch);
  }

  return collected
    .filter((job) => job.slug && job.title && job.company_name)
    .map((job): RawListing => ({
      source: 'arbeitnow',
      sourceKind: 'board',
      sourceId: job.slug,
      company: job.company_name,
      title: job.title,
      applyUrl: job.url || `https://www.arbeitnow.com/jobs/${job.slug}`,
      description: job.description ?? null,
      locations: job.location ? [job.location] : [],
      remoteFlag: job.remote ?? null,
      terms: [],
      datePosted: job.created_at ?? null,
      dateUpdated: job.created_at ?? null,
      categoryHint: (job.tags ?? []).slice(0, 6).join(', '),
      activeFlag: true,
      tags: (job.job_types ?? []).slice(0, 6),
    }));
}
