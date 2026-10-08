"use client";

// ProfileHeaderPanel — «Профиль райдера» hero: name, description, stat cards.
// Task 83 (2026-10-08) mobile pass: the CTA block no longer squeezes the
// title on narrow phones — the old `flex-wrap` row put a ~190px CTA column
// BESIDE the flex-1 title block (~140px left on a 360px screen — the same
// squeeze class boss flagged on crew/members). Now flex-col on mobile,
// sm:flex-row from sm up. Stat cards: compact 3-across row on mobile.

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
      {/* Mobile-first: stacked column on phones (title keeps full width,
          CTAs wrap in a row below); side-by-side from sm up. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
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
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {/* Rider profile v1: the CRM profile stays private (docs/earnings),
              the public one is what the crew sees — keep both one tap apart.
              Config surface lives ON the public page (edit mode for isSelf):
              bio, city, emoji-status and the hideProfile privacy toggle. */}
          {riderId && (
            <a
              href={`/franchize/${slug}/rider/${riderId}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition hover:brightness-110"
              style={{ borderColor: T.accent, color: T.accent }}
            >
              Публичный профиль →
            </a>
          )}
          <FranchizeOperatorLinkButton href={`/franchize/${slug}`}>
            В каталог
          </FranchizeOperatorLinkButton>
          {riderId && (
            <span
              className="w-full text-left text-[10px] leading-snug sm:w-auto sm:max-w-[190px] sm:text-right"
              style={{ color: T.textMuted }}
            >
              Виден экипажу: био, статус, гараж. Настраивается внутри.
            </span>
          )}
        </div>
      </div>

      {/* 3-across even on phones — compact cards keep the hero one screen. */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <FranchizeOperatorStatCard
          compact
          label="Достижения"
          value={`${unlockedCount}/${achievementsTotal}`}
          icon={<Trophy className="h-4 w-4" style={{ color: T.accent }} />}
        />
        <FranchizeOperatorStatCard
          compact
          label="Смен завершено"
          value={shiftsCompleted}
          icon={<Briefcase className="h-4 w-4" style={{ color: T.accent }} />}
        />
        <FranchizeOperatorStatCard
          compact
          label="Часов работы"
          value={totalHoursWorked ? Math.round(totalHoursWorked) : 0}
          icon={<Calendar className="h-4 w-4" style={{ color: T.accent }} />}
        />
      </div>
    </FranchizeOperatorPanel>
    </motion.div>
  );
}
