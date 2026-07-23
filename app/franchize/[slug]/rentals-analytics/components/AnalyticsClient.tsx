"use client";

// /analytics/components/AnalyticsClient.tsx
//
// Main orchestrator for the analytics v2 dashboard.
// Composes: TabNav + DateNav + KPICards + RentalList/Empty + DetailDrawer
// (split-pane desktop, slide-up sheet mobile).
//
// Mobile-first: list is full-width; tapping a card opens the bottom sheet.
// Desktop (lg+): split-pane — list left (5/12), detail right (7/12).

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
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays } from "lucide-react";

interface AnalyticsClientProps {
  initialSlug: string;
  initialDate: string;
  crew: any;
  T: ThemeTokens;
  /** Phase 2 data props — currently we accept rentals/sales arrays from parent. */
  rentals?: AnalyticsRentalRow[];
  sales?: AnalyticsSaleRow[];
  loading?: boolean;
  todos?: RentalTodo[];
  mechanicMap?: Record<string, string | null>;
  /** Controlled date — when provided, AnalyticsClient becomes controlled and
   *  emits onDateChange instead of managing its own date state. Required for
   *  the v2 wrapper to refetch on date navigation. */
  date?: string;
  onDateChange?: (next: string) => void;
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
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("rentals");
  const [selectedRentalId, setSelectedRentalId] = useState<string | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

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

  // Display rentals (exclude services from rentals tab)
  const displayRentals = useMemo(
    () => rentals.filter((r) => !isServiceRental(r)),
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
    // v1 CrewTodo doesn't carry rental_id, so we match todos by operator
    // chat id (same heuristic as buildMechanicMap). If the rental has no
    // operator chat id, fall back to the rental_id (for forward-compat when
    // crew_todos.rental_id is backfilled).
    const rentalTodos = todos.filter(
      (t) =>
        (rental.created_by_operator_chat_id &&
          t.assigned_to === rental.created_by_operator_chat_id) ||
        t.rental_id === rental.rental_id,
    );
    const md = (rental.metadata || {}) as Record<string, unknown>;
    return {
      ...rental,
      todos: rentalTodos,
      notes: [],
      history: [],
      handoff: md.handoff_at
        ? {
            handoff_at: md.handoff_at as string,
            handoff_by: (md.handoff_by as string) || null,
            odometer_before: (md.odometer_before as number) ?? null,
            odometer_after: (md.odometer_after as number) ?? null,
            equipment_checklist:
              (md.equipment_checklist as Record<string, boolean>) || null,
            damage_notes: (md.damage_notes as string) || null,
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
      router.push(`/franchize/${initialSlug}?vehicle=${selectedRentalId}`);
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

      {/* KPI cards */}
      <AnalyticsKPICards kpis={kpis} T={T} />

      {/* List + Detail (split-pane on desktop, stacked on mobile) */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: list */}
        <div className="lg:col-span-5" id={`analytics-panel-${activeTab}`} role="tabpanel" aria-labelledby={`analytics-tab-${activeTab}`}>
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
        <div className="hidden lg:col-span-7 lg:block">
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
