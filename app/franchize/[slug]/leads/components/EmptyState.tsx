"use client";

import { motion } from "framer-motion";
import { Users, Filter, Search, Inbox } from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

interface EmptyStateProps {
  hasFilters: boolean;
  searchQuery?: string;
  /** Called when the user clicks "Сбросить фильтры". Should clear ALL filters
   *  (search + source + owner + stage + segment + flags), not just search. */
  onReset?: () => void;
  T: ThemeTokens;
}

/**
 * Friendly empty state — never looks like an error.
 *
 * - Animated icon circle (subtle scale pulse).
 * - Friendly copy: different messages for "no results with filters" vs
 *   "no leads yet at all".
 * - "Сбросить фильтры" reset button (only when filters are active).
 * - Source chips (Telegram / Avito / Сайт) when no leads exist — so the
 *   operator sees where leads will come from.
 */
export function EmptyState({ hasFilters, searchQuery, onReset, T }: EmptyStateProps) {
  const showSearchTip = hasFilters && !!searchQuery && searchQuery.length > 0;
  const showFilterTip = hasFilters && !showSearchTip;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 22, stiffness: 240 }}
      className="flex flex-col items-center rounded-3xl border p-8 text-center sm:p-12"
      style={{
        borderColor: T.border,
        backgroundColor: T.bgCard,
        boxShadow: T.shadow,
      }}
    >
      {/* Animated icon circle */}
      <motion.div
        className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full sm:h-24 sm:w-24"
        style={{ backgroundColor: T.borderSoft }}
        animate={{
          scale: [1, 1.04, 1],
          rotate: hasFilters ? [0, -3, 3, 0] : 0,
        }}
        transition={{
          scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 0.5 },
        }}
        aria-hidden
      >
        {/* Ring glow */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid ${T.borderSoft}`,
            opacity: 0.6,
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {hasFilters ? (
          <Search className="h-9 w-9 sm:h-10 sm:w-10" style={{ color: T.textFaint }} />
        ) : (
          <Users className="h-9 w-9 sm:h-10 sm:w-10" style={{ color: T.textFaint }} />
        )}
      </motion.div>

      {/* Title */}
      <motion.p
        className="text-base font-bold sm:text-lg"
        style={{ color: T.text }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {hasFilters
          ? showSearchTip
            ? "Поиск не дал результатов"
            : "По выбранным фильтрам ничего нет"
          : "Живые лиды появятся здесь"}
      </motion.p>

      {/* Description */}
      <motion.p
        className="mt-2 max-w-xs text-sm"
        style={{ color: T.textFaint }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {hasFilters
          ? showSearchTip
            ? "Проверьте имя, телефон или username — может быть опечатка"
            : "Попробуйте изменить фильтр источника или расширить сегмент"
          : "Как только кто-то оставит заявку через Telegram, Avito или сайт — лид попадёт сюда"}
      </motion.p>

      {/* CTA hints */}
      <motion.div
        className="mt-6 flex flex-wrap items-center justify-center gap-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition"
            style={{
              borderColor: T.borderActive,
              backgroundColor: `${T.accent}14`,
              color: T.accent,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${T.accent}1f`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${T.accent}14`;
            }}
          >
            <Filter className="h-3 w-3" aria-hidden />
            Сбросить фильтры
          </button>
        )}
        {!hasFilters && (
          <>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
              style={{ backgroundColor: T.borderSoft, color: T.textMuted }}
            >
              <Inbox className="h-3 w-3" aria-hidden />
              Telegram
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
              style={{ backgroundColor: T.borderSoft, color: T.textMuted }}
            >
              <Users className="h-3 w-3" aria-hidden />
              Avito
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
              style={{ backgroundColor: T.borderSoft, color: T.textMuted }}
            >
              <Search className="h-3 w-3" aria-hidden />
              Сайт
            </span>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
