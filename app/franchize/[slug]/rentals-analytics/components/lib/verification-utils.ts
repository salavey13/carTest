// app/franchize/[slug]/rentals-analytics/components/lib/verification-utils.ts
//
// Task 103 — pure client-side helpers for the on-the-fly verification UI in
// the rentals analytics: the «🤝 Сверка» summary strip and the list quick
// filter. ZERO imports of server modules (client bundle safety); the status
// type mirrors AnalyticsRentalRow.verificationStatus (kept structural, so the
// helpers also work on DrawerRentalRow and in tests without dragging types in).

export type VerificationState =
  | "pending"
  | "operator_confirmed"
  | "owner_confirmed"
  | "verified"
  | "disputed";

/** Quick-filter buckets for the rentals list. */
export type VerificationListFilter = "all" | "waiting" | "disputed" | "verified";

const VERIFICATION_STATES: ReadonlySet<string> = new Set([
  "pending",
  "operator_confirmed",
  "owner_confirmed",
  "verified",
  "disputed",
]);

/**
 * True when the raw status string is one of the rental_verifications states.
 * Guards against a stale client bundle meeting a newer DB enum.
 */
export function isVerificationState(value: unknown): value is VerificationState {
  return typeof value === "string" && VERIFICATION_STATES.has(value);
}

/**
 * The «🤝 Сверка» strip numbers for a set of list rows.
 *   verified / disputed — straight counts;
 *   waiting             — pending + both single-sided confirms;
 *   hasAny              — at least one row carries verification data. The
 *                         strip stays hidden until then: crews whose rentals
 *                         all predate the feature (or whose SQL is not yet
 *                         applied) see no new UI at all.
 */
export function verificationStripData(
  rows: Array<{ verificationStatus?: VerificationState | string | null }>,
): { hasAny: boolean; verified: number; waiting: number; disputed: number } {
  let verified = 0;
  let waiting = 0;
  let disputed = 0;
  let hasAny = false;
  for (const row of rows) {
    const s = row.verificationStatus;
    if (!isVerificationState(s)) continue;
    hasAny = true;
    if (s === "verified") verified += 1;
    else if (s === "disputed") disputed += 1;
    else waiting += 1;
  }
  return { hasAny, verified, waiting, disputed };
}

/**
 * Applies the quick filter to list rows. Rows WITHOUT verification data are
 * only visible under «all» — the ⏳/⚠️ views must show exactly the set that
 * needs attention, nothing else (month-end: open the day, tap ⚠️, resolve).
 */
export function applyVerificationListFilter<T extends { verificationStatus?: VerificationState | string | null }>(
  rows: T[],
  filter: VerificationListFilter,
): T[] {
  if (filter === "all") return rows;
  return rows.filter((row) => {
    const s = row.verificationStatus;
    if (!isVerificationState(s)) return false;
    if (filter === "verified") return s === "verified";
    if (filter === "disputed") return s === "disputed";
    return s !== "verified" && s !== "disputed"; // waiting
  });
}
