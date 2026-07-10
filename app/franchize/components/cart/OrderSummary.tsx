"use client";

import { motion } from "framer-motion";
import type { FranchizeCrewVM } from "../../actions";
import type { FranchizeCartLineVM } from "../../hooks/useFranchizeCartLines";
import { crewPaletteForSurface, withAlpha } from "../../lib/theme";
import { DiscountBanner } from "./DiscountBanner";
import { Calendar } from "lucide-react";

interface OrderSummaryProps {
  cartLines: FranchizeCartLineVM[];
  subtotal: number;
  crew: FranchizeCrewVM;
}

export function OrderSummary({ cartLines, subtotal, crew }: OrderSummaryProps) {
  const surface = crewPaletteForSurface(crew.theme);
  const rentLines = cartLines.filter((l) => l.flowType === "rental");
  const buyLines = cartLines.filter((l) => l.flowType === "sale");

  // FIX: Was multiplying the per-day rate by the calendar day count,
  // which overcharged hour rentals. Now we read the actual line total
  // straight from the cart line, which `useFranchizeCartLines` already
  // computed via the shared hour-aware pricing calculator.
  const rentTotal = rentLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const buyTotal = buyLines.reduce((sum, l) => sum + (l.salePrice ?? 0), 0);
  // The grand total mirrors the `subtotal` prop that was passed in,
  // but we compute it locally too so this component is self-contained.
  const grandTotal = rentTotal + buyTotal;

  // Human-readable period string for the badge — concatenates each
  // line's period so a cart with "3 часа" and "1 день" shows
  // "3 часа + 1 день".
  const periodParts = rentLines
    .map((l) => l.rentalPeriod)
    .filter(Boolean) as string[];

  // Discount — franchise perk (TODO: wire to crew.catalog.discountPercent when available)
  // FIX: Ditched the 5% web-app discount banner. It was always-on regardless
  // of the user, so it devalued the promo-code flow and made the cart feel
  // like a permanent markdown. Now only explicit promo codes grant a discount.
  const discountPercent = 0;
  const discountAmount = 0;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="rounded-2xl border p-4"
      style={surface.card}
    >
      <p className="text-sm" style={surface.mutedText}>
        Итого позиций
      </p>
      <p className="text-2xl font-semibold">{cartLines.length}</p>

      {/* Per-line breakdown so the user can see the hour-aware math. */}
      {rentLines.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {rentLines.map((l) => (
            <div key={l.lineId} className="flex items-baseline justify-between gap-2 text-sm">
              <div className="min-w-0 flex-1 truncate" style={{ color: surface.text }}>
                {l.item?.title ?? "Позиция"}
                {l.qty > 1 && <span className="ml-1 opacity-60">× {l.qty}</span>}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold" style={{ color: surface.text }}>
                  {l.lineTotal.toLocaleString("ru-RU")} ₽
                </div>
                {l.rentalPeriod && (
                  <div className="text-[10px]" style={surface.mutedText}>
                    {l.rentalPeriod}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show buy subtotal only if there are sale lines */}
      {buyLines.length > 0 && (
        <>
          <p className="mt-3 text-sm" style={surface.mutedText}>
            Сумма покупки
          </p>
          <p className="text-lg font-semibold">
            {buyTotal.toLocaleString("ru-RU")} ₽
          </p>
        </>
      )}

      <div
        className="my-3 border-t"
        style={{ borderColor: crew.theme.palette.borderSoft }}
      />

      <p className="text-sm" style={surface.mutedText}>
        Сумма за весь период
      </p>
      {/* FIX: Was crew.theme.palette.accentMain (raw gold #D99A00) which is
          the brand accent and is hard to read as body text on a light card
          in light theme. Use the surface text color (guaranteed contrast)
          and accent-color the currency / period pill instead. */}
      <p
        className="text-2xl font-bold"
        style={{ color: surface.text || crew.theme.palette.textPrimary }}
      >
        {grandTotal.toLocaleString("ru-RU")} ₽
      </p>
      {rentLines.length > 0 && periodParts.length > 0 && (
        <span
          className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            backgroundColor: withAlpha(crew.theme.palette.accentMain, 0.1),
            border: `1px solid ${withAlpha(crew.theme.palette.accentMain, 0.2)}`,
            color: crew.theme.palette.accentMain,
          }}
        >
          <Calendar className="h-3 w-3" />
          {periodParts.join(" + ")}
        </span>
      )}

      <DiscountBanner percent={discountPercent} amount={discountAmount} />
    </motion.aside>
  );
}

/** Russian pluralization for days */
function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}