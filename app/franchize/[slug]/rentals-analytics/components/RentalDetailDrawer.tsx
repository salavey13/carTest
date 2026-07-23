"use client";

// /analytics/components/RentalDetailDrawer.tsx
//
// Full 10-section rental detail drawer — mirrors LeadDetailDrawer pattern.
//
// Sections:
//   1. Header          — bike title, renter ФИО, status badge, close button
//   2. Primary actions  — Activate / Complete / Cancel / Open rental page
//   3. SLA overview     — 4 indicators (days active, overdue todos, until return, docs)
//   4. Info grid        — bike, renter, phone, status, payment, start, end, cost, deposit, operator, crew
//   5. Documents        — 5-item checklist with verify/request actions
//   6. Todos            — this rental's todos only, with All/Mine/Overdue sub-filters
//   7. Handoff          — odometer before/after, equipment checklist, damage notes
//   8. Notes            — this rental's notes + add-note input
//   9. History          — timeline of events
//  10. Sticky footer    — "Открыть аренду →"
//
// Mobile: rendered inside AnalyticsMobileSheet (slide-up, 88vh).
// Desktop: right-side panel (max-w-[640px]) — backdrop handled by parent.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Briefcase,
  Wrench,
  ClipboardCheck,
  StickyNote,
  History as HistoryIcon,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import type {
  DrawerRentalRow,
  RentalTodo,
  DrawerAction,
} from "./types";
import {
  DrawerSection,
  DrawerInfoGrid,
  DrawerSlaOverview,
  DrawerPrimaryActions,
  DrawerStickyFooter,
  DrawerTodoRow,
  DrawerHistoryRow,
  DrawerAddNoteInput,
  DrawerEmptyHint,
  type InfoTile,
  type PrimaryAction,
} from "./DrawerPrimitives";
import {
  computeDocStatus,
  computeSlaSignals,
  formatRubles,
  formatDateTime,
  getInitials,
  getRentalBikeTitle,
  getRenterName,
  getRentalStatusMeta,
} from "./lib/analytics-utils";

interface RentalDetailDrawerProps {
  rental: DrawerRentalRow;
  onClose: () => void;
  onAction: (action: DrawerAction) => void;
  onAddNote?: (text: string) => void;
  T: ThemeTokens;
  /** When true, render as the inner content of AnalyticsMobileSheet (no backdrop). */
  asSheetChild?: boolean;
}

type TodoFilter = "all" | "mine" | "overdue";

export function RentalDetailDrawer({
  rental,
  onClose,
  onAction,
  onAddNote,
  T,
  asSheetChild = false,
}: RentalDetailDrawerProps) {
  const [todoFilter, setTodoFilter] = useState<TodoFilter>("all");
  const [newNote, setNewNote] = useState("");
  const [openDocs, setOpenDocs] = useState(true);
  const [openTasks, setOpenTasks] = useState(true);
  const [openHandoff, setOpenHandoff] = useState(true);
  const [openNotes, setOpenNotes] = useState(true);
  const [openHistory, setOpenHistory] = useState(false);

  const statusMeta = getRentalStatusMeta(rental.status);
  const bikeTitle = getRentalBikeTitle(rental);
  const renterName = getRenterName(rental);
  const initials = getInitials(renterName);
  const cost = Number(rental.total_cost) || 0;
  const docs = computeDocStatus(rental);
  const sla = computeSlaSignals(rental);
  const phone = (rental.metadata as Record<string, unknown> | null)?.phone as string | undefined;
  const deposit = (rental.metadata as Record<string, unknown> | null)?.deposit as number | undefined;
  const handoff = rental.handoff;

  // Primary actions (Section 2)
  const primaryActions: PrimaryAction[] = [
    { icon: CheckCircle2, label: "Активировать", action: "activate", color: "#22c55e" },
    { icon: CheckCircle2, label: "Завершить",    action: "complete", color: "#3b82f6" },
    { icon: X,            label: "Отменить",     action: "cancel",   color: "#ef4444" },
    { icon: ExternalLink, label: "Открыть",      action: "open_rental", color: "#8b5cf6" },
  ];

  // Info grid (Section 4)
  const infoItems: InfoTile[] = [
    { label: "Байк",            value: bikeTitle },
    { label: "Арендатор",       value: renterName },
    { label: "Телефон",         value: phone || "—", copyable: !!phone },
    { label: "Статус",          value: statusMeta.label, tone: statusMeta.color === "#22c55e" ? "good" : statusMeta.color === "#ef4444" ? "danger" : "neutral" },
    { label: "Оплата",          value: rental.payment_status || "—" },
    { label: "Начало",          value: formatDateTime(rental.agreed_start_date || rental.requested_start_date) },
    { label: "Конец",           value: formatDateTime(rental.agreed_end_date || rental.requested_end_date) },
    { label: "Стоимость",       value: formatRubles(cost) },
    { label: "Депозит",         value: deposit != null ? formatRubles(deposit) : "—" },
    { label: "Оператор",        value: rental.created_by_operator_chat_id || "—" },
    { label: "Экипаж",          value: rental.crew_id || "—" },
    { label: "Создана",         value: formatDateTime(rental.created_at) },
  ];

  // Filtered todos (Section 6)
  const filteredTodos: RentalTodo[] = rental.todos.filter((t) => {
    if (todoFilter === "overdue") {
      return (
        !!t.due_date &&
        new Date(t.due_date).getTime() < Date.now() &&
        t.status !== "done"
      );
    }
    if (todoFilter === "mine") {
      // "Mine" in analytics = assigned to current operator (created_by_operator_chat_id)
      return (
        t.assigned_to === rental.created_by_operator_chat_id &&
        !!rental.created_by_operator_chat_id
      );
    }
    return true;
  });

  // History events (Section 9)
  const history = rental.history.length
    ? rental.history
    : [
        { type: "created", timestamp: rental.created_at, label: "Аренда создана", color: "#3b82f6" },
        ...(rental.agreed_start_date
          ? [{ type: "started", timestamp: rental.agreed_start_date, label: "Аренда началась", color: "#22c55e" }]
          : []),
        ...(rental.status === "completed" && rental.agreed_end_date
          ? [{ type: "completed", timestamp: rental.agreed_end_date, label: "Аренда завершена", color: "#3b82f6" }]
          : []),
      ];

  const submitNote = () => {
    if (!newNote.trim() || !onAddNote) return;
    onAddNote(newNote.trim());
    setNewNote("");
  };

  // Document checklist (Section 5)
  const docItems: Array<{ label: string; present: boolean; url?: string | null }> = [
    { label: "Паспорт (основная)",        present: !!rental.passport_mainpage_photo,         url: rental.passport_mainpage_photo },
    { label: "Паспорт (регистрация)",     present: !!rental.passport_registration_photo,     url: rental.passport_registration_photo },
    { label: "Вод. удостоверение (лицо)", present: !!rental.drivers_licence_frontal_photo,   url: rental.drivers_licence_frontal_photo },
  ];
  const md = (rental.metadata || {}) as Record<string, unknown>;
  docItems.push({
    label: "Паспорт (оборот)",
    present: typeof md.passport_backpage_photo === "string" && md.passport_backpage_photo.length > 0,
    url: md.passport_backpage_photo as string | undefined,
  });
  docItems.push({
    label: "Вод. удостоверение (оборот)",
    present: typeof md.drivers_licence_back_photo === "string" && md.drivers_licence_back_photo.length > 0,
    url: md.drivers_licence_back_photo as string | undefined,
  });

  // Equipment checklist (Section 7)
  const equipmentChecklist = handoff?.equipment_checklist ?? {};
  const equipmentEntries = Object.entries(equipmentChecklist);

  const content = (
    <>
      {/* 1. Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold md:h-14 md:w-14"
            style={{ background: `${statusMeta.color}26`, color: statusMeta.color }}
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h2
              className="truncate text-lg font-semibold tracking-tight md:text-xl"
              style={{ color: T.text }}
            >
              {bikeTitle}
            </h2>
            <div className="mt-1 text-sm" style={{ color: T.textMuted }}>
              {renterName}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-medium"
                style={{ background: `${statusMeta.color}1a`, color: statusMeta.color }}
              >
                {statusMeta.label}
              </span>
              <span
                className="rounded-full px-3 py-1 text-[11px]"
                style={{ background: T.bgCard, color: T.textMuted }}
              >
                {formatRubles(cost)}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть панель"
          className="cursor-pointer rounded-lg p-2.5 transition focus:outline-none focus-visible:ring-2"
          style={{
            color: T.textMuted,
            minHeight: "44px",
            minWidth: "44px",
          }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 2. Primary actions */}
      <div className="mt-5">
        <DrawerPrimaryActions
          actions={primaryActions}
          onAction={(a) => onAction(a as DrawerAction)}
          T={T}
        />
      </div>

      {/* 3. SLA overview */}
      <div className="mt-5">
        <DrawerSlaOverview signals={sla} T={T} />
      </div>

      {/* 4. Info grid */}
      <div className="mt-5">
        <DrawerInfoGrid items={infoItems} T={T} />
      </div>

      {/* 5. Documents */}
      <div className="mt-5">
        <DrawerSection
          title="Документы"
          icon={FileText}
          count={docs.count}
          expanded={openDocs}
          onToggle={() => setOpenDocs(!openDocs)}
          T={T}
          rightAction={
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: docs.complete ? "#22c55e15" : docs.count <= 1 ? "#ef444415" : "#f59e0b15",
                color: docs.complete ? "#22c55e" : docs.count <= 1 ? "#ef4444" : "#f59e0b",
              }}
            >
              {docs.count}/{docs.total}
            </span>
          }
        >
          <div className="space-y-1.5">
            {docItems.map((d, i) => (
              <div
                key={i}
                className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border p-2.5"
                style={{
                  borderColor: T.border,
                  backgroundColor: T.bgElevated,
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {d.present ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      style={{ color: "#22c55e" }}
                      aria-hidden
                    />
                  ) : (
                    <AlertCircle
                      className="h-4 w-4 shrink-0"
                      style={{ color: "#ef4444" }}
                      aria-hidden
                    />
                  )}
                  <span
                    className="truncate text-sm"
                    style={{ color: T.text }}
                  >
                    {d.label}
                  </span>
                </div>
                {d.present && d.url ? (
                  <a
                    href={typeof d.url === "string" ? d.url : "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg px-3 py-2 text-[11px] font-medium transition hover:opacity-80 focus:outline-none focus-visible:ring-2"
                    style={{
                      backgroundColor: T.bgCard,
                      color: T.textMuted,
                      minHeight: "44px",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                    aria-label={`Открыть: ${d.label}`}
                  >
                    Открыть
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAction("request_docs")}
                    className="shrink-0 rounded-lg px-3 py-2 text-[11px] font-medium transition hover:opacity-80 focus:outline-none focus-visible:ring-2"
                    style={{
                      backgroundColor: "#f59e0b15",
                      color: "#f59e0b",
                      minHeight: "44px",
                    }}
                  >
                    Запросить
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onAction("verify_docs")}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2"
            style={{
              borderColor: T.border,
              backgroundColor: T.bgCard,
              color: T.text,
              minHeight: "44px",
            }}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Верифицировать документы
          </button>
        </DrawerSection>
      </div>

      {/* 6. Todos */}
      <div className="mt-4">
        <DrawerSection
          title="Задачи аренды"
          icon={Briefcase}
          count={rental.todos.length}
          expanded={openTasks}
          onToggle={() => setOpenTasks(!openTasks)}
          T={T}
        >
          <div
            className="mb-2 flex gap-1 rounded-xl border p-1"
            style={{ borderColor: T.border, backgroundColor: T.bgElevated }}
            role="tablist"
            aria-label="Фильтр задач"
          >
            {([
              { key: "all" as const, label: "Все" },
              { key: "mine" as const, label: "Мои" },
              { key: "overdue" as const, label: "Просроч." },
            ]).map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={todoFilter === f.key}
                onClick={() => setTodoFilter(f.key)}
                className="flex-1 rounded-lg py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2"
                style={{
                  backgroundColor: todoFilter === f.key ? T.bgCard : "transparent",
                  color: todoFilter === f.key ? T.text : T.textMuted,
                  minHeight: "44px",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredTodos.length === 0 ? (
            <DrawerEmptyHint label="Задач нет" T={T} />
          ) : (
            <div className="space-y-1.5">
              {filteredTodos.map((todo) => (
                <DrawerTodoRow
                  key={todo.id}
                  title={todo.title}
                  status={todo.status}
                  priority={todo.priority}
                  dueDate={todo.due_date}
                  assigneeName={todo.assigned_name}
                  T={T}
                />
              ))}
            </div>
          )}
        </DrawerSection>
      </div>

      {/* 7. Handoff */}
      <div className="mt-4">
        <DrawerSection
          title="Передача байка"
          icon={ClipboardCheck}
          expanded={openHandoff}
          onToggle={() => setOpenHandoff(!openHandoff)}
          T={T}
          rightAction={
            handoff?.handoff_at ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "#22c55e15", color: "#22c55e" }}
              >
                Передан
              </span>
            ) : (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "#f59e0b15", color: "#f59e0b" }}
              >
                Ожидает
              </span>
            )
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <div
              className="rounded-xl border p-2.5"
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}
            >
              <p className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>
                Одометр до
              </p>
              <p className="mt-0.5 text-sm font-medium tabular-nums" style={{ color: T.text }}>
                {handoff?.odometer_before != null ? `${handoff.odometer_before} км` : "—"}
              </p>
            </div>
            <div
              className="rounded-xl border p-2.5"
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}
            >
              <p className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>
                Одометр после
              </p>
              <p className="mt-0.5 text-sm font-medium tabular-nums" style={{ color: T.text }}>
                {handoff?.odometer_after != null ? `${handoff.odometer_after} км` : "—"}
              </p>
            </div>
          </div>

          {equipmentEntries.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>
                Снаряжение
              </p>
              {equipmentEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex min-h-[36px] items-center justify-between rounded-lg border p-2 text-xs"
                  style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}
                >
                  <span style={{ color: T.text }}>{key}</span>
                  {value ? (
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#22c55e" }} aria-hidden />
                  ) : (
                    <X className="h-3.5 w-3.5" style={{ color: "#ef4444" }} aria-hidden />
                  )}
                </div>
              ))}
            </div>
          )}

          {handoff?.damage_notes && (
            <div
              className="mt-2 rounded-xl border p-2.5"
              style={{ borderColor: "#ef444433", backgroundColor: "#ef444408" }}
            >
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#ef4444" }}>
                Повреждения
              </p>
              <p className="mt-0.5 text-sm" style={{ color: T.text }}>
                {handoff.damage_notes}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => onAction("more")}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2"
            style={{
              borderColor: T.border,
              backgroundColor: T.bgCard,
              color: T.text,
              minHeight: "44px",
            }}
          >
            <Wrench className="h-4 w-4" aria-hidden />
            {handoff?.handoff_at ? "Обновить акт передачи" : "Провести передачу"}
          </button>
        </DrawerSection>
      </div>

      {/* 8. Notes */}
      <div className="mt-4">
        <DrawerSection
          title="Заметки"
          icon={StickyNote}
          count={rental.notes.length}
          expanded={openNotes}
          onToggle={() => setOpenNotes(!openNotes)}
          T={T}
        >
          {onAddNote && (
            <div className="mb-2">
              <DrawerAddNoteInput
                value={newNote}
                onChange={setNewNote}
                onSubmit={submitNote}
                T={T}
              />
            </div>
          )}
          {rental.notes.length === 0 ? (
            <DrawerEmptyHint label="Заметок нет" T={T} />
          ) : (
            <div className="space-y-1.5">
              {rental.notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border p-2.5"
                  style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}
                >
                  <p className="text-sm" style={{ color: T.text }}>
                    {note.text}
                  </p>
                  <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>
                    {note.created_by || "Аноним"} · {formatDateTime(note.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DrawerSection>
      </div>

      {/* 9. History */}
      <div className="mt-4">
        <DrawerSection
          title="История"
          icon={HistoryIcon}
          count={history.length}
          expanded={openHistory}
          onToggle={() => setOpenHistory(!openHistory)}
          T={T}
        >
          {history.length === 0 ? (
            <DrawerEmptyHint label="Событий нет" T={T} />
          ) : (
            <div>
              {history.map((event, i) => (
                <DrawerHistoryRow
                  key={i}
                  label={event.label}
                  timestamp={event.timestamp}
                  detail={event.detail}
                  color={event.color || (event.icon === "check" ? "#22c55e" : "#3b82f6")}
                  T={T}
                />
              ))}
            </div>
          )}
        </DrawerSection>
      </div>

      {/* 10. Sticky footer */}
      <DrawerStickyFooter
        label="Открыть аренду"
        icon={ExternalLink}
        onClick={() => onAction("open_rental")}
        T={T}
      />
    </>
  );

  // When used as a child of AnalyticsMobileSheet, we just return the content
  // (the sheet provides backdrop + animation).
  if (asSheetChild) {
    return content;
  }

  // Desktop: right-side drawer with backdrop.
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 hidden justify-end lg:flex"
        style={{ background: "color-mix(in srgb, #000000 60%, transparent)" }}
        onClick={onClose}
      >
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex h-full w-full flex-col lg:max-w-[640px]"
          style={{
            background: T.bg,
            borderLeft: `1px solid ${T.border}`,
            boxShadow: "0 0 60px rgba(0,0,0,0.55)",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Аренда: ${bikeTitle}`}
        >
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-5">
            {content}
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
