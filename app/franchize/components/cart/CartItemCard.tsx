// app/franchize/components/cart/CartItemCard.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Bike } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import type { FranchizeCartLineVM } from "../../hooks/useFranchizeCartLines";
import { crewPaletteForSurface, withAlpha, interactionRingStyle } from "../../lib/theme";
import { SpecBadges } from "./SpecBadge";
import { QuantityControl } from "./QuantityControl";

interface CartItemCardProps {
  line: FranchizeCartLineVM;
  crew: FranchizeCrewVM;
  onDecreaseQty: (lineId: string) => void;
  onIncreaseQty: (lineId: string) => void;
  onDelete: (lineId: string) => void;
}

export function CartItemCard({ line, crew, onDecreaseQty, onIncreaseQty, onDelete }: CartItemCardProps) {
  const surface = crewPaletteForSurface(crew.theme);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const destructiveColor = crew.theme.mode === "dark" ? "#FF6B6B" : "#FF3B30";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border overflow-hidden"
      style={surface.card}
    >
      <div className="flex gap-4 p-4">
        {/* LEFT: Product image — 9:16 portrait (tall) */}
        <div
          className="relative w-24 h-[170px] shrink-0 rounded-lg overflow-hidden"
          style={{ backgroundColor: withAlpha(crew.theme.palette.borderSoft, 0.15) }}
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
              <Bike className="h-10 w-10" style={surface.mutedText} />
            </div>
          )}
          {/* Subtle glow border on image */}
          <div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              boxShadow: `inset 0 0 12px ${withAlpha(crew.theme.palette.accentMain, 0.15)}`,
            }}
          />
        </div>

        {/* RIGHT: Info */}
        <div className="flex-1 min-w-0">
          {/* Title row with delete button */}
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold truncate">
              {line.item?.title ?? "Позиция недоступна"}
            </h2>

            {/* Delete: icon + text, per megacart.png — inline confirm (NO alert!) */}
            {confirmDelete ? (
              <div className="flex items-center gap-1 shrink-0">
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
                  style={surface.mutedText}
                >
                  Нет
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                aria-label="Удалить товар"
                className="shrink-0 flex items-center gap-1 text-xs transition-colors"
                style={{ color: crew.theme.palette.textSecondary }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = interactionRingStyle(crew.theme).boxShadow;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = "";
                }}
              >
                Удалить
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Orphaned item warning */}
          {!line.item && (
            <p className="text-xs italic mt-1" style={{ color: "#FF9500" }}>
              Товар больше недоступен в каталоге
            </p>
          )}

          {/* Short description (muted) */}
          {line.item?.subtitle && (
            <p className="text-xs mt-0.5" style={surface.mutedText}>
              {line.item.subtitle}
            </p>
          )}

          {/* Rent/Buy badge — per megacart.png: Покупка is MUTED GRAY, Аренда uses accent */}
          <span
            className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={
              line.flowType === "sale"
                ? {
                    backgroundColor: withAlpha(crew.theme.palette.textSecondary, 0.15),
                    color: crew.theme.palette.textSecondary,
                  }
                : {
                    backgroundColor: withAlpha(crew.theme.palette.accentMain, 0.08),
                    color: crew.theme.palette.accentMain,
                  }
            }
          >
            {line.flowType === "sale" ? "Покупка" : "Аренда"}
          </span>

          {/* Spec badges row */}
          {line.item && <SpecBadges specs={line.item.rawSpecs} theme={crew.theme} />}

          {/* Price section — Buy price is THE BIGGEST text on the card + gold glow */}
          <div className="mt-2">
            {line.flowType === "sale" ? (
              // BUY flow: largest font on card + gold glow effect
              <>
                <p className="text-xs" style={surface.mutedText}>
                  Цена покупки
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{
                    color: crew.theme.palette.accentMain,
                    textShadow: `0 0 12px ${withAlpha(crew.theme.palette.accentMain, 0.45)}`,
                  }}
                >
                  {line.salePrice?.toLocaleString("ru-RU")} ₽
                </p>
              </>
            ) : (
              // RENT flow: per-day price + ВЫГОДНО badge
              <>
                <p className="text-xs" style={surface.mutedText}>
                  Цена за 1 день
                </p>
                <div className="flex items-center gap-2">
                  <AnimatePresence mode="popLayout">
                    <motion.p
                      key={`${line.lineId}-${line.qty}`}
                      className="text-xl font-bold"
                      initial={{ scale: 1.15, opacity: 0.6 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {line.item?.rentPriceLabel}
                    </motion.p>
                  </AnimatePresence>
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
                </div>
              </>
            )}
          </div>

          {/* Quantity controls — Rent ONLY (buy items always qty=1) */}
          {line.flowType === "rental" && (
            <QuantityControl
              qty={line.qty}
              onDecrease={() => onDecreaseQty(line.lineId)}
              onIncrease={() => onIncreaseQty(line.lineId)}
              borderColor={crew.theme.palette.borderSoft}
              accentColor={crew.theme.palette.accentMain}
            />
          )}
        </div>
      </div>
    </motion.article>
  );
}
