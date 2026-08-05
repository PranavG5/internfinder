import type {
  ClassYear,
  Degree,
  Field,
  LocationType,
  ProgramType,
  RoleFamily,
  Season,
  Sponsorship,
} from '../types';
import { hashId, slugify, stripEmDashes, stripHtml, truncate } from '../util';
import { parseComp } from './comp';
import { parseDeadline, parseDuration, parseStartDate } from './dates';
import { parseEligibility } from './eligibility';
import { classifyField } from './field';
import { parseLocations } from './location';
import { classifyProgram, detectSeason } from './season';
import { extractSkills } from './skills';

export * from './comp';
export * from './dates';
export * from './eligibility';
export * from './field';
export * from './location';
export * from './season';
export * from './skills';

/** What a source adapter produces, before enrichment. */
export interface RawListing {
  source: string;
  sourceKind: 'ats' | 'aggregator' | 'board';
  sourceId: string;
  company: string;
  companyUrl?: string | null;
  title: string;
  applyUrl: string;
  description?: string | null; // HTML or plain text
  locations?: (string | null | undefined)[];
  remoteFlag?: boolean | null;
  terms?: string[];
  datePosted?: number | null;
  dateUpdated?: number | null;
  deadline?: number | null;
  categoryHint?: string | null;
  sponsorshipHint?: string | null;
  degreeHints?: string[];
  /** Structured pay from the source, when it provides it. */
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryPeriod?: string | null;
  salaryCurrency?: string | null;
  /** Source's own active flag. Undefined means "present in feed, so open". */
  activeFlag?: boolean | null;
  tags?: string[];
}

export interface NormalizedListing {
  id: string;
  source: string;
  source_kind: string;
  source_id: string;
  company: string;
  company_slug: string;
  company_url: string | null;
  title: string;
  normalized_title: string;
  apply_url: string;
  description: string | null;
  locations: string[];
  primary_location: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  location_type: LocationType;
  is_remote: number;
  season: Season;
  year: number | null;
  terms: string[];
  start_date: number | null;
  end_date: number | null;
  duration_weeks: number | null;
  deadline: number | null;
  field: Field;
  role_family: RoleFamily;
  program_type: ProgramType;
  degrees: Degree[];
  class_years: ClassYear[];
  gpa_min: number | null;
  sponsorship: Sponsorship;
  offers_sponsorship: number | null;
  requires_citizenship: number;
  requires_clearance: number;
  requires_cover_letter: number;
  requires_transcript: number;
  requires_portfolio: number;
  skills: string[];
  tags: string[];
  is_paid: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  salary_currency: string | null;
  comp_text: string | null;
  date_posted: number | null;
  date_updated: number | null;
  dedupe_key: string;
  quality: number;
  active: boolean;
}

/** Junk that clutters titles and breaks dedupe: req ids, term suffixes, location tails. */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\((?:remote|hybrid|onsite|on-site|us|usa|uk)\)/gi, ' ')
    .replace(/\b(?:req(?:uisition)?\s*#?\s*|job\s*id:?\s*|#)\s*[a-z0-9-]{4,}\b/gi, ' ')
    .replace(/\b(?:summer|fall|autumn|winter|spring)\b/gi, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\b(?:intern|internship|interns|co-?op|placement)\b/gi, ' ')
    .replace(/[-–—,()[\]/|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Enrich a raw listing into a fully classified record.
 * Returns null when the posting isn't a student internship.
 */
export function normalize(raw: RawListing, now = Date.now()): NormalizedListing | null {
  const title = stripEmDashes(raw.title ?? '').replace(/\s+/g, ' ').trim();
  const company = stripEmDashes(raw.company ?? '').replace(/\s+/g, ' ').trim();
  if (!title || !company || !raw.applyUrl) return null;

  const description = stripHtml(raw.description) || null;

  const program = classifyProgram(title, description ?? '');
  if (!program.isInternship) return null;

  const term = detectSeason(title, raw.terms ?? [], description ?? '', raw.datePosted);
  const loc = parseLocations(raw.locations ?? [], description ?? '', raw.remoteFlag);
  const cls = classifyField(title, description ?? '', raw.categoryHint ?? '');
  const elig = parseEligibility(description ?? '', {
    sponsorship: raw.sponsorshipHint,
    degrees: raw.degreeHints,
  });

  // Prefer the source's structured pay; fall back to parsing the copy.
  let isPaid: number | null = null;
  let salaryMin = raw.salaryMin ?? null;
  let salaryMax = raw.salaryMax ?? null;
  let salaryPeriod = raw.salaryPeriod ?? null;
  let salaryCurrency = raw.salaryCurrency ?? 'USD';
  let compText: string | null = null;

  if (salaryMin != null || salaryMax != null) {
    isPaid = 1;
  } else {
    const comp = parseComp(description, title);
    isPaid = comp.isPaid;
    salaryMin = comp.min;
    salaryMax = comp.max;
    salaryPeriod = comp.period;
    salaryCurrency = comp.currency;
    compText = comp.text;
  }

  const deadline = raw.deadline ?? parseDeadline(description, now);
  const startDate = parseStartDate(description, term.season, term.year, now);
  const durationWeeks = parseDuration(description);
  const endDate =
    startDate && durationWeeks ? startDate + durationWeeks * 7 * 86400 : null;

  const skills = extractSkills(description ?? title);
  const normTitle = normalizeTitle(title);
  const companySlug = slugify(company);

  const listing: NormalizedListing = {
    id: hashId(raw.source, raw.sourceId),
    source: raw.source,
    source_kind: raw.sourceKind,
    source_id: raw.sourceId,
    company,
    company_slug: companySlug,
    company_url: raw.companyUrl ?? null,
    title,
    normalized_title: normTitle,
    apply_url: raw.applyUrl,
    description: description ? truncate(description, 12000) : null,
    locations: loc.locations,
    primary_location: loc.primary,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    location_type: loc.locationType,
    is_remote: loc.isRemote,
    season: term.season,
    year: term.year,
    terms: raw.terms?.length ? raw.terms : term.season !== 'Unknown' && term.year ? [`${term.season} ${term.year}`] : [],
    start_date: startDate,
    end_date: endDate,
    duration_weeks: durationWeeks,
    deadline,
    field: cls.field,
    role_family: cls.roleFamily,
    program_type: program.programType,
    degrees: elig.degrees,
    class_years: elig.classYears,
    gpa_min: elig.gpaMin,
    sponsorship: elig.sponsorship,
    offers_sponsorship: elig.offersSponsorship,
    requires_citizenship: elig.requiresCitizenship,
    requires_clearance: elig.requiresClearance,
    requires_cover_letter: elig.requiresCoverLetter,
    requires_transcript: elig.requiresTranscript,
    requires_portfolio: elig.requiresPortfolio,
    skills,
    tags: dedupeTags([...(raw.tags ?? []), ...(term.inferred ? ['term-inferred'] : [])]),
    is_paid: isPaid,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_period: salaryPeriod,
    salary_currency: salaryCurrency,
    comp_text: compText,
    date_posted: raw.datePosted ?? null,
    date_updated: raw.dateUpdated ?? raw.datePosted ?? null,
    dedupe_key: `${companySlug}|${normTitle}|${term.season}|${term.year ?? ''}`,
    quality: 0,
    active: raw.activeFlag !== false,
  };

  listing.quality = qualityScore(listing);
  return listing;
}

function dedupeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 12);
}

/**
 * How complete a listing's metadata is (0..1). Used only as a ranking
 * tiebreak so richly-described postings surface above bare stubs.
 */
export function qualityScore(l: NormalizedListing): number {
  const checks: boolean[] = [
    !!l.description && l.description.length > 400,
    l.season !== 'Unknown',
    l.year != null,
    l.locations.length > 0,
    l.field !== 'Other',
    l.role_family !== 'other',
    l.salary_min != null,
    l.deadline != null,
    l.duration_weeks != null,
    l.skills.length > 2,
    l.degrees.length > 0,
    l.sponsorship !== 'unknown',
    l.date_posted != null,
    !!l.company_url,
  ];
  const hits = checks.filter(Boolean).length;
  return Math.round((hits / checks.length) * 100) / 100;
}
