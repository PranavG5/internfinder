import type { RawListing } from '../parse';
import { getJson } from './http';
import { markPartial } from './partial';

/**
 * Jibe careers sites, the branded front end iCIMS sells as "Attract".
 *
 * iCIMS itself has no public jobs API, and it is where a large share of the
 * employers that hire business analyst and analytics interns recruit: State
 * Farm, Principal, PepsiCo, Gallagher, ZS, Paychex. Their careers sites run on
 * Jibe, and every Jibe site serves the same unauthenticated JSON search that
 * its own pages use:
 *
 *   GET https://{host}/api/jobs?keywords=intern&page=1&limit=100
 *
 * Each job carries its full description, posting date, location and the
 * underlying iCIMS apply link, so no per-job detail request is needed.
 *
 * A board is stored as its careers host.
 */

const LIMIT = 100;
/** Pages per query. Ten pages of 100 covers any real intern cohort. */
const MAX_PAGES = 10;

/**
 * Searches unioned per board. Some tenants ignore the keyword and return their
 * whole catalog, which is fine: non-internships are filtered on the way in.
 */
const QUERIES = ['intern', 'internship', 'co-op', 'summer analyst', 'student'];

interface JibeJob {
  slug?: string;
  req_id?: string;
  language?: string;
  title?: string;
  description?: string;
  responsibilities?: string;
  qualifications?: string;
  location_name?: string;
  city?: string;
  state?: string;
  country?: string;
  additional_locations?: { city?: string; state?: string; country?: string }[];
  categories?: { name?: string }[];
  employment_type?: string;
  hiring_organization?: string;
  posted_date?: string;
  apply_url?: string;
  meta_data?: { last_mod?: string };
}

interface JibeResponse {
  jobs?: { data?: JibeJob }[];
  totalCount?: number;
}

const isoSecs = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

export function jibeHost(token: string): string {
  return token.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
}

export async function fetchJibe(token: string, label: string): Promise<RawListing[]> {
  const host = jibeHost(token);
  if (!host) return [];

  const found = new Map<string, JibeJob>();
  let truncated = false;

  for (const keywords of QUERIES) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await getJson<JibeResponse>(
        `https://${host}/api/jobs?keywords=${encodeURIComponent(keywords)}&page=${page}&limit=${LIMIT}`,
        // A site that left Jibe answers 404 or serves HTML: unreadable, not fatal.
        { timeoutMs: 40_000, tolerate: [400, 403, 404, 410] },
      );
      const batch = data?.jobs ?? [];
      for (const { data: job } of batch) {
        const key = job?.req_id || job?.slug;
        if (job && key) found.set(key, job);
      }
      const total = data?.totalCount ?? 0;
      if (batch.length < LIMIT || page * LIMIT >= total) break;
      if (page === MAX_PAGES) truncated = true;
    }
  }

  const listings = [...found.values()]
    .map((job): RawListing => {
      const locations = [
        job.location_name,
        [job.city, job.state, job.country].filter(Boolean).join(', '),
        ...(job.additional_locations ?? []).map((l) => [l.city, l.state, l.country].filter(Boolean).join(', ')),
      ].filter(Boolean) as string[];
      const posted = isoSecs(job.posted_date);
      const page = job.slug ? `https://${host}/jobs/${job.slug}?lang=${job.language ?? 'en-us'}` : '';

      return {
        source: `jibe:${host}`,
        sourceKind: 'ats',
        sourceId: job.req_id || job.slug || '',
        company: job.hiring_organization?.trim() || label,
        title: job.title ?? '',
        applyUrl: job.apply_url || page,
        // The search result splits the posting into sections; together they
        // are the full description that season, pay and eligibility come from.
        description: [job.description, job.responsibilities, job.qualifications].filter(Boolean).join('\n\n') || null,
        locations,
        terms: [],
        datePosted: posted,
        dateUpdated: isoSecs(job.meta_data?.last_mod) ?? posted,
        categoryHint: (job.categories ?? []).map((c) => c.name).filter((n) => n && n !== 'Other').join(', '),
        activeFlag: true,
        tags: job.employment_type ? [`employment:${job.employment_type}`] : [],
      };
    })
    .filter((l) => l.title && l.sourceId && l.applyUrl);

  return truncated ? markPartial(listings) : listings;
}
