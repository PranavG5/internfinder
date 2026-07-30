export interface CompResult {
  isPaid: number | null; // 1 paid, 0 unpaid, null unknown
  min: number | null;
  max: number | null;
  period: 'hour' | 'month' | 'year' | 'stipend' | null;
  currency: string;
  text: string | null; // the matched snippet, for display / auditing
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  '£': 'GBP',
  '€': 'EUR',
  '₹': 'INR',
  '¥': 'JPY',
  '₩': 'KRW',
  C$: 'CAD',
  A$: 'AUD',
  R$: 'BRL',
  CHF: 'CHF',
};

const UNPAID = /\b(?:unpaid|no\s+(?:pay|compensation|salary)|volunteer\s+(?:basis|position)|without\s+(?:pay|compensation)|for\s+(?:course\s+)?credit\s+only)\b/i;
const PAID_HINT = /\b(?:paid\s+internship|competitive\s+(?:pay|salary|compensation)|hourly\s+(?:rate|wage)|stipend|salary\s+range|compensation\s+range|we\s+offer\s+a\s+salary)\b/i;

/** "45", "45.50", "45,000", "45k", "1,200" -> number */
function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase().replace(/[,\s]/g, '');
  let multiplier = 1;
  if (s.endsWith('k')) {
    multiplier = 1000;
    s = s.slice(0, -1);
  }
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return n * multiplier;
}

/** Infer the pay period from the words trailing an amount. */
function periodFrom(tail: string): CompResult['period'] | null {
  if (/\b(?:per\s+hour|hourly|\/\s*h(?:r|our)?\b|an\s+hour|p\/h)\b/i.test(tail)) return 'hour';
  if (/\b(?:per\s+month|monthly|\/\s*mo(?:nth)?\b|a\s+month|pcm)\b/i.test(tail)) return 'month';
  if (/\b(?:per\s+year|annual(?:ly|ized)?|\/\s*(?:yr|year)\b|a\s+year|per\s+annum|p\.?a\.?)\b/i.test(tail))
    return 'year';
  if (/\b(?:per\s+week|weekly|\/\s*w(?:k|eek)?\b)\b/i.test(tail)) return 'month'; // normalized below
  if (/\bstipend|lump\s+sum|total\s+award\b/i.test(tail)) return 'stipend';
  return null;
}

/** A period guess of last resort, based on how big the number is. */
function periodFromMagnitude(amount: number, currency: string): CompResult['period'] {
  // Rough thresholds; INR/JPY/KRW run an order of magnitude larger.
  const scale = ['INR', 'JPY', 'KRW'].includes(currency) ? 80 : 1;
  if (amount <= 200 * scale) return 'hour';
  if (amount <= 20000 * scale) return 'month';
  return 'year';
}

/**
 * Pull a pay figure out of free-text job copy.
 *
 * Handles the common shapes:
 *   "$45.00 - $60.00 per hour"      "£28,000 per annum"
 *   "$8,000/month"                   "Pay Range: $30/hr — $45/hr"
 *   "USD 100,000 - 130,000 annually" "45-60 USD/hour"
 */
export function parseComp(text: string | null | undefined, titleHint = ''): CompResult {
  const empty: CompResult = {
    isPaid: null,
    min: null,
    max: null,
    period: null,
    currency: 'USD',
    text: null,
  };
  const body = `${titleHint}\n${text ?? ''}`;
  if (!body.trim()) return empty;

  if (UNPAID.test(body)) {
    return { ...empty, isPaid: 0, text: body.match(UNPAID)?.[0] ?? null };
  }

  // Prefer text near an explicit compensation heading — job posts often quote
  // unrelated dollar figures ("$2B in revenue", "raised $50M").
  const focused = focusOnCompSection(body);

  for (const candidate of [focused, body]) {
    if (!candidate) continue;
    const hit = matchRange(candidate);
    if (hit) return hit;
  }

  if (PAID_HINT.test(body)) {
    return { ...empty, isPaid: 1, text: body.match(PAID_HINT)?.[0] ?? null };
  }
  return empty;
}

const COMP_HEADINGS =
  /(?:compensation|salary|pay\s*(?:range|rate|scale)?|hourly\s*rate|base\s*pay|remuneration|stipend|wage)[^.\n]{0,40}?[:\-–—]?\s*/gi;

function focusOnCompSection(body: string): string | null {
  const windows: string[] = [];
  for (const m of body.matchAll(COMP_HEADINGS)) {
    windows.push(body.slice(m.index, m.index + 260));
  }
  return windows.length ? windows.join('\n') : null;
}

const SYMBOL = '\\$|£|€|₹|¥|₩|C\\$|A\\$|R\\$';
const CODE = 'USD|GBP|EUR|CAD|AUD|INR|JPY|KRW|CHF|SGD|BRL|MXN|SEK|NOK|DKK|PLN|ZAR';
const NUM = '\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?k?|\\d+(?:\\.\\d{1,2})?k?';

function matchRange(text: string): CompResult | null {
  // Ranges first, so we don't grab only the lower bound.
  const rangeRe = new RegExp(
    `(?:(${CODE})\\s*)?(${SYMBOL})?\\s*(${NUM})\\s*(?:-|–|—|\\bto\\b|\\bthrough\\b)\\s*(?:(${SYMBOL})?\\s*)(${NUM})\\s*(?:(${CODE})\\b)?([^\\n]{0,28})`,
    'gi',
  );
  const singleRe = new RegExp(
    `(?:(${CODE})\\s*)?(${SYMBOL})\\s*(${NUM})\\s*(?:(${CODE})\\b)?([^\\n]{0,28})`,
    'gi',
  );
  const bareWithPeriodRe = new RegExp(
    `(${NUM})\\s*(?:(${CODE})\\b)?\\s*(?:per\\s+(?:hour|month|year)|\\/\\s*(?:hr|hour|mo|month|yr|year)|hourly|monthly|annually)`,
    'gi',
  );

  const candidates: CompResult[] = [];

  for (const m of text.matchAll(rangeRe)) {
    const [, code1, sym1, a, sym2, b, code2, tail = ''] = m;
    // Require some currency marker or an explicit period, else it's just numbers.
    const period = periodFrom(tail);
    if (!sym1 && !sym2 && !code1 && !code2 && !period) continue;
    const min = parseAmount(a);
    const max = parseAmount(b);
    if (min == null || max == null || max < min) continue;
    const currency = resolveCurrency(sym1 ?? sym2, code1 ?? code2);
    candidates.push(finalize(min, max, period, currency, m[0]));
  }

  if (candidates.length === 0) {
    for (const m of text.matchAll(singleRe)) {
      const [, code1, sym, a, code2, tail = ''] = m;
      const amount = parseAmount(a);
      if (amount == null) continue;
      const period = periodFrom(tail);
      const currency = resolveCurrency(sym, code1 ?? code2);
      // A bare "$5" with no period is noise; require a period or a plausible size.
      if (!period && amount < 1000) continue;
      candidates.push(finalize(amount, amount, period, currency, m[0]));
    }
  }

  if (candidates.length === 0) {
    for (const m of text.matchAll(bareWithPeriodRe)) {
      const [, a, code] = m;
      const amount = parseAmount(a);
      if (amount == null) continue;
      candidates.push(
        finalize(amount, amount, periodFrom(m[0]), resolveCurrency(undefined, code), m[0]),
      );
    }
  }

  if (candidates.length === 0) return null;

  // Pick the candidate with the most information: a real range and a known period.
  candidates.sort((x, y) => score(y) - score(x));
  return candidates[0];
}

function score(c: CompResult): number {
  let s = 0;
  if (c.period) s += 3;
  if (c.min != null && c.max != null && c.min !== c.max) s += 2;
  if (c.period === 'hour') s += 1; // internships are usually quoted hourly
  return s;
}

function resolveCurrency(symbol?: string, code?: string): string {
  if (code) return code.toUpperCase();
  if (symbol && CURRENCY_SYMBOLS[symbol]) return CURRENCY_SYMBOLS[symbol];
  return 'USD';
}

function finalize(
  min: number,
  max: number,
  period: CompResult['period'] | null,
  currency: string,
  matched: string,
): CompResult {
  let p = period;
  let lo = min;
  let hi = max;

  // Weekly figures were mapped to "month" above; convert the amount to match.
  if (/\bper\s+week|weekly|\/\s*w(?:k|eek)\b/i.test(matched)) {
    lo *= 4.345;
    hi *= 4.345;
    p = 'month';
  }

  p ??= periodFromMagnitude(hi, currency);

  return {
    isPaid: 1,
    min: Math.round(lo * 100) / 100,
    max: Math.round(hi * 100) / 100,
    period: p,
    currency,
    text: matched.trim().slice(0, 120),
  };
}
