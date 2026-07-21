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
  type LucideIcon,
} from "lucide-react";
import type { LeadHistoryEvent } from "@/app/franchize/[slug]/leads/leads-constants";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

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
};

const EVENT_COLOR: Record<string, string> = {
  lead_created: "#a1a1aa",
  first_contact: "#facc15",
  telegram_sent: "#3b82f6",
  phone_call: "#facc15",
  qr_sent: "#3b82f6",
  qr_claimed: "#22c55e",
  rental_created: "#8b5cf6",
  rental_active: "#22c55e",
  return_completed: "#22c55e",
  todo_created: "#06b6d4",
  todo_completed: "#22c55e",
  note_added: "#f59e0b",
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

/**
 * Vertical timeline with colored icons.
 * Each event: timestamp + label + optional detail, in a single row.
 */
export function LeadHistorySection({ events, expanded, onToggle, T }: Props) {
  return (
    <section className="glass-panel rounded-[24px] p-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <History className="h-5 w-5" style={{ color: T.accent }} />
          <h3 className="text-lg font-semibold" style={{ color: T.text }}>
            История
          </h3>
          <span className="text-sm" style={{ color: T.textMuted }}>
            {events.length}
          </span>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5" style={{ color: T.textMuted }} />
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
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              {events.length === 0 ? (
                <p className="text-sm" style={{ color: T.textMuted }}>
                  Событий пока нет
                </p>
              ) : (
                events.map((ev, i) => {
                  const Icon = EVENT_ICON[ev.type] || History;
                  const color = EVENT_COLOR[ev.type] || "#a1a1aa";
                  return (
                    <motion.div
                      key={`${ev.type}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      className="relative"
                    >
                      <div
                        className="absolute -left-[26px] top-0 grid h-7 w-7 place-items-center rounded-full"
                        style={{ background: `${color}1a` }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                      </div>
                      <div className="text-xs" style={{ color: T.textMuted }}>
                        {formatTimestamp(ev.timestamp)}
                      </div>
                      <div className="mt-0.5 text-sm" style={{ color: T.text }}>
                        {ev.label}
                      </div>
                      {ev.detail && (
                        <div className="mt-0.5 text-xs" style={{ color: T.textFaint }}>
                          {ev.detail}
                        </div>
                      )}
                    </motion.div>
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
