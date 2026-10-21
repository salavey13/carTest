// app/franchize/lib/rental-audit.ts
// Task 114 — canonical per-rental audit grade, computed at verification time.
//
// WHY: the Aug/Sep/Oct backfill (rental-verifications-backfill-aug-oct-2026-
// 10-18.sql) carried snapshot.audit = { grade, notes } from a one-off audit
// script, and bulkVerifyFineAction sweeps ONLY rows graded 'fine'. Rows
// created AFTER the backfill (every closure since 2026-10-18) had NO audit
// block — so the bulk fine-confirm gradually went blind as new months came
// in. This module ports the exact 8 checks of that script (C0–C8, same
// thresholds, same deposit-awareness) into the repo so EVERY new verification
// row is graded at request time and the «✅ fine за ГГГГ-ММ» button keeps
// working forever.
//
// Service records disguised as rentals (cars.type='service', e.g.
// «Уборка шланга (за метр)») and equipment docs are NOT bike rentals: the
// verification flow skips them entirely (no operator bonus — rental-verify.ts).
// The grader still handles them defensively (grade 'fine' + a note) so a
// stray row can never linger as a scary 'sus'.
//
// Pure module: no supabase / no server-only imports — unit-testable.

export type RentalAuditGrade = "fine" | "almost" | "sus";

export interface RentalAuditResult {
  grade: RentalAuditGrade;
  notes: string[];
}

export interface RentalAuditInput {
  status: string | null;
  totalCost: number | null;
  depositAmount: number | null;
  depositReturned: boolean | null;
  metadata: Record<string, unknown> | null;
  requestedStartDate?: string | null;
  requestedEndDate?: string | null;
  agreedStartDate?: string | null;
  agreedEndDate?: string | null;
  createdByOperatorChatId?: string | null;
  vehicleType?: string | null;
  isTestResult?: boolean | null;
  /** private.rental_contract_artifacts row (doc_command rentals only). */
  artifact?: { totalSum?: number | null; depositRub?: number | null } | null;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v) || 0);
const money = (v: number): string => `${v} ₽`;
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 0.01;

export function computeRentalAuditGrade(input: RentalAuditInput): RentalAuditResult {
  const meta = input.metadata || {};
  const notes: string[] = [];
  // Read through a widened local: the closures below mutate `grade`, and TS
  // narrowing can't see across calls (would flag "fine" vs "sus" as no overlap).
  let grade: RentalAuditGrade = "fine";
  const gradeNow = (): RentalAuditGrade => grade;
  const sus = (n: string) => {
    grade = "sus";
    notes.push(n);
  };
  const almost = (n: string) => {
    if (gradeNow() !== "sus") {
      grade = "almost";
      notes.push(n);
    }
  };

  // Service records / equipment docs are not bike rentals — the same class
  // the closure flow skips («no operator bonus — nothing to verify»).
  if (input.vehicleType === "service" || input.vehicleType === "equipment" || meta.item_type === "equipment") {
    return {
      grade: "fine",
      notes: ["документ услуги/экипировки — сверка аренды не требуется"],
    };
  }

  const total = num(input.totalCost);
  const isClosed = input.status === "completed" || input.status === "confirmed";
  const isCancelled = input.status === "cancelled";

  // C1 — metadata money coherence (bike_price + equipment_price == total).
  if (meta.bike_price != null) {
    const sum = num(meta.bike_price) + num(meta.equipment_price);
    if (!close(sum, total)) {
      sus(`metadata: bike_price+equipment (${money(sum)}) ≠ total_cost (${money(total)})`);
    }
  }

  // C2 — payment split, deposit-aware: web-order flow carries the deposit in
  // split.cash (bank = rent only); old /doc sometimes bakes it into cash too.
  if (meta.payment_split && typeof meta.payment_split === "object") {
    const ps = meta.payment_split as Record<string, unknown>;
    const sum = num(ps.bank) + num(ps.cash);
    const dep = num(input.depositAmount) || num(input.artifact?.depositRub);
    if (close(num(ps.bank), total) && num(ps.cash) > 0 && num(input.depositAmount) === 0) {
      almost(`депозит ${money(num(ps.cash))} проведён в payment_split.cash, но rentals.deposit_amount = 0`);
    }
    const coherent =
      close(sum, total) ||
      (dep > 0 && close(sum, total + dep)) ||
      (close(num(ps.bank), total) && (num(ps.cash) === 0 || close(num(ps.cash), dep)));
    if (!coherent) {
      sus(
        `payment_split (bank ${money(num(ps.bank))} + cash ${money(num(ps.cash))}) не сходится с total_cost ${money(total)} (депозит ${money(dep)}) — цену правили вручную?`,
      );
    }
  }

  // C3 — return fields on completed rentals.
  if (input.status === "completed") {
    if (!meta.return_confirmed_by && !meta.return_confirmed_at) {
      almost("completed без return_confirmed_by/at (закрыт вне страницы возврата?)");
    }
    if (meta.odometer_after == null) almost("completed без odometer_after");
  }

  // C4 — contract artifact for /doc rentals, deposit-aware: the OLD template
  // printed total_sum = rent + deposit; the new one = rent only.
  if (meta.source === "doc_command" && total > 0) {
    if (!input.artifact) {
      sus("doc_command: нет rental_contract_artifacts (договор не записан)");
    } else if (input.artifact.totalSum != null) {
      const paper = num(input.artifact.totalSum);
      const dep = num(input.depositAmount) || num(input.artifact.depositRub);
      const coherent = close(paper, total) || (dep > 0 && close(paper, total + dep));
      if (!coherent) {
        sus(`договор на бумаге ${money(paper)} против книг ${money(total)} (депозит ${money(dep)}) — расхождение бумага/учёт`);
      }
    }
  }

  // C5 — operator attribution on /doc rentals.
  if (meta.source === "doc_command" && !input.createdByOperatorChatId) {
    almost("doc_command без created_by_operator_chat_id — бонус оператора не атрибутирован");
  }

  // C6 — deposit returned on completed rentals.
  if (num(input.depositAmount) > 0 && isClosed && input.depositReturned == null && meta.deposit_returned == null) {
    almost("залог не помечен возвращённым");
  }

  // C0 — test rides: 69₽/100₽ tests are not real commission — cap at almost.
  if ((input.isTestResult === true || /тест/i.test(String(meta.renter_name || ""))) && gradeNow() !== "sus") {
    almost("тестовая аренда (is_test_result / «тест»)");
  }

  // C7 — dates.
  const startT = Date.parse(String(input.agreedStartDate || input.requestedStartDate || ""));
  const endT = Date.parse(String(input.agreedEndDate || input.requestedEndDate || ""));
  if (Number.isFinite(startT) && Number.isFinite(endT) && endT < startT) {
    sus("конец раньше начала");
  }

  // C8 — gift sanity: zero total needs an explicit manual-price mark.
  if (total === 0 && meta.price_overridden !== true) {
    almost("total_cost = 0 без явной отметки ручной цены");
  }

  if (isCancelled) {
    // Cancelled rentals never happened — informational, cannot be 'sus'.
    return { grade: gradeNow() === "sus" ? "almost" : grade, notes: notes.length ? notes : ["отменена — сверка не требуется"] };
  }

  return { grade, notes };
}

/** Shape stored into rental_verifications.snapshot.audit. */
export function buildAuditStamp(audit: RentalAuditResult, nowIso: string, checker: string) {
  return { ...audit, notes: [...audit.notes], checked_at: nowIso, checker };
}

// ── Task 123 — NO PROBLEMO: the reasonability layer over the audit ──────────
//
// Boss (2026-10-22): «if it looks super ok, then verification notification can
// be simpler — kinda details can be collapsed into spoiler; highlight such
// rentals as "no problemo" — that should increase speed of verification and
// overall enjoyment of the process».
//
// The audit grade (fine/almost/sus) already answers «do the books agree?».
// Reasonability adds the last-mile checks the audit never saw (penalty,
// damage notes) and converts the whole picture into ONE DM layout decision:
//
//   no_problemo → compact DM, the full расчёт collapses into a Telegram
//                 <blockquote expandable> (the native spoiler), headline
//                 «🟢 No problemo».
//   normal      → the task-117 rich layout, every line visible.
//
// Deliberately NOT a blocker (numbers are still internally consistent, the
// наценка is a computed+frozen part of the deal): markup > 0. A premium
// price is business as usual — the DM still spells it out, just inside the
// spoiler. Pure module, no I/O.

export type ReasonabilityMode = "no_problemo" | "normal";

export interface VerificationReasonability {
  mode: ReasonabilityMode;
  /** Calm «что именно проверено» lines for the collapsed DM headline. */
  checks: string[];
}

export interface ReasonabilityInput {
  audit: { grade: RentalAuditGrade; notes: string[] };
  /** What the client paid over the эталон (null when the formula is absent). */
  markup: number | null;
  total: number;
  penaltyAmount: number;
  damageNotes: string | null;
  depositReturned: boolean | null;
  depositAmount: number | null;
  /** The formula block is frozen (task 117+) — old rows degrade to normal. */
  hasFormula: boolean;
}

export function computeVerificationReasonability(input: ReasonabilityInput): VerificationReasonability {
  // ru-RU grouping (1 0 000 → «10 000») so the check line matches the way
  // every other сумма in the DM renders (the NBSP is intentional).
  const rubFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const fmtRub = (v: number): string => `${rubFmt.format(Math.round(v))} ₽`;
  const blockers: string[] = [];

  // The audit verdict is the backbone: any almost/sus note → normal layout.
  if (input.audit.grade !== "fine") blockers.push(...(input.audit.notes || []).slice(0, 2));
  if (Number(input.penaltyAmount) > 0) blockers.push("удержан штраф из залога");
  if (input.damageNotes && String(input.damageNotes).trim()) blockers.push("отмечен ущерб");
  if (!(Number(input.total) > 0)) blockers.push("нулевой или неизвестный чек");
  // Old rows (pre-task117) have no frozen formula — nothing to collapse.
  if (!input.hasFormula) blockers.push("нет замороженного расчёта (аренда до task117)");

  if (blockers.length > 0) {
    return { mode: "normal", checks: [] };
  }

  // The calm checklist — what the one-glance ✅ actually confirms.
  const checks: string[] = [];
  checks.push(`расчёт сошёлся с эталоном${Number(input.markup) > 0 ? ` (наценка ${fmtRub(Math.round(Number(input.markup)))} учтена в расчёте)` : " — без наценки"}`);
  if (input.depositReturned === true) checks.push("депозит возвращён");
  else if (Number(input.depositAmount) > 0) checks.push("депозит помечен возвращённым");
  else checks.push("депозит не собирался");
  checks.push("без ущерба и штрафов");

  return { mode: "no_problemo", checks };
}
