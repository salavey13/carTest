"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { ThemeTokens } from "../hooks/useTheme";
import type { AnalyticsTab, AnalyticsRentalRow, AnalyticsSaleRow, AnalyticsKpis } from "./types";

interface AnalyticsClientProps {
  initialSlug: string;
  initialDate: string;
  crew: any;
  T: ThemeTokens;
}

export function AnalyticsClient({ initialSlug, initialDate, crew, T }: AnalyticsClientProps) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("rentals");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rentals, setRentals] = useState<AnalyticsRentalRow[]>([]);
  const [sales, setSales] = useState<AnalyticsSaleRow[]>([]);
  const [serviceRentals, setServiceRentals] = useState<AnalyticsRentalRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab config
  const tabs: Array<{ key: AnalyticsTab; label: string }> = [
    { key: "rentals", label: "Аренда" },
    { key: "sales", label: "Продажа" },
    { key: "services", label: "Сервис" },
  ];

  // KPIs (computed from current data)
  const kpis: AnalyticsKpis = useMemo(() => {
    const today = date;
    const activeCount = rentals.filter(r => r.status === "active").length;
    const returnsDue = rentals.filter(r => 
      r.status === "active" && r.agreed_end_date && new Date(r.agreed_end_date) <= new Date(today + "T23:59:59Z")
    ).length;
    const revenueToday = rentals
      .filter(r => r.status === "active" || r.status === "completed")
      .reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);
    return { totalToday: rentals.length, revenueToday, activeCount, returnsDue };
  }, [rentals, date]);

  // Filter service rentals (vehicle_id starts with vip-bike-svc-)
  useEffect(() => {
    setServiceRentals(rentals.filter(r => r.vehicle_id?.startsWith("vip-bike-svc-")));
  }, [rentals]);

  // Display rentals (exclude services from rentals tab)
  const displayRentals = useMemo(() => 
    rentals.filter(r => !r.vehicle_id?.startsWith("vip-bike-svc-")),
    [rentals]
  );

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border p-1" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedId(null); }}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition"
            style={{
              backgroundColor: activeTab === tab.key ? T.accent : "transparent",
              color: activeTab === tab.key ? T.accentContrast : T.textMuted,
              minHeight: "44px",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date navigator */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split("T")[0]); }}
          className="rounded-xl border p-2.5"
          style={{ borderColor: T.border, backgroundColor: T.bgCard, color: T.text, cursor: "pointer", minHeight: "44px", minWidth: "44px" }}
        >←</button>
        <span className="text-sm font-medium" style={{ color: T.text }}>
          {new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", weekday: "long" })}
        </span>
        <button
          onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split("T")[0]); }}
          className="rounded-xl border p-2.5"
          style={{ borderColor: T.border, backgroundColor: T.bgCard, color: T.text, cursor: "pointer", minHeight: "44px", minWidth: "44px" }}
        >→</button>
        <button
          onClick={() => setDate(new Date().toISOString().split("T")[0])}
          className="rounded-xl border px-3 py-2.5 text-sm"
          style={{ borderColor: T.border, backgroundColor: T.bgCard, color: T.textMuted, cursor: "pointer", minHeight: "44px" }}
        >Сегодня</button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Аренд сегодня", value: kpis.totalToday, color: T.text },
          { label: "Выручка", value: `${kpis.revenueToday.toLocaleString("ru-RU")} ₽`, color: "#22c55e" },
          { label: "Активных", value: kpis.activeCount, color: "#22c55e" },
          { label: "Возвратов", value: kpis.returnsDue, color: kpis.returnsDue > 0 ? "#ef4444" : T.textMuted },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border p-3 md:p-4"
            style={{ borderColor: T.border, backgroundColor: T.bgCard }}
          >
            <p className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>{kpi.label}</p>
            <p className="mt-1 text-xl font-bold md:text-2xl" style={{ color: kpi.color }}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
          <p className="text-sm" style={{ color: T.textMuted }}>Загрузка...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(activeTab === "rentals" ? displayRentals : activeTab === "services" ? serviceRentals : []).map((rental) => {
            const bikeTitle = rental.vehicle ? `${rental.vehicle.make || ""} ${rental.vehicle.model || ""}`.trim() : "Байк";
            const renterName = rental.user?.full_name || "Без имени";
            const statusColors: Record<string, string> = {
              active: "#22c55e", completed: "#3b82f6", cancelled: "#64748b",
              confirmed: "#8b5cf6", pending_confirmation: "#f59e0b", disputed: "#ef4444",
            };
            const statusColor = statusColors[rental.status] || T.textMuted;
            const cost = Number(rental.total_cost) || 0;
            const docsCount = (rental.passport_mainpage_photo ? 1 : 0) + (rental.passport_registration_photo ? 1 : 0) + (rental.drivers_licence_frontal_photo ? 1 : 0);
            
            return (
              <div
                key={rental.rental_id}
                onClick={() => setSelectedId(rental.rental_id)}
                className="relative overflow-hidden rounded-2xl border p-3 pl-4 transition md:p-4 md:pl-5"
                style={{
                  borderColor: selectedId === rental.rental_id ? T.borderActive : T.border,
                  backgroundColor: T.bgCard,
                  cursor: "pointer",
                }}
              >
                <div className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: statusColor }} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold md:text-base" style={{ color: T.text }}>{bikeTitle}</p>
                    <p className="mt-0.5 truncate text-[11px] md:text-xs" style={{ color: T.textMuted }}>{renterName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] md:text-[11px]" style={{ color: T.textFaint }}>
                      <span>{new Date(rental.requested_start_date || rental.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} → {new Date(rental.requested_end_date || rental.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                      <span>{cost.toLocaleString("ru-RU")} ₽</span>
                      <span style={{ color: docsCount >= 3 ? "#22c55e" : "#ef4444" }}>{docsCount}/5 {docsCount >= 3 ? "✅" : "🔴"}</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${statusColor}15`, color: statusColor }}>
                    {rental.status === "active" ? "Активна" : rental.status === "completed" ? "Завершена" : rental.status === "cancelled" ? "Отменена" : rental.status === "pending_confirmation" ? "Ожидает" : rental.status}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Sales tab */}
          {activeTab === "sales" && sales.map((sale) => {
            const bikeTitle = sale.vehicle ? `${sale.vehicle.make || ""} ${sale.vehicle.model || ""}`.trim() : "Байк";
            const buyerName = sale.buyer_full_name || "Без имени";
            const price = Number(sale.total_sum ?? sale.sale_price) || 0;
            return (
              <div
                key={sale.id}
                onClick={() => setSelectedId(sale.id)}
                className="relative overflow-hidden rounded-2xl border p-3 pl-4 md:p-4 md:pl-5"
                style={{ borderColor: selectedId === sale.id ? T.borderActive : T.border, backgroundColor: T.bgCard, cursor: "pointer" }}
              >
                <div className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: "#f59e0b" }} />
                <p className="truncate text-sm font-bold md:text-base" style={{ color: T.text }}>{bikeTitle}</p>
                <p className="mt-0.5 truncate text-[11px] md:text-xs" style={{ color: T.textMuted }}>{buyerName}</p>
                <p className="mt-1 text-xs font-bold" style={{ color: "#22c55e" }}>{price.toLocaleString("ru-RU")} ₽</p>
              </div>
            );
          })}

          {/* Empty state */}
          {(activeTab === "rentals" && displayRentals.length === 0) ||
           (activeTab === "sales" && sales.length === 0) ||
           (activeTab === "services" && serviceRentals.length === 0) ? (
            <div className="rounded-2xl border p-8 text-center" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
              <p className="text-sm" style={{ color: T.textMuted }}>Нет данных за {new Date(date).toLocaleDateString("ru-RU")}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
