"use client";

import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import { useCrewTokens } from "../../lib/use-crew-tokens";

interface EmptyCartStateProps {
  crew: FranchizeCrewVM;
  slug: string;
  onNavigateToCatalog: () => void;
}

export function EmptyCartState({ crew, slug, onNavigateToCatalog }: EmptyCartStateProps) {
  const T = useCrewTokens(crew.theme);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed p-8"
      style={T.styles.subtleCard}
    >
      <ShoppingCart
        className="h-16 w-16"
        style={{ color: T.textMuted }}
      />
      <h2 className="text-lg font-semibold" style={{ color: T.text }}>Корзина пуста</h2>
      <p className="text-sm" style={{ color: T.textMuted }}>
        Добавьте позицию из каталога, чтобы перейти к оформлению
      </p>
      <button
        onClick={onNavigateToCatalog}
        aria-label="Перейти к каталогу"
        className="rounded-xl border px-6 py-2.5 text-sm font-semibold transition hover:brightness-110"
        style={T.styles.ctaSecondary}
      >
        Перейти к каталогу
      </button>
    </motion.div>
  );
}