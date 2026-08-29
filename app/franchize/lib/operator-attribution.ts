// app/franchize/lib/operator-attribution.ts
//
// iter20 — salary operator attribution.
//
// PROBLEM: the salary breakdown credited rentals ONLY via
// rentals.created_by_operator_chat_id (set by the bot /doc flow). Every
// self-service web order has it NULL, so the operators' rental counts showed
// 0 even on days they personally handed out every bike.
//
// ATTRIBUTION CHAIN (most authoritative first, per rental):
//   1. created_by_operator_chat_id  — the operator who ran /doc (doc_command,
//      doc_command_recovery, claude_bot sources).
//   2. metadata.pickup_freeze.frozen_by — the operator who conducted the
//      HANDOUT of a web order (rental page "Фиксация выдачи"). This is the
//      person who physically worked with the client, so it beats the shift
//      cross-reference below (which is ambiguous when several members are on
//      shift at once).
//   3. metadata.return_confirmed_by — the operator who closed the rental
//      (last resort for rentals that were never picked up via the web flow).
//   4. Shift cross-reference — the crew member whose crew_member_shifts row
//      covers the rental's created_at. When several shifts overlap, the one
//      with the LONGEST overlap wins; ties break to the earliest clock_in
//      (deterministic).
//
// Sales (sale_contract_artifacts) use the same idea:
//   1. telegram_chat_id — the member whose bot session created the sale
//      (verified against the known member ids).
//   2. Shift covering created_at (same tie-breaks).
//
// Pure functions — zero Supabase deps — unit-tested in
// tests/franchize/iter20-suite.spec.ts.

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

/** Full rental attribution chain — see the module docblock. */
export function resolveRentalOperator(
  rental: RentalAttributionInput,
  shifts: ShiftLike[],
): Attribution {
  const direct =
    typeof rental.created_by_operator_chat_id === "string" &&
    rental.created_by_operator_chat_id.trim().length > 0
      ? rental.created_by_operator_chat_id.trim()
      : null;
  if (direct) return { operatorId: direct, source: "doc_command" };

  const md = rental.metadata ?? null;
  const freeze = md?.["pickup_freeze"];
  const frozenBy =
    freeze && typeof freeze === "object"
      ? stringFromMetadata(freeze as Record<string, unknown>, "frozen_by")
      : null;
  if (frozenBy) return { operatorId: frozenBy, source: "handout" };

  const returnBy = stringFromMetadata(md, "return_confirmed_by");
  if (returnBy) return { operatorId: returnBy, source: "return" };

  const createdAt = toMs(rental.created_at);
  if (createdAt != null) {
    const shift = pickShiftAt(shifts, createdAt);
    if (shift) return { operatorId: shift.member_id, source: "shift" };
  }
  return { operatorId: null, source: "none" };
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
  none: "—",
};
