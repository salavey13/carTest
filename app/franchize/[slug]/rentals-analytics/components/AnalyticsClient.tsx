"use client";

// /analytics/components/AnalyticsClient.tsx
//
// Main orchestrator for the analytics v2 dashboard.
// Composes: TabNav + DateNav + KPICards + RentalList/Empty + DetailDrawer
// (split-pane desktop, slide-up sheet mobile).
//
// Mobile-first: list is full-width; tapping a card opens the bottom sheet.
// Desktop (lg+): split-pane — list left (5/12), detail right (7/12).
// FIX (F9): CSV export button (always visible, mobile included) + date-range
// modal wired by the parent wrapper.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateRentalStatus } from "@/app/franchize/server-actions/rentals-dashboard";
import type { ThemeTokens } from "../hooks/useTheme";
import type {
  AnalyticsTab,
  AnalyticsRentalRow,
  AnalyticsSaleRow,
  AnalyticsKpis,
  DrawerRentalRow,
  DrawerAction,
  RentalTodo,
} from "./types";
import { computeAnalyticsKpis, isRentalRelevantForDate, isServiceRental, localDateOnly, todayLocalIso } from "./lib/analytics-utils";
import { AnalyticsTabNav } from "./AnalyticsTabNav";
import { AnalyticsDateNav } from "./AnalyticsDateNav";
import { AnalyticsKPICards } from "./AnalyticsKPICards";
import { AnalyticsRentalList } from "./AnalyticsRentalList";
import { AnalyticsSaleCard } from "./AnalyticsSaleCard";
import { AnalyticsEmptyState } from "./AnalyticsEmptyState";
import { AnalyticsMobileSheet } from "./AnalyticsMobileSheet";
import { RentalDetailDrawer } from "./RentalDetailDrawer";
import { SaleDetailDrawer } from "./SaleDetailDrawer";
import { ServiceDetailDrawer } from "./ServiceDetailDrawer";
import { ExportCsvModal } from "./ExportCsvModal";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Table2 } from "lucide-react";

interface AnalyticsClientProps {
  initialSlug: string;
  initialDate: string;
  crew: any;
  T: ThemeTokens;
  rentals?: AnalyticsRentalRow[];
  sales?: AnalyticsSaleRow[];
  loading?: boolean;
  todos?: RentalTodo[];
  mechanicMap?: Record<string, string | null>;
  /** iter26: cookie/TG actor id — needed for the drawer's status actions
   *  (Отменить / Активировать / Завершить → updateRentalStatus). */
  actorUserId?: string | null;
  date?: string;
  onDateChange?: (next: string) => void;
  /** Deep-link params from URL (Phase 2 of startParamRouter PRD) */
  initialTab?: string;
  initialRentalId?: string;
  initialSaleId?: string;
  /** FIX (F9): CSV export handler — receives the picked date range. */
  onExportCsv?: (from: string, to: string) => Promise<void>;
  /** FIX (F9 iter3): fetcher that returns CSV text for the in-modal table view. */
  onFetchCsvText?: (from: string, to: string) => Promise<string>;
  /** FIX (iter4): send the CSV to the operator's Telegram chat via the bot. */
  onSendCsvToTelegram?: (from: string, to: string) => Promise<void>;
}

export function AnalyticsClient({
  initialSlug,
  initialDate,
  crew,
  T,
  rentals = [],
  sales = [],
  loading = false,
  todos = [],
  mechanicMap = {},
  actorUserId = null,
  date: controlledDate,
  onDateChange,
  initialTab,
  initialRentalId,
  initialSaleId,
  onExportCsv,
  onFetchCsvText,
  onSendCsvToTelegram,
}: AnalyticsClientProps) {
  const router = useRouter();
  // Date state: controlled (when parent passes `date` + `onDateChange`) or
  // uncontrolled (fallback to internal state initialized from initialDate).
  // The v2 wrapper uses controlled mode so it can refetch on date change.
  const [internalDate, setInternalDate] = useState(initialDate);
  const date = controlledDate ?? internalDate;
  const setDate = (next: string) => {
    if (onDateChange) onDateChange(next);
    else setInternalDate(next);
  };
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(
    (["rentals", "sales", "services"].includes(initialTab || "") ? initialTab : "rentals") as AnalyticsTab
  );
  const [selectedRentalId, setSelectedRentalId] = useState<string | null>(initialRentalId ?? null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(initialSaleId ?? null);
  // FIX (F9): CSV export modal state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  // iter26: drawer status-action in flight (Отменить) — disables re-entry.
  const [actionPending, setActionPending] = useState(false);

  // Switch tab — reset selection SYNCHRONOUSLY (not via useEffect, which
  // would let the wrong drawer render for one frame).
  const handleTabChange = (tab: AnalyticsTab) => {
    setSelectedRentalId(null);
    setSelectedSaleId(null);
    setActiveTab(tab);
  };

  // Service rentals = rentals where vehicle_id starts with vip-bike-svc-
  const serviceRentals = useMemo(
    () => rentals.filter(isServiceRental),
    [rentals],
  );

  // Display rentals (exclude services from rentals tab + cancelled rentals from KPIs)
  // FIX: cancelled rentals (aborted pre-created) should not pollute KPIs.
  // They remain queryable in the rentals list (for audit) but are excluded here.
  const nonServiceRentals = useMemo(
    () => rentals.filter((r) => !isServiceRental(r)),
    [rentals],
  );
  const displayRentals = useMemo(
    () => nonServiceRentals.filter((r) => r.status !== "cancelled"),
    [nonServiceRentals],
  );

  // FIX (iter14): day-page relevance. The server now returns rentals that
  // START on the selected day OR END (are returned) on it (±1 day UTC to
  // absorb MSK). Precisely keep the rows whose MSK calendar start or end
  // date equals the selected day — a 26→27 rental shows on the 27th as a
  // return, not as a "started today" rental.
  const dayPageRentals = useMemo(
    () => displayRentals.filter((r) => isRentalRelevantForDate(r, date)),
    [displayRentals, date],
  );
  // Rentals visible in the day LIST: the day page + cancelled rows created
  // that day (audit) — keep the previous audit affordance.
  const listRentals = useMemo(
    () =>
      nonServiceRentals.filter((r) => {
        if (r.status !== "cancelled") return dayPageRentals.includes(r);
        const start = localDateOnly(r.requested_start_date || r.agreed_start_date || r.created_at);
        return start === date;
      }),
    [nonServiceRentals, dayPageRentals, date],
  );

  // KPIs (computed from current data + selected date) — FIX (iter14): each
  // counter is now scoped to the SELECTED day (MSK calendar):
  //   Аренд сегодня = rentals STARTED on the day (any non-cancelled status)
  //   Выручка       = revenue of rentals started on the day (active+completed)
  //   Активных      = rentals from the day's page currently active
  //   Возвратов     = rentals whose END date is the day (returned or due back)
  const kpis: AnalyticsKpis = useMemo(
    () => computeAnalyticsKpis(dayPageRentals, date),
    [dayPageRentals, date],
  );

  // Selected rental (with todos + notes + handoff derived from metadata)
  const selectedRental: DrawerRentalRow | null = useMemo(() => {
    if (!selectedRentalId) return null;
    const rental = rentals.find((r) => r.rental_id === selectedRentalId);
    if (!rental) return null;
    // FIX (F12-iter2): todos link via crew_todos.rental_id ONLY.
    // The iter1 fallback (t.rental_id == null && t.assigned_to ===
    // rental.created_by_operator_chat_id) leaked todos from OTHER rentals
    // that happened to share the same operator — e.g. Paul's other rentals
    // "Подготовить ТС к передаче: 79BIKE Falcon Pro" or even sales todos
    // "Проконтролировать оплату (290000 ₽)" polluted this Ducati rental's
    // modal. Drop the fallback: a todo with no rental_id is not for THIS
    // rental. If you want to see unlinked todos, build a separate "Inbox"
    // view in the future.
    const rentalTodos = todos.filter((t) => t.rental_id === rental.rental_id);

    // FIX (F12-iter2b): for active/completed rentals, the /doc flow already
    // verified passport + license + dates — so the corresponding verification
    // todos ("Верифицировать паспорт...", "Подтвердить даты аренды",
    // "Подтвердить начальный одометр", "Принять зарядное устройство") should
    // appear as DONE in the modal, not as pending high-priority items.
    // Mark them done in-place when the rental has progressed past pending.
    const isVerifiedRental =
      rental.status === "active" || rental.status === "completed";
    const VERIFICATION_TODO_PATTERNS = [
      /^Верифицировать паспорт/i,
      /^Верифицировать водительское удостоверение/i,
      /^Подтвердить даты аренды/i,
      /^Подтвердить начальный одометр/i,
      /^Принять зарядное устройство/i,
    ];
    const isVerificationTodo = (title: string) =>
      VERIFICATION_TODO_PATTERNS.some((re) => re.test(title));
    const normalizedTodos: RentalTodo[] = rentalTodos.map((t) =>
      isVerifiedRental && t.status !== "done" && isVerificationTodo(t.title)
        ? { ...t, status: "done" as const }
        : t,
    );
    const md = (rental.metadata || {}) as Record<string, unknown>;
    // FIX (F5): build the handoff object whenever ANY handoff signal exists —
    // odometer_before/after are stored directly in rental metadata by the
    // /doc flow (rental_handoffs rows may not exist at all).
    const odoBefore = (md.odometer_before as number | undefined) ?? null;
    const odoAfter = (md.odometer_after as number | undefined) ?? null;
    // FIX (iter9): odometer hint — recorded at order creation from the bike's
    // last known mileage; displayed as "≈N км" until the operator saves the
    // actual pickup freeze value.
    const odoHintRaw = (md.odometer_before_hint ?? md.last_known_odometer) as number | undefined;
    const odoHint = odoHintRaw != null ? Number(odoHintRaw) : null;
    const handoffAt = typeof md.handoff_at === "string" ? md.handoff_at : null;
    const damageNotes =
      (typeof md.damage_notes === "string" ? md.damage_notes : null) ||
      (typeof md.return_notes === "string" ? md.return_notes : null);
    // FIX (iter9): the odometer hint also counts as a signal — otherwise a
    // fresh web-order rental (no handoff yet) renders handoff=null and the
    // "Одометр до" tile can't show the ≈hint value.
    const hasHandoff = !!handoffAt || odoBefore != null || odoAfter != null || !!damageNotes || (odoHint != null && Number.isFinite(odoHint));
    return {
      ...rental,
      todos: normalizedTodos,
      notes: [],
      history: [],
      handoff: hasHandoff
        ? {
            handoff_at: handoffAt,
            handoff_by: (md.handoff_by as string) || null,
            odometer_before: odoBefore,
            odometer_after: odoAfter,
            odometer_before_hint: odoHint != null && Number.isFinite(odoHint) ? odoHint : null,
            equipment_checklist:
              (md.equipment_checklist as Record<string, boolean>) || null,
            damage_notes: damageNotes,
          }
        : null,
    };
  }, [selectedRentalId, rentals, todos]);

  const selectedSale = useMemo(
    () => (selectedSaleId ? sales.find((s) => s.id === selectedSaleId) || null : null),
    [selectedSaleId, sales],
  );

  // Selected service rental (separate state isn't needed — reuse selectedRentalId,
  // but for clarity we detect by tab).
  const selectedServiceRental = useMemo(() => {
    if (activeTab !== "services" || !selectedRentalId) return null;
    return serviceRentals.find((r) => r.rental_id === selectedRentalId) || null;
  }, [activeTab, selectedRentalId, serviceRentals]);

  const isToday = date === todayLocalIso();

  // ── Drawer open state ───────────────────────────────────────────────────
  const drawerOpen =
    (activeTab === "rentals" && !!selectedRental) ||
    (activeTab === "sales" && !!selectedSale) ||
    (activeTab === "services" && !!selectedServiceRental);

  const closeDrawer = () => {
    setSelectedRentalId(null);
    setSelectedSaleId(null);
  };

  const handleRentalAction = (action: DrawerAction) => {
    // Phase 2: wire to server actions
    if (action === "open_rental" && selectedRentalId) {
      // FIX: was pushing to /franchize/{slug}?vehicle={rentalId} which opens the
      // catalog page, not the rental detail page. Correct URL is /franchize/{slug}/rental/{rentalId}
      router.push(`/franchize/${initialSlug}/rental/${selectedRentalId}`);
      return;
    }
    // FIX (iter9): "more" = the "Провести передачу" / "Оформить возврат" button
    // in the handoff section. Previously it fell through the if-chain and did
    // NOTHING when clicked. The rental page hosts the actual handoff flow
    // (Фиксация выдачи → Подтвердить выдачу → возврат), so navigate there.
    if (action === "more" && selectedRentalId) {
      router.push(`/franchize/${initialSlug}/rental/${selectedRentalId}`);
      return;
    }
    if (action === "open_rental" && selectedSaleId) {
      router.push(`/franchize/${initialSlug}/sales-analytics`);
      return;
    }

    // iter26: real status actions. Previously «Отменить» / «Активировать» /
    // «Завершить» fell through here and did NOTHING (dead buttons) — the
    // client could not abort an already-completed rental from the sheet.
    // Cancel runs directly (confirm + updateRentalStatus); activate/complete
    // need the odometer + photo flows, so they deep-link to the rental page
    // where the proper handoff flow lives.
    if (action === "cancel" || action === "activate" || action === "complete") {
      const rental = selectedRental ?? selectedServiceRental;
      if (!selectedRentalId || !rental) return;

      if (action === "cancel") {
        void cancelSelectedRental(rental);
        return;
      }
      // activate / complete — full flow (odometer, photos, contract docs) is
      // on the rental page; a bare status flip here would corrupt handoff data.
      router.push(`/franchize/${initialSlug}/rental/${selectedRentalId}`);
      return;
    }
  };

  // iter26: «Отменить» from the drawer/sheet — works in ANY state (pending,
  // active, completed…). Cancelling an already-completed/active rental is a
  // data correction (deal fell through, money returned) → silent (no TG spam
  // to the renter); cancelling a pending/confirmed request is a real decline
  // → the renter gets a notification.
  const cancelSelectedRental = async (rental: AnalyticsRentalRow) => {
    if (!selectedRentalId || actionPending) return;
    if (!actorUserId) {
      toast.error("Не удалось определить пользователя — обновите страницу и попробуйте снова.");
      return;
    }
    const bikeTitle = rental.vehicle ? `${rental.vehicle.make || ""} ${rental.vehicle.model || ""}`.trim() : "аренда";
    const dataCorrection = rental.status === "completed" || rental.status === "active";
    const ok = window.confirm(
      dataCorrection
        ? `Отменить аренду «${bikeTitle}»?\n\nАренда уже в статусе «${rental.status === "completed" ? "завершена" : "активна"}» — она будет помечена отменённой и исчезнет из выручки/ЗП (запись сохранится для аудита). Арендатор не будет уведомлён.`
        : `Отменить аренду «${bikeTitle}»?\n\nАрендатор получит уведомление в Telegram.`
    );
    if (!ok) return;

    setActionPending(true);
    try {
      const result = await updateRentalStatus({
        slug: initialSlug,
        actorUserId,
        rentalId: selectedRentalId,
        status: "cancelled",
        silent: dataCorrection,
      });
      if (result.success) {
        toast.success(result.message || "Аренда отменена");
        setSelectedRentalId(null);
        router.refresh();
      } else {
        toast.error(result.error || "Не удалось отменить аренду");
      }
    } catch (err: any) {
      toast.error(err?.message || "Ошибка сети");
    } finally {
      setActionPending(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" role="region" aria-label="Аналитика">
      {/* Tab bar */}
      <AnalyticsTabNav activeTab={activeTab} onChange={handleTabChange} T={T} />

      {/* Date navigator */}
      <AnalyticsDateNav date={date} onChange={setDate} T={T} isToday={isToday} />

      {/* FIX (F9 iter3): table-view trigger — table icon only (no text).
          Opens the in-modal table view + download icon button for actual CSV. */}
      {onExportCsv && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCsvModalOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border px-2.5 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2"
            style={{
              borderColor: "#3b82f64d",
              backgroundColor: "#3b82f615",
              color: "#60a5fa",
              minHeight: "44px",
              minWidth: "44px",
            }}
            aria-label="Открыть таблицу и экспорт CSV"
            title="Таблица и экспорт CSV"
          >
            <Table2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {/* CSV table-view modal — date pickers + huge horizontally-scrollable
          table + download-icon button to actually save the CSV file + send
          icon button to send it via the bot to the operator's TG chat. */}
      {onExportCsv && (
        <ExportCsvModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          onExport={onExportCsv}
          onSendTelegram={onSendCsvToTelegram}
          fetchCsvText={onFetchCsvText}
          variant="rentals"
          slug={initialSlug}
          T={T}
        />
      )}

      {/* KPI cards */}
      <AnalyticsKPICards kpis={kpis} T={T} />

      {/* List + Detail (split-pane on desktop, stacked on mobile) */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: list */}
        <div className="min-w-0 lg:col-span-5" id={`analytics-panel-${activeTab}`} role="tabpanel" aria-labelledby={`analytics-tab-${activeTab}`}>
          {loading ? (
            <div
              className="rounded-2xl border p-8 text-center"
              style={{ borderColor: T.border, backgroundColor: T.bgCard }}
            >
              <p className="text-sm" style={{ color: T.textMuted }}>
                Загрузка…
              </p>
            </div>
          ) : activeTab === "rentals" && listRentals.length === 0 ? (
            <AnalyticsEmptyState
              label={`Нет аренд за ${new Date(date).toLocaleDateString("ru-RU")}`}
              hint="Выберите другую дату или переключите вкладку"
              T={T}
              icon={CalendarDays}
            />
          ) : activeTab === "sales" && sales.length === 0 ? (
            <AnalyticsEmptyState
              label={`Нет продаж за ${new Date(date).toLocaleDateString("ru-RU")}`}
              hint="Выберите другую дату или переключите вкладку"
              T={T}
              icon={CalendarDays}
            />
          ) : activeTab === "services" && serviceRentals.length === 0 ? (
            <AnalyticsEmptyState
              label={`Нет сервисных заказов за ${new Date(date).toLocaleDateString("ru-RU")}`}
              hint="Выберите другую дату или переключите вкладку"
              T={T}
              icon={CalendarDays}
            />
          ) : activeTab === "rentals" ? (
            <AnalyticsRentalList
              rentals={listRentals}
              selectedId={selectedRentalId}
              onSelect={setSelectedRentalId}
              T={T}
              variant="rentals"
            />
          ) : activeTab === "services" ? (
            <AnalyticsRentalList
              rentals={serviceRentals}
              selectedId={selectedRentalId}
              onSelect={setSelectedRentalId}
              T={T}
              variant="services"
              mechanicMap={mechanicMap}
            />
          ) : (
            // Sales tab — use sale cards directly (no list component for sales)
            <div className="space-y-3" role="listbox" aria-label="Список продаж">
              <AnimatePresence initial={false}>
                {sales.map((sale) => (
                  <motion.div
                    key={sale.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    role="option"
                    aria-selected={selectedSaleId === sale.id}
                  >
                    <AnalyticsSaleCard
                      sale={sale}
                      selected={selectedSaleId === sale.id}
                      onSelect={setSelectedSaleId}
                      T={T}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right: detail panel (desktop only, hidden on mobile — sheet takes over) */}
        <div className="hidden min-w-0 lg:col-span-7 lg:block">
          {drawerOpen && (
            <div
              role="dialog"
              aria-label="Детали записи"
              className="sticky top-4 rounded-2xl border p-4"
              style={{
                borderColor: T.border,
                backgroundColor: T.bgCard,
                maxHeight: "calc(100vh - 120px)",
                overflowY: "auto",
              }}
            >
              {activeTab === "rentals" && selectedRental && (
                <RentalDetailDrawerInline
                  rental={selectedRental}
                  T={T}
                  onAction={handleRentalAction}
                  onClose={closeDrawer}
                />
              )}
              {activeTab === "sales" && selectedSale && (
                <SaleDetailDrawerInline
                  sale={selectedSale}
                  crewSlug={initialSlug}
                  T={T}
                  onAction={handleRentalAction}
                  onClose={closeDrawer}
                />
              )}
              {activeTab === "services" && selectedServiceRental && (
                <ServiceDetailDrawerInline
                  rental={selectedServiceRental}
                  T={T}
                  onAction={handleRentalAction}
                  onClose={closeDrawer}
                  mechanicName={mechanicMap[selectedServiceRental.rental_id] ?? null}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile sheet (only renders when drawerOpen on mobile) */}
      <div className="lg:hidden">
        <AnalyticsMobileSheet
          open={drawerOpen}
          onClose={closeDrawer}
          T={T}
          title={
            activeTab === "rentals"
              ? "Аренда"
              : activeTab === "sales"
                ? "Продажа"
                : "Сервис"
          }
        >
          {activeTab === "rentals" && selectedRental && (
            <RentalDetailDrawer
              rental={selectedRental}
              T={T}
              onAction={handleRentalAction}
              onClose={closeDrawer}
              asSheetChild
            />
          )}
          {activeTab === "sales" && selectedSale && (
            <SaleDetailDrawer
              sale={selectedSale}
              crewSlug={initialSlug}
              T={T}
              onAction={handleRentalAction}
              onClose={closeDrawer}
              asSheetChild
            />
          )}
          {activeTab === "services" && selectedServiceRental && (
            <ServiceDetailDrawer
              rental={selectedServiceRental}
              T={T}
              onAction={handleRentalAction}
              onClose={closeDrawer}
              asSheetChild
              mechanicName={mechanicMap[selectedServiceRental.rental_id] ?? null}
            />
          )}
        </AnalyticsMobileSheet>
      </div>
    </div>
  );
}

// ── Inline wrappers for desktop split-pane ───────────────────────────────────
//
// The drawer components render their own backdrop + right-side panel by default.
// For the desktop split-pane layout we want them inline (no backdrop, no panel
// chrome) — we render the same content via the asSheetChild path which skips
// the backdrop. The parent provides the surrounding card chrome.

function RentalDetailDrawerInline({
  rental,
  T,
  onAction,
  onClose,
}: {
  rental: DrawerRentalRow;
  T: ThemeTokens;
  onAction: (a: DrawerAction) => void;
  onClose: () => void;
}) {
  return (
    <RentalDetailDrawer
      rental={rental}
      T={T}
      onAction={onAction}
      onClose={onClose}
      asSheetChild
    />
  );
}

function SaleDetailDrawerInline({
  sale,
  crewSlug,
  T,
  onAction,
  onClose,
}: {
  sale: AnalyticsSaleRow;
  crewSlug: string;
  T: ThemeTokens;
  onAction: (a: DrawerAction) => void;
  onClose: () => void;
}) {
  return (
    <SaleDetailDrawer
      sale={sale}
      crewSlug={crewSlug}
      T={T}
      onAction={onAction}
      onClose={onClose}
      asSheetChild
    />
  );
}

function ServiceDetailDrawerInline({
  rental,
  T,
  onAction,
  onClose,
  mechanicName,
}: {
  rental: AnalyticsRentalRow;
  T: ThemeTokens;
  onAction: (a: DrawerAction) => void;
  onClose: () => void;
  mechanicName?: string | null;
}) {
  return (
    <ServiceDetailDrawer
      rental={rental}
      T={T}
      onAction={onAction}
      onClose={onClose}
      asSheetChild
      mechanicName={mechanicName}
    />
  );
}
