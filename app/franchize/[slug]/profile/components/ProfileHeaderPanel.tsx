"use client";

// ProfileHeaderPanel — «Профиль райдера» hero: name, description, stat cards.

import { motion } from "framer-motion";
import { Trophy, Briefcase, Calendar } from "lucide-react";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { FranchizeOperatorLinkButton, FranchizeOperatorPanel, FranchizeOperatorStatCard } from "@/app/franchize/components/FranchizeOperatorSurface";
import { itemVariants, type CrewTokens } from "./profile-shared";

export function ProfileHeaderPanel({
  crewName,
  slug,
  unlockedCount,
  achievementsTotal,
  shiftsCompleted,
  totalHoursWorked,
  T,
}: {
  crewName: string;
  slug: string;
  unlockedCount: number;
  achievementsTotal: number;
  shiftsCompleted: number;
  totalHoursWorked: number;
  T: CrewTokens;
}) {
  return (
    <motion.div variants={itemVariants}>
    <FranchizeOperatorPanel muted={false}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide " style={{ color: T.accent }}>
            <VibeContentRenderer content="::FaIdBadge::" /> Профиль райдера
          </p>
          <h1 className="mt-2 break-words text-2xl font-semibold " style={{ color: T.text }}>
            {crewName}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed " style={{ color: T.textMuted }}>
            Персональная страница достижений, сохранённых данных и быстрых
            возвратов в аренды экипажа.
          </p>
        </div>
        <FranchizeOperatorLinkButton href={`/franchize/${slug}`}>
          В каталог
        </FranchizeOperatorLinkButton>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <FranchizeOperatorStatCard
          label="Достижения"
          value={`${unlockedCount}/${achievementsTotal}`}
          icon={<Trophy className="h-4 w-4" style={{ color: T.accent }} />}
        />
        <FranchizeOperatorStatCard
          label="Смен завершено"
          value={shiftsCompleted}
          icon={<Briefcase className="h-4 w-4" style={{ color: T.accent }} />}
        />
        <FranchizeOperatorStatCard
          label="Часов работы"
          value={totalHoursWorked ? Math.round(totalHoursWorked) : 0}
          icon={<Calendar className="h-4 w-4" style={{ color: T.accent }} />}
        />
      </div>
    </FranchizeOperatorPanel>
    </motion.div>
  );
}
