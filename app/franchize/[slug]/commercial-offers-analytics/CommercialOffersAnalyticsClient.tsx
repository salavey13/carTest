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
  FileText,
  Phone,
  Mail,
  QrCode,
  User,
  Building2,
  BarChart3,
  Tag,
} from "lucide-react";

import { useAppContext } from "@/contexts/AppContext";
import {
  getCommercialProposalsDashboard,
  validateAnalyticsPassword,
  type CommercialProposalItem,
  type CommercialProposalsResult,
} from "@/app/franchize/server-actions/rentals-dashboard";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { withAlpha } from "@/app/franchize/lib/theme";

const formatRubles = (amount: number | null | undefined): string => {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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

const OFFER_TYPE_LABELS: Record<string, string> = {
  rent: "Аренда",
  sale: "Продажа",
  service: "Сервис",
  lease: "Лизинг",
  unknown: "Другое",
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

  const loadProposals = useCallback(async (date: string, showRefresh = false) => {
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
      const result = await getCommercialProposalsDashboard({
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
        toast.error(result.error || "Не удалось загрузить КП");
        return;
      }

      setProposals(result.data?.items || []);
      setSummary(result.data?.summary || null);
    } catch (error) {
      console.error("[CommercialOffersAnalytics] Load error:", error);
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getActorUserId, initialSlug, passwordAuthOwnerId]);

  useEffect(() => {
    if (getActorUserId()) {
      void loadProposals(selectedDate);
    }
  }, [getActorUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (getActorUserId() && !authLoading) {
      void loadProposals(selectedDate, true);
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
        <div className="w-full max-w-sm p-6 rounded-2xl border" style={{ backgroundColor: bgCard, borderColor: borderSoft }}>
          <h2 className="text-lg font-bold mb-2" style={{ color: textPrimary }}>Доступ по паролю</h2>
          <p className="text-sm mb-4" style={{ color: textSecondary }}>Введите пароль аналитики для доступа к КП.</p>
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

  const totalCount = summary?.totalCount ?? proposals.length;
  const withQr = summary?.withQr ?? proposals.filter((p) => p.qr_included).length;
  const totalRevenue = proposals.reduce((sum, p) => sum + (p.total_price || 0), 0);
  const byType = summary?.byType || {};
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
        <a
          href={`${basePath}/sales-analytics`}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all"
          style={{ color: textSecondary, border: `1px solid ${borderSoft}` }}
        >
          <Tag className="w-3 h-3" /> Продажи
        </a>
        <span
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold"
          style={{ backgroundColor: withAlpha(accentMain, 0.2), color: accentMain, border: `1px solid ${withAlpha(accentMain, 0.4)}` }}
        >
          <FileText className="w-3 h-3" /> КП
        </span>
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
          onClick={() => void loadProposals(selectedDate, true)}
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
        <StatCard label="Всего КП" value={String(totalCount)} icon={<FileText className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Сумма" value={formatRubles(totalRevenue)} icon={<FileText className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="С QR-кодом" value={String(withQr)} icon={<QrCode className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatCard label="Типов" value={String(Object.keys(byType).length)} icon={<Building2 className="w-4 h-4" />} accentMain={accentMain} bgCard={bgCard} borderSoft={borderSoft} textPrimary={textPrimary} textSecondary={textSecondary} />
      </div>

      {/* List */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: withAlpha(bgCard, 0.4), borderColor: borderSoft }}>
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: borderSoft, background: `linear-gradient(to right, ${withAlpha(accentMain, 0.05)}, transparent)` }}
        >
          <h3 className="text-sm font-black tracking-tight" style={{ color: textPrimary }}>КОММЕРЧЕСКИЕ ПРЕДЛОЖЕНИЯ</h3>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg animate-pulse" style={{ backgroundColor: withAlpha(bgCard, 0.5) }} />
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: textSecondary }}>За этот день КП отсутствуют.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: borderSoft }}>
            {proposals.map((p) => (
              <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} />
                    <span className="text-sm font-semibold" style={{ color: textPrimary }}>{p.client_name}</span>
                    {p.client_inn && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: withAlpha(borderSoft, 0.4), color: textSecondary }}>
                        ИНН {p.client_inn}
                      </span>
                    )}
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                      style={{ backgroundColor: withAlpha(accentMain, 0.15), color: accentMain }}
                    >
                      {OFFER_TYPE_LABELS[p.offer_type] || p.offer_type}
                    </span>
                    {p.qr_included && (
                      <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: withAlpha("#10b981", 0.15), color: "#10b981" }}>
                        <QrCode className="w-3 h-3" /> QR
                      </span>
                    )}
                  </div>
                  {p.client_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} />
                      <a href={`tel:${p.client_phone}`} className="text-xs hover:underline" style={{ color: accentMain }}>{p.client_phone}</a>
                    </div>
                  )}
                  {p.client_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} />
                      <a href={`mailto:${p.client_email}`} className="text-xs hover:underline" style={{ color: accentMain }}>{p.client_email}</a>
                    </div>
                  )}
                  {p.offer_summary && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: textSecondary }}>{p.offer_summary}</p>
                  )}
                </div>
                <div className="flex flex-col md:items-end gap-1">
                  <div className="text-lg font-black" style={{ color: accentMain }}>{formatRubles(p.total_price)}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: textSecondary }}>
                    Срок действия: {p.validity_days} дн.
                  </div>
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
    <div className="p-3 rounded-xl border" style={{ backgroundColor: withAlpha(bgCard, 0.4), borderColor: borderSoft }}>
      <div className="flex items-center gap-1.5 mb-1">
        <div style={{ color: accentMain }}>{icon}</div>
        <span className="text-[10px] md:text-xs uppercase tracking-wide font-bold" style={{ color: textSecondary }}>{label}</span>
      </div>
      <div className="text-lg md:text-xl font-black" style={{ color: textPrimary }}>{value}</div>
    </div>
  );
}