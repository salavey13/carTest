// app/franchize/lib/operator-attribution.ts
//
// iter20 — salary operator attribution. TASK158 (boss 2026-10-29) — the
// attribution is now a SPLIT, not a single winner:
//
// «lets make this column generated — it should contain automatically
// generated list of operators who were engaged somehow in rental: we have
// 3 other columns to base this list on: "Оператор создал", "Оператор
// выдал", "Оператор принял" … if all 3 are same everything goes to same
// dude, and in case columns contain several dudes - split equally … EDGE
// CASE: when rider created rental himself via web app then "Оператор
// создал" is empty - then split 1/2 between who handed out/in».
//
// THE RULE (per-ROLE weighting — each FILLED role carries an equal share of
// the commission, an operator holding several roles accumulates them):
//   создал A · выдал B · принял C   → A 1/3 · B 1/3 · C 1/3
//   создал A · выдал B · принял B   → A 1/3 · B 2/3
//   создал A · выдал A · принял A   → A 100%
//   создал —  · выдал B · принял C   → B 1/2 · C 1/2   (web self-order)
//   создал —  · выдал B · принял —   → B 100%
//   no role evidence at all         → the old shift cross-ref (100%).
//
// The old task157 single-operator override (metadata.salary_operator_override)
// is RETIRED — the generated role split IS the reassignment now (the three
// role dropdowns in the tableview edit the physical-fact roles, the money
// follows mechanically). The one override ever written (kawasaki 9 Oct,
// 685a9152) was migrated to the roles by task158.
//
// `resolveRentalOperatorSplit` is the canonical money math. The legacy
// `resolveRentalOperator` (single operator) survives for surfaces that need
// ONE face per rental (the verification DM operator party, the payout hub
// recipient) — it now means «the TOP shareholder» (largest fraction wins,
// ties break to the earliest role: создал → выдал → принял), so it can never
// disagree with the split.
//
// Sales (sale_contract_artifacts) keep the single-operator chain:
//   1. telegram_chat_id — the member whose bot session created the sale.
//   2. Shift covering created_at (same tie-breaks).
//
// Pure functions — zero Supabase deps — unit-tested in
// tests/franchize/iter20-suite.spec.ts + tests/franchize/task158-salary-split.spec.ts.

export interface ShiftLike {
  member_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
}

export type AttributionSource =
  | "doc_command"
  | "handout"
  | "return"
  | "shift"
  | "split"
  | "none";

export interface RentalAttributionInput {
  created_by_operator_chat_id?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface Attribution {
  operatorId: string | null;
  source: AttributionSource;
}

/** One engaged operator's slice of the rental commission. */
export interface OperatorShare {
  operatorId: string;
  /** Reduced fraction of the commission (n/d both ≤ 3 in practice). */
  fraction: { n: number; d: number };
  /** Which filled roles the operator holds (attribution-space labels). */
  roles: AttributionSource[];
}

/** ISO timestamp → epoch ms, null-safe (unparseable/missing → null). */
function toMs(iso: string | null | undefined): number | null {
  if (typeof iso !== "string" || iso.length === 0) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * The shift that covers `atMs`. Open shifts (clock_out_time NULL) count as
 * covering everything after clock_in. Tie-breaks:
 *   1. longest overlap with [atMs, atMs] (i.e. longest total shift covering
 *      the moment — a longer shift means the member was on the desk longer);
 *   2. earliest clock_in (deterministic across equal overlaps).
 */
export function pickShiftAt(
  shifts: ShiftLike[],
  atMs: number,
): ShiftLike | null {
  let best: ShiftLike | null = null;
  let bestDuration = -1;
  let bestIn = Infinity;
  for (const s of shifts) {
    const inMs = toMs(s.clock_in_time);
    if (inMs == null || inMs > atMs) continue;
    const outMs = s.clock_out_time == null ? null : toMs(s.clock_out_time);
    if (outMs != null && outMs < atMs) continue;
    // Overlap of the shift with the instant = the shift's own duration.
    const duration = outMs == null ? Number.MAX_SAFE_INTEGER : outMs - inMs;
    if (duration > bestDuration || (duration === bestDuration && inMs < bestIn)) {
      best = s;
      bestDuration = duration;
      bestIn = inMs;
    }
  }
  return best;
}

function stringFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const v = metadata?.[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** The three physical-fact role ids of a rental (trimmed; null = role empty). */
export interface RentalRoleIds {
  created: string | null;
  handedOut: string | null;
  received: string | null;
}

/**
 * Read the three role ids the generated «Оператор (ЗП)» list is built from:
 *   создал  → rentals.created_by_operator_chat_id (/doc operator, null for
 *             self-service web orders — the EDGE CASE),
 *   выдал   → metadata.pickup_freeze.frozen_by,
 *   принял  → metadata.return_confirmed_by.
 * Tolerates garbage the same way every other metadata reader here does.
 */
export function rentalRoleIds(rental: RentalAttributionInput): RentalRoleIds {
  const created =
    typeof rental.created_by_operator_chat_id === "string" &&
    rental.created_by_operator_chat_id.trim().length > 0
      ? rental.created_by_operator_chat_id.trim()
      : null;
  const md = rental.metadata ?? null;
  const freeze = md?.["pickup_freeze"];
  const handedOut =
    freeze && typeof freeze === "object"
      ? stringFromMetadata(freeze as Record<string, unknown>, "frozen_by")
      : null;
  const received = stringFromMetadata(md, "return_confirmed_by");
  return { created, handedOut, received };
}

/** Greatest common divisor (fractions stay reduced — 2/6 never prints). */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * TASK158 — the generated commission split. Filled roles share the
 * commission EQUALLY (weight = 1 / count of filled roles); an operator
 * holding several roles accumulates their weights (2 filled roles held by
 * one dude = 2/3). Order of shares = first appearance across
 * создал → выдал → принял (stable for the CSV cell + tests). No filled role
 * at all → the shift cross-ref covers the whole commission (the old last
 * resort), source "shift"; nothing anywhere → empty list.
 */
export function resolveRentalOperatorSplit(
  rental: RentalAttributionInput,
  shifts: ShiftLike[],
): { shares: OperatorShare[]; source: AttributionSource } {
  const roles = rentalRoleIds(rental);
  const filled: Array<{ operatorId: string; role: AttributionSource }> = [];
  if (roles.created) filled.push({ operatorId: roles.created, role: "doc_command" });
  if (roles.handedOut) filled.push({ operatorId: roles.handedOut, role: "handout" });
  if (roles.received) filled.push({ operatorId: roles.received, role: "return" });

  if (filled.length === 0) {
    const createdAt = toMs(rental.created_at);
    if (createdAt != null) {
      const shift = pickShiftAt(shifts, createdAt);
      if (shift) {
        return {
          shares: [{ operatorId: shift.member_id, fraction: { n: 1, d: 1 }, roles: ["shift"] }],
          source: "shift",
        };
      }
    }
    return { shares: [], source: "none" };
  }

  const d = filled.length;
  const byOperator = new Map<string, { count: number; roles: AttributionSource[] }>();
  for (const f of filled) {
    const existing = byOperator.get(f.operatorId);
    if (existing) {
      existing.count += 1;
      existing.roles.push(f.role);
    } else {
      byOperator.set(f.operatorId, { count: 1, roles: [f.role] });
    }
  }
  const shares: OperatorShare[] = [...byOperator.entries()].map(([operatorId, acc]) => {
    const g = gcd(acc.count, d);
    return { operatorId, fraction: { n: acc.count / g, d: d / g }, roles: acc.roles };
  });
  const source: AttributionSource = shares.length > 1 ? "split" : filled[0].role;
  return { shares, source };
}

/**
 * The TOP shareholder of the split — the single face a rental wears on
 * surfaces that address ONE operator (the сверка DM operator party, the
 * payout recipient, the legacy attribution consumers). Largest fraction
 * wins; ties break to the EARLIER role (создал beats выдал beats принял —
 * the first appearance order the Map keeps). Null when nobody is engaged.
 */
export function topShareOf(
  rental: RentalAttributionInput,
  shifts: ShiftLike[],
): Attribution {
  const { shares, source } = resolveRentalOperatorSplit(rental, shifts);
  if (shares.length === 0) return { operatorId: null, source: "none" };
  let best = shares[0];
  for (const s of shares) {
    if (s.fraction.n * best.fraction.d > best.fraction.n * s.fraction.d) best = s;
  }
  return { operatorId: best.operatorId, source: shares.length > 1 ? source : best.roles[0] };
}

/**
 * Legacy single-operator view — now EXACTLY the top shareholder of the
 * generated split (see topShareOf). Kept under the old name because a dozen
 * surfaces (verification heal, my-work, CSV/CSV-sections) still want one id;
 * the money math itself goes through resolveRentalOperatorSplit.
 */
export function resolveRentalOperator(
  rental: RentalAttributionInput,
  shifts: ShiftLike[],
): Attribution {
  return topShareOf(rental, shifts);
}

export interface SaleAttributionInput {
  /** Bot session chat id that created the sale artifact. */
  telegram_chat_id?: string | null;
  created_at?: string | null;
}

/**
 * Sale attribution: telegram_chat_id when it belongs to a known crew member
 * (caller passes the member ids — the buyer never lands here because sales
 * are created through the operator bot flow), else the shift cross-reference
 * at created_at.
 */
export function resolveSaleOperator(
  sale: SaleAttributionInput,
  memberIds: ReadonlySet<string>,
  shifts: ShiftLike[],
): Attribution {
  const tg =
    typeof sale.telegram_chat_id === "string" && sale.telegram_chat_id.trim().length > 0
      ? sale.telegram_chat_id.trim()
      : null;
  if (tg && memberIds.has(tg)) {
    return { operatorId: tg, source: "doc_command" };
  }
  const createdAt = toMs(sale.created_at);
  if (createdAt != null) {
    const shift = pickShiftAt(shifts, createdAt);
    if (shift) return { operatorId: shift.member_id, source: "shift" };
  }
  return { operatorId: null, source: "none" };
}

/** Human label for the attribution source (breakdown transparency). */
export const ATTRIBUTION_SOURCE_LABELS: Record<AttributionSource, string> = {
  doc_command: "/doc",
  handout: "выдача",
  return: "возврат",
  shift: "смена",
  split: "раздел ЗП",
  none: "—",
};
