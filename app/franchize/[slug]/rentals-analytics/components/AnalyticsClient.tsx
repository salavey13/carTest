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
import { isServiceRental, localDateOnly, todayLocalIso } from "./lib/analytics-utils";
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
import { CalendarDays, Download } from "lucide-react";

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
  date?: string;
  onDateChange?: (next: string) => void;
  /** Deep-link params from URL (Phase 2 of startParamRouter PRD) */
  initialTab?: string;
  initialRentalId?: string;
  initialSaleId?: string;
  /** FIX (F9): CSV export handler — receives the picked date range. */
  onExportCsv?: (from: string, to: string) => Promise<void>;
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
  date: controlledDate,
  onDateChange,
  initialTab,
  initialRentalId,
  initialSaleId,
  onExportCsv,
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
  const displayRentals = useMemo(
    () => rentals.filter((r) => !isServiceRental(r) && r.status !== "cancelled"),
    [rentals],
  );

  // KPIs (computed from current data + selected date)
  const kpis: AnalyticsKpis = useMemo(() => {
    // Use LOCAL date comparison — agreed_end_date is a UTC ISO string but
    // "returns today" means "in the user's local calendar day".
    const todayIso = date;
    const activeCount = displayRentals.filter((r) => r.status === "active").length;
    const returnsDue = displayRentals.filter((r) => {
      if (r.status !== "active" || !r.agreed_end_date) return false;
      return localDateOnly(r.agreed_end_date) === todayIso;
    }).length;
    const revenueToday = displayRentals
      .filter((r) => r.status === "active" || r.status === "completed")
      .reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);
    return {
      totalToday: displayRentals.length,
      revenueToday,
      activeCount,
      returnsDue,
    };
  }, [displayRentals, date]);

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
    const handoffAt = typeof md.handoff_at === "string" ? md.handoff_at : null;
    const damageNotes =
      (typeof md.damage_notes === "string" ? md.damage_notes : null) ||
      (typeof md.return_notes === "string" ? md.return_notes : null);
    const hasHandoff = !!handoffAt || odoBefore != null || odoAfter != null || !!damageNotes;
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
    if (action === "open_rental" && selectedSaleId) {
      router.push(`/franchize/${initialSlug}/sales-analytics`);
      return;
    }
    // Other actions: future server-action wiring
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" role="region" aria-label="Аналитика">
      {/* Tab bar */}
      <AnalyticsTabNav activeTab={activeTab} onChange={handleTabChange} T={T} />

      {/* Date navigator */}
      <AnalyticsDateNav date={date} onChange={setDate} T={T} isToday={isToday} />

      {/* FIX (F9): CSV export button — always visible on mobile and desktop.
          No `hidden sm:...` classes: the operator tests on a phone. */}
      {onExportCsv && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCsvModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 md:text-sm"
            style={{
              borderColor: "#3b82f64d",
              backgroundColor: "#3b82f615",
              color: "#60a5fa",
              minHeight: "44px",
            }}
            aria-label="Экспорт аренд в CSV за период"
          >
            <Download className="h-4 w-4" aria-hidden />
            Экспорт CSV
          </button>
        </div>
      )}

      {/* CSV export modal (date range picker) */}
      {onExportCsv && (
        <ExportCsvModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          onExport={onExportCsv}
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
          ) : activeTab === "rentals" && displayRentals.length === 0 ? (
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
              rentals={displayRentals}
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
  T,
  onAction,
  onClose,
}: {
  sale: AnalyticsSaleRow;
  T: ThemeTokens;
  onAction: (a: DrawerAction) => void;
  onClose: () => void;
}) {
  return (
    <SaleDetailDrawer
      sale={sale}
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
