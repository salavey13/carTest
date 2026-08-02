"use client";

import { Gauge, TrendingUp, AlertTriangle } from "lucide-react";

/**
 * RentalOdometerDelta
 * ──────────────────────────────────────────────────────────────────────────
 * Idea G from PRD: Odometer delta display.
 *
 * Shows odometer start → end + delta:
 *   "Пробег: 405 → 412 км (7 км за аренду)"
 *   "Пробег: 405 → 450 км (45 км — превышение 25 км × 30 ₽/км = 750 ₽)"
 *
 * Data sources:
 *   - odometerBefore: rentals.metadata.odometer_before (from pickup_freeze)
 *   - odometerAfter: rentals.metadata.odometer_after (from closure modal)
 *   - dailyLimitKm + overageRatePerKm: from metadata or contract (optional)
 *
 * Visibility:
 *   - Renders only when BOTH odometerBefore and odometerAfter are non-null numbers
 *   - Otherwise returns null
 *
 * Style:
 *   - Compact card with gauge icon
 *   - Highlight overage in red if there's a surcharge
 *   - Show "included km" context when limit is known
 */
interface RentalOdometerDeltaProps {
  odometerBefore?: number | null;
  odometerAfter?: number | null;
  /** Included km per rental (from contract or pricing tier). Optional. */
  includedKm?: number | null;
  /** Overage rate per km in rubles. Optional. */
  overageRatePerKm?: number | null;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
  accentColor: string;
}

export function RentalOdometerDelta({
  odometerBefore,
  odometerAfter,
  includedKm,
  overageRatePerKm,
  textPrimary,
  textSecondary,
  borderSoft,
  accentColor,
}: RentalOdometerDeltaProps) {
  // Require both readings
  const before = typeof odometerBefore === "number" ? odometerBefore : null;
  const after = typeof odometerAfter === "number" ? odometerAfter : null;

  if (before == null || after == null) return null;

  // Detect odometer rollback / data entry error — don't silently clamp to 0.
  // Show a red warning state instead so the operator notices and corrects.
  const rollbackDetected = after < before;
  const delta = Math.max(0, after - before);
  const hasOverage = includedKm != null && delta > includedKm;
  const overageKm = hasOverage ? delta - includedKm : 0;
  const overageCharge = hasOverage && overageRatePerKm ? overageKm * overageRatePerKm : 0;

  // Rollback warning state — short-circuit before normal render
  if (rollbackDetected) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-xl border p-3"
        style={{ borderColor: "#ef4444", backgroundColor: "#ef444410" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "#ef444420", color: "#ef4444" }}
          >
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider opacity-60" style={{ color: textSecondary }}>
              Пробег — некорректные данные
            </p>
            <p className="text-sm font-bold" style={{ color: textPrimary }}>
              {before.toLocaleString("ru-RU")} → {after.toLocaleString("ru-RU")} км
            </p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ backgroundColor: "#ef444420", color: "#ef4444" }}
        >
          одометр уменьшился
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border p-3"
      style={{ borderColor: borderSoft }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
        >
          <Gauge className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider opacity-60" style={{ color: textSecondary }}>
            Пробег за аренду
          </p>
          <p className="text-sm font-bold" style={{ color: textPrimary }}>
            {before.toLocaleString("ru-RU")} → {after.toLocaleString("ru-RU")} км
          </p>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{
            backgroundColor: hasOverage ? "#ef444420" : "#22c55e20",
            color: hasOverage ? "#ef4444" : "#22c55e",
          }}
        >
          {hasOverage ? <AlertTriangle className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          {delta.toLocaleString("ru-RU")} км
        </span>
        {hasOverage && (
          <p className="mt-1 text-[10px] opacity-70" style={{ color: textSecondary }}>
            Превышение: {overageKm} км
            {overageCharge > 0 ? ` × ${overageRatePerKm} ₽ = ${overageCharge.toLocaleString("ru-RU")} ₽` : ""}
          </p>
        )}
        {!hasOverage && includedKm != null && (
          <p className="mt-1 text-[10px] opacity-70" style={{ color: textSecondary }}>
            Включено: {includedKm} км
          </p>
        )}
      </div>
    </div>
  );
}
