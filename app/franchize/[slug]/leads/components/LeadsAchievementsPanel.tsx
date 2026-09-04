// /app/franchize/[slug]/leads/components/LeadsAchievementsPanel.tsx
//
// ДОСТИЖЕНИЯ ЭКИПАЖА — геймификация KPI («add a lot of achievements for
// all these metrics ;)»): бейджи бронза/серебро/золото/легенда, которые
// открываются сами, когда цифры воронки и скорости дотягиваются до порогов.
//
// Открытые бейджи — цветные с уровнем; закрытые — серые с прогресс-баром
// к следующему уровню и подсказкой «сейчас X · цель Y». Значения берутся
// из lib/lead-achievements.ts (вход — LeadKpiMetrics), здесь только визуал.

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Award, ChevronDown, ChevronUp } from "lucide-react";
import type { LeadAchievement } from "../lib/lead-achievements";
import { TIER_COLORS, TIER_LABELS, countUnlocked } from "../lib/lead-achievements";

interface LeadsAchievementsPanelProps {
  achievements: LeadAchievement[];
  T: any;
}

export function LeadsAchievementsPanel({ achievements, T }: LeadsAchievementsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const visible = achievements.filter((a) => a.available);
  const unlocked = countUnlocked(achievements);
  // Свёрнуто: открытые + почти открытые (прогресс ≥ 50%) — «что уже есть и
  // вот-вот будет»; развёрнуто — все доступные.
  const prioritized = [...visible].sort((a, b) => {
    const score = (x: LeadAchievement) => (x.unlocked ? 2 : x.progress >= 0.5 ? 1 : 0);
    return score(b) - score(a);
  });
  const shown = expanded ? prioritized : prioritized.slice(0, 6);
  const hiddenCount = prioritized.length - shown.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      className="rounded-2xl border p-3 sm:p-4"
      style={{ borderColor: T.border, backgroundColor: T.bgCard }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4" style={{ color: TIER_COLORS.gold }} />
          <h3 className="text-sm font-bold" style={{ color: T.text }}>
            Достижения
          </h3>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: `${TIER_COLORS.gold}22`, color: TIER_COLORS.gold }}
          >
            {unlocked} / {visible.length}
          </span>
        </div>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
            style={{ color: T.textMuted }}
          >
            {expanded ? "Свернуть" : `Ещё ${hiddenCount}`}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {shown.map((a, i) => {
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              whileHover={{ y: -2 }}
              title={`${a.desc}${a.unlocked ? "" : `\n\nСейчас: ${a.valueLabel}${
                a.nextLabel ? ` · цель: ${a.nextLabel}` : ""
              }`}`}
              className="relative flex flex-col rounded-xl border px-2.5 py-2"
              style={{
                borderColor: a.unlocked ? `${a.color}66` : T.border,
                backgroundColor: a.unlocked ? `${a.color}14` : T.borderSoft,
                boxShadow: a.maxed ? `0 0 12px ${a.color}33` : "none",
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base"
                  style={{
                    backgroundColor: a.unlocked ? `${a.color}26` : T.border,
                    filter: a.unlocked ? "none" : "grayscale(1)",
                    opacity: a.unlocked ? 1 : 0.55,
                  }}
                >
                  {a.emoji}
                </span>
                <div className="min-w-0">
                  <p
                    className="truncate text-[11px] font-bold leading-tight"
                    style={{ color: a.unlocked ? a.color : T.textMuted }}
                  >
                    {a.title}
                  </p>
                  <p className="text-[9px] uppercase tracking-wide" style={{ color: T.textFaint }}>
                    {TIER_LABELS[a.tier]}
                  </p>
                </div>
              </div>

              {/* Значение + прогресс к следующему уровню */}
              <div className="mt-1.5">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xs font-black" style={{ color: a.unlocked ? T.text : T.textMuted }}>
                    {a.valueLabel}
                  </span>
                  {!a.maxed && a.nextLabel && (
                    <span className="text-[9px]" style={{ color: T.textFaint }}>
                      → {a.nextLabel}
                    </span>
                  )}
                  {a.maxed && (
                    <span className="text-[9px] font-bold" style={{ color: a.color }}>
                      MAX
                    </span>
                  )}
                </div>
                <div
                  className="mt-1 h-1 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: a.unlocked ? `${a.color}33` : T.border }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round(Math.min(1, a.progress) * 100)}%`,
                      backgroundColor: a.unlocked ? a.color : T.textFaint,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
