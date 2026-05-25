"use client";

import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";

interface EmptyCartStateProps {
  crew: FranchizeCrewVM;
  slug: string;
  onNavigateToCatalog: () => void;
}

export function EmptyCartState({ crew, slug, onNavigateToCatalog }: EmptyCartStateProps) {
  const surface = crewPaletteForSurface(crew.theme);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed p-8"
      style={surface.subtleCard}
    >
      <ShoppingCart
        className="h-16 w-16"
        style={{ color: crew.theme.palette.borderSoft }}
      />
      <h2 className="text-lg font-semibold">Корзина пуста</h2>
      <p className="text-sm" style={surface.mutedText}>
        Добавьте позицию из каталога, чтобы перейти к оформлению
      </p>
      <button
        onClick={onNavigateToCatalog}
        aria-label="Перейти к каталогу"
        className="rounded-xl border px-6 py-2.5 text-sm font-semibold transition hover:brightness-110"
        style={{
          borderColor: crew.theme.palette.accentMain,
          color: crew.theme.palette.accentMain,
        }}
      >
        Перейти к каталогу
      </button>
    </motion.div>
  );
}