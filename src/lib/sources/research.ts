import type { RawListing } from '../parse';
import { stripHtml } from '../util';
import { fetchText, getJson, postForm } from './http';

/**
 * Research and laboratory openings, which almost never appear on a company ATS.
 *
 * A premed or life-sciences student looking for bench time is not competing for
 * postings on Greenhouse. The openings they want sit in federal research
 * participation catalogs and government hiring systems, so those get their own
 * adapters here.
 */

// -------------------------------------------------- ORISE / ORAU (Zintellect)

/**
 * Zintellect is the application portal for the ORISE research participation
 * programs, and it is the single densest listing of paid lab placements in the
 * country: NIH, CDC, FDA, EPA, NASA, NIST, the Army and Navy labs, and every
 * Department of Energy national laboratory recruit undergraduates, postbacs and
 * graduate students through it.
 *
 * The catalog is a server-rendered DataTables grid, so the list comes back as
 * JSON from a form POST and each opportunity's detail page is parsed as HTML.
 */

const ZINTELLECT = 'https://www.zintellect.com';
/** Rows per catalog request. The grid accepts 100 and truncates past that. */
const CATALOG_PAGE = 100;
/** Opportunities to read per run before stopping. The catalog runs ~1,100. */
const MAX_OPPORTUNITIES = 600;
/** Detail pages cost one request each, so cap them per run. */
const MAX_DETAILS = 200;

interface ZintellectRow {
  id?: number;
  title?: string;
  referenceCode?: string;
  location?: string | null;
  posted?: string | null;
  expirationDate?: string | null;
}

interface ZintellectPage {
  recordsTotal?: number;
  data?: ZintellectRow[];
}

/** DataTables insists on a full column descriptor even when nothing is sorted. */
function catalogForm(start: number): Record<string, string> {
  return {
    draw: '1',
    start: String(start),
    length: String(CATALOG_PAGE),
    Keyword: '',
    'search[value]': '',
    'search[regex]': 'false',
    'order[0][column]': '0',
    'order[0][dir]': 'asc',
    'columns[0][data]': '0',
    'columns[0][name]': '',
    'columns[0][searchable]': 'true',
    'columns[0][orderable]': 'true',
    'columns[0][search][value]': '',
    'columns[0][search][regex]': 'false',
  };
}

/** "04-02-2026" and "11-01-2026 06:00:59 PM" both appear in this catalog. */
function usDateSecs(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(value.trim());
  if (!m) return null;
  const [, month, day, year] = m;
  const t = Date.UTC(Number(year), Number(month) - 1, Number(day), 12);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/**
 * Pull the labelled fields out of an opportunity page.
 *
 * Every field is rendered as a `form-group` block holding a `<strong>` label and
 * its value, so splitting on the block class is more durable than matching the
 * surrounding markup.
 */
function parseDetailFields(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const blocks = html.split('class="form-group"');

  for (const block of blocks.slice(1)) {
    const label = /<strong>\s*([^<]{2,40}?)\s*<\/strong>/.exec(block);
    if (!label) continue;
    const value = stripHtml(block.slice(label.index + label[0].length)).trim();
    const key = label[1].trim();
    if (value && !out[key]) out[key] = value;
  }
  return out;
}

export async function fetchOrise(): Promise<RawListing[]> {
  const rows: ZintellectRow[] = [];

  for (let start = 0; start < MAX_OPPORTUNITIES; start += CATALOG_PAGE) {
    const page = await postForm<ZintellectPage>(
      `${ZINTELLECT}/Catalog/Index_DataTableResult`,
      catalogForm(start),
      { timeoutMs: 60_000, headers: { 'X-Requested-With': 'XMLHttpRequest' } },
    );
    const batch = page?.data ?? [];
    rows.push(...batch);
    if (batch.length < CATALOG_PAGE) break;
    if (start + CATALOG_PAGE >= (page?.recordsTotal ?? 0)) break;
  }

  const listed = rows.filter((r) => r.referenceCode && r.title);

  // Newest first, so a capped run reads the openings students can still enter.
  listed.sort((a, b) => (usDateSecs(b.posted) ?? 0) - (usDateSecs(a.posted) ?? 0));

  const details = new Map<string, Record<string, string>>();
  for (const row of listed.slice(0, MAX_DETAILS)) {
    try {
      const html = await fetchText(
        `${ZINTELLECT}/Opportunity/Details/${encodeURIComponent(row.referenceCode!)}`,
        { timeoutMs: 30_000, retries: 1, headers: { Accept: 'text/html,*/*' } },
      );
      if (html) details.set(row.referenceCode!, parseDetailFields(html));
    } catch {
      // The catalog row alone still describes the opportunity.
    }
  }

  return listed.map((row): RawListing => {
    const detail = details.get(row.referenceCode!) ?? {};
    const description = [
      detail.Description,
      detail.Qualifications ? `Qualifications\n${detail.Qualifications}` : '',
      detail['Eligibility Requirements'] ? `Eligibility\n${detail['Eligibility Requirements']}` : '',
      detail.Stipend ? `Stipend: ${detail.Stipend}` : '',
      detail['Nature of Appointment'] ? `Appointment: ${detail['Nature of Appointment']}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      source: 'orise',
      sourceKind: 'aggregator',
      sourceId: row.referenceCode!,
      // The sponsoring agency is the real employer; ORISE only administers.
      company: detail.Organization || 'ORISE Research Participation Program',
      companyUrl: 'https://orise.orau.gov',
      title: row.title!.trim(),
      applyUrl: `${ZINTELLECT}/Opportunity/Details/${encodeURIComponent(row.referenceCode!)}`,
      description: description || null,
      locations: row.location ? [row.location] : [],
      terms: [],
      datePosted: usDateSecs(row.posted),
      dateUpdated: usDateSecs(row.posted),
      deadline: usDateSecs(row.expirationDate),
      categoryHint: 'Research participation',
      activeFlag: true,
      tags: ['research-program'],
    };
  });
}

// ------------------------------------------------------------------- USAJOBS

/**
 * USAJOBS carries every federal student opening, which is where the clinical
 * and research internships live that no private board lists: NIH summer
 * interns, CDC fellows, VA medical support, FDA and NIST laboratory
 * appointments, and the government-wide Pathways Internship Program.
 *
 * The API needs a free key (https://developer.usajobs.gov/apirequest/), so this
 * adapter stays inert until `USAJOBS_API_KEY` and `USAJOBS_EMAIL` are set,
 * rather than failing the source on every run.
 */

const USAJOBS_HOST = 'https://data.usajobs.gov/api/search';
/** Results per request. The API caps this at 500. */
const USAJOBS_PAGE = 250;
/** Pages per query. */
const USAJOBS_MAX_PAGES = 4;

/**
 * Queries run against the student hiring path, which is the filter that
 * separates internships from career postings on USAJOBS.
 */
const USAJOBS_QUERIES: { keyword: string; label: string }[] = [
  { keyword: 'intern', label: 'internships' },
  { keyword: 'research', label: 'research' },
  { keyword: 'laboratory', label: 'laboratory' },
  { keyword: 'medical OR clinical OR nursing OR public health', label: 'health' },
];

interface UsaJobsDescriptor {
  PositionID?: string;
  PositionTitle?: string;
  PositionURI?: string;
  ApplyURI?: string[];
  PositionLocationDisplay?: string;
  PositionLocation?: { LocationName?: string }[];
  OrganizationName?: string;
  DepartmentName?: string;
  PositionStartDate?: string;
  PositionEndDate?: string;
  PublicationStartDate?: string;
  ApplicationCloseDate?: string;
  QualificationSummary?: string;
  UserArea?: {
    Details?: {
      JobSummary?: string;
      MajorDuties?: string[];
      Education?: string;
      Requirements?: string;
      LowGrade?: string;
      HighGrade?: string;
    };
  };
  PositionRemuneration?: {
    MinimumRange?: string;
    MaximumRange?: string;
    RateIntervalCode?: string;
  }[];
}

interface UsaJobsResponse {
  SearchResult?: {
    SearchResultCount?: number;
    SearchResultCountAll?: number;
    SearchResultItems?: { MatchedObjectDescriptor?: UsaJobsDescriptor }[];
  };
}

/** USAJOBS reports pay cadence as a code rather than a word. */
const RATE_INTERVAL: Record<string, string> = {
  'Per Hour': 'hour',
  'Per Year': 'year',
  'Per Month': 'month',
  PH: 'hour',
  PA: 'year',
  PM: 'month',
};

const isoSecs = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

export async function fetchUsaJobs(): Promise<RawListing[]> {
  const key = process.env.USAJOBS_API_KEY?.trim();
  const email = process.env.USAJOBS_EMAIL?.trim();
  // No key configured is a normal state, not a failure: skip quietly.
  if (!key || !email) return [];

  const headers = {
    Host: 'data.usajobs.gov',
    'User-Agent': email,
    'Authorization-Key': key,
  };

  const found = new Map<string, UsaJobsDescriptor>();

  for (const query of USAJOBS_QUERIES) {
    for (let page = 1; page <= USAJOBS_MAX_PAGES; page++) {
      const url =
        `${USAJOBS_HOST}?Keyword=${encodeURIComponent(query.keyword)}` +
        `&HiringPath=student%3Bgraduates&ResultsPerPage=${USAJOBS_PAGE}&Page=${page}` +
        `&WhoMayApply=public&SortField=PositionStartDate&SortDirection=Descending`;

      const data = await getJson<UsaJobsResponse>(url, { headers, timeoutMs: 45_000 });
      const items = data?.SearchResult?.SearchResultItems ?? [];
      for (const item of items) {
        const job = item.MatchedObjectDescriptor;
        if (job?.PositionID) found.set(job.PositionID, job);
      }
      if (items.length < USAJOBS_PAGE) break;
    }
  }

  return [...found.values()].map((job): RawListing => {
    const details = job.UserArea?.Details ?? {};
    const description = [
      details.JobSummary,
      (details.MajorDuties ?? []).join('\n'),
      job.QualificationSummary,
      details.Education,
      details.Requirements,
    ]
      .filter(Boolean)
      .join('\n\n');

    const pay = job.PositionRemuneration?.[0];
    const locations = [
      ...(job.PositionLocation ?? []).map((l) => l.LocationName),
      job.PositionLocationDisplay,
    ].filter(Boolean) as string[];

    return {
      source: 'usajobs',
      sourceKind: 'aggregator',
      sourceId: job.PositionID!,
      company: job.OrganizationName || job.DepartmentName || 'U.S. Federal Government',
      companyUrl: null,
      title: job.PositionTitle ?? '',
      applyUrl: job.ApplyURI?.[0] || job.PositionURI || '',
      description: description ? stripHtml(description) : null,
      locations,
      terms: [],
      datePosted: isoSecs(job.PublicationStartDate ?? job.PositionStartDate),
      dateUpdated: isoSecs(job.PublicationStartDate ?? job.PositionStartDate),
      deadline: isoSecs(job.ApplicationCloseDate ?? job.PositionEndDate),
      categoryHint: job.DepartmentName ?? '',
      salaryMin: pay?.MinimumRange ? Number(pay.MinimumRange) || null : null,
      salaryMax: pay?.MaximumRange ? Number(pay.MaximumRange) || null : null,
      salaryPeriod: pay?.RateIntervalCode ? (RATE_INTERVAL[pay.RateIntervalCode] ?? null) : null,
      salaryCurrency: 'USD',
      activeFlag: true,
      tags: ['federal'],
    };
  })
  .filter((l) => l.title && l.applyUrl);
}
