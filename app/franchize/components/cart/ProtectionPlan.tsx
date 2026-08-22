"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import { readablePaletteTextOnColor, withAlpha } from "../../lib/theme";
import { useResolvedPalette } from "../../lib/useResolvedPalette";

interface ProtectionPlanProps {
  crew: FranchizeCrewVM;
}

export function ProtectionPlan({ crew }: ProtectionPlanProps) {
  const palette = useResolvedPalette(crew.theme);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="flex items-center justify-between rounded-2xl border p-4"
      style={{
        backgroundColor: palette.bgCard,
        borderColor: palette.borderSoft,
        color: palette.textPrimary,
        boxShadow: `0 0 12px ${withAlpha(palette.accentMain, 0.08)}`,
      }}
    >
      <div className="flex items-center gap-3">
        <Shield
          className="h-6 w-6"
          style={{ color: palette.accentMain }}
        />
        <div>
          <p className="text-sm font-semibold">Полная защита включена</p>
          <p className="text-xs" style={{ color: palette.textSecondary }}>
            Кража, повреждения и техподдержка 24/7
          </p>
        </div>
      </div>
      <span
        className="rounded px-3 py-1 text-xs font-bold"
        style={{
          backgroundColor: palette.accentMain,
          color: readablePaletteTextOnColor(palette.accentMain, palette),
        }}
      >
        Включено
      </span>
    </motion.div>
  );
}
