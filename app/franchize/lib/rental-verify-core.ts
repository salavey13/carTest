// app/franchize/lib/rental-verify-core.ts
//
// Task 101 — RENTAL VERIFICATION, PURE HALF.
// Types + the transition state machine + message formatting. ZERO imports —
// unit-testable without dragging Supabase/Telegram/"use server" modules into
// the test graph. The server half (request/callback orchestration) lives in
// app/franchize/lib/rental-verify.ts and re-exports this surface.
//
// Task 106 — NEGOTIATION («дил»): «⚠️ Оспорить» is no longer a dead end.
// The disputant gets a game-like split editor (tap a part → ±50/±100 with a
// live preview → optional comment → send proposal), the other party answers
// ✅ Согласиться / ⚠️ Предложить своё / ❌ Отклонить. An accepted proposal
// VERIFIES the rental with the CORRECTED numbers (agreed split) — the
// corrected numbers then flow into the profile earnings, CSV and analytics.
// The whole negotiation lives in ONE jsonb column (rental_verifications
// .negotiation) so the SQL migration stays trivial and the feature degrades
// to the old plain dispute when the column is not applied yet.

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
  /**
   * Task 114: audit grade frozen with the numbers (task114: auto-audit at
   * request time; the Aug/Sep/Oct backfill carried the same shape from the
   * one-off audit script). Optional: rows created before task114 have none.
   */
  audit?: {
    grade: "fine" | "almost" | "sus";
    notes: string[];
    checked_at?: string;
    checker?: string;
  };
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

/**
 * The status line under the verification summary — shared by the first DM
 * (requestRentalVerification) and the drawer's «выслать сверку в Telegram»
 * resend (task 105), so both surfaces always describe the SAME state.
 * `labels` are pre-rendered @username strings (labelFromUsersMap).
 */
export function verificationStatusNote(params: {
  status: RentalVerificationStatus;
  singleParty: boolean;
  operatorLabel: string;
  ownerLabel: string;
}): string {
  const { status, singleParty, operatorLabel, ownerLabel } = params;
  const op = escapeVerifyHtml(operatorLabel);
  const own = escapeVerifyHtml(ownerLabel);
  if (status === "verified") {
    return "Аренда подтверждена обеими сторонами ✅ — в конце месяца разбирать уже не нужно.";
  }
  if (status === "disputed") {
    return "Расчёт оспорен — идёт ручной разбор. Закройте вопрос до конца месяца (владелец может подтвердить сверку вручную в аналитике).";
  }
  if (singleParty) {
    return "Подтвердите, что расчёт верный — после вашего ✅ аренда будет помечена как проверенная.";
  }
  if (status === "operator_confirmed") {
    return `Ждёт подтверждения: ${op} (оператор) уже за, осталось ${own} (владелец).`;
  }
  if (status === "owner_confirmed") {
    return `Ждёт подтверждения: ${own} (владелец) уже за, осталось ${op} (оператор).`;
  }
  return `Ждёт подтверждения: ${op} (оператор) и ${own} (владелец). После двух ✅ аренда помечается как проверенная.`;
}

// ── Negotiation («дил», task 106) — split editor ──────────────────────────────────
//
// A dispute used to be a terminal stop (manual reconciliation, owner-only
// admin ✅). Now the disputant gets an interactive split editor and the pair
// can settle the numbers right in the chat. Everything below is PURE: the
// server half (rental-verify.ts) does the DB/Telegram I/O.

/** The three operator-commission parts the verification summary shows. */
export interface SplitParts {
  base: number;
  equipment: number;
  overprice: number;
}

export type SplitPartKey = keyof SplitParts;

export const SPLIT_PART_META: Record<SplitPartKey, { label: string; icon: string }> = {
  base: { label: "техника", icon: "🏍" },
  equipment: { label: "экипировка", icon: "🧰" },
  overprice: { label: "наценка", icon: "📈" },
};

export const SPLIT_PART_ORDER: SplitPartKey[] = ["base", "equipment", "overprice"];

export interface InlineButton {
  text: string;
  callback_data: string;
}

/** One round in the negotiation history (capped — see ROUNDS_CAP). */
export interface NegotiationRound {
  action: "propose" | "counter" | "accept" | "decline";
  by: string;
  role: "operator" | "owner";
  at: string;
  split: SplitParts;
  comment?: string | null;
}

export interface OpenProposal {
  by: string;
  role: "operator" | "owner";
  at: string;
  split: SplitParts;
  comment?: string | null;
}

export interface NegotiationState {
  /** Split being edited right now (one editor at a time, last-write-wins). */
  draft?: { by: string; role: "operator" | "owner"; split: SplitParts; comment?: string | null } | null;
  /** A sent proposal awaiting the other party's answer. */
  open?: OpenProposal | null;
  /** Frozen at the moment a proposal was accepted — the corrected truth. */
  agreed?: { split: SplitParts; proposedBy: string; acceptedBy: string; at: string } | null;
  rounds?: NegotiationRound[];
}

export const ROUNDS_CAP = 20;

export function emptyNegotiation(): NegotiationState {
  return {};
}

/** Safe-parse the jsonb column — anything unexpected becomes an empty state. */
export function parseNegotiation(raw: unknown): NegotiationState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const state: NegotiationState = {};
  if (r.draft && typeof r.draft === "object") state.draft = r.draft as NegotiationState["draft"];
  if (r.open && typeof r.open === "object") state.open = r.open as OpenProposal;
  if (r.agreed && typeof r.agreed === "object") state.agreed = r.agreed as NonNullable<NegotiationState["agreed"]>;
  if (Array.isArray(r.rounds)) state.rounds = r.rounds as NegotiationRound[];
  return state;
}

export function snapshotSplitOf(snapshot: Partial<RentalVerificationSnapshot> | null | undefined): SplitParts {
  return {
    base: Math.max(0, Number(snapshot?.base) || 0),
    equipment: Math.max(0, Number(snapshot?.equipment) || 0),
    overprice: Math.max(0, Number(snapshot?.overprice) || 0),
  };
}

export function splitTotal(s: SplitParts): number {
  return (Number(s.base) || 0) + (Number(s.equipment) || 0) + (Number(s.overprice) || 0);
}

export function splitsEqual(a: SplitParts, b: SplitParts): boolean {
  return a.base === b.base && a.equipment === b.equipment && a.overprice === b.overprice;
}

/** Parts whose value differs from the frozen snapshot (what the proposal edits). */
export function splitChanges(vs: SplitParts, original: SplitParts): SplitPartKey[] {
  return SPLIT_PART_ORDER.filter((k) => vs[k] !== original[k]);
}

/** Clamp ≥0 — a correction can remove a part but never make it negative. */
export function applySplitDelta(split: SplitParts, part: SplitPartKey, delta: number): SplitParts {
  return { ...split, [part]: Math.max(0, (Number(split[part]) || 0) + delta) };
}

export function resetSplitPart(split: SplitParts, part: SplitPartKey, original: SplitParts): SplitParts {
  return { ...split, [part]: original[part] };
}

// ── Callback grammar (≤ 64 bytes, unique `vrfp_` prefix) ────────────────────
//   vrfp_v_<rentalId>           — open / return to the editor main view
//   vrfp_p<part>_<rentalId>     — open the part adjuster (part = b|e|o)
//   vrfp_a<part><op>_<rentalId> — apply delta (op = d1 −100, d2 −50, i1 +50, i2 +100, z reset)
//   vrfp_cm_<rentalId>          — comment input mode
//   vrfp_s_<rentalId>           — send the proposal to the other party
//   vrfp_x_<rentalId>           — «расчёт верный» — confirm right from the editor
//   vrfp_y_<rentalId>           — accept the open proposal
//   vrfp_n_<rentalId>           — decline the open proposal
//   vrfp_c_<rentalId>           — counter-proposal (open editor from the open one)

export type ProposalCallbackAction =
  | "view"
  | "part"
  | "adjust"
  | "comment"
  | "send"
  | "confirm"
  | "accept"
  | "decline"
  | "counter";

export interface ParsedProposalCallback {
  action: ProposalCallbackAction;
  part?: SplitPartKey;
  delta?: number;
  rentalId: string;
}

const PART_BY_CODE: Record<string, SplitPartKey> = { b: "base", e: "equipment", o: "overprice" };
const CODE_BY_PART: Record<SplitPartKey, string> = { base: "b", equipment: "e", overprice: "o" };
const DELTA_BY_OP: Record<string, number> = { d1: -100, d2: -50, i1: 50, i2: 100, z: 0 };

export function encodeProposalCallback(kind: "view" | "comment" | "send" | "confirm" | "accept" | "decline" | "counter", rentalId: string): string {
  const cmd = { view: "v", comment: "cm", send: "s", confirm: "x", accept: "y", decline: "n", counter: "c" }[kind];
  return `vrfp_${cmd}_${rentalId}`;
}

export function encodePartCallback(part: SplitPartKey, rentalId: string): string {
  return `vrfp_p${CODE_BY_PART[part]}_${rentalId}`;
}

export function encodeAdjustCallback(part: SplitPartKey, op: keyof typeof DELTA_BY_OP, rentalId: string): string {
  return `vrfp_a${CODE_BY_PART[part]}${op}_${rentalId}`;
}

/** Returns null for foreign data — the caller must fall through to other routers. */
export function parseProposalCallback(data: string): ParsedProposalCallback | null {
  const raw = String(data || "");
  if (!raw.startsWith("vrfp_")) return null;
  const body = raw.slice("vrfp_".length);
  const us = body.indexOf("_");
  if (us < 0) return null;
  const head = body.slice(0, us);
  const rentalId = body.slice(us + 1).trim();
  if (!rentalId || !head) return null;
  const cmd = head[0];
  if (cmd === "v") return { action: "view", rentalId };
  if (cmd === "p") {
    const part = PART_BY_CODE[head.slice(1)];
    return part ? { action: "part", part, rentalId } : null;
  }
  if (cmd === "a") {
    const part = PART_BY_CODE[head[1]];
    const delta = DELTA_BY_OP[head.slice(2)];
    if (!part || delta === undefined) return null;
    return { action: "adjust", part, delta, rentalId };
  }
  if (head === "cm") return { action: "comment", rentalId };
  if (head === "s") return { action: "send", rentalId };
  if (head === "x") return { action: "confirm", rentalId };
  if (head === "y") return { action: "accept", rentalId };
  if (head === "n") return { action: "decline", rentalId };
  if (head === "c") return { action: "counter", rentalId };
  return null;
}

// ── Negotiation reducers (pure) ──────────────────────────────────────────────

export function partyRole(state: { operator_chat_id?: string | null; owner_chat_id?: string | null }, chatId: string): "operator" | "owner" | null {
  if (state.operator_chat_id && String(state.operator_chat_id) === chatId) return "operator";
  if (state.owner_chat_id && String(state.owner_chat_id) === chatId) return "owner";
  return null;
}

/** Other negotiation party (null for single-party rows — no one to negotiate with). */
export function otherPartyChatId(row: { operator_chat_id?: string | null; owner_chat_id?: string | null }, chatId: string): string | null {
  const role = partyRole(row, chatId);
  if (role === "operator") {
    // operator === owner (the same human) → no second party
    return row.owner_chat_id && row.owner_chat_id !== row.operator_chat_id ? String(row.owner_chat_id) : null;
  }
  if (role === "owner") return row.operator_chat_id && row.operator_chat_id !== row.owner_chat_id ? String(row.operator_chat_id) : null;
  return null;
}

export function startDraft(nego: NegotiationState, chatId: string, role: "operator" | "owner", original: SplitParts, fromSplit?: SplitParts): NegotiationState {
  return {
    ...nego,
    draft: { by: chatId, role, split: fromSplit ? { ...fromSplit } : { ...original }, comment: nego.draft?.by === chatId ? nego.draft.comment : null },
  };
}

export function setDraftSplit(nego: NegotiationState, split: SplitParts): NegotiationState {
  if (!nego.draft) return nego;
  return { ...nego, draft: { ...nego.draft, split } };
}

export function setDraftComment(nego: NegotiationState, comment: string): NegotiationState {
  if (!nego.draft) return nego;
  return { ...nego, draft: { ...nego.draft, comment: comment.slice(0, 300) } };
}

export function clearDraft(nego: NegotiationState): NegotiationState {
  return { ...nego, draft: null };
}

export function pushRound(nego: NegotiationState, round: NegotiationRound): NegotiationState {
  const rounds = [...(nego.rounds || []), round].slice(-ROUNDS_CAP);
  return { ...nego, rounds };
}

/**
 * Send the current draft as a proposal to the other party.
 * Requires a draft with at least one changed part or a comment.
 */
export function sendProposalFromDraft(
  nego: NegotiationState,
  params: { chatId: string; role: "operator" | "owner"; nowIso: string; original: SplitParts },
): { state: NegotiationState; ok: boolean; error?: string } {
  const draft = nego.draft;
  if (!draft || draft.by !== params.chatId) {
    return { state: nego, ok: false, error: "Сначала откройте редактор и измените хотя бы одну часть расчёта." };
  }
  const changed = splitChanges(draft.split, params.original);
  if (changed.length === 0 && !(draft.comment || "").trim()) {
    return { state: nego, ok: false, error: "Изменений нет — поправьте хотя бы одну часть расчёта или добавьте комментарий." };
  }
  if (nego.open) {
    return { state: nego, ok: false, error: "Предложение уже отправлено и ждёт ответа второй стороны." };
  }
  const proposal: OpenProposal = {
    by: params.chatId,
    role: params.role,
    at: params.nowIso,
    split: { ...draft.split },
    comment: (draft.comment || "").trim() || null,
  };
  const round: NegotiationRound = {
    action: nego.rounds?.some((r) => r.action === "propose" || r.action === "counter") ? "counter" : "propose",
    by: params.chatId,
    role: params.role,
    at: params.nowIso,
    split: { ...draft.split },
    comment: proposal.comment,
  };
  return { state: pushRound({ ...clearDraft(nego), open: proposal }, round), ok: true };
}

/** The other party agrees → negotiation closes with the agreed numbers. */
export function acceptOpenProposal(
  nego: NegotiationState,
  params: { chatId: string; role: "operator" | "owner" },
): { state: NegotiationState; ok: boolean; error?: string } {
  const open = nego.open;
  if (!open) return { state: nego, ok: false, error: "Открытого предложения нет." };
  if (open.by === params.chatId) return { state: nego, ok: false, error: "Нельзя согласиться со своим предложением — дождитесь ответа второй стороны." };
  const accepted: NonNullable<NegotiationState["agreed"]> = {
    split: { ...open.split },
    proposedBy: open.by,
    acceptedBy: params.chatId,
    at: new Date().toISOString(),
  };
  const round: NegotiationRound = { action: "accept", by: params.chatId, role: params.role, at: accepted.at, split: { ...open.split }, comment: open.comment };
  return { state: pushRound({ ...nego, open: null, agreed: accepted }, round), ok: true };
}

/** The other party declines → back to a plain disputed row (manual talk). */
export function declineOpenProposal(
  nego: NegotiationState,
  params: { chatId: string; role: "operator" | "owner"; nowIso: string },
): { state: NegotiationState; ok: boolean; error?: string } {
  const open = nego.open;
  if (!open) return { state: nego, ok: false, error: "Открытого предложения нет." };
  if (open.by === params.chatId) return { state: nego, ok: false, error: "Своё предложение нельзя отклонить — дождитесь ответа второй стороны." };
  const round: NegotiationRound = { action: "decline", by: params.chatId, role: params.role, at: params.nowIso, split: { ...open.split }, comment: open.comment };
  return { state: pushRound({ ...nego, open: null }, round), ok: true };
}

// ── Negotiation keyboards ────────────────────────────────────────────────────

export function disputeEditorKeyboard(rentalId: string, draft: SplitParts, original: SplitParts): InlineButton[][] {
  const changed = new Set(splitChanges(draft, original));
  const partButton = (part: SplitPartKey): InlineButton => ({
    text: `${changed.has(part) ? "✏️" : ""}${SPLIT_PART_META[part].icon} ${SPLIT_PART_META[part].label}: ${formatRubVerify(draft[part])}`,
    callback_data: encodePartCallback(part, rentalId),
  });
  return [
    [partButton("base")],
    [partButton("equipment")],
    [partButton("overprice")],
    [
      { text: "✍️ Комментарий", callback_data: encodeProposalCallback("comment", rentalId) },
      { text: "📤 Отправить", callback_data: encodeProposalCallback("send", rentalId) },
    ],
    [{ text: "✅ Расчёт верный — подтвердить", callback_data: encodeProposalCallback("confirm", rentalId) }],
  ];
}

export function adjustPartKeyboard(part: SplitPartKey, rentalId: string): InlineButton[][] {
  return [
    [
      { text: "−100", callback_data: encodeAdjustCallback(part, "d1", rentalId) },
      { text: "−50", callback_data: encodeAdjustCallback(part, "d2", rentalId) },
      { text: "+50", callback_data: encodeAdjustCallback(part, "i1", rentalId) },
      { text: "+100", callback_data: encodeAdjustCallback(part, "i2", rentalId) },
    ],
    [
      { text: "↺ Сброс", callback_data: encodeAdjustCallback(part, "z", rentalId) },
      { text: "⬅️ К частям", callback_data: encodeProposalCallback("view", rentalId) },
    ],
    [{ text: "📤 Отправить предложение", callback_data: encodeProposalCallback("send", rentalId) }],
  ];
}

export function proposalResponseKeyboard(rentalId: string): InlineButton[][] {
  return [
    [
      { text: "✅ Согласиться", callback_data: encodeProposalCallback("accept", rentalId) },
      { text: "⚠️ Предложить своё", callback_data: encodeProposalCallback("counter", rentalId) },
    ],
    [{ text: "❌ Отклонить", callback_data: encodeProposalCallback("decline", rentalId) }],
  ];
}

// ── Negotiation formatters ───────────────────────────────────────────────────

/** Split line: «`🏍 техника: 500 ₽»` — shared by editor / proposal / done texts. */
function splitLine(part: SplitPartKey, value: number, prev?: number): string {
  const meta = SPLIT_PART_META[part];
  if (prev === undefined || prev === value) return `  ${meta.icon} ${meta.label}: ${formatRubVerify(value)}`;
  const diff = value - prev;
  const sign = diff > 0 ? "+" : "−";
  return `  ${meta.icon} ${meta.label}: ${formatRubVerify(prev)} → <b>${formatRubVerify(value)}</b> (${sign}${formatRubVerify(Math.abs(diff))})`;
}

export function formatDisputeEditor(params: {
  snapshot: Partial<RentalVerificationSnapshot>;
  draft: SplitParts;
  actorLabel: string;
  comment?: string | null;
  activePart?: SplitPartKey | null;
}): string {
  const original = snapshotSplitOf(params.snapshot);
  const d = params.draft;
  const lines: string[] = [
    `⚖️ <b>Редактор расчёта</b> — ${escapeVerifyHtml(params.snapshot.bikeName || "аренда")}`,
    `💵 Сумма аренды (клиент): ${formatRubVerify(Number(params.snapshot.totalCost) || 0)}`,
    ``,
    `📊 <b>Комиссия оператора: ${formatRubVerify(splitTotal(original))} → ${formatRubVerify(splitTotal(d))}</b>`,
  ];
  for (const part of SPLIT_PART_ORDER) lines.push(splitLine(part, d[part], original[part]));
  if (params.comment) lines.push(``, `✍️ Комментарий: ${escapeVerifyHtml(params.comment)}`);
  if (params.activePart) {
    lines.push(
      ``,
      `👉 ${SPLIT_PART_META[params.activePart].icon} <b>${SPLIT_PART_META[params.activePart].label}</b> — жмите кнопки, чтобы изменить сумму:`,
    );
  } else {
    lines.push(``, `👉 Тапайте часть расчёта, чтобы изменить её. Готовы — жмите «📤 Отправить».`);
  }
  return lines.join("\n");
}

export function formatProposalMessage(params: {
  snapshot: Partial<RentalVerificationSnapshot>;
  proposal: OpenProposal;
  proposerLabel: string;
  forChatId: string;
}): string {
  const original = snapshotSplitOf(params.snapshot);
  const p = params.proposal;
  const lines: string[] = [
    `⚖️ <b>Предложение по сверке</b> — ${escapeVerifyHtml(params.snapshot.bikeName || "аренда")}`,
    ``,
    `${escapeVerifyHtml(params.proposerLabel)} предлагает скорректировать расчёт:`,
    ``,
  ];
  for (const part of SPLIT_PART_ORDER) lines.push(splitLine(part, p.split[part], original[part]));
  lines.push(``, `📊 Итог оператору: ${formatRubVerify(splitTotal(original))} → <b>${formatRubVerify(splitTotal(p.split))}</b>`);
  if (p.comment) lines.push(``, `✍️ ${escapeVerifyHtml(p.comment)}`);
  lines.push(``, `Согласны — жмите ✅. Думаете иначе — «⚠️ Предложить своё».`);
  return lines.join("\n");
}

export function formatDealDoneText(params: {
  snapshot: Partial<RentalVerificationSnapshot>;
  agreedSplit: SplitParts;
  proposerLabel: string;
  acceptorLabel: string;
}): string {
  const original = snapshotSplitOf(params.snapshot);
  const a = params.agreedSplit;
  const lines: string[] = [
    `🤝 <b>Расчёт скорректирован и подтверждён</b>`,
    ``,
    `${escapeVerifyHtml(params.proposerLabel)} → ${escapeVerifyHtml(params.acceptorLabel)} договорились:`,
  ];
  for (const part of SPLIT_PART_ORDER) lines.push(splitLine(part, a[part], original[part]));
  lines.push(``, `📊 Итог оператору: ${formatRubVerify(splitTotal(a))} (было ${formatRubVerify(splitTotal(original))})`);
  lines.push(`Аренда помечена как <b>проверенная</b> ✅ с этими числами.`);
  return lines.join("\n");
}

// ── Month-end tally (pure) ───────────────────────────────────────────────────

export interface VerificationBrief {
  status: RentalVerificationStatus;
  operatorChatId: string | null;
  ownerChatId: string | null;
  /** Task 106: an open proposal is waiting for the other party's answer. */
  proposalOpen?: boolean;
  /** Task 106: agreed (corrected) split after an accepted proposal. */
  agreedSplit?: SplitParts | null;
  /** Task 114: audit grade + notes — WHY a row is almost/sus, for the drawer. */
  audit?: { grade?: string; notes?: string[] } | null;
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
