import type { Season } from '../types';
import { seasonStartDate } from './season';

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const MONTH_NAMES = Object.keys(MONTHS).join('|');

/**
 * Find an application deadline in job copy.
 * Only matches dates that sit next to explicit deadline language, and never
 * returns a date already in the past (a stale deadline is worse than none).
 */
export function parseDeadline(text: string | null | undefined, now = Date.now()): number | null {
  const body = text ?? '';
  if (!body) return null;

  const cues = [
    /\b(?:appl(?:y|ications?)\s+(?:by|before|deadline|closes?|close\s+on|due)|deadline\s*(?:to\s+apply)?|closing\s+date|last\s+day\s+to\s+apply|submit\s+(?:your\s+)?applications?\s+by|accepting\s+applications\s+(?:until|through)|posting\s+(?:closes|expires))\b/gi,
  ];

  const windows: string[] = [];
  for (const cue of cues) {
    for (const m of body.matchAll(cue)) {
      windows.push(body.slice(m.index, m.index + 140));
    }
  }
  if (windows.length === 0) return null;

  const candidates: number[] = [];
  for (const w of windows) {
    const d = findDate(w, now);
    if (d != null) candidates.push(d);
  }
  if (candidates.length === 0) return null;

  const nowSec = Math.floor(now / 1000);
  const future = candidates.filter((c) => c > nowSec - 86400);
  if (future.length === 0) return null;
  return Math.min(...future);
}

/** Find a start date near "start date" / "begins" language. */
export function parseStartDate(
  text: string | null | undefined,
  season: Season,
  year: number | null,
  now = Date.now(),
): number | null {
  const body = text ?? '';
  const cue =
    /\b(?:start\s+date|starts?\s+(?:on|in)|begins?\s+(?:on|in)|commenc(?:es|ing)|program\s+(?:starts|dates|runs)|internship\s+(?:starts|begins|dates|runs)|expected\s+start)\b/gi;

  for (const m of body.matchAll(cue)) {
    const window = body.slice(m.index, m.index + 150);
    const d = findDate(window, now, year);
    if (d != null) return d;
    // Month-only mentions like "starts in June" resolve against the term year.
    const mo = new RegExp(`\\b(${MONTH_NAMES})\\b`, 'i').exec(window);
    if (mo && year) {
      const month = MONTHS[mo[1].toLowerCase()];
      return Math.floor(new Date(year, month, 1, 12).getTime() / 1000);
    }
  }

  // Fall back to the typical start of the named term.
  return seasonStartDate(season, year);
}

/** "12-week internship", "10 to 12 weeks", "3 month placement" -> weeks */
export function parseDuration(text: string | null | undefined): number | null {
  const body = text ?? '';
  if (!body) return null;

  const weekRange = /\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*weeks?\b/i.exec(body);
  if (weekRange) {
    const lo = Number(weekRange[1]);
    const hi = Number(weekRange[2]);
    if (lo >= 2 && hi <= 78 && hi >= lo) return Math.round((lo + hi) / 2);
  }

  const weeks = /\b(\d{1,2})[-\s]*weeks?\b/i.exec(body);
  if (weeks) {
    const n = Number(weeks[1]);
    if (n >= 2 && n <= 78) return n;
  }

  const monthRange = /\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*months?\b/i.exec(body);
  if (monthRange) {
    const avg = (Number(monthRange[1]) + Number(monthRange[2])) / 2;
    if (avg >= 1 && avg <= 18) return Math.round(avg * 4.345);
  }

  const months = /\b(\d{1,2})[-\s]*months?\b/i.exec(body);
  if (months) {
    const n = Number(months[1]);
    if (n >= 1 && n <= 18) return Math.round(n * 4.345);
  }

  if (/\bsummer\s+(?:internship|program)\b/i.test(body)) return 12;
  return null;
}

/**
 * Extract the first parseable date from a short text window.
 * Supports "March 15, 2026", "15 March 2026", "2026-03-15", "3/15/2026", "March 15".
 */
export function findDate(window: string, now = Date.now(), fallbackYear?: number | null): number | null {
  const currentYear = new Date(now).getFullYear();

  // ISO: 2026-03-15
  const iso = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/.exec(window);
  if (iso) return mk(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  // "March 15, 2026" / "Mar 15 2026" / "March 15"
  const mdy = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?\\b`, 'i').exec(window);
  if (mdy) {
    const month = MONTHS[mdy[1].toLowerCase()];
    const day = Number(mdy[2]);
    const year = mdy[3] ? Number(mdy[3]) : inferYear(month, day, currentYear, now, fallbackYear);
    return mk(year, month, day);
  }

  // "15 March 2026"
  const dmy = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_NAMES})\\.?(?:,?\\s*(20\\d{2}))?\\b`, 'i').exec(window);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = MONTHS[dmy[2].toLowerCase()];
    const year = dmy[3] ? Number(dmy[3]) : inferYear(month, day, currentYear, now, fallbackYear);
    return mk(year, month, day);
  }

  // Numeric: 3/15/2026 or 15/03/2026. Ambiguous, so use the US reading when
  // the first number can be a month, otherwise treat it as day-first.
  const num = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|\d{2})\b/.exec(window);
  if (num) {
    let a = Number(num[1]);
    let b = Number(num[2]);
    let y = Number(num[3]);
    if (y < 100) y += 2000;
    if (a > 12 && b <= 12) [a, b] = [b, a]; // day-first input
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) return mk(y, a - 1, b);
  }

  return null;
}

function mk(year: number, month: number, day: number): number | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  const d = new Date(year, month, day, 12, 0, 0);
  if (d.getMonth() !== month || d.getDate() !== day) return null; // e.g. Feb 30
  return Math.floor(d.getTime() / 1000);
}

/** A date with no year means the next occurrence of that month/day. */
function inferYear(
  month: number,
  day: number,
  currentYear: number,
  now: number,
  fallbackYear?: number | null,
): number {
  if (fallbackYear) return fallbackYear;
  const thisYear = new Date(currentYear, month, day, 12).getTime();
  return thisYear < now - 7 * 86400000 ? currentYear + 1 : currentYear;
}
