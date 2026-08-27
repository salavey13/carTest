// /app/franchize/lib/deposit-state.ts
//
// Pure deposit-state machine for RentalDepositTracker.
//
// iter15: pending/confirmed rentals have NOT collected the deposit yet —
// the old label «получен при выдаче» on a pending rental read exactly like
// "deposit already taken care of" (kawasaki case: operator thought the
// deposit was already returned/settled while the rental wasn't even active).
// Split into its own "awaiting" state with an explicit label.

export type DepositState = "awaiting" | "active" | "returned" | "withheld" | "unknown";

export function getDepositState(
  status: string,
  depositReturned: boolean | null | undefined,
): DepositState {
  if (status === "pending_confirmation" || status === "confirmed") {
    return "awaiting";
  }
  if (status === "completed" || status === "cancelled") {
    if (depositReturned === true) return "returned";
    if (depositReturned === false) return "withheld";
    return "unknown";
  }
  return "active";
}

export const DEPOSIT_STATE_CONFIG: Record<
  DepositState,
  { color: string; bg: string; label: string }
> = {
  awaiting: { color: "#f59e0b", bg: "#f59e0b14", label: "не получен — внесите при выдаче" },
  active: { color: "#f59e0b", bg: "#f59e0b20", label: "получен при выдаче" },
  returned: { color: "#22c55e", bg: "#22c55e20", label: "возвращён ✓" },
  withheld: { color: "#ef4444", bg: "#ef444420", label: "удержан (уточните у оператора)" },
  unknown: { color: "#6b7280", bg: "#6b728020", label: "состояние неизвестно" },
};
