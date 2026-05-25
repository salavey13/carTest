"use client";

import { motion } from "framer-motion";
import { Zap, Shield, Headphones } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";

interface TrustBadgesProps {
  crew: FranchizeCrewVM;
}

export function TrustBadges({ crew }: TrustBadgesProps) {
  const badges = [
    { Icon: Zap, label: "Быстрое оформление" },
    { Icon: Shield, label: "Без скрытых платежей" },
    { Icon: Headphones, label: "Поддержка 24/7" },
  ];

  return (
    <div className="flex justify-center gap-6 py-4">
      {badges.map((badge, i) => (
        <motion.div
          key={badge.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + i * 0.1 }}
          className="flex flex-col items-center gap-1"
        >
          <badge.Icon
            className="h-4 w-4"
            style={{ color: crew.theme.palette.accentMain }}
          />
          <span
            className="text-[11px] text-center"
            style={{ color: crew.theme.palette.textSecondary }}
          >
            {badge.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}