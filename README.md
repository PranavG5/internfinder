# InternIndex

Finds internships that are **actually open**, filters them by everything a student
actually cares about, and tracks every application from "interested" to "accepted".
Software, engineering, finance and design are covered, and so are medicine,
nursing, public health, and the research and lab openings premed students need.

The catalog lives in **Supabase Postgres** and refreshes itself on a schedule, so
closed roles drop off the site without anyone redeploying. The site is
**account-only** (Supabase Auth): visitors sign up before they can search, and
each account keeps its own profile, fit preferences, shortlist, saved searches,
and application tracker.

---

## Quick start (local)

```bash
npm install
cp .env.example .env.local     # fill in your Supabase project (see below)
npm run sync                   # pulls open internships from every configured source
npm run dev                    # http://localhost:3000
```

`.env.local` needs three values from your Supabase project:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page (anon / publishable key) |
| `SUPABASE_DB_URL` | Dashboard → Connect → Transaction pooler connection string (port 6543) |

The schema ships as SQL migrations in `supabase/migrations/`. Apply them once
with the SQL editor or `supabase db push`.

Want the tracker, dashboard, and insights populated before you've applied
anywhere?

```bash
npm run seed -- --user you@example.com            # adds realistic demo applications
npm run seed -- --user you@example.com --clear    # removes them again
```

---

## How "only open internships" actually works

This is the hard part of an internship aggregator, so it's worth being explicit
about the guarantees. Four independent mechanisms keep closed roles out:

1. **Live boards as the source of truth.** Most listings come straight from a
   company's own applicant-tracking system (Workday, Greenhouse, Oracle Cloud
   Recruiting, Ashby, Lever, SmartRecruiters, Workable, Recruitee, Teamtailor,
   UKG, Rippling and others).
   A role is served by those APIs only while the board is accepting
   applications, so presence in the feed *is* evidence it's open.

2. **Delisting reconciliation.** After each sync, any listing a source no longer
   carries is marked closed. Critically, this only applies to sources that
   **fetched successfully**, because a network failure must never be read as
   "this employer closed every role". That is the obvious way to corrupt a
   catalog like this.

3. **Time-based sweeps.** A listing is closed automatically when its stated
   deadline passes, when it hasn't been seen for 21 days, when it was posted
   over 150 days ago with no update since, or when its term already started
   months ago.

4. **Link verification.** Each sync cycle also opens the least-recently-checked
   application URLs and closes any that 404, 410, or render a "no longer
   accepting applications" banner. Unreachable links are left alone, since a
   timeout isn't a closure either.

Closed listings are kept in the database for history but never appear in search
unless you explicitly ask for the archive.

### Staying fresh automatically

Two schedulers keep the shared catalog current; either alone is enough:

- **GitHub Actions** (`.github/workflows/sync.yml`) runs every 2 hours. It fetches
  every feed plus a rotating slice of 900 company boards, reconciles openness,
  merges duplicates, and link-checks 500 listings. With several thousand boards
  tracked, that walks the whole set about every day and a half. It needs one
  repository secret: `SUPABASE_DB_URL`.
- **Vercel Cron** (`vercel.json` → `/api/cron/sync`) is a smaller daily pass that
  runs on the deployment itself. Enable it by setting a `CRON_SECRET` env var
  in Vercel.

There's also a "Sync now" button on the Sources page for any signed-in user.

---

## Where listings come from

| Source | What it provides |
| --- | --- |
| **Workday** | About half of all large-employer postings on the internet. Northrop Grumman, Boeing, RTX, NVIDIA, Intel, CVS Health, Analog Devices, Airbus, Accenture, ASML and ~1,700 more tenants |
| **Oracle Cloud Recruiting** | Goldman Sachs, JPMorgan Chase, Texas Instruments, Honeywell, Mount Sinai, Cedars-Sinai, Providence, Mayo Clinic, UCSF and ~185 more |
| **Phenom careers sites** | How nearly every US health system fronts its ATS. Stanford Health Care, CHOP, Sutter, Trinity Health, Corewell, Wellstar, Prisma, Cincinnati Children's, Yale, UVA, Labcorp, GSK, Lilly and more |
| Greenhouse / Ashby / Lever | Startups and mid-size tech and health tech, with full descriptions, structured pay, and real deadlines |
| SmartRecruiters / Workable | Visa, ServiceNow, Bosch, Experian and European employers |
| Rippling / BambooHR / Breezy / Personio | The long tail of smaller employers |
| **Recruitee / Teamtailor / Pinpoint / JobScore / UKG** | The mid-market, which no other adapter reached: European small and mid-size companies, labs, agencies, regional employers, and the health systems and staffing firms that run on UKG |
| Amazon | `amazon.jobs` directly, several thousand student roles worldwide |
| Eightfold | Netflix and other tenants that leave their jobs API open |
| **The Muse** | Employers whose own site is a closed portal: hospitals, insurers, clinics, school districts and agencies. Queried at internship level across 23 categories, because one query only reaches 100 pages and healthcare alone runs past 170 |
| **ORISE / Zintellect** | The federal research participation catalog. NIH, CDC, FDA, EPA, NASA, NIST, the Army and Navy labs, and every Department of Energy national laboratory recruit students here |
| **USAJOBS** | Federal student openings including the government-wide Pathways Internship Program. Needs a free API key (see `.env.example`); the source stays quiet without one |
| Community lists | The SimplifyJobs (internship + new-grad), vanshb03 and cvrve repos, broad coverage with per-listing active flags |
| Public boards | RemoteOK, Jobicy, Arbeitnow, covering remote and European roles |
| **Hacker News · who is hiring** | The monthly thread, read for the job boards it links. Several hundred employers per thread, each linking its own board |
| **Reddit** | Twenty student and career subreddits, read for the apply links their posts carry |

**The source list grows itself, and that is the main engine.** Every sync reads
the apply links it encounters and starts tracking any employer board it
recognizes, across all eighteen providers above. The seed list ships ~1,090
boards, each confirmed live when it was added (`npm run verify-seeds` re-checks
them); the community archives name roughly **4,000 employer boards**, and the
discovery pass registers them on the first full run. You can also paste any
posting URL on the Sources page to add a board by hand.

Hacker News and Reddit feed that engine rather than the catalog. A forum post
announcing an opening is a lead, not a listing: the title is not a role title
and the poster is not the employer. So those two sources contribute only the
apply URLs they mention, discovery turns each into an employer job board, and
the role enters the catalog on the next run **from the company's own board**,
where its openness can actually be verified. A single pass over the monthly
Hacker News thread yields ~1,750 links and ~165 employer boards.

```bash
npm run sync                          # everything (caps company boards per run)
npm run sync -- --kinds github        # just the community lists, fast
npm run sync -- --max-boards 900      # touch more company boards this run
npm run sync -- --kinds workday       # just the Workday tenants
npm run sync -- --only greenhouse:figma
npm run sync -- --verify 200          # sync, then link-check 200 listings
npm run verify -- 500                 # link-check only
```

Capped runs **round-robin across providers**, so one sync samples every ATS
rather than exhausting whichever sorts first alphabetically. Boards are picked
least-recently-synced first, so repeated runs cover everything over time.

### Healthcare, premed, and research

Medicine hires nowhere near where software hires, so the catalog reaches it
separately:

- **Hospitals and academic medical centers.** Cleveland Clinic, Mayo, Mount
  Sinai, Cedars-Sinai, Providence, MSK, Dana-Farber, NewYork-Presbyterian,
  Stanford Health Care, CHOP, Cincinnati Children's, Nationwide Children's,
  Children's National, UCSF, Vanderbilt, MUSC, Ochsner, Intermountain, Banner,
  AdventHealth, Sentara, Jefferson, Geisinger, Sharp, WVU Medicine, Corewell,
  Wellstar, Prisma, Trinity Health, Baylor Scott & White, Sutter, Temple,
  Tufts Medicine, Seattle Children's and Bon Secours. These carry the nurse
  externships, patient care tech roles, clinical research assistantships and
  hospital administrative fellowships that no tech-oriented board lists.
- **Research and lab openings.** The ORISE catalog alone runs about 1,100 open
  research participation appointments at federal agencies and national labs, and
  the university boards (Washington, Rochester, Cornell, Brown, USC,
  Northeastern, Georgetown, WashU, Maryland) carry bench positions, lab aide
  roles and study coordinator openings. Postdoctoral and faculty appointments
  are filtered out, since those need a finished doctorate.
- **Pharma, devices and diagnostics.** Merck, Amgen, Gilead, Moderna, Biogen,
  BMS, Illumina, Edwards, IQVIA, Agilent, Labcorp, Danaher, Zimmer Biomet,
  Elevance and Cigna, alongside the biotech and health tech boards.
- **Research institutes.** HHMI, the Jackson Laboratory, RAND.

Postings are classified into families a premed can actually filter on:
`nursing`, `allied-health`, `pharmacy`, `dentistry`, `veterinary`,
`mental-health`, `nutrition`, `public-health`, `clinical-research`,
`lab-research`, `biomedical-engineering`, `health-admin`, `medicine` and
`clinical`, rolling up into **Medicine & Clinical Care**, **Nursing & Allied
Health**, **Public Health**, and **Healthcare & Life Sciences**.

Program detection understands the vocabulary these postings actually use, not
just the word "intern": research participation, REU, summer undergraduate
research, lab opportunity, postbac, practicum, clinical rotation, scribe,
externship and prehealth programs all qualify.

---

## Accounts

- **An account is required.** Middleware turns away every request without a
  session: pages redirect to `/login?next=…`, API routes return 401. The only
  exceptions are `/login`, the `/auth/*` confirmation callback, and the two
  routes that carry their own credentials (`/api/calendar`, `/api/cron/*`).
- **Signing up** (email + password, `/login`) gives you the catalog plus
  everything personal: the profile that powers fit scoring, the shortlist,
  dismissals, saved searches, the application tracker, insights, and the
  calendar feed.
- Each user's rows live in Postgres keyed by their Supabase Auth id, with
  row-level security on every personal table as defense in depth.
- A profile row is created automatically on signup; the personal iCalendar feed
  authenticates with a per-account token since calendar apps can't send cookies.

## Filtering

Everything below is a real filter, combinable, and reflected in the URL, so any
search is shareable and bookmarkable.

- **Term**: season, year, program type (internship, co-op, apprenticeship, fellowship, research, rotational)
- **Timing**: starts after/before, deadline before, has a deadline, posted within N days, duration in weeks
- **Field & role**: 29 fields and 55+ specific role families (backend, quant research, nursing, public health, clinical research, lab research, …)
- **Location**: free text, country, state/region, and remote / hybrid / onsite
- **Eligibility**: degree level, class year, your GPA (hides roles asking for more), work authorization, security clearance
- **Pay**: paid only, has a listed salary, minimum hourly rate (monthly and annual figures are normalized to hourly so the comparison is fair)
- **Effort**: no cover letter required
- **Everything else**: skills, company, source, keyword exclusions, shortlisted only, hide already-tracked

Sort by relevance, **best fit for you**, newest, deadline, or pay. Full-text
search runs on a weighted Postgres tsvector index, so a title hit outranks a
description hit.

Each filter group shows **live result counts**, and each facet ignores its own
filter, so the numbers answer "what if I picked this instead" rather than "how
many of what I already chose".

### Fit scoring

With a profile filled in, every listing gets a 0–100 fit score and a plain-English
explanation of *why*. Season, year, field, location, work authorization, degree,
class year, skill overlap, pay floor, and start-date window are each weighted,
but only when your profile actually specifies that preference, so a sparse profile
yields fair scores instead of penalizing everything.

Hard eligibility problems are surfaced separately as **blockers** ("requires U.S.
citizenship", "requires a 3.50 GPA") rather than folded into the number, because
"you cannot apply" is a different fact from "weak match". Turn on *Only roles I'm
eligible for* and those are filtered out in SQL, so counts and pagination stay
correct.

---

## The application tracker

Twelve pipeline stages: interested → preparing → submitted → online assessment →
phone screen → interviewing → final round → offer → accepted, plus rejected,
withdrawn, and ghosted.

- **Board and table views.** Drag cards between columns, or edit inline in the table.
- **Automatic timeline.** Every status change is logged with a timestamp; add notes, emails, and calls alongside.
- **`applied_at` stamps itself** the first time a role reaches a submitted state, so response-time metrics are trustworthy without bookkeeping.
- **Interviews** with round, type, time, interviewer, prep notes, and outcome.
- **Contacts** for recruiters, alumni, and referrers, with email and LinkedIn.
- **Offers** with pay, bonus, housing stipend, relocation, and a cost-of-living index.
- **Per-application checklists** with suggested next steps.
- **Duplicate protection**: tracking a listing you already track sends you to the existing entry instead of silently creating a second one.

## Dashboard & insights

The dashboard answers "what do I do today": deadlines coming up, next actions,
applications that need a **follow-up nudge** (submitted 10–30 days ago, no reply),
ones that are **probably ghosted** (30+ days), upcoming interviews, and open tasks.
Alongside those sit your funnel, weekly submission rate against a goal, response
rate, interview rate, and median days-to-response.

Insights breaks conversion down by field, season, company, and how you found the
role, shows **whether referrals are actually helping you** (referred vs cold
response rate side by side), and reports which stage rejects you most often. Offers
are compared on total package including a cost-of-living adjustment, so a New York
offer and an Austin offer can be compared honestly.

## Everything else

- **Saved searches** that act as standing alerts, each reporting how many results it has now and how many are new since you last looked
- **Shortlist** for roles you're still deciding on, sorted by deadline
- **Dismiss** a listing and it never comes back
- **Calendar feed**: subscribe to your personal `/api/calendar?token=…` URL from Google/Apple/Outlook and every deadline, interview, and due task appears alongside your classes, with reminders
- **Full data portability**: JSON backup that restores exactly, CSV for spreadsheets, and CSV import that maps loose status names ("submitted", "OA", "waiting") onto the pipeline. Re-importing the same file is safe: existing rows are skipped
- **Dark mode**, deliberately designed rather than an inverted flip, with the OS setting respected and an in-app override
- **Keyboard**: `/` focuses search, `Esc` leaves it

---

## Link previews

Pasting `internindex.online` into Slack, iMessage, Discord, X, or LinkedIn
unfurls a 1200x630 card: the compass mark, the pitch, and a slice of the field
list the catalog is organised by.

The card is a committed asset, `public/og.png`, not a route rendered on demand,
so a crawler that will not wait around still gets a thumbnail. Its source is
`scripts/og-image.html`, an ordinary HTML page. To change the card, edit that
file and re-render:

```bash
npm i -D playwright-core        # only needed to regenerate, never to build
npm run og
```

`CHROMIUM_PATH` points the renderer at a browser if Playwright cannot find one.
The tags themselves (`og:*`, `twitter:*`) live in `src/app/layout.tsx`. Absolute
URLs come from `NEXT_PUBLIC_SITE_URL` when set; otherwise production uses
`https://www.internindex.online` (the canonical host, since the apex 308s to
it) and preview deploys use their own Vercel host.

---

## Architecture

```
supabase/migrations/   Postgres schema: catalog + per-user tables + RLS
src/
  lib/
    db.ts            pg connection pool, ?-placeholder query helpers
    auth.ts          Supabase session → verified user id
    supabase/        SSR/browser auth clients
    parse/           the classification layer, described below
    sources/         one adapter per provider + HTTP client + board discovery
    sync.ts          fetch → normalize → bulk upsert → reconcile openness
    query.ts         SQL search + facet counting        (server only)
    search-query.ts  query shape + URL encoding        (shared with the client)
    fit.ts           profile-based scoring
    repo.ts          per-user tracker CRUD, dashboard, insights
  app/               pages + REST API routes (+ /login, /auth/confirm)
  components/        UI
scripts/             sync, verify, verify-seeds, seed, reset, push-catalog
test/                parser unit tests
.github/workflows/   scheduled catalog sync
```

### The parsing layer

Job postings are unstructured prose, so most of the real work is extraction:

- **Internship classification** with word-boundary matching, because `/intern/` matches "internal", "international", and "internet", a mistake that silently poisons an aggregator
- **Season and year**, preferring explicit source terms, then the title, then the description; a bare season resolves to its *next* occurrence relative to the posting date, since recruiting runs ahead of the calendar
- **Compensation**: hourly/monthly/annual ranges in 20+ currencies, weighted toward text near a compensation heading so "we raised $50M in Series B" is never read as pay
- **Eligibility**: GPA (normalizing a 5.0 scale onto 4.0), degrees, class years, citizenship, clearance, sponsorship
- **Deadlines**, only when adjacent to deadline language, and never returning a date already in the past
- **Locations**, where `CA` means California in "Palo Alto, CA" but Canada in "Vancouver, BC, CA"
- **Skills** matched against a curated vocabulary, so the tags are clean enough to use as filter facets

Anything not confidently determined stays `null` rather than being guessed, so a
filter never silently excludes a listing based on invented data.

120 unit tests cover these, including the failure modes above:

```bash
npm test
npm run typecheck
```

---

## Deploying

1. **Supabase**: create a project, apply `supabase/migrations/*.sql` in order,
   and note the project URL, anon key, and database password.
2. **Vercel**: import the repository, set the three env vars from
   `.env.example` (plus `CRON_SECRET` if you want the built-in daily cron), and
   deploy. The build is just `next build`; the app reads the live database at
   request time, so deploys and data are independent.
3. **GitHub**: add the `SUPABASE_DB_URL` repository secret so the sync
   workflow can run. Trigger it once manually (Actions → *Sync internship
   catalog* → Run workflow) to fill the catalog, or run `npm run sync` from any
   machine with the env vars set.

If the machine you sync from only has HTTPS egress (no direct Postgres port),
`npm run push-catalog` can mirror a locally-built catalog into Supabase through
the secret-guarded `catalog_ingest` RPC. See `scripts/push-catalog.ts`.

## Notes

- **Requires Node 20.11+.** Behind a corporate proxy, run with `NODE_USE_ENV_PROXY=1`.
- `npm run db:reset -- --catalog --yes` clears listings but keeps user data. Without `--catalog` it also clears every user's tracker, so think twice.
- Adapters hit public, unauthenticated job-board APIs with a real User-Agent, per-host request serialization, and exponential backoff on 429s and 5xxs. If you add sources, keep it polite and check the site's terms.
- Listing data belongs to the employers and the sources it came from; this tool aggregates it for personal job-search use.
