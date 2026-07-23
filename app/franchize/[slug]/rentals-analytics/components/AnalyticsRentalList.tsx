"use client";

// /analytics/components/AnalyticsRentalList.tsx
//
// Renders a vertical stack of rental cards (or service cards).
// AnimatePresence for smooth enter/exit. Used for both rentals and services tabs.

import { AnimatePresence, motion } from "framer-motion";
import type { ThemeTokens } from "../hooks/useTheme";
import type { AnalyticsRentalRow } from "./types";
import { AnalyticsRentalCard } from "./AnalyticsRentalCard";
import { AnalyticsServiceCard } from "./AnalyticsServiceCard";
import { isServiceRental } from "./lib/analytics-utils";

interface AnalyticsRentalListProps {
  rentals: AnalyticsRentalRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  T: ThemeTokens;
  variant?: "rentals" | "services";
  mechanicMap?: Record<string, string | null>;
}

export function AnalyticsRentalList({
  rentals,
  selectedId,
  onSelect,
  T,
  variant = "rentals",
  mechanicMap,
}: AnalyticsRentalListProps) {
  return (
    <div
      className="space-y-3"
      role="listbox"
      aria-label={variant === "services" ? "Список сервисных заказов" : "Список аренд"}
    >
      <AnimatePresence initial={false}>
        {rentals.map((rental) => {
          const selected = selectedId === rental.rental_id;
          const isService = isServiceRental(rental) || variant === "services";
          return (
            <motion.div
              key={rental.rental_id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              role="option"
              aria-selected={selected}
            >
              {isService ? (
                <AnalyticsServiceCard
                  rental={rental}
                  selected={selected}
                  onSelect={onSelect}
                  T={T}
                  mechanicName={
                    mechanicMap ? mechanicMap[rental.rental_id] ?? null : null
                  }
                />
              ) : (
                <AnalyticsRentalCard
                  rental={rental}
                  selected={selected}
                  onSelect={onSelect}
                  T={T}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
