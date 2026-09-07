"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  History,
  MessageSquare,
  Phone,
  Send,
  CheckCircle2,
  Bike,
  Plus,
  Bot,
  Trophy,
  XCircle,
  ClipboardList,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { LeadHistoryEvent } from "../leads-constants";
import type { ThemeTokens } from "../hooks/useTheme";

interface Props {
  events: LeadHistoryEvent[];
  expanded: boolean;
  onToggle: () => void;
  T: ThemeTokens;
}

const EVENT_ICON: Record<string, LucideIcon> = {
  lead_created: Plus,
  first_contact: Phone,
  telegram_sent: Send,
  phone_call: Phone,
  qr_sent: Send,
  qr_claimed: CheckCircle2,
  rental_created: Bike,
  rental_active: Bike,
  return_completed: CheckCircle2,
  todo_created: Plus,
  todo_completed: CheckCircle2,
  note_added: MessageSquare,
  // Записанные события журнала (Lead Game wave):
  avito_message: MessageSquare,
  analysis_attached: Sparkles,
  lead_handled: CheckCircle2,
  callback_set: Phone,
  callback_completed: Phone,
  closed_won: Trophy,
  closed_lost: XCircle,
  stage_changed: ClipboardList,
  bot_reply: Bot,
};

// Semantic per-event colors. Same palette as the rest of the dashboard so
// qr_claimed (green) matches the verified check, etc.
const EVENT_COLOR: Record<string, string> = {
  lead_created: "#64748b",
  first_contact: "#eab308",
  telegram_sent: "#3b82f6",
  phone_call: "#eab308",
  qr_sent: "#3b82f6",
  qr_claimed: "#22c55e",
  rental_created: "#8b5cf6",
  rental_active: "#22c55e",
  return_completed: "#22c55e",
  todo_created: "#3b82f6",
  todo_completed: "#22c55e",
  note_added: "#f59e0b",
  // Записанные события журнала (Lead Game wave):
  avito_message: "#0ea5e9",
  analysis_attached: "#a855f7",
  lead_handled: "#22c55e",
  callback_set: "#eab308",
  callback_completed: "#22c55e",
  closed_won: "#22c55e",
  closed_lost: "#ef4444",
  stage_changed: "#8b5cf6",
  bot_reply: "#64748b",
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Разделитель дат в стиле стены «Мотопарка»: «Сегодня», «Вчера», дата. */
function dayDividerLabel(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(new Date()) - startOfDay(d)) / 86_400_000,
  );
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Кто совершил записанное действие — для атрибуции в таймлайне. */
function actorLabel(ev: LeadHistoryEvent): string | null {
  if (!ev.recorded || !ev.actor) return null;
  if (ev.actor === "avito-agent") return "Авито-агент";
  return ev.actorName || ev.actor;
}

/**
 * Vertical timeline with colored dots and date dividers.
 *
 * Layout (motopark-style, «как у мото в мотопарке»):
 *   - Date dividers «Сегодня» / «Вчера» / дата между группами событий.
 *   - Vertical line on the left (1px, T.border color).
 *   - Each event has a colored dot (28px circle) sitting on the line.
 *   - Recorded events (журнал lead_events) показывают актёра — «кто сделал».
 *   - Compact on mobile: timestamp + label on one line, detail hidden behind
 *     a soft wrap if present. On desktop: timestamp on top, label below,
 *     detail on a third line.
 *
 * AnimatePresence is used so events fade+slide in when the section expands.
 */
export function LeadHistorySection({ events, expanded, onToggle, T }: Props) {
  // Разделители дат считаем только на отображаемых (отсортированных) событиях.
  const divided = events.map((ev, i) => {
    const label =
      i === 0 ||
      dayDividerLabel(ev.timestamp) !== dayDividerLabel(events[i - 1].timestamp)
        ? dayDividerLabel(ev.timestamp)
        : null;
    return { divider: label, ev };
  });

  return (
    <section className="glass-panel rounded-[24px] p-4 sm:p-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-[44px] w-full cursor-pointer items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <History className="h-5 w-5" style={{ color: T.accent }} aria-hidden />
          <h3 className="text-base font-semibold md:text-lg" style={{ color: T.text }}>
            История
          </h3>
          <span className="text-sm" style={{ color: T.textMuted }}>
            {events.length}
          </span>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5" style={{ color: T.textMuted }} aria-hidden />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="overflow-hidden"
          >
            <div
              className="mt-5 space-y-4 border-l pl-5"
              style={{ borderColor: T.border }}
            >
              {events.length === 0 ? (
                <p className="text-sm" style={{ color: T.textMuted }}>
                  Событий пока нет
                </p>
              ) : (
                divided.map(({ divider, ev }, i) => {
                  const Icon = EVENT_ICON[ev.type] || History;
                  const color = EVENT_COLOR[ev.type] || T.textFaint;
                  const actor = actorLabel(ev);
                  return (
                    <div key={`${ev.type}-${ev.timestamp}-${i}`}>
                      {divider && (
                        <div
                          className="mb-3 -ml-1 text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: T.textFaint }}
                        >
                          {divider}
                        </div>
                      )}
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: Math.min(i * 0.03, 0.3),
                          type: "spring",
                          damping: 24,
                          stiffness: 280,
                        }}
                        className="relative"
                      >
                        {/* Colored dot on the vertical line */}
                        <div
                          className="absolute -left-[26px] top-0 grid h-7 w-7 place-items-center rounded-full"
                          style={{ background: `${color}1a` }}
                          aria-hidden
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                        {/* Mobile: single-line compact layout. Desktop: 2-line. */}
                        <div className="flex flex-wrap items-baseline gap-x-2 md:block">
                          <span className="text-xs" style={{ color: T.textMuted }}>
                            {formatTimestamp(ev.timestamp)}
                          </span>
                          <span
                            className="text-sm md:mt-0.5 md:block"
                            style={{ color: T.text }}
                          >
                            {ev.label}
                          </span>
                          {actor && (
                            <span
                              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold md:ml-0"
                              style={{ backgroundColor: `${color}14`, color }}
                            >
                              {actor}
                            </span>
                          )}
                        </div>
                        {ev.detail && (
                          <div
                            className="mt-0.5 text-xs"
                            style={{ color: T.textFaint }}
                          >
                            {ev.detail}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
