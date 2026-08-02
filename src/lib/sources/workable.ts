import type { RawListing } from '../parse';
import { getJson } from './http';

/**
 * Workable adapter. The public widget API serves every published job on a
 * company's `apply.workable.com` board, including full HTML descriptions when
 * `details=true` — same openness guarantee as the other ATS adapters: a role is
 * present only while it accepts applications.
 */

interface WorkableJob {
  title: string;
  shortcode: string;
  code?: string;
  employment_type?: string;
  telecommuting?: boolean;
  department?: string;
  url?: string;
  application_url?: string;
  published_on?: string;   // "2024-05-21"
  created_at?: string;
  country?: string;
  city?: string;
  state?: string;
  description?: string;
  locations?: { country?: string; countryCode?: string; city?: string; region?: string }[];
}

const daySecs = (date: string | null | undefined): number | null => {
  if (!date) return null;
  const t = Date.parse(date);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

export async function fetchWorkable(token: string, label: string): Promise<RawListing[]> {
  const data = await getJson<{ name?: string; jobs?: WorkableJob[] }>(
    `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(token)}?details=true`,
  );
  if (!data?.jobs) return [];

  return data.jobs
    .map((job): RawListing => {
      const locations = [
        [job.city, job.state, job.country].filter(Boolean).join(', '),
        ...(job.locations ?? []).map((l) =>
          [l.city, l.region, l.country].filter(Boolean).join(', '),
        ),
      ].filter(Boolean);

      return {
        source: `workable:${token}`,
        sourceKind: 'ats',
        sourceId: job.shortcode ?? job.code ?? job.title,
        company: data.name?.trim() || label,
        title: job.title ?? '',
        applyUrl:
          job.application_url ||
          job.url ||
          `https://apply.workable.com/${encodeURIComponent(token)}/j/${job.shortcode}/`,
        description: job.description ?? null,
        locations,
        remoteFlag: job.telecommuting ?? null,
        terms: [],
        datePosted: daySecs(job.published_on) ?? daySecs(job.created_at),
        dateUpdated: daySecs(job.published_on) ?? daySecs(job.created_at),
        categoryHint: job.department ?? '',
        activeFlag: true,
        tags: job.employment_type ? [`employment:${job.employment_type}`] : [],
      };
    })
    .filter((l) => l.applyUrl && l.title);
}
