"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import { crewPaletteForSurface, readablePaletteTextOnColor, withAlpha } from "../../lib/theme";

interface ProtectionPlanProps {
  crew: FranchizeCrewVM;
}

export function ProtectionPlan({ crew }: ProtectionPlanProps) {
  const surface = crewPaletteForSurface(crew.theme);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="flex items-center justify-between rounded-2xl border p-4"
      style={{
        ...surface.card,
        boxShadow: `0 0 12px ${withAlpha(crew.theme.palette.accentMain, 0.08)}`,
      }}
    >
      <div className="flex items-center gap-3">
        <Shield
          className="h-6 w-6"
          style={{ color: crew.theme.palette.accentMain }}
        />
        <div>
          <p className="text-sm font-semibold">Полная защита включена</p>
          <p className="text-xs" style={surface.mutedText}>
            Кража, повреждения и техподдержка 24/7
          </p>
        </div>
      </div>
      <span
        className="rounded px-3 py-1 text-xs font-bold"
        style={{
          backgroundColor: crew.theme.palette.accentMain,
          color: readablePaletteTextOnColor(
            crew.theme.palette.accentMain,
            crew.theme.palette,
          ),
        }}
      >
        Включено
      </span>
    </motion.div>
  );
}