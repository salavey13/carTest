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
  riderId,
  unlockedCount,
  achievementsTotal,
  shiftsCompleted,
  totalHoursWorked,
  T,
}: {
  crewName: string;
  slug: string;
  /** Own TG id — enables the «Публичный профиль» CTA (rider profile v1). */
  riderId: string | null;
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
        <div className="flex flex-col items-end gap-2">
          {/* Rider profile v1: the CRM profile stays private (docs/earnings),
              the public one is what the crew sees — keep both one tap apart.
              Config surface lives ON the public page (edit mode for isSelf):
              bio, city, emoji-status and the hideProfile privacy toggle. */}
          {riderId && (
            <>
              <a
                href={`/franchize/${slug}/rider/${riderId}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition hover:brightness-110"
                style={{ borderColor: T.accent, color: T.accent }}
              >
                Публичный профиль →
              </a>
              <span className="max-w-[190px] text-right text-[10px] leading-snug" style={{ color: T.textMuted }}>
                Виден экипажу: био, статус, гараж. Настраивается внутри.
              </span>
            </>
          )}
          <FranchizeOperatorLinkButton href={`/franchize/${slug}`}>
            В каталог
          </FranchizeOperatorLinkButton>
        </div>
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
