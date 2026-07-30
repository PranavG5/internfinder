-- InternFinder schema.
-- Everything lives in one local SQLite file. No accounts, no cloud, no telemetry.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

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
  is_remote         INTEGER NOT NULL DEFAULT 0,

  -- Timing
  season            TEXT NOT NULL DEFAULT 'Unknown',  -- Summer | Fall | Winter | Spring | Year-round | Unknown
  year              INTEGER,
  terms_json        TEXT NOT NULL DEFAULT '[]',
  start_date        INTEGER,                   -- unix seconds
  end_date          INTEGER,
  duration_weeks    INTEGER,
  deadline          INTEGER,

  -- Classification
  field             TEXT NOT NULL DEFAULT 'Other',
  role_family       TEXT NOT NULL DEFAULT 'other',
  program_type      TEXT NOT NULL DEFAULT 'internship',  -- internship | co-op | apprenticeship | fellowship | research | rotational

  -- Eligibility / prerequisites
  degrees_json      TEXT NOT NULL DEFAULT '[]',   -- Associate | Bachelors | Masters | MBA | PhD | High School
  class_years_json  TEXT NOT NULL DEFAULT '[]',   -- Freshman | Sophomore | Junior | Senior | Graduate
  gpa_min           REAL,
  sponsorship       TEXT NOT NULL DEFAULT 'unknown', -- offers | does-not-offer | us-citizenship | clearance | unknown
  offers_sponsorship  INTEGER,                  -- 1 yes, 0 no, NULL unknown
  requires_citizenship INTEGER NOT NULL DEFAULT 0,
  requires_clearance  INTEGER NOT NULL DEFAULT 0,
  requires_cover_letter INTEGER NOT NULL DEFAULT 0,
  requires_transcript INTEGER NOT NULL DEFAULT 0,
  requires_portfolio  INTEGER NOT NULL DEFAULT 0,
  skills_json       TEXT NOT NULL DEFAULT '[]',
  tags_json         TEXT NOT NULL DEFAULT '[]',

  -- Compensation
  is_paid           INTEGER,                   -- 1 paid, 0 unpaid, NULL unknown
  salary_min        REAL,
  salary_max        REAL,
  salary_period     TEXT,                      -- hour | month | year | stipend
  salary_currency   TEXT DEFAULT 'USD',
  comp_text         TEXT,

  -- Lifecycle: this is what guarantees we only show open roles.
  status            TEXT NOT NULL DEFAULT 'open',  -- open | closed | expired
  is_open           INTEGER NOT NULL DEFAULT 1,
  close_reason      TEXT,                       -- delisted | deadline-passed | stale | dead-link | source-inactive
  closed_at         INTEGER,
  first_seen_at     INTEGER NOT NULL,
  last_seen_at      INTEGER NOT NULL,
  date_posted       INTEGER,
  date_updated      INTEGER,
  link_status       INTEGER,                    -- last HTTP status from link verification
  link_checked_at   INTEGER,

  dedupe_key        TEXT NOT NULL DEFAULT '',
  -- When the same role is found on several sources, the weaker copies point at
  -- the canonical row's id and are hidden from search.
  duplicate_of      TEXT,
  quality           REAL NOT NULL DEFAULT 0,    -- 0..1 metadata completeness, used as a ranking tiebreak
  raw_json          TEXT
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

-- Full-text index over the searchable text. External-content table kept in sync
-- by the triggers below.
CREATE VIRTUAL TABLE IF NOT EXISTS internships_fts USING fts5(
  title, company, description, locations, skills, field,
  content='internships',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS internships_fts_ai AFTER INSERT ON internships BEGIN
  INSERT INTO internships_fts(rowid, title, company, description, locations, skills, field)
  VALUES (new.rowid, new.title, new.company, coalesce(new.description,''), new.locations_json, new.skills_json, new.field);
END;

CREATE TRIGGER IF NOT EXISTS internships_fts_ad AFTER DELETE ON internships BEGIN
  INSERT INTO internships_fts(internships_fts, rowid, title, company, description, locations, skills, field)
  VALUES ('delete', old.rowid, old.title, old.company, coalesce(old.description,''), old.locations_json, old.skills_json, old.field);
END;

CREATE TRIGGER IF NOT EXISTS internships_fts_au AFTER UPDATE ON internships BEGIN
  INSERT INTO internships_fts(internships_fts, rowid, title, company, description, locations, skills, field)
  VALUES ('delete', old.rowid, old.title, old.company, coalesce(old.description,''), old.locations_json, old.skills_json, old.field);
  INSERT INTO internships_fts(rowid, title, company, description, locations, skills, field)
  VALUES (new.rowid, new.title, new.company, coalesce(new.description,''), new.locations_json, new.skills_json, new.field);
END;

--------------------------------------------------------------------------------
-- Application tracker.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
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

  applied_at      INTEGER,
  deadline        INTEGER,
  next_action     TEXT,
  next_action_at  INTEGER,
  last_activity_at INTEGER,

  resume_version  TEXT,
  cover_letter_sent INTEGER NOT NULL DEFAULT 0,
  portfolio_sent  INTEGER NOT NULL DEFAULT 0,
  referral        INTEGER NOT NULL DEFAULT 0,
  referrer        TEXT,

  comp_offered    TEXT,
  rejected_stage  TEXT,
  rejection_reason TEXT,
  notes           TEXT,
  archived        INTEGER NOT NULL DEFAULT 0,

  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_status   ON applications(status, archived);
CREATE INDEX IF NOT EXISTS idx_app_deadline ON applications(deadline);
CREATE INDEX IF NOT EXISTS idx_app_next     ON applications(next_action_at);
CREATE INDEX IF NOT EXISTS idx_app_intern   ON applications(internship_id);
CREATE INDEX IF NOT EXISTS idx_app_applied  ON applications(applied_at);

-- Immutable-ish audit trail of everything that happened on an application.
CREATE TABLE IF NOT EXISTS application_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,   -- created | status_change | note | email | call | assessment | interview | offer | follow_up | document
  from_status    TEXT,
  to_status      TEXT,
  title          TEXT,
  body           TEXT,
  occurred_at    INTEGER NOT NULL,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evt_app ON application_events(application_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS interviews (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  round          INTEGER NOT NULL DEFAULT 1,
  kind           TEXT NOT NULL DEFAULT 'technical', -- recruiter_screen | online_assessment | technical | behavioral | system_design | case | final | superday
  scheduled_at   INTEGER,
  duration_min   INTEGER,
  location       TEXT,                -- room, call link, or "phone"
  interviewer    TEXT,
  prep_notes     TEXT,
  outcome        TEXT,                -- pending | passed | failed | cancelled | no_show
  feedback       TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_iv_app  ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_iv_when ON interviews(scheduled_at);

CREATE TABLE IF NOT EXISTS contacts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  company        TEXT,
  role           TEXT,
  email          TEXT,
  phone          TEXT,
  linkedin       TEXT,
  relationship   TEXT,   -- recruiter | hiring_manager | engineer | alum | referral | professor | other
  notes          TEXT,
  last_contacted_at INTEGER,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_app ON contacts(application_id);

CREATE TABLE IF NOT EXISTS offers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  pay_rate       REAL,
  pay_period     TEXT DEFAULT 'hour',    -- hour | month | year | stipend
  currency       TEXT DEFAULT 'USD',
  hours_per_week REAL DEFAULT 40,
  weeks          REAL DEFAULT 12,
  signing_bonus  REAL,
  housing_stipend REAL,
  relocation     REAL,
  other_perks    TEXT,
  location       TEXT,
  col_index      REAL DEFAULT 100,        -- cost-of-living index, 100 = US average
  start_date     INTEGER,
  respond_by     INTEGER,
  status         TEXT NOT NULL DEFAULT 'received', -- received | negotiating | accepted | declined | expired
  notes          TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offer_app ON offers(application_id);

-- Per-application to-dos (tailor resume, ask for referral, send thank-you note...)
CREATE TABLE IF NOT EXISTS tasks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  done           INTEGER NOT NULL DEFAULT 0,
  due_at         INTEGER,
  created_at     INTEGER NOT NULL,
  completed_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_task_app ON tasks(application_id, done);
CREATE INDEX IF NOT EXISTS idx_task_due ON tasks(done, due_at);

--------------------------------------------------------------------------------
-- User profile: drives fit scoring, eligibility filtering, and defaults.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profile (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  name                  TEXT,
  email                 TEXT,
  school                TEXT,
  major                 TEXT,
  minor                 TEXT,
  degree_level          TEXT,      -- Associate | Bachelors | Masters | MBA | PhD
  class_year            TEXT,      -- Freshman | Sophomore | Junior | Senior | Graduate
  grad_month            INTEGER,
  grad_year             INTEGER,
  gpa                   REAL,
  work_auth             TEXT,      -- us-citizen | permanent-resident | needs-sponsorship | other
  has_clearance         INTEGER NOT NULL DEFAULT 0,
  skills_json           TEXT NOT NULL DEFAULT '[]',
  preferred_seasons_json TEXT NOT NULL DEFAULT '[]',
  preferred_years_json  TEXT NOT NULL DEFAULT '[]',
  preferred_fields_json TEXT NOT NULL DEFAULT '[]',
  preferred_locations_json TEXT NOT NULL DEFAULT '[]',
  remote_pref           TEXT NOT NULL DEFAULT 'any',  -- any | remote | hybrid | onsite
  willing_to_relocate   INTEGER NOT NULL DEFAULT 1,
  min_hourly            REAL,
  paid_only             INTEGER NOT NULL DEFAULT 0,
  earliest_start        INTEGER,
  latest_start          INTEGER,
  resume_text           TEXT,
  weekly_goal           INTEGER NOT NULL DEFAULT 5,
  onboarded             INTEGER NOT NULL DEFAULT 0,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);

--------------------------------------------------------------------------------
-- Saved searches, shortlist, and dismissals.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_searches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  query_json    TEXT NOT NULL,
  alert         INTEGER NOT NULL DEFAULT 1,
  last_seen_at  INTEGER,           -- for "N new since you last looked"
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  internship_id TEXT PRIMARY KEY REFERENCES internships(id) ON DELETE CASCADE,
  note          TEXT,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hidden_listings (
  internship_id TEXT PRIMARY KEY REFERENCES internships(id) ON DELETE CASCADE,
  reason        TEXT,
  created_at    INTEGER NOT NULL
);

--------------------------------------------------------------------------------
-- Sync bookkeeping.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER,
  ok           INTEGER NOT NULL DEFAULT 0,
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
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL,    -- greenhouse | lever | ashby | smartrecruiters | github | remoteok | arbeitnow
  token        TEXT NOT NULL,    -- board slug, or '-' for singleton sources
  label        TEXT NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1,
  last_sync_at INTEGER,
  last_count   INTEGER,
  last_error   TEXT,
  created_at   INTEGER NOT NULL,
  UNIQUE(kind, token)
);

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
