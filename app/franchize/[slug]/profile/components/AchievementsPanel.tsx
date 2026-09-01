"use client";

// AchievementsPanel — «Достижения» grid (crew only). Sits at the very end of
// the profile page. iter31: split out of ProfileClient; also fixed a
// locked-tile style bug — the background color used the *string*
// "withAlpha(T.textMuted, 0.15)" instead of calling the helper, so locked
// tiles silently lost their wash.

import { motion } from "framer-motion";
import { CheckCircle, Lock, Trophy } from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { FranchizeOperatorPanel } from "@/app/franchize/components/FranchizeOperatorSurface";
import { cn } from "@/lib/utils";
import { withAlpha } from "@/app/franchize/lib/theme";
import type { FranchizeAchievementDefinition } from "@/app/franchize/profile-actions";
import { EmptyState, itemVariants, type CrewTokens } from "./profile-shared";

export function AchievementsPanel({
  catalog,
  unlockedSet,
  error,
  T,
}: {
  catalog: FranchizeAchievementDefinition[];
  unlockedSet: Set<string>;
  error: string | null;
  T: CrewTokens;
}) {
  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
          <VibeContentRenderer content="::FaUserSecret::" /> Достижения
        </h2>
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
