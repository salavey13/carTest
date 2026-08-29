"use client";

// /analytics/components/RentalDetailDrawer.tsx
//
// Full rental detail drawer — mirrors LeadDetailDrawer pattern.
//
// Sections:
//   1. Header          — bike title, renter ФИО (real renter, FIX F1), status badge, close button
//   2. Primary actions  — Activate / Complete / Cancel / Open rental page
//   3. SLA overview     — days in rental (FIX F8: start→end), until return
//   4. Info grid        — bike, renter, phone (F2), status, payment, start, end,
//                          cost, equipment part (F4), deposit (F3), operator (F11)
//   5. Todos            — this rental's todos linked via crew_todos.rental_id (F12)
//   6. Handoff          — odometer before/after (F5), equipment checklist, damage notes
//   7. Deposit          — deposit_entries live tracking + metadata fallback (F3)
//   8. Notes            — this rental's notes + add-note input + return notes
//   9. History          — timeline of events
//  10. Sticky footer    — "Открыть аренду →"
//
// FIX (F11): the documents checklist section is removed — rentals created via
// the /doc command already have verified documents; a photo-upload checklist
// is not relevant for this flow.
//
// Mobile: rendered inside AnalyticsMobileSheet (slide-up, 88vh).
// Desktop: right-side panel (max-w-[640px]) — backdrop handled by parent.

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  Briefcase,
  ClipboardCheck,
  StickyNote,
  History as HistoryIcon,
  ExternalLink,
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
  computeSlaSignals,
  formatRubles,
  formatDateTime,
  getDepositInfo,
  getEquipmentSummary,
  getHandoffStatus,
  getInitials,
  getPaymentSplit,
  getRentalBikeTitle,
  getRenterName,
  getRenterPhone,
  getRentalStatusMeta,
} from "./lib/analytics-utils";
import { DepositSection } from "./DepositSection";

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

// FIX (F13): lightweight shape of the /api/franchize/deposit-summary response
// — only the fields we read for the info grid tile + DepositSection fallback.
interface DepositSummaryDestination {
  destination: string; // 'cash' | 'tbank' | 'sber'
  collected: number;
  returned: number;
  penalty: number;
  net: number;
}
interface DepositSummaryLite {
  totalCollected: number;
  totalReturned: number;
  totalPenalty: number;
  balance: number;
  destinations: DepositSummaryDestination[];
  entries: Array<{
    id: string;
    entry_type: string;
    amount: number;
    direction: string;
    destination: string;
    operator_chat_id: string | null;
    notes: string | null;
    created_at: string;
  }>;
}

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
  const [openTasks, setOpenTasks] = useState(true);
  const [openHandoff, setOpenHandoff] = useState(true);
  const [openDeposit, setOpenDeposit] = useState(true);
  const [openNotes, setOpenNotes] = useState(true);
  const [openHistory, setOpenHistory] = useState(false);

  // FIX (F13): lift the deposit_entries summary into the drawer state so the
  // info grid tile (not just the DepositSection) can show the destination
  // card ("T-Банк" / "Сбербанк" / "Наличные") instead of the misleading
  // "способ не указан". This is a read-only fetch — the DepositSection still
  // owns the write-back (penalty withholding etc).
  const [depositSummary, setDepositSummary] = useState<DepositSummaryLite | null>(null);
  const loadDepositSummary = useCallback(async () => {
    try {
      const resp = await fetch(`/api/franchize/deposit-summary?rentalId=${rental.rental_id}`);
      if (resp.ok) {
        const data = (await resp.json()) as DepositSummaryLite;
        setDepositSummary(data);
      }
    } catch {
      // silent — falls back to metadata deposit
    }
  }, [rental.rental_id]);
  useEffect(() => { void loadDepositSummary(); }, [loadDepositSummary]);

  const statusMeta = getRentalStatusMeta(rental.status);
  const bikeTitle = getRentalBikeTitle(rental);
  const renterName = getRenterName(rental);
  const initials = getInitials(renterName);
  const cost = Number(rental.total_cost) || 0;
  const sla = computeSlaSignals(rental);
  // FIX (F2): renter phone from metadata.renter_phone / contract artifact
  const phone = getRenterPhone(rental);
  const md = (rental.metadata || {}) as Record<string, unknown>;
  // FIX (F3): deposit from metadata / contract artifact
  const deposit = getDepositInfo(rental);
  // FIX (F4): equipment included in this rent
  const equipment = getEquipmentSummary(rental);
  // Payment split (bank/cash/card destination)
  const paymentSplit = getPaymentSplit(rental);
  const handoff = rental.handoff;
  // FIX (F6): real handoff status — Передан / Возвращен / Ожидает
  const handoffStatus = getHandoffStatus(rental);

  // FIX (F13): resolve the deposit destination label (CARD1 T-Банк / CARD2
  // Сбербанк / Наличные) for the info grid tile. Prefer deposit_entries
  // (authoritative, set by the operator at handout), fall back to metadata
  // method, then to the contract's deposit_rub string.
  const depositDestinations = depositSummary?.destinations ?? [];
  const depositHasEntries = (depositSummary?.totalCollected ?? 0) > 0;
  const depositDestinationLabel = (() => {
    if (depositHasEntries && depositDestinations.length > 0) {
      const parts = depositDestinations.map((d) => {
        if (d.destination === "tbank") return "T-Банк";
        if (d.destination === "sber") return "Сбербанк";
        if (d.destination === "cash") return "Наличные";
        return d.destination;
      });
      return parts.join(" + ");
    }
    // Fallback to metadata method label (already Russian-friendly)
    return deposit.methodLabel;
  })();
  const depositReturnedFromEntries = (() => {
    if (!depositHasEntries) return deposit.returned;
    const totalReturned = depositSummary?.totalReturned ?? 0;
    const totalCollected = depositSummary?.totalCollected ?? 0;
    if (totalReturned === 0 && totalCollected > 0) return false;
    if (totalReturned >= totalCollected) return true;
    return null; // partial — neither fully returned nor fully held
  })();

  // Primary actions (Section 2)
  const primaryActions: PrimaryAction[] = [
    { icon: CheckCircle2, label: "Активировать", action: "activate", color: "#22c55e" },
    { icon: CheckCircle2, label: "Завершить",    action: "complete", color: "#3b82f6" },
    { icon: X,            label: "Отменить",     action: "cancel",   color: "#ef4444" },
    { icon: ExternalLink, label: "Открыть",      action: "open_rental", color: "#8b5cf6" },
  ];

  // Info grid (Section 4)
  // FIX (F11): «Экипаж» tile removed (we are already inside the crew context);
  // operator shows a resolved username instead of a raw chat id.
  const infoItems: InfoTile[] = [
    { label: "Байк",            value: bikeTitle },
    { label: "Арендатор",       value: renterName },
    { label: "Телефон",         value: phone || "—", copyable: !!phone },
    { label: "Статус",          value: statusMeta.label, tone: statusMeta.color === "#22c55e" ? "good" : statusMeta.color === "#ef4444" ? "danger" : "neutral" },
    { label: "Оплата",          value: paymentSplit.text || rental.payment_status || "—" },
    { label: "Начало",          value: formatDateTime(rental.agreed_start_date || rental.requested_start_date) },
    { label: "Конец",           value: formatDateTime(rental.agreed_end_date || rental.requested_end_date) },
    { label: "Стоимость",       value: formatRubles(cost) },
    // FIX (F4): equipment part of the total as a separate field
    equipment.text
      ? { label: "Экипировка",     value: equipment.cost > 0 ? `${equipment.text} (${formatRubles(equipment.cost)})` : equipment.text }
      : { label: "Экипировка",     value: "не включена" },
    // FIX (F3 + F13): deposit amount + destination card (T-Банк / Сбер / нал)
    // + return status. Prefer deposit_entries data; fall back to metadata.
    { label: "Депозит",
      value:
        deposit.amount != null && deposit.amount > 0
          ? `${formatRubles(deposit.amount)}${depositDestinationLabel ? ` · ${depositDestinationLabel}` : ""}${depositReturnedFromEntries === true ? " · возвращен" : depositReturnedFromEntries === false ? " · у держателя" : ""}`
          : "не записан",
    },
    { label: "Оператор",        value: rental.operatorName || "—" },
    // iter20: partner-owner tile for subrented bikes (50/50 revenue split) —
    // resolved server-side from cars.specs.subrenter_chat_id.
    ...(rental.subrenterLabel
      ? [{ label: "Субарендатор", value: rental.subrenterLabel }]
      : []),
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
        // /doc flow return confirmation event (metadata.history entries)
        ...((Array.isArray(md.history) ? md.history : []) as Array<Record<string, unknown>>)
          .filter((h) => typeof h.at === "string")
          .map((h) => ({
            type: String(h.status || "event"),
            timestamp: String(h.at),
            label: String(h.message || h.status || "Событие"),
            color: h.status === "completed" ? "#3b82f6" : "#64748b",
          })),
      ];

  const submitNote = () => {
    if (!newNote.trim() || !onAddNote) return;
    onAddNote(newNote.trim());
    setNewNote("");
  };

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

      {/* 5. Todos (FIX F12: linked via crew_todos.rental_id) */}
      <div className="mt-5">
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

      {/* 6. Handoff */}
      <div className="mt-4">
        <DrawerSection
          title="Передача байка"
          icon={ClipboardCheck}
          expanded={openHandoff}
          onToggle={() => setOpenHandoff(!openHandoff)}
          T={T}
          rightAction={
            handoffStatus.returned ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "#22c55e15", color: "#22c55e" }}
              >
                Возвращен
              </span>
            ) : handoffStatus.done ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "#3b82f615", color: "#3b82f6" }}
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
                {handoff?.odometer_before != null
                  ? `${handoff.odometer_before} км`
                  : handoff?.odometer_before_hint != null
                    // Order-creation hint (bike's last known mileage) — real value appears after pickup freeze
                    ? `≈${handoff.odometer_before_hint} км`
                    : "—"}
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

          {/* FIX (F4): equipment included in this rent — readable list with
              quantities + estimated cost part, from metadata.equipment.
              FIX (F2-iter2): charger shows "бесплатно" because it's free. */}
          {equipment.items.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>
                Снаряжение включено{equipment.cost > 0 ? ` · ~${equipment.cost.toLocaleString("ru-RU")} ₽` : ""}
              </p>
              {equipment.items.map((it) => (
                <div
                  key={it.key}
                  className="flex min-h-[36px] items-center justify-between rounded-lg border p-2 text-xs"
                  style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}
                >
                  <span style={{ color: T.text }}>
                    {it.label}
                    {it.qty > 1 ? ` × ${it.qty}` : ""}
                  </span>
                  {it.free ? (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                      style={{ backgroundColor: "#22c55e15", color: "#22c55e" }}
                    >
                      бесплатно
                    </span>
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#22c55e" }} aria-hidden />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Return notes from the /doc flow (e.g. damage description) */}
          {((typeof md.return_notes === "string" && md.return_notes) || handoff?.damage_notes) ? (
            <div
              className="mt-2 rounded-xl border p-2.5"
              style={{ borderColor: "#ef444433", backgroundColor: "#ef444408" }}
            >
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#ef4444" }}>
                Замечания при возврате
              </p>
              <p className="mt-0.5 text-sm" style={{ color: T.text }}>
                {(md.return_notes as string) || handoff?.damage_notes}
              </p>
            </div>
          ) : null}

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
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            {handoffStatus.returned
              ? "Акт передачи оформлен"
              : handoffStatus.done
                ? "Оформить возврат"
                : "Провести передачу"}
          </button>
        </DrawerSection>
      </div>

      {/* 7. Deposit tracking + penalty withholding */}
      <div className="mt-4">
        <DepositSection
          rentalId={rental.rental_id}
          rentalStatus={rental.status}
          T={T}
          expanded={openDeposit}
          onToggle={() => setOpenDeposit(!openDeposit)}
          metadataDeposit={deposit}
          initialSummary={depositSummary}
        />
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
        // z-[55]: above the sticky CrewHeader (z-50), below dialogs (z-[60]) / toasts (z-[70])
        className="fixed inset-0 z-[55] hidden justify-end lg:flex"
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
