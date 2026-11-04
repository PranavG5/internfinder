import { boardFromUrl } from './seed';
import { fetchText, mapPool } from './http';

/**
 * Learn employer job boards from The Muse.
 *
 * A Muse posting links to themuse.com, not to the employer, so ordinary board
 * discovery learns nothing from it. The posting page does embed the
 * employer's real application link, though (a Greenhouse, Workday, Lever or
 * other ATS URL), and that link names a board the sync can crawl directly for
 * every role the employer has open, not just the slice Muse happens to list.
 *
 * Muse is where banks, insurers, retailers and consumer brands list their
 * business analyst and analytics internships, and many of them never appear
 * in the tech-focused community lists, so this is how those employers enter
 * the catalog.
 */

/** Every recognizable ATS board URL embedded in a page. */
export function boardUrlsFromHtml(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/https?:\/\/[^"'\s<>()]+/g)) {
    // Links arrive HTML- and JSON-escaped inside the page's inline state.
    const url = match[0]
      .replace(/\\u0026/g, '&')
      .replace(/&amp;/g, '&')
      .replace(/\\+$/, '')
      .replace(/\\\//g, '/');
    if (boardFromUrl(url)) urls.add(url);
  }
  return [...urls];
}

/** Loose employer-name key, so "The Charles Schwab Corporation" ≈ "Charles Schwab". */
export function employerKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(the|inc|llc|ltd|corp|corporation|company|co|group|plc|holdings|lp|llp)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

export interface MuseEmployerProbe {
  company: string;
  /** Board URLs found on the employer's posting page. */
  urls: string[];
}

/**
 * Open one posting page per employer and collect the ATS links it embeds.
 *
 * `known` holds employer keys the catalog already has a board for; those are
 * skipped. Employers are sampled at random up to `max`, so employers whose
 * page links nowhere useful (a closed portal) do not crowd out the rest run
 * after run.
 */
export async function probeMuseEmployers(
  postings: { company: string; applyUrl: string }[],
  known: Set<string>,
  opts: { max?: number; concurrency?: number } = {},
): Promise<MuseEmployerProbe[]> {
  const byEmployer = new Map<string, { company: string; applyUrl: string }>();
  for (const p of postings) {
    if (!p.company || !/^https:\/\/www\.themuse\.com\/jobs\//.test(p.applyUrl)) continue;
    const key = employerKey(p.company);
    if (!key || known.has(key) || byEmployer.has(key)) continue;
    byEmployer.set(key, p);
  }

  const candidates = [...byEmployer.values()];
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const sample = candidates.slice(0, opts.max ?? 60);

  const probes: MuseEmployerProbe[] = [];
  await mapPool(sample, opts.concurrency ?? 2, async ({ company, applyUrl }) => {
    try {
      const html = await fetchText(applyUrl, {
        timeoutMs: 30_000,
        retries: 1,
        headers: { Accept: 'text/html,*/*' },
      });
      if (html) probes.push({ company, urls: boardUrlsFromHtml(html) });
    } catch {
      // One unreadable page costs one employer this run, nothing more.
    }
  });
  return probes;
}
