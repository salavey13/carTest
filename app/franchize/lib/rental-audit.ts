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
