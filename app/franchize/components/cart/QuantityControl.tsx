"use client";

import { motion, AnimatePresence } from "framer-motion";

interface QuantityControlProps {
  qty: number;
  onDecrease: () => void;
  onIncrease: () => void;
  borderColor: string;
  accentColor: string;
}

export function QuantityControl({ qty, onDecrease, onIncrease, borderColor, accentColor }: QuantityControlProps) {
  return (
    <div className="mt-3 flex items-center gap-3">
      {/* CIRCULAR buttons per megacart.png — not rounded rectangles */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        disabled={qty <= 1}
        aria-label="Уменьшить количество"
        className="h-9 w-9 rounded-full border text-lg transition-colors disabled:opacity-40 flex items-center justify-center"
        style={{ borderColor, color: accentColor }}
        onClick={onDecrease}
      >
        −
      </motion.button>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={qty}
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="text-sm font-medium w-6 text-center"
        >
          {qty}
        </motion.span>
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.9 }}
        aria-label="Увеличить количество"
        className="h-9 w-9 rounded-full border text-lg transition-colors flex items-center justify-center"
        style={{ borderColor, color: accentColor }}
        onClick={onIncrease}
      >
        +
      </motion.button>
    </div>
  );
}