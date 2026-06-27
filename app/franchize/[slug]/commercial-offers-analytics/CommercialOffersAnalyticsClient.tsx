"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Phone, Mail, QrCode, User, Building2, Calendar, RefreshCw } from "lucide-react";

import { useAppContext } from "@/contexts/AppContext";
import {
  getCommercialProposalsDashboard,
  type CommercialProposalItem,
  type CommercialProposalsResult,
} from "@/app/franchize/server-actions/rentals-dashboard";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { withAlpha } from "@/app/franchize/lib/theme";
import { formatRubles, formatRussianDate, formatRussianDateOnly } from "../rentals-analytics/analytics-utils";
import { StatCard } from "../rentals-analytics/analytics-components/StatCard";
import { AnalyticsPasswordEntry } from "../rentals-analytics/analytics-components/AnalyticsPasswordEntry";
import { AnalyticsDateNav } from "../rentals-analytics/analytics-components/AnalyticsDateNav";
import { AnalyticsCrossNav } from "../rentals-analytics/analytics-components/AnalyticsCrossNav";
import { AnalyticsLoading } from "../rentals-analytics/analytics-components/AnalyticsLoading";

const OFFER_TYPE_LABELS: Record<string, string> = {
  rent: "Аренда", sale: "Продажа", service: "Сервис", lease: "Лизинг", unknown: "Другое",
};

interface CommercialOffersAnalyticsClientProps {
  initialSlug: string;
  initialDate: string;
  crew: { id: string; name: string; theme: any };
}

export function CommercialOffersAnalyticsClient({ initialSlug, initialDate, crew }: CommercialOffersAnalyticsClientProps) {
  const { dbUser, isLoading: authLoading } = useAppContext();
  const theme = useFranchizeTheme(crew.theme);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [proposals, setProposals] = useState<CommercialProposalItem[]>([]);
  const [summary, setSummary] = useState<CommercialProposalsResult["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);

  const getActorUserId = useCallback((): string | null => dbUser?.user_id || passwordAuthOwnerId, [dbUser?.user_id, passwordAuthOwnerId]);

  const loadProposals = useCallback(async (date: string, showRefresh = false) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) { setLoading(false); setRefreshing(false); return; }
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await getCommercialProposalsDashboard({ slug: initialSlug?.trim() || "vip-bike", actorUserId, date, isPasswordAuth: !!passwordAuthOwnerId });
      if (!result.success) {
        if (result.error?.includes("прав") || result.error?.includes("доступ")) { toast.error("Требуется пароль"); return; }
        toast.error(result.error || "Не удалось загрузить КП");
        return;
      }
      setProposals(result.data?.items || []);
      setSummary(result.data?.summary || null);
    } catch { toast.error("Ошибка загрузки");
    } finally { setLoading(false); setRefreshing(false); }
  }, [getActorUserId, initialSlug, passwordAuthOwnerId]);

  useEffect(() => { if (getActorUserId()) void loadProposals(selectedDate); }, [getActorUserId]);
  useEffect(() => { if (getActorUserId() && !authLoading) void loadProposals(selectedDate, true); }, [selectedDate]);

  const bgBase = "var(--franchize-bg-base)"; const bgCard = "var(--franchize-bg-card)"; const accentMain = "var(--franchize-accent-main)"; const textPrimary = "var(--franchize-text-primary)"; const textSecondary = "var(--franchize-text-secondary)"; const borderSoft = "var(--franchize-border-soft)";

  if (authLoading) return <AnalyticsLoading accentMain={accentMain} bgBase={bgBase} />;
  if (!dbUser && !passwordAuthOwnerId) return <AnalyticsPasswordEntry crewName={crew.name} slug={initialSlug} onAuthenticated={setPasswordAuthOwnerId} />;

  const totalCount = summary?.totalCount ?? proposals.length;
  const withQr = summary?.withQr ?? proposals.filter((p) => p.qr_included).length;
  const totalRevenue = proposals.reduce((sum, p) => sum + (p.total_price || 0), 0);
  const byType = summary?.byType || {};
  const basePath = ;

  return (
    <div className="space-y-4">
      <AnalyticsCrossNav activePage="commercial" basePath={basePath} bgCard={bgCard} borderSoft={borderSoft} accentMain={accentMain} textSecondary={textSecondary} />

      <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-xl border" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}>
        <AnalyticsDateNav selectedDate={selectedDate} onDateChange={setSelectedDate} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <button onClick={() => void loadProposals(selectedDate, true)} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-50" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, color: textSecondary }}>
          <RefreshCw className={} /> Обновить
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Всего КП" value={String(totalCount)} icon={<FileText className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Сумма" value={formatRubles(totalRevenue)} icon={<FileText className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="С QR-кодом" value={String(withQr)} icon={<QrCode className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Типов" value={String(Object.keys(byType).length)} icon={<Building2 className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: withAlpha(bgCard, 0.4), borderColor: borderSoft }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: borderSoft, background:  }}>
          <h3 className="text-sm font-black tracking-tight" style={{ color: textPrimary }}>КОММЕРЧЕСКИЕ ПРЕДЛОЖЕНИЯ</h3>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => (<div key={i} className="h-20 rounded-lg animate-pulse" style={{ backgroundColor: withAlpha(bgCard, 0.5) }} />))}</div>
        ) : proposals.length === 0 ? (
          <div className="p-8 text-center"><p className="text-sm" style={{ color: textSecondary }}>За этот день КП отсутствуют.</p></div>
        ) : (
          <div className="divide-y" style={{ borderColor: borderSoft }}>
            {proposals.map((p) => (
              <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} />
                    <span className="text-sm font-semibold" style={{ color: textPrimary }}>{p.client_name}</span>
                    {p.client_inn && (<span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: withAlpha(borderSoft, 0.4), color: textSecondary }}>ИНН {p.client_inn}</span>)}
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ backgroundColor: withAlpha(accentMain, 0.15), color: accentMain }}>{OFFER_TYPE_LABELS[p.offer_type] || p.offer_type}</span>
                    {p.qr_included && (<span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: withAlpha("#10b981", 0.15), color: "#10b981" }}><QrCode className="w-3 h-3" /> QR</span>)}
                  </div>
                  {p.client_phone && (<div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><a href={} className="text-xs hover:underline" style={{ color: accentMain }}>{p.client_phone}</a></div>)}
                  {p.client_email && (<div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><a href={} className="text-xs hover:underline" style={{ color: accentMain }}>{p.client_email}</a></div>)}
                  {p.offer_summary && (<p className="text-xs mt-1 line-clamp-2" style={{ color: textSecondary }}>{p.offer_summary}</p>)}
                </div>
                <div className="flex flex-col md:items-end gap-1">
                  <div className="text-lg font-black" style={{ color: accentMain }}>{formatRubles(p.total_price)}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: textSecondary }}>Срок действия: {p.validity_days} дн.</div>
                  <div className="text-[10px]" style={{ color: textSecondary }}>{formatRussianDate(p.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
