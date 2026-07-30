import type { LocationType } from '../types';
import { unique } from '../util';

export interface LocationResult {
  locations: string[];
  primary: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  locationType: LocationType;
  isRemote: number;
}

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC', 'washington dc': 'DC', 'washington, d.c.': 'DC',
};

const STATE_CODES = new Set(Object.values(US_STATES));

/** Canadian province codes, used to disambiguate a trailing "CA". */
const CA_PROVINCES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States', us: 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States',
  'united states': 'United States', 'united states of america': 'United States',
  uk: 'United Kingdom', 'u.k.': 'United Kingdom', 'united kingdom': 'United Kingdom',
  england: 'United Kingdom', scotland: 'United Kingdom', wales: 'United Kingdom',
  // Note: the bare code "CA" is deliberately absent — in "Palo Alto, CA" it
  // means California, and US city/state pairs vastly outnumber country codes here.
  canada: 'Canada',
  india: 'India', germany: 'Germany', deutschland: 'Germany', france: 'France',
  netherlands: 'Netherlands', ireland: 'Ireland', spain: 'Spain', italy: 'Italy',
  poland: 'Poland', switzerland: 'Switzerland', sweden: 'Sweden', norway: 'Norway',
  denmark: 'Denmark', finland: 'Finland', australia: 'Australia', 'new zealand': 'New Zealand',
  singapore: 'Singapore', japan: 'Japan', china: 'China', 'hong kong': 'Hong Kong',
  taiwan: 'Taiwan', 'south korea': 'South Korea', korea: 'South Korea',
  israel: 'Israel', brazil: 'Brazil', mexico: 'Mexico', argentina: 'Argentina',
  'south africa': 'South Africa', nigeria: 'Nigeria', kenya: 'Kenya', egypt: 'Egypt',
  uae: 'United Arab Emirates', 'united arab emirates': 'United Arab Emirates',
  portugal: 'Portugal', belgium: 'Belgium', austria: 'Austria', romania: 'Romania',
  'czech republic': 'Czech Republic', czechia: 'Czech Republic', hungary: 'Hungary',
  greece: 'Greece', turkey: 'Turkey', ukraine: 'Ukraine', philippines: 'Philippines',
  vietnam: 'Vietnam', thailand: 'Thailand', malaysia: 'Malaysia', indonesia: 'Indonesia',
  pakistan: 'Pakistan', bangladesh: 'Bangladesh', chile: 'Chile', colombia: 'Colombia',
  peru: 'Peru', 'costa rica': 'Costa Rica', 'puerto rico': 'United States',
};

const REMOTE_RE = /\b(?:remote|work\s+from\s+home|wfh|virtual|telecommut|anywhere|distributed)\b/i;
const HYBRID_RE = /\bhybrid\b/i;
const ONSITE_RE = /\b(?:on[-\s]?site|in[-\s]?person|in[-\s]?office)\b/i;

/**
 * Normalize the location strings a source gives us into a canonical
 * "City, ST" / "City, Country" form plus a work-arrangement type.
 */
export function parseLocations(
  raw: (string | null | undefined)[] = [],
  descriptionHint = '',
  remoteFlag?: boolean | null,
): LocationResult {
  const cleaned = unique(
    raw
      .map((r) => (r ?? '').trim())
      .filter(Boolean)
      .flatMap((r) => r.split(/\s*(?:;|\||\bor\b|\/(?=\s*[A-Z]))\s*/))
      .map((r) => r.replace(/\s+/g, ' ').trim())
      .filter((r) => r.length > 1 && r.length < 90),
  );

  const joined = cleaned.join(' | ');
  const hint = `${joined} ${descriptionHint.slice(0, 1200)}`;

  let locationType: LocationType = 'unknown';
  let isRemote = 0;

  if (remoteFlag === true) {
    locationType = 'remote';
    isRemote = 1;
  } else if (HYBRID_RE.test(joined)) {
    locationType = 'hybrid';
  } else if (REMOTE_RE.test(joined)) {
    locationType = 'remote';
    isRemote = 1;
  } else if (ONSITE_RE.test(joined) || cleaned.length > 0) {
    locationType = 'onsite';
  }

  // Descriptions can upgrade "unknown" but shouldn't override an explicit
  // location field — a posting listing "New York, NY" that mentions remote
  // work culture is still an onsite role.
  if (locationType === 'unknown') {
    if (HYBRID_RE.test(hint)) locationType = 'hybrid';
    else if (REMOTE_RE.test(hint)) {
      locationType = 'remote';
      isRemote = 1;
    }
  } else if (locationType === 'onsite' && HYBRID_RE.test(descriptionHint.slice(0, 600))) {
    locationType = 'hybrid';
  }

  const normalized = cleaned.map(normalizeOne).filter(Boolean) as string[];
  const primary = normalized[0] ?? (isRemote ? 'Remote' : null);
  const parts = primary ? splitLocation(primary) : { city: null, region: null, country: null };

  return {
    locations: normalized.length ? normalized : isRemote ? ['Remote'] : [],
    primary,
    city: parts.city,
    region: parts.region,
    country: parts.country,
    locationType,
    isRemote,
  };
}

/** "san francisco, california" -> "San Francisco, CA" */
function normalizeOne(input: string): string | null {
  let s = input.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(?:remote\s*[-–—,]\s*|remote\s+in\s+)/i, 'Remote, ');
  if (!s) return null;

  if (/^remote$/i.test(s)) return 'Remote';

  const segments = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  const out = segments.map((seg, i) => {
    const lower = seg.toLowerCase();
    if (i > 0 && US_STATES[lower]) return US_STATES[lower];
    // A two-letter US state code must win over any same-spelled country code.
    if (STATE_CODES.has(seg.toUpperCase()) && seg.length === 2) return seg.toUpperCase();
    if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower];
    if (seg.length <= 3 && seg === seg.toUpperCase()) return seg; // already a code
    return titleCaseLoose(seg);
  });

  return unique(out).join(', ').slice(0, 80);
}

function titleCaseLoose(s: string): string {
  return s
    .split(/(\s|-)/)
    .map((w) => {
      if (/^\s|-$/.test(w) || w === '-') return w;
      if (w.length <= 2 && w === w.toUpperCase()) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join('');
}

function splitLocation(loc: string): { city: string | null; region: string | null; country: string | null } {
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { city: null, region: null, country: null };

  const last = parts[parts.length - 1];

  // "Vancouver, BC, CA" — a province code earlier in the string means the
  // trailing "CA" is Canada, not California.
  if (last === 'CA' && parts.some((p) => CA_PROVINCES.has(p.toUpperCase()))) {
    return {
      city: parts[0],
      region: parts.find((p) => CA_PROVINCES.has(p.toUpperCase())) ?? null,
      country: 'Canada',
    };
  }

  // "City, ST" — a US state code in the final slot implies the United States.
  if (STATE_CODES.has(last)) {
    return {
      city: parts.length > 1 ? parts[0] : null,
      region: last,
      country: 'United States',
    };
  }

  const asCountry = COUNTRY_ALIASES[last.toLowerCase()] ?? (isKnownCountry(last) ? last : null);
  if (asCountry) {
    return {
      city: parts.length > 1 ? parts[0] : null,
      region: parts.length > 2 ? parts[1] : null,
      country: asCountry,
    };
  }

  return { city: parts[0], region: parts[1] ?? null, country: null };
}

const KNOWN_COUNTRIES = new Set(Object.values(COUNTRY_ALIASES));
function isKnownCountry(s: string): boolean {
  return KNOWN_COUNTRIES.has(s);
}

export function knownCountries(): string[] {
  return [...KNOWN_COUNTRIES].sort();
}
