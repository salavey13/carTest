"use client";

import { motion } from "framer-motion";
import { Users, Filter, Search, Inbox } from "lucide-react";

interface EmptyStateProps {
  hasFilters: boolean;
  searchQuery?: string;
  /** Called when the user clicks "Сбросить фильтры". Should clear ALL filters
   *  (search + source + owner + stage + segment + flags), not just search. */
  onReset?: () => void;
  T: any;
}

export function EmptyState({ hasFilters, searchQuery, onReset, T }: EmptyStateProps) {
  const showSearchTip = hasFilters && searchQuery && searchQuery.length > 0;
  const showFilterTip = hasFilters && !showSearchTip;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 22, stiffness: 240 }}
      className="flex flex-col items-center rounded-3xl border p-12 text-center"
      style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: T.shadow }}
    >
      {/* Animated icon circle */}
      <motion.div
        className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full"
        style={{ backgroundColor: T.borderSoft }}
        animate={{
          scale: [1, 1.04, 1],
          rotate: hasFilters ? [0, -3, 3, 0] : 0,
        }}
        transition={{
          scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 0.5 },
        }}
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
          <Search className="h-10 w-10" style={{ color: T.textFaint }} />
        ) : (
          <Users className="h-10 w-10" style={{ color: T.textFaint }} />
        )}
      </motion.div>

      {/* Title */}
      <motion.p
        className="text-lg font-bold"
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
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition hover:opacity-80"
            style={{ backgroundColor: T.borderSoft, color: T.textMuted }}
          >
            <Filter className="h-3 w-3" />
            Сбросить фильтры
          </button>
        )}
        {!hasFilters && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium" style={{ backgroundColor: T.borderSoft, color: T.textMuted }}>
              <Inbox className="h-3 w-3" />
              Telegram
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium" style={{ backgroundColor: T.borderSoft, color: T.textMuted }}>
              <Users className="h-3 w-3" />
              Avito
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium" style={{ backgroundColor: T.borderSoft, color: T.textMuted }}>
              <Search className="h-3 w-3" />
              Сайт
            </span>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
