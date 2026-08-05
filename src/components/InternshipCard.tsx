'use client';

import { useState } from 'react';
import type { InternshipView } from '@/lib/types';
import { formatDate, formatPay, relativeTime, truncate } from '@/lib/util';
import { DeadlineBadge, ExternalIcon, FitBadge, StatusBadge } from './ui';

/**
 * One search result. Shows the facts a student decides on at a glance (term,
 * location, pay, eligibility, deadline) and keeps the two actions that matter
 * (apply, track) one click away.
 */
export function InternshipCard({
  listing,
  onTrack,
  onBookmark,
  onHide,
}: {
  listing: InternshipView;
  onTrack: (listing: InternshipView) => void;
  onBookmark: (listing: InternshipView) => void;
  onHide: (listing: InternshipView) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pay = formatPay(
    listing.salary_min,
    listing.salary_max,
    listing.salary_period,
    listing.salary_currency ?? 'USD',
  );

  const term =
    listing.season !== 'Unknown'
      ? `${listing.season}${listing.year ? ` ${listing.year}` : ''}`
      : listing.year
        ? String(listing.year)
        : null;

  const posted = listing.date_posted ?? listing.first_seen_at;

  return (
    <article className="card p-3.5 transition-colors" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[0.9375rem] leading-snug font-semibold">
              <a
                href={listing.apply_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:underline"
              >
                {listing.title}
              </a>
            </h3>
            {listing.fit ? (
              <FitBadge
                score={listing.fit.score}
                grade={listing.fit.grade}
                eligible={listing.fit.eligible}
              />
            ) : null}
          </div>

          <p className="mt-0.5 text-[0.8125rem]" style={{ color: 'var(--ink-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--ink-primary)' }}>
              {listing.company}
            </span>
            {listing.primary_location ? <> · {listing.primary_location}</> : null}
            {listing.locations.length > 1 ? (
              <span style={{ color: 'var(--ink-muted)' }}>
                {' '}
                +{listing.locations.length - 1} more
              </span>
            ) : null}
          </p>
        </div>

        {listing.application_status ? (
          <StatusBadge status={listing.application_status} small />
        ) : null}
      </div>

      {/* Facts row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {term ? <span className="chip">{term}</span> : null}
        {listing.program_type !== 'internship' ? (
          <span className="chip">{listing.program_type}</span>
        ) : null}
        <span className="chip">{listing.field}</span>
        {listing.location_type !== 'unknown' && listing.location_type !== 'onsite' ? (
          <span className="chip">{listing.location_type}</span>
        ) : null}
        {pay ? (
          <span className="chip" style={{ color: 'var(--good-text)' }}>
            {pay}
          </span>
        ) : listing.is_paid === 0 ? (
          <span className="chip">unpaid</span>
        ) : null}
        {listing.duration_weeks ? <span className="chip">{listing.duration_weeks} weeks</span> : null}
        {listing.gpa_min ? <span className="chip">GPA {listing.gpa_min.toFixed(1)}+</span> : null}
        {listing.requires_citizenship ? <span className="chip">US citizens only</span> : null}
        {listing.requires_clearance ? <span className="chip">clearance</span> : null}
        {listing.sponsorship === 'offers' ? (
          <span className="chip" style={{ color: 'var(--good-text)' }}>
            sponsors visas
          </span>
        ) : null}
        {listing.sponsorship === 'does-not-offer' ? (
          <span className="chip">no sponsorship</span>
        ) : null}
        <DeadlineBadge deadline={listing.deadline} />
      </div>

      {/* Why this matched, or why you may not qualify. */}
      {listing.fit && !listing.fit.eligible ? (
        <p
          className="mt-2.5 rounded-md px-2 py-1.5 text-[0.75rem]"
          style={{ background: 'var(--critical-soft)', color: 'var(--critical)' }}
        >
          <strong>May not be eligible:</strong> {listing.fit.blockers.join('; ')}
        </p>
      ) : null}

      {expanded ? (
        <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
          {listing.fit && listing.fit.reasons.length > 0 ? (
            <div>
              <p className="label">Why this match</p>
              <ul className="space-y-1">
                {listing.fit.reasons.map((reason) => (
                  <li key={reason.label} className="flex gap-1.5 text-[0.75rem]">
                    <span
                      aria-hidden
                      style={{
                        color:
                          reason.polarity === 'good'
                            ? 'var(--good-text)'
                            : reason.polarity === 'bad'
                              ? 'var(--critical)'
                              : 'var(--ink-muted)',
                      }}
                    >
                      {reason.polarity === 'good' ? '✓' : reason.polarity === 'bad' ? '✕' : '•'}
                    </span>
                    <span>
                      <strong style={{ fontWeight: 500 }}>{reason.label}</strong>
                      {': '}
                      <span style={{ color: 'var(--ink-secondary)' }}>{reason.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {listing.skills.length > 0 ? (
            <div>
              <p className="label">Skills mentioned</p>
              <div className="flex flex-wrap gap-1">
                {listing.skills.map((skill) => (
                  <span key={skill} className="chip">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {(listing.requires_cover_letter ||
            listing.requires_transcript ||
            listing.requires_portfolio) && (
            <div>
              <p className="label">Application asks for</p>
              <div className="flex flex-wrap gap-1">
                {listing.requires_cover_letter ? <span className="chip">cover letter</span> : null}
                {listing.requires_transcript ? <span className="chip">transcript</span> : null}
                {listing.requires_portfolio ? <span className="chip">portfolio</span> : null}
              </div>
            </div>
          )}

          {listing.description ? (
            <div>
              <p className="label">Description</p>
              <p
                className="text-[0.75rem] leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--ink-secondary)' }}
              >
                {truncate(listing.description, 1400)}
              </p>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.75rem] sm:grid-cols-3">
            <Detail label="Posted" value={formatDate(posted)} />
            <Detail label="Deadline" value={formatDate(listing.deadline)} />
            <Detail label="Starts" value={formatDate(listing.start_date)} />
            <Detail label="Degrees" value={listing.degrees.join(', ') || 'Not specified'} />
            <Detail label="Class years" value={listing.class_years.join(', ') || 'Not specified'} />
            <Detail label="Source" value={listing.source} />
          </dl>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <a
          href={listing.apply_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="btn btn-primary btn-sm"
        >
          Apply <ExternalIcon />
        </a>

        {listing.applied ? (
          <a href={`/tracker/${listing.application_id}`} className="btn btn-sm">
            Open in tracker
          </a>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => onTrack(listing)}>
            Track this
          </button>
        )}

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onBookmark(listing)}
          aria-pressed={listing.bookmarked}
        >
          {listing.bookmarked ? '★ Shortlisted' : '☆ Shortlist'}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Less' : 'Details'}
        </button>

        <span className="flex-1" />

        <span className="text-[0.6875rem]" style={{ color: 'var(--ink-muted)' }}>
          {relativeTime(posted)}
        </span>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onHide(listing)}
          title="Hide this listing from future searches"
          aria-label="Hide this listing"
        >
          ✕
        </button>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.625rem] tracking-wide uppercase" style={{ color: 'var(--ink-muted)' }}>
        {label}
      </dt>
      <dd className="truncate" title={value}>
        {value}
      </dd>
    </div>
  );
}
