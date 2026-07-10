// app/franchize/components/cart/CartItemCard.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Bike, Pencil, Calendar } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import type { FranchizeCartLineVM } from "../../hooks/useFranchizeCartLines";
import { withAlpha, interactionRingStyle } from "../../lib/theme";
import { useCrewTokens } from "../../lib/use-crew-tokens";
import { SpecBadges } from "./SpecBadge";
import { QuantityControl } from "./QuantityControl";

interface CartItemCardProps {
  line: FranchizeCartLineVM;
  crew: FranchizeCrewVM;
  onDecreaseQty: (lineId: string) => void;
  onIncreaseQty: (lineId: string) => void;
  onDelete: (lineId: string) => void;
  onEdit?: (lineId: string) => void;
}

export function CartItemCard({ line, crew, onDecreaseQty, onIncreaseQty, onDelete, onEdit }: CartItemCardProps) {
  const T = useCrewTokens(crew.theme);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const destructiveColor = T.isLight ? "#FF3B30" : "#FF6B6B";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border overflow-hidden"
      style={T.styles.card}
    >
      <div className="flex gap-4 p-4">
        {/* LEFT: Product image — 9:16 portrait (tall) */}
        <div
          className="relative w-24 h-[170px] shrink-0 rounded-lg overflow-hidden"
          style={{ backgroundColor: withAlpha(T.border, 0.15) }}
        >
          {line.item?.imageUrl ? (
            <Image
              src={line.item.imageUrl}
              alt={line.item?.title ?? "Товар"}
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Bike className="h-10 w-10" style={{ color: T.textMuted }} />
            </div>
          )}
          {/* Subtle glow border on image */}
          <div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              boxShadow: `inset 0 0 12px ${T.accentSoft}`,
            }}
          />
        </div>

        {/* RIGHT: Info */}
        <div className="flex-1 min-w-0">
          {/* Title row with edit button */}
          <div className="flex items-start justify-between gap-2 min-w-0">
            <h2 className="text-base font-semibold truncate min-w-0 flex-1" style={{ color: T.text }}>
              {line.item?.title ?? "Позиция недоступна"}
            </h2>

            {/* Edit button (optional) */}
            {onEdit && !confirmDelete && (
              <button
                onClick={() => onEdit(line.lineId)}
                aria-label="Изменить товар"
                className="shrink-0 flex items-center gap-1 text-xs mr-2 transition-colors"
                style={{ color: T.textMuted }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = interactionRingStyle(crew.theme).boxShadow;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Delete: separate line to prevent overflow during confirmation */}
          <div className="mt-1 flex items-center">
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px]" style={{ color: destructiveColor }}>
                  Удалить?
                </span>
                <button
                  onClick={() => {
                    onDelete(line.lineId);
                    setConfirmDelete(false);
                  }}
                  aria-label="Подтвердить удаление"
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: withAlpha(destructiveColor, 0.2),
                    color: destructiveColor,
                  }}
                >
                  Да
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  aria-label="Отменить удаление"
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{ color: T.textMuted }}
                >
                  Нет
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                aria-label="Удалить товар"
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: T.textMuted }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = interactionRingStyle(crew.theme).boxShadow;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Удалить</span>
              </button>
            )}
          </div>

          {/* Orphaned item warning — theme-aware */}
          {!line.item && (
            <p
              className="text-xs italic mt-1"
              style={{ color: T.isLight ? "#b45309" : "#FF9500" }}
            >
              Товар больше недоступен в каталоге
            </p>
          )}

          {/* Short description (muted) */}
          {line.item?.subtitle && (
            <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
              {line.item.subtitle}
            </p>
          )}

          {/* Rent/Buy badge — Покупка is MUTED GRAY, Аренда uses accent */}
          <span
            className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={
              line.flowType === "sale"
                ? {
                    backgroundColor: withAlpha(T.textMuted, 0.15),
                    color: T.textMuted,
                  }
                : T.styles.accentPill
            }
          >
            {line.flowType === "sale" ? "Покупка" : "Аренда"}
          </span>

          {/* Rental period (date + time) inline on the card */}
          {line.flowType === "rental" && line.options.rentStartDate && line.options.rentEndDate && (
            <p className="mt-1 text-[11px] font-medium" style={{ color: T.text }}>
              <Calendar className="inline h-3 w-3 mr-1 opacity-60" />
              {(() => {
                try {
                  const { formatRuDateFromISO } = require("@/app/franchize/lib/date-utils");
                  const startT = line.options.rentStartTime || "10:00";
                  const endT = line.options.rentEndTime || "10:00";
                  return `${formatRuDateFromISO(line.options.rentStartDate)} ${startT} → ${formatRuDateFromISO(line.options.rentEndDate)} ${endT}`;
                } catch {
                  return `${line.options.rentStartDate} → ${line.options.rentEndDate}`;
                }
              })()}
            </p>
          )}

          {/* Spec badges row */}
          {line.item && <SpecBadges specs={line.item.rawSpecs ?? {}} theme={crew.theme} />}

          {/* Price section */}
          <div className="mt-2">
            {line.flowType === "sale" ? (
              // BUY flow: largest font on card + glow in dark mode only
              <>
                <p className="text-xs" style={{ color: T.textMuted }}>
                  Цена покупки
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{
                    color: T.accent,
                    textShadow: T.isLight
                      ? "none"
                      : `0 0 12px ${withAlpha(T.accent, 0.45)}`,
                  }}
                >
                  {line.salePrice?.toLocaleString("ru-RU")} ₽
                </p>
              </>
            ) : (
              // RENT flow: dynamic price label (hour-aware) + line total
              <>
                <p className="text-xs" style={{ color: T.textMuted }}>
                  {line.pricePerDay === 0 && line.rentalPeriod
                    ? `Цена за ${line.rentalPeriod}`
                    : "Цена за 1 день"}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <AnimatePresence mode="popLayout">
                    <motion.p
                      key={`${line.lineId}-${line.qty}-${line.lineTotal}`}
                      className="text-xl font-bold"
                      initial={{ scale: 1.15, opacity: 0.6 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      style={{ color: T.text }}
                    >
                      {line.lineTotal.toLocaleString("ru-RU")} ₽
                    </motion.p>
                  </AnimatePresence>
                  {line.pricePerDay > 0 && line.rentalDays > 1 && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: withAlpha("#00C853", 0.2),
                        border: `1px solid ${withAlpha("#00C853", 0.3)}`,
                        color: "#00C853",
                      }}
                    >
                      ВЫГОДНО
                    </span>
                  )}
                </div>
                {/* For hour rentals, show the per-day reference */}
                {line.pricePerDay === 0 && line.item?.rentPriceLabel && (
                  <p className="mt-0.5 text-[10px]" style={{ color: T.textMuted }}>
                    базовый тариф {line.item.rentPriceLabel}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Quantity controls — Rent ONLY (buy items always qty=1) */}
          {line.flowType === "rental" && (
            <QuantityControl
              qty={line.qty}
              onDecrease={() => onDecreaseQty(line.lineId)}
              onIncrease={() => onIncreaseQty(line.lineId)}
              borderColor={T.borderSoft}
              accentColor={T.accent}
            />
          )}
        </div>
      </div>
    </motion.article>
  );
}
