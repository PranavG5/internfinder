/**
 * Search query shape, parsing, and serialization.
 *
 * This module is deliberately free of database imports so client components can
 * share the exact same query type and URL encoding as the server. The SQL that
 * executes a query lives in `query.ts`.
 */
import type { InternshipView } from './types';
import { clamp } from './util';

/** Every filter the search API understands. */
export interface SearchQuery {
  q: string;
  seasons: string[];
  years: number[];
  fields: string[];
  roleFamilies: string[];
  programTypes: string[];
  companies: string[];
  location: string;
  countries: string[];
  regions: string[];
  locationTypes: string[];
  sponsorship: string[];
  /** Hide roles this profile cannot legally hold. */
  eligibleOnly: boolean;
  excludeCitizenship: boolean;
  excludeClearance: boolean;
  degrees: string[];
  classYears: string[];
  /** Hide listings whose required GPA exceeds this. */
  gpa: number | null;
  paidOnly: boolean;
  minPay: number | null;
  hasSalary: boolean;
  startAfter: number | null;
  startBefore: number | null;
  deadlineBefore: number | null;
  hasDeadline: boolean;
  noDeadlinePassed: boolean;
  postedWithinDays: number | null;
  minDuration: number | null;
  maxDuration: number | null;
  skills: string[];
  sources: string[];
  excludeKeywords: string[];
  requiresNoCoverLetter: boolean;
  bookmarkedOnly: boolean;
  hideApplied: boolean;
  showClosed: boolean;
  sort: SortKey;
  page: number;
  limit: number;
}

export const SORT_KEYS = [
  'relevance',
  'fit',
  'newest',
  'deadline',
  'pay',
  'company',
  'title',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export function emptyQuery(): SearchQuery {
  return {
    q: '',
    seasons: [],
    years: [],
    fields: [],
    roleFamilies: [],
    programTypes: [],
    companies: [],
    location: '',
    countries: [],
    regions: [],
    locationTypes: [],
    sponsorship: [],
    eligibleOnly: false,
    excludeCitizenship: false,
    excludeClearance: false,
    degrees: [],
    classYears: [],
    gpa: null,
    paidOnly: false,
    minPay: null,
    hasSalary: false,
    startAfter: null,
    startBefore: null,
    deadlineBefore: null,
    hasDeadline: false,
    noDeadlinePassed: true,
    postedWithinDays: null,
    minDuration: null,
    maxDuration: null,
    skills: [],
    sources: [],
    excludeKeywords: [],
    requiresNoCoverLetter: false,
    bookmarkedOnly: false,
    hideApplied: false,
    showClosed: false,
    sort: 'relevance',
    page: 1,
    limit: 25,
  };
}

const list = (params: URLSearchParams, key: string): string[] =>
  params
    .getAll(key)
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);

const num = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const bool = (params: URLSearchParams, key: string): boolean => {
  const raw = params.get(key);
  return raw === '1' || raw === 'true' || raw === 'on';
};

export function parseSearchParams(params: URLSearchParams): SearchQuery {
  const base = emptyQuery();
  const sort = params.get('sort') as SortKey | null;

  return {
    ...base,
    q: (params.get('q') ?? '').trim().slice(0, 200),
    seasons: list(params, 'season'),
    years: list(params, 'year').map(Number).filter(Number.isFinite),
    fields: list(params, 'field'),
    roleFamilies: list(params, 'role'),
    programTypes: list(params, 'programType'),
    companies: list(params, 'company'),
    location: (params.get('location') ?? '').trim().slice(0, 120),
    countries: list(params, 'country'),
    regions: list(params, 'region'),
    locationTypes: list(params, 'locationType'),
    sponsorship: list(params, 'sponsorship'),
    eligibleOnly: bool(params, 'eligibleOnly'),
    excludeCitizenship: bool(params, 'excludeCitizenship'),
    excludeClearance: bool(params, 'excludeClearance'),
    degrees: list(params, 'degree'),
    classYears: list(params, 'classYear'),
    gpa: num(params, 'gpa'),
    paidOnly: bool(params, 'paidOnly'),
    minPay: num(params, 'minPay'),
    hasSalary: bool(params, 'hasSalary'),
    startAfter: num(params, 'startAfter'),
    startBefore: num(params, 'startBefore'),
    deadlineBefore: num(params, 'deadlineBefore'),
    hasDeadline: bool(params, 'hasDeadline'),
    noDeadlinePassed: params.has('noDeadlinePassed') ? bool(params, 'noDeadlinePassed') : true,
    postedWithinDays: num(params, 'postedWithin'),
    minDuration: num(params, 'minDuration'),
    maxDuration: num(params, 'maxDuration'),
    skills: list(params, 'skill'),
    sources: list(params, 'source'),
    excludeKeywords: list(params, 'exclude'),
    requiresNoCoverLetter: bool(params, 'noCoverLetter'),
    bookmarkedOnly: bool(params, 'bookmarked'),
    hideApplied: bool(params, 'hideApplied'),
    showClosed: bool(params, 'showClosed'),
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'relevance',
    page: Math.max(1, num(params, 'page') ?? 1),
    limit: clamp(num(params, 'limit') ?? 25, 1, 100),
  };
}

/** Serialize a query back to a query string, omitting defaults. */
export function toSearchParams(query: Partial<SearchQuery>): URLSearchParams {
  const params = new URLSearchParams();
  const add = (key: string, value: unknown) => {
    if (value == null || value === '' || value === false) return;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
      return;
    }
    params.set(key, String(value));
  };

  add('q', query.q);
  add('season', query.seasons);
  add('year', query.years);
  add('field', query.fields);
  add('role', query.roleFamilies);
  add('programType', query.programTypes);
  add('company', query.companies);
  add('location', query.location);
  add('country', query.countries);
  add('region', query.regions);
  add('locationType', query.locationTypes);
  add('sponsorship', query.sponsorship);
  add('eligibleOnly', query.eligibleOnly ? 1 : null);
  add('excludeCitizenship', query.excludeCitizenship ? 1 : null);
  add('excludeClearance', query.excludeClearance ? 1 : null);
  add('degree', query.degrees);
  add('classYear', query.classYears);
  add('gpa', query.gpa);
  add('paidOnly', query.paidOnly ? 1 : null);
  add('minPay', query.minPay);
  add('hasSalary', query.hasSalary ? 1 : null);
  add('startAfter', query.startAfter);
  add('startBefore', query.startBefore);
  add('deadlineBefore', query.deadlineBefore);
  add('hasDeadline', query.hasDeadline ? 1 : null);
  if (query.noDeadlinePassed === false) params.set('noDeadlinePassed', '0');
  add('postedWithin', query.postedWithinDays);
  add('minDuration', query.minDuration);
  add('maxDuration', query.maxDuration);
  add('skill', query.skills);
  add('source', query.sources);
  add('exclude', query.excludeKeywords);
  add('noCoverLetter', query.requiresNoCoverLetter ? 1 : null);
  add('bookmarked', query.bookmarkedOnly ? 1 : null);
  add('hideApplied', query.hideApplied ? 1 : null);
  add('showClosed', query.showClosed ? 1 : null);
  if (query.sort && query.sort !== 'relevance') params.set('sort', query.sort);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.limit && query.limit !== 25) params.set('limit', String(query.limit));

  return params;
}

/**
 * Turn user text into a safe FTS5 MATCH expression.
 * Quoting every term means punctuation like "C++" or "-" can't be read as
 * FTS operator syntax, which would otherwise throw.
 */
export function toFtsQuery(input: string): string | null {
  const terms = input
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '').trim())
    .filter((t) => t.length > 1);
  if (terms.length === 0) return null;
  // Trailing * makes the last term a prefix match, so "engin" finds "engineering".
  return terms
    .map((t, i) => (i === terms.length - 1 ? `"${t}"*` : `"${t}"`))
    .join(' AND ');
}


export interface FacetBucket {
  value: string;
  label: string;
  count: number;
}

export interface Facets {
  seasons: FacetBucket[];
  years: FacetBucket[];
  fields: FacetBucket[];
  roleFamilies: FacetBucket[];
  programTypes: FacetBucket[];
  locationTypes: FacetBucket[];
  countries: FacetBucket[];
  regions: FacetBucket[];
  sponsorship: FacetBucket[];
  degrees: FacetBucket[];
  classYears: FacetBucket[];
  companies: FacetBucket[];
  skills: FacetBucket[];
  sources: FacetBucket[];
  total: number;
}

export interface SearchResult {
  rows: InternshipView[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
