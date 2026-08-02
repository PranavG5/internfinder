import type { RawListing } from '../parse';
import { getJson } from './http';

/**
 * Oracle Cloud Recruiting ("ORC") adapter.
 *
 * The second-largest ATS in the archive after Workday — Honeywell, 3M, Deloitte
 * and ~110 other large employers post here. Career sites look like
 *
 *   https://{pod}.fa.{region}.oraclecloud.com/hcmUI/CandidateExperience/en/sites/{site}/job/{id}
 *
 * and are backed by an open REST resource on the same host. Unlike Workday the
 * page size is generous (200), so the whole requisition list is read directly
 * rather than fought through a fuzzy keyword search — Oracle's `keyword` filter
 * matches description text and is no more precise than reading everything.
 */

/** Oracle's page size cap for this resource. */
const PAGE = 200;
/** Requisitions to read per board before giving up on a very large tenant. */
const MAX_REQUISITIONS = 2000;
/** Descriptions cost one request each, so cap them per board. */
const MAX_DETAILS = 120;

interface OracleRequisition {
  Id?: string;
  Title?: string;
  PostedDate?: string;
  ExternalPostedStartDate?: string;
  ExternalPostedEndDate?: string;
  PrimaryLocation?: string;
  PrimaryLocationCountry?: string;
  ShortDescriptionStr?: string;
  ExternalDescriptionStr?: string;
  ExternalQualificationsStr?: string;
  ExternalResponsibilitiesStr?: string;
  WorkplaceType?: string;
  JobFamily?: string;
  Category?: string;
  StudyLevel?: string;
  RequisitionId?: string;
  secondaryLocations?: { LocationName?: string; Name?: string }[];
}

interface OracleResponse {
  items?: {
    TotalJobsCount?: number;
    requisitionList?: OracleRequisition[];
  }[];
}

export interface OracleBoard {
  host: string;
  site: string;
}

export function encodeOracleToken(board: OracleBoard): string {
  return `${board.host}/${board.site}`;
}

export function decodeOracleToken(token: string): OracleBoard | null {
  const [host, site] = token.split('/');
  return host && site ? { host, site } : null;
}

const isoSecs = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

const INTERNISH_TITLE =
  /\bintern(?:ship|ships|s)?\b|\bco-?ops?\b|\bapprentice|\bplacement\b|\bworking\s+student\b|\bwerkstudent|\bpraktik|\bstudent\b|\bsummer\s+(?:analyst|associate|scholar|program)\b|\bgraduate\s+program\b|\bcampus\b/i;

function listUrl(board: OracleBoard, offset: number): string {
  const finder = `findReqs;siteNumber=${board.site},limit=${PAGE},offset=${offset},sortBy=POSTING_DATES_DESC`;
  return (
    `https://${board.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&expand=requisitionList.secondaryLocations&finder=${encodeURIComponent(finder)}`
  );
}

function detailUrl(board: OracleBoard, id: string): string {
  const finder = `ById;Id="${id}",siteNumber=${board.site}`;
  return (
    `https://${board.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails` +
    `?expand=all&onlyData=true&finder=${encodeURIComponent(finder)}`
  );
}

export async function fetchOracle(token: string, label: string): Promise<RawListing[]> {
  const board = decodeOracleToken(token);
  if (!board) return [];

  const tolerate = { tolerate: [400, 403, 404, 410, 422, 500], timeoutMs: 45_000 };
  const requisitions = new Map<string, OracleRequisition>();

  for (let offset = 0; offset < MAX_REQUISITIONS; offset += PAGE) {
    const data = await getJson<OracleResponse>(listUrl(board, offset), tolerate);
    const batch = data?.items?.[0]?.requisitionList ?? [];
    for (const req of batch) if (req.Id) requisitions.set(req.Id, req);
    const total = data?.items?.[0]?.TotalJobsCount ?? 0;
    if (batch.length < PAGE || offset + PAGE >= total) break;
  }

  // Only student-shaped titles are worth a description request; everything else
  // would be discarded by the classifier anyway.
  const candidates = [...requisitions.values()].filter((r) => INTERNISH_TITLE.test(r.Title ?? ''));

  for (const req of candidates.slice(0, MAX_DETAILS)) {
    try {
      const detail = await getJson<{ items?: OracleRequisition[] }>(
        detailUrl(board, req.Id!),
        { ...tolerate, retries: 1 },
      );
      const full = detail?.items?.[0];
      if (full) requisitions.set(req.Id!, { ...req, ...full });
    } catch {
      // Title-only is still a usable listing.
    }
  }

  return candidates
    .map((base): RawListing => {
      const req = requisitions.get(base.Id!) ?? base;
      const description =
        [req.ExternalDescriptionStr, req.ExternalResponsibilitiesStr, req.ExternalQualificationsStr]
          .filter(Boolean)
          .join('\n\n') || req.ShortDescriptionStr || null;

      const locations = [
        req.PrimaryLocation,
        ...(req.secondaryLocations ?? []).map((l) => l.LocationName ?? l.Name),
      ].filter(Boolean) as string[];

      const posted = isoSecs(req.ExternalPostedStartDate ?? req.PostedDate);

      return {
        source: `oracle:${token}`,
        sourceKind: 'ats',
        sourceId: req.Id!,
        company: label,
        title: req.Title ?? '',
        applyUrl: `https://${board.host}/hcmUI/CandidateExperience/en/sites/${board.site}/job/${req.Id}`,
        description,
        locations,
        remoteFlag: req.WorkplaceType ? /remote/i.test(req.WorkplaceType) : null,
        terms: [],
        datePosted: posted,
        dateUpdated: posted,
        deadline: isoSecs(req.ExternalPostedEndDate),
        categoryHint: [req.Category, req.JobFamily].filter(Boolean).join(', '),
        degreeHints: req.StudyLevel ? [req.StudyLevel] : [],
        activeFlag: true,
      };
    })
    .filter((l) => l.title);
}

/**
 * Recognize an Oracle careers site from an application URL:
 *   https://{host}/hcmUI/CandidateExperience/{locale}/sites/{site}/job/{id}
 */
export function oracleBoardFromUrl(host: string, segments: string[]): OracleBoard | null {
  if (!host.endsWith('.oraclecloud.com')) return null;
  const index = segments.findIndex((s) => s.toLowerCase() === 'sites');
  const site = segments[index + 1];
  if (index === -1 || !site || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,60}$/.test(site)) return null;
  return { host, site };
}
