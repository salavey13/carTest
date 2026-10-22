// /app/franchize/lib/commission-card-core.ts
//
// Task 126 — PURE core of the «Сверка комиссии» card: the transparent math
// lines + the status chip mapping. No runtime imports (type-only from
// rental-verify-core), client-safe, unit-testable
// (the card component itself imports server actions and is therefore
// source-guard tested, not imported in bun test).

import type {
  RentalVerificationStatus,
  SplitParts,
  VerificationCommissionBrief,
} from "@/app/franchize/lib/rental-verify-core";

export type CommissionCardStatus =
  | RentalVerificationStatus
  | "none";

export interface CommissionLine {
  label: string;
  /** Pre-formatted right-hand value (rubles, already grouped). */
  value: string;
  /** Small gray hint under the label (tier label, units, % note). */
  hint?: string;
  /** The bold «Комиссия» result line. */
  strong?: boolean;
}

/** Flat theme token bag — both surfaces (analytics ThemeTokens, rental page palette) feed it. */
export interface CommissionCardTheme {
  bg: string;
  bgCard: string;
  bgElevated: string;
  border: string;
  borderSoft: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
}

const rub = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
/** ru-RU grouped rubles; null/undefined render as «—» (honest absence). */
export const fmtRub = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(Number(v)) ? "—" : `${rub.format(Math.round(Number(v)))} ₽`;

/**
 * The transparent math lines, pure. When the formula block exists (task 117+)
 * every эталон component gets its own line; otherwise only the frozen
 * commission parts are shown (still honest — they are what the DM carried).
 */
export function buildCommissionLines(c: VerificationCommissionBrief): CommissionLine[] {
  const f = c.formula || null;
  const lines: CommissionLine[] = [];
  const clientTotal = f?.clientTotal ?? c.totalCost;
  if (clientTotal != null) {
    lines.push({ label: "Чек клиента", value: fmtRub(clientTotal) });
  }
  if (f && f.standardTotal != null) {
    lines.push({
      label: "Эталон: мото",
      value: fmtRub(f.bikeStandard ?? null),
      hint: [f.bikeTierLabel || null, f.fallback ? "нет тарифов — расчёт по чеку" : null]
        .filter(Boolean)
        .join(" · ") || undefined,
    });
    if (f.gearStandard != null && f.gearStandard > 0) {
      lines.push({
        label: `Эталон: экип${c.equipmentUnits ? ` (${c.equipmentUnits} ед.)` : ""}`,
        value: fmtRub(f.gearStandard),
      });
    }
    if ((f.markup ?? 0) > 0) {
      lines.push({
        label: "Наценка",
        value: fmtRub(f.markup ?? null),
        hint: f.overpricePercent != null ? `комиссия ${f.overpricePercent}% с наценки` : undefined,
      });
    }
  }
  // The result — the three frozen parts, digit-equal to the DM. Absent
  // parts render as «—» (honest absence): the snapshot never lies.
  const parts = [c.base, c.equipment, c.overprice].map((v) => fmtRub(v)).join(" + ");
  lines.push({
    label: "Комиссия оператора",
    value: `${parts} = ${fmtRub(c.total)}`,
    strong: true,
  });
  return lines;
}

/** Chip (label + colors) for the verification state, «none» included. */
export function commissionStatusMeta(
  status: CommissionCardStatus,
  opts?: { proposalOpen?: boolean; adjusted?: boolean },
): { label: string; color: string } {
  const GREEN = "#22c55e";
  const AMBER = "#f59e0b";
  const RED = "#ef4444";
  switch (status) {
    case "verified":
      return opts?.adjusted
        ? { label: "✅ сверена · скорректирована", color: GREEN }
        : { label: "✅ сверена", color: GREEN };
    case "operator_confirmed":
      return { label: "⏳ оператор за — ждёт владельца", color: AMBER };
    case "owner_confirmed":
      return { label: "⏳ владелец за — ждёт оператора", color: AMBER };
    case "disputed":
      return opts?.proposalOpen
        ? { label: "📤 предложение отправлено", color: "#f97316" }
        : { label: "⚠️ спор сверки", color: RED };
    case "pending":
      return { label: "⏳ сверка отправлена", color: AMBER };
    default:
      return { label: "➕ сверки ещё нет", color: "#6b7280" };
  }
}
