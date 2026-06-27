"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Tag, Mail, User, Bike, Shield, Calendar, BarChart3, RefreshCw } from "lucide-react";

import { useAppContext } from "@/contexts/AppContext";
import {
  getSalesDashboard,
  type SaleDashboardItem,
  type SalesDashboardResult,
} from "@/app/franchize/server-actions/rentals-dashboard";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { withAlpha } from "@/app/franchize/lib/theme";
import { formatRubles, formatRussianDate, formatRussianDateOnly } from "../rentals-analytics/analytics-utils";
import { StatCard } from "../rentals-analytics/analytics-components/StatCard";
import { AnalyticsPasswordEntry } from "../rentals-analytics/analytics-components/AnalyticsPasswordEntry";
import { AnalyticsDateNav } from "../rentals-analytics/analytics-components/AnalyticsDateNav";
import { AnalyticsCrossNav } from "../rentals-analytics/analytics-components/AnalyticsCrossNav";
import { AnalyticsLoading } from "../rentals-analytics/analytics-components/AnalyticsLoading";

interface SalesAnalyticsClientProps {
  initialSlug: string;
  initialDate: string;
  crew: { id: string; name: string; theme: any };
}

export function SalesAnalyticsClient({ initialSlug, initialDate, crew }: SalesAnalyticsClientProps) {
  const { dbUser, isLoading: authLoading } = useAppContext();
  const theme = useFranchizeTheme(crew.theme);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [sales, setSales] = useState<SaleDashboardItem[]>([]);
  const [summary, setSummary] = useState<SalesDashboardResult["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);

  const getActorUserId = useCallback((): string | null => dbUser?.user_id || passwordAuthOwnerId, [dbUser?.user_id, passwordAuthOwnerId]);

  const loadSales = useCallback(async (date: string, showRefresh = false) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) { setLoading(false); setRefreshing(false); return; }
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await getSalesDashboard({ slug: initialSlug?.trim() || "vip-bike", actorUserId, date, isPasswordAuth: !!passwordAuthOwnerId });
      if (!result.success) {
        if (result.error?.includes("прав") || result.error?.includes("доступ")) { toast.error("Требуется пароль"); return; }
        toast.error(result.error || "Не удалось загрузить продажи");
        return;
      }
      setSales(result.data?.items || []);
      setSummary(result.data?.summary || null);
    } catch { toast.error("Ошибка загрузки");
    } finally { setLoading(false); setRefreshing(false); }
  }, [getActorUserId, initialSlug, passwordAuthOwnerId]);

  useEffect(() => { if (getActorUserId()) void loadSales(selectedDate); }, [getActorUserId]);
  useEffect(() => { if (getActorUserId() && !authLoading) void loadSales(selectedDate, true); }, [selectedDate]);

  const bgBase = "var(--franchize-bg-base)"; const bgCard = "var(--franchize-bg-card)"; const accentMain = "var(--franchize-accent-main)"; const accentHover = "var(--franchize-accent-hover)"; const textPrimary = "var(--franchize-text-primary)"; const textSecondary = "var(--franchize-text-secondary)"; const borderSoft = "var(--franchize-border-soft)";

  if (authLoading) return <AnalyticsLoading accentMain={accentMain} bgBase={bgBase} />;
  if (!dbUser && !passwordAuthOwnerId) return <AnalyticsPasswordEntry crewName={crew.name} slug={initialSlug} onAuthenticated={setPasswordAuthOwnerId} />;

  const totalRevenue = summary?.totalRevenue || 0;
  const totalCount = summary?.totalCount ?? sales.length;
  const basePath = ;

  return (
    <div className="space-y-4">
      <AnalyticsCrossNav activePage="sales" basePath={basePath} bgCard={bgCard} borderSoft={borderSoft} accentMain={accentMain} textSecondary={textSecondary} />

      <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-xl border" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}>
        <AnalyticsDateNav selectedDate={selectedDate} onDateChange={setSelectedDate} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <button onClick={() => void loadSales(selectedDate, true)} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-50" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, color: textSecondary }}>
          <RefreshCw className={} /> Обновить
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Всего продаж" value={String(totalCount)} icon={<Tag className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Выручка" value={formatRubles(totalRevenue)} icon={<Shield className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Средний чек" value={totalCount > 0 ? formatRubles(totalRevenue / totalCount) : "—"} icon={<Tag className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Дата" value={formatRussianDateOnly(selectedDate)} icon={<Calendar className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: withAlpha(bgCard, 0.4), borderColor: borderSoft }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: borderSoft, background:  }}>
          <h3 className="text-sm font-black tracking-tight" style={{ color: textPrimary }}>ДОГОВОРЫ КУПЛИ-ПРОДАЖИ</h3>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => (<div key={i} className="h-20 rounded-lg animate-pulse" style={{ backgroundColor: withAlpha(bgCard, 0.5) }} />))}</div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center"><p className="text-sm" style={{ color: textSecondary }}>За этот день продажи отсутствуют.</p></div>
        ) : (
          <div className="divide-y" style={{ borderColor: borderSoft }}>
            {sales.map((sale) => (
              <div key={sale.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3" style={{ borderColor: borderSoft }}>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><span className="text-sm font-semibold" style={{ color: textPrimary }}>{sale.buyer_full_name || "Без имени"}</span></div>
                  {sale.buyer_email && (<div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><a href={} className="text-xs hover:underline" style={{ color: accentMain }}>{sale.buyer_email}</a></div>)}
                  <div className="flex items-center gap-2"><Bike className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><span className="text-xs" style={{ color: textSecondary }}>{sale.vehicle ? .trim() : "Техника не определена"}</span></div>
                </div>
                <div className="flex flex-col md:items-end gap-1">
                  <div className="text-lg font-black" style={{ color: accentMain }}>{formatRubles(sale.sale_price)}</div>
                  {sale.warranty_months && (<div className="text-[10px] uppercase tracking-wide" style={{ color: textSecondary }}>Гарантия: {sale.warranty_months} мес.</div>)}
                  <div className="text-[10px]" style={{ color: textSecondary }}>{formatRussianDate(sale.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
