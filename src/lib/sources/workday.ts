import type { RawListing } from '../parse';
import { getJson, postJson } from './http';

/**
 * Workday adapter — by a wide margin the most important source there is.
 *
 * Roughly half of every application link in the community internship archives
 * points at a Workday tenant (`*.myworkdayjobs.com` or `*.myworkdaysite.com`),
 * which is why the catalog looked thin on large employers before this existed:
 * Northrop Grumman, NVIDIA, Salesforce, Adobe, Intel, Mastercard, Snap and
 * ~900 others all recruit here.
 *
 * Every tenant exposes the same unauthenticated "candidate experience" (CXS)
 * API behind its careers site:
 *
 *   POST https://{host}/wday/cxs/{tenant}/{site}/jobs   → paged job list
 *   GET  https://{host}/wday/cxs/{tenant}/{site}{path}  → one job, with body
 *
 * Two quirks shape the design below:
 *
 *  1. `limit` is hard-capped at 20, so everything is paged.
 *  2. `searchText` matches description text by prefix, so "intern" also returns
 *     every job mentioning "internal" or "international" — on a big tenant that
 *     is thousands of irrelevant rows.
 *
 * So the board is read four complementary ways and the results unioned:
 * by facet (most tenants tag intern roles with a "Intern"/"Apprentice" worker
 * subtype, which filters exactly), by the "internship" keyword (which unlike
 * "intern" tokenizes tightly), by a bare "intern" keyword where the tenant is
 * small enough for it to stay precise, and by crawling small boards outright.
 */

/** Workday's hard cap on page size. */
const PAGE = 20;
/** Pages to pull per query. 15 × 20 = 300 postings, which covers every real intern cohort. */
const MAX_PAGES = 15;
/** Above this many hits, a query is too fuzzy to be worth paging. */
const FUZZY_LIMIT = 400;
/** Boards at or under this size get crawled completely, search terms be damned. */
const FULL_CRAWL_LIMIT = 300;
/** Descriptions cost one request each, so cap them per board. */
const MAX_DETAILS = 150;

interface WorkdayPosting {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  timeType?: string;
  bulletFields?: string[];
}

interface WorkdayFacetValue {
  id?: string;
  descriptor?: string;
  count?: number;
  facetParameter?: string;
  values?: WorkdayFacetValue[];
}

interface WorkdayPage {
  total?: number;
  jobPostings?: WorkdayPosting[];
  facets?: WorkdayFacetValue[];
}

interface WorkdayDetail {
  jobPostingInfo?: {
    id?: string;
    title?: string;
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    postedOn?: string;
    startDate?: string;
    endDate?: string;
    timeType?: string;
    jobReqId?: string;
    country?: { descriptor?: string };
    externalUrl?: string;
    remoteType?: string;
    jobRequisitionLocation?: { descriptor?: string };
  };
}

/** A Workday board: which host serves it, and the tenant/site pair inside. */
export interface WorkdayBoard {
  host: string;
  tenant: string;
  site: string;
}

/** Boards are stored as one token so they fit the generic source_configs row. */
export function encodeWorkdayToken(board: WorkdayBoard): string {
  return `${board.host}/${board.tenant}/${board.site}`;
}

export function decodeWorkdayToken(token: string): WorkdayBoard | null {
  const [host, tenant, site] = token.split('/');
  if (!host || !tenant || !site) return null;
  return { host, tenant, site };
}

const cxsBase = (b: WorkdayBoard) => `https://${b.host}/wday/cxs/${b.tenant}/${b.site}`;

/** Public careers URL for a posting, which is what a candidate should open. */
function applyUrl(b: WorkdayBoard, externalPath: string): string {
  return `https://${b.host}/en-US/${b.site}${externalPath}`;
}

/** "Posted 30+ Days Ago" / "Posted Yesterday" — a coarse age, not a date. */
function postedOnToSeconds(postedOn: string | undefined, now: number): number | null {
  if (!postedOn) return null;
  if (/today|just posted/i.test(postedOn)) return Math.floor(now / 1000);
  if (/yesterday/i.test(postedOn)) return Math.floor(now / 1000) - 86_400;
  const days = /(\d+)\+?\s*days?\s*ago/i.exec(postedOn);
  if (days) return Math.floor(now / 1000) - Number(days[1]) * 86_400;
  const months = /(\d+)\+?\s*months?\s*ago/i.exec(postedOn);
  if (months) return Math.floor(now / 1000) - Number(months[1]) * 30 * 86_400;
  return null;
}

const isoSecs = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

/** Titles worth spending a description request on. */
const INTERNISH_TITLE =
  /\bintern(?:ship|ships|s)?\b|\bco-?ops?\b|\bapprentice|\bplacement\b|\bworking\s+student\b|\bwerkstudent|\bpraktik|\bstudent\s+(?:trainee|worker|assistant)\b|\bsummer\s+(?:analyst|associate|scholar|program)\b|\bgraduate\s+program\b|\bcampus\b|\buniversity\s+(?:graduate|program)\b/i;

type AppliedFacets = Record<string, string[]>;

/** Fetch one page of a tenant's board. */
async function page(
  b: WorkdayBoard,
  searchText: string,
  offset: number,
  appliedFacets: AppliedFacets = {},
): Promise<WorkdayPage | null> {
  return postJson<WorkdayPage>(
    `${cxsBase(b)}/jobs`,
    { appliedFacets, limit: PAGE, offset, searchText },
    // A tenant that moved or renamed its site answers 400/404/422. That is a
    // board we simply cannot read, not a run-ending failure — the discovery
    // pass registers thousands of these from archived links.
    { timeoutMs: 40_000, tolerate: [400, 403, 404, 410, 422] },
  );
}

/** Page through one query, stopping at the end of the results or the page cap. */
async function collect(
  b: WorkdayBoard,
  searchText: string,
  into: Map<string, WorkdayPosting>,
  opts: { maxPages?: number; appliedFacets?: AppliedFacets; first?: WorkdayPage } = {},
): Promise<void> {
  const first = opts.first ?? (await page(b, searchText, 0, opts.appliedFacets));
  if (!first) return;

  const take = (postings: WorkdayPosting[] | undefined) => {
    for (const p of postings ?? []) {
      if (p.externalPath) into.set(p.externalPath, p);
    }
  };
  take(first.jobPostings);

  const pages = Math.min(opts.maxPages ?? MAX_PAGES, Math.ceil((first.total ?? 0) / PAGE));
  for (let i = 1; i < pages; i++) {
    const next = await page(b, searchText, i * PAGE, opts.appliedFacets);
    if (!next?.jobPostings?.length) break;
    take(next.jobPostings);
  }
}

/** Facet values that name a student program, e.g. worker subtype "Intern (Fixed Term)". */
const STUDENT_FACET =
  /\bintern(?:ship)?s?\b|\bco-?ops?\b|\bapprentice|\bstudent\b|\bcampus\b|\bworking\s+student\b|\bpraktik|\btrainee\b|\bearly\s+career|\bnew\s+(?:college\s+)?grad/i;

/** Facet groups that describe the kind of worker, not where or when they work. */
const FACET_GROUPS = new Set(['workerSubType', 'timeType', 'jobFamilyGroup', 'employmentType']);

/**
 * Find the facet values that isolate student roles.
 *
 * Facet ids are per-tenant GUIDs, so they can't be hardcoded — but the human
 * labels next to them are consistent enough to match on, and applying one is
 * the only exact filter Workday offers.
 */
function studentFacets(facets: WorkdayFacetValue[] | undefined): AppliedFacets[] {
  const out: AppliedFacets[] = [];
  for (const group of facets ?? []) {
    const parameter = group.facetParameter;
    if (!parameter || !FACET_GROUPS.has(parameter)) continue;
    const ids = (group.values ?? [])
      .filter((v) => v.id && STUDENT_FACET.test(v.descriptor ?? ''))
      .map((v) => v.id!);
    // Workday ANDs across facet groups and ORs within one, so each group needs
    // its own query.
    if (ids.length) out.push({ [parameter]: ids });
  }
  return out;
}

export async function fetchWorkday(token: string, label: string): Promise<RawListing[]> {
  const board = decodeWorkdayToken(token);
  if (!board) return [];

  const now = Date.now();
  const found = new Map<string, WorkdayPosting>();

  // One unfiltered page doubles as the board's size and its facet catalog.
  const overview = await page(board, '', 0);
  if (!overview) return [];
  const boardTotal = overview.total ?? 0;

  // Exact filter first: whatever the tenant calls its student worker type.
  for (const appliedFacets of studentFacets(overview.facets)) {
    await collect(board, '', found, { appliedFacets });
  }

  // "internship" is the precise query — it does not prefix-match "internal".
  await collect(board, 'internship', found);

  // A bare "intern" catches titles like "Intern - Hardware" that never say
  // "internship", but only where the tenant is small enough to stay on-topic.
  const internFirst = await page(board, 'intern', 0);
  const internTotal = internFirst?.total ?? 0;
  if (internTotal > 0 && internTotal <= FUZZY_LIMIT) {
    await collect(board, 'intern', found, { first: internFirst! });
  }

  // Small boards are cheap to read end to end, and doing so catches the
  // internships whose wording matches neither query ("Praktikum", "Co-Op").
  if (boardTotal > 0 && boardTotal <= FULL_CRAWL_LIMIT) {
    await collect(board, '', found, {
      first: overview,
      maxPages: Math.ceil(FULL_CRAWL_LIMIT / PAGE),
    });
  }

  const postings = [...found.values()];

  // Descriptions decide season, pay, eligibility and location type, so they are
  // worth a request — but only for the postings that could plausibly survive
  // classification, and never more than MAX_DETAILS of them.
  const detailQueue = postings
    .filter((p) => INTERNISH_TITLE.test(p.title ?? ''))
    .slice(0, MAX_DETAILS);
  const details = new Map<string, WorkdayDetail['jobPostingInfo']>();

  for (const p of detailQueue) {
    try {
      const detail = await getJson<WorkdayDetail>(`${cxsBase(board)}${p.externalPath}`, {
        timeoutMs: 30_000,
        retries: 1,
      });
      if (detail?.jobPostingInfo) details.set(p.externalPath!, detail.jobPostingInfo);
    } catch {
      // A missing description is survivable; the title still classifies.
    }
  }

  return postings
    .map((p): RawListing => {
      const path = p.externalPath!;
      const info = details.get(path);
      const locations = [
        info?.location ?? p.locationsText,
        ...(info?.additionalLocations ?? []),
        info?.jobRequisitionLocation?.descriptor,
      ].filter(Boolean) as string[];

      const posted = postedOnToSeconds(info?.postedOn ?? p.postedOn, now);
      const reqId = info?.jobReqId ?? p.bulletFields?.[0] ?? path;

      return {
        source: `workday:${token}`,
        sourceKind: 'ats',
        sourceId: reqId,
        company: label,
        title: info?.title ?? p.title ?? '',
        applyUrl: info?.externalUrl || applyUrl(board, path),
        description: info?.jobDescription ?? null,
        locations,
        remoteFlag: info?.remoteType ? /remote/i.test(info.remoteType) : null,
        terms: [],
        datePosted: posted,
        dateUpdated: posted,
        // `endDate` is when the posting comes down — a real application deadline.
        deadline: isoSecs(info?.endDate),
        categoryHint: '',
        activeFlag: true,
        tags: [p.timeType ?? info?.timeType].filter(Boolean).map((t) => `employment:${t}`),
      };
    })
    .filter((l) => l.title && l.applyUrl);
}

/**
 * Recognize a Workday board from an application URL.
 *
 * Both hosting shapes appear in the wild:
 *   https://{tenant}.{wdN}.myworkdayjobs.com/[{locale}/]{site}/job/...
 *   https://{wdN}.myworkdaysite.com/recruiting/{tenant}/{site}/job/...
 */
export function workdayBoardFromUrl(host: string, segments: string[]): WorkdayBoard | null {
  const isLocale = (s: string) => /^[a-z]{2}([-_][A-Za-z]{2,4})?$/.test(s);
  const clean = (s: string | undefined) =>
    s && /^[A-Za-z0-9][A-Za-z0-9._-]{0,60}$/.test(s) ? s : null;

  if (host.endsWith('.myworkdaysite.com')) {
    // The tenant lives in the path here, not the hostname.
    if (segments[0]?.toLowerCase() !== 'recruiting') return null;
    const tenant = clean(segments[1]);
    const site = clean(segments[2]);
    if (!tenant || !site) return null;
    return { host, tenant, site };
  }

  if (host.endsWith('.myworkdayjobs.com')) {
    const tenant = clean(host.split('.')[0]);
    if (!tenant) return null;
    // Skip an optional locale prefix, then take the site name.
    const rest = segments[0] && isLocale(segments[0]) ? segments.slice(1) : segments;
    const site = clean(rest[0]);
    // `wday` is the API path, not a careers site.
    if (!site || site.toLowerCase() === 'wday') return null;
    return { host, tenant, site };
  }

  return null;
}
