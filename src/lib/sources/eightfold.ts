import type { RawListing } from '../parse';
import { getJson } from './http';

/**
 * Eightfold AI adapter.
 *
 * Eightfold hosts the careers site for Netflix, Qualcomm, Zebra and a long tail
 * of enterprises, either on `{company}.eightfold.ai` or on a vanity host like
 * `explore.jobs.netflix.net`. Every instance answers the same public endpoint:
 *
 *   GET https://{host}/api/apply/v2/jobs?domain={domain}&query=…&start=…&num=…
 *
 * `domain` is the tenant key and is not derivable from the host in general, so
 * it is stored alongside it in the source token.
 */

const PAGE = 50;
const MAX_PAGES = 8;

interface EightfoldPosition {
  id?: number | string;
  name?: string;
  location?: string;
  locations?: string[];
  department?: string;
  business_unit?: string;
  t_create?: number;
  t_update?: number;
  display_job_id?: string;
  ats_job_id?: string;
  job_description?: string;
  work_location_option?: string;
  location_flexibility?: string;
  canonicalPositionUrl?: string;
}

interface EightfoldResponse {
  count?: number;
  positions?: EightfoldPosition[];
}

export interface EightfoldBoard {
  host: string;
  domain: string;
}

export function encodeEightfoldToken(board: EightfoldBoard): string {
  return `${board.host}/${board.domain}`;
}

export function decodeEightfoldToken(token: string): EightfoldBoard | null {
  const [host, domain] = token.split('/');
  return host && domain ? { host, domain } : null;
}

/** Eightfold reports locations as "Los Gatos,California,United States of America". */
function tidyLocation(raw: string | undefined): string | null {
  if (!raw) return null;
  return raw.split(',').map((p) => p.trim()).filter(Boolean).join(', ') || null;
}

async function search(
  board: EightfoldBoard,
  query: string,
  into: Map<string, EightfoldPosition>,
): Promise<void> {
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    const url =
      `https://${board.host}/api/apply/v2/jobs?domain=${encodeURIComponent(board.domain)}` +
      `&query=${encodeURIComponent(query)}&start=${pageIndex * PAGE}&num=${PAGE}&sort_by=relevance`;
    const data = await getJson<EightfoldResponse>(url, {
      timeoutMs: 40_000,
      tolerate: [400, 401, 403, 404, 410, 422],
    });
    const positions = data?.positions ?? [];
    for (const position of positions) {
      if (position.id != null) into.set(String(position.id), position);
    }
    if (positions.length < PAGE) break;
  }
}

export async function fetchEightfold(token: string, label: string): Promise<RawListing[]> {
  const board = decodeEightfoldToken(token);
  if (!board) return [];

  const found = new Map<string, EightfoldPosition>();
  // Eightfold's relevance search is token-based rather than prefix-based, so
  // these stay on-topic; the union covers naming variants across tenants.
  for (const query of ['intern', 'internship', 'co-op']) {
    await search(board, query, found);
  }

  return [...found.values()]
    .map((position): RawListing => {
      const locations = (position.locations?.length ? position.locations : [position.location])
        .map((l) => tidyLocation(l ?? undefined))
        .filter(Boolean) as string[];

      const flexibility = `${position.work_location_option ?? ''} ${position.location_flexibility ?? ''}`;

      return {
        source: `eightfold:${token}`,
        sourceKind: 'ats',
        sourceId: String(position.id),
        company: label,
        title: position.name ?? '',
        applyUrl:
          position.canonicalPositionUrl || `https://${board.host}/careers/job/${position.id}`,
        description: position.job_description || null,
        locations,
        remoteFlag: /remote/i.test(flexibility) ? true : /onsite/i.test(flexibility) ? false : null,
        terms: [],
        datePosted: position.t_create ?? null,
        dateUpdated: position.t_update ?? position.t_create ?? null,
        categoryHint: [position.department, position.business_unit].filter(Boolean).join(', '),
        activeFlag: true,
      };
    })
    .filter((l) => l.title && l.applyUrl);
}

/**
 * Recognize an Eightfold careers site from an application URL:
 *   https://{company}.eightfold.ai/careers/job/{id}
 *
 * Vanity hosts (explore.jobs.netflix.net) carry no derivable tenant key, so
 * they are seeded by hand rather than discovered.
 */
export function eightfoldBoardFromUrl(host: string, segments: string[]): EightfoldBoard | null {
  if (!host.endsWith('.eightfold.ai')) return null;
  if (segments[0]?.toLowerCase() !== 'careers') return null;
  const tenant = host.split('.')[0];
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(tenant)) return null;
  return { host, domain: `${tenant}.com` };
}
