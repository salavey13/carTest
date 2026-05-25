"use client";

import { motion } from "framer-motion";
import { withAlpha } from "../../lib/theme";

interface DiscountBannerProps {
  percent: number;
  amount: number;
}

export function DiscountBanner({ percent, amount }: DiscountBannerProps) {
  if (percent <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-3 flex items-center justify-between rounded-lg border p-3 overflow-hidden relative"
      style={{
        backgroundColor: withAlpha("#00C853", 0.08),
        borderColor: withAlpha("#00C853", 0.25),
      }}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 pointer-events-none cart-shimmer" />
      <span className="text-sm font-medium relative" style={{ color: "#00C853" }}>
        У вас действует скидка {percent}%
      </span>
      <span className="text-base font-bold relative" style={{ color: "#00C853" }}>
        −{amount.toLocaleString("ru-RU")} ₽
      </span>
    </motion.div>
  );
}