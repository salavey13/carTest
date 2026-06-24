"use client";

import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addDays, subDays, isWithinInterval, differenceInHours } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, Bike, User, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import {
  getRentalsDashboard,
  type RentalDashboardItem,
} from "@/app/franchize/server-actions/rentals-dashboard";

interface RentalsCalendarProps {
  slug: string;
  crewId: string;
  crewTheme: any;
  isPasswordAuth?: boolean;
  passwordAuthOwnerId?: string | null;
}

interface TimelineEvent {
  rental: RentalDashboardItem;
  startDate: Date;
  endDate: Date;
  row: number;
}

export function RentalsCalendar({ slug, crewId, crewTheme, isPasswordAuth, passwordAuthOwnerId }: RentalsCalendarProps) {
  const { dbUser } = useAppContext();
  const theme = {
    accentMain: crewTheme?.accentMain || "#667eea",
    accentHover: crewTheme?.accentHover || "#764ba2",
    bgCard: "var(--franchize-bg-card)",
    bgBase: "var(--franchize-bg-base)",
    borderSoft: "var(--franchize-border-soft)",
    textPrimary: "var(--franchize-text-primary)",
    textSecondary: "var(--franchize-text-secondary)",
  };

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [rentals, setRentals] = useState<RentalDashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBike, setSelectedBike] = useState<string | null>(null);
  const [selectedRental, setSelectedRental] = useState<RentalDashboardItem | null>(null);
  const [gapAnalysisOpen, setGapAnalysisOpen] = useState(false);

  const getActorUserId = () => dbUser?.user_id || passwordAuthOwnerId;

  // Calculate date range for the current view
  const dateRange = useMemo(() => {
    if (viewMode === "month") {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      return { start, end, days: eachDayOfInterval({ start, end }) };
    } else if (viewMode === "week") {
      const start = new Date(currentMonth);
      start.setDate(start.getDate() - start.getDay());
      const end = addDays(start, 6);
      const days = eachDayOfInterval({ start, end });
      return { start, end, days };
    } else {
      const start = new Date(currentMonth);
      const end = new Date(currentMonth);
      const days = [start];
      return { start, end, days };
    }
  }, [currentMonth, viewMode]);

  // Load rentals for the date range
  useEffect(() => {
    const loadRentals = async () => {
      const actorUserId = getActorUserId();
      if (!actorUserId) return;

      setLoading(true);
      try {
        // Load data for the entire month to get all rentals
        const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
        const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

        // We need to fetch all rentals for the month
        // For now, we'll fetch day by day and aggregate
        const allRentals: RentalDashboardItem[] = [];
        const days = eachDayOfInterval({
          start: startOfMonth(currentMonth),
          end: endOfMonth(currentMonth),
        });

        // Batch fetch - get all days at once
        const promises = days.map(day =>
          getRentalsDashboard({
            slug,
            actorUserId,
            date: format(day, "yyyy-MM-dd"),
            isPasswordAuth: !!passwordAuthOwnerId,
          })
        );

        const results = await Promise.all(promises);

        for (const result of results) {
          if (result.success && result.data?.items) {
            allRentals.push(...result.data.items);
          }
        }

        // Dedupe rentals
        const seen = new Set<string>();
        const deduplicated = allRentals.filter(r => {
          const key = `${r.rental_id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setRentals(deduplicated);
      } catch (error) {
        console.error("[Calendar] Load error:", error);
        toast.error("Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };

    void loadRentals();
  }, [slug, currentMonth, getActorUserId, isPasswordAuth, passwordAuthOwnerId]);

  // Get unique bikes from rentals
  const bikes = useMemo(() => {
    const bikeMap = new Map<string, { id: string; make: string; model: string }>();
    rentals.forEach(r => {
      if (r.vehicle) {
        const key = r.vehicle.id;
        if (!bikeMap.has(key)) {
          bikeMap.set(key, {
            id: r.vehicle.id,
            make: r.vehicle.make || "Unknown",
            model: r.vehicle.model || "",
          });
        }
      }
    });
    return Array.from(bikeMap.values());
  }, [rentals]);

  // Filter rentals by selected bike
  const filteredRentals = useMemo(() => {
    if (!selectedBike) return rentals;
    return rentals.filter(r => r.vehicle?.id === selectedBike);
  }, [rentals, selectedBike]);

  // Build timeline events
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];
    const bikeRows = new Map<string, number>();

    filteredRentals.forEach((rental, index) => {
      const bikeId = rental.vehicle?.id || `unknown-${index}`;
      if (!bikeRows.has(bikeId)) {
        bikeRows.set(bikeId, bikeRows.size);
      }

      const startDate = new Date(rental.agreed_start_date || rental.created_at);
      const endDate = rental.agreed_end_date ? new Date(rental.agreed_end_date) : addDays(startDate, 1);

      events.push({
        rental,
        startDate,
        endDate,
        row: bikeRows.get(bikeId)!,
      });
    });

    return events;
  }, [filteredRentals]);

  // Analyze gaps in availability
  const gapAnalysis = useMemo(() => {
    const gaps: Array<{ bike: string; start: Date; end: Date; duration: number }> = [];

    if (!selectedBike) return gaps;

    const bikeRentals = filteredRentals
      .filter(r => r.vehicle?.id === selectedBike)
      .map(r => ({
        rental: r,
        start: new Date(r.agreed_start_date || r.created_at),
        end: new Date(r.agreed_end_date || addDays(new Date(r.agreed_start_date || r.created_at), 1)),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 0; i < bikeRentals.length - 1; i++) {
      const current = bikeRentals[i];
      const next = bikeRentals[i + 1];

      if (current.end < next.start) {
        const gapDuration = differenceInHours(next.start, current.end);
        if (gapDuration > 0) {
          gaps.push({
            bike: selectedBike,
            start: current.end,
            end: next.start,
            duration: gapDuration,
          });
        }
      }
    }

    return gaps;
  }, [filteredRentals, selectedBike]);

  // Navigate months
  const navigateMonth = (delta: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setDate(1); // Set to first of month to avoid overflow issues
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  // Helper for opacity
  const withAlpha = (color: string, alpha: number) => {
    // Simple hex alpha conversion
    const hex = color.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  };

  return (
    <div className="space-y-4" style={{ color: theme.textPrimary }}>
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 rounded-lg border transition-all"
              style={{
                backgroundColor: "rgba(102, 126, 234, 0.1)",
                borderColor: theme.borderSoft,
              }}
            >
              <ChevronLeft className="w-4 h-4" style={{ color: theme.textSecondary }} />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-2 rounded-lg border font-semibold"
              style={{
                backgroundColor: "rgba(102, 126, 234, 0.15)",
                borderColor: withAlpha(theme.accentMain, 0.3),
                color: theme.accentMain,
              }}
            >
              {format(currentMonth, "MMMM yyyy", { locale: ru })}
            </button>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 rounded-lg border transition-all"
              style={{
                backgroundColor: "rgba(102, 126, 234, 0.1)",
                borderColor: theme.borderSoft,
              }}
            >
              <ChevronRight className="w-4 h-4" style={{ color: theme.textSecondary }} />
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: theme.borderSoft }}>
            {(["month", "week", "day"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="px-3 py-1 rounded text-xs font-semibold transition-all"
                style={{
                  backgroundColor: viewMode === mode ? theme.accentMain : "transparent",
                  color: viewMode === mode ? "#fff" : theme.textSecondary,
                }}
              >
                {mode === "month" ? "Месяц" : mode === "week" ? "Неделя" : "День"}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Bike filter */}
          <select
            value={selectedBike || ""}
            onChange={(e) => setSelectedBike(e.target.value || null)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.borderSoft,
              color: theme.textPrimary,
            }}
          >
            <option value="">Все мотоциклы</option>
            {bikes.map(bike => (
              <option key={bike.id} value={bike.id}>
                {bike.make} {bike.model}
              </option>
            ))}
          </select>

          {/* Gap analysis button */}
          <button
            onClick={() => setGapAnalysisOpen(!gapAnalysisOpen)}
            className="px-3 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2"
            style={{
              backgroundColor: gapAnalysisOpen ? withAlpha(theme.accentMain, 0.2) : "rgba(16, 185, 129, 0.1)",
              borderColor: gapAnalysisOpen ? withAlpha(theme.accentMain, 0.3) : "rgba(16, 185, 129, 0.3)",
              color: gapAnalysisOpen ? theme.accentMain : "#10b981",
            }}
          >
            <CalendarIcon className="w-4 h-4" />
            {gapAnalysisOpen ? "Скрыть" : "Показать"}间隙
          </button>
        </div>
      </div>

      {/* Gap analysis panel */}
      {gapAnalysisOpen && (
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: theme.bgCard,
            borderColor: withAlpha("#10b981", 0.3),
          }}
        >
          <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: "#10b981" }}>
            <Clock className="w-4 h-4" />
            Анализ доступности
          </h3>
          {selectedBike ? (
            gapAnalysis.length > 0 ? (
              <div className="space-y-2">
                {gapAnalysis.map((gap, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ backgroundColor: "rgba(16, 185, 129, 0.1)" }}
                  >
                    <span className="text-sm">
                      {format(gap.start, "dd MMM HH:mm")} → {format(gap.end, "dd MMM HH:mm")}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "#10b981" }}>
                      {gap.duration}ч свободно
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: theme.textSecondary }}>
                Нет доступных间隙 для выбранных периодов
              </p>
            )
          ) : (
            <p className="text-sm" style={{ color: theme.textSecondary }}>
              Выберите мотоцикл для анализа间隙
            </p>
          )}
        </div>
      )}

      {/* Timeline */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          backgroundColor: theme.bgCard,
          borderColor: theme.borderSoft,
        }}
      >
        {/* Day headers */}
        <div
          className="flex border-b"
          style={{ borderColor: withAlpha(theme.borderSoft, 0.5) }}
        >
          {dateRange.days.map(day => (
            <div
              key={day.toISOString()}
              className="flex-1 py-2 text-center border-r"
              style={{
                borderColor: withAlpha(theme.borderSoft, 0.3),
                backgroundColor: isSameDay(day, new Date()) ? withAlpha(theme.accentMain, 0.1) : "transparent",
              }}
            >
              <div className="text-xs font-bold" style={{ color: theme.accentMain }}>
                {format(day, "EEE", { locale: ru })}
              </div>
              <div className="text-lg font-black">{format(day, "d")}</div>
            </div>
          ))}
        </div>

        {/* Timeline rows */}
        {loading ? (
          <div className="p-8 text-center" style={{ color: theme.textSecondary }}>
            Загрузка...
          </div>
        ) : timelineEvents.length === 0 ? (
          <div className="p-8 text-center" style={{ color: theme.textSecondary }}>
            Нет аренд за выбранный период
          </div>
        ) : (
          <div className="p-4">
            {timelineEvents.map((event, idx) => {
              const eventStart = event.startDate;
              const eventEnd = event.endDate;

              // Calculate position and width
              const rangeDuration = dateRange.end.getTime() - dateRange.start.getTime();
              const eventStartOffset = Math.max(0, eventStart.getTime() - dateRange.start.getTime());
              const eventEndOffset = Math.min(rangeDuration, eventEnd.getTime() - dateRange.start.getTime());

              const leftPercent = (eventStartOffset / rangeDuration) * 100;
              const widthPercent = Math.max(2, (eventEndOffset / rangeDuration) * 100);

              // Color based on status
              const statusColors = {
                confirmed: "#34d399",
                active: "#60a5fa",
                completed: "#4ade80",
                cancelled: "#f87171",
                pending_confirmation: "#fbbf24",
                disputed: "#ef4444",
              };
              const eventColor = statusColors[event.rental.status as keyof typeof statusColors] || theme.accentMain;

              return (
                <div
                  key={`${event.rental.rental_id}-${idx}`}
                  className="relative mb-2 h-10 rounded-lg cursor-pointer transition-all hover:scale-[1.02] hover:z-10"
                  style={{
                    top: `${event.row * 44}px`,
                    marginLeft: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    backgroundColor: withAlpha(eventColor, 0.2),
                    border: `1px solid ${eventColor}`,
                  }}
                  onClick={() => setSelectedRental(event.rental)}
                >
                  <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
                    <div
                      className="text-xs font-medium truncate flex-shrink-0"
                      style={{ color: eventColor }}
                    >
                      {event.rental.vehicle?.make} {event.rental.vehicle?.model}
                    </div>
                    {event.rental.user?.full_name && (
                      <div className="text-xs truncate ml-2 flex-shrink-0" style={{ color: theme.textSecondary }}>
                        {event.rental.user.full_name}
                      </div>
                    )}
                    <div className="ml-auto text-xs font-mono flex-shrink-0" style={{ color: eventColor }}>
                      {format(event.startDate, "HH:mm")} → {format(event.endDate, "HH:mm")}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Show bike rows when multiple bikes */}
            {bikes.length > 1 && (
              <div className="mt-2 pt-2 border-t space-y-1" style={{ borderColor: withAlpha(theme.borderSoft, 0.5) }}>
                {bikes.slice(0, 5).map(bike => (
                  <div
                    key={bike.id}
                    className="flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-all"
                    style={{
                      backgroundColor: selectedBike === bike.id ? withAlpha(theme.accentMain, 0.15) : "transparent",
                    }}
                    onClick={() => setSelectedBike(selectedBike === bike.id ? null : bike.id)}
                  >
                    <Bike className="w-3 h-3 flex-shrink-0" style={{ color: theme.accentMain }} />
                    <span className="flex-shrink-0">{bike.make} {bike.model}</span>
                    <span className="text-xs opacity-60">
                      ({rentals.filter(r => r.vehicle?.id === bike.id).length} аренд)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected rental detail modal */}
      {selectedRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
            onClick={() => setSelectedRental(null)}
          />

          {/* Modal */}
          <div
            className="relative rounded-2xl p-6 max-w-md w-full"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.borderSoft,
              borderWidth: "1px",
              boxShadow: `0 20px 60px ${withAlpha("#000000", 0.3)}`,
            }}
          >
            <h3 className="text-lg font-black mb-4" style={{ color: theme.textPrimary }}>
              Детали аренды
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Bike className="w-5 h-5" style={{ color: theme.accentMain }} />
                <div>
                  <div className="font-semibold">{selectedRental.vehicle?.make} {selectedRental.vehicle?.model}</div>
                  <div className="text-xs" style={{ color: theme.textSecondary }}>
                    {selectedRental.vehicle?.specs?.vin || "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="w-5 h-5" style={{ color: theme.accentMain }} />
                <div>
                  <div className="font-semibold">{selectedRental.user?.full_name || "—"}</div>
                  <div className="text-xs" style={{ color: theme.textSecondary }}>
                    {selectedRental.user?.username || "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5" style={{ color: theme.accentMain }} />
                <div>
                  <div className="text-sm">
                    {formatRussianDate(selectedRental.agreed_start_date)} — {formatRussianDate(selectedRental.agreed_end_date)}
                  </div>
                  <div className="text-xs font-bold" style={{ color: "#34d399" }}>
                    {formatRubles(selectedRental.total_cost)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: withAlpha(
                      { confirmed: "#34d399", active: "#60a5fa", completed: "#4ade80", cancelled: "#f87171", pending_confirmation: "#fbbf24" }[selectedRental.status as keyof typeof selectedRental.status] || "#666",
                      0.2
                    ),
                    color: { confirmed: "#34d399", active: "#60a5fa", completed: "#4ade80", cancelled: "#f87171", pending_confirmation: "#fbbf24" }[selectedRental.status as keyof typeof selectedRental.status] || "#666"
                  }}
                >
                  {selectedRental.status === "confirmed" ? "✓" : selectedRental.status === "active" ? "▶" : selectedRental.status === "completed" ? "✓" : "?"}
                </div>
                <div className="text-sm capitalize" style={{ color: theme.textSecondary }}>
                  {selectedRental.status.replace(/_/g, " ")}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedRental(null)}
              className="w-full mt-4 px-4 py-2 rounded-lg text-sm font-bold transition-all"
              style={{
                backgroundColor: withAlpha(theme.borderSoft, 0.2),
                color: theme.textSecondary,
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatRussianDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: ru });
  } catch {
    return "—";
  }
}

function formatRubles(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
