import type { ClassYear, Degree, Sponsorship } from '../types';

export interface EligibilityResult {
  degrees: Degree[];
  classYears: ClassYear[];
  gpaMin: number | null;
  sponsorship: Sponsorship;
  offersSponsorship: number | null;
  requiresCitizenship: number;
  requiresClearance: number;
  requiresCoverLetter: number;
  requiresTranscript: number;
  requiresPortfolio: number;
}

const DEGREE_PATTERNS: { re: RegExp; degree: Degree }[] = [
  { re: /\b(?:bachelor'?s?|BS\b|B\.S\.|BSc\b|BA\b|B\.A\.|BEng\b|undergraduate|undergrad)\b/i, degree: 'Bachelors' },
  { re: /\b(?:master'?s?|MS\b|M\.S\.|MSc\b|MEng\b|MA\b|M\.A\.)\b/i, degree: 'Masters' },
  { re: /\bMBA\b/i, degree: 'MBA' },
  { re: /\b(?:PhD|Ph\.D\.|doctoral|doctorate)\b/i, degree: 'PhD' },
  { re: /\bassociate'?s?\s+degree\b/i, degree: 'Associate' },
  { re: /\bhigh\s+school\s+(?:student|senior|diploma|junior)\b/i, degree: 'High School' },
];

const CLASS_YEAR_PATTERNS: { re: RegExp; year: ClassYear }[] = [
  { re: /\b(?:rising\s+)?freshm[ae]n\b|\bfirst[-\s]year\s+student\b|\b1st\s+year\b/i, year: 'Freshman' },
  { re: /\b(?:rising\s+)?sophomores?\b|\bsecond[-\s]year\s+student\b|\b2nd\s+year\b/i, year: 'Sophomore' },
  { re: /\b(?:rising\s+)?juniors?\b|\bthird[-\s]year\s+student\b|\b3rd\s+year\b|\bpenultimate\s+year\b/i, year: 'Junior' },
  { re: /\b(?:rising\s+)?seniors?\b|\bfourth[-\s]year\s+student\b|\b4th\s+year\b|\bfinal\s+year\s+student\b/i, year: 'Senior' },
  { re: /\bgraduate\s+student\b|\bgrad\s+student\b|\bpost[-\s]?grad\b|\bmasters?\s+student\b|\bphd\s+(?:student|candidate)\b/i, year: 'Graduate' },
];

const CITIZENSHIP =
  /\b(?:U\.?S\.?\s+citizenship\s+(?:is\s+)?(?:required|mandatory)|must\s+be\s+a\s+U\.?S\.?\s+citizen|US\s+citizens?\s+only|sole\s+U\.?S\.?\s+citizenship|restricted\s+to\s+U\.?S\.?\s+citizens)\b/i;

const CLEARANCE =
  /\b(?:security\s+clearance|active\s+(?:secret|top\s+secret|TS\/SCI)|TS\/SCI|able\s+to\s+obtain\s+(?:a\s+)?clearance|DoD\s+clearance|polygraph)\b/i;

const NO_SPONSORSHIP =
  /\b(?:(?:does|do|will)\s+not\s+(?:provide|offer|sponsor|support)\s+(?:visa\s+)?(?:sponsorship|immigration)|no\s+visa\s+sponsorship|unable\s+to\s+sponsor|not\s+able\s+to\s+(?:provide\s+)?sponsor|without\s+(?:the\s+)?need\s+for\s+(?:current\s+or\s+future\s+)?sponsorship|not\s+require\s+sponsorship|authorized\s+to\s+work\s+.{0,40}without\s+sponsorship)\b/i;

const YES_SPONSORSHIP =
  /\b(?:(?:we|company)\s+(?:will\s+)?(?:provide|offer|sponsor)s?\s+(?:visa\s+)?sponsorship|visa\s+sponsorship\s+(?:is\s+)?available|sponsorship\s+(?:is\s+)?provided|will\s+sponsor|H-?1B\s+sponsorship\s+available|CPT\/OPT\s+(?:eligible|accepted))\b/i;

const COVER_LETTER = /\bcover\s+letter\b/i;
const NO_COVER_LETTER = /\bcover\s+letter\s+(?:is\s+)?(?:not\s+required|optional)\b/i;
const TRANSCRIPT = /\b(?:(?:un)?official\s+)?transcript(?:s)?\b/i;
const PORTFOLIO = /\b(?:portfolio|work\s+samples|github\s+(?:link|profile)|design\s+portfolio|writing\s+samples|reel)\b/i;

/**
 * Read prerequisites out of a posting. Every field degrades to
 * "unknown" rather than guessing, so filters never silently exclude
 * a listing on invented data.
 */
export function parseEligibility(
  text: string | null | undefined,
  hints: { sponsorship?: string | null; degrees?: string[] } = {},
): EligibilityResult {
  const body = text ?? '';

  const degrees = new Set<Degree>();
  for (const d of hints.degrees ?? []) {
    const norm = normalizeDegree(d);
    if (norm) degrees.add(norm);
  }
  if (degrees.size === 0) {
    for (const { re, degree } of DEGREE_PATTERNS) {
      if (re.test(body)) degrees.add(degree);
    }
  }

  const classYears = new Set<ClassYear>();
  for (const { re, year } of CLASS_YEAR_PATTERNS) {
    if (re.test(body)) classYears.add(year);
  }
  // "Bachelors" with no year language means any undergrad year is plausible;
  // leave it empty rather than fabricating a restriction.

  const requiresCitizenship = CITIZENSHIP.test(body) || /citizenship\s+is\s+required/i.test(hints.sponsorship ?? '') ? 1 : 0;
  const requiresClearance = CLEARANCE.test(body) || /clearance/i.test(hints.sponsorship ?? '') ? 1 : 0;

  let sponsorship: Sponsorship = 'unknown';
  let offersSponsorship: number | null = null;

  // The source's own sponsorship label wins when present.
  const hint = (hints.sponsorship ?? '').toLowerCase();
  if (hint.includes('citizenship')) {
    sponsorship = 'us-citizenship';
    offersSponsorship = 0;
  } else if (hint.includes('does not offer') || hint.includes('no sponsorship')) {
    sponsorship = 'does-not-offer';
    offersSponsorship = 0;
  } else if (hint.includes('offers sponsorship') || hint.includes('will sponsor')) {
    sponsorship = 'offers';
    offersSponsorship = 1;
  } else if (requiresClearance) {
    sponsorship = 'clearance';
    offersSponsorship = 0;
  } else if (requiresCitizenship) {
    sponsorship = 'us-citizenship';
    offersSponsorship = 0;
  } else if (YES_SPONSORSHIP.test(body)) {
    sponsorship = 'offers';
    offersSponsorship = 1;
  } else if (NO_SPONSORSHIP.test(body)) {
    sponsorship = 'does-not-offer';
    offersSponsorship = 0;
  }

  return {
    degrees: [...degrees],
    classYears: [...classYears],
    gpaMin: parseGpa(body),
    sponsorship,
    offersSponsorship,
    requiresCitizenship,
    requiresClearance,
    requiresCoverLetter: COVER_LETTER.test(body) && !NO_COVER_LETTER.test(body) ? 1 : 0,
    requiresTranscript: TRANSCRIPT.test(body) ? 1 : 0,
    requiresPortfolio: PORTFOLIO.test(body) ? 1 : 0,
  };
}

/**
 * Find a minimum GPA requirement. Only accepts values on a 4.0/5.0 scale
 * stated near the word GPA, to avoid grabbing version numbers or years.
 */
export function parseGpa(text: string | null | undefined): number | null {
  const body = text ?? '';
  const patterns = [
    /\bGPA\s*(?:of\s*)?(?:at\s+least\s*|minimum\s*(?:of\s*)?|>=?\s*|above\s*|greater\s+than\s*)?([0-5](?:\.\d{1,2})?)\s*(?:\/\s*([45](?:\.0)?))?/i,
    /\bminimum\s+(?:cumulative\s+)?GPA\s*(?:requirement)?\s*(?:of|:)?\s*([0-5](?:\.\d{1,2})?)/i,
    /\b([0-5]\.\d{1,2})\s*(?:\/\s*([45](?:\.0)?)\s*)?(?:cumulative\s+)?GPA\b/i,
    /\bGPA[^.\n]{0,20}?([0-5]\.\d{1,2})\s+or\s+(?:higher|above|better)/i,
  ];

  for (const re of patterns) {
    const m = re.exec(body);
    if (!m) continue;
    let value = Number.parseFloat(m[1]);
    const scale = m[2] ? Number.parseFloat(m[2]) : 4;
    if (!Number.isFinite(value)) continue;
    // Normalize a 5.0-scale requirement onto 4.0.
    if (scale === 5) value = (value / 5) * 4;
    if (value < 1.5 || value > 4.0) continue; // implausible as a minimum
    return Math.round(value * 100) / 100;
  }
  return null;
}

function normalizeDegree(raw: string): Degree | null {
  const s = (raw ?? '').toLowerCase();
  if (!s) return null;
  if (s.includes('mba')) return 'MBA';
  if (s.includes('phd') || s.includes('doctor')) return 'PhD';
  if (s.includes('master') || /\bm\.?s\b/.test(s)) return 'Masters';
  if (s.includes('bachelor') || /\bb\.?s\b|\bb\.?a\b/.test(s) || s.includes('undergrad'))
    return 'Bachelors';
  if (s.includes('associate')) return 'Associate';
  if (s.includes('high school')) return 'High School';
  return null;
}
