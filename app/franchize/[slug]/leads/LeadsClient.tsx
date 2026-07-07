"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Flame, Phone, CheckCircle, ChevronDown, ChevronRight, Plus,
  Trash2, MessageCircle, Send, Clock, TrendingUp, Search,
  X, Bike, FileText, Mail, CircleDot, Users, Lock, AlertCircle,
} from "lucide-react";
import { validateAnalyticsPassword } from "../../server-actions/rentals-dashboard";

// ── Types ────────────────────────────────────────────────────────────────────

interface LeadRow {
  user_id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  source: string;
  bikeTitle: string | null;
  createdAt: string | null;
  verified: boolean;
  intentType?: string | null;
  intentStage?: string | null;
  urgencyScore?: number | null;
}

interface TodoRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  description?: string | null;
}

interface LeadsClientProps {
  leads: LeadRow[];
  todos: TodoRow[];
  crewId: string;
  slug: string;
  accentColor: string;
  textColor?: string;
  bgColor?: string;
  isLightTheme?: boolean;
  isAuto?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; icon: typeof Flame; color: string; bg: string }> = {
  web_callback:    { label: "Звонок",     icon: Phone,        color: "#3b82f6", bg: "#3b82f620" },
  rental_contract: { label: "Аренда",     icon: CheckCircle,  color: "#10b981", bg: "#10b98120" },
  sale_contract:   { label: "Покупка",    icon: TrendingUp,   color: "#f59e0b", bg: "#f59e0b20" },
  test_drive:      { label: "Тест-драйв", icon: Bike,         color: "#8b5cf6", bg: "#8b5cf620" },
  dashboard_intent:{ label: "Заявка",     icon: Flame,        color: "#ef4444", bg: "#ef444420" },
  rental_secret:   { label: "Документы",  icon: FileText,     color: "#06b6d4", bg: "#06b6d420" },
  profile_prefill:{ label: "Профиль",    icon: FileText,     color: "#6366f1", bg: "#6366f120" },
  unknown:         { label: "Клиент",     icon: Users,        color: "#64748b", bg: "#64748b20" },
};

const STAGE_LABELS: Record<string, string> = {
  contract_generated: "Договор готов",
  checkout_started: "Оформление",
  checkout_completed: "Оплачен",
  dismissed: "Отклонён",
  interest_paid: "Интерес",
  new: "Новый",
  contacted: "Контакт установлен",
};

const INTENT_LABELS: Record<string, string> = {
  rent: "Аренда",
  sale: "Покупка",
  test_drive: "Тест-драйв",
  rental_contract: "Аренда",
  sale_contract: "Покупка",
};

type SortMode = "recent" | "urgent" | "name" | "verified";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffH < 24) return `${diffH} ч назад`;
  if (diffD === 1) return "вчера";
  if (diffD < 7) return `${diffD} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function temperatureColor(urgency: number | null | undefined, pendingTodos: number): string {
  const score = (urgency || 0) + pendingTodos * 15;
  if (score >= 90) return "#ef4444"; // red-hot
  if (score >= 60) return "#f59e0b"; // warm
  if (score >= 30) return "#3b82f6"; // cool
  return "#64748b"; // cold
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, source, size = 40 }: { name: string | null; source: string; size?: number }) {
  const meta = SOURCE_META[source] || SOURCE_META.unknown;
  const initials = getInitials(name);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: meta.bg,
        color: meta.color,
        fontSize: size > 36 ? "13px" : "11px",
      }}
    >
      {initials}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function LeadsClient({
  leads, todos, crewId, slug, accentColor,
  textColor = "#e5e7eb", bgColor = "#0a0a0a", isLightTheme = false, isAuto = false,
}: LeadsClientProps) {
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [filterSource, setFilterSource] = useState<string>("all");

  // ── Password auth (same as rentals-analytics) ──────────────────────────────
  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValidating, setIsPasswordValidating] = useState(false);
  const [passwordAuthed, setPasswordAuthed] = useState(false);

  // Check if we're inside Telegram WebApp (has initData)
  const isInTelegram = useMemo(() => {
    if (typeof window === "undefined") return false;
    const tg = (window as any).Telegram?.WebApp;
    return !!(tg?.initData && tg.initData.length > 0);
  }, []);

  // Show password prompt if not in Telegram
  useEffect(() => {
    if (!isInTelegram && !passwordAuthed) {
      setShowPasswordEntry(true);
    }
  }, [isInTelegram, passwordAuthed]);

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
      if (result.slug && result.slug !== slug.trim()) {
        setPasswordError(`Пароль для другого экипажа`);
        return;
      }
      setPasswordAuthed(true);
      setShowPasswordEntry(false);
      setPasswordInput("");
    } catch {
      setPasswordError("Ошибка проверки пароля");
    } finally {
      setIsPasswordValidating(false);
    }
  };

  // ── Theme tokens ──────────────────────────────────────────────────────────

  const T = useMemo(() => {
    if (isAuto) {
      return {
        text: "var(--franchize-text-primary)",
        textMuted: "var(--franchize-text-secondary)",
        textFaint: "color-mix(in srgb, var(--franchize-text-secondary) 60%, transparent)",
        bg: "var(--franchize-bg-base)",
        bgCard: "color-mix(in srgb, var(--franchize-bg-card) 96%, transparent)",
        bgCardHover: "color-mix(in srgb, var(--franchize-accent-main) 5%, transparent)",
        border: "color-mix(in srgb, var(--franchize-border-soft) 50%, transparent)",
        borderActive: "var(--franchize-accent-main)",
        inputBg: "var(--franchize-bg-base)",
        inputBorder: "color-mix(in srgb, var(--franchize-border-soft) 60%, transparent)",
        shadow: "none",
      };
    }
    return {
      text: isLightTheme ? "#1e293b" : textColor,
      textMuted: isLightTheme ? "#64748b" : `${textColor}99`,
      textFaint: isLightTheme ? "#94a3b8" : `${textColor}60`,
      bg: isLightTheme ? "#f8fafc" : bgColor,
      bgCard: isLightTheme ? "#ffffff" : `${accentColor}06`,
      bgCardHover: isLightTheme ? "#f1f5f9" : `${accentColor}0c`,
      border: isLightTheme ? "#e2e8f0" : `${accentColor}1a`,
      borderActive: isLightTheme ? accentColor : accentColor,
      inputBg: isLightTheme ? "#ffffff" : `${accentColor}0a`,
      inputBorder: isLightTheme ? "#cbd5e1" : `${accentColor}25`,
      shadow: isLightTheme ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
    };
  }, [isLightTheme, textColor, bgColor, accentColor, isAuto]);

  // ── Todo helpers ──────────────────────────────────────────────────────────

  const getTodoLeadId = useCallback((todo: TodoRow): string | null => {
    if (!todo.description) return null;
    try {
      return JSON.parse(todo.description).lead_id || null;
    } catch {
      return null;
    }
  }, []);

  const getTodosForLead = useCallback((leadId: string): TodoRow[] => {
    return todos.filter((t) => getTodoLeadId(t) === leadId);
  }, [todos, getTodoLeadId]);

  // ── Dedup leads by user_id (keep highest-priority source) ──────────────────

  const dedupedLeads = useMemo(() => {
    const map = new Map<string, LeadRow>();
    const sourcePriority: Record<string, number> = {
      rental_contract: 5, sale_contract: 4, test_drive: 3,
      dashboard_intent: 2, web_callback: 1, rental_secret: 0,
      profile_prefill: 0, unknown: -1,
    };
    for (const lead of leads) {
      const existing = map.get(lead.user_id);
      if (!existing) {
        map.set(lead.user_id, lead);
      } else {
        const leadScore = sourcePriority[lead.source] ?? 0;
        const existScore = sourcePriority[existing.source] ?? 0;
        if (leadScore > existScore) {
          map.set(lead.user_id, {
            ...lead,
            phone: lead.phone || existing.phone,
            full_name: lead.full_name || existing.full_name,
            username: lead.username || existing.username,
            bikeTitle: lead.bikeTitle || existing.bikeTitle,
            verified: lead.verified || existing.verified,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [leads]);

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    let result = dedupedLeads;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        (l.full_name || "").toLowerCase().includes(q) ||
        (l.phone || "").includes(q) ||
        (l.username || "").toLowerCase().includes(q) ||
        (l.bikeTitle || "").toLowerCase().includes(q)
      );
    }
    if (filterSource !== "all") {
      result = result.filter((l) => l.source === filterSource);
    }
    return result;
  }, [dedupedLeads, searchQuery, filterSource]);

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];
    switch (sortMode) {
      case "urgent":
        return arr.sort((a, b) => {
          const aT = getTodosForLead(a.user_id).filter((t) => t.status !== "done").length;
          const bT = getTodosForLead(b.user_id).filter((t) => t.status !== "done").length;
          const aScore = (a.urgencyScore || 0) + aT * 20;
          const bScore = (b.urgencyScore || 0) + bT * 20;
          if (aScore !== bScore) return bScore - aScore;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
      case "name":
        return arr.sort((a, b) => (a.full_name || "яя").localeCompare(b.full_name || "яя", "ru"));
      case "verified":
        return arr.sort((a, b) => {
          if (a.verified !== b.verified) return a.verified ? -1 : 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
      default:
        return arr.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
  }, [filteredLeads, sortMode, getTodosForLead]);

  // ── Buckets ────────────────────────────────────────────────────────────────

  const { hot, verified, warm } = useMemo(() => {
    const hot: LeadRow[] = [];
    const verified: LeadRow[] = [];
    const warm: LeadRow[] = [];
    for (const l of sortedLeads) {
      const pt = getTodosForLead(l.user_id).filter((t) => t.status !== "done").length;
      if (l.verified) { verified.push(l); continue; }
      if ((l.urgencyScore ?? 0) >= 60 || pt > 0) { hot.push(l); continue; }
      warm.push(l);
    }
    return { hot, verified, warm };
  }, [sortedLeads, getTodosForLead]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const availableSources = useMemo(() => {
    const set = new Set(leads.map((l) => l.source));
    return Array.from(set);
  }, [leads]);

  const pendingTodoCount = todos.filter((t) => t.status !== "done").length;
  const hasFilters = searchQuery || filterSource !== "all";

  // ── Password gate render ──────────────────────────────────────────────────
  if (showPasswordEntry && !passwordAuthed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div
          className="w-full max-w-sm space-y-4 rounded-2xl border p-6"
          style={{
            borderColor: T.border,
            backgroundColor: T.bgCard,
            boxShadow: T.shadow,
          }}
        >
          <div className="text-center">
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 8%, transparent)" : `${accentColor}15` }}
            >
              <Lock className="h-6 w-6" style={{ color: accentColor }} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: T.text }}>
              Клиенты и заявки
            </h2>
            <p className="mt-1 text-sm" style={{ color: T.textMuted }}>
              Введите пароль для доступа
            </p>
          </div>

          <input
            type="password"
            value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
            placeholder="••••••••"
            disabled={isPasswordValidating}
            className="w-full rounded-xl border px-4 py-3 text-center tracking-widest outline-none transition focus:ring-2"
            style={{
              borderColor: T.inputBorder,
              backgroundColor: T.inputBg,
              color: T.text,
            }}
            autoFocus
          />

          {passwordError && (
            <p className="flex items-center justify-center gap-1.5 text-center text-sm text-red-400">
              <AlertCircle className="h-4 w-4" />
              {passwordError}
            </p>
          )}

          <button
            onClick={handlePasswordSubmit}
            disabled={isPasswordValidating || !passwordInput.trim()}
            className="w-full rounded-xl py-3 font-bold transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accentColor, color: isAuto ? "var(--franchize-accent-contrast)" : "#fff" }}
          >
            {isPasswordValidating ? "Проверка..." : "Войти"}
          </button>

          <p className="text-center text-xs" style={{ color: T.textFaint }}>
            Пароль можно получить через бота: /analytics-pass
          </p>
        </div>
      </div>
    );
  }

  // ── Dismiss ────────────────────────────────────────────────────────────────

  const handleDismissLead = async (leadId: string) => {
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, dismissLead: true, slug }),
      });
      if (!resp.ok) {
        alert("Не удалось убрать лид. Попробуйте позже.");
        return;
      }
      window.location.reload();
    } catch {
      alert("Ошибка сети.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Sticky toolbar ────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 -mx-4 border-b px-4 py-3 backdrop-blur-md sm:rounded-xl sm:border"
        style={{
          backgroundColor: isAuto ? "color-mix(in srgb, var(--franchize-bg-base) 85%, transparent)" : (isLightTheme ? "rgba(248,250,252,0.85)" : `${bgColor}d9`),
          borderColor: T.border,
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: T.textFaint }} />
            <input
              type="text"
              placeholder="Имя, телефон, байк…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border py-2 pl-9 pr-8 text-sm outline-none transition focus:ring-2"
              style={{
                backgroundColor: T.inputBg,
                borderColor: T.inputBorder,
                color: T.text,
                // @ts-ignore — CSS custom prop for ring color
                "--tw-ring-color": isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 25%, transparent)" : `${accentColor}40`,
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 transition hover:opacity-80"
                style={{ color: T.textFaint }}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort + filter */}
          <div className="flex gap-2">
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
              className="rounded-lg border px-2.5 py-2 text-xs outline-none"
              style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}>
              <option value="all">Все источники</option>
              {availableSources.map((s) => (
                <option key={s} value={s}>{SOURCE_META[s]?.label || s}</option>
              ))}
            </select>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-lg border px-2.5 py-2 text-xs outline-none"
              style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}>
              <option value="recent">Свежие</option>
              <option value="urgent">🔥 Срочные</option>
              <option value="verified">✅ Клиенты</option>
              <option value="name">А→Я</option>
            </select>
          </div>
        </div>

        {/* Stats row — compact */}
        <div className="mt-2 flex gap-3 text-xs" style={{ color: T.textMuted }}>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <strong style={{ color: T.text }}>{dedupedLeads.length}</strong> всего
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <strong style={{ color: T.text }}>{verified.length}</strong> клиентов
          </span>
          {hot.length > 0 && (
            <span className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-red-400" />
              <strong style={{ color: T.text }}>{hot.length}</strong> горячих
            </span>
          )}
          {pendingTodoCount > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <strong style={{ color: T.text }}>{pendingTodoCount}</strong> задач
            </span>
          )}
        </div>
      </div>

      {/* ── Lead sections ────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {hot.length > 0 && (
          <Section title="Горячие" count={hot.length} icon={Flame} color="#ef4444"
            leads={hot} T={T} accentColor={accentColor}
            expandedLead={expandedLead} setExpandedLead={setExpandedLead}
            getTodosForLead={getTodosForLead} crewId={crewId} slug={slug}
            onDismiss={handleDismissLead}
            isAuto={isAuto}
          />
        )}
        {verified.length > 0 && (
          <Section title="Клиенты" count={verified.length} icon={CheckCircle} color="#10b981"
            leads={verified} T={T} accentColor={accentColor}
            expandedLead={expandedLead} setExpandedLead={setExpandedLead}
            getTodosForLead={getTodosForLead} crewId={crewId} slug={slug}
            onDismiss={handleDismissLead}
            isAuto={isAuto}
          />
        )}
        {warm.length > 0 && (
          <Section title="Заявки" count={warm.length} icon={Phone} color="#3b82f6"
            leads={warm} T={T} accentColor={accentColor}
            expandedLead={expandedLead} setExpandedLead={setExpandedLead}
            getTodosForLead={getTodosForLead} crewId={crewId} slug={slug}
            onDismiss={handleDismissLead}
            isAuto={isAuto}
          />
        )}
      </div>

      {/* Empty state */}
      {sortedLeads.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border p-12 text-center" style={{ borderColor: T.border }}>
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 6%, transparent)" : `${accentColor}10` }}>
            {hasFilters
              ? <Search className="h-7 w-7" style={{ color: T.textFaint }} />
              : <Users className="h-7 w-7" style={{ color: T.textFaint }} />}
          </div>
          <p className="text-sm font-medium" style={{ color: T.text }}>
            {hasFilters ? "Ничего не найдено" : "Пока нет заявок"}
          </p>
          <p className="mt-1 text-xs" style={{ color: T.textFaint }}>
            {hasFilters ? "Попробуйте изменить фильтры" : "Заявки появятся автоматически"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

type Theme = {
  text: string; textMuted: string; textFaint: string;
  bg: string; bgCard: string; bgCardHover: string;
  border: string; borderActive: string;
  inputBg: string; inputBorder: string; shadow: string;
};

function Section({
  title, count, icon: Icon, color, leads, T, accentColor,
  expandedLead, setExpandedLead, getTodosForLead, crewId, slug, onDismiss, isAuto,
}: {
  title: string; count: number; icon: typeof Flame; color: string;
  leads: LeadRow[]; T: Theme; accentColor: string;
  expandedLead: string | null; setExpandedLead: (id: string | null) => void;
  getTodosForLead: (id: string) => TodoRow[];
  crewId: string; slug: string; onDismiss: (leadId: string) => void;
  isAuto: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color }} />
        <h2 className="text-sm font-bold" style={{ color }}>{title}</h2>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: `${color}20`, color }}>
          {count}
        </span>
      </div>
      <div className="space-y-2">
        {leads.map((lead) => (
          <LeadCard
            key={lead.user_id}
            lead={lead}
            T={T}
            accentColor={accentColor}
            isExpanded={expandedLead === lead.user_id}
            onToggle={() => setExpandedLead(expandedLead === lead.user_id ? null : lead.user_id)}
            todos={getTodosForLead(lead.user_id)}
            crewId={crewId}
            slug={slug}
            onDismiss={onDismiss}
            isAuto={isAuto}
          />
        ))}
      </div>
    </div>
  );
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead, T, accentColor, isExpanded, onToggle, todos, crewId, slug, onDismiss, isAuto,
}: {
  lead: LeadRow; T: Theme; accentColor: string;
  isExpanded: boolean; onToggle: () => void;
  todos: TodoRow[]; crewId: string; slug: string;
  onDismiss: (leadId: string) => void;
  isAuto: boolean;
}) {
  const meta = SOURCE_META[lead.source] || SOURCE_META.unknown;
  const relTime = relativeTime(lead.createdAt);
  const stageLabel = lead.intentStage ? STAGE_LABELS[lead.intentStage] || lead.intentStage : null;
  const intentLabel = lead.intentType ? INTENT_LABELS[lead.intentType] || lead.intentType : null;
  const pendingTodos = todos.filter((t) => t.status !== "done").length;
  const phoneDigits = (lead.phone || "").replace(/\D/g, "");
  const tempColor = temperatureColor(lead.urgencyScore, pendingTodos);

  return (
    <div
      className="overflow-hidden rounded-xl border transition-all duration-200"
      style={{
        backgroundColor: T.bgCard,
        borderColor: isExpanded ? T.borderActive : T.border,
        boxShadow: T.shadow,
        borderLeft: `3px solid ${tempColor}`,
      }}
    >
      {/* Header */}
      <div
        className="flex cursor-pointer items-center gap-3 p-3 transition-colors duration-150"
        onClick={onToggle}
        style={{ backgroundColor: isExpanded ? T.bgCardHover : undefined }}
      >
        <Avatar name={lead.full_name} source={lead.source} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold" style={{ color: T.text }}>
                {lead.full_name || (lead.source === "test_drive" ? "Новый тест-драйв" : "Без имени")}
            </p>
            {lead.verified && (
              <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]" style={{ color: T.textMuted }}>
            {lead.phone && <span className="truncate">{lead.phone}</span>}
            {lead.username && <span>@{lead.username}</span>}
            {relTime && <span className="opacity-70">{relTime}</span>}
          </div>
        </div>

        {/* Badges */}
        <div className="flex shrink-0 items-center gap-1.5">
          {pendingTodos > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-400">
              {pendingTodos}
            </span>
          )}
          {intentLabel && (
            <span className="hidden rounded-full px-2 py-0.5 text-[9px] font-medium sm:inline"
              style={{ backgroundColor: meta.bg, color: meta.color }}>
              {intentLabel}
            </span>
          )}
          {isExpanded
            ? <ChevronDown className="h-4 w-4" style={{ color: T.textFaint }} />
            : <ChevronRight className="h-4 w-4" style={{ color: T.textFaint }} />}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t px-3 py-3" style={{ borderColor: T.border }}>
          {/* Stage + urgency */}
          {(stageLabel || lead.urgencyScore != null || lead.bikeTitle) && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {stageLabel && (
                <InfoTile label="Стадия" value={stageLabel} T={T} />
              )}
              {lead.urgencyScore != null && (
                <InfoTile label="Приоритет" value={
                  lead.urgencyScore >= 80 ? "🔥 Высокий" :
                  lead.urgencyScore >= 50 ? "⚡ Средний" : "💤 Низкий"
                } T={T} />
              )}
              {lead.bikeTitle && (
                <InfoTile label="Байк" value={lead.bikeTitle} T={T} />
              )}
            </div>
          )}

          {/* Contact actions */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {lead.phone && (
              <>
                <ActionBtn href={`tel:${lead.phone}`} icon={Phone} label="Звонок" T={T} accent={accentColor} isAuto={isAuto} />
                <ActionBtn href={`https://wa.me/${phoneDigits}`} icon={MessageCircle} label="WhatsApp" T={T} accent={accentColor} external isAuto={isAuto} />
                <ActionBtn href={`sms:${lead.phone}`} icon={Mail} label="SMS" T={T} accent={accentColor} isAuto={isAuto} />
              </>
            )}
            {lead.username && (
              <ActionBtn href={`https://t.me/${lead.username}`} icon={Send} label="Telegram" T={T} accent={accentColor} external isAuto={isAuto} />
            )}
          </div>

          {/* Todos */}
          <TodoList
            leadId={lead.user_id}
            leadName={lead.full_name || (lead.source === "test_drive" ? "Новый тест-драйв" : "Без имени")}
            todos={todos}
            crewId={crewId}
            slug={slug}
            T={T}
            accentColor={accentColor}
            isAuto={isAuto}
          />

          {/* Dismiss */}
          <div className="mt-3 border-t pt-2" style={{ borderColor: T.border }}>
            <button
              onClick={() => {
                if (confirm(`Убрать «${lead.full_name || (lead.source === "test_drive" ? "тест-драйв" : "лид")}» из списка?`)) onDismiss(lead.user_id);
              }}
              className="flex items-center gap-1 text-[11px] transition hover:text-red-400"
              style={{ color: T.textFaint }}
            >
              <Trash2 className="h-3 w-3" /> Скрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small UI atoms ────────────────────────────────────────────────────────────

function InfoTile({ label, value, T }: { label: string; value: string; T: Theme }) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: T.border }}>
      <p className="text-[9px] uppercase tracking-wide" style={{ color: T.textFaint }}>{label}</p>
      <p className="text-xs font-medium" style={{ color: T.text }}>{value}</p>
    </div>
  );
}

function ActionBtn({ href, icon: Icon, label, T, accent, external, isAuto }: {
  href: string; icon: typeof Phone; label: string; T: Theme; accent: string; external?: boolean; isAuto?: boolean;
}) {
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}
      className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition hover:opacity-70"
      style={{ borderColor: isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 25%, transparent)" : `${accent}40`, color: accent }}>
      <Icon className="h-3 w-3" /> {label}
    </a>
  );
}

// ── Todo List ────────────────────────────────────────────────────────────────

function TodoList({
  leadId, leadName, todos, crewId, slug, T, accentColor, isAuto,
}: {
  leadId: string; leadName: string; todos: TodoRow[];
  crewId: string; slug: string; T: Theme; accentColor: string;
  isAuto?: boolean;
}) {
  const [localTodos, setLocalTodos] = useState<TodoRow[]>(todos);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  // Sync when server data changes
  useEffect(() => { setLocalTodos(todos); }, [todos]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crewId, slug, leadId, leadName, title: newTitle.trim(), priority: newPriority }),
      });
      const data = await resp.json();
      if (data.success && data.todo) {
        setLocalTodos([data.todo, ...localTodos]);
        setNewTitle("");
        setShowAddForm(false);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleToggle = async (todoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    const prev = localTodos;
    setLocalTodos(localTodos.map((t) => (t.id === todoId ? { ...t, status: newStatus } : t)));
    try {
      const r = await fetch("/api/franchize/lead-todo", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoId, status: newStatus }),
      });
      if (!r.ok) throw new Error();
    } catch { setLocalTodos(prev); }
  };

  const handleDelete = async (todoId: string) => {
    const prev = localTodos;
    setLocalTodos(localTodos.filter((t) => t.id !== todoId));
    try {
      const r = await fetch("/api/franchize/lead-todo", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoId }),
      });
      if (!r.ok) throw new Error();
    } catch { setLocalTodos(prev); }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium" style={{ color: T.textMuted }}>Задачи</p>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition hover:opacity-70"
          style={{ borderColor: isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 19%, transparent)" : `${accentColor}30`, color: accentColor }}>
          <Plus className="h-2.5 w-2.5" /> Добавить
        </button>
      </div>

      {showAddForm && (
        <div className="mb-2 space-y-1.5 rounded-lg border p-2" style={{ borderColor: T.inputBorder }}>
          <input
            type="text" placeholder="Что нужно сделать?"
            value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full rounded border px-2 py-1 text-xs outline-none"
            style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }}
            autoFocus
          />
          <div className="flex gap-1.5">
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
              className="rounded border px-1.5 py-1 text-[10px] outline-none"
              style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }}>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
            </select>
            <button onClick={handleAdd} disabled={saving || !newTitle.trim()}
              className="rounded px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: accentColor }}>
              {saving ? "…" : "OK"}
            </button>
          </div>
        </div>
      )}

      {localTodos.length === 0 ? (
        <p className="py-1.5 text-center text-[10px]" style={{ color: T.textFaint }}>Нет задач</p>
      ) : (
        <div className="space-y-0.5">
          {localTodos.map((todo) => (
            <div key={todo.id}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition hover:bg-black/5"
              style={{ opacity: todo.status === "done" ? 0.4 : 1 }}>
              <button onClick={() => handleToggle(todo.id, todo.status)} className="shrink-0">
                {todo.status === "done"
                  ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  : <CircleDot className="h-3.5 w-3.5" style={{ color: T.textFaint }} />}
              </button>
              <span className={`flex-1 text-[11px] ${todo.status === "done" ? "line-through" : ""}`}
                style={{ color: T.text }}>
                {todo.title}
              </span>
              {todo.priority === "high" && todo.status !== "done" && (
                <span className="rounded bg-red-500/20 px-1 text-[8px] text-red-400">!</span>
              )}
              <button onClick={() => handleDelete(todo.id)}
                className="shrink-0 opacity-40 transition hover:opacity-80">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
