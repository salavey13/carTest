"use client";

import { Wallet } from "lucide-react";

/**
 * RentalPrepaymentCard
 * ──────────────────────────────────────────────────────────────────────────
 * P2 PRD §1.5: prepayment tracking on the rental page.
 *
 * Shows prepayments/booking fees received against THIS rental
 * (cash_transactions.rental_id = rental, transaction_type = income_prepayment):
 *   «Предоплаты: 5 000 ₽ · 1 платёж — не в выручке дня»
 *
 * Data source: getFranchizeRentalCard → prepaymentTotal / prepaymentCount.
 *
 * Visibility:
 *   - Renders only when prepaymentCount > 0 (no noise for rentals that were
 *     paid in full at start).
 *
 * Style:
 *   - Matches RentalDepositTracker's compact card (icon + label + amount).
 *   - Amber accent: money reserved, not yet recognized as rental revenue.
 */
interface RentalPrepaymentCardProps {
  prepaymentTotal: number;
  prepaymentCount: number;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function RentalPrepaymentCard({
  prepaymentTotal,
  prepaymentCount,
  accentColor,
  textPrimary,
  textSecondary,
  borderSoft,
}: RentalPrepaymentCardProps) {
  if (!prepaymentCount || prepaymentCount <= 0) return null;

  const paymentsWord = pluralRu(prepaymentCount, "платёж", "платежа", "платежей");

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border p-3"
      style={{ borderColor: borderSoft, backgroundColor: `${accentColor}14` }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accentColor}30`, color: accentColor }}
        >
          <Wallet className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider opacity-60" style={{ color: textSecondary }}>
            Предоплаты
          </p>
          <p className="text-sm font-bold" style={{ color: textPrimary }}>
            {Number(prepaymentTotal).toLocaleString("ru-RU")} ₽
            <span className="ml-1.5 text-xs font-normal opacity-70" style={{ color: textSecondary }}>
              · {prepaymentCount} {paymentsWord}
            </span>
          </p>
        </div>
      </div>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
      >
        не в выручке дня
      </span>
    </div>
  );
}
