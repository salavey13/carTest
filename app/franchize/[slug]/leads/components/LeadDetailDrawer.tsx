"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  Send,
  Bell,
  MoreHorizontal,
  X,
  CheckCircle2,
  Flame,
  ChevronDown,
  Briefcase,
  StickyNote,
  Plus,
  type LucideIcon,
} from "lucide-react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import type {
  LeadSignal,
  LeadHistoryEvent,
} from "../leads-constants";
import type { ThemeTokens } from "../hooks/useTheme";
import {
  STAGE_LABELS,
  STAGE_COLORS,
  STAGE_NEXT_ACTION,
} from "../lib/pipeline-stages";
import { SOURCE_META } from "../leads-constants";
import {
  getInitials,
  relativeTime,
  fmtMoney,
  formatDate,
} from "../leads-utils";
import { LeadSLAOverview } from "./LeadSLAOverview";
import { LeadInfoGrid, type InfoTile } from "./LeadInfoGrid";
import {
  LeadDocumentsSection,
  type DocumentItem,
  type QrStatus,
} from "./LeadDocumentsSection";
import { LeadHistorySection } from "./LeadHistorySection";

export interface LeadDrawerNote {
  id: string;
  text: string;
  created_at: string;
  created_by: string | null;
}

/**
 * Extended LeadTodoRow that includes the `due_date` column from the crew_todos
 * table. The current `LeadTodoRow` interface in server-actions/leads.ts omits
 * this field even though it exists in the DB and is used by sla-signals.ts.
 */
export type DrawerTodo = LeadTodoRow & { due_date?: string | null };

interface Props {
  lead: LeadRow;
  todos: DrawerTodo[];
  notes: LeadDrawerNote[];
  signals: LeadSignal[];
  history: LeadHistoryEvent[];
  docs: DocumentItem[];
  T: ThemeTokens;
  onClose: () => void;
  onAction: (action: string) => void;
  onCreateTodo: (title: string) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onAddNote: (text: string) => void;
  onDismissLead: () => void;
}

type TodoFilter = "all" | "mine" | "overdue";

/**
 * Full lead detail drawer (right side panel).
 * Sections (in order):
 *   1. Header  2. Primary actions  3. SLA overview  4. Info grid
 *   5. Deals (collapsible)  6. Documents (collapsible)  7. Tasks (collapsible + sub-filters)
 *   8. Notes (collapsible)  9. History (collapsible, timeline)  10. Sticky footer
 */
export function LeadDetailDrawer(props: Props) {
  const {
    lead,
    todos,
    notes,
    signals,
    history,
    docs,
    T,
    onClose,
    onAction,
    onCreateTodo,
    onToggleTodo,
    onDeleteTodo,
    onAddNote,
    onDismissLead,
  } = props;

  const stageKey = (lead as { stageKey?: string }).stageKey || "new";
  const stageColor = STAGE_COLORS[stageKey] || "#64748b";
  const stageLabel = STAGE_LABELS[stageKey] || stageKey;
  const displayName = lead.full_name || "Без имени";
  const initials = getInitials(lead.full_name);
  const rel = relativeTime(lead.lastSeenAt || lead.createdAt);
  const isHot = signals.some((s) => s.tone === "danger");
  const assignee = lead.assigneeName || lead.assigneeId || "—";

  const [todoFilter, setTodoFilter] = useState<TodoFilter>("all");
  const [newTodo, setNewTodo] = useState("");
  const [newNote, setNewNote] = useState("");
  const [openDeals, setOpenDeals] = useState(true);
  const [openDocs, setOpenDocs] = useState(true);
  const [openTasks, setOpenTasks] = useState(true);
  const [openNotes, setOpenNotes] = useState(true);
  const [openHistory, setOpenHistory] = useState(false);

  const infoItems: InfoTile[] = [
    { label: "Телефон", value: lead.phone || "—", copyable: !!lead.phone },
    { label: "TG ID", value: lead.user_id || "—", copyable: !!lead.user_id },
    { label: "Байк", value: lead.bikeTitle || "—" },
    { label: "Стадия", value: stageLabel, tone: "accent" },
    {
      label: "Приоритет",
      value: `${lead.urgencyScore ?? 0}/100`,
      tone:
        (lead.urgencyScore ?? 0) >= 80
          ? "danger"
          : (lead.urgencyScore ?? 0) >= 60
            ? "warning"
            : "default",
    },
    { label: "Источник", value: SOURCE_META[lead.source]?.label || lead.source },
    { label: "Канал", value: lead.contactChannel || "—" },
    { label: "Маршрут", value: lead.sourceRoute || "—", copyable: !!lead.sourceRoute },
    { label: "Первый контакт", value: lead.createdAt ? formatDate(lead.createdAt) : "—" },
    { label: "Последняя активность", value: rel || "—" },
    { label: "Ответственный", value: assignee },
    { label: "Следующее действие", value: STAGE_NEXT_ACTION[stageKey] || "—" },
  ];

  const filteredTodos = todos.filter((t) => {
    if (todoFilter === "overdue")
      return (
        !!t.due_date &&
        new Date(t.due_date).getTime() < Date.now() &&
        t.status !== "done"
      );
    if (todoFilter === "mine") return t.assigned_to === assignee && assignee !== "—";
    return true;
  });

  const qrStatus: QrStatus = (() => {
    const isClaimed =
      lead.identityState === "claimed_user" || lead.identityState === "merged";
    if (!lead.originalOperatorChatId)
      return { label: "Не требуется", tone: "good" };
    if (isClaimed) return { label: "Принят", tone: "good" };
    const s = signals.find((x) => x.key === "qr_age");
    if (s)
      return {
        label: `${s.value} не принят`,
        tone:
          s.tone === "danger"
            ? "danger"
            : s.tone === "warning"
              ? "warning"
              : "neutral",
      };
    return { label: "Не принят", tone: "warning" };
  })();

  const primaryActions: Array<{
    icon: LucideIcon;
    label: string;
    action: string;
    color: string;
  }> = [
    { icon: Phone, label: "Позвонить", action: "call", color: "#22c55e" },
    { icon: Send, label: "Написать в TG", action: "telegram", color: "#3b82f6" },
    { icon: Bell, label: "Уведомить", action: "notify", color: "#facc15" },
    { icon: MoreHorizontal, label: "Ещё", action: "more", color: "#a1a1aa" },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        // z-40: backdrop sits below mobile sheet (z-50), dialog (z-[60]), toast (z-[70])
        className="fixed inset-0 z-40 flex justify-end"
        style={{ background: "color-mix(in srgb, #000000 60%, transparent)" }}
        onClick={onClose}
      >
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          // Mobile: full-width. Desktop: max-w-[640px] right-side drawer.
          // `relative` so the absolutely-positioned sticky footer (bottom-0)
          // anchors to this aside and not the full-viewport backdrop.
          className="relative flex h-full w-full flex-col lg:max-w-[640px]"
          style={{
            background: T.bg,
            borderLeft: `1px solid ${T.border}`,
            boxShadow: "0 0 60px rgba(0,0,0,0.55)",
          }}
        >
          <div className="flex-1 overflow-y-auto px-4 pb-32 pt-5 sm:px-5">
            {/* 1. Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-4">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold md:h-14 md:w-14 md:text-lg"
                  style={{ background: `${stageColor}26`, color: stageColor }}
                  aria-hidden
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      className="truncate text-lg md:text-base md:text-lg font-semibold tracking-tight"
                      style={{ color: T.text }}
                    >
                      {displayName}
                    </h2>
                    {lead.verified && (
                      <CheckCircle2
                        className="h-5 w-5"
                        style={{ color: "#22c55e" }}
                        aria-label="Подтверждён"
                      />
                    )}
                    {isHot && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                        style={{ background: "#ef444426", color: "#fca5a5" }}
                      >
                        <Flame className="h-3 w-3" aria-hidden /> Горячий
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm" style={{ color: T.textMuted }}>
                    {lead.phone || "—"} • {rel}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-[11px]"
                      style={{ background: `${stageColor}1a`, color: stageColor }}
                    >
                      {stageLabel}
                    </span>
                    {lead.username && (
                      <span
                        className="rounded-full px-3 py-1 text-[11px]"
                        style={{ background: T.bgCard, color: T.textMuted }}
                      >
                        @{lead.username}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg p-2 transition"
                style={{ color: T.textMuted }}
                aria-label="Закрыть панель"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.bgCardHover;
                  e.currentTarget.style.color = T.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = T.textMuted;
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 2. Primary actions — 2x2 grid on mobile, 4-col on desktop */}
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {primaryActions.map((b) => {
                const Icon = b.icon;
                return (
                  <motion.button
                    key={b.action}
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ y: -1 }}
                    transition={{ type: "spring", damping: 22, stiffness: 320 }}
                    onClick={() => onAction(b.action)}
                    className="flex min-h-[88px] cursor-pointer flex-col items-start justify-between rounded-2xl border p-3 text-left transition md:min-h-[100px] md:p-4"
                    style={{
                      borderColor: `${b.color}33`,
                      background: `${b.color}14`,
                      color: b.color,
                    }}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                    <div className="mt-2 text-sm font-medium">{b.label}</div>
                  </motion.button>
                );
              })}
            </div>

            {/* 3. SLA overview */}
            <div className="mt-5">
              <LeadSLAOverview signals={signals} T={T} />
            </div>

            {/* 4. Info grid */}
            <div className="mt-5">
              <LeadInfoGrid items={infoItems} T={T} />
            </div>

            {/* 5. Deals */}
            <div className="mt-5">
              <Section
                title="Сделки"
                icon={Briefcase}
                count={lead.rentals.length + lead.sales.length}
                expanded={openDeals}
                onToggle={() => setOpenDeals(!openDeals)}
                T={T}
              >
                <div className="space-y-2">
                  {lead.rentals.length === 0 && lead.sales.length === 0 && (
                    <p className="text-sm" style={{ color: T.textMuted }}>
                      Сделок нет
                    </p>
                  )}
                  {lead.rentals.map((r) => (
                    <div
                      key={r.rentalId}
                      className="flex min-h-[44px] items-center justify-between rounded-2xl border p-3"
                      style={{
                        borderColor: T.border,
                        background: T.bgCard,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium" style={{ color: T.text }}>
                          {r.bikeTitle || "Байк"}
                        </div>
                        <div className="text-xs" style={{ color: T.textMuted }}>
                          {r.startDate ? formatDate(r.startDate) : "—"} →{" "}
                          {r.endDate ? formatDate(r.endDate) : "—"}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold" style={{ color: T.text }}>
                        {fmtMoney(r.totalCost)}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* 6. Documents */}
            <div className="mt-5">
              <LeadDocumentsSection
                documents={docs}
                qrStatus={qrStatus}
                expanded={openDocs}
                onToggle={() => setOpenDocs(!openDocs)}
                onRequestResendQr={() => onAction("resend_qr")}
                T={T}
              />
            </div>

            {/* 7. Tasks */}
            <div className="mt-5">
              <Section
                title="Задачи"
                icon={CheckCircle2}
                count={todos.filter((t) => t.status !== "done").length}
                expanded={openTasks}
                onToggle={() => setOpenTasks(!openTasks)}
                T={T}
              >
                <div className="mb-3 flex flex-wrap gap-2">
                  {([
                    { v: "all", label: `Все (${todos.length})`, color: "#facc15" },
                    { v: "mine", label: "Мои", color: "#3b82f6" },
                    { v: "overdue", label: "Просроченные", color: "#ef4444" },
                  ] as const).map((f) => (
                    <button
                      key={f.v}
                      type="button"
                      onClick={() => setTodoFilter(f.v)}
                      aria-pressed={todoFilter === f.v}
                      className="min-h-[36px] cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition"
                      style={
                        todoFilter === f.v
                          ? {
                              borderColor: `${f.color}4d`,
                              background: `${f.color}1a`,
                              color: f.color,
                            }
                          : {
                              borderColor: T.border,
                              background: T.bgCard,
                              color: T.textMuted,
                            }
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="mb-3 flex gap-2">
                  <input
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTodo.trim()) {
                        onCreateTodo(newTodo.trim());
                        setNewTodo("");
                      }
                    }}
                    placeholder="Новая задача..."
                    aria-label="Новая задача"
                    className="min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{
                      background: T.inputBg,
                      borderColor: T.inputBorder,
                      color: T.text,
                    }}
                  />
                  <button
                    type="button"
                    disabled={!newTodo.trim()}
                    onClick={() => {
                      if (newTodo.trim()) {
                        onCreateTodo(newTodo.trim());
                        setNewTodo("");
                      }
                    }}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: T.accent, color: T.accentContrast }}
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Добавить
                  </button>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {filteredTodos.length === 0 ? (
                    <p className="text-sm" style={{ color: T.textMuted }}>
                      Нет задач
                    </p>
                  ) : (
                    filteredTodos.map((t) => {
                      const isDone = t.status === "done";
                      const isOverdue =
                        !!t.due_date &&
                        new Date(t.due_date).getTime() < Date.now() &&
                        !isDone;
                      return (
                        <div
                          key={t.id}
                          className="flex min-h-[44px] items-start gap-3 rounded-2xl border p-3"
                          style={{
                            borderColor: isOverdue
                              ? "#ef444433"
                              : T.border,
                            background: isOverdue
                              ? "#ef44440d"
                              : T.bgCard,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => onToggleTodo(t.id)}
                            className="mt-0.5 grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-md border transition"
                            style={{
                              borderColor: isDone ? "#22c55e" : T.border,
                              background: isDone ? "#22c55e" : "transparent",
                            }}
                            aria-label={isDone ? "Снять отметку" : "Отметить выполненной"}
                          >
                            {isDone && <CheckCircle2 className="h-3 w-3" style={{ color: "#000000" }} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-sm ${isDone ? "line-through" : ""}`}
                              style={{ color: isDone ? T.textFaint : T.text }}
                            >
                              {t.title}
                            </div>
                            <div
                              className="mt-0.5 text-xs"
                              style={{ color: isOverdue ? "#fca5a5" : T.textMuted }}
                            >
                              {t.assigned_to || "—"}
                              {t.due_date && ` • ${formatDate(t.due_date)}`}
                              {isOverdue && " • просрочено"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onDeleteTodo(t.id)}
                            className="cursor-pointer text-xs transition"
                            style={{ color: T.textFaint }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#ef4444";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = T.textFaint;
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </Section>
            </div>

            {/* 8. Notes */}
            <div className="mt-5">
              <Section
                title="Заметки"
                icon={StickyNote}
                count={notes.length}
                expanded={openNotes}
                onToggle={() => setOpenNotes(!openNotes)}
                T={T}
              >
                <div className="mb-3 flex gap-2">
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newNote.trim()) {
                        onAddNote(newNote.trim());
                        setNewNote("");
                      }
                    }}
                    placeholder="Добавить заметку..."
                    aria-label="Новая заметка"
                    className="min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{
                      background: T.inputBg,
                      borderColor: T.inputBorder,
                      color: T.text,
                    }}
                  />
                  <button
                    type="button"
                    disabled={!newNote.trim()}
                    onClick={() => {
                      if (newNote.trim()) {
                        onAddNote(newNote.trim());
                        setNewNote("");
                      }
                    }}
                    className="min-h-[44px] cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      borderColor: T.border,
                      color: T.text,
                    }}
                  >
                    Добавить
                  </button>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {notes.length === 0 ? (
                    <p className="text-sm" style={{ color: T.textMuted }}>
                      Заметок нет
                    </p>
                  ) : (
                    notes.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-2xl border p-3"
                        style={{
                          borderColor: T.border,
                          background: T.bgCard,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium" style={{ color: T.text }}>
                            {n.created_by || "Аноним"}
                          </span>
                          <span className="shrink-0 text-xs" style={{ color: T.textFaint }}>
                            {relativeTime(n.created_at)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm" style={{ color: T.textMuted }}>
                          {n.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Section>
            </div>

            {/* 9. History */}
            <div className="mt-5">
              <LeadHistorySection
                events={history}
                expanded={openHistory}
                onToggle={() => setOpenHistory(!openHistory)}
                T={T}
              />
            </div>
          </div>

          {/* 10. Sticky footer — action buttons are full-width on mobile */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center gap-3 border-t p-4"
            style={{
              borderColor: T.border,
              background: T.bg,
              backdropFilter: "blur(12px)",
            }}
          >
            <button
              type="button"
              onClick={() => onAction("more")}
              className="min-h-[44px] flex-1 cursor-pointer rounded-2xl border px-4 py-3 text-sm font-medium transition"
              style={{ borderColor: T.border, color: T.text }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = T.bgCardHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Действия
            </button>
            <button
              type="button"
              onClick={onDismissLead}
              className="min-h-[44px] flex-1 cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold transition enabled:hover:brightness-110"
              style={{ background: "#dc2626", color: "#ffffff" }}
            >
              Закрыть лид
            </button>
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  expanded,
  onToggle,
  T,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  T: ThemeTokens;
  children: ReactNode;
}) {
  return (
    <section className="glass-panel rounded-[24px] p-3 md:p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-[44px] w-full cursor-pointer items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" style={{ color: T.accent }} aria-hidden />
          <h3 className="text-base font-semibold md:text-lg" style={{ color: T.text }}>
            {title}
          </h3>
          {count !== undefined && (
            <span className="text-sm" style={{ color: T.textMuted }}>
              {count}
            </span>
          )}
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
            <div className="mt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
