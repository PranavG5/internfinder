'use client';

import { useState } from 'react';

/**
 * Copies the ICS feed URL. Subscribing (rather than downloading) means the
 * calendar keeps updating as deadlines and interviews change.
 */
export function CalendarCopyLink() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/api/calendar`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard can be blocked; opening the feed still lets the user grab it.
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={copy}>
        {copied ? '✓ Link copied' : 'Copy calendar feed URL'}
      </button>
      <a className="btn btn-sm" href="/api/calendar" download="internfinder.ics">
        Download .ics
      </a>
    </>
  );
}
