"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Tag, Mail, User, Bike, Shield, Calendar, RefreshCw, Table2 } from "lucide-react";

import { useAppContext } from "@/contexts/AppContext";
import {
  getSalesDashboard,
  type SaleDashboardItem,
  type SalesDashboardResult,
} from "@/app/franchize/server-actions/rentals-dashboard";
import { sendAnalyticsCsvToTelegram } from "@/app/franchize/server-actions/analytics-csv-send";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { withAlpha } from "@/app/franchize/lib/theme";
import { formatRubles, formatRussianDate, formatRussianDateOnly } from "../rentals-analytics/analytics-utils";
import { StatCard } from "../rentals-analytics/analytics-components/StatCard";
import { AnalyticsPasswordEntry } from "../rentals-analytics/analytics-components/AnalyticsPasswordEntry";
import { AnalyticsDateNav } from "../rentals-analytics/analytics-components/AnalyticsDateNav";
import { AnalyticsCrossNav } from "../rentals-analytics/analytics-components/AnalyticsCrossNav";
import { AnalyticsLoading } from "../rentals-analytics/analytics-components/AnalyticsLoading";
// FIX (F16): reuse the rentals analytics ExportCsvModal — it's just a
// date-range picker + Download button, agnostic to the export subject.
import { ExportCsvModal } from "../rentals-analytics/components/ExportCsvModal";
import type { ThemeTokens } from "../rentals-analytics/hooks/useTheme";

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
  // FIX (F16): CSV export modal state — mirrors the rentals-analytics pattern.
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const getActorUserId = useCallback((): string | null => dbUser?.user_id || passwordAuthOwnerId, [dbUser?.user_id, passwordAuthOwnerId]);

  const loadSales = useCallback(async (date: string, showRefresh = false) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) { setLoading(false); setRefreshing(false); return; }
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await getSalesDashboard({ slug: initialSlug.trim(), actorUserId, date, isPasswordAuth: !!passwordAuthOwnerId });
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

  const bgBase = "var(--franchize-bg-base)";
  const bgCard = "var(--franchize-bg-card)";
  const accentMain = "var(--franchize-accent-main)";
  const textPrimary = "var(--franchize-text-primary)";
  const textSecondary = "var(--franchize-text-secondary)";
  const borderSoft = "var(--franchize-border-soft)";

  // FIX (F16): build a ThemeTokens-compatible object so we can reuse the
  // rentals analytics ExportCsvModal (which expects T.* fields).
  const T: ThemeTokens = {
    text: textPrimary,
    textMuted: textSecondary,
    textFaint: `color-mix(in srgb, ${textSecondary} 65%, transparent)`,
    bg: bgBase,
    bgCard,
    bgCardHover: `color-mix(in srgb, ${accentMain} 6%, transparent)`,
    bgElevated: bgCard,
    border: `color-mix(in srgb, ${borderSoft} 45%, transparent)`,
    borderSoft: `color-mix(in srgb, ${borderSoft} 25%, transparent)`,
    borderActive: accentMain,
    inputBg: bgBase,
    inputBorder: borderSoft,
    shadow: "0 10px 30px rgba(0,0,0,0.25)",
    accent: accentMain,
    accentContrast: "#ffffff",
  };

  // FIX (F16 iter3): CSV table-view needs the CSV TEXT to render the rows.
  // Same fetch as `exportSalesCsv` but yields `resp.text()` instead of blob.
  const buildSalesCsvApiUrl = useCallback(
    (from: string, to: string) =>
      `/api/franchize/sales-csv-export?slug=${encodeURIComponent(initialSlug.trim())}` +
      `&from=${from}&to=${to}`,
    [initialSlug],
  );

  const fetchSalesCsvText = useCallback(
    async (from: string, to: string): Promise<string> => {
      const actorUserId = getActorUserId();
      if (!actorUserId) throw new Error("no actor user id");
      const resp = await fetch(buildSalesCsvApiUrl(from, to), {
        headers: { "x-telegram-user-id": actorUserId },
      });
      if (!resp.ok) throw new Error(`http ${resp.status}`);
      return await resp.text();
    },
    [buildSalesCsvApiUrl, getActorUserId],
  );

  // FIX (F16): sales CSV export — mirrors the rentals handler but hits the
  // /api/franchize/sales-csv-export endpoint. Includes the same Telegram
  // WebApp fallback path as the rentals version (F15).
  const exportSalesCsv = useCallback(
    async (from: string, to: string) => {
      const actorUserId = getActorUserId();
      if (!actorUserId) {
        toast.error("Не удалось определить пользователя для экспорта");
        return;
      }
      const csvApiUrl = buildSalesCsvApiUrl(from, to);
      const filename = `${initialSlug.trim()}-sales-${from}-to-${to}.csv`;
      const tgWebApp =
        typeof window !== "undefined" &&
        (window as { Telegram?: { WebApp?: { platform?: string; openLink?: (url: string) => void } } })
          .Telegram?.WebApp;
      const isTelegram = !!tgWebApp && typeof tgWebApp.openLink === "function";

      try {
        const resp = await fetch(csvApiUrl, {
          headers: { "x-telegram-user-id": actorUserId },
        });
        if (!resp.ok) {
          toast.error("Ошибка экспорта CSV");
          return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        if (!isTelegram) {
          toast.success("CSV скачан");
          return;
        }
        try {
          const absoluteUrl = `${window.location.origin}${csvApiUrl}`;
          await navigator.clipboard.writeText(absoluteUrl);
          toast.success(
            "CSV подготовлен. Если файл не сохранился — ссылка скопирована, откройте её в браузере.",
            { duration: 6000 },
          );
        } catch {
          toast.success("CSV подготовлен");
        }
      } catch (error) {
        console.error("[SalesAnalytics] exportSalesCsv:", error);
        if (isTelegram && tgWebApp!.openLink) {
          try {
            tgWebApp!.openLink!(`${window.location.origin}${csvApiUrl}`);
            toast.info("Открываю CSV в браузере…");
            return;
          } catch {
            // fall through
          }
        }
        toast.error("Ошибка экспорта CSV");
      }
    },
    [getActorUserId, buildSalesCsvApiUrl, initialSlug],
  );

  // FIX (iter4): send the sales CSV to the operator's Telegram chat via the bot.
  const sendSalesCsvToTelegram = useCallback(
    async (from: string, to: string) => {
      const actorUserId = getActorUserId();
      if (!actorUserId) {
        toast.error("Не удалось определить пользователя для отправки");
        return;
      }
      try {
        const result = await sendAnalyticsCsvToTelegram({
          slug: initialSlug.trim(),
          from,
          to,
          actorUserId,
          variant: "sales",
          format: "csv",
        });
        if (!result.success) {
          toast.error(result.error || "Не удалось отправить CSV в Telegram");
          return;
        }
        const s = result.summary;
        if (s) {
          toast.success(
            `Отправлено в Telegram: ${s.sales ?? 0} продаж, ` +
            `${s.totalRevenue.toLocaleString("ru-RU")} ₽`,
            { duration: 5000 },
          );
        } else {
          toast.success("CSV отправлен в Telegram");
        }
      } catch (err) {
        console.error("[SalesAnalytics] sendSalesCsvToTelegram:", err);
        toast.error("Ошибка отправки в Telegram");
      }
    },
    [getActorUserId, initialSlug],
  );

  if (authLoading) return <AnalyticsLoading accentMain={accentMain} bgBase={bgBase} />;
  if (!dbUser && !passwordAuthOwnerId) return <AnalyticsPasswordEntry crewName={crew.name} slug={initialSlug} onAuthenticated={setPasswordAuthOwnerId} />;

  const totalRevenue = summary?.totalRevenue || 0;
  const totalCount = summary?.totalCount ?? sales.length;
  const basePath = `/franchize/${initialSlug}`;

  return (
    <div className="space-y-4">
      <AnalyticsCrossNav activePage="sales" basePath={basePath} bgCard={bgCard} borderSoft={borderSoft} accentMain={accentMain} textSecondary={textSecondary} />

      <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-xl border" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}>
        <AnalyticsDateNav selectedDate={selectedDate} onDateChange={setSelectedDate} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <div className="flex items-center gap-2">
          {/* FIX (F16 iter3): table-view trigger — table icon only (no text).
              Opens the in-modal table view + download icon button for CSV. */}
          <button
            type="button"
            onClick={() => setCsvModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border px-2 py-1.5 text-xs font-bold transition focus:outline-none focus-visible:ring-2"
            style={{
              borderColor: withAlpha("#3b82f6", 0.3),
              backgroundColor: withAlpha("#3b82f6", 0.08),
              color: "#60a5fa",
              minHeight: "36px",
              minWidth: "36px",
            }}
            aria-label="Открыть таблицу и экспорт CSV"
            title="Таблица и экспорт CSV"
          >
            <Table2 className="w-3.5 h-3.5" aria-hidden />
          </button>
          <button onClick={() => void loadSales(selectedDate, true)} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-50" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, color: textSecondary }}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Обновить
          </button>
        </div>
      </div>

      {/* CSV table-view modal (date range picker + huge horizontally-
          scrollable table + download icon button + send-to-Telegram button). */}
      <ExportCsvModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onExport={exportSalesCsv}
        onSendTelegram={sendSalesCsvToTelegram}
        fetchCsvText={fetchSalesCsvText}
        variant="sales"
        T={T}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Всего продаж" value={String(totalCount)} icon={<Tag className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Выручка" value={formatRubles(totalRevenue)} icon={<Shield className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Средний чек" value={totalCount > 0 ? formatRubles(totalRevenue / totalCount) : "—"} icon={<Tag className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Дата" value={formatRussianDateOnly(selectedDate)} icon={<Calendar className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: withAlpha(bgCard, 0.4), borderColor: borderSoft }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: borderSoft, background: `linear-gradient(to right, ${withAlpha(accentMain, 0.05)}, transparent)` }}>
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
                  {sale.buyer_email && (<div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><a href={`mailto:${sale.buyer_email}`} className="text-xs hover:underline" style={{ color: accentMain }}>{sale.buyer_email}</a></div>)}
                  <div className="flex items-center gap-2"><Bike className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><span className="text-xs" style={{ color: textSecondary }}>{sale.vehicle ? `${sale.vehicle.make || ""} ${sale.vehicle.model || ""}`.trim() : "Техника не определена"}</span></div>
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
