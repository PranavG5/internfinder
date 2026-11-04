/**
 * Marks a fetch result as incomplete.
 *
 * Delisting reconciliation treats "absent from this fetch" as "closed", which
 * is only true when the fetch read the whole source. A feed read under a page
 * cap or a request budget sees a different slice each run, and reconciling it
 * would close every listing outside today's slice. Adapters mark such results
 * partial; the sync still upserts them but skips reconciliation, and the
 * 21-day unseen sweep closes whatever genuinely disappeared.
 */
const PARTIAL = Symbol('partial-fetch');

type Marked = { [PARTIAL]?: true };

export function markPartial<T>(list: T[]): T[] {
  (list as T[] & Marked)[PARTIAL] = true;
  return list;
}

export function isPartial(list: readonly unknown[]): boolean {
  return (list as readonly unknown[] & Marked)[PARTIAL] === true;
}
