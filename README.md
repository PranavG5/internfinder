# InternFinder

Finds internships that are **actually open**, filters them by everything a student
actually cares about, and tracks every application from "interested" to "accepted".

Runs entirely on your machine. One SQLite file, no account, no cloud, no telemetry.

---

## Quick start

```bash
npm install
npm run sync      # pulls open internships from every configured source
npm run dev       # http://localhost:3000
```

The first sync takes about 30 seconds and pulls in a few thousand listings. Want
to see the tracker, dashboard, and insights populated before you've applied
anywhere?

```bash
npm run seed              # adds realistic demo applications
npm run seed -- --clear   # removes them, leaving your own data untouched
```

---

## How "only open internships" actually works

This is the hard part of an internship aggregator, so it's worth being explicit
about the guarantees. Four independent mechanisms keep closed roles out:

1. **Live boards as the source of truth.** Most listings come straight from a
   company's own applicant-tracking system (Greenhouse, Lever, Ashby,
   SmartRecruiters). A role is served by those APIs only while the board is
   accepting applications, so presence in the feed *is* evidence it's open.

2. **Delisting reconciliation.** After each sync, any listing a source no longer
   carries is marked closed. Critically, this only applies to sources that
   **fetched successfully** — a network failure is never read as "this employer
   closed every role", which is the obvious way to corrupt a catalog like this.

3. **Time-based sweeps.** A listing is closed automatically when its stated
   deadline passes, when it hasn't been seen for 21 days, or when it was posted
   over 150 days ago with no update since.

4. **Link verification.** `npm run verify` opens each application URL and closes
   any that 404s, 410s, or renders a "no longer accepting applications" banner.
   Unreachable links are left alone — a timeout isn't a closure either.

Closed listings are kept in the database for history but never appear in search
unless you explicitly ask for the archive.

---

## Where listings come from

| Source | What it provides |
| --- | --- |
| Company ATS boards | Greenhouse, Lever, Ashby, SmartRecruiters — full descriptions, structured pay, real deadlines |
| Community lists | The SimplifyJobs and vanshb03 internship repos — very broad coverage with per-listing active flags |
| Public boards | RemoteOK, Arbeitnow — remote and European roles |

**The source list grows itself.** Every sync reads the apply links it encounters
and starts tracking any employer board it recognizes. A first sync seeds ~90
verified boards and typically discovers **1,000+ more** from the community feeds.
You can also paste any posting URL on the Sources page to add a board by hand.

```bash
npm run sync                          # everything (caps company boards per run)
npm run sync -- --kinds github        # just the community lists — fast
npm run sync -- --max-boards 150      # touch more company boards this run
npm run sync -- --only greenhouse:figma
npm run sync -- --verify 200          # sync, then link-check 200 listings
npm run verify -- 500                 # link-check only
```

Capped runs **round-robin across providers**, so one sync samples every ATS
rather than exhausting whichever sorts first alphabetically. Boards are picked
least-recently-synced first, so repeated runs cover everything over time.

Put it on a schedule with cron:

```cron
0 7 * * *  cd /path/to/internfinder && npm run sync >> sync.log 2>&1
```

---

## Filtering

Everything below is a real filter, combinable, and reflected in the URL — so any
search is shareable and bookmarkable.

- **Term** — season, year, program type (internship, co-op, apprenticeship, fellowship, research, rotational)
- **Timing** — starts after/before, deadline before, has a deadline, posted within N days, duration in weeks
- **Field & role** — 26 fields, 40+ specific role families (backend, quant research, bioinformatics, …)
- **Location** — free text, country, state/region, and remote / hybrid / onsite
- **Eligibility** — degree level, class year, your GPA (hides roles asking for more), work authorization, security clearance
- **Pay** — paid only, has a listed salary, minimum hourly rate (monthly and annual figures are normalized to hourly so the comparison is fair)
- **Effort** — no cover letter required
- **Everything else** — skills, company, source, keyword exclusions, shortlisted only, hide already-tracked

Sort by relevance, **best fit for you**, newest, deadline, or pay.

Each filter group shows **live result counts**, and each facet ignores its own
filter — so the numbers answer "what if I picked this instead", not "how many of
what I already chose".

### Fit scoring

With a profile filled in, every listing gets a 0–100 fit score and a plain-English
explanation of *why*. Season, year, field, location, work authorization, degree,
class year, skill overlap, pay floor, and start-date window are each weighted —
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
- **Contacts** — recruiters, alumni, referrers — with email and LinkedIn.
- **Offers** with pay, bonus, housing stipend, relocation, and a cost-of-living index.
- **Per-application checklists** with suggested next steps.
- **Duplicate protection** — tracking a listing you already track sends you to the existing entry instead of silently creating a second one.

## Dashboard & insights

The dashboard answers "what do I do today": deadlines coming up, next actions,
applications that need a **follow-up nudge** (submitted 10–30 days ago, no reply),
ones that are **probably ghosted** (30+ days), upcoming interviews, and open tasks
— alongside your funnel, weekly submission rate against a goal, response rate,
interview rate, and median days-to-response.

Insights breaks conversion down by field, season, company, and how you found the
role, shows **whether referrals are actually helping you** (referred vs cold
response rate side by side), and reports which stage rejects you most often. Offers
are compared on total package including a cost-of-living adjustment, so a New York
offer and an Austin offer can be compared honestly.

## Everything else

- **Saved searches** that act as standing alerts — each reports how many results it has now and how many are new since you last looked
- **Shortlist** for roles you're still deciding on, sorted by deadline
- **Dismiss** a listing and it never comes back
- **Calendar feed** — subscribe to `/api/calendar` from Google/Apple/Outlook and every deadline, interview, and due task appears alongside your classes, with reminders
- **Full data portability** — JSON backup that restores exactly, CSV for spreadsheets, and CSV import that maps loose status names ("submitted", "OA", "waiting") onto the pipeline. Re-importing the same file is safe: existing rows are skipped
- **Dark mode**, deliberately designed rather than an inverted flip, with the OS setting respected and an in-app override
- **Keyboard**: `/` focuses search, `Esc` leaves it

---

## Architecture

```
src/
  lib/
    schema.sql       full SQLite schema (14 tables + FTS5 index)
    db.ts            connection, migrations-on-open
    parse/           the classification layer — see below
    sources/         one adapter per provider + HTTP client + board discovery
    sync.ts          fetch → normalize → dedupe → upsert → reconcile openness
    query.ts         SQL search + facet counting        (server only)
    search-query.ts  query shape + URL encoding        (shared with the client)
    fit.ts           profile-based scoring
    repo.ts          tracker CRUD, dashboard, insights
  app/               pages + REST API routes
  components/        UI
scripts/             sync, verify, seed, reset
test/                parser unit tests
```

### The parsing layer

Job postings are unstructured prose, so most of the real work is extraction:

- **Internship classification** with word-boundary matching, because `/intern/` matches "internal", "international", and "internet" — a mistake that silently poisons an aggregator
- **Season and year**, preferring explicit source terms, then the title, then the description; a bare season resolves to its *next* occurrence relative to the posting date, since recruiting runs ahead of the calendar
- **Compensation** — hourly/monthly/annual ranges in 20+ currencies, weighted toward text near a compensation heading so "we raised $50M in Series B" is never read as pay
- **Eligibility** — GPA (normalizing a 5.0 scale onto 4.0), degrees, class years, citizenship, clearance, sponsorship
- **Deadlines**, only when adjacent to deadline language, and never returning a date already in the past
- **Locations**, where `CA` means California in "Palo Alto, CA" but Canada in "Vancouver, BC, CA"
- **Skills** matched against a curated vocabulary, so the tags are clean enough to use as filter facets

Anything not confidently determined stays `null` rather than being guessed, so a
filter never silently excludes a listing based on invented data.

64 unit tests cover these, including the failure modes above:

```bash
npm test
npm run typecheck
```

---

## Deploying

InternFinder is built to run locally, because that's what keeps your GPA, resume,
and rejection history on your own machine. It can also be deployed, with one
important caveat depending on the host.

### Vercel (browse-only)

Serverless functions get a **read-only filesystem**, so a SQLite file can be read
but never written. Rather than ship something that silently loses data, the app
detects this and switches to a genuine browse-only mode:

- The catalog is built during `vercel-build`, while the filesystem is still
  writable, and travels with the function via `outputFileTracingIncludes`.
- Search, filters, facet counts, fit scoring, and the calendar feed all work on
  real listings.
- All 14 mutating endpoints return `403` with an explanatory message, and the
  sidebar says so up front. Nothing fails silently.

To deploy: import the repository at [vercel.com/new](https://vercel.com/new) and
pick this branch. No environment variables and no database service are needed —
Vercel sets `VERCEL=1`, which is what triggers read-only mode. Or from a clone:

```bash
npx vercel --prod
```

Each deploy re-syncs, so the deployed catalog is as fresh as the deploy.

### A deployment that can actually save

Two options, depending on what you care about:

- **A host with a persistent disk** (Fly.io, Railway, a small VPS). Keeps the
  SQLite design intact — mount a volume, point `INTERNFINDER_DB` at it, and
  everything works, tracker included. Add auth, since the tracker would otherwise
  be public.
- **Swap SQLite for hosted Postgres** (Supabase, Neon). Then Vercel works fully,
  at the cost of your application data living on someone else's server. This is a
  real rewrite of `db.ts`, `query.ts`, and `repo.ts` — the queries use SQLite's
  synchronous API and FTS5 full-text search.

If you just want to check deadlines from your phone without either, run it locally
and expose it over Tailscale — no rewrite, no data leaving your machine.

## Notes

- **Requires Node 20.11+.** Behind a corporate proxy, run with `NODE_USE_ENV_PROXY=1`.
- The database lives at `data/internfinder.db` and is gitignored. Point it elsewhere with `INTERNFINDER_DB=/path/to.db`.
- `npm run db:reset -- --catalog --yes` clears listings but keeps your applications. Without `--catalog` it deletes everything, so it requires `--yes`.
- Adapters hit public, unauthenticated job-board APIs with a real User-Agent, per-host request serialization, and exponential backoff on 429s and 5xxs. If you add sources, keep it polite and check the site's terms.
- Listing data belongs to the employers and the sources it came from; this tool aggregates it for personal job-search use.
