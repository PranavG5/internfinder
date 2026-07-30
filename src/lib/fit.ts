import { extractSkills, skillOverlap } from './parse/skills';
import type { FitReason, FitResult, ProfileView } from './types';
import { clamp, daysUntil, toHourly } from './util';

/** Only the listing fields fit scoring actually reads. */
export interface FitCandidate {
  season: string;
  year: number | null;
  field: string;
  role_family: string;
  locations: string[];
  location_type: string;
  is_remote: number;
  primary_location: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  degrees: string[];
  class_years: string[];
  gpa_min: number | null;
  sponsorship: string;
  requires_citizenship: number;
  requires_clearance: number;
  skills: string[];
  is_paid: number | null;
  salary_min: number | null;
  salary_period: string | null;
  deadline: number | null;
  date_posted: number | null;
  start_date: number | null;
  quality: number;
}

interface Component {
  key: string;
  weight: number;
  /** 0..1, or null when the profile gives us nothing to compare against. */
  ratio: number | null;
  reason?: FitReason;
}

const UNDERGRAD_ORDER = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];

/**
 * Score how well a listing matches the student's profile.
 *
 * Weights only count when the profile has the relevant preference filled in,
 * so a sparse profile yields a fair score instead of penalizing everything.
 * Hard eligibility problems are surfaced as `blockers` rather than folded into
 * the number, because "you cannot apply" is different from "weak match".
 */
export function computeFit(listing: FitCandidate, profile: ProfileView | null): FitResult | null {
  if (!profile) return null;

  const reasons: FitReason[] = [];
  const blockers: string[] = [];
  const components: Component[] = [];

  // ---- Work authorization: the most common hard blocker. ----
  if (profile.work_auth) {
    const needsSponsorship = profile.work_auth === 'needs-sponsorship';
    if (needsSponsorship) {
      if (listing.requires_citizenship || listing.sponsorship === 'us-citizenship') {
        blockers.push('Requires U.S. citizenship');
      } else if (listing.sponsorship === 'does-not-offer') {
        blockers.push('Employer does not sponsor visas');
      } else if (listing.sponsorship === 'offers') {
        reasons.push({
          label: 'Sponsors visas',
          detail: 'This employer explicitly offers visa sponsorship.',
          weight: 15,
          polarity: 'good',
        });
        components.push({ key: 'auth', weight: 15, ratio: 1 });
      } else {
        components.push({ key: 'auth', weight: 15, ratio: 0.5 });
        reasons.push({
          label: 'Sponsorship unclear',
          detail: 'The posting does not say whether it sponsors visas — worth asking the recruiter.',
          weight: 15,
          polarity: 'neutral',
        });
      }
    } else {
      components.push({ key: 'auth', weight: 15, ratio: 1 });
    }
  }

  if (listing.requires_clearance && !profile.has_clearance) {
    blockers.push('Requires an active security clearance');
  }

  // ---- GPA ----
  if (listing.gpa_min != null) {
    if (profile.gpa != null) {
      if (profile.gpa + 0.001 < listing.gpa_min) {
        blockers.push(`Requires a ${listing.gpa_min.toFixed(2)} GPA (yours is ${profile.gpa.toFixed(2)})`);
      } else {
        reasons.push({
          label: 'GPA requirement met',
          detail: `Needs ${listing.gpa_min.toFixed(2)}, you have ${profile.gpa.toFixed(2)}.`,
          weight: 5,
          polarity: 'good',
        });
        components.push({ key: 'gpa', weight: 5, ratio: 1 });
      }
    } else {
      reasons.push({
        label: `Requires a ${listing.gpa_min.toFixed(2)} GPA`,
        detail: 'Add your GPA to your profile to check this automatically.',
        weight: 5,
        polarity: 'neutral',
      });
    }
  }

  // ---- Degree level ----
  if (profile.degree_level && listing.degrees.length > 0) {
    if (listing.degrees.includes(profile.degree_level)) {
      components.push({ key: 'degree', weight: 8, ratio: 1 });
      reasons.push({
        label: `Open to ${profile.degree_level} students`,
        detail: `Listed degrees: ${listing.degrees.join(', ')}.`,
        weight: 8,
        polarity: 'good',
      });
    } else {
      const gradOnly =
        listing.degrees.every((d) => d === 'PhD' || d === 'Masters' || d === 'MBA') &&
        profile.degree_level === 'Bachelors';
      if (gradOnly) {
        blockers.push(`Open to ${listing.degrees.join('/')} students only`);
      } else {
        components.push({ key: 'degree', weight: 8, ratio: 0.3 });
        reasons.push({
          label: 'Degree level mismatch',
          detail: `Posting targets ${listing.degrees.join(', ')}.`,
          weight: 8,
          polarity: 'bad',
        });
      }
    }
  }

  // ---- Class year ----
  if (profile.class_year && listing.class_years.length > 0) {
    if (listing.class_years.includes(profile.class_year)) {
      components.push({ key: 'classYear', weight: 8, ratio: 1 });
      reasons.push({
        label: `Targets ${profile.class_year}s`,
        detail: `Posting mentions ${listing.class_years.join(', ')}.`,
        weight: 8,
        polarity: 'good',
      });
    } else {
      // Adjacent years are usually still worth a shot.
      const mine = UNDERGRAD_ORDER.indexOf(profile.class_year);
      const distance = Math.min(
        ...listing.class_years.map((c) => Math.abs(UNDERGRAD_ORDER.indexOf(c) - mine)),
      );
      const ratio = distance <= 1 ? 0.6 : 0.2;
      components.push({ key: 'classYear', weight: 8, ratio });
      reasons.push({
        label: 'Class year mismatch',
        detail: `Posting mentions ${listing.class_years.join(', ')}; you are a ${profile.class_year}.`,
        weight: 8,
        polarity: distance <= 1 ? 'neutral' : 'bad',
      });
    }
  }

  // ---- Season ----
  const prefSeasons = profile.preferred_seasons;
  if (prefSeasons.length > 0) {
    if (prefSeasons.includes(listing.season)) {
      components.push({ key: 'season', weight: 18, ratio: 1 });
      reasons.push({
        label: `${listing.season} term`,
        detail: 'Matches a season you are targeting.',
        weight: 18,
        polarity: 'good',
      });
    } else if (listing.season === 'Unknown') {
      components.push({ key: 'season', weight: 18, ratio: 0.4 });
    } else {
      components.push({ key: 'season', weight: 18, ratio: 0 });
      reasons.push({
        label: `${listing.season} term`,
        detail: `You are targeting ${prefSeasons.join(', ')}.`,
        weight: 18,
        polarity: 'bad',
      });
    }
  }

  // ---- Year ----
  const prefYears = profile.preferred_years.map(Number).filter(Number.isFinite);
  if (prefYears.length > 0 && listing.year != null) {
    const ok = prefYears.includes(listing.year);
    components.push({ key: 'year', weight: 10, ratio: ok ? 1 : 0 });
    if (!ok) {
      reasons.push({
        label: `${listing.year} cycle`,
        detail: `You are targeting ${prefYears.join(', ')}.`,
        weight: 10,
        polarity: 'bad',
      });
    }
  }

  // ---- Field ----
  const prefFields = profile.preferred_fields;
  if (prefFields.length > 0) {
    if (prefFields.includes(listing.field)) {
      components.push({ key: 'field', weight: 20, ratio: 1 });
      reasons.push({
        label: listing.field,
        detail: 'Matches a field you are interested in.',
        weight: 20,
        polarity: 'good',
      });
    } else {
      components.push({ key: 'field', weight: 20, ratio: 0.15 });
      reasons.push({
        label: `${listing.field} role`,
        detail: `Outside your stated fields (${prefFields.slice(0, 3).join(', ')}).`,
        weight: 20,
        polarity: 'bad',
      });
    }
  }

  // ---- Location & work arrangement ----
  const locComponent = scoreLocation(listing, profile);
  if (locComponent) {
    components.push(locComponent);
    if (locComponent.reason) reasons.push(locComponent.reason);
  }

  // ---- Skills ----
  const profileSkills = resumeSkills(profile);
  if (profileSkills.length > 0 && listing.skills.length > 0) {
    const shared = skillOverlap(listing.skills, profileSkills);
    const ratio = clamp(shared.length / Math.min(5, listing.skills.length), 0, 1);
    components.push({ key: 'skills', weight: 16, ratio });
    if (shared.length > 0) {
      reasons.push({
        label: `${shared.length} matching skill${shared.length === 1 ? '' : 's'}`,
        detail: shared.slice(0, 6).join(', '),
        weight: 16,
        polarity: 'good',
      });
    } else {
      reasons.push({
        label: 'No overlapping skills detected',
        detail: `Posting asks for ${listing.skills.slice(0, 4).join(', ')}.`,
        weight: 16,
        polarity: 'bad',
      });
    }
  }

  // ---- Pay ----
  if (profile.paid_only && listing.is_paid === 0) {
    blockers.push('Unpaid, and you filtered to paid roles only');
  }
  if (profile.min_hourly != null && profile.min_hourly > 0) {
    const hourly = toHourly(listing.salary_min, listing.salary_period);
    if (hourly != null) {
      const ok = hourly >= profile.min_hourly;
      components.push({ key: 'pay', weight: 8, ratio: ok ? 1 : clamp(hourly / profile.min_hourly, 0, 1) });
      reasons.push({
        label: ok ? 'Pay meets your minimum' : 'Pay below your minimum',
        detail: `About $${hourly.toFixed(0)}/hr vs your $${profile.min_hourly.toFixed(0)}/hr floor.`,
        weight: 8,
        polarity: ok ? 'good' : 'bad',
      });
    }
  }

  // ---- Start date window ----
  if ((profile.earliest_start || profile.latest_start) && listing.start_date) {
    const tooEarly = profile.earliest_start != null && listing.start_date < profile.earliest_start;
    const tooLate = profile.latest_start != null && listing.start_date > profile.latest_start;
    const ok = !tooEarly && !tooLate;
    components.push({ key: 'start', weight: 8, ratio: ok ? 1 : 0.2 });
    if (!ok) {
      reasons.push({
        label: 'Start date outside your window',
        detail: tooEarly ? 'Starts before you are available.' : 'Starts after your latest start date.',
        weight: 8,
        polarity: 'bad',
      });
    }
  }

  // Weighted average over the components that actually applied.
  const applicable = components.filter((c) => c.ratio != null);
  const totalWeight = applicable.reduce((sum, c) => sum + c.weight, 0);
  let score =
    totalWeight > 0
      ? applicable.reduce((sum, c) => sum + c.weight * (c.ratio ?? 0), 0) / totalWeight
      : 0.5; // nothing to compare on — stay neutral

  // Small nudges: richer postings and urgent deadlines rise slightly.
  score = score * 0.94 + listing.quality * 0.06;

  const dl = daysUntil(listing.deadline);
  if (dl != null && dl >= 0 && dl <= 7) {
    reasons.push({
      label: dl === 0 ? 'Deadline is today' : `Deadline in ${dl} day${dl === 1 ? '' : 's'}`,
      detail: 'Apply soon — this closes shortly.',
      weight: 0,
      polarity: 'neutral',
    });
  }

  const final = Math.round(clamp(score, 0, 1) * 100);
  reasons.sort((a, b) => b.weight - a.weight);

  return {
    score: blockers.length > 0 ? Math.min(final, 35) : final,
    grade: final >= 80 ? 'excellent' : final >= 60 ? 'strong' : final >= 40 ? 'fair' : 'weak',
    eligible: blockers.length === 0,
    blockers,
    reasons: reasons.slice(0, 8),
  };
}

function scoreLocation(listing: FitCandidate, profile: ProfileView): Component | null {
  const prefLocations = profile.preferred_locations;
  const remotePref = profile.remote_pref;

  // Work-arrangement preference.
  let arrangementRatio: number | null = null;
  if (remotePref !== 'any') {
    if (listing.location_type === remotePref) arrangementRatio = 1;
    else if (listing.location_type === 'unknown') arrangementRatio = 0.5;
    else if (remotePref === 'remote') arrangementRatio = 0.1;
    else arrangementRatio = 0.4;
  }

  if (prefLocations.length === 0) {
    if (arrangementRatio == null) return null;
    return {
      key: 'location',
      weight: 12,
      ratio: arrangementRatio,
      reason:
        arrangementRatio < 0.5
          ? {
              label: `${cap(listing.location_type)} role`,
              detail: `You prefer ${remotePref}.`,
              weight: 12,
              polarity: 'bad',
            }
          : undefined,
    };
  }

  const haystack = [...listing.locations, listing.city, listing.region, listing.country]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase();
  const matched = prefLocations.find((p) => p && haystack.includes(p.toLowerCase().trim()));

  if (matched) {
    return {
      key: 'location',
      weight: 15,
      ratio: 1,
      reason: {
        label: `In ${matched}`,
        detail: 'One of your preferred locations.',
        weight: 15,
        polarity: 'good',
      },
    };
  }

  if (listing.is_remote) {
    return {
      key: 'location',
      weight: 15,
      ratio: 0.9,
      reason: {
        label: 'Remote',
        detail: 'Location-independent, so your city preference does not matter.',
        weight: 15,
        polarity: 'good',
      },
    };
  }

  // Not a preferred location: how bad depends on willingness to relocate.
  const ratio = profile.willing_to_relocate ? 0.45 : 0.05;
  return {
    key: 'location',
    weight: 15,
    ratio,
    reason: {
      label: listing.primary_location ?? 'Onsite role',
      detail: profile.willing_to_relocate
        ? 'Outside your preferred locations, but you are open to relocating.'
        : 'Outside your preferred locations and you are not relocating.',
      weight: 15,
      polarity: profile.willing_to_relocate ? 'neutral' : 'bad',
    },
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Skills the student claims, from the profile list plus resume text. */
export function resumeSkills(profile: ProfileView): string[] {
  const fromList = profile.skills ?? [];
  if (!profile.resume_text) return fromList;
  // Resume text is matched with the same vocabulary used on listings so the
  // two sides are directly comparable.
  return [...new Set([...fromList, ...extractSkills(profile.resume_text, 40)])];
}
