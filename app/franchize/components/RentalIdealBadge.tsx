"use client";

import { Star, CheckCircle2 } from "lucide-react";

/**
 * RentalIdealBadge
 * ──────────────────────────────────────────────────────────────────────────
 * Idea A from PRD: "Идеальная аренда ⭐" badge.
 *
 * Shows a celebratory gold star badge when a rental meets ALL of:
 *   1. Contract verified ✓
 *   2. All return todos done ✓ (todosTotal > 0 && todosDone === todosTotal)
 *   3. Odometer captured ✓ (odometerAfter is non-null)
 *   4. Deposit returned ✓ (depositReturned === true)
 *   5. No damage OR damage level is "none"
 *
 * Props:
 *   - verified: contract verification status (boolean)
 *   - todosDone, todosTotal: progress from the checklist
 *   - odometerAfter: final odometer reading from closure
 *   - depositReturned: whether deposit was returned at closure
 *   - damageLevel: "none" | "light" | "heavy"
 *
 * Visibility:
 *   - Only renders when ALL criteria are met
 *   - Otherwise returns null (renders nothing)
 *
 * Style:
 *   - Animated gold gradient badge with star icon
 *   - Subtle pulse animation to draw the eye without being annoying
 *   - Theme-aware: uses accent color for the "completed" check icon
 */
interface RentalIdealBadgeProps {
  verified: boolean;
  todosDone: number;
  todosTotal: number;
  odometerAfter: number | null | undefined;
  depositReturned: boolean | null | undefined;
  damageLevel: "none" | "light" | "heavy" | null | undefined;
  accentColor?: string;
}

export function RentalIdealBadge({
  verified,
  todosDone,
  todosTotal,
  odometerAfter,
  depositReturned,
  damageLevel,
  accentColor = "#B8860B",
}: RentalIdealBadgeProps) {
  // All criteria must be met
  const allTodosDone = todosTotal > 0 && todosDone === todosTotal;
  const odometerCaptured = typeof odometerAfter === "number" && odometerAfter > 0;
  const depositOk = depositReturned === true;
  // damageLevel null/undefined = unknown, don't block the badge (could be a closed rental
  // from before damage_level was tracked). Only block if explicitly set to "light"/"heavy".
  const damageOk = damageLevel === "none" || damageLevel === null || damageLevel === undefined;
  const allCriteriaMet = verified && allTodosDone && odometerCaptured && depositOk && damageOk;

  if (!allCriteriaMet) return null;

  return (
    <div
      role="status"
      aria-label="Идеальная аренда — все этапы выполнены безупречно"
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold animate-[pulse_2.5s_ease-in-out_infinite] motion-reduce:animate-none"
      style={{
        background: "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)",
        color: "#1a1a1a",
        boxShadow: "0 4px 12px rgba(255, 215, 0, 0.4)",
        border: "1px solid rgba(255, 215, 0, 0.6)",
      }}
    >
      <Star className="h-3.5 w-3.5 fill-current" />
      <span>Идеальная аренда</span>
      <CheckCircle2 className="h-3.5 w-3.5" style={{ color: accentColor }} />
    </div>
  );
}
