/** Shared domain types used by both server and client code. */

export const SEASONS = ['Summer', 'Fall', 'Winter', 'Spring', 'Year-round', 'Unknown'] as const;
export type Season = (typeof SEASONS)[number];

export const LOCATION_TYPES = ['remote', 'hybrid', 'onsite', 'unknown'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const DEGREES = [
  'High School',
  'Associate',
  'Bachelors',
  'Masters',
  'MBA',
  'PhD',
] as const;
export type Degree = (typeof DEGREES)[number];

export const CLASS_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'] as const;
export type ClassYear = (typeof CLASS_YEARS)[number];

export const WORK_AUTH = [
  'us-citizen',
  'permanent-resident',
  'needs-sponsorship',
  'other',
] as const;
export type WorkAuth = (typeof WORK_AUTH)[number];

export const SPONSORSHIP = [
  'offers',
  'does-not-offer',
  'us-citizenship',
  'clearance',
  'unknown',
] as const;
export type Sponsorship = (typeof SPONSORSHIP)[number];

export const PROGRAM_TYPES = [
  'internship',
  'co-op',
  'apprenticeship',
  'fellowship',
  'research',
  'rotational',
] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

/** Canonical fields of study / industry buckets. */
export const FIELDS = [
  'Software Engineering',
  'Data & Analytics',
  'AI & Machine Learning',
  'Hardware & Electrical',
  'Mechanical & Aerospace',
  'Civil & Structural',
  'Chemical & Materials',
  'Product Management',
  'Design & UX',
  'Quantitative Finance',
  'Finance & Accounting',
  'Consulting & Strategy',
  'Marketing & Growth',
  'Sales & Business Development',
  'Operations & Supply Chain',
  'Human Resources',
  'Legal & Policy',
  'Healthcare & Life Sciences',
  'Research & Academia',
  'Education',
  'Media & Communications',
  'Nonprofit & Social Impact',
  'Government & Defense',
  'Cybersecurity',
  'IT & Systems',
  'Other',
] as const;
export type Field = (typeof FIELDS)[number];

/** Finer-grained role families within a field. */
export const ROLE_FAMILIES = [
  'swe-general',
  'frontend',
  'backend',
  'fullstack',
  'mobile',
  'devops',
  'embedded',
  'game-dev',
  'data-engineering',
  'data-science',
  'data-analyst',
  'machine-learning',
  'research-scientist',
  'security',
  'qa-test',
  'it-support',
  'product-management',
  'product-design',
  'graphic-design',
  'quant-trading',
  'quant-research',
  'investment-banking',
  'finance-general',
  'accounting',
  'consulting',
  'marketing',
  'sales',
  'operations',
  'supply-chain',
  'hr-recruiting',
  'legal',
  'clinical',
  'biotech',
  'mechanical',
  'electrical',
  'civil',
  'chemical',
  'aerospace',
  'teaching',
  'communications',
  'policy',
  'other',
] as const;
export type RoleFamily = (typeof ROLE_FAMILIES)[number];

/** Application pipeline. Order matters — it defines the funnel and Kanban columns. */
export const APP_STATUSES = [
  'interested',
  'preparing',
  'applied',
  'online_assessment',
  'phone_screen',
  'interviewing',
  'final_round',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const STATUS_META: Record<
  AppStatus,
  { label: string; short: string; kind: 'pre' | 'active' | 'won' | 'lost'; hue: string }
> = {
  interested: { label: 'Interested', short: 'Saved', kind: 'pre', hue: 'slate' },
  preparing: { label: 'Preparing', short: 'Prep', kind: 'pre', hue: 'zinc' },
  applied: { label: 'Submitted', short: 'Applied', kind: 'active', hue: 'blue' },
  online_assessment: { label: 'Online Assessment', short: 'OA', kind: 'active', hue: 'cyan' },
  phone_screen: { label: 'Phone Screen', short: 'Screen', kind: 'active', hue: 'teal' },
  interviewing: { label: 'Interviewing', short: 'Interview', kind: 'active', hue: 'violet' },
  final_round: { label: 'Final Round', short: 'Final', kind: 'active', hue: 'fuchsia' },
  offer: { label: 'Offer', short: 'Offer', kind: 'won', hue: 'amber' },
  accepted: { label: 'Accepted', short: 'Accepted', kind: 'won', hue: 'emerald' },
  rejected: { label: 'Rejected', short: 'Rejected', kind: 'lost', hue: 'rose' },
  withdrawn: { label: 'Withdrawn', short: 'Withdrew', kind: 'lost', hue: 'stone' },
  ghosted: { label: 'Ghosted', short: 'Ghosted', kind: 'lost', hue: 'neutral' },
};

/** Statuses that mean "I actually submitted an application". */
export const SUBMITTED_STATUSES: AppStatus[] = [
  'applied',
  'online_assessment',
  'phone_screen',
  'interviewing',
  'final_round',
  'offer',
  'accepted',
  'rejected',
  'ghosted',
];

/** Statuses that mean "the company engaged with me beyond submission". */
export const RESPONDED_STATUSES: AppStatus[] = [
  'online_assessment',
  'phone_screen',
  'interviewing',
  'final_round',
  'offer',
  'accepted',
];

export const INTERVIEW_KINDS = [
  'recruiter_screen',
  'online_assessment',
  'technical',
  'behavioral',
  'system_design',
  'case',
  'final',
  'superday',
] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const EVENT_TYPES = [
  'created',
  'status_change',
  'note',
  'email',
  'call',
  'assessment',
  'interview',
  'offer',
  'follow_up',
  'document',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface Internship {
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
  locations_json: string;
  primary_location: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  location_type: LocationType;
  is_remote: number;
  season: Season;
  year: number | null;
  terms_json: string;
  start_date: number | null;
  end_date: number | null;
  duration_weeks: number | null;
  deadline: number | null;
  field: Field;
  role_family: RoleFamily;
  program_type: ProgramType;
  degrees_json: string;
  class_years_json: string;
  gpa_min: number | null;
  sponsorship: Sponsorship;
  offers_sponsorship: number | null;
  requires_citizenship: number;
  requires_clearance: number;
  requires_cover_letter: number;
  requires_transcript: number;
  requires_portfolio: number;
  skills_json: string;
  tags_json: string;
  is_paid: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  salary_currency: string | null;
  comp_text: string | null;
  status: string;
  is_open: number;
  close_reason: string | null;
  closed_at: number | null;
  first_seen_at: number;
  last_seen_at: number;
  date_posted: number | null;
  date_updated: number | null;
  link_status: number | null;
  link_checked_at: number | null;
  dedupe_key: string;
  duplicate_of: string | null;
  quality: number;
  raw_json: string | null;
}

/** What the API returns to the client: DB row with JSON parsed and extras attached. */
export interface InternshipView
  extends Omit<
    Internship,
    'locations_json' | 'terms_json' | 'degrees_json' | 'class_years_json' | 'skills_json' | 'tags_json' | 'raw_json'
  > {
  locations: string[];
  terms: string[];
  degrees: string[];
  class_years: string[];
  skills: string[];
  tags: string[];
  bookmarked: boolean;
  applied: boolean;
  application_id: number | null;
  application_status: AppStatus | null;
  fit: FitResult | null;
}

export interface FitReason {
  label: string;
  detail: string;
  weight: number;
  polarity: 'good' | 'bad' | 'neutral';
}

export interface FitResult {
  score: number;
  grade: 'excellent' | 'strong' | 'fair' | 'weak';
  eligible: boolean;
  blockers: string[];
  reasons: FitReason[];
}

export interface Application {
  id: number;
  internship_id: string | null;
  company: string;
  role: string;
  apply_url: string | null;
  location: string | null;
  season: string | null;
  year: number | null;
  field: string | null;
  status: AppStatus;
  priority: number;
  excitement: number | null;
  origin: string;
  applied_at: number | null;
  deadline: number | null;
  next_action: string | null;
  next_action_at: number | null;
  last_activity_at: number | null;
  resume_version: string | null;
  cover_letter_sent: number;
  portfolio_sent: number;
  referral: number;
  referrer: string | null;
  comp_offered: string | null;
  rejected_stage: string | null;
  rejection_reason: string | null;
  notes: string | null;
  archived: number;
  created_at: number;
  updated_at: number;
}

export interface Profile {
  id: number;
  name: string | null;
  email: string | null;
  school: string | null;
  major: string | null;
  minor: string | null;
  degree_level: Degree | null;
  class_year: ClassYear | null;
  grad_month: number | null;
  grad_year: number | null;
  gpa: number | null;
  work_auth: WorkAuth | null;
  has_clearance: number;
  skills_json: string;
  preferred_seasons_json: string;
  preferred_years_json: string;
  preferred_fields_json: string;
  preferred_locations_json: string;
  remote_pref: 'any' | 'remote' | 'hybrid' | 'onsite';
  willing_to_relocate: number;
  min_hourly: number | null;
  paid_only: number;
  earliest_start: number | null;
  latest_start: number | null;
  resume_text: string | null;
  weekly_goal: number;
  onboarded: number;
  created_at: number;
  updated_at: number;
}

export interface ProfileView extends Profile {
  skills: string[];
  preferred_seasons: string[];
  preferred_years: string[];
  preferred_fields: string[];
  preferred_locations: string[];
}
