"use client";

// /analytics/components/AnalyticsSaleCard.tsx
//
// Sale card: bike title, buyer ФИО (NOT phone), price, contract status badge,
// created date. Simpler than rental card — no SLA, no docs, no handoff.

import { motion } from "framer-motion";
import { ArrowRight, Banknote } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import type { AnalyticsSaleRow } from "./types";
import {
  formatRubles,
  formatShortDate,
  getBuyerName,
  getSaleBikeTitle,
} from "./lib/analytics-utils";

interface AnalyticsSaleCardProps {
  sale: AnalyticsSaleRow;
  selected: boolean;
  onSelect: (id: string) => void;
  T: ThemeTokens;
}

export function AnalyticsSaleCard({ sale, selected, onSelect, T }: AnalyticsSaleCardProps) {
  const bikeTitle = getSaleBikeTitle(sale);
  const buyerName = getBuyerName(sale);
  const price = Number(sale.total_sum ?? sale.sale_price) || 0;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(sale.id)}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", damping: 24, stiffness: 320 }}
      aria-pressed={selected}
      aria-label={`Продажа: ${bikeTitle}, ${buyerName}, ${formatRubles(price)}`}
      className="relative w-full overflow-hidden rounded-2xl border p-3 pl-4 text-left transition focus:outline-none focus-visible:ring-2 md:p-4 md:pl-5"
      style={{
        borderColor: selected ? T.borderActive : T.border,
        backgroundColor: T.bgCard,
        cursor: "pointer",
        minHeight: "44px",
      }}
    >
      {/* Left stripe — sale accent color */}
      <div
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: "#f59e0b" }}
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
            {buyerName}
          </p>
          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] md:text-[11px]"
            style={{ color: T.textFaint }}
          >
            <span className="tabular-nums">
              {formatShortDate(sale.created_at)}
            </span>
            <span
              className="inline-flex items-center gap-1 font-semibold tabular-nums"
              style={{ color: "#22c55e" }}
            >
              <Banknote className="h-3 w-3" aria-hidden />
              {formatRubles(price)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: "#f59e0b15",
              color: "#f59e0b",
            }}
          >
            Продажа
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
