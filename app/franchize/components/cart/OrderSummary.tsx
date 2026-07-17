"use client";

import { motion } from "framer-motion";
import type { FranchizeCrewVM } from "../../actions";
import type { FranchizeCartLineVM } from "../../hooks/useFranchizeCartLines";
import { withAlpha } from "../../lib/theme";
import { useCrewTokens } from "../../lib/use-crew-tokens";
import { DiscountBanner } from "./DiscountBanner";
import { Calendar } from "lucide-react";

interface OrderSummaryProps {
  cartLines: FranchizeCartLineVM[];
  subtotal: number;
  crew: FranchizeCrewVM;
}

export function OrderSummary({ cartLines, subtotal, crew }: OrderSummaryProps) {
  const T = useCrewTokens(crew.theme);
  const rentLines = cartLines.filter((l) => l.flowType === "rental");
  const buyLines = cartLines.filter((l) => l.flowType === "sale");
  const serviceLines = cartLines.filter((l) => l.flowType === "service");

  const rentTotal = rentLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const buyTotal = buyLines.reduce((sum, l) => sum + (l.salePrice ?? 0), 0);
  const serviceTotal = serviceLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const grandTotal = rentTotal + buyTotal + serviceTotal;

  const periodParts = rentLines
    .map((l) => l.rentalPeriod)
    .filter(Boolean) as string[];

  const discountPercent = 0;
  const discountAmount = 0;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="rounded-2xl border p-4"
      style={T.styles.card}
    >
      <p className="text-sm" style={{ color: T.textMuted }}>
        Итого позиций
      </p>
      <p className="text-2xl font-semibold" style={{ color: T.text }}>{cartLines.length}</p>

      {/* Per-line breakdown */}
      {rentLines.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {rentLines.map((l) => (
            <div key={l.lineId} className="flex items-baseline justify-between gap-2 text-sm">
              <div className="min-w-0 flex-1 truncate" style={{ color: T.text }}>
                {l.item?.title ?? "Позиция"}
                {l.qty > 1 && <span className="ml-1 opacity-60">× {l.qty}</span>}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold" style={{ color: T.text }}>
                  {l.lineTotal.toLocaleString("ru-RU")} ₽
                </div>
                {l.rentalPeriod && (
                  <div className="text-[10px]" style={{ color: T.textMuted }}>
                    {l.rentalPeriod}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service lines breakdown */}
      {serviceLines.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {serviceLines.map((l) => (
            <div key={l.lineId} className="flex items-baseline justify-between gap-2 text-sm">
              <div className="min-w-0 flex-1 truncate" style={{ color: T.text }}>
                {l.item?.title ?? "Услуга"}
                {l.qty > 1 && <span className="ml-1 opacity-60">× {l.qty}</span>}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold" style={{ color: T.text }}>
                  {l.lineTotal.toLocaleString("ru-RU")} ₽
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show buy subtotal only if there are sale lines */}
      {buyLines.length > 0 && (
        <>
          <p className="mt-3 text-sm" style={{ color: T.textMuted }}>
            Сумма покупки
          </p>
          <p className="text-lg font-semibold" style={{ color: T.text }}>
            {buyTotal.toLocaleString("ru-RU")} ₽
          </p>
        </>
      )}

      <div
        className="my-3 border-t"
        style={{ borderColor: T.borderSoft }}
      />

      <p className="text-sm" style={{ color: T.textMuted }}>
        Сумма за весь период
      </p>
      <p
        className="text-2xl font-bold"
        style={{ color: T.text }}
      >
        {grandTotal.toLocaleString("ru-RU")} ₽
      </p>
      {rentLines.length > 0 && periodParts.length > 0 && (
        <span
          className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={T.styles.accentPill}
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