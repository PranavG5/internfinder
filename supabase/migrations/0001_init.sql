-- InternFinder schema for Supabase Postgres.
--
-- Two halves:
--   1. The shared internship catalog, written only by the sync pipeline
--      (service connection) and readable by everyone.
--   2. Per-user data (profile, tracker, bookmarks, saved searches), keyed to
--      auth.users and protected by row-level security.
--
-- Conventions carried over from the original SQLite schema so application code
-- stays close to its history: timestamps are unix seconds in bigint columns,
-- boolean-ish flags are 0/1 smallints, and multi-value fields are JSON arrays
-- serialized into *_json text columns.

--------------------------------------------------------------------------------
-- The aggregated catalog of internship listings.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internships (
  id                TEXT PRIMARY KEY,          -- stable hash of source + source_id
  source            TEXT NOT NULL,             -- adapter id, e.g. "greenhouse:stripe"
  source_kind       TEXT NOT NULL,             -- ats | aggregator | board
  source_id         TEXT NOT NULL,

  company           TEXT NOT NULL,
  company_slug      TEXT NOT NULL DEFAULT '',
  company_url       TEXT,
  title             TEXT NOT NULL,
  normalized_title  TEXT NOT NULL DEFAULT '',
  apply_url         TEXT NOT NULL,
  description       TEXT,

  -- Location
  locations_json    TEXT NOT NULL DEFAULT '[]',
  primary_location  TEXT,
  city              TEXT,
  region            TEXT,                      -- state / province
  country           TEXT,
  location_type     TEXT NOT NULL DEFAULT 'unknown',  -- remote | hybrid | onsite | unknown
  is_remote         SMALLINT NOT NULL DEFAULT 0,

  -- Timing
  season            TEXT NOT NULL DEFAULT 'Unknown',  -- Summer | Fall | Winter | Spring | Year-round | Unknown
  year              INTEGER,
  terms_json        TEXT NOT NULL DEFAULT '[]',
  start_date        BIGINT,                    -- unix seconds
  end_date          BIGINT,
  duration_weeks    INTEGER,
  deadline          BIGINT,

  -- Classification
  field             TEXT NOT NULL DEFAULT 'Other',
  role_family       TEXT NOT NULL DEFAULT 'other',
  program_type      TEXT NOT NULL DEFAULT 'internship',  -- internship | co-op | apprenticeship | fellowship | research | rotational

  -- Eligibility / prerequisites
  degrees_json      TEXT NOT NULL DEFAULT '[]',   -- Associate | Bachelors | Masters | MBA | PhD | High School
  class_years_json  TEXT NOT NULL DEFAULT '[]',   -- Freshman | Sophomore | Junior | Senior | Graduate
  gpa_min           DOUBLE PRECISION,
  sponsorship       TEXT NOT NULL DEFAULT 'unknown', -- offers | does-not-offer | us-citizenship | clearance | unknown
  offers_sponsorship  SMALLINT,                 -- 1 yes, 0 no, NULL unknown
  requires_citizenship SMALLINT NOT NULL DEFAULT 0,
  requires_clearance  SMALLINT NOT NULL DEFAULT 0,
  requires_cover_letter SMALLINT NOT NULL DEFAULT 0,
  requires_transcript SMALLINT NOT NULL DEFAULT 0,
  requires_portfolio  SMALLINT NOT NULL DEFAULT 0,
  skills_json       TEXT NOT NULL DEFAULT '[]',
  tags_json         TEXT NOT NULL DEFAULT '[]',

  -- Compensation
  is_paid           SMALLINT,                  -- 1 paid, 0 unpaid, NULL unknown
  salary_min        DOUBLE PRECISION,
  salary_max        DOUBLE PRECISION,
  salary_period     TEXT,                      -- hour | month | year | stipend
  salary_currency   TEXT DEFAULT 'USD',
  comp_text         TEXT,

  -- Lifecycle: this is what guarantees we only show open roles.
  status            TEXT NOT NULL DEFAULT 'open',  -- open | closed | expired
  is_open           SMALLINT NOT NULL DEFAULT 1,
  close_reason      TEXT,                       -- delisted | deadline-passed | stale | dead-link | source-inactive | term-passed
  closed_at         BIGINT,
  first_seen_at     BIGINT NOT NULL,
  last_seen_at      BIGINT NOT NULL,
  date_posted       BIGINT,
  date_updated      BIGINT,
  link_status       INTEGER,                    -- last HTTP status from link verification
  link_checked_at   BIGINT,

  dedupe_key        TEXT NOT NULL DEFAULT '',
  -- When the same role is found on several sources, the weaker copies point at
  -- the canonical row's id and are hidden from search.
  duplicate_of      TEXT,
  quality           DOUBLE PRECISION NOT NULL DEFAULT 0,  -- 0..1 metadata completeness, used as a ranking tiebreak
  raw_json          TEXT,

  -- Full-text search. Weighted so a title hit outranks a description hit.
  -- The description is capped so a pathological posting can't overflow the
  -- tsvector size limit.
  fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(skills_json, '') || ' ' || coalesce(field, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(locations_json, '')), 'C') ||
    setweight(to_tsvector('english', left(coalesce(description, ''), 100000)), 'D')
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_int_open        ON internships(is_open, date_posted DESC);
CREATE INDEX IF NOT EXISTS idx_int_season      ON internships(season, year);
CREATE INDEX IF NOT EXISTS idx_int_field       ON internships(field);
CREATE INDEX IF NOT EXISTS idx_int_role        ON internships(role_family);
CREATE INDEX IF NOT EXISTS idx_int_company     ON internships(company_slug);
CREATE INDEX IF NOT EXISTS idx_int_deadline    ON internships(deadline);
CREATE INDEX IF NOT EXISTS idx_int_posted      ON internships(date_posted DESC);
CREATE INDEX IF NOT EXISTS idx_int_country     ON internships(country);
CREATE INDEX IF NOT EXISTS idx_int_loctype     ON internships(location_type);
CREATE INDEX IF NOT EXISTS idx_int_source      ON internships(source);
CREATE INDEX IF NOT EXISTS idx_int_dedupe      ON internships(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_int_lastseen    ON internships(source, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_int_salary      ON internships(salary_min);
CREATE INDEX IF NOT EXISTS idx_int_dup         ON internships(duplicate_of);
-- The search list is always "open, not a duplicate, newest first".
CREATE INDEX IF NOT EXISTS idx_int_browse      ON internships(is_open, duplicate_of, date_posted DESC);
CREATE INDEX IF NOT EXISTS idx_int_fts         ON internships USING GIN (fts);

--------------------------------------------------------------------------------
-- Sync bookkeeping (written by the sync pipeline only).
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_runs (
  id           BIGSERIAL PRIMARY KEY,
  started_at   BIGINT NOT NULL,
  finished_at  BIGINT,
  ok           SMALLINT NOT NULL DEFAULT 0,
  trigger      TEXT NOT NULL DEFAULT 'manual',
  found        INTEGER NOT NULL DEFAULT 0,
  inserted     INTEGER NOT NULL DEFAULT 0,
  updated      INTEGER NOT NULL DEFAULT 0,
  closed       INTEGER NOT NULL DEFAULT 0,
  skipped      INTEGER NOT NULL DEFAULT 0,
  duration_ms  INTEGER,
  sources_json TEXT NOT NULL DEFAULT '[]',
  errors_json  TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS source_configs (
  id           BIGSERIAL PRIMARY KEY,
  kind         TEXT NOT NULL,    -- greenhouse | lever | ashby | smartrecruiters | workable | recruitee | github | remoteok | arbeitnow
  token        TEXT NOT NULL,    -- board slug, or '-' for singleton sources
  label        TEXT NOT NULL,
  enabled      SMALLINT NOT NULL DEFAULT 1,
  last_sync_at BIGINT,
  last_count   INTEGER,
  last_error   TEXT,
  created_at   BIGINT NOT NULL,
  UNIQUE(kind, token)
);

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

--------------------------------------------------------------------------------
-- Per-user profile: drives fit scoring, eligibility filtering, and defaults.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT,
  email                 TEXT,
  school                TEXT,
  major                 TEXT,
  minor                 TEXT,
  degree_level          TEXT,      -- Associate | Bachelors | Masters | MBA | PhD
  class_year            TEXT,      -- Freshman | Sophomore | Junior | Senior | Graduate
  grad_month            INTEGER,
  grad_year             INTEGER,
  gpa                   DOUBLE PRECISION,
  work_auth             TEXT,      -- us-citizen | permanent-resident | needs-sponsorship | other
  has_clearance         SMALLINT NOT NULL DEFAULT 0,
  skills_json           TEXT NOT NULL DEFAULT '[]',
  preferred_seasons_json TEXT NOT NULL DEFAULT '[]',
  preferred_years_json  TEXT NOT NULL DEFAULT '[]',
  preferred_fields_json TEXT NOT NULL DEFAULT '[]',
  preferred_locations_json TEXT NOT NULL DEFAULT '[]',
  remote_pref           TEXT NOT NULL DEFAULT 'any',  -- any | remote | hybrid | onsite
  willing_to_relocate   SMALLINT NOT NULL DEFAULT 1,
  min_hourly            DOUBLE PRECISION,
  paid_only             SMALLINT NOT NULL DEFAULT 0,
  earliest_start        BIGINT,
  latest_start          BIGINT,
  resume_text           TEXT,
  weekly_goal           INTEGER NOT NULL DEFAULT 5,
  onboarded             SMALLINT NOT NULL DEFAULT 0,
  -- Secret token that authenticates the personal calendar feed URL, since
  -- calendar apps cannot send cookies.
  calendar_token        TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at            BIGINT NOT NULL,
  updated_at            BIGINT NOT NULL
);

-- Create a profile row automatically for every new account.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, extract(epoch from now())::bigint, extract(epoch from now())::bigint)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

--------------------------------------------------------------------------------
-- Application tracker (per user).
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  internship_id   TEXT REFERENCES internships(id) ON DELETE SET NULL,

  company         TEXT NOT NULL,
  role            TEXT NOT NULL,
  apply_url       TEXT,
  location        TEXT,
  season          TEXT,
  year            INTEGER,
  field           TEXT,

  status          TEXT NOT NULL DEFAULT 'interested',
  priority        INTEGER NOT NULL DEFAULT 3,   -- 1 (low) .. 5 (dream)
  excitement      INTEGER,
  origin          TEXT NOT NULL DEFAULT 'internfinder', -- internfinder | manual | referral | career-fair | recruiter | other

  applied_at      BIGINT,
  deadline        BIGINT,
  next_action     TEXT,
  next_action_at  BIGINT,
  last_activity_at BIGINT,

  resume_version  TEXT,
  cover_letter_sent SMALLINT NOT NULL DEFAULT 0,
  portfolio_sent  SMALLINT NOT NULL DEFAULT 0,
  referral        SMALLINT NOT NULL DEFAULT 0,
  referrer        TEXT,

  comp_offered    TEXT,
  rejected_stage  TEXT,
  rejection_reason TEXT,
  notes           TEXT,
  archived        SMALLINT NOT NULL DEFAULT 0,

  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_user     ON applications(user_id, archived, status);
CREATE INDEX IF NOT EXISTS idx_app_deadline ON applications(user_id, deadline);
CREATE INDEX IF NOT EXISTS idx_app_next     ON applications(user_id, next_action_at);
CREATE INDEX IF NOT EXISTS idx_app_intern   ON applications(internship_id);
CREATE INDEX IF NOT EXISTS idx_app_applied  ON applications(user_id, applied_at);

-- Immutable-ish audit trail of everything that happened on an application.
CREATE TABLE IF NOT EXISTS application_events (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,   -- created | status_change | note | email | call | assessment | interview | offer | follow_up | document
  from_status    TEXT,
  to_status      TEXT,
  title          TEXT,
  body           TEXT,
  occurred_at    BIGINT NOT NULL,
  created_at     BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evt_app ON application_events(application_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_evt_user ON application_events(user_id);

CREATE TABLE IF NOT EXISTS interviews (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  round          INTEGER NOT NULL DEFAULT 1,
  kind           TEXT NOT NULL DEFAULT 'technical', -- recruiter_screen | online_assessment | technical | behavioral | system_design | case | final | superday
  scheduled_at   BIGINT,
  duration_min   INTEGER,
  location       TEXT,                -- room, call link, or "phone"
  interviewer    TEXT,
  prep_notes     TEXT,
  outcome        TEXT,                -- pending | passed | failed | cancelled | no_show
  feedback       TEXT,
  created_at     BIGINT NOT NULL,
  updated_at     BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_iv_app  ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_iv_user ON interviews(user_id, scheduled_at);

CREATE TABLE IF NOT EXISTS contacts (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id BIGINT REFERENCES applications(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  company        TEXT,
  role           TEXT,
  email          TEXT,
  phone          TEXT,
  linkedin       TEXT,
  relationship   TEXT,   -- recruiter | hiring_manager | engineer | alum | referral | professor | other
  notes          TEXT,
  last_contacted_at BIGINT,
  created_at     BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_app ON contacts(application_id);
CREATE INDEX IF NOT EXISTS idx_contact_user ON contacts(user_id);

CREATE TABLE IF NOT EXISTS offers (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  pay_rate       DOUBLE PRECISION,
  pay_period     TEXT DEFAULT 'hour',    -- hour | month | year | stipend
  currency       TEXT DEFAULT 'USD',
  hours_per_week DOUBLE PRECISION DEFAULT 40,
  weeks          DOUBLE PRECISION DEFAULT 12,
  signing_bonus  DOUBLE PRECISION,
  housing_stipend DOUBLE PRECISION,
  relocation     DOUBLE PRECISION,
  other_perks    TEXT,
  location       TEXT,
  col_index      DOUBLE PRECISION DEFAULT 100,        -- cost-of-living index, 100 = US average
  start_date     BIGINT,
  respond_by     BIGINT,
  status         TEXT NOT NULL DEFAULT 'received', -- received | negotiating | accepted | declined | expired
  notes          TEXT,
  created_at     BIGINT NOT NULL,
  updated_at     BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offer_app ON offers(application_id);
CREATE INDEX IF NOT EXISTS idx_offer_user ON offers(user_id);

-- Per-application to-dos (tailor resume, ask for referral, send thank-you note...)
CREATE TABLE IF NOT EXISTS tasks (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id BIGINT REFERENCES applications(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  done           SMALLINT NOT NULL DEFAULT 0,
  due_at         BIGINT,
  created_at     BIGINT NOT NULL,
  completed_at   BIGINT
);
CREATE INDEX IF NOT EXISTS idx_task_app ON tasks(application_id, done);
CREATE INDEX IF NOT EXISTS idx_task_user ON tasks(user_id, done, due_at);

--------------------------------------------------------------------------------
-- Saved searches, shortlist, and dismissals (per user).
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_searches (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  query_json    TEXT NOT NULL,
  alert         SMALLINT NOT NULL DEFAULT 1,
  last_seen_at  BIGINT,           -- for "N new since you last looked"
  created_at    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_searches(user_id);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  internship_id TEXT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  note          TEXT,
  created_at    BIGINT NOT NULL,
  PRIMARY KEY (user_id, internship_id)
);

CREATE TABLE IF NOT EXISTS hidden_listings (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  internship_id TEXT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  reason        TEXT,
  created_at    BIGINT NOT NULL,
  PRIMARY KEY (user_id, internship_id)
);

--------------------------------------------------------------------------------
-- Row-level security.
--
-- The Next.js server talks to Postgres with the service connection (which
-- bypasses RLS) and scopes every query by user_id itself; these policies are
-- defense in depth for anything that reaches PostgREST with an anon or user
-- JWT.
--------------------------------------------------------------------------------
ALTER TABLE internships     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_meta        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hidden_listings ENABLE ROW LEVEL SECURITY;

-- The catalog is public, read-only.
CREATE POLICY catalog_read ON internships    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY syncruns_read ON sync_runs     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY sources_read ON source_configs FOR SELECT TO anon, authenticated USING (true);

-- Users own their rows, full stop.
CREATE POLICY profiles_own ON profiles
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY applications_own ON applications
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY events_own ON application_events
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY interviews_own ON interviews
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY contacts_own ON contacts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY offers_own ON offers
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY tasks_own ON tasks
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY saved_searches_own ON saved_searches
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY bookmarks_own ON bookmarks
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY hidden_own ON hidden_listings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
