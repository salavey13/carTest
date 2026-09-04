// /app/franchize/[slug]/leads/components/LeadsAchievementsPanel.tsx
//
// ДОСТИЖЕНИЯ ЭКИПАЖА — геймификация KPI («add a lot of achievements for
// all these metrics ;)»): бейджи бронза/серебро/золото/легенда, которые
// открываются сами, когда цифры воронки и скорости дотягиваются до порогов.
//
// Открытые бейджи — цветные с уровнем; закрытые — серые с прогресс-баром
// к следующему уровню. UX:
//   • бейдж кликабелен (в т.ч. на тач-экранах) — разворачивает карточку
//     «что меряем · сейчас → цель»: раньше смысл метрики был виден только
//     в hover-тултипе, которого на телефоне нет;
//   • свежеоткрытое достижение всплывает тостом-поздравлением (сравнение
//     состава открытых бейджей между апдейтами данных; на первом рендере
//     тосты не спамятся за уже заработанное);
//   • пустое состояние — подсказка вместо пустой сетки.
// Значения берутся из lib/lead-achievements.ts (вход — LeadKpiMetrics),
// здесь только визуал.

"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Award, ChevronDown, ChevronUp, X } from "lucide-react";
import type { LeadAchievement } from "../lib/lead-achievements";
import { TIER_COLORS, TIER_LABELS, countUnlocked } from "../lib/lead-achievements";

interface LeadsAchievementsPanelProps {
  achievements: LeadAchievement[];
  T: any;
}

export function LeadsAchievementsPanel({ achievements, T }: LeadsAchievementsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<LeadAchievement | null>(null);

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
  const detail = shown.find((a) => a.id === detailId) ?? null;

  // Тост «новое достижение»: сравниваем состав открытых бейджей с прошлым
  // апдейтом данных. Первый запуск эффекта только запоминает базу — иначе
  // при каждом открытии страницы оператору поздравляли бы с давним прошлым.
  const prevUnlockedRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const now = new Set(achievements.filter((a) => a.unlocked).map((a) => a.id));
    const prev = prevUnlockedRef.current;
    prevUnlockedRef.current = now;
    if (!prev) return;
    const fresh = achievements.find((a) => a.unlocked && !prev.has(a.id));
    if (fresh) setToast(fresh);
  }, [achievements]);

  // Автоскрытие тоста; таймер чистится при смене/размонтировании.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
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
              aria-expanded={expanded}
              aria-controls="achievements-grid"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
              style={{ color: T.textMuted }}
            >
              {expanded ? "Свернуть" : `Ещё ${hiddenCount}`}
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {prioritized.length === 0 ? (
          <p
            className="rounded-xl border border-dashed px-3 py-4 text-center text-[11px] leading-relaxed"
            style={{ borderColor: T.border, color: T.textFaint }}
          >
            Достижения появятся сами — как только в воронке появятся лиды и отметки обработки
          </p>
        ) : (
          <div id="achievements-grid" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
                  className="relative flex rounded-xl border"
                  style={{
                    borderColor: a.unlocked ? `${a.color}66` : T.border,
                    backgroundColor: a.unlocked ? `${a.color}14` : T.borderSoft,
                    boxShadow: a.maxed ? `0 0 12px ${a.color}33` : "none",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setDetailId((cur) => (cur === a.id ? null : a.id))}
                    aria-pressed={detailId === a.id}
                    className="flex w-full flex-col rounded-xl px-2.5 py-2 text-left transition hover:opacity-90"
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
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Карточка-деталь выбранного бейджа: смысл метрики + «сейчас → цель».
            Работает и на тач-экранах, где hover-тултип недоступен. */}
        <AnimatePresence initial={false}>
          {detail && (
            <motion.div
              key="achievement-detail"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="mt-2 rounded-xl border px-3 py-2"
                style={{ borderColor: `${detail.color}55`, backgroundColor: `${detail.color}0d` }}
              >
                <p className="text-[11px] font-black" style={{ color: detail.color }}>
                  {detail.emoji} {detail.title} · {TIER_LABELS[detail.tier]}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: T.textMuted }}>
                  {detail.desc}
                </p>
                <p className="mt-1 text-[10px] font-semibold" style={{ color: T.textFaint }}>
                  Сейчас: {detail.valueLabel}
                  {detail.maxed
                    ? " · MAX — уровень взят полностью"
                    : detail.nextLabel
                      ? ` · цель: ${detail.nextLabel}`
                      : ""}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Тост-поздравление со свежеоткрытым достижением — видно из любой
          точки страницы, т.к. бейджи живут внизу длинного скролла. */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            role="status"
            className="fixed bottom-20 right-4 z-50 flex max-w-xs items-start gap-2.5 rounded-2xl border p-3 shadow-lg"
            style={{ borderColor: `${toast.color}88`, backgroundColor: T.bgCard }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: `${toast.color}26` }}
            >
              {toast.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: toast.color }}>
                Новое достижение!
              </p>
              <p className="text-sm font-black leading-tight" style={{ color: T.text }}>
                {toast.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug" style={{ color: T.textMuted }}>
                {toast.desc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Закрыть поздравление"
              className="shrink-0 rounded-md p-0.5 transition hover:opacity-70"
              style={{ color: T.textFaint }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
