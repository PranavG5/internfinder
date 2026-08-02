/**
 * Seed list of applicant-tracking-system job boards.
 *
 * Every token here was verified to return a live board (see
 * scripts/verify-seeds.ts). The list only bootstraps the catalog —
 * `discoverBoards()` grows it automatically by reading the apply URLs that come
 * back from the aggregator feeds, so the app learns about new employers without
 * anyone editing this file.
 */

export interface SeedBoard {
  kind: 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters' | 'workable';
  token: string;
  label: string;
}

const GREENHOUSE = [
  'affirm', 'airtable', 'anthropic', 'asana', 'astranis', 'brex', 'checkr', 'chime',
  'cloudflare', 'coinbase', 'databricks', 'datadog', 'discord', 'dropbox',
  'duolingo', 'elastic', 'faire', 'figma', 'fivetran', 'flexport', 'ginkgobioworks',
  'gitlab', 'glossier', 'gusto', 'instacart', 'komodohealth', 'lyft', 'marqeta',
  'mercury', 'mongodb', 'muonspace', 'nextdoor', 'nuro', 'peloton', 'pinterest',
  'planetlabs', 'recursionpharmaceuticals', 'reddit', 'remotecom', 'riotgames',
  'robinhood', 'roblox', 'samsara', 'slingshotaerospace', 'sofi', 'truveta', 'twilio',
  'twitch', 'vercel', 'verkada',
  // Expansion wave: large intern programs across tech, aero, quant, and health.
  'stripe', 'airbnb', 'doordashusa', 'spacex', 'andurilindustries', 'scaleai',
  'epicgames', 'klaviyo', 'moloco', 'qualtrics', 'thetradedesk', 'zscaler',
  'waymo', 'flyzipline', 'aurorainnovation', 'torcrobotics', 'figureai',
  'jumptrading', 'optiverus', 'virtu', 'flowtraders', 'squarepointcapital',
  'towerresearchcapital', 'akunacapital', 'drweng', 'imc', 'wehrtyou', 'okta',
  'boxinc', 'squarespace', 'neuralink', 'amplitude', 'braze', 'carta',
  'gofundme', 'lucidmotors', 'pandadoc', 'stubhubinc', 'tanium', 'tripadvisor',
  'cockroachlabs', 'chanzuckerberginitiative', 'zocdoc', 'crunchyroll', 'roku',
  'tripactions', 'rocketlab', 'toast', 'liftoff',
] as const;

const LEVER = [
  'alloy', 'canvasmedical', 'palantir', 'spotify', 'zoox',
  // Expansion wave.
  'kraken123', 'highspot', 'outreach', 'entrata', 'matchgroup', 'mashgin',
  'plaid', 'saronic',
] as const;

const ASHBY = [
  'abridge', 'braintrust', 'clickhouse', 'cognition', 'cohere', 'cursor', 'elevenlabs',
  'harvey', 'langchain', 'linear', 'llamaindex', 'lovable', 'materialize', 'modal',
  'neon', 'neptune', 'notion', 'openai', 'pika', 'pinecone', 'poolside', 'ramp', 'reka',
  'replit', 'sierra', 'suno', 'supabase', 'synthesia', 'vanta', 'warp', 'weaviate',
  'writer', 'zed',
  // Expansion wave.
  'astronomer', 'multiverse', 'eightsleep', 'decagon', 'sardine', 'browserbase',
  'character', 'kalshi', 'polymarket', 'anrok', 'mercor', 'skydio', 'runway',
  'gecko-robotics', 'Deel',
] as const;

const SMARTRECRUITERS = [
  'Visa',
  // Expansion wave.
  'ServiceNow', 'BoschGroup', 'Ubisoft2', 'Gameloft', 'Experian', 'Devoteam',
  'Continental',
] as const;

const WORKABLE = [
  'blueground', 'huggingface', 'moodle',
] as const;

/** Turn a board slug into something presentable, e.g. "ginkgobioworks" -> "Ginkgobioworks". */
function label(token: string): string {
  return token
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export const SEED_BOARDS: SeedBoard[] = [
  ...GREENHOUSE.map((token) => ({ kind: 'greenhouse' as const, token, label: label(token) })),
  ...LEVER.map((token) => ({ kind: 'lever' as const, token, label: label(token) })),
  ...ASHBY.map((token) => ({ kind: 'ashby' as const, token, label: label(token) })),
  ...SMARTRECRUITERS.map((token) => ({ kind: 'smartrecruiters' as const, token, label: token })),
  ...WORKABLE.map((token) => ({ kind: 'workable' as const, token, label: label(token) })),
];

/** Singleton feeds that aren't per-company. */
export const SEED_FEEDS: { kind: string; token: string; label: string }[] = [
  { kind: 'github', token: 'simplify-summer', label: 'GitHub · SimplifyJobs Summer 2026' },
  { kind: 'github', token: 'vansh-summer', label: 'GitHub · vanshb03 Summer 2026' },
  { kind: 'remoteok', token: '-', label: 'RemoteOK' },
  { kind: 'arbeitnow', token: '-', label: 'Arbeitnow (Europe)' },
  { kind: 'jobicy', token: '-', label: 'Jobicy (remote)' },
];

/**
 * Recognize an ATS board from an application URL so new employers can be
 * discovered from feeds we already ingest.
 */
export function boardFromUrl(url: string): SeedBoard | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const segments = u.pathname.split('/').filter(Boolean);

  const take = (index: number): string | null => {
    const raw = segments[index];
    if (!raw) return null;
    const token = decodeURIComponent(raw).trim();
    // Board slugs are short and simple; anything else is a path, not a token.
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,48}$/.test(token)) return null;
    if (/^(jobs?|careers?|embed|board|search|en-us|api|v\d+)$/i.test(token)) return null;
    return token;
  };

  if (host.endsWith('greenhouse.io')) {
    // boards.greenhouse.io/<token>/jobs/123, job-boards.greenhouse.io/<token>/jobs/123
    const token = take(0);
    return token ? { kind: 'greenhouse', token, label: label(token) } : null;
  }
  if (host.endsWith('lever.co')) {
    const token = take(0);
    return token ? { kind: 'lever', token, label: label(token) } : null;
  }
  if (host.endsWith('ashbyhq.com')) {
    const token = take(0);
    return token ? { kind: 'ashby', token, label: label(token) } : null;
  }
  if (host.endsWith('smartrecruiters.com')) {
    const token = take(0);
    return token ? { kind: 'smartrecruiters', token, label: token } : null;
  }
  if (host === 'apply.workable.com') {
    // apply.workable.com/<token>/j/<shortcode>
    const token = take(0);
    return token ? { kind: 'workable', token, label: label(token) } : null;
  }
  return null;
}
