"use client";

// /analytics/components/AnalyticsRentalCard.tsx
//
// Rental card with bike title, renter ФИО (NOT phone), status badge, dates,
// cost, document completeness, handoff badge, and SLA countdown.
// 3px left edge stripe colored by status. Min 44px touch target.

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Clock, ArrowRight } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import type { AnalyticsRentalRow } from "./types";
import {
  computeDocStatus,
  computeSlaSignals,
  formatRubles,
  formatShortDate,
  getHandoffStatus,
  getRentalBikeTitle,
  getRenterName,
  getRentalStatusMeta,
} from "./lib/analytics-utils";

interface AnalyticsRentalCardProps {
  rental: AnalyticsRentalRow;
  selected: boolean;
  onSelect: (id: string) => void;
  T: ThemeTokens;
}

export function AnalyticsRentalCard({ rental, selected, onSelect, T }: AnalyticsRentalCardProps) {
  const statusMeta = getRentalStatusMeta(rental.status);
  const bikeTitle = getRentalBikeTitle(rental);
  const renterName = getRenterName(rental);
  const cost = Number(rental.total_cost) || 0;
  const docs = computeDocStatus(rental);
  const handoff = getHandoffStatus(rental);
  const sla = computeSlaSignals(rental);
  const returnSignal = sla.find((s) => s.key === "until_return" || s.key === "return_overdue");

  const startDate = rental.agreed_start_date || rental.requested_start_date;
  const endDate = rental.agreed_end_date || rental.requested_end_date;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(rental.rental_id)}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", damping: 24, stiffness: 320 }}
      aria-pressed={selected}
      aria-label={`Аренда: ${bikeTitle}, ${renterName}, ${statusMeta.label}`}
      className="relative w-full overflow-hidden rounded-2xl border p-3 pl-4 text-left transition focus:outline-none focus-visible:ring-2 md:p-4 md:pl-5"
      style={{
        borderColor: selected ? T.borderActive : T.border,
        backgroundColor: T.bgCard,
        cursor: "pointer",
        minHeight: "44px",
      }}
    >
      {/* Left status stripe */}
      <div
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: statusMeta.color }}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-bold md:text-base"
            style={{ color: T.text }}
          >
            {bikeTitle}
          </p>
          <p
            className="mt-0.5 truncate text-[11px] md:text-xs"
            style={{ color: T.textMuted }}
          >
            {renterName}
          </p>

          {/* Date range + cost + docs + handoff */}
          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] md:text-[11px]"
            style={{ color: T.textFaint }}
          >
            <span className="tabular-nums">
              {formatShortDate(startDate)} → {formatShortDate(endDate)}
            </span>
            <span className="font-semibold tabular-nums" style={{ color: T.text }}>
              {formatRubles(cost)}
            </span>
            <span
              className="inline-flex items-center gap-1"
              style={{
                color: docs.complete ? "#22c55e" : docs.count <= 1 ? "#ef4444" : "#f59e0b",
              }}
            >
              {docs.complete ? (
                <CheckCircle2 className="h-3 w-3" aria-hidden />
              ) : (
                <AlertCircle className="h-3 w-3" aria-hidden />
              )}
              {docs.count}/{docs.total}
            </span>
            <span
              className="inline-flex items-center gap-1"
              style={{
                color: handoff.done ? "#22c55e" : "#f59e0b",
              }}
            >
              {handoff.done ? "Передан" : handoff.label}
            </span>
          </div>

          {/* SLA countdown line */}
          {returnSignal && (
            <div
              className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${returnSignal.tone === "danger" ? "#ef4444" : returnSignal.tone === "warning" ? "#f59e0b" : "#22c55e"}15`,
                color: returnSignal.tone === "danger" ? "#ef4444" : returnSignal.tone === "warning" ? "#f59e0b" : "#22c55e",
              }}
            >
              <Clock className="h-3 w-3" aria-hidden />
              {returnSignal.key === "return_overdue"
                ? `Просрочен: ${returnSignal.value}`
                : `До возврата: ${returnSignal.value}`}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${statusMeta.color}15`,
              color: statusMeta.color,
            }}
          >
            {statusMeta.label}
          </span>
          {selected && (
            <ArrowRight
              className="h-4 w-4"
              style={{ color: T.textMuted }}
              aria-hidden
            />
          )}
        </div>
      </div>
    </motion.button>
  );
}
