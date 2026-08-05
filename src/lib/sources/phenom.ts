import type { RawListing } from '../parse';
import { getJson, postJson } from './http';

/**
 * Phenom People adapter, which is how most of American healthcare hires.
 *
 * Hospitals and health systems rarely expose an ATS board directly. They put a
 * branded careers site in front of it (careers.chop.edu, jobs.sutterhealth.org,
 * careers.wellstar.org), and almost all of those sites are Phenom. Every one of
 * them answers the same unauthenticated widget API:
 *
 *   POST https://{host}/widgets  {ddoKey: "refineSearch", keywords, from, size}
 *   POST https://{host}/widgets  {ddoKey: "jobDetail", jobId, jobSeqNo}
 *
 * The board token is just the careers hostname, since that is the only thing
 * that varies between tenants.
 *
 * One useful side effect: each posting carries an `applyUrl` pointing at the
 * ATS underneath (usually Workday), so syncing a Phenom site also teaches the
 * discovery pass about the employer's real board.
 */

/** Results per request. The API accepts larger values but starts truncating. */
const PAGE = 50;
/** Pages to pull per keyword. 5 x 50 = 250, which covers any real intern cohort. */
const MAX_PAGES = 5;
/** Descriptions cost one request each, so cap them per board. */
const MAX_DETAILS = 120;

/**
 * Keywords to search, unioned. Health systems label student roles
 * inconsistently: "Nurse Intern", "Student Nurse Extern", "Pharmacy Resident",
 * "Research Fellowship". No single query finds them all.
 */
const QUERIES = ['intern', 'student', 'co-op', 'fellowship', 'research assistant'];

interface PhenomJob {
  jobId?: string;
  jobSeqNo?: string;
  reqId?: string;
  title?: string;
  applyUrl?: string;
  descriptionTeaser?: string;
  description?: string;
  postedDate?: string;
  dateCreated?: string;
  location?: string;
  multi_location?: string[];
  city?: string;
  state?: string;
  country?: string;
  category?: string;
  subCategory?: string;
  industry?: string;
  type?: string;
  ml_skills?: string[];
}

interface RefineSearch {
  refineSearch?: {
    totalHits?: number;
    data?: { jobs?: PhenomJob[] };
  };
}

interface JobDetail {
  jobDetail?: {
    data?: { job?: PhenomJob };
  };
}

const isoSecs = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

/** Titles worth spending a description request on. */
const INTERNISH_TITLE =
  /\bintern(?:ship|ships|s)?\b|\bco-?ops?\b|\bapprentice|\bextern(?:ship)?\b|\bfellow(?:ship)?\b|\bstudent\b|\bscholar\b|\bshadow(?:ing)?\b|\bsummer\s+(?:analyst|associate|program|scholar|research)\b|\bresearch\s+(?:assistant|associate|trainee)\b|\bpre-?(?:med|health)\b|\bpost-?bac/i;

/** Shared request envelope. Phenom rejects calls that omit these keys. */
function searchBody(keywords: string, from: number) {
  return {
    lang: 'en_us',
    deviceType: 'desktop',
    country: 'us',
    pageName: 'search-results',
    ddoKey: 'refineSearch',
    sortBy: '',
    subsearch: '',
    from,
    jobs: true,
    counts: true,
    all_fields: [],
    size: PAGE,
    clearAll: false,
    jdsource: 'facets',
    isSliderEnable: false,
    pageId: 'page11',
    siteType: 'external',
    keywords,
    global: true,
  };
}

async function search(host: string, keywords: string, from: number) {
  const data = await postJson<RefineSearch>(`https://${host}/widgets`, searchBody(keywords, from), {
    timeoutMs: 40_000,
    // A careers site that moved off Phenom answers 404 or serves HTML. That is a
    // board we cannot read, not a run-ending failure.
    tolerate: [400, 403, 404, 410, 422],
  });
  return data?.refineSearch;
}

export async function fetchPhenom(token: string, label: string): Promise<RawListing[]> {
  const host = token.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!host) return [];

  const found = new Map<string, PhenomJob>();

  for (const keywords of QUERIES) {
    const first = await search(host, keywords, 0);
    if (!first) continue;

    const take = (jobs: PhenomJob[] | undefined) => {
      for (const job of jobs ?? []) {
        const key = job.jobSeqNo || job.jobId || job.reqId;
        if (key) found.set(key, job);
      }
    };
    take(first.data?.jobs);

    const pages = Math.min(MAX_PAGES, Math.ceil((first.totalHits ?? 0) / PAGE));
    for (let i = 1; i < pages; i++) {
      const next = await search(host, keywords, i * PAGE);
      if (!next?.data?.jobs?.length) break;
      take(next.data.jobs);
    }
  }

  const jobs = [...found.values()];

  // Search results carry only a teaser. Season, pay and eligibility all live in
  // the full description, so it is worth a request for the plausible ones.
  const detailQueue = jobs.filter((j) => INTERNISH_TITLE.test(j.title ?? '')).slice(0, MAX_DETAILS);

  for (const job of detailQueue) {
    if (!job.jobId && !job.jobSeqNo) continue;
    try {
      const detail = await postJson<JobDetail>(
        `https://${host}/widgets`,
        {
          lang: 'en_us',
          deviceType: 'desktop',
          country: 'us',
          ddoKey: 'jobDetail',
          pageName: 'job-details',
          jobId: job.jobId,
          jobSeqNo: job.jobSeqNo,
          siteType: 'external',
          isJobDetails: true,
        },
        { timeoutMs: 30_000, retries: 1, tolerate: [400, 403, 404, 410, 422] },
      );
      const full = detail?.jobDetail?.data?.job;
      if (full?.description) job.description = full.description;
    } catch {
      // A missing description is survivable; the title still classifies.
    }
  }

  return jobs
    .map((job): RawListing => {
      const locations = [
        ...(job.multi_location ?? []),
        job.location,
        [job.city, job.state, job.country].filter(Boolean).join(', '),
      ].filter(Boolean) as string[];

      const posted = isoSecs(job.postedDate) ?? isoSecs(job.dateCreated);

      return {
        source: `phenom:${host}`,
        sourceKind: 'ats',
        sourceId: job.jobSeqNo || job.jobId || job.reqId || '',
        company: label,
        title: job.title ?? '',
        applyUrl: job.applyUrl || `https://${host}/job/${job.jobId ?? ''}`,
        description: job.description ?? job.descriptionTeaser ?? null,
        locations,
        terms: [],
        datePosted: posted,
        dateUpdated: posted,
        categoryHint: [job.category, job.subCategory, job.industry].filter(Boolean).join(', '),
        activeFlag: true,
        tags: (job.ml_skills ?? []).slice(0, 6),
      };
    })
    .filter((l) => l.title && l.sourceId);
}

/** Careers hosts that are known Phenom tenants, for URL-based discovery. */
const PHENOM_HOST = /^(?:careers|jobs|talent|apply|recruiting)[.-]/i;

/**
 * Recognize a Phenom careers site from an application URL.
 *
 * There is no host suffix to key off the way `.myworkdayjobs.com` gives Workday
 * away, so this only claims hosts that both look like a careers site and serve
 * Phenom's own URL shape: /us/en/job/{id}/{slug} or /job/{id}.
 */
export function phenomHostFromUrl(host: string, segments: string[]): string | null {
  if (!PHENOM_HOST.test(host)) return null;
  const lower = segments.map((s) => s.toLowerCase());
  const jobAt = lower.indexOf('job');
  if (jobAt === -1 || !segments[jobAt + 1]) return null;
  // "/us/en/job/..." is the canonical Phenom path; a bare "/job/..." also occurs.
  if (jobAt > 0 && !(lower[0].length === 2 && lower[1]?.length === 2)) return null;
  return host;
}
