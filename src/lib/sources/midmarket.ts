import type { RawListing } from '../parse';
import { getJson, postJson } from './http';

/**
 * Adapters for the applicant-tracking systems that mid-market employers run.
 *
 * The providers in `ats.ts` cover venture-backed tech and the Fortune 500.
 * These cover everything in between: regional hospital networks, labs, staffing
 * firms, agencies, manufacturers, universities' affiliated employers and most
 * of Europe's small and mid-size companies. Nothing about those employers makes
 * them worse internships, they were simply unreachable because no adapter here
 * spoke their board's API.
 */

const secs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  // Recruitee stamps "2026-08-07 07:59:12 UTC", which Date.parse only reads
  // once the space becomes a T and the zone becomes one it recognizes.
  const normalized = /^\d{4}-\d{2}-\d{2} /.test(value)
    ? `${value.replace(' ', 'T').replace(' UTC', '')}Z`
    : value;
  const t = Date.parse(normalized);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

// ----------------------------------------------------------------- Recruitee

interface RecruiteeOffer {
  id: number | string;
  title?: string;
  slug?: string;
  status?: string;
  careers_url?: string;
  careers_apply_url?: string;
  description?: string;
  requirements?: string;
  department?: string;
  company_name?: string;
  remote?: boolean;
  hybrid?: boolean;
  employment_type_code?: string;
  category_code?: string;
  created_at?: string;
  published_at?: string;
  tags?: string[];
  city?: string;
  state_name?: string;
  country?: string;
  locations?: { city?: string; state?: string; country?: string; name?: string }[];
  salary?: { min?: string | number; max?: string | number; period?: string; currency?: string };
}

const RECRUITEE_PERIOD: Record<string, string> = {
  year: 'year',
  yearly: 'year',
  month: 'month',
  monthly: 'month',
  hour: 'hour',
  hourly: 'hour',
  week: 'month',
  day: 'hour',
};

const num = (value: string | number | undefined): number | null => {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

export async function fetchRecruitee(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<{ offers?: RecruiteeOffer[] }>(
    `https://${encodeURIComponent(token)}.recruitee.com/api/offers/`,
  );
  if (!data?.offers) return [];

  return data.offers
    // Drafts and closed roles ride along in the same array as published ones.
    .filter((offer) => !offer.status || offer.status === 'published')
    .map((offer): RawListing => {
      const locations = [
        ...(offer.locations ?? []).map((l) =>
          [l.city ?? l.name, l.state, l.country].filter(Boolean).join(', '),
        ),
        [offer.city, offer.state_name, offer.country].filter(Boolean).join(', '),
      ].filter(Boolean);

      const period = offer.salary?.period
        ? RECRUITEE_PERIOD[offer.salary.period.toLowerCase()] ?? null
        : null;

      return {
        source: `recruitee:${token}`,
        sourceKind: 'ats',
        sourceId: String(offer.id),
        company: offer.company_name?.trim() || label,
        title: offer.title ?? '',
        applyUrl:
          offer.careers_url ||
          offer.careers_apply_url ||
          `https://${token}.recruitee.com/o/${offer.slug ?? offer.id}`,
        description: [offer.description, offer.requirements].filter(Boolean).join('\n\n') || null,
        locations,
        remoteFlag: offer.remote ?? null,
        terms: [],
        datePosted: secs(offer.published_at) ?? secs(offer.created_at),
        dateUpdated: secs(offer.published_at) ?? secs(offer.created_at),
        categoryHint: [offer.department, offer.category_code].filter(Boolean).join(', '),
        salaryMin: num(offer.salary?.min),
        salaryMax: num(offer.salary?.max),
        salaryPeriod: period,
        salaryCurrency: offer.salary?.currency ?? null,
        activeFlag: true,
        // Recruitee names the contract type outright, and "internship" is one
        // of its values, which is the cleanest internship signal it offers.
        tags: [
          ...(offer.tags ?? []).slice(0, 6),
          ...(offer.employment_type_code ? [`employment:${offer.employment_type_code}`] : []),
        ],
      };
    })
    .filter((l) => l.title && l.applyUrl);
}

// ---------------------------------------------------------------- Teamtailor

/** schema.org place, which is how Teamtailor states a job's location. */
interface JobPostingLocation {
  address?: {
    addressLocality?: string;
    addressRegion?: string;
    addressCountry?: string;
  };
}

/** Teamtailor publishes its board as JSON Feed rather than a bespoke schema. */
interface TeamtailorItem {
  id?: string;
  title?: string;
  url?: string;
  date_published?: string;
  date_modified?: string;
  content_html?: string;
  content_text?: string;
  tags?: string[];
  _jobposting?: {
    title?: string;
    description?: string;
    employmentType?: string;
    datePosted?: string;
    hiringOrganization?: { name?: string };
    // One place for a single-site role, a list when the role spans offices.
    jobLocation?: JobPostingLocation | JobPostingLocation[];
  };
}

function teamtailorLocations(posting: TeamtailorItem['_jobposting']): string[] {
  const raw = posting?.jobLocation;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return entries
    .map((entry) =>
      [
        entry?.address?.addressLocality,
        entry?.address?.addressRegion,
        entry?.address?.addressCountry,
      ]
        .filter(Boolean)
        .join(', '),
    )
    .filter(Boolean);
}

export async function fetchTeamtailor(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<{ title?: string; items?: TeamtailorItem[] }>(
    `https://${encodeURIComponent(token)}.teamtailor.com/jobs.json`,
    { timeoutMs: 45_000 },
  );
  if (!data?.items) return [];

  return data.items
    .map((item): RawListing => {
      const posting = item._jobposting;
      return {
        source: `teamtailor:${token}`,
        sourceKind: 'ats',
        sourceId: String(item.id ?? item.url ?? ''),
        company: posting?.hiringOrganization?.name?.trim() || data.title?.trim() || label,
        title: item.title ?? posting?.title ?? '',
        applyUrl: item.url ?? '',
        description: item.content_html ?? item.content_text ?? posting?.description ?? null,
        locations: teamtailorLocations(posting),
        terms: [],
        datePosted: secs(item.date_published) ?? secs(posting?.datePosted),
        dateUpdated: secs(item.date_modified) ?? secs(item.date_published),
        categoryHint: (item.tags ?? []).slice(0, 4).join(', '),
        activeFlag: true,
        tags: posting?.employmentType ? [`employment:${posting.employmentType}`] : [],
      };
    })
    .filter((l) => l.title && l.applyUrl && l.sourceId);
}

// ------------------------------------------------------------------ Pinpoint

interface PinpointPosting {
  id?: string;
  title?: string;
  url?: string;
  description?: string;
  key_responsibilities?: string;
  skills_knowledge_expertise?: string;
  benefits?: string;
  employment_type?: string;
  employment_type_text?: string;
  workplace_type?: string;
  deadline_at?: string;
  compensation_minimum?: string | number;
  compensation_maximum?: string | number;
  compensation_currency?: string;
  compensation_frequency?: string;
  job?: { department?: { name?: string } };
  location?: { name?: string; city?: string; province?: string };
}

/** Pinpoint serializes absent values as the strings "None" and "False". */
const pinpointValue = (value: string | number | undefined): string | null => {
  if (value == null) return null;
  const text = String(value).trim();
  return text && text !== 'None' && text !== 'null' ? text : null;
};

const PINPOINT_FREQUENCY: Record<string, string> = {
  annually: 'year',
  annual: 'year',
  yearly: 'year',
  monthly: 'month',
  weekly: 'month',
  hourly: 'hour',
  daily: 'hour',
};

export async function fetchPinpoint(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<{ data?: PinpointPosting[] }>(
    `https://${encodeURIComponent(token)}.pinpointhq.com/postings.json`,
    { timeoutMs: 45_000 },
  );
  if (!data?.data) return [];

  return data.data
    .map((post): RawListing => {
      const frequency = pinpointValue(post.compensation_frequency)?.toLowerCase();
      const min = pinpointValue(post.compensation_minimum);
      const max = pinpointValue(post.compensation_maximum);
      const location = [post.location?.name, post.location?.city, post.location?.province]
        .filter(Boolean)
        .filter((part, index, all) => all.indexOf(part) === index)
        .join(', ');

      return {
        source: `pinpoint:${token}`,
        sourceKind: 'ats',
        sourceId: String(post.id ?? ''),
        company: label,
        title: post.title ?? '',
        applyUrl: post.url ?? '',
        description:
          [post.description, post.key_responsibilities, post.skills_knowledge_expertise, post.benefits]
            .map(pinpointValue)
            .filter(Boolean)
            .join('\n\n') || null,
        locations: location ? [location] : [],
        remoteFlag: post.workplace_type ? /remote/i.test(post.workplace_type) : null,
        terms: [],
        datePosted: null, // the board API does not publish one
        dateUpdated: null,
        deadline: secs(pinpointValue(post.deadline_at)),
        categoryHint: post.job?.department?.name ?? '',
        salaryMin: min ? Number(min) || null : null,
        salaryMax: max ? Number(max) || null : null,
        salaryPeriod: frequency ? PINPOINT_FREQUENCY[frequency] ?? null : null,
        salaryCurrency: pinpointValue(post.compensation_currency),
        activeFlag: true,
        tags: post.employment_type_text ? [`employment:${post.employment_type_text}`] : [],
      };
    })
    .filter((l) => l.title && l.applyUrl && l.sourceId);
}

// ------------------------------------------------------------------ JobScore

interface JobScoreJob {
  id?: string;
  title?: string;
  apply_url?: string;
  detail_url?: string;
  description?: string;
  department?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  remote?: string;
  job_type?: string;
  company_name?: string;
  opened_date?: string;
  last_updated_date?: string;
  public_salary_minimum?: string | number;
  public_salary_maximum?: string | number;
  public_compensation_interval?: string;
  currency_code?: string;
}

const JOBSCORE_INTERVAL: Record<string, string> = {
  'per hour': 'hour',
  'per year': 'year',
  'per month': 'month',
  'per week': 'month',
};

export async function fetchJobScore(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<{ company_name?: string; jobs?: JobScoreJob[] }>(
    `https://careers.jobscore.com/careers/${encodeURIComponent(token)}/feed`,
  );
  if (!data?.jobs) return [];

  return data.jobs
    .map((job): RawListing => {
      const interval = job.public_compensation_interval?.toLowerCase();
      const place = [job.city, job.state, job.country]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', ');

      return {
        source: `jobscore:${token}`,
        sourceKind: 'ats',
        sourceId: String(job.id ?? ''),
        company: job.company_name?.trim() || data.company_name?.trim() || label,
        title: job.title?.trim() ?? '',
        applyUrl: job.detail_url ?? job.apply_url ?? '',
        description: job.description ?? null,
        locations: [job.location?.trim(), place].filter(Boolean) as string[],
        remoteFlag: job.remote ? /^yes/i.test(job.remote) : null,
        terms: [],
        datePosted: secs(job.opened_date),
        dateUpdated: secs(job.last_updated_date) ?? secs(job.opened_date),
        categoryHint: job.department?.trim() ?? '',
        salaryMin: num(job.public_salary_minimum),
        salaryMax: num(job.public_salary_maximum),
        salaryPeriod: interval ? JOBSCORE_INTERVAL[interval] ?? null : null,
        salaryCurrency: job.currency_code ?? null,
        activeFlag: true,
        tags: job.job_type ? [`employment:${job.job_type}`] : [],
      };
    })
    .filter((l) => l.title && l.applyUrl && l.sourceId);
}

// ------------------------------------------------------------- UKG (UltiPro)

/**
 * UKG job boards are addressed by a host, a customer code and a board GUID, so
 * the token carries all three as `{host}/{code}/{guid}`.
 */
export interface UkgBoard {
  host: string;
  code: string;
  board: string;
}

const UKG_HOSTS = /^recruiting\d*\.ultipro\.com$/i;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeUkgToken(board: UkgBoard): string {
  return `${board.host}/${board.code}/${board.board}`;
}

export function decodeUkgToken(token: string): UkgBoard | null {
  const [host, code, board] = token.split('/');
  if (!host || !code || !board) return null;
  return { host, code, board };
}

/** recruiting.ultipro.com/{code}/JobBoard/{guid}/... */
export function ukgBoardFromUrl(host: string, segments: string[]): UkgBoard | null {
  if (!UKG_HOSTS.test(host)) return null;
  const index = segments.findIndex((s) => s.toLowerCase() === 'jobboard');
  if (index < 1) return null;
  const code = segments[index - 1];
  const board = segments[index + 1];
  if (!code || !board || !GUID.test(board)) return null;
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(code)) return null;
  return { host, code, board };
}

interface UkgOpportunity {
  Id?: string;
  Title?: string;
  RequisitionNumber?: string;
  FullTime?: boolean;
  JobCategoryName?: string;
  PostedDate?: string;
  BriefDescription?: string;
  Locations?: {
    LocalizedName?: string;
    Address?: {
      City?: string;
      State?: { Name?: string; Code?: string };
      Country?: { Name?: string; Code?: string };
    };
  }[];
}

/** Opportunities per request. The board refuses anything larger. */
const UKG_PAGE = 100;
/** Pages to walk before stopping, so one huge health system cannot stall a run. */
const UKG_MAX_PAGES = 6;

export async function fetchUkg(token: string, label: string): Promise<RawListing[]> {
  const board = decodeUkgToken(token);
  if (!board) return [];

  const url =
    `https://${board.host}/${encodeURIComponent(board.code)}` +
    `/JobBoard/${encodeURIComponent(board.board)}/JobBoardView/LoadSearchResults`;

  const collected: UkgOpportunity[] = [];
  for (let page = 0; page < UKG_MAX_PAGES; page++) {
    const data = await postJson<{ opportunities?: UkgOpportunity[]; totalCount?: number }>(
      url,
      {
        opportunitySearch: {
          Top: UKG_PAGE,
          Skip: page * UKG_PAGE,
          QueryString: '',
          OrderBy: [],
          Filters: [],
        },
        matchCriteria: null,
      },
      { timeoutMs: 45_000 },
    );
    const batch = data?.opportunities ?? [];
    collected.push(...batch);
    if (batch.length < UKG_PAGE) break;
    // A board that reports its total lets us stop without a wasted request.
    const total = data?.totalCount;
    if (total != null && collected.length >= total) break;
  }

  return collected
    .map((job): RawListing => {
      const locations = (job.Locations ?? [])
        .map((loc) =>
          [
            loc.Address?.City,
            loc.Address?.State?.Name ?? loc.Address?.State?.Code,
            loc.Address?.Country?.Name ?? loc.Address?.Country?.Code,
          ]
            .filter(Boolean)
            .join(', ') || loc.LocalizedName,
        )
        .filter(Boolean) as string[];

      return {
        source: `ukg:${token}`,
        sourceKind: 'ats',
        sourceId: String(job.Id ?? job.RequisitionNumber ?? ''),
        company: label,
        title: job.Title ?? '',
        applyUrl:
          `https://${board.host}/${board.code}/JobBoard/${board.board}` +
          `/OpportunityDetail?opportunityId=${encodeURIComponent(job.Id ?? '')}`,
        description: job.BriefDescription ?? null,
        locations,
        terms: [],
        datePosted: secs(job.PostedDate),
        dateUpdated: secs(job.PostedDate),
        categoryHint: job.JobCategoryName ?? '',
        activeFlag: true,
        tags: job.FullTime === false ? ['employment:part-time'] : [],
      };
    })
    .filter((l) => l.title && l.sourceId);
}
