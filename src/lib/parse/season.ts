import type { ProgramType, Season } from '../types';

/** Word-boundary aware. `intern` must not match "internal" / "international" / "internet". */
const INTERN_WORD = /\bintern(?:ship|ships|s)?\b/i;

const POSITIVE_PROGRAM_PATTERNS: { re: RegExp; type: ProgramType }[] = [
  { re: /\bco-?ops?\b/i, type: 'co-op' },
  { re: /\bapprentice(?:ship)?s?\b/i, type: 'apprenticeship' },
  { re: /\bfellow(?:ship)?s?\b/i, type: 'fellowship' },
  { re: /\b(?:undergraduate|graduate|phd|doctoral)\s+research(?:er)?\b/i, type: 'research' },
  { re: /\bresearch\s+(?:intern|assistant|scholar|experience)\b/i, type: 'research' },
  // Lab and research openings rarely use the word "intern". The federal
  // research participation catalogs, university bench postings and REU sites
  // all have their own vocabulary, and none of it matched before.
  // Deliberately not "research program": that phrase is most often the middle
  // of "Research Program Manager", which is a career job, not a placement.
  { re: /\bresearch\s+(?:participation|opportunit(?:y|ies)|traineeship)\b/i, type: 'research' },
  { re: /\bresearch\s+experience\s+for\s+undergraduates\b|\bREU\b/, type: 'research' },
  { re: /\b(?:summer|student|undergraduate)\s+research\b/i, type: 'research' },
  { re: /\b(?:lab|laboratory)\s+(?:opportunity|assistant|aide)\b/i, type: 'research' },
  { re: /\bpost-?bac(?:calaureate)?\b/i, type: 'research' },
  // Clinical training that premed and prehealth students actually apply to.
  { re: /\bpre-?(?:med|health|dental|vet)\b/i, type: 'internship' },
  { re: /\b(?:medical|clinical)\s+scribe\b|\bscribe\b/i, type: 'internship' },
  { re: /\bclinical\s+(?:rotation|clerkship|practicum)\b/i, type: 'internship' },
  { re: /\bpracticum\b/i, type: 'internship' },
  { re: /\bshadowing\s+(?:program|opportunit)/i, type: 'internship' },
  { re: /\bnurse\s+(?:extern|apprentice)/i, type: 'internship' },
  { re: /\bsummer\s+(?:analyst|associate|scholar|program|experience)\b/i, type: 'internship' },
  { re: /\bindustrial\s+placement\b/i, type: 'internship' },
  { re: /\b(?:12|6|3)\s*month\s+placement\b/i, type: 'internship' },
  { re: /\bplacement\s+(?:student|year|scheme)\b/i, type: 'internship' },
  { re: /\bwerkstudent|working\s+student\b/i, type: 'internship' },
  { re: /\bpraktikum|praktikant/i, type: 'internship' },
  { re: /\bbecario|becaria|pasant[ií]a/i, type: 'internship' },
  { re: /\bstagi?air|\bstage\s+(?:de|en)\b/i, type: 'internship' },
  { re: /\btirocinio|stagista/i, type: 'internship' },
  { re: /\bvacation\s+(?:scheme|programme)\b/i, type: 'internship' },
  { re: /\bextern(?:ship)?\b/i, type: 'internship' },
  { re: /\bstudent\s+(?:trainee|worker|assistant|placement)\b/i, type: 'internship' },
  { re: /\brotational\s+program\b/i, type: 'rotational' },
  { re: /\bsummer\s+(?:intern|internship)\b/i, type: 'internship' },
];

/** Titles that are clearly not student internships even if a keyword brushes past. */
const NEGATIVE_PATTERNS = [
  /\b(?:senior|sr\.?|staff|principal|lead|head|director|vp|vice\s+president|chief)\b/i,
  /\bintern(?:ship)?\s+(?:coordinator|manager|supervisor|recruiter|program\s+manager)\b/i,
  /\bmanage(?:r|ment)\s+of\s+intern/i,
  /\b(?:full[-\s]?time|permanent)\s+(?:only|position|role)\b/i,
  /\bnew\s+grad(?:uate)?\s+(?:only|rotational)?\b/i,
  /\bexperienced\s+(?:hire|professional)\b/i,
  /\b\d{1,2}\+?\s*years?\s+of\s+(?:professional\s+)?experience\s+required\b/i,
  // A postdoc or a faculty appointment needs a finished doctorate, so neither
  // is a student position no matter how much research language surrounds it.
  /\bpost[-\s]?doc(?:toral)?\b/i,
  /\b(?:attending|faculty|professor|tenure[-\s]track)\b/i,
];

export interface ProgramClassification {
  isInternship: boolean;
  programType: ProgramType;
  confidence: number;
}

/**
 * Decide whether a posting is a student internship, and which flavor.
 * Title carries far more signal than description, so it is weighted heavily.
 */
export function classifyProgram(title: string, description = ''): ProgramClassification {
  const t = title ?? '';
  const body = `${t}\n${(description ?? '').slice(0, 4000)}`;

  for (const neg of NEGATIVE_PATTERNS) {
    if (neg.test(t)) return { isInternship: false, programType: 'internship', confidence: 0.9 };
  }

  // Strongest signal: the word "intern" in the title.
  if (INTERN_WORD.test(t)) {
    const coop = /\bco-?ops?\b/i.test(t);
    return { isInternship: true, programType: coop ? 'co-op' : 'internship', confidence: 0.98 };
  }

  for (const { re, type } of POSITIVE_PROGRAM_PATTERNS) {
    if (re.test(t)) return { isInternship: true, programType: type, confidence: 0.85 };
  }

  // Fall back to the body, but require an explicit student framing to avoid
  // pulling in full-time roles that merely mention an internship program.
  if (INTERN_WORD.test(body) && /\b(?:current(?:ly)?\s+enrolled|pursuing\s+a|rising\s+(?:junior|senior|sophomore)|undergraduate|graduate\s+student)\b/i.test(body)) {
    return { isInternship: true, programType: 'internship', confidence: 0.55 };
  }

  return { isInternship: false, programType: 'internship', confidence: 0.6 };
}

const SEASON_WORDS: { re: RegExp; season: Season }[] = [
  { re: /\bsummer|sommer|verano|été|estate\b/i, season: 'Summer' },
  { re: /\bfall|autumn|herbst|automne\b/i, season: 'Fall' },
  { re: /\bwinter|hiver|invierno\b/i, season: 'Winter' },
  { re: /\bspring|printemps|primavera\b/i, season: 'Spring' },
];

export interface SeasonResult {
  season: Season;
  year: number | null;
  inferred: boolean;
}

/**
 * Resolve the term a listing targets.
 *
 * Precedence: explicit `terms` from the source > season+year in the title >
 * season+year in the description > a conservative guess from the posting date.
 */
export function detectSeason(
  title: string,
  terms: string[] = [],
  description = '',
  datePosted?: number | null,
): SeasonResult {
  // 1. Structured terms from the source, e.g. "Summer 2026".
  for (const term of terms) {
    const parsed = parseTermString(term);
    if (parsed.season !== 'Unknown') return { ...parsed, inferred: false };
  }

  // 2. The title.
  const fromTitle = parseTermString(title);
  if (fromTitle.season !== 'Unknown') {
    return {
      season: fromTitle.season,
      year: fromTitle.year ?? guessYear(fromTitle.season, datePosted),
      inferred: fromTitle.year == null,
    };
  }

  // 3. The description, but only the first chunk, where term language lives.
  const head = (description ?? '').slice(0, 2500);
  const fromBody = parseTermString(head);
  if (fromBody.season !== 'Unknown') {
    return {
      season: fromBody.season,
      year: fromBody.year ?? guessYear(fromBody.season, datePosted),
      inferred: true,
    };
  }

  // 4. A bare year in the title is still useful.
  const bareYear = onlyYear(title) ?? onlyYear(head);
  if (bareYear) return { season: 'Unknown', year: bareYear, inferred: true };

  return { season: 'Unknown', year: null, inferred: true };
}

/** Parse a single term-ish string such as "Summer 2026" or "2026 Fall Co-op". */
export function parseTermString(input: string): { season: Season; year: number | null } {
  const s = input ?? '';
  if (/year[-\s]?round|all\s+year/i.test(s)) return { season: 'Year-round', year: onlyYear(s) };

  let season: Season = 'Unknown';
  let bestIndex = Infinity;
  for (const { re, season: sea } of SEASON_WORDS) {
    const m = re.exec(s);
    if (m && m.index < bestIndex) {
      bestIndex = m.index;
      season = sea;
    }
  }

  // Prefer a year adjacent to the season word, e.g. "... Summer 2026 ..."
  let year: number | null = null;
  if (season !== 'Unknown' && bestIndex !== Infinity) {
    const window = s.slice(Math.max(0, bestIndex - 12), bestIndex + 32);
    year = onlyYear(window);
  }
  year ??= onlyYear(s);

  return { season, year };
}

/** Extract a plausible internship year (current-ish decade only). */
function onlyYear(s: string): number | null {
  const thisYear = new Date().getFullYear();
  const matches = [...(s ?? '').matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  // Also accept two-digit shorthand like "Summer '26".
  for (const m of (s ?? '').matchAll(/'(\d{2})\b/g)) matches.push(2000 + Number(m[1]));
  const plausible = matches.filter((y) => y >= thisYear - 1 && y <= thisYear + 4);
  return plausible.length ? Math.min(...plausible) : null;
}

/**
 * When a listing names a season but no year, pick the next occurrence of that
 * season relative to when it was posted. Recruiting runs ahead of the calendar,
 * so a Summer role posted in September targets the following summer.
 */
function guessYear(season: Season, datePosted?: number | null): number {
  const at = datePosted ? new Date(datePosted * 1000) : new Date();
  const year = at.getFullYear();
  const month = at.getMonth(); // 0-indexed

  switch (season) {
    case 'Summer':
      // Postings from July onward are for next summer.
      return month >= 6 ? year + 1 : year;
    case 'Fall':
      return month >= 8 ? year + 1 : year;
    case 'Winter':
      return month >= 11 ? year + 1 : year;
    case 'Spring':
      return month >= 3 ? year + 1 : year;
    default:
      return year;
  }
}

/** Approximate start date for a term, used when the posting gives no explicit date. */
export function seasonStartDate(season: Season, year: number | null): number | null {
  if (!year || season === 'Unknown' || season === 'Year-round') return null;
  const month = { Summer: 5, Fall: 8, Winter: 0, Spring: 2 }[season as 'Summer' | 'Fall' | 'Winter' | 'Spring'];
  if (month == null) return null;
  // Winter terms are named for the year they start in January of.
  return Math.floor(new Date(year, month, 1, 12).getTime() / 1000);
}
