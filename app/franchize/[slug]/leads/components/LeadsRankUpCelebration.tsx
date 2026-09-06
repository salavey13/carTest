// /app/franchize/[slug]/leads/components/LeadsRankUpCelebration.tsx
//
// ПРАЗДНИК ЗВАНИЯ — клиентская половина «пути оператора».
// Сервер (notifyRankUpIfCrossed в profile-actions.ts) празднует rank-up
// только по ПРОФИЛЬНЫМ бейджам (users.metadata): лидерский sticky-стор XP
// живёт в localStorage и серверу недоступен. Этот баннер закрывает вторую
// половину: sticky-стор воронки пересёк порог звания → гранд-баннер.
//
// Отличие от тоста бейджа (тот — bottom-right, 6 с): звание берётся РЕЖЕ и
// стоит дороже, поэтому баннер по центру сверху, со spring-анимацией,
// пульсирующим ореолом вокруг эмодзи и живёт 9 с (или до закрытия).
// Показывается ровно один раз на пересечение — detectRankUp() сравнивает
// XP ДО и ПОСЛЕ диффа стора, «старые» звания при первой загрузке молчат
// (базовый прогон diffAchievementEvents не доходит до праздника).
//
// Слои: внешний fixed-контейнер центрирует (flex, pointer-events-none —
// не перекрывает страницу, пока баннера нет), motion.div внутри — сам
// баннер. Центрирование классами flex, а НЕ translate-x-1/2: framer-motion
// пишет transform инлайном и победил бы tailwind-класс.

"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { OperatorRank } from "../lib/lead-gamification";
import { TIER_COLORS } from "../lib/lead-achievements";

export function LeadsRankUpCelebration({
  rank,
  cardColor,
  onDismiss,
}: {
  rank: OperatorRank | null;
  /** Цвет карточки темы экипажа (T.bgCard) — баннер не спорит со страницей. */
  cardColor: string;
  onDismiss: () => void;
}) {
  // Авоскрытие через 9 с — праздник не требует клика, но и не висит вечно.
  useEffect(() => {
    if (!rank) return;
    const t = window.setTimeout(onDismiss, 9000);
    return () => window.clearTimeout(t);
  }, [rank, onDismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {rank && (
          <motion.div
            key={`rank-up:${rank.level}`}
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            role="status"
            aria-live="polite"
            className="pointer-events-auto relative w-full max-w-sm rounded-2xl border p-4 shadow-2xl"
            style={{
              borderColor: `${TIER_COLORS.gold}99`,
              background: `linear-gradient(135deg, ${TIER_COLORS.gold}1a, ${TIER_COLORS.bronze}0d), ${cardColor}`,
            }}
          >
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Закрыть поздравление"
              className="absolute right-2 top-2 rounded-md p-1 transition hover:opacity-70"
              style={{ color: TIER_COLORS.gold }}
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-3">
              {/* Ореол: пульсирующее кольцо вокруг эмодзи звания */}
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center" aria-hidden>
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-30"
                  style={{ backgroundColor: TIER_COLORS.gold }}
                />
                <span
                  className="relative flex h-10 w-10 items-center justify-center rounded-full text-xl"
                  style={{ backgroundColor: `${TIER_COLORS.gold}26` }}
                >
                  {rank.emoji}
                </span>
              </span>
              <div className="min-w-0">
                <p
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: TIER_COLORS.gold }}
                >
                  🎖 Новое звание · уровень {rank.level}
                </p>
                <p className="text-lg font-black leading-tight" style={{ color: TIER_COLORS.gold }}>
                  {rank.title}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold" style={{ color: TIER_COLORS.gold }}>
                  {rank.xp} XP
                  {rank.next
                    ? ` · до «${rank.next.title}» ещё ${rank.xpToNext} XP`
                    : " · максимум пути!"}
                </p>
              </div>
            </div>

            <p className="mt-2 text-[10px] leading-snug" style={{ color: TIER_COLORS.gold }}>
              Путь оператора: шаги плейбука → метрики воронки → бейджи → XP. Звание взято по-честному.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
