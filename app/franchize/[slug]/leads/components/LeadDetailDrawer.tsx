"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Phone,
  Send,
  Bell,
  MoreHorizontal,
  X,
  CheckCircle2,
  Flame,
  ChevronDown,
  ChevronRight,
  Briefcase,
  StickyNote,
  Plus,
  ExternalLink,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { LeadRow, LeadTodoRow } from "../leads-types";
import type {
  LeadSignal,
  LeadHistoryEvent,
} from "../leads-constants";
import type { ThemeTokens } from "../hooks/useTheme";
import {
  STAGE_LABELS,
  STAGE_COLORS,
  STAGE_NEXT_ACTION,
  type StageKey,
} from "../lib/pipeline-stages";
import { SOURCE_META, RENTAL_STATUS_META } from "../leads-constants";
import {
  getInitials,
  relativeTime,
  fmtMoney,
  formatDate,
} from "../leads-utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LeadSLAOverview } from "./LeadSLAOverview";
import type { LeadPriority } from "../lib/lead-priority";
import { LeadInfoGrid, type InfoTile } from "./LeadInfoGrid";
import {
  LeadDocumentsSection,
  type DocumentItem,
  type QrStatus,
} from "./LeadDocumentsSection";
import { LeadHistorySection } from "./LeadHistorySection";
import { LeadHandlingSection } from "./LeadHandlingSection";
import { getLeadHandling, isHandlingTodo } from "../lib/lead-handling";

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
  /** Priority Score 0–100 (ТЗ) — индекс для плашки в шапке шторки. */
  priority?: LeadPriority;
  /** Crew slug — used to build SPA links to rental details. */
  slug: string;
  T: ThemeTokens;
  onClose: () => void;
  onAction: (action: string) => void;
  onCreateTodo: (title: string) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onAddNote: (text: string) => void;
  onDismissLead: () => void;
  /** «Отработан» / «Перезвонить в ...» — панель и колбэки (см. LeadHandlingSection). */
  onMarkHandled?: (handled: boolean) => void;
  onSetCallback?: (iso: string, note: string) => void;
  onCompleteCallback?: () => void;
  onClearCallback?: () => void;
  handlingBusy?: boolean;
  /** m4 fix: true while a Telegram notify is in flight — disables the button. */
  notifyBusy?: boolean;
  /** When true, render as the inner content of a parent sheet/drawer (no
   *  backdrop, no right-side panel chrome, no z-index). Used by the adaptive
   *  LeadDetailSheet so the sheet provides the backdrop + animation and this
   *  component only renders the content sections. */
  asSheetChild?: boolean;
  /** «Прочитать заметки»: метка времени последнего клика по флажку заметок
   *  этого лида. При изменении — раскрыть секцию заметок и плавно прокрутить
   *  к ней (просьба босса: заметки должны быть видны из списка одним тапом). */
  focusNotesSignal?: number;
}

type TodoFilter = "all" | "mine" | "overdue";

/**
 * Lead detail content — sections 1-9 + action footer.
 *
 * 2026-09-01 REWORK (sheet overhaul):
 *   • ONE body for both modes — previously the sheet-child mode silently
 *     dropped sections 6-9 (documents/tasks/notes/history), so the mobile
 *     sheet showed far less than the desktop drawer.
 *   • Deal rows are now SPA links to the rental details page
 *     (/franchize/[slug]/rental/[rentalId]) — mirrors the bike wall.
 *   • Avito leads get a deep-link button (chat/listing URL from the webhook
 *     metadata) + an info tile with the captured chat id and last message.
 */
export function LeadDetailDrawer(props: Props) {
  const {
    lead,
    todos,
    notes,
    signals,
    history,
    docs,
    slug,
    T,
    onClose,
    onAction,
    onCreateTodo,
    onToggleTodo,
    onDeleteTodo,
    onAddNote,
    onDismissLead,
    onMarkHandled,
    onSetCallback,
    onCompleteCallback,
    onClearCallback,
    handlingBusy = false,
    notifyBusy = false,
    asSheetChild = false,
    focusNotesSignal = 0,
  } = props;

  // NOTE: We CANNOT early-return before hooks (React rules-of-hooks).
  // All hooks below handle null `lead` gracefully via null-safe accessors
  // (the `(lead as ...)` casts + `|| "fallback"` pattern). The actual
  // null-guard render happens at the bottom of this component, after all
  // hooks have been called.

  // Cast: the server may send any string, but the Record lookups below all
  // have fallbacks — an unknown stageKey degrades to the gray palette safely.
  const stageKey = (((lead as { stageKey?: string } | null)?.stageKey || "new") as StageKey);
  const stageColor = STAGE_COLORS[stageKey] || "#64748b";
  const stageLabel = STAGE_LABELS[stageKey] || stageKey;
  const displayName = lead?.full_name || "Без имени";
  const initials = getInitials(lead?.full_name);
  const rel = relativeTime(lead?.lastSeenAt || lead?.createdAt);
  const isHot = signals.some((s) => s.tone === "danger");
  const assignee = lead?.assigneeName || lead?.assigneeId || "—";
  const avito = lead?.avito ?? null;

  const [todoFilter, setTodoFilter] = useState<TodoFilter>("all");
  const [newTodo, setNewTodo] = useState("");
  const [newNote, setNewNote] = useState("");
  const [openDeals, setOpenDeals] = useState(true);
  const [openDocs, setOpenDocs] = useState(true);
  const [openTasks, setOpenTasks] = useState(true);
  const [openNotes, setOpenNotes] = useState(true);
  const [openHistory, setOpenHistory] = useState(false);

  // «Прочитать заметки» — раскрыть секцию заметок и прокрутить к ней.
  // Ждём 350 мс: шторка успевает отыграть входную анимацию (иначе
  // scrollIntoView срабатывает, пока контент ещё «на месте» не отрендерился).
  const notesSectionRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusNotesSignal) return;
    setOpenNotes(true);
    const t = setTimeout(() => {
      notesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => clearTimeout(t);
  }, [focusNotesSignal]);

  const infoItems: InfoTile[] = [
    { label: "Телефон", value: lead?.phone || "—", copyable: !!lead?.phone },
    { label: "TG ID", value: lead?.user_id || "—", copyable: !!lead?.user_id },
    { label: "Байк", value: lead?.bikeTitle || "—" },
    { label: "Стадия", value: stageLabel, tone: "accent" },
    {
      label: "Приоритет",
      value: `${lead?.urgencyScore ?? 0}/100`,
      tone:
        (lead?.urgencyScore ?? 0) >= 80
          ? "danger"
          : (lead?.urgencyScore ?? 0) >= 60
            ? "warning"
            : "default",
    },
    { label: "Источник", value: SOURCE_META[lead?.source]?.label || lead?.source || "—" },
    { label: "Канал", value: lead?.contactChannel || "—" },
    { label: "Маршрут", value: lead?.sourceRoute || "—", copyable: !!lead?.sourceRoute },
    { label: "Первый контакт", value: lead?.createdAt ? formatDate(lead?.createdAt) : "—" },
    { label: "Последняя активность", value: rel || "—" },
    { label: "Ответственный", value: assignee },
    { label: "Следующее действие", value: STAGE_NEXT_ACTION[stageKey] || "—" },
  ];
  // 👤 Операторы лида (просьба босса): кто создал через /doc и кто трогал
  // последним (автор последней заметки). Добавляются в сетку только когда
  // реально известны — пустых плиток не плодим.
  if (lead?.ownerName) {
    infoItems.push({
      label: "Создал (/doc)",
      value: lead.ownerName,
    });
  }
  if (lead?.lastTouchedBy) {
    const touchRel = lead.lastNoteAt ? relativeTime(lead.lastNoteAt) : "";
    infoItems.push({
      label: "Последний оператор",
      value: lead.lastTouchedBy + (touchRel ? ` · ${touchRel}` : ""),
    });
  }
  if (avito?.chatId) {
    infoItems.push({
      label: "Avito чат",
      value: `ID ${avito.chatId}`,
      copyable: true,
      href: avito.itemUrl || avito.profileUrl || undefined,
    });
  }
  if (avito?.itemId) {
    infoItems.push({ label: "Avito объявление", value: String(avito.itemId) });
  }

  // Handling-состояние («отработан»/«перезвонить») выводим собственной
  // панелью — из общего списка задач их скрываем, чтобы не дублировать.
  const handling = getLeadHandling(todos);
  const visibleTodos = todos.filter((t) => !isHandlingTodo(t));

  // FIX (codereview): фильтр «Мои» сравнивал t.assigned_to (числовой chat_id
  // оператора) с assignee — а это СНАЧАЛА человекочитаемое ИМЯ
  // (assigneeName от сервера). Имя ≠ id, поэтому фильтр всегда показывал
  // «Нет задач». Сравниваем с assigneeId (id), имя — легаси-фолбэк.
  const assigneeId = lead?.assigneeId || null;
  const assigneeLabel = assignee !== "—" ? assignee : null;
  const filteredTodos = visibleTodos.filter((t) => {
    if (todoFilter === "overdue")
      return (
        !!t.due_date &&
        new Date(t.due_date).getTime() < Date.now() &&
        t.status !== "done"
      );
    if (todoFilter === "mine") {
      if (!assigneeId && !assigneeLabel) return false;
      return (!!assigneeId && t.assigned_to === assigneeId) ||
        (!!assigneeLabel && t.assigned_to === assigneeLabel);
    }
    return true;
  });

  const qrStatus: QrStatus = (() => {
    const isClaimed =
      lead?.identityState === "claimed_user" || lead?.identityState === "merged";
    if (!lead?.originalOperatorChatId)
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
    disabled?: boolean;
  }> = [
    { icon: Phone, label: "Позвонить", action: "call", color: "#22c55e", disabled: !lead?.phone },
    { icon: Send, label: "Написать в TG", action: "telegram", color: "#3b82f6" },
    { icon: Bell, label: "Уведомить", action: "notify", color: "#eab308", disabled: notifyBusy },
    { icon: MoreHorizontal, label: "Ещё", action: "more", color: "#64748b" },
  ];

  // ── Null-guard render ──
  // Now that all hooks have been called, we can safely bail if lead is null.
  // This happens AFTER hooks so React's rules-of-hooks are satisfied.
  if (!lead || typeof lead !== "object") {
    return null;
  }

  const copyText = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // n7 fix: mobile TG WebView often denies clipboard — do not fail silently.
      toast.error(`Не удалось скопировать ${label}`);
    }
  };

  // "Действия" dropdown — local, zero-latency actions that don't need the
  // parent's server wiring (clipboard + external links). Destructive
  // "Закрыть лид" stays a separate explicit button.
  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="min-h-[44px] flex-1 cursor-pointer rounded-2xl border px-4 py-3 text-sm font-medium transition"
          style={{ borderColor: T.border, color: T.text }}
        >
          Действия
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem
          disabled={!lead.phone}
          onSelect={() => void copyText(lead.phone || "", "phone")}
        >
          📞 Скопировать телефон
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copyText(lead.user_id, "tg id")}>
          🆔 Скопировать TG ID
        </DropdownMenuItem>
        {avito?.itemUrl ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={avito.itemUrl} target="_blank" rel="noreferrer noopener">
                🟢 Открыть чат Авито
              </a>
            </DropdownMenuItem>
          </>
        ) : null}
        {avito?.lastMessage ? (
          <DropdownMenuItem onSelect={() => void copyText(avito.lastMessage || "", "msg")}>
            💬 Скопировать последнее сообщение
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onClose}>↩ Закрыть панель</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ONE shared body — sections 1-9. Both the sheet-child mode (inside the
  // adaptive LeadDetailSheet) and the desktop right-drawer mode render the
  // SAME content; only the wrapper (backdrop/aside chrome + footer anchoring)
  // differs. Previously the sheet mode silently dropped sections 6-9.
  // ─────────────────────────────────────────────────────────────────────────
  const body: ReactNode = (
    <>
      {/* 1. Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold md:h-14 md:w-14"
            style={{ background: `${stageColor}26`, color: stageColor }}
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className="truncate text-lg font-semibold tracking-tight md:text-xl"
                style={{ color: T.text }}
              >
                {displayName}
              </h2>
              {lead?.verified && (
                <CheckCircle2
                  className="h-5 w-5"
                  style={{ color: "#22c55e" }}
                  aria-label="Подтверждён"
                />
              )}
              {isHot && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ background: "#ef444426", color: "#ef4444" }}
                >
                  <Flame className="h-3 w-3" aria-hidden /> Горячий
                </span>
              )}
            </div>
            <div className="mt-1 text-sm" style={{ color: T.textMuted }}>
              {lead?.phone || "—"} • {rel}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className="rounded-full px-3 py-1 text-[11px]"
                style={{ background: `${stageColor}1a`, color: stageColor }}
              >
                {stageLabel}
              </span>
              {lead?.username && (
                <span
                  className="rounded-full px-3 py-1 text-[11px]"
                  style={{ background: T.bgCard, color: T.textMuted }}
                >
                  @{lead.username}
                </span>
              )}
              {/* 👤 Оператор, создавший лида через /doc — виден сразу при
                  открытии шторки (просьба босса), пока нет заметок. */}
              {lead?.ownerName && (
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                  style={{ background: "#06b6d415", color: "#0891b2" }}
                  title={`Лид создан через /doc оператором: ${lead.ownerName}`}
                >
                  👤 {lead.ownerName} · /doc
                </span>
              )}
              {/* ✍ Последний оператор, трогавший лида (автор последней
                  заметки) — главный маркер на карточке и в шторке. */}
              {lead?.lastTouchedBy && (
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                  style={{ background: "#8b5cf615", color: "#7c3aed" }}
                  title={`Последняя активность оператора: ${lead.lastTouchedBy}${lead.lastNoteAt ? " оставил заметку " + relativeTime(lead.lastNoteAt) : ""}`}
                >
                  ✍ {lead.lastTouchedBy}
                  {lead.lastNoteAt ? ` · ${relativeTime(lead.lastNoteAt)}` : ""}
                </span>
              )}
              {lead?.contactChannel === "avito" && (
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                  style={{ background: "#0af133", color: "#0b2b13" }}
                >
                  Avito
                </span>
              )}
            </div>
          </div>
        </div>
        {/* In sheet-child mode the sheet itself provides the close button —
            hide the duplicate to avoid two Xs stacked on mobile. */}
        {!asSheetChild && (
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
        )}
      </div>

      {/* 1a. Priority Score (ТЗ) — компактная плашка под шапкой: итоговый
          индекс 0–100 + подсказки «свежий» / «канал ×2». Менеджер сразу
          видит, насколько этот контакт важен, до чтения деталей. */}
      {props.priority && (
        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5"
          style={{
            borderColor: props.priority.isHot ? "#ef444455" : T.border,
            background: props.priority.isHot ? "#ef44440f" : "transparent",
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold tabular-nums"
              style={
                props.priority.isHot
                  ? { backgroundColor: "#ef444420", color: "#ef4444" }
                  : (props.priority.score ?? 0) >= 50
                    ? { backgroundColor: "#f59e0b20", color: "#f59e0b" }
                    : { backgroundColor: T.borderSoft, color: T.textFaint }
              }
            >
              Индекс: {props.priority.score}/100
            </span>
            {props.priority.isFresh && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
                style={{ backgroundColor: "#3b82f620", color: "#3b82f6" }}
              >
                ⚡ Свежий
              </span>
            )}
            {props.priority.channelMultiplier > 1 && (
              <span
                className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold"
                style={{ backgroundColor: "#0a8f2a1a", color: "#0a8f2a" }}
                title="Приоритет ×2 — горячий канал"
              >
                ×{props.priority.channelMultiplier}
              </span>
            )}
          </div>
          <span className="shrink-0 text-[10px] uppercase tracking-wide" style={{ color: T.textFaint }}>
            Приоритет
          </span>
        </div>
      )}

      {/* 1b. Avito deep link — opens the captured chat/listing URL */}
      {avito?.itemUrl && (
        <a
          href={avito.itemUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition active:scale-[0.99]"
          style={{ borderColor: "#22c55e55", background: "#22c55e12", color: "#16a34a" }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Открыть чат Авито</span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
        </a>
      )}

      {/* 1c. Работа с лидом — «Отработан» + «Перезвонить в ...».
          Просьба босса: состояние видно и меняется прямо в шторке, а плашки
          с назначенным временем — сразу в списке/таблице/канбане. */}
      {onMarkHandled && onSetCallback && (
        <LeadHandlingSection
          handling={handling}
          T={T}
          busy={handlingBusy}
          onMarkHandled={onMarkHandled}
          onSetCallback={onSetCallback}
          onCompleteCallback={onCompleteCallback ?? (() => {})}
          onClearCallback={onClearCallback ?? (() => {})}
        />
      )}

      {/* 2. Primary actions — 2x2 grid on mobile, 4-col on desktop */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {primaryActions.map((b) => {
          const Icon = b.icon;
          return (
            <motion.button
              key={b.action}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: b.disabled ? 0 : -1 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              onClick={() => onAction(b.action)}
              disabled={b.disabled}
              className="flex min-h-[88px] cursor-pointer flex-col items-start justify-between rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 md:min-h-[100px] md:p-4"
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

      {/* 5. Deals — rows are SPA links to the rental details page */}
      <div className="mt-5">
        <Section
          title="Сделки"
          icon={Briefcase}
          count={(lead?.rentals?.length ?? 0) + (lead?.sales?.length ?? 0)}
          expanded={openDeals}
          onToggle={() => setOpenDeals(!openDeals)}
          T={T}
        >
          <div className="space-y-2">
            {(!lead?.rentals || lead.rentals.length === 0) && (!lead?.sales || lead.sales.length === 0) && (
              <p className="text-sm" style={{ color: T.textMuted }}>
                Сделок нет
              </p>
            )}
            {lead?.rentals && lead.rentals.length > 0
              ? [...lead.rentals]
                  .sort((a, b) => {
                    // FIX («аренда отображается списком аренд с разными
                    // статусами»): сервер теперь дедупит сделки по rental_id,
                    // но ЛЕГИТИМНО у лида может быть несколько аренд (прошлые
                    // + текущая). Показываем самую релевантную сверху:
                    // active > confirmed > pending > completed > cancelled,
                    // при равенстве — свежее по дате начала.
                    const prio: Record<string, number> = {
                      active: 5, confirmed: 4, pending_confirmation: 3, completed: 2, cancelled: 1,
                    };
                    const pa = prio[a.status] ?? 0;
                    const pb = prio[b.status] ?? 0;
                    if (pa !== pb) return pb - pa;
                    return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime();
                  })
                  .map((r) => (
              <Link
                key={r.rentalId}
                href={`/franchize/${slug}/rental/${encodeURIComponent(r.rentalId)}`}
                className="flex min-h-[44px] items-center justify-between rounded-2xl border p-3 transition hover:bg-black/[0.03]"
                style={{
                  borderColor: T.border,
                  background: T.bgCard,
                }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: T.text }}>
                    {r.bikeTitle || "Аренда"}
                  </p>
                  <p className="text-[11px]" style={{ color: T.textFaint }}>
                    {r.startDate ? formatDate(r.startDate) : "—"} → {r.endDate ? formatDate(r.endDate) : "—"}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${RENTAL_STATUS_META[r.status]?.color || "#64748b"}15`,
                      color: RENTAL_STATUS_META[r.status]?.color || "#64748b",
                    }}
                  >
                    {RENTAL_STATUS_META[r.status]?.label || r.status}
                  </span>
                  <ChevronRight className="h-4 w-4" style={{ color: T.textFaint }} aria-hidden />
                </span>
              </Link>
              ))
              : null}
            {lead?.sales?.map((s) => (
              <div
                key={s.saleId}
                className="flex min-h-[44px] items-center justify-between rounded-2xl border p-3"
                style={{
                  borderColor: T.border,
                  background: T.bgCard,
                }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: T.text }}>
                    {s.bikeTitle || "Продажа"}
                  </p>
                  <p className="text-[11px]" style={{ color: T.textFaint }}>
                    {formatDate(s.createdAt)}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: "#f59e0b15",
                    color: "#f59e0b",
                  }}
                >
                  {fmtMoney(s.salePrice)}
                </span>
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
              { v: "all", label: `Все (${todos.length})`, color: "#eab308" },
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
                      {isDone && <CheckCircle2 className="h-3 w-3" style={{ color: T.accentContrast }} />}
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
                        style={{ color: isOverdue ? "#ef4444" : T.textMuted }}
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
      <div className="mt-5" ref={notesSectionRef} data-notes-section>
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
    </>
  );

  // ── Sheet-child mode: content only, no backdrop/aside wrapper ──
  // Rendered inside the adaptive LeadDetailSheet, which provides the
  // backdrop, the slide animation, the close affordances and the drag handle.
  if (asSheetChild) {
    return (
      <div className="relative flex w-full flex-col">
        <div className="flex-1 overflow-y-auto pb-2 pt-1">
          {body}
          {/* Sticky footer — action buttons (anchored to the sheet body) */}
          <div
            className="sticky bottom-0 left-0 right-0 mt-5 flex items-center gap-3 border-t p-3"
            style={{
              borderColor: T.border,
              background: T.bg,
            }}
          >
            {actionsMenu}
            <button
              type="button"
              onClick={onDismissLead}
              className="min-h-[44px] flex-1 cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold transition enabled:hover:brightness-110"
              style={{ background: "#ef4444", color: T.accentContrast }}
            >
              Закрыть лид
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop mode: full backdrop + right-side drawer ──
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        // z-[60]: above the sticky CrewHeader (z-50) so the header can never
        // cover the drawer's title row or close button, below toasts (z-[70]).
        className="fixed inset-0 z-[60] flex justify-end"
        style={{ background: "color-mix(in srgb, #000000 60%, transparent)" }}
        onClick={onClose}
      >
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          // Mobile fallback: full-width. Desktop: max-w-[640px] right-side drawer.
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
            {body}
          </div>

          {/* 10. Sticky footer — action buttons */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center gap-3 border-t p-4"
            style={{
              borderColor: T.border,
              background: T.bg,
              backdropFilter: "blur(12px)",
            }}
          >
            {actionsMenu}
            <button
              type="button"
              onClick={onDismissLead}
              className="min-h-[44px] flex-1 cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold transition enabled:hover:brightness-110"
              style={{ background: "#ef4444", color: T.accentContrast }}
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
