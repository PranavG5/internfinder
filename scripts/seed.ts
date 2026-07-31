/**
 * Populate the tracker with realistic demo data so the dashboard, insights, and
 * calendar have something to show before you've applied anywhere.
 *
 *   npm run seed              # add demo applications
 *   npm run seed -- --clear   # remove them again
 *
 * Demo rows are tagged with origin='demo' so --clear can remove exactly what
 * this script created and nothing you added yourself.
 */
import { getDb, nowSec } from '../src/lib/db';
import { addEvent, createApplication, createChild, updateProfile } from '../src/lib/repo';
import { DAY } from '../src/lib/util';
import type { AppStatus } from '../src/lib/types';

const db = getDb();
const now = nowSec();
const ago = (days: number) => now - days * DAY;
const ahead = (days: number) => now + days * DAY;

/**
 * Profile only, no applications. Used by the read-only demo deploy so fit
 * scoring has something to score against — with an empty profile every listing
 * scores identically, which looks like signal but isn't.
 */
if (process.argv.includes('--profile-only')) {
  updateProfile({
    name: 'Example Student',
    school: 'State University',
    major: 'Computer Science',
    degree_level: 'Bachelors',
    class_year: 'Junior',
    grad_year: new Date().getFullYear() + 1,
    gpa: 3.6,
    work_auth: 'us-citizen',
    skills: ['Python', 'TypeScript', 'React', 'SQL', 'PostgreSQL', 'AWS', 'Docker', 'Git'],
    preferred_seasons: ['Summer'],
    preferred_years: [String(new Date().getFullYear() + 1)],
    preferred_fields: ['Software Engineering', 'AI & Machine Learning', 'Data & Analytics'],
    preferred_locations: ['New York', 'CA', 'Remote'],
    remote_pref: 'any',
    willing_to_relocate: 1,
    min_hourly: 30,
    weekly_goal: 5,
    onboarded: 1,
  });
  console.log('Seeded an example profile (no applications).');
  process.exit(0);
}

if (process.argv.includes('--clear')) {
  const removed = db.prepare("DELETE FROM applications WHERE origin = 'demo'").run().changes;
  console.log(`Removed ${removed} demo application(s). Your own entries were left alone.`);
  process.exit(0);
}

const already = (
  db.prepare("SELECT COUNT(*) AS n FROM applications WHERE origin = 'demo'").get() as { n: number }
).n;
if (already > 0) {
  console.log(`${already} demo application(s) already present. Run with --clear first to reseed.`);
  process.exit(0);
}

/** Link demo rows to real catalog listings when the catalog has been synced. */
function findListing(pattern: string): { id: string; company: string; title: string } | undefined {
  return db
    .prepare(
      `SELECT id, company, title FROM internships
       WHERE is_open = 1 AND duplicate_of IS NULL AND title LIKE ?
       ORDER BY quality DESC LIMIT 1`,
    )
    .get(`%${pattern}%`) as { id: string; company: string; title: string } | undefined;
}

interface Demo {
  company: string;
  role: string;
  status: AppStatus;
  field: string;
  season: string;
  year: number;
  location: string;
  priority: number;
  appliedDaysAgo?: number;
  deadlineInDays?: number;
  referral?: boolean;
  referrer?: string;
  rejectedStage?: string;
  match?: string;
  notes?: string;
  nextAction?: string;
}

const DEMOS: Demo[] = [
  {
    company: 'Stripe', role: 'Software Engineer Intern, Payments', status: 'interviewing',
    field: 'Software Engineering', season: 'Summer', year: 2026, location: 'Seattle, WA',
    priority: 5, appliedDaysAgo: 24, referral: true, referrer: 'Priya (alum, class of 24)',
    match: 'Software Engineer Intern',
    notes: 'Recruiter said the team works on the ledger service. Review idempotency + distributed txns.',
    nextAction: 'Prep system design round',
  },
  {
    company: 'Databricks', role: 'Machine Learning Engineer Intern', status: 'online_assessment',
    field: 'AI & Machine Learning', season: 'Summer', year: 2026, location: 'San Francisco, CA',
    priority: 5, appliedDaysAgo: 12, match: 'Machine Learning',
    nextAction: 'Finish the take-home by Friday',
  },
  {
    company: 'Jane Street', role: 'Quantitative Trading Intern', status: 'rejected',
    field: 'Quantitative Finance', season: 'Summer', year: 2026, location: 'New York, NY',
    priority: 4, appliedDaysAgo: 41, rejectedStage: 'online assessment',
    notes: 'Mental math section was the weak spot. Practise estimation and probability puzzles.',
  },
  {
    company: 'Figma', role: 'Product Design Intern', status: 'phone_screen',
    field: 'Design & UX', season: 'Summer', year: 2026, location: 'Remote',
    priority: 4, appliedDaysAgo: 9, nextAction: 'Send portfolio walkthrough deck',
  },
  {
    company: 'Cloudflare', role: 'Security Engineering Intern', status: 'applied',
    field: 'Cybersecurity', season: 'Summer', year: 2026, location: 'Austin, TX',
    priority: 3, appliedDaysAgo: 16,
  },
  {
    company: 'Duolingo', role: 'Data Science Intern', status: 'applied',
    field: 'Data & Analytics', season: 'Summer', year: 2026, location: 'Pittsburgh, PA',
    priority: 3, appliedDaysAgo: 34,
  },
  {
    company: 'Notion', role: 'Frontend Engineer Intern', status: 'ghosted',
    field: 'Software Engineering', season: 'Summer', year: 2026, location: 'San Francisco, CA',
    priority: 2, appliedDaysAgo: 58,
  },
  {
    company: 'Anduril', role: 'Embedded Software Intern', status: 'withdrawn',
    field: 'Software Engineering', season: 'Summer', year: 2026, location: 'Costa Mesa, CA',
    priority: 2, appliedDaysAgo: 30,
    notes: 'Withdrew — requires a clearance I do not have.',
  },
  {
    company: 'Ramp', role: 'Software Engineer Intern', status: 'offer',
    field: 'Software Engineering', season: 'Summer', year: 2026, location: 'New York, NY',
    priority: 5, appliedDaysAgo: 47, referral: true, referrer: 'Marcus (met at career fair)',
  },
  {
    company: 'Vercel', role: 'Developer Experience Intern', status: 'final_round',
    field: 'Software Engineering', season: 'Summer', year: 2026, location: 'Remote',
    priority: 4, appliedDaysAgo: 21, nextAction: 'Final round Thursday — prep questions for the team',
  },
  {
    company: 'Planet Labs', role: 'Aerospace Engineering Intern', status: 'interested',
    field: 'Mechanical & Aerospace', season: 'Fall', year: 2026, location: 'San Francisco, CA',
    priority: 3, deadlineInDays: 5,
    nextAction: 'Tailor resume — deadline is close',
  },
  {
    company: 'Recursion', role: 'Bioinformatics Intern', status: 'preparing',
    field: 'Healthcare & Life Sciences', season: 'Summer', year: 2026, location: 'Salt Lake City, UT',
    priority: 3, deadlineInDays: 12, nextAction: 'Ask Dr. Chen for a recommendation',
  },
  {
    company: 'Instacart', role: 'Product Management Intern', status: 'rejected',
    field: 'Product Management', season: 'Summer', year: 2026, location: 'Remote',
    priority: 3, appliedDaysAgo: 52, rejectedStage: 'resume screen',
  },
  {
    company: 'Samsara', role: 'Data Engineering Intern', status: 'accepted',
    field: 'Data & Analytics', season: 'Winter', year: 2026, location: 'Remote',
    priority: 4, appliedDaysAgo: 70,
    notes: 'Winter co-op — accepted. Starts January.',
  },
];

console.log('Seeding demo applications…');

let created = 0;
for (const demo of DEMOS) {
  const listing = demo.match ? findListing(demo.match) : undefined;

  const app = createApplication({
    company: demo.company,
    role: demo.role,
    // Link to a real catalog row when one is available, so the "open in tracker"
    // round-trip from search works in the demo too.
    internship_id: listing?.id ?? null,
    status: demo.status,
    field: demo.field,
    season: demo.season,
    year: demo.year,
    location: demo.location,
    priority: demo.priority,
    origin: 'demo',
    applied_at: demo.appliedDaysAgo != null ? ago(demo.appliedDaysAgo) : null,
    deadline: demo.deadlineInDays != null ? ahead(demo.deadlineInDays) : null,
    referral: demo.referral ? 1 : 0,
    referrer: demo.referrer ?? null,
    rejected_stage: demo.rejectedStage ?? null,
    notes: demo.notes ?? null,
    next_action: demo.nextAction ?? null,
    next_action_at: demo.nextAction ? ahead(Math.floor(Math.random() * 8) + 1) : null,
    resume_version: demo.field.includes('Software') ? 'swe-v3.pdf' : 'general-v2.pdf',
  });
  created++;

  // Backdate a plausible history so the funnel and median-response metrics
  // have something real to compute from.
  if (demo.appliedDaysAgo != null) {
    const appliedAt = ago(demo.appliedDaysAgo);
    addEvent({
      application_id: app.id,
      type: 'status_change',
      from_status: 'interested',
      to_status: 'applied',
      title: 'Interested → Submitted',
      occurred_at: appliedAt,
    });

    const responded = ['online_assessment', 'phone_screen', 'interviewing', 'final_round', 'offer', 'accepted', 'rejected'];
    if (responded.includes(demo.status)) {
      addEvent({
        application_id: app.id,
        type: 'status_change',
        from_status: 'applied',
        to_status: demo.status,
        title: `Submitted → ${demo.status.replace(/_/g, ' ')}`,
        occurred_at: appliedAt + Math.floor(Math.random() * 12 + 4) * DAY,
      });
    }
  }
}

// A couple of scheduled interviews so the calendar and ICS feed aren't empty.
const stripe = db.prepare("SELECT id FROM applications WHERE company = 'Stripe' AND origin = 'demo'").get() as
  | { id: number }
  | undefined;
if (stripe) {
  createChild('interviews', {
    application_id: stripe.id,
    round: 2,
    kind: 'system_design',
    scheduled_at: ahead(3) + 14 * 3600,
    duration_min: 60,
    location: 'Google Meet',
    interviewer: 'Dana R. (staff engineer)',
    prep_notes: 'Ledger design, idempotency keys, exactly-once semantics. Ask about on-call for interns.',
    outcome: 'pending',
  });
  createChild('contacts', {
    application_id: stripe.id,
    name: 'Priya Raman',
    company: 'Stripe',
    role: 'Software Engineer',
    relationship: 'alum',
    email: 'priya@example.com',
    notes: 'Referred me. Send a thank-you note after the final round either way.',
  });
  createChild('tasks', {
    application_id: stripe.id,
    title: 'Review distributed transactions',
    due_at: ahead(2),
  });
}

const vercel = db.prepare("SELECT id FROM applications WHERE company = 'Vercel' AND origin = 'demo'").get() as
  | { id: number }
  | undefined;
if (vercel) {
  createChild('interviews', {
    application_id: vercel.id,
    round: 3,
    kind: 'final',
    scheduled_at: ahead(6) + 16 * 3600,
    duration_min: 90,
    location: 'Zoom',
    interviewer: 'DX team panel',
    outcome: 'pending',
  });
}

// An offer, so the comparison table on Insights has data.
const ramp = db.prepare("SELECT id FROM applications WHERE company = 'Ramp' AND origin = 'demo'").get() as
  | { id: number }
  | undefined;
if (ramp) {
  createChild('offers', {
    application_id: ramp.id,
    pay_rate: 62,
    pay_period: 'hour',
    hours_per_week: 40,
    weeks: 12,
    housing_stipend: 6000,
    location: 'New York, NY',
    col_index: 128,
    respond_by: ahead(9),
    status: 'received',
    notes: 'Housing stipend paid up front. Team is Risk.',
  });
}

const samsara = db.prepare("SELECT id FROM applications WHERE company = 'Samsara' AND origin = 'demo'").get() as
  | { id: number }
  | undefined;
if (samsara) {
  createChild('offers', {
    application_id: samsara.id,
    pay_rate: 48,
    pay_period: 'hour',
    hours_per_week: 40,
    weeks: 16,
    location: 'Remote',
    col_index: 100,
    status: 'accepted',
    notes: 'Remote, so no relocation cost.',
  });
}

// A profile that makes fit scoring visibly meaningful.
updateProfile({
  name: 'Demo Student',
  school: 'State University',
  major: 'Computer Science',
  degree_level: 'Bachelors',
  class_year: 'Junior',
  grad_year: new Date().getFullYear() + 1,
  gpa: 3.6,
  work_auth: 'us-citizen',
  skills: ['Python', 'TypeScript', 'React', 'SQL', 'PostgreSQL', 'AWS', 'Docker', 'Git'],
  preferred_seasons: ['Summer'],
  preferred_years: [String(new Date().getFullYear() + 1)],
  preferred_fields: ['Software Engineering', 'AI & Machine Learning', 'Data & Analytics'],
  preferred_locations: ['New York', 'CA', 'Remote'],
  remote_pref: 'any',
  willing_to_relocate: 1,
  min_hourly: 30,
  weekly_goal: 5,
  onboarded: 1,
});

console.log(`Created ${created} demo applications, 2 interviews, 2 offers, 1 contact, 1 task.`);
console.log('Filled in a demo profile so fit scores are meaningful.');
console.log('\nRun `npm run seed -- --clear` to remove all of it.');
