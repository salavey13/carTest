"use client";

// AchievementsPanel — «Достижения» grid (crew only). Sits at the very end of
// the profile page. iter31: split out of ProfileClient; also fixed a
// locked-tile style bug — the background color used the *string*
// "withAlpha(T.textMuted, 0.15)" instead of calling the helper, so locked
// tiles silently lost their wash.
//
// ПУТЬ ОПЕРАТОРА (геймификация): шапка с XP и званием. XP считается из
// ДВУХ источников: (1) профильные бейджи этого грида (серии смен, часы…
// — 15 XP каждый, из users.metadata) и (2) лид-достижения со страницы
// лидов — их sticky-стор живёт в localStorage под ключом
// `leads-achv:<slug>` (тот же, что пишет LeadsAchievementsPanel), читаем
// его здесь — путь оператора един на всей CRM. SSR-безопасно: на сервере
// пусто, после гидрации XP появляется (расхождение гидрации исключено —
// читаем в useEffect, не в рендере).

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Lock, Trophy } from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { FranchizeOperatorPanel } from "@/app/franchize/components/FranchizeOperatorSurface";
import { cn } from "@/lib/utils";
import { withAlpha } from "@/app/franchize/lib/theme";
import type { FranchizeAchievementDefinition } from "@/app/franchize/profile-actions";
import { EmptyState, itemVariants, type CrewTokens } from "./profile-shared";
import { computeOperatorRank, xpForProfileUnlocks } from "@/app/franchize/[slug]/leads/lib/lead-gamification";
import { loadAchievementStore, type AchievementStore } from "@/app/franchize/[slug]/leads/lib/lead-achievements";

export function AchievementsPanel({
  catalog,
  unlockedSet,
  error,
  slug,
  T,
}: {
  catalog: FranchizeAchievementDefinition[];
  unlockedSet: Set<string>;
  error: string | null;
  /** Slug экипажа — ключ leader-board store в localStorage (`leads-achv:<slug>`). */
  slug?: string;
  T: CrewTokens;
}) {
  // Лидерский sticky-стор (id → лучший уровень). Читается после монтирования
  // (SSR = {}), чтобы не расходиться с гидрацией.
  const [leadStore, setLeadStore] = useState<AchievementStore>({});
  useEffect(() => {
    if (!slug) return;
    setLeadStore(loadAchievementStore(`leads-achv:${slug}`));
  }, [slug]);

  const rank = useMemo(
    () => computeOperatorRank(leadStore, unlockedSet),
    [leadStore, unlockedSet],
  );

  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
          <VibeContentRenderer content="::FaUserSecret::" /> Достижения
        </h2>

        {/* ПУТЬ ОПЕРАТОРА — звание/XP: профильные бейджи (этот грид) +
            лид-достижения из sticky-стора страницы лидов. Прогресс-бар —
            до следующего звания (та же шкала, что в панели достижений лидов). */}
        <div
          className="mb-3 flex items-center gap-2.5 rounded-xl border px-3 py-2"
          style={{ borderColor: T.borderSoft, backgroundColor: withAlpha(T.textMuted, 0.07) }}
          title="XP: профильные бейджи по 15 XP + достижения лид-воронки (бронза 10 · серебро 25 · золото 50 · легенда 100). Путь общий для профиля и страницы лидов."
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: withAlpha(T.accent, 0.15) }}
            aria-hidden
          >
            {rank.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[11px] font-black" style={{ color: T.text }}>
                {rank.title}
                <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: T.textMuted }}>
                  путь оператора
                </span>
              </p>
              <span className="shrink-0 text-[10px] font-bold" style={{ color: T.accent }}>
                {rank.xp} XP
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: T.borderSoft }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(rank.progress * 100)}%`,
                  background: `linear-gradient(90deg, ${withAlpha(T.accent, 0.55)}, ${T.accent})`,
                }}
              />
            </div>
            <p className="mt-0.5 text-[9px] font-semibold" style={{ color: T.textMuted }}>
              {rank.next
                ? `до «${rank.next.title}» ещё ${rank.xpToNext} XP`
                : "МАКСИМУМ — ты Легенда экипажа 👑"}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {catalog.length === 0 ? (
            <EmptyState
              icon={<Trophy className="h-8 w-8" />}
              title="Нет достижений"
              description="Достижения появятся здесь по мере вашей активности"
            />
          ) : (
            catalog.map((achievement) => {
              const unlocked = unlockedSet.has(achievement.id);
              return (
                <motion.div
                  key={achievement.id}
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border p-3 transition-all duration-300",
                    unlocked && "shadow-lg"
                  )}
                  style={{
                    borderColor: unlocked
                      ? T.accent
                      : T.borderSoft,
                    backgroundColor: unlocked
                      ? withAlpha(T.accent, 0.09)
                      : "color-mix(in srgb, var(--franchize-shell-card) 70%, transparent)",
                  }}
                >
                  {/* Status indicator */}
                  <div className="absolute right-3 top-3">
                    {unlocked ? (
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: withAlpha(T.accent, 0.2),
                          color: T.accent,
                        }}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </div>
                    ) : (
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        style={{
                          // iter31 fix: was the literal string "withAlpha(...)",
                          // which is not a CSS color → locked tiles had no wash.
                          backgroundColor: withAlpha(T.textMuted, 0.15),
                          color: T.textMuted,
                        }}
                      >
                        <Lock className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <p className="pr-8 text-sm font-semibold " style={{ color: T.text }}>
                    {achievement.title}
                  </p>
                  <p className="mt-1 text-xs " style={{ color: T.textMuted }}>
                    {achievement.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: withAlpha(T.accent, 0.12),
                        color: unlocked
                          ? T.accent
                          : T.textMuted,
                      }}
                    >
                      {achievement.triggerSources[0] || "Система"}
                    </span>
                    {unlocked && (
                      <span className="" style={{ color: T.accent }}>
                        ✓ Разблокировано
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
        {!!error && <p className="text-xs text-red-400">{error}</p>}
      </FranchizeOperatorPanel>
    </motion.div>
  );
}
