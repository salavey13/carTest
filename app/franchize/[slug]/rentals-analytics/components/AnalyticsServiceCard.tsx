"use client";

// /analytics/components/AnalyticsServiceCard.tsx
//
// Service card: service type, client ФИО, status badge, cost, assigned mechanic.
// Same shape as rental card but with service-specific styling (purple stripe).

import { motion } from "framer-motion";
import { Wrench, ArrowRight } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import type { AnalyticsRentalRow } from "./types";
import {
  formatRubles,
  formatShortDate,
  getRenterName,
  getRentalStatusMeta,
} from "./lib/analytics-utils";

interface AnalyticsServiceCardProps {
  rental: AnalyticsRentalRow;
  selected: boolean;
  onSelect: (id: string) => void;
  T: ThemeTokens;
  mechanicName?: string | null;
}

export function AnalyticsServiceCard({
  rental,
  selected,
  onSelect,
  T,
  mechanicName,
}: AnalyticsServiceCardProps) {
  const statusMeta = getRentalStatusMeta(rental.status);
  const clientName = getRenterName(rental);
  const cost = Number(rental.total_cost) || 0;

  // Service type from vehicle.make; model is usually a sub-detail
  const serviceType = rental.vehicle?.make || "Сервисная услуга";

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(rental.rental_id)}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", damping: 24, stiffness: 320 }}
      aria-pressed={selected}
      aria-label={`Сервис: ${serviceType}, ${clientName}, ${statusMeta.label}`}
      className="relative w-full overflow-hidden rounded-2xl border p-3 pl-4 text-left transition focus:outline-none focus-visible:ring-2 md:p-4 md:pl-5"
      style={{
        borderColor: selected ? T.borderActive : T.border,
        backgroundColor: T.bgCard,
        cursor: "pointer",
        minHeight: "44px",
      }}
    >
      {/* Left stripe — service accent (purple) */}
      <div
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: "#8b5cf6" }}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Wrench
              className="h-4 w-4 shrink-0"
              style={{ color: "#8b5cf6" }}
              aria-hidden
            />
            <p
              className="truncate text-sm font-bold md:text-base"
              style={{ color: T.text }}
            >
              {serviceType}
            </p>
          </div>
          <p
            className="mt-0.5 truncate text-[11px] md:text-xs"
            style={{ color: T.textMuted }}
          >
            {clientName}
          </p>
          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] md:text-[11px]"
            style={{ color: T.textFaint }}
          >
            <span className="tabular-nums">
              {formatShortDate(rental.agreed_start_date || rental.created_at)}
            </span>
            <span className="font-semibold tabular-nums" style={{ color: T.text }}>
              {formatRubles(cost)}
            </span>
            {mechanicName && (
              <span
                className="inline-flex items-center gap-1"
                style={{ color: T.textMuted }}
              >
                · {mechanicName}
              </span>
            )}
          </div>
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
