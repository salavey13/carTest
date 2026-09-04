// /app/franchize/[slug]/leads/LeadsClient.tsx
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronDown, Info, Lock, Sparkles } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import type {LeadRow, LeadTodoRow} from "./leads-types";
import { getFranchizeLeads } from "@/app/franchize/server-actions/leads";
import { isAvitoLead } from "./leads-utils";
import { isHandlingTodo } from "./lib/lead-handling";
import { computeLeadKpi } from "./lib/lead-kpi";
import { computeLeadAchievements } from "./lib/lead-achievements";

// Import extracted components
import { LeadsKPICards } from "./components/LeadsKPICards";
import { LeadSpeedPanel } from "./components/LeadSpeedPanel";
import { LeadsFunnelPanel } from "./components/LeadsFunnelPanel";
import { LeadsAchievementsPanel } from "./components/LeadsAchievementsPanel";
import { LeadsToolbar } from "./components/LeadsToolbar";
import { LeadList } from "./components/LeadList";
import { LeadBoard } from "./components/LeadBoard";
import { LeadTableView } from "./components/LeadTableView";
import { LeadDetailSheet } from "./components/LeadDetailSheet";
import type { LeadDrawerNote } from "./components/LeadDetailDrawer";
import { getLeadNotes, createLeadNote } from "@/app/franchize/server-actions/lead-notes";
import { notifyLeadViaTelegram } from "@/app/franchize/server-actions/lead-notify";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { EmptyState } from "./components/EmptyState";
import { LeadDetailContent } from "./components/LeadDetailContent";
import { DismissLeadDialog, type DismissReason } from "./components/DismissLeadDialog";

// Import constants
import {
  type Segment,
  type ViewMode,
  type SortMode,
  type FilterFlags,
} from "./leads-constants";
import { LEADS_PAGE_SIZE } from "./leads-constants";

// Import hooks
import { useTodosMapping, useFilteredSortedLeads, usePriorityMap } from "./hooks/useLeadsData";
import { useTheme } from "./hooks/useTheme";
import { usePasswordGate } from "./hooks/usePasswordGate";
import type { LeadPriority } from "./lib/lead-priority";

// ── Types ────────────────────────────────────────────────────────────────────

interface LeadsClientProps {
  leads: LeadRow[];
  todos: LeadTodoRow[];
  crewId: string;
  slug: string;
  accentColor: string;
  textColor?: string;
  bgColor?: string;
  isLightTheme?: boolean;
  isAuto?: boolean;
}

// ── In-app notifications (typed toast) ─────────────────────────────────────
// Everything the page wants to tell the operator inline — copy/notify/todo/
// dismiss results — flows through ONE typed toast instead of a plain pill
// (and instead of window.alert for the destructive-action failures).
// Type drives the icon + accent color; the toast animates in/out, is
// tappable to dismiss and sits above the sheet (z-[70]) with safe-area-aware
// bottom offset so the iOS home indicator never covers it.
type ToastKind = "info" | "success" | "error";

interface ToastState {
  id: number;
  msg: string;
  kind: ToastKind;
}

const TOAST_META: Record<ToastKind, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: "#3b82f6" },
  success: { icon: CheckCircle2, color: "#22c55e" },
  error: { icon: AlertCircle, color: "#ef4444" },
};

// ── Main Component ───────────────────────────────────────────────────────────

export function LeadsClient({
  leads,
  todos,
  crewId,
  slug,
  accentColor,
  textColor = "#e5e7eb",
  bgColor = "#0a0a0a",
  isLightTheme = false,
  isAuto = false,
}: LeadsClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  // ТЗ п.1–2: дефолтная сортировка «priority» — комплексный индекс 0–100
  // (LIFO-свежесть, Авито ×2): горячие и свежие обращения сверху, а не
  // пропадают в общем списке по алфавиту.
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  // ── Пагинация (просьба босса: «лидов уже пара сотен») ──
  // Показываем первые VISIBLE_PAGE_SIZE лидов всех вьюх (список/канбан/таблица);
  // кнопка «Показать ещё» дозагружает следующую страницу. Список-вью при этом
  // остаётся виртуализированным, а канбан/таблица перестают рендерить сотни
  // карточек за раз. Сбрасывается при смене любого фильтра/поиска.
  const [visibleCount, setVisibleCount] = useState(LEADS_PAGE_SIZE);
  const [segment, setSegment] = useState<Segment>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [hidePlaceholders, setHidePlaceholders] = useState(false); // Show all leads by default — hiding placeholders was hiding everything when identityState wasn't set

  // Dismiss-lead confirmation dialog state. The ⋮ button on a LeadCard opens
  // a dropdown menu (see LeadCard.tsx); clicking "Закрыть лид" in that menu
  // opens THIS dialog so the operator must confirm (with reason + optional
  // note) before the lead is actually dismissed. Previously the ⋮ button
  // dismissed the lead immediately with no confirmation — destructive and
  // irreversible (the lead's stage becomes "dismissed" and the user is
  // flagged is_dismissed_lead=true).
  const [dismissTarget, setDismissTarget] = useState<LeadRow | null>(null);

  // Dismiss reasons — currently a static list, but the dialog accepts any
  // DismissReason[]. In the future these could come from crew settings.
  const DISMISS_REASONS: DismissReason[] = [
    { value: "duplicate", label: "Дубликат", requiresNote: false },
    { value: "spam", label: "Спам", requiresNote: false },
    { value: "client_refused", label: "Клиент отказался", requiresNote: false },
    { value: "wrong_phone", label: "Неверный телефон", requiresNote: false },
    { value: "other", label: "Другая причина", requiresNote: true },
  ];

  const router = useRouter();
  const { dbUser } = useAppContext();
  const T = useTheme({ isAuto, isLightTheme, textColor, bgColor, accentColor });

  // Writable leads state — starts empty (page.tsx passes []), fetched client-side after auth
  const [leadsState, setLeadsState] = useState(leads);
  const [todosState, setTodosState] = useState(todos);
  // Ростер операторов экипажа (owner + активные члены) с сервера — питает
  // дропдаун «Ответственный»: фильтровать «только его лиды» можно для ЛЮБОГО
  // оператора, даже если на его имя пока не записан ни один лид.
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([]);
  /** m4 fix: notify is a server-side Telegram send — dedupe double taps. */
  const [notifyBusy, setNotifyBusy] = useState(false);
  // Ref mirror of notifyBusy — the state value is captured in handleSheetAction's
  // closure, so two rapid taps before a re-render both saw `false`. The ref is
  // checked + flipped synchronously → the guard is airtight.
  const notifyBusyRef = useRef(false);
  // iter35: double-submit locks for the lead sheet «Добавить» buttons
  // (notes / todos) — see handleAddNote / handleCreateTodo below. State
  // mirrors drive the disabled+label UI; refs make the guard airtight.
  const addNoteBusyRef = useRef(false);
  const createTodoBusyRef = useRef(false);
  const [notesBusy, setNotesBusy] = useState(false);
  const [todosBusy, setTodosBusy] = useState(false);
  const leadsFetchedRef = useRef(false);

  // ── Lead detail sheet state (2026-09-01 sheet overhaul) ──
  // Notes are fetched lazily for the SELECTED lead (they live in a separate
  // table and would bloat the initial leads payload if fetched for everyone).
  const [notesState, setNotesState] = useState<LeadDrawerNote[]>([]);
  const [notesLeadId, setNotesLeadId] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  // «Прочитать заметки»: { leadId, ts } последнего клика по флажку заметок.
  // Шторка открывает и прокручивает к секции заметок при смене ts —
  // повторный клик по флажку повторяет прокрутку даже для открытого лида.
  const [notesFocus, setNotesFocus] = useState<{ leadId: string; ts: number } | null>(null);
  // CORNER-CASE FIX (codereview): «сейчас» обновляется раз в минуту — иначе
  // перезвон, чьё время наступило при открытой странице, навсегда оставался
  // янтарным («не просрочен») и не получал приоритетный буст до смены данных.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  // Lightweight toast for action feedback (copy/notify/todo errors etc.) —
  // z-[70]: above the sheet (z-[60]) and the header (z-50). Typed
  // (info/success/error) — icon + accent tell the outcome without reading.
  // ToastState.id re-triggers the animation when the SAME text re-shows.
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, kind: ToastKind = "info", ms = 2600) => {
    setToast({ id: Date.now() + Math.random(), msg, kind });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }, []);
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  // ── Mobile: analytics panels collapsed by default ──
  // On a phone the three analytics blocks (speed/funnel/achievements) push
  // the actual LEADS below the fold (~1.5 screens of scroll). A compact
  // toggle keeps them one tap away while the lead views get the screen.
  // Desktop (sm+) ignores this state — panels are always visible there.
  // The choice persists per crew in localStorage.
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const analyticsKey = `leads-analytics-open:${slug}`;
  useEffect(() => {
    try {
      setAnalyticsOpen(window.localStorage.getItem(analyticsKey) === "1");
    } catch { /* private mode */ }
  }, [analyticsKey]);
  const toggleAnalytics = useCallback(() => {
    setAnalyticsOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(analyticsKey, next ? "1" : "0");
      } catch { /* private mode */ }
      return next;
    });
  }, [analyticsKey]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Password gate
  // NOTE: was a frozen useMemo([]) — if the Telegram SDK hadn't loaded at first
  // render (desktop web Telegram loads the iframe + SDK lazily), isInTelegram
  // stuck at false forever and the password gate could flash / mis-gate.
  // Now re-checked a few times while the SDK boots.
  const [tgReadyTick, setTgReadyTick] = useState(0);
  useEffect(() => {
    const timers = [600, 1500, 3000].map((ms) => setTimeout(() => setTgReadyTick((t) => t + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  const isInTelegram = useMemo(() => {
    void tgReadyTick; // re-evaluate when the SDK has had time to boot
    if (typeof window === "undefined") return false;
    const tg = (window as any).Telegram?.WebApp;
    return !!(tg?.initData && tg.initData.length > 0);
  }, [tgReadyTick]);

  const {
    showPasswordEntry,
    passwordInput,
    setPasswordInput,
    passwordError,
    setPasswordError,
    isPasswordValidating,
    passwordAuthed,
    storedPassword,
    handlePasswordSubmit,
    passwordAuthOwnerId,
  } = usePasswordGate(slug, isInTelegram, dbUser?.user_id);

  // Auth check: user is authed via Telegram WebApp OR password
  const isAuthed = !!(dbUser?.user_id || passwordAuthed);
  const shouldShowPassword = !isInTelegram && !dbUser?.user_id && !passwordAuthed;

  // Fetch leads client-side after auth passes (page.tsx passes empty arrays for security)
  //
  // ROBUSTNESS FIX (iter8, "leads sometimes don't load in desktop web Telegram"):
  //  • the old code fired ONCE — a single transient failure (cold-start timeout,
  //    cookie not yet re-set after session resume, network hiccup) left the page
  //    permanently empty until a manual full reload. Mobile worked because the
  //    native WebView keeps the app warm and first-party cookies flowing.
  //  • now: up to 3 attempts with growing backoff + the Telegram-signed initData
  //    is forwarded as an auth fallback for browsers that block third-party
  //    cookies (the actor cookie never reaches the server inside the
  //    web.telegram.org iframe).
  //  • a dismissible error banner with a manual retry button appears when all
  //    automatic attempts fail — no more silent empty page.
  const [leadsLoadError, setLeadsLoadError] = useState<string | null>(null);
  const [isFetchingLeads, setIsFetchingLeads] = useState(false);
  const [manualRetryTick, setManualRetryTick] = useState(0);
  const fetchLeads = useCallback(async (isCancelled: () => boolean): Promise<boolean> => {
    const initData = (() => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        return typeof tg?.initData === "string" && tg.initData.length > 0 ? tg.initData : undefined;
      } catch {
        return undefined;
      }
    })();
    const maxAttempts = 3;
    let lastError = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // STATIC import — safe now because leads.ts has NO module-level server-only imports.
        // Dynamic import() of server actions breaks Next.js server action registration
        // ("Failed to find Server Action" error). The fix was to move cookies +
        // telegram-actor-cookie + privateSchema to dynamic imports INSIDE the functions
        // in leads.ts, so the module-level imports are clean for the client RPC stub.
        const result = await getFranchizeLeads(
          slug,
          dbUser?.user_id || passwordAuthOwnerId || "",
          false, // isPasswordAuth=false — server tries cookie auth first
          initData,
          // 2026-09-01: forward the analytics password so browser password-auth
          // users can actually load leads (server verifies it via RPC).
          storedPassword || undefined,
        );
        if (isCancelled()) return false;
        if (result.success) {
          setLeadsState((result.leads || []).filter(Boolean) as LeadRow[]);
          setTodosState((result.todos || []).filter(Boolean) as LeadTodoRow[]);
          if (result.operators) setOperators(result.operators);
          setLeadsLoadError(null);
          return true;
        }
        lastError = result.error || "неизвестная ошибка";
        console.error(`[LeadsClient] getFranchizeLeads failed (attempt ${attempt}/${maxAttempts}):`, lastError);
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        if (isCancelled()) return false;
        console.error(`[LeadsClient] getFranchizeLeads error (attempt ${attempt}/${maxAttempts}):`, e);
      }
      if (attempt < maxAttempts) {
        // growing backoff: 1.5s → 4s (covers cookie-set races and cold starts)
        await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 1500 : 4000));
        if (isCancelled()) return false;
      }
    }
    setLeadsLoadError(lastError);
    return false;
  }, [slug, dbUser?.user_id, passwordAuthOwnerId, storedPassword]);

  useEffect(() => {
    if (!isAuthed || shouldShowPassword) return;
    if (leadsFetchedRef.current) return;

    let cancelled = false;
    setIsFetchingLeads(true);
    (async () => {
      const ok = await fetchLeads(() => cancelled);
      if (!cancelled && ok) leadsFetchedRef.current = true;
      if (!cancelled) setIsFetchingLeads(false);
    })();
    return () => { cancelled = true; };
  }, [isAuthed, shouldShowPassword, slug, dbUser?.user_id, storedPassword, passwordAuthed, manualRetryTick, fetchLeads]);

  // Todo mapping — use writable state so TodoList callbacks sync the parent array
  const { getTodosForLead } = useTodosMapping(todosState);

  // Priority Score (ТЗ): карта индексов 0–100 для всех лидов — ею пользуются
  // сортировка «priority» и лайбочки (⚡ свежий / 🔥 счёт) во всех видах.
  // nowTick раз в минуту перевычисляет индексы — просроченные перезвоны
  // вовремя получают +30 и поднимаются в очереди без перезагрузки страницы.
  const priorityMap = usePriorityMap(leadsState, getTodosForLead, nowTick);

  // Default filter flags — LeadsToolbar expects these props but root LeadsClient
  // doesn't use useLeadFilters (it uses useFilteredSortedLeads instead).
  // Pass all-false defaults so the toolbar renders without crashing.
  const defaultFilterFlags: FilterFlags = {
    overdueOnly: false,
    unclaimedQrOnly: false,
    documentsMissingOnly: false,
    activeRentalOnly: false,
    returnDueOnly: false,
    dismissedOnly: false,
    hideOperatorPlaceholders: false,
  };

  /** Called by TodoList after toggle/add/delete — keeps todosState in sync */
  const handleTodoUpdate = useCallback((action: 'toggle' | 'delete' | 'add', todoId: string, todo?: LeadTodoRow) => {
    setTodosState((prev) => {
      if (action === 'toggle') {
        return prev.map((t) =>
          t.id === todoId ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t
        );
      }
      if (action === 'delete') return prev.filter((t) => t.id !== todoId);
      if (action === 'add' && todo) return [todo, ...prev];
      return prev;
    });
  }, []);

  // Filtered, sorted, categorized leads (source + segment + search + sort)
  const {
    sortedLeads: baseSortedLeads,
    hot,
    verified,
    warm,
    availableSources,
    hasFilters: baseHasFilters,
    boardColumns,
  } = useFilteredSortedLeads(leadsState, debouncedSearchQuery, filterSource, segment, getTodosForLead, sortMode, hidePlaceholders, priorityMap);

  // ── Stage + Owner filters (applied AFTER useFilteredSortedLeads) ──
  // These are new filters that the v2-style toolbar exposes. They narrow
  // the already-sorted leads list without re-running the full pipeline.
  // FIX: stage filter now matches the COMPUTED pipeline stage (stageKey, set
  // server-side by computeLeadStage) — it used to compare against the raw DB
  // stage, so most options matched nothing and the filter looked broken.
  // "avito" — виртуальное значение: все лиды канала Авито независимо от стадии.
  // ── OWNER FILTER (по id, а не по имени) ──
  // Значение фильтра — telegram id оператора из серверного ростера. Лид
  // матчится, если оператор — его assignee (туду), создатель (/doc) или
  // автор последней заметки (lastTouchedBy — сравниваем и по имени тоже,
  // т.к. сервер возвращает уже резолвленное имя). Это позволяет отфильтровать
  // «только лиды, которые вёл конкретный оператор» — даже если он ещё ни
  // одного лида не создал (опция теперь есть у ВСЕГО ростера экипажа).
  const operatorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of operators) map.set(o.id, o.name);
    return map;
  }, [operators]);

  const sortedLeads = useMemo(() => {
    let result = baseSortedLeads;
    if (filterStage === "avito") {
      result = result.filter(isAvitoLead);
    } else if (filterStage !== "all") {
      result = result.filter((l) => (l.stageKey || "new") === filterStage);
    }
    if (filterOwner !== "all") {
      const ownerName = operatorNameById.get(filterOwner) || filterOwner;
      result = result.filter((l) =>
        l.assigneeId === filterOwner ||
        l.ownerId === filterOwner ||
        l.originalOperatorChatId === filterOwner ||
        // lastTouchedBy приходит строкой-именем; сравниваем по ней, если
        // сервер вернул имя этого оператора.
        (ownerName && l.lastTouchedBy === ownerName) ||
        // легаси-фоллбек: старый фильтр хранил ИМЯ в filterOwner
        (l.assigneeName || l.ownerName || "—") === filterOwner,
      );
    }
    return result;
  }, [baseSortedLeads, filterStage, filterOwner, operatorNameById]);

  // ── Пагинация: окно видимых лидов + сброс при смене фильтров ──
  const visibleLeads = useMemo(
    () => sortedLeads.slice(0, visibleCount),
    [sortedLeads, visibleCount],
  );
  useEffect(() => {
    setVisibleCount(LEADS_PAGE_SIZE);
  }, [debouncedSearchQuery, filterSource, filterStage, filterOwner, segment, hidePlaceholders]);
  const hiddenCount = sortedLeads.length - visibleLeads.length;

  // ── Ответственный: серверный ростер экипажа + те, кто встречается на лидах ──
  // Раньше список строился ТОЛЬКО из имён на лидах — новый оператор без лидов
  // в выпадашку не попадал. Теперь сервер возвращает всех (owner + члены),
  // а лиды-имена добавляем на случай легаси-значений без id.
  const availableOwners = useMemo(() => {
    const opts = operators.map((o) => ({ value: o.id, label: o.name }));
    const seenIds = new Set(opts.map((o) => o.value));
    const seenNames = new Set(opts.map((o) => o.label));
    for (const l of leadsState) {
      const name = l.assigneeName || l.ownerName;
      if (name && !seenNames.has(name) && !(l.assigneeId && seenIds.has(l.assigneeId))) {
        opts.push({ value: name, label: name });
        seenNames.add(name);
      }
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [operators, leadsState]);

  const hasFilters = baseHasFilters || filterStage !== "all" || filterOwner !== "all";

  // Filter out operator placeholders from segment counts for cleaner metrics
  const activeLeads = useMemo(() => 
    hidePlaceholders 
      ? leadsState.filter((l) => l.identityState !== 'operator_placeholder')
      : leadsState,
    [leadsState, hidePlaceholders]
  );

  // ── KPI-воронка + скорость (протокол встречи + просьба босса) ──
  // Воронка Лиды → Диалог → КЭВ → Сделки, активность дня, «горячие ждут»,
  // юнит-экономика лайт + встроенные скоростные метрики (lead-speed.ts) —
  // всё за ОДИН проход по данным. Считается по activeLeads (заглушки
  // операторов не портят метрики), перевычисляется с nowTick раз в минуту.
  const kpiMetrics = useMemo(
    () => computeLeadKpi(activeLeads, todosState, nowTick),
    [activeLeads, todosState, nowTick],
  );
  // Достижения — геймификация тех же цифр (бронза/серебро/золото/легенда).
  const achievements = useMemo(
    () => computeLeadAchievements(kpiMetrics),
    [kpiMetrics],
  );

  // Segment counts for toolbar tabs
  const segmentCounts = useMemo(() => ({
    all: activeLeads.length,
    hot: hot.length,
    warm: warm.length,
    verified: verified.length,
    troubled: activeLeads.filter((l) => l.troubled).length,
  }), [activeLeads, hot, warm, verified]);

  // Scroll to selected lead
  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-lead-id="${selectedId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedId]);

  // Dismiss lead — opens the DismissLeadDialog confirmation modal first.
  // The actual DELETE call happens in `confirmDismissLead` after the operator
  // picks a reason + optional note. This prevents accidental dismissals from
  // the (misleadingly-iconed) ⋮ dropdown button.
  const handleDismissLead = async (leadId: string) => {
    const target = leadsState.find((l) => l.user_id === leadId) || null;
    if (!target) return;
    setDismissTarget(target);
  };

  // Confirm + execute the dismissal — called by DismissLeadDialog onSubmit.
  const [dismissBusy, setDismissBusy] = useState(false);
  const confirmDismissLead = async (reason: string, note: string) => {
    const leadId = dismissTarget?.user_id;
    if (!leadId || dismissBusy) return; // m4 fix: no double-fire on the DELETE
    setDismissBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (dbUser?.user_id) {
        headers["x-telegram-user-id"] = dbUser.user_id;
      } else if (storedPassword) {
        headers["x-auth-password"] = storedPassword;
      }
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          leadId,
          dismissLead: true,
          slug,
          crewId,
          // Pass reason + note through so the server-side handler can record
          // them in the franchize_intents.metadata for audit trail.
          dismissReason: reason,
          dismissNote: note,
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null);
        const msg = errBody?.error || `HTTP ${resp.status}`;
        // Was window.alert() — jarring, blocks the UI thread and looks alien
        // inside the Telegram WebView. Same message, typed error toast.
        showToast(`Не удалось убрать лид: ${msg}`, "error", 4200);
        return;
      }
      // Optimistic remove from local state, then re-sync with server
      setLeadsState((prev) => prev.filter((l) => l.user_id !== leadId));
      setSelectedId((prev) => prev === leadId ? null : prev);
      // Close the dialog
      setDismissTarget(null);
      router.refresh();
    } catch (e) {
      showToast("Ошибка сети — лид не убран", "error");
    } finally {
      setDismissBusy(false);
    }
  };

  // ── Fetch notes for the selected lead (lazy, per-lead) ──
  useEffect(() => {
    if (!selectedId || !isAuthed) {
      setNotesState([]);
      setNotesLeadId(null);
      return;
    }
    if (notesLeadId === selectedId) return;
    let cancelled = false;
    setNotesLoading(true);
    setNotesState([]);
    (async () => {
      try {
        const res = await getLeadNotes(
          selectedId,
          crewId,
          dbUser?.user_id || passwordAuthOwnerId || undefined,
          passwordAuthed,
        );
        if (!cancelled && res.success && res.data) {
          setNotesState(res.data.map((n) => ({
            id: n.id, text: n.text, created_at: n.created_at, created_by: n.created_by,
          })));
          // m6 fix: only mark the lead as "notes loaded" on success — a failed
          // fetch used to be cached as an empty result with no retry path.
          setNotesLeadId(selectedId);
        }
        // Notes are optional enrichment — silent on failure.
      } catch { /* silent */ }
      finally {
        if (!cancelled) {
          setNotesLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, isAuthed, crewId, passwordAuthOwnerId, passwordAuthed]);

  // «Прочитать заметки» — открыть шторку лида и прокрутить к секции заметок.
  const handleReadNotes = useCallback((leadId: string) => {
    setSelectedId(leadId);
    setNotesFocus({ leadId, ts: Date.now() });
  }, []);

  // ── Sheet action handler (call / telegram / notify / resend_qr) ──
  const handleSheetAction = useCallback(async (action: string) => {
    const lead = selectedId ? leadsState.find((l) => l.user_id === selectedId) : null;
    if (!lead) return;
    switch (action) {
      case "call": {
        if (lead.phone) {
          window.location.href = `tel:${lead.phone.replace(/[^+\d]/g, "")}`;
        } else {
          showToast("У лида нет телефона");
        }
        break;
      }
      case "telegram": {
        if (lead.username) {
          window.open(`https://t.me/${lead.username}`, "_blank", "noopener");
        } else if (lead.telegramChatId) {
          try {
            await navigator.clipboard.writeText(lead.telegramChatId);
            showToast(`TG ID ${lead.telegramChatId} скопирован`, "success");
          } catch {
            showToast(`TG ID: ${lead.telegramChatId}`);
          }
        } else {
          showToast("У лида нет Telegram");
        }
        break;
      }
      case "notify": {
        if (!lead.telegramChatId) {
          showToast("У лида нет Telegram — уведомить нельзя");
          break;
        }
        // m4 fix (hardened): check the REF, not just the state — the callback
        // closure captures a stale notifyBusy=false until React re-renders, so
        // two fast taps could both slip past the state guard and send duplicate
        // Telegram messages.
        if (notifyBusy || notifyBusyRef.current) break;
        notifyBusyRef.current = true;
        setNotifyBusy(true);
        showToast("Отправляем уведомление…", "info", 1200);
        try {
          const res = await notifyLeadViaTelegram({
            slug,
            chatId: lead.telegramChatId,
            bikeTitle: lead.bikeTitle ?? undefined,
            initData: getTelegramInitData(),
          });
          if (res.success) {
            showToast("Уведомление отправлено", "success");
          } else {
            showToast(res.error || "Ошибка отправки", "error", 4200);
          }
        } catch {
          showToast("Ошибка отправки — нет связи", "error");
        } finally {
          notifyBusyRef.current = false;
          setNotifyBusy(false);
        }
        break;
      }
      case "resend_qr": {
        const rentalId = lead.rentals?.[0]?.rentalId;
        if (rentalId) {
          router.push(`/franchize/${slug}/rental/${encodeURIComponent(rentalId)}`);
        } else {
          showToast("QR доступен на странице аренды");
        }
        break;
      }
      default:
        break;
    }
  }, [selectedId, leadsState, showToast, slug, router]);

  // ── Sheet todo handlers (REST API — same route the dismiss flow uses) ──
  const authHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (dbUser?.user_id) h["x-telegram-user-id"] = dbUser.user_id;
    else if (storedPassword) h["x-auth-password"] = storedPassword;
    return h;
  }, [dbUser?.user_id, storedPassword]);

  const handleCreateTodo = useCallback(async (title: string) => {
    const lead = selectedId ? leadsState.find((l) => l.user_id === selectedId) : null;
    if (!lead || !title.trim()) return;
    // iter35: double-submit guard — «Добавить» (and Enter) used to fire the
    // POST repeatedly while the first request was still in flight →
    // duplicate crew_todos rows.
    if (createTodoBusyRef.current) return;
    createTodoBusyRef.current = true;
    setTodosBusy(true);
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ crewId, slug, leadId: lead.user_id, leadName: lead.full_name || "", title: title.trim() }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.success) {
        showToast(body?.error || `Не удалось создать задачу (HTTP ${resp.status})`, "error", 4200);
        return;
      }
      // Optimistic local append (the API returns the full todo row).
      const todo = body.todo as LeadTodoRow;
      setTodosState((prev) => [todo, ...prev]);
    } catch {
      showToast("Ошибка сети при создании задачи", "error");
    } finally {
      createTodoBusyRef.current = false;
      setTodosBusy(false);
    }
  }, [selectedId, leadsState, crewId, slug, authHeaders, showToast]);

  // ── Sheet document checklist buttons (M2 fix: were dead — no handler).
  // Declared AFTER handleCreateTodo (it calls it). ──
  const handleDocumentAction = useCallback(async (docKey: string, action: "open" | "request") => {
    const lead = selectedId ? leadsState.find((l) => l.user_id === selectedId) : null;
    const rental = lead?.rentals?.[0];
    if (!rental) {
      showToast("У лида пока нет аренды");
      return;
    }
    if (action === "open") {
      // The rental page is where the doc photos are viewable.
      router.push(`/franchize/${slug}/rental/${encodeURIComponent(rental.rentalId)}`);
      return;
    }
    const docName = docKey === "licence_front" ? "ВУ" : docKey === "passport_registration" ? "паспорт (прописка)" : "паспорт";
    await handleCreateTodo(`Запросить фото: ${docName}`);
  }, [selectedId, leadsState, router, slug, handleCreateTodo, showToast]);

  const handleToggleTodo = useCallback(async (todoId: string) => {
    const current = todosState.find((t) => t.id === todoId);
    if (!current) return;
    const nextStatus = current.status === "done" ? "pending" : "done";
    // Optimistic flip first, revert on failure.
    setTodosState((prev) => prev.map((t) => (t.id === todoId ? { ...t, status: nextStatus } : t)));
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ todoId, status: nextStatus, crewId }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.success) {
        setTodosState((prev) => prev.map((t) => (t.id === todoId ? { ...t, status: current.status } : t)));
        showToast(body?.error || "Не удалось обновить задачу", "error");
      }
    } catch {
      setTodosState((prev) => prev.map((t) => (t.id === todoId ? { ...t, status: current.status } : t)));
      showToast("Ошибка сети при обновлении задачи", "error");
    }
  }, [todosState, crewId, authHeaders, showToast]);

  const handleDeleteTodo = useCallback(async (todoId: string) => {
    // Optimistic remove, revert on failure.
    const snapshot = todosState;
    setTodosState((prev) => prev.filter((t) => t.id !== todoId));
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({ todoId, crewId }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.success) {
        setTodosState(snapshot);
        showToast(body?.error || "Не удалось удалить задачу", "error");
      }
    } catch {
      setTodosState(snapshot);
      showToast("Ошибка сети при удалении задачи", "error");
    }
  }, [todosState, crewId, authHeaders, showToast]);

  // ── Lead handling: «Отработан» + «Перезвонить в ...» (REST API route) ──
  // Все состояния пишутся в crew_todos (category="lead_handling") через
  // /api/franchize/lead-handling; после успешного ответа заменяем локальные
  // handling-строки этого лида на серверные (touched) — плашки и индекс
  // приоритета пересчитаются сами, без полного re-fetch.
  const [handlingBusy, setHandlingBusy] = useState(false);
  const applyHandlingAction = useCallback(async (
    action: "handled" | "unhandled" | "set_callback" | "clear_callback" | "complete_callback",
    extra: Record<string, unknown> = {},
  ) => {
    const lead = selectedId ? leadsState.find((l) => l.user_id === selectedId) : null;
    if (!lead || handlingBusy) return;
    setHandlingBusy(true);
    try {
      const resp = await fetch("/api/franchize/lead-handling", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          crewId,
          leadId: lead.user_id,
          leadName: lead.full_name || "",
          action,
          ...extra,
        }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.success) {
        showToast(body?.error || `Не удалось сохранить (HTTP ${resp.status})`, "error", 4200);
        return;
      }
      const touched = ((body.touched || []) as LeadTodoRow[]).filter(Boolean);
      // Идентификация локальных handling-строк ЭТОГО лида: ключ лида может
      // лежать в lead_id, user_id или phone (зависит от формы ключа).
      const leadKeys = new Set(
        [lead.user_id, lead.phone].filter(Boolean) as string[]
      );
      const isHandlingRowForLead = (t: LeadTodoRow) => {
        if (!isHandlingTodo(t)) return false;
        if (t.lead_id) return leadKeys.has(t.lead_id);
        if (t.user_id) return leadKeys.has(t.user_id);
        if (t.phone) return leadKeys.has(t.phone);
        return false; // строка без ключа — не трогаем
      };
      setTodosState((prev) => [
        ...touched,
        ...prev.filter((t) => !isHandlingRowForLead(t)),
      ]);
    } catch {
      showToast("Ошибка сети при сохранении отметки", "error");
    } finally {
      setHandlingBusy(false);
    }
  }, [selectedId, leadsState, crewId, authHeaders, showToast, handlingBusy]);

  // ── Sheet notes handler (server action, cookie-auth) ──
  const handleAddNote = useCallback(async (text: string) => {
    const lead = selectedId ? leadsState.find((l) => l.user_id === selectedId) : null;
    if (!lead || !text.trim()) return;
    // iter35: double-submit guard — «Добавить» (and Enter) used to create
    // duplicate notes while the first createLeadNote call was in flight.
    if (addNoteBusyRef.current) return;
    addNoteBusyRef.current = true;
    setNotesBusy(true);
    try {
      const res = await createLeadNote({
        leadId: lead.user_id,
        crewId,
        text: text.trim(),
        // m5 fix: store the author so the sheet shows a real name instead of
        // «Аноним» for every entry.
        createdBy: dbUser?.user_id || passwordAuthOwnerId || undefined,
        actorUserId: dbUser?.user_id || undefined,
        isPasswordAuth: passwordAuthed,
      });
      if (res.success && res.data) {
        const note: LeadDrawerNote = {
          id: res.data.id, text: res.data.text, created_at: res.data.created_at, created_by: res.data.created_by,
        };
        setNotesState((prev) => [note, ...prev]);
        // Синхронизируем счётчик заметок в списке (флажок «Прочитать заметки»)
        // без re-fetch: +1 и «новая» (lastNoteAt=сейчас) — заметка только что
        // оставлена, плашка на карточке должна появиться сразу. Заодно ставим
        // «последнего оператора» (lastTouchedBy): имя текущего пользователя —
        // сервер уже резолвит его в ответе, а локально беру из dbUser
        // (password-режим без dbUser оставляет прежнее значение).
        const actorName = res.data.created_by || dbUser?.full_name || dbUser?.username || null;
        setLeadsState((prev) =>
          prev.map((l) =>
            l.user_id === lead.user_id
              ? {
                  ...l,
                  notesCount: (l.notesCount ?? 0) + 1,
                  lastNoteAt: res.data?.created_at || new Date().toISOString(),
                  lastTouchedBy: actorName || l.lastTouchedBy,
                }
              : l,
          ),
        );
      } else {
        showToast(res.error || "Не удалось сохранить заметку", "error", 4200);
      }
    } catch {
      showToast("Ошибка сети при сохранении заметки", "error");
    } finally {
      addNoteBusyRef.current = false;
      setNotesBusy(false);
    }
  }, [selectedId, leadsState, crewId, dbUser?.user_id, dbUser?.full_name, dbUser?.username, passwordAuthOwnerId, passwordAuthed, showToast]);

  // Password gate render — only show if NOT in Telegram AND no dbUser AND not password-authed
  if (shouldShowPassword && !passwordAuthed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border p-6" style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: T.shadow }}>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: T.borderSoft }}>
              <Lock className="h-6 w-6" style={{ color: T.accent }} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: T.text }}>Клиенты и заявки</h2>
            <p className="mt-1 text-sm" style={{ color: T.textMuted }}>Введите пароль для доступа</p>
          </div>
          <input type="password" value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
            placeholder="••••••••" disabled={isPasswordValidating}
            className="w-full rounded-xl border px-4 py-3 text-center tracking-widest outline-none transition focus:ring-2"
            style={{
              borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text,
              // @ts-ignore
              "--tw-ring-color": T.borderActive,
            }} autoFocus />
          {passwordError && (
            <p className="flex items-center justify-center gap-1.5 text-center text-sm text-red-400">
              <Lock className="h-4 w-4" /> {passwordError}
            </p>
          )}
          <button onClick={handlePasswordSubmit} disabled={isPasswordValidating || !passwordInput.trim()}
            className="w-full rounded-xl py-3 font-bold transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: T.accent, color: T.accentContrast }}>
            {isPasswordValidating ? "Проверка..." : "Войти"}
          </button>
          <p className="text-center text-xs" style={{ color: T.textFaint }}>Пароль можно получить через бота: /analytics_pass</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <LeadsKPICards leads={activeLeads} hot={hot} verified={verified} todos={todosState.filter((t) => !isHandlingTodo(t))} T={T} />

      {/* MOBILE: аналитика (скорость/воронка/достижения) — за компактным
          переключателем. На телефоне три панели занимали ~1.5 экрана и
          уводили сами ЛИДЫ под сгиб; свёрнуто по умолчанию, выбор помнится.
          На sm+ переключатель скрыт — панели всегда на месте. */}
      <button
        type="button"
        onClick={toggleAnalytics}
        aria-expanded={analyticsOpen}
        aria-controls="leads-analytics"
        className="flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-bold transition active:scale-[0.99] sm:hidden"
        style={{ borderColor: T.border, backgroundColor: T.bgCard, color: T.text }}
      >
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: T.accent }} aria-hidden />
          Аналитика смены
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: T.textMuted }}>
          {analyticsOpen ? "скрыть" : "показать"}
          <ChevronDown className={`h-4 w-4 transition-transform ${analyticsOpen ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>

      <div id="leads-analytics" className={analyticsOpen ? "space-y-5" : "hidden sm:block sm:space-y-5"}>
        {/* Скорость обработки: медиана ответа, очередь «ждут», SLA-просрочки,
            распределение времени ответа и перезвоны — см. lib/lead-speed.ts.
            speed встроен в kpiMetrics (lib/lead-kpi.ts) — один проход по данным. */}
        <LeadSpeedPanel metrics={kpiMetrics.speed} T={T} />

        {/* Воронка KPI из протокола встречи: Активность → Диалог → КЭВ → Сделка,
            конверсии, норма дня, «горячие ждут», тест-драйвы, ср. чек. */}
        <LeadsFunnelPanel kpi={kpiMetrics} T={T} />

        {/* Достижения экипажа: геймификация метрик воронки/скорости.
            storageKey — sticky-стор «заработано навсегда» на экипаж (фикс
            повторных тостов при колебании метрик и перезагрузках). */}
        <LeadsAchievementsPanel achievements={achievements} storageKey={`leads-achv:${slug}`} T={T} />
      </div>

      {/* Load-error banner — silent empty pages were the #1 desktop-web-Telegram
          complaint. Shows the actual server error + manual retry. The loading
          variant only appears on a cold first load (no data yet). */}
      {(leadsLoadError || (isFetchingLeads && leadsState.length === 0)) && (
        <div
          className="mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor: leadsLoadError ? "rgba(245,158,11,0.5)" : "rgba(59,130,246,0.4)",
            backgroundColor: leadsLoadError ? "rgba(245,158,11,0.08)" : "rgba(59,130,246,0.06)",
          }}
        >
          <p className="text-xs leading-relaxed" style={{ color: T.text }}>
            {leadsLoadError ? (
              <>
                <span className="font-semibold">Не удалось загрузить лиды.</span>{" "}
                <span className="opacity-75">{leadsLoadError}</span>
              </>
            ) : (
              <span className="opacity-75">Загружаю лиды{isFetchingLeads ? " (повторная попытка…)" : "…"} — если веб-приложение только что открылось, это займёт пару секунд.</span>
            )}
          </p>
          {leadsLoadError && (
            <button
              type="button"
              onClick={() => {
                setLeadsLoadError(null);
                setManualRetryTick((t) => t + 1);
              }}
              className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
              style={{ borderColor: "rgba(245,158,11,0.5)", color: T.text }}
            >
              Повторить загрузку
            </button>
          )}
        </div>
      )}

      <LeadsToolbar
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        sortMode={sortMode} setSortMode={(v) => setSortMode(v as SortMode)}
        filterSource={filterSource} setFilterSource={setFilterSource}
        availableSources={availableSources}
        filterStage={filterStage} setFilterStage={setFilterStage}
        filterOwner={filterOwner} setFilterOwner={setFilterOwner}
        availableOwners={availableOwners}
        segment={segment} setSegment={setSegment}
        viewMode={viewMode} onViewModeChange={setViewMode}
        segmentCounts={segmentCounts}
        hidePlaceholders={hidePlaceholders} setHidePlaceholders={setHidePlaceholders}
        filterFlags={defaultFilterFlags}
        onFilterFlagsChange={() => {}}
        T={T} isAuto={isAuto}
      />

      {viewMode === "board" ? (
        <LeadBoard
          leads={visibleLeads}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onDismiss={handleDismissLead}
          getTodosForLead={getTodosForLead}
          priorityMap={priorityMap}
          onReadNotes={handleReadNotes}
          T={T}
        />
      ) : viewMode === "table" ? (
        // NEW (iter6): analytics-style table view — same interaction model as
        // the card list (click a row → detail panel on desktop / sheet on
        // mobile), but dense and scannable.
        sortedLeads.length === 0 ? (
          <EmptyState hasFilters={hasFilters} searchQuery={debouncedSearchQuery} T={T} />
        ) : (
          <LeadTableView
            leads={visibleLeads}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            getTodosForLead={getTodosForLead}
            priorityMap={priorityMap}
            onReadNotes={handleReadNotes}
            sortMode={sortMode}
            onSortChange={setSortMode}
            T={T}
          />
        )
      ) : sortedLeads.length === 0 ? (
        <EmptyState hasFilters={hasFilters} searchQuery={debouncedSearchQuery} T={T} />
      ) : (
        <LeadList
          leads={visibleLeads}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          onDismiss={handleDismissLead}
          getTodosForLead={getTodosForLead}
          priorityMap={priorityMap}
          onReadNotes={handleReadNotes}
          T={T}
          crewId={crewId}
          slug={slug}
        />
      )}

      {/* ── Пагинация: «показано X из Y» + «Показать ещё» ──
          Все вьюхи получают только visibleLeads; скрытые лиды догружаются
          по LEADS_PAGE_SIZE за клик. У оператора всегда честный счётчик —
          сколько лидов совпало с фильтрами и сколько ещё не показано. */}
      {hiddenCount > 0 && (
        <div className="flex flex-col items-center gap-2 py-4">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + LEADS_PAGE_SIZE)}
            className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:brightness-110 active:scale-[0.99]"
            style={{ borderColor: T.border, backgroundColor: T.bgCard, color: T.text }}
          >
            Показать ещё {Math.min(LEADS_PAGE_SIZE, hiddenCount)}
          </button>
          <span className="text-[11px]" style={{ color: T.textFaint }}>
            Показано {visibleLeads.length} из {sortedLeads.length} лидов
          </span>
        </div>
      )}

      {/* Adaptive lead-detail sheet — bottom sheet on phones/narrow windows,
          right-side drawer on ≥lg. Replaces BOTH the old mobile-only sheet
          (whose inner drawer used to take over the whole screen) and the old
          inline desktop panel (whose close button hid under the CrewHeader). */}
      {selectedId && (() => {
        // FIX (codereview): resolve the selected lead from the FULL leadsState
        // (fallback: the filtered view). Previously the lookup used only
        // sortedLeads — the moment the operator touched a stage/source/owner
        // filter or segment chip while the sheet was open and the lead stopped
        // matching, the sheet abruptly unmounted and the operator lost their
        // place. Now the sheet stays open on filter changes.
        const selectedLead =
          leadsState.find((l) => l.user_id === selectedId) ||
          sortedLeads.find((l) => l.user_id === selectedId);
        if (!selectedLead) return null;
        return (
          <LeadDetailSheet
            open={true}
            onClose={() => setSelectedId(null)}
            title={selectedLead.full_name || selectedLead.phone || "Лид"}
            T={T}
          >
            <LeadDetailContent
              lead={selectedLead}
              todos={getTodosForLead(selectedLead)}
              notes={notesLeadId === selectedId ? notesState : []}
              slug={slug}
              T={T}
              onClose={() => setSelectedId(null)}
              onAction={handleSheetAction}
              onDocumentAction={handleDocumentAction}
              onCreateTodo={handleCreateTodo}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
              onAddNote={handleAddNote}
              onDismissLead={() => handleDismissLead(selectedLead.user_id)}
              onMarkHandled={(handled) => applyHandlingAction(handled ? "handled" : "unhandled")}
              onSetCallback={(iso, note) => applyHandlingAction("set_callback", { callbackAt: iso, note })}
              onCompleteCallback={() => applyHandlingAction("complete_callback")}
              onClearCallback={() => applyHandlingAction("clear_callback")}
              handlingBusy={handlingBusy}
              notifyBusy={notifyBusy}
              notesBusy={notesBusy}
              todosBusy={todosBusy}
              asSheetChild
              focusNotesSignal={notesFocus && notesFocus.leadId === selectedId ? notesFocus.ts : 0}
            />
          </LeadDetailSheet>
        );
      })()}

      {/* Typed toast — action feedback (copy/notify/todo/dismiss results).
          Icon + accent color by kind (info/success/error), slide-up + fade,
          tap to dismiss. z-[70] sits above the sheet (z-[60]) and the
          CrewHeader (z-50). Bottom offset keeps clear of the iOS home
          indicator (safe-area) and of the achievement toast (bottom-20). */}
      <AnimatePresence>
        {toast && (() => {
          const Meta = TOAST_META[toast.kind];
          const Icon = Meta.icon;
          return (
            <motion.button
              key={toast.id}
              type="button"
              onClick={dismissToast}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              role={toast.kind === "error" ? "alert" : "status"}
              aria-live={toast.kind === "error" ? "assertive" : "polite"}
              className="fixed inset-x-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[70] mx-auto flex w-fit max-w-[92vw] items-center gap-2.5 rounded-2xl border px-4 py-3 text-left text-sm font-medium shadow-lg sm:inset-x-0"
              style={{
                backgroundColor: T.bgCard,
                borderColor: `${Meta.color}55`,
                color: T.text,
                boxShadow: `0 8px 28px rgba(0,0,0,0.28), inset 3px 0 0 0 ${Meta.color}`,
              }}
            >
              <Icon className="h-5 w-5 shrink-0" style={{ color: Meta.color }} aria-hidden />
              <span className="min-w-0">{toast.msg}</span>
            </motion.button>
          );
        })()}
      </AnimatePresence>

      {/* Dismiss confirmation dialog — opened from LeadCard ⋮ menu "Закрыть лид".
          Shows reason dropdown + optional note + analytics-impact preview.
          z-[60] so it sits above MobileLeadSheet (also z-[60] but rendered later)
          and above CrewHeader (z-50). */}
      <DismissLeadDialog
        open={!!dismissTarget}
        lead={dismissTarget}
        reasons={DISMISS_REASONS}
        T={T}
        onSubmit={confirmDismissLead}
        onCancel={() => setDismissTarget(null)}
        submitting={dismissBusy}
      />
    </div>
  );
}