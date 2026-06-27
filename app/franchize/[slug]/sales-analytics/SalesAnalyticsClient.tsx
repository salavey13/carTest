"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Tag,
  Mail,
  User,
  Bike,
  Shield,
  BarChart3,
  FileText,
} from "lucide-react";

import { useAppContext } from "@/contexts/AppContext";
import {
  getSalesDashboard,
  validateAnalyticsPassword,
  type SaleDashboardItem,
  type SalesDashboardResult,
} from "@/app/franchize/server-actions/rentals-dashboard";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { withAlpha } from "@/app/franchize/lib/theme";

const formatRubles = (amount: number | string | null | undefined): string => {
  if (amount == null) return "—";
  const n = typeof amount === "string" ? Number(amount.replace(/\s/g, "")) : amount;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};

const formatRussianDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: ru });
  } catch {
    return "—";
  }
};

const formatRussianDateOnly = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: ru });
  } catch {
    return "—";
  }
};

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

  // Password auth (optional — mirrors rentals-analytics flow)
  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValidating, setIsPasswordValidating] = useState(false);
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);

  const getActorUserId = useCallback((): string | null => dbUser?.user_id || passwordAuthOwnerId, [dbUser?.user_id, passwordAuthOwnerId]);

  // Show password prompt immediately if no auth available
  useEffect(() => {
    if (!authLoading && !dbUser && !passwordAuthOwnerId) {
      setShowPasswordEntry(true);
    }
  }, [authLoading, dbUser, passwordAuthOwnerId]);

  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const loadSales = useCallback(async (date: string, showRefresh = false) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) {
      // Never get stuck in the initial loading state.
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await getSalesDashboard({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        date,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (!result.success) {
        if (result.error?.includes("прав") || result.error?.includes("доступ")) {
          setShowPasswordEntry(true);
          toast.error("Требуется пароль");
          return;
        }
        toast.error(result.error || "Не удалось загрузить продажи");
        return;
      }

      setSales(result.data?.items || []);
      setSummary(result.data?.summary || null);
    } catch (error) {
      console.error("[SalesAnalytics] Load error:", error);
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getActorUserId, initialSlug, passwordAuthOwnerId]);

  useEffect(() => {
    if (getActorUserId()) {
      void loadSales(selectedDate);
    }
  }, [getActorUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (getActorUserId() && !authLoading) {
      void loadSales(selectedDate, true);
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) return;
    setIsPasswordValidating(true);
    setPasswordError(null);
    try {
      const result = await validateAnalyticsPassword({ password: passwordInput });
      if (!result.success) {
        setPasswordError(result.error || "Неверный пароль");
        return;
      }
      if (result.slug && result.slug !== initialSlug?.trim()) {
        setPasswordError(`Пароль для другого экипажа: ${result.slug}`);
        return;
      }
      setPasswordAuthOwnerId(result.ownerId || null);
      setShowPasswordEntry(false);
      setPasswordInput("");
      toast.success("Доступ разрешён");
    } catch {
      setPasswordError("Ошибка проверки пароля");
    } finally {
      setIsPasswordValidating(false);
    }
  };

  // Theme tokens
  const bgBase = "var(--franchize-bg-base)";
  const bgCard = "var(--franchize-bg-card)";
  const accentMain = "var(--franchize-accent-main)";
  const textPrimary = "var(--franchize-text-primary)";
  const textSecondary = "var(--franchize-text-secondary)";
  const borderSoft = "var(--franchize-border-soft)";

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgBase }}>
        <div className="w-12 h-12 rounded-full border-4 animate-spin" style={{ borderColor: withAlpha(accentMain, 0.2), borderTopColor: accentMain }} />
      </div>
    );
  }

  if (showPasswordEntry) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: bgBase }}>
        <div
          className="w-full max-w-sm p-6 rounded-2xl border"
          style={{ backgroundColor: bgCard, borderColor: borderSoft }}
        >
          <h2 className="text-lg font-bold mb-2" style={{ color: textPrimary }}>Доступ по паролю</h2>
          <p className="text-sm mb-4" style={{ color: textSecondary }}>Введите пароль аналитики для доступа к продажам.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handlePasswordSubmit(); }}
            className="w-full px-3 py-2 rounded-lg mb-3 outline-none"
            style={{ backgroundColor: bgBase, border: `1px solid ${borderSoft}`, color: textPrimary }}
            autoFocus
          />
          {passwordError && <p className="text-sm mb-3" style={{ color: "#f87171" }}>{passwordError}</p>}
          <button
            onClick={() => void handlePasswordSubmit()}
            disabled={isPasswordValidating}
            className="w-full py-2 rounded-lg font-bold disabled:opacity-50"
            style={{ backgroundColor: accentMain, color: "#ffffff" }}
          >
            {isPasswordValidating ? "Проверка..." : "Войти"}
          </button>
        </div>
      </div>
    );
  }

  const totalRevenue = summary?.totalRevenue || 0;
  const totalCount = summary?.totalCount ?? sales.length;
  const basePath = `/franchize/${initialSlug}`;

  return (
    <div className="space-y-4">
      {/* Cross-analytics navigation */}
      <div
        className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl border"
        style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
      >
        <BarChart3 className="w-3.5 h-3.5 ml-1.5 flex-shrink-0" style={{ color: textSecondary }} />
        <span className="text-[10px] uppercase font-bold tracking-wide mr-1" style={{ color: textSecondary }}>Аналитика:</span>
        <a
          href={`${basePath}/rentals-analytics`}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all"
          style={{ color: textSecondary, border: `1px solid ${borderSoft}` }}
        >
          <Calendar className="w-3 h-3" /> Аренды
        </a>
        <span
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold"
          style={{ backgroundColor: withAlpha(accentMain, 0.2), color: accentMain, border: `1px solid ${withAlpha(accentMain, 0.4)}` }}
        >
          <Tag className="w-3 h-3" /> Продажи
        </span>
        <a
          href={`${basePath}/commercial-offers-analytics`}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all"
          style={{ color: textSecondary, border: `1px solid ${borderSoft}` }}
        >
          <FileText className="w-3 h-3" /> КП
        </a>
      </div>

      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-xl border"
        style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate(-1)}
            className="p-2 rounded-lg border"
            style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
            aria-label="Предыдущий день"
          >
            <ChevronLeft className="w-4 h-4" style={{ color: textSecondary }} />
          </button>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
            style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
          >
            <Calendar className="w-4 h-4" style={{ color: accentMain }} />
            <span className="text-sm font-medium" style={{ color: textPrimary }}>
              {formatRussianDateOnly(selectedDate)}
            </span>
          </div>
          <button
            onClick={() => navigateDate(1)}
            className="p-2 rounded-lg border"
            style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
            aria-label="Следующий день"
          >
            <ChevronRight className="w-4 h-4" style={{ color: textSecondary }} />
          </button>
          <button
            onClick={() => { const d = new Date().toISOString().split("T")[0]; setSelectedDate(d); }}
            className="px-3 py-1.5 rounded-lg border text-xs font-bold"
            style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, color: textSecondary }}
          >
            Сегодня
          </button>
        </div>
        <button
          onClick={() => void loadSales(selectedDate, true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-50"
          style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, color: textSecondary }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Всего продаж" value={String(totalCount)} icon={<Tag className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Выручка" value={formatRubles(totalRevenue)} icon={<Shield className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Средний чек" value={totalCount > 0 ? formatRubles(totalRevenue / totalCount) : "—"} icon={<Tag className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Дата" value={formatRussianDateOnly(selectedDate)} icon={<Calendar className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
      </div>

      {/* List */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: withAlpha(bgCard, 0.4), borderColor: borderSoft }}
      >
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: borderSoft, background: `linear-gradient(to right, ${withAlpha(accentMain, 0.05)}, transparent)` }}
        >
          <h3 className="text-sm font-black tracking-tight" style={{ color: textPrimary }}>ДОГОВОРЫ КУПЛИ-ПРОДАЖИ</h3>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg animate-pulse" style={{ backgroundColor: withAlpha(bgCard, 0.5) }} />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: textSecondary }}>За этот день продажи отсутствуют.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: borderSoft }}>
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="p-4 flex flex-col md:flex-row md:items-center gap-3"
                style={{ borderColor: borderSoft }}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} />
                    <span className="text-sm font-semibold" style={{ color: textPrimary }}>
                      {sale.buyer_full_name || "Без имени"}
                    </span>
                  </div>
                  {sale.buyer_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} />
                      <a href={`mailto:${sale.buyer_email}`} className="text-xs hover:underline" style={{ color: accentMain }}>
                        {sale.buyer_email}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Bike className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} />
                    <span className="text-xs" style={{ color: textSecondary }}>
                      {sale.vehicle ? `${sale.vehicle.make || ""} ${sale.vehicle.model || ""}`.trim() : "Техника не определена"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col md:items-end gap-1">
                  <div className="text-lg font-black" style={{ color: accentMain }}>
                    {formatRubles(sale.sale_price)}
                  </div>
                  {sale.warranty_months && (
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: textSecondary }}>
                      Гарантия: {sale.warranty_months} мес.
                    </div>
                  )}
                  <div className="text-[10px]" style={{ color: textSecondary }}>
                    {formatRussianDate(sale.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Small stat card ────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  accentMain,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentMain: string;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <div
      className="p-3 rounded-xl border"
      style={{ backgroundColor: withAlpha(bgCard, 0.4), borderColor: borderSoft }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div style={{ color: accentMain }}>{icon}</div>
        <span className="text-[10px] md:text-xs uppercase tracking-wide font-bold" style={{ color: textSecondary }}>
          {label}
        </span>
      </div>
      <div className="text-lg md:text-xl font-black" style={{ color: textPrimary }}>
        {value}
      </div>
    </div>
  );
}