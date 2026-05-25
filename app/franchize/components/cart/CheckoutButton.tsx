"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import { readablePaletteTextOnColor, withAlpha } from "../../lib/theme";

interface CheckoutButtonProps {
  onClick: () => void;
  isLoading: boolean;
  label: string;
  crew: FranchizeCrewVM;
}

export function CheckoutButton({ onClick, isLoading, label, crew }: CheckoutButtonProps) {
  return (
    <motion.button
      whileHover={{
        scale: 1.01,
        boxShadow: `0 6px 24px ${withAlpha(crew.theme.palette.accentMain, 0.35)}`,
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={isLoading}
      aria-label="Перейти к оформлению"
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-bold transition-shadow disabled:opacity-70"
      style={{
        backgroundColor: crew.theme.palette.accentMain,
        color: readablePaletteTextOnColor(
          crew.theme.palette.accentMain,
          crew.theme.palette,
        ),
        boxShadow: `0 4px 12px ${withAlpha(crew.theme.palette.accentMain, 0.2)}`,
      }}
    >
      {isLoading ? "Сохранение..." : label}
      {!isLoading && <ArrowRight className="h-5 w-5" />}
    </motion.button>
  );
}