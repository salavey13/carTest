// app/franchize/lib/rental-verify-core.ts
//
// Task 101 — RENTAL VERIFICATION, PURE HALF.
// Types + the transition state machine + message formatting. ZERO imports —
// unit-testable without dragging Supabase/Telegram/"use server" modules into
// the test graph. The server half (request/callback orchestration) lives in
// app/franchize/lib/rental-verify.ts and re-exports this surface.

// ── Types ────────────────────────────────────────────────────────────────────

export type RentalVerificationStatus =
  | "pending"
  | "operator_confirmed"
  | "owner_confirmed"
  | "verified"
  | "disputed";

/** Compact ru labels for tables/lists/CSV. */
export const VERIFICATION_STATUS_LABELS: Record<RentalVerificationStatus, string> = {
  pending: "ожидает",
  operator_confirmed: "ждёт владельца",
  owner_confirmed: "ждёт оператора",
  verified: "подтверждено",
  disputed: "спор",
};

export interface RentalVerificationSnapshot {
  bikeName: string;
  rentalCategory: string;
  rentalCategoryLabel: string;
  totalCost: number;
  base: number;
  equipment: number;
  overprice: number;
  total: number;
  equipmentUnits: number;
  equipmentFlags: string;
  overpricePercent: number;
  depositReturned: boolean | null;
  damageNotes: string | null;
  returnNotes: string | null;
  penalty: { amount: number; destination: string; reason: string } | null;
  attribution: {
    source: string;
    createdByChatId: string | null;
    handedByChatId: string | null;
    returnedByChatId: string | null;
  };
  requestedAtIso: string;
}

export interface RentalVerificationRow {
  rental_id: string;
  crew_id: string | null;
  crew_slug: string | null;
  operator_chat_id: string | null;
  owner_chat_id: string | null;
  requested_by: string | null;
  requested_at: string;
  status: RentalVerificationStatus;
  operator_confirmed_at: string | null;
  owner_confirmed_at: string | null;
  verified_at: string | null;
  disputed_by: string | null;
  dispute_reason: string | null;
  snapshot: RentalVerificationSnapshot | Record<string, unknown>;
  source: string | null;
}

export type VerificationEffect =
  | "noop"
  | "wait_other_party"
  | "verified"
  | "disputed";

export interface ApplyActionResult {
  /** null → DB must NOT be written (no-op / error). */
  row: RentalVerificationRow | null;
  effect: VerificationEffect;
  /** Which side acted — for notifications. */
  actor: "operator" | "owner" | null;
  error?: string;
}

// ── State machine ────────────────────────────────────────────────────────────

/**
 * Transition rules (money-sensitive, deliberately conservative):
 *   • Only the two recorded parties may act.
 *   • «Оспорить» is available to both parties until VERIFIED and always wins —
 *     a doubt stops the verification (manual reconciliation follows; an owner
 *     can still final-verify via the admin ✅ after an offline talk).
 *   • When operator === owner (or operator is null), the owner's single
 *     confirm verifies immediately — there is no second human.
 *   • Re-confirming an already-confirmed side is a no-op (idempotent taps).
 */
export function applyVerificationAction(
  row: RentalVerificationRow,
  params: { action: "confirm" | "dispute"; chatId: string; nowIso: string; reason?: string },
): ApplyActionResult {
  const chatId = String(params.chatId);
  const isOperator = !!row.operator_chat_id && row.operator_chat_id === chatId;
  const isOwner = !!row.owner_chat_id && row.owner_chat_id === chatId;
  if (!isOperator && !isOwner) {
    return { row: null, effect: "noop", actor: null, error: "Вы не участник сверки по этой аренде." };
  }
  if (row.status === "verified") {
    return {
      row: null,
      effect: "noop",
      actor: isOperator ? "operator" : "owner",
      error: "Уже подтверждено обеими сторонами.",
    };
  }
  const actor: "operator" | "owner" = isOperator ? "operator" : "owner";

  if (params.action === "dispute") {
    return {
      row: {
        ...row,
        status: "disputed",
        disputed_by: chatId,
        dispute_reason: params.reason?.trim() || "требует ручного разбора",
      },
      effect: "disputed",
      actor,
    };
  }

  // Single-party verification: owner-only rental (operator absent or the same human).
  const singleParty = !row.operator_chat_id || row.operator_chat_id === row.owner_chat_id;

  if (actor === "owner") {
    const next: RentalVerificationRow = {
      ...row,
      owner_confirmed_at: row.owner_confirmed_at ?? params.nowIso,
    };
    if (singleParty) {
      return { row: { ...next, status: "verified", verified_at: params.nowIso }, effect: "verified", actor };
    }
    if (row.operator_confirmed_at) {
      return { row: { ...next, status: "verified", verified_at: params.nowIso }, effect: "verified", actor };
    }
    return { row: { ...next, status: "owner_confirmed" }, effect: "wait_other_party", actor };
  }

  // actor === operator
  const next: RentalVerificationRow = {
    ...row,
    operator_confirmed_at: row.operator_confirmed_at ?? params.nowIso,
  };
  // Single-party: operator === owner (the same human runs both roles) — his
  // one confirm is the whole agreement (reached here because isOperator wins
  // the actor check when the chat id matches both sides).
  if (singleParty) {
    return { row: { ...next, status: "verified", verified_at: params.nowIso }, effect: "verified", actor };
  }
  if (row.owner_confirmed_at) {
    return { row: { ...next, status: "verified", verified_at: params.nowIso }, effect: "verified", actor };
  }
  return { row: { ...next, status: "operator_confirmed" }, effect: "wait_other_party", actor };
}

// ── Message formatting ───────────────────────────────────────────────────────

/** Escapes untrusted strings for HTML parse-mode Telegram messages. */
export function escapeVerifyHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatRubVerify(n: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n))} ₽`;
}

/** Human label for a chat id: @username first (task100 lesson), id fallback. */
export function labelFromUsersMap(
  usersMap: Map<string, { username?: string | null; full_name?: string | null }>,
  chatId: string | null | undefined,
): string {
  if (!chatId) return "—";
  const u = usersMap.get(String(chatId));
  if (!u) return `id${chatId}`;
  const username = (u.username || "").trim();
  if (username) return `@${username}`;
  const fullName = (u.full_name || "").trim();
  return fullName || `id${chatId}`;
}

/**
 * Builds the HTML summary both parties receive. Same numbers as the profile
 * TL;DR rows (техника · экип · нац. split) — the operator recognizes the
 * format, the owner gets the audit trail (damage, penalty, deposit, notes).
 */
export function formatVerificationSummary(params: {
  crewName: string | null;
  snapshot: RentalVerificationSnapshot;
  usersMap: Map<string, { username?: string | null; full_name?: string | null }>;
  operatorChatId: string | null;
  ownerChatId: string | null;
  statusNote: string;
}): string {
  const { snapshot: s } = params;
  const bike = escapeVerifyHtml(s.bikeName || "байк");
  const lines: string[] = [
    `🤝 <b>Сверка аренды</b> — ${escapeVerifyHtml(params.crewName || "экипаж")}`,
    ``,
    `🛵 ${bike} · ${escapeVerifyHtml(s.rentalCategoryLabel)}`,
    `💵 Сумма аренды (клиент): <b>${formatRubVerify(s.totalCost)}</b>`,
    ``,
    `📊 <b>Комиссия оператора: ${formatRubVerify(s.total)}</b>`,
    `  • техника (${escapeVerifyHtml(s.rentalCategoryLabel)}): +${formatRubVerify(s.base)}`,
    s.equipment > 0
      ? `  • экипировка${s.equipmentFlags ? ` (${escapeVerifyHtml(s.equipmentFlags)})` : ""}: +${formatRubVerify(s.equipment)}`
      : `  • экипировка: нет`,
    s.overprice > 0
      ? `  • наценка (${s.overpricePercent}%): +${formatRubVerify(s.overprice)}`
      : `  • наценка: нет`,
  ];

  const attrs = [
    s.attribution.createdByChatId
      ? `создал ${escapeVerifyHtml(labelFromUsersMap(params.usersMap, s.attribution.createdByChatId))}`
      : "",
    s.attribution.handedByChatId
      ? `выдал ${escapeVerifyHtml(labelFromUsersMap(params.usersMap, s.attribution.handedByChatId))}`
      : "",
    s.attribution.returnedByChatId
      ? `принял ${escapeVerifyHtml(labelFromUsersMap(params.usersMap, s.attribution.returnedByChatId))}`
      : "",
  ].filter(Boolean);
  if (attrs.length) lines.push(``, `👥 ${attrs.join(" · ")}`);

  const flags: string[] = [];
  if (s.depositReturned === true) flags.push("💰 депозит: возвращён");
  if (s.depositReturned === false) flags.push("💰 депозит: удержан");
  if (s.penalty && s.penalty.amount > 0) {
    flags.push(
      `⚠️ штраф ${formatRubVerify(s.penalty.amount)} (${escapeVerifyHtml(s.penalty.destination)})${
        s.penalty.reason ? ` — ${escapeVerifyHtml(s.penalty.reason)}` : ""
      }`,
    );
  }
  if (s.damageNotes) flags.push(`🩹 ущерб: ${escapeVerifyHtml(s.damageNotes)}`);
  if (s.returnNotes) flags.push(`📝 комментарий: ${escapeVerifyHtml(s.returnNotes)}`);
  if (flags.length) lines.push(``, ...flags);

  lines.push(``, params.statusNote);
  return lines.join("\n");
}

/** Inline keyboard for the verification DM (callback_data ≤ 64 bytes: uuid fits). */
export function verificationKeyboard(rentalId: string): Array<Array<{ text: string; callback_data: string }>> {
  return [
    [
      { text: "✅ Подтверждаю", callback_data: `vrf_ok_${rentalId}` },
      { text: "⚠️ Оспорить", callback_data: `vrf_dis_${rentalId}` },
    ],
  ];
}

// ── Month-end tally (pure) ───────────────────────────────────────────────────

export interface VerificationBrief {
  status: RentalVerificationStatus;
  operatorChatId: string | null;
  ownerChatId: string | null;
}

/**
 * Month-end KPI: verification tally for a set of rentals.
 * «unknown» = no row (rentals closed before the feature, or the table is not
 * applied yet) — deliberately NOT counted as waiting.
 */
export function tallyVerificationStatuses(
  rentalIds: string[],
  statusMap: Map<string, VerificationBrief>,
): { verified: number; waiting: number; disputed: number; unknown: number } {
  let verified = 0;
  let waiting = 0;
  let disputed = 0;
  let unknown = 0;
  for (const id of rentalIds) {
    const brief = statusMap.get(String(id));
    if (!brief) {
      unknown += 1;
    } else if (brief.status === "verified") {
      verified += 1;
    } else if (brief.status === "disputed") {
      disputed += 1;
    } else {
      waiting += 1;
    }
  }
  return { verified, waiting, disputed, unknown };
}
