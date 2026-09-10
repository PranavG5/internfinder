import { decodeHtmlEntities } from '../util';
import { fetchText, getJson } from './http';

/**
 * Community channels that announce openings before any aggregator indexes them.
 *
 * These are read for links, not for listings. A Reddit post saying "Massive
 * internship drop just happened" is a lead, not a job: the title is not a role
 * title and the poster is not the employer. So each channel contributes the
 * apply URLs it mentions, board discovery turns those into employer job boards,
 * and the ATS adapters then read the roles straight from the employer. Every
 * listing that reaches the catalog this way was still confirmed open on the
 * company's own board, which is the only openness signal worth trusting.
 */

export interface DiscoveredLink {
  url: string;
  /** Employer name, when the channel states one. Rarely available. */
  company?: string;
}

/** Hosts that are never an employer's job board, however often they are linked. */
const IGNORED_HOSTS =
  /(?:^|\.)(?:reddit\.com|redd\.it|imgur\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|linkedin\.com|facebook\.com|instagram\.com|medium\.com|github\.io|wikipedia\.org|news\.ycombinator\.com|indeed\.com|glassdoor\.com|ziprecruiter\.com|monster\.com|simplify\.jobs|discord\.gg|t\.me|bit\.ly|tinyurl\.com|goo\.gl)$/i;

function collectUrls(text: string, into: Map<string, DiscoveredLink>): void {
  for (const match of decodeHtmlEntities(text).matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) {
    // Trailing sentence punctuation is not part of the link.
    const raw = match[0].replace(/[.,;:!?]+$/, '');
    let host: string;
    try {
      host = new URL(raw).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (IGNORED_HOSTS.test(host)) continue;
    if (!into.has(raw)) into.set(raw, { url: raw });
  }
}

// ---------------------------------------------------------- Hacker News

interface AlgoliaStory {
  objectID?: string;
  title?: string;
}

interface AlgoliaComments {
  hits?: { comment_text?: string }[];
  nbPages?: number;
}

/** Monthly threads to read. Older ones are mostly boards we already know. */
const HN_THREADS = 4;
/** Comment pages per thread, at 100 comments each. Threads run ~400 comments. */
const HN_PAGES = 5;

/**
 * "Ask HN: Who is hiring?" runs on the first weekday of every month and is the
 * densest public list of employer job boards anywhere: several hundred
 * companies per thread, each linking its own board rather than an aggregator.
 */
export async function fetchHackerNewsLinks(): Promise<DiscoveredLink[]> {
  const stories = await getJson<{ hits?: AlgoliaStory[] }>(
    'https://hn.algolia.com/api/v1/search_by_date' +
      '?query=%22Who%20is%20hiring%22&tags=story,author_whoishiring&hitsPerPage=12',
  );

  const ids = (stories?.hits ?? [])
    .filter((hit) => hit.objectID && /who is hiring/i.test(hit.title ?? ''))
    .slice(0, HN_THREADS)
    .map((hit) => hit.objectID!);

  const found = new Map<string, DiscoveredLink>();
  for (const id of ids) {
    for (let page = 0; page < HN_PAGES; page++) {
      const data = await getJson<AlgoliaComments>(
        `https://hn.algolia.com/api/v1/search?tags=comment,story_${id}&hitsPerPage=100&page=${page}`,
        { timeoutMs: 30_000 },
      );
      if (!data) break;
      for (const hit of data.hits ?? []) collectUrls(hit.comment_text ?? '', found);
      if (page + 1 >= (data.nbPages ?? 0)) break;
    }
  }

  return [...found.values()];
}

// --------------------------------------------------------------- Reddit

/**
 * Subreddits where students post openings the moment a company drops them.
 *
 * Reddit refuses its JSON API to unauthenticated clients, but still serves the
 * per-subreddit Atom feeds, and those carry the full post body, which is where
 * the apply links are.
 */
const SUBREDDITS = [
  'internships',
  'csMajors',
  'cscareerquestions',
  'jobpostings',
  'EngineeringStudents',
  'FinancialCareers',
  'biotech',
  'labrats',
  'premed',
  'MachineLearning',
  'dataengineering',
  'ITCareerQuestions',
  'gamedev',
  'publichealth',
  'consulting',
  'Accounting',
  'ElectricalEngineering',
  'MechanicalEngineering',
  'aerospace',
  'UKJobs',
];

/** Feed variants per subreddit: what is new, and what the sub is upvoting. */
const REDDIT_FEEDS = ['new/.rss', 'top/.rss?t=week'];

/**
 * Gap between Reddit requests. Reddit throttles anonymous clients hard, and a
 * run that trips the limit on its third subreddit reads nothing from the other
 * seventeen, so this deliberately trades run time for coverage.
 */
const REDDIT_GAP_MS = 1_500;
/** Consecutive refusals before giving up: past this the limit is on, not a blip. */
const REDDIT_MAX_MISSES = 6;

export async function fetchRedditLinks(): Promise<DiscoveredLink[]> {
  const found = new Map<string, DiscoveredLink>();
  let misses = 0;

  for (const sub of SUBREDDITS) {
    for (const feed of REDDIT_FEEDS) {
      if (misses >= REDDIT_MAX_MISSES) return [...found.values()];

      // Reddit answers 429 rather than erroring when it wants a client to slow
      // down, so a miss here is tolerated and simply costs this feed's links.
      const xml = await fetchText(`https://www.reddit.com/r/${sub}/${feed}`, {
        timeoutMs: 30_000,
        tolerate: [403, 404, 429, 500, 502, 503],
        headers: { Accept: 'application/atom+xml, application/xml, text/xml' },
      }).catch(() => null);

      if (!xml) {
        misses++;
        continue;
      }
      misses = 0;

      for (const entry of xml.split(/<entry>/i).slice(1)) {
        const content = /<content type="html">([\s\S]*?)<\/content>/i.exec(entry);
        if (content) collectUrls(content[1], found);
      }

      await new Promise((resolve) => setTimeout(resolve, REDDIT_GAP_MS));
    }
  }

  return [...found.values()];
}
