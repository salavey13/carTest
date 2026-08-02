"use client";

import { Wallet, ArrowDownCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * RentalDepositTracker
 * ──────────────────────────────────────────────────────────────────────────
 * Idea F from PRD: Deposit tracker.
 *
 * Shows deposit amount + status:
 *   - Active rental: "Депозит: 10 000 ₽ (получен при выдаче)"
 *   - Closed with depositReturned=true: "Депозит: 10 000 ₽ → возвращён ✓"
 *   - Closed with depositReturned=false: "Депозит: 10 000 ₽ → удержан"
 *
 * Data sources:
 *   - depositRub: rental_contract_artefacts.deposit_rub (or metadata.deposit_rub)
 *   - depositReturned: rentals.metadata.deposit_returned (from closure modal)
 *
 * Visibility:
 *   - Renders only when depositRub > 0
 *   - Otherwise returns null (no deposit to show)
 *
 * Style:
 *   - Compact card with icon + amount + status pill
 *   - Color-coded: green (returned), amber (held/active), red (withheld)
 */
interface RentalDepositTrackerProps {
  depositRub?: number | null;
  depositReturned?: boolean | null;
  status: string; // rental status: active | completed | cancelled | ...
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
}

type DepositState = "active" | "returned" | "withheld" | "unknown";

function getDepositState(
  status: string,
  depositReturned: boolean | null | undefined,
): DepositState {
  if (status === "completed" || status === "cancelled") {
    if (depositReturned === true) return "returned";
    if (depositReturned === false) return "withheld";
    return "unknown";
  }
  return "active";
}

const stateConfig: Record<DepositState, { color: string; bg: string; icon: typeof Wallet; label: string }> = {
  active: { color: "#f59e0b", bg: "#f59e0b20", icon: Wallet, label: "получен при выдаче" },
  returned: { color: "#22c55e", bg: "#22c55e20", icon: CheckCircle2, label: "возвращён ✓" },
  withheld: { color: "#ef4444", bg: "#ef444420", icon: AlertTriangle, label: "удержан (уточните у оператора)" },
  unknown: { color: "#6b7280", bg: "#6b728020", icon: ArrowDownCircle, label: "состояние неизвестно" },
};

export function RentalDepositTracker({
  depositRub,
  depositReturned,
  status,
  accentColor,
  textPrimary,
  textSecondary,
  borderSoft,
}: RentalDepositTrackerProps) {
  // Don't render if no deposit amount
  if (!depositRub || depositRub <= 0) return null;

  const state = getDepositState(status, depositReturned);
  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border p-3"
      style={{ borderColor: borderSoft, backgroundColor: config.bg }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${config.color}30`, color: config.color }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider opacity-60" style={{ color: textSecondary }}>
            Депозит
          </p>
          <p className="text-sm font-bold" style={{ color: textPrimary }}>
            {Number(depositRub).toLocaleString("ru-RU")} ₽
          </p>
        </div>
      </div>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{ backgroundColor: `${config.color}25`, color: config.color }}
      >
        {config.label}
      </span>
    </div>
  );
}
