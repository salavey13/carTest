// /app/franchize/[slug]/leads/LeadsClient.tsx
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronDown, Info, Lock, Sparkles } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import type {LeadRow, LeadTodoRow} from "./leads-types";
import type { GetLeadsWindowOpts, LeadsAggregates, LeadsPageInfo } from "./leads-types";
import {
  LEAD_PATH_STEPS,
  applyLeadPathDrip,
  computeLeadPathProgress,
  DEFAULT_LEAD_PATH_STATE,
  guidesStorageKey,
  mergeLeadPathState,
  parseGuidesReadIds,
  type LeadPathState,
} from "./lib/lead-path";
import {
  applyLeadViewed,
  parseLeadViewHistory,
  serializeLeadViewHistory,
  viewedHistoryKey,
} from "./lib/lead-view-history";
import { msUntilNextMidnight } from "./lib/lead-playbook-done";
import { LeadsPathPanel } from "./components/LeadsPathPanel";
import { getFranchizeLeads } from "@/app/franchize/server-actions/leads";
import { DISMISS_REASONS } from "./lib/dismiss-reasons";
import { isHandlingTodo } from "./lib/lead-handling";
import { computeLeadAchievements } from "./lib/lead-achievements";

// Import extracted components
import { LeadsKPICards } from "./components/LeadsKPICards";
import { LeadSpeedPanel } from "./components/LeadSpeedPanel";
import { LeadsPlaybookPanel } from "./components/LeadsPlaybookPanel";
import { LeadsFunnelPanel } from "./components/LeadsFunnelPanel";
import { LeadsAchievementsPanel } from "./components/LeadsAchievementsPanel";
import { LeadsToolbar } from "./components/LeadsToolbar";
import { LeadsGuidedTour } from "./components/LeadsGuidedTour";
import { LeadList } from "./components/LeadList";
import { LeadBoard } from "./components/LeadBoard";
import { LeadTableView } from "./components/LeadTableView";
import { LeadDetailSheet } from "./components/LeadDetailSheet";
import type { LeadDrawerNote } from "./components/LeadDetailDrawer";
import { getLeadNotes, createLeadNote } from "@/app/franchize/server-actions/lead-notes";
import { notifyLeadViaTelegram } from "@/app/franchize/server-actions/lead-notify";
import { probeCrewAccess } from "@/app/franchize/lib/crew-access-client";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { EmptyState } from "./components/EmptyState";
import { LeadDetailContent } from "./components/LeadDetailContent";
import { DismissLeadDialog, type DismissReason } from "./components/DismissLeadDialog";

// Import constants
import {
  type Segment,
  type ViewMode,
  type SortMode,
} from "./leads-constants";
import { LEADS_PAGE_SIZE } from "./leads-constants";

// Import hooks
import { useTodosMapping, usePriorityMap } from "./hooks/useLeadsData";
import { useLeadsUserPrefs, type PrefsResolution } from "./hooks/useLeadsUserPrefs";
import { useTheme } from "./hooks/useTheme";
import { usePasswordGate } from "./hooks/usePasswordGate";
import type { LeadPriority } from "./lib/lead-priority";
import type { LeadEventRow, LeadLeaderboardEntry } from "./leads-types";
import { LeadsLeaderboardPanel } from "./components/LeadsLeaderboardPanel";

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

// ── Session-level stale-while-revalidate cache (perf, 2026-09-07) ────────────
// The leads payload is ~1MB of JSON (533 intents + 1000 todos + metadata) and
// every mount re-downloaded it — navigating leads → bikes → leads re-spun the
// loader for data we literally just had. Now: the LAST payload per slug is
// kept in-memory; a remount paints instantly from it and, when older than
// LEADS_CACHE_TTL_MS, revalidates in the background. Crew-scoped data (not
// user-private), so a per-slug key is safe inside one browser session.
type LeadsCacheEntry = {
  at: number;
  /** Ключ вида фильтров (q/source/stage/owner/segment/заглушки/сорт). */
  hash: string;
  leads: LeadRow[];
  todos: LeadTodoRow[];
  operators?: Array<{ id: string; name: string }>;
  leadEvents?: LeadEventRow[];
  leaderboard?: LeadLeaderboardEntry[];
  agg?: LeadsAggregates;
  pageInfo?: LeadsPageInfo;
};
/** Память: slug → (hash → entry), LRU-кап на вид. */
const leadsCache = new Map<string, Map<string, LeadsCacheEntry>>();
const LEADS_CACHE_TTL_MS = 30_000;
const LEADS_CACHE_MEM_CAP = 6;
const LEADS_CACHE_SS_KEY = (slug: string) => `leads-cache-v3:${slug}`;

function readMemoryCache(slug: string, hash: string): LeadsCacheEntry | undefined {
  return leadsCache.get(slug)?.get(hash);
}

function writeMemoryCache(slug: string, hash: string, entry: LeadsCacheEntry): void {
  let perSlug = leadsCache.get(slug);
  if (!perSlug) {
    perSlug = new Map();
    leadsCache.set(slug, perSlug);
  }
  perSlug.delete(hash);
  perSlug.set(hash, entry);
  while (perSlug.size > LEADS_CACHE_MEM_CAP) {
    const oldest = perSlug.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    perSlug.delete(oldest);
  }
}

/** sessionStorage: ПЕРЕЖИВАЕТ ПЕРЕЗАНГРУЗКУ страницы — «cache extensively».
 *  Хранится последняя вью; при чтении матчим hash фильтров. */
function readSessionCache(slug: string, hash: string): LeadsCacheEntry | null {
  try {
    const raw = window.sessionStorage.getItem(LEADS_CACHE_SS_KEY(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LeadsCacheEntry;
    if (!parsed || parsed.hash !== hash || !Array.isArray(parsed.leads)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(slug: string, entry: LeadsCacheEntry): void {
  try {
    const raw = JSON.stringify(entry);
    if (raw.length > 1_800_000) return; // не раздуваем квоту sessionStorage
    window.sessionStorage.setItem(LEADS_CACHE_SS_KEY(slug), raw);
  } catch {
    /* private mode / quota */
  }
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
  // ── Пагинация теперь СЕРВЕРНАЯ: окно LEADS_PAGE_SIZE «лучших» лидов +
  // «Показать ещё» (fetchWindow("more")). См. блок оконной загрузки выше. ──
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
  // Lead Game: журнал записанных событий + серверный лидерборд. Обе —
  // crew-scoped (все участники видят одно и то же), приходят с той же
  // загрузкой, что и лиды.
  const [leadEvents, setLeadEvents] = useState<LeadEventRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeadLeaderboardEntry[]>([]);
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

  // ── ОБЗОР-ТУР («новичок на смене»): связывает шаги плейбука с разделами UI.
  // revealTarget раскрывает мобильный свёрток аналитики (если цель — она),
  // отскролливает раздел в центр и вспыхивает рамкой на 2.2 c — страница
  // видна, пока тур свёрнут в пилюлю и объясняет. Подсветка — ring, без
  // layout-сдвига; состояние живёт тут, тур вызывает onReveal(id).
  const [tourFlashId, setTourFlashId] = useState<string | null>(null);
  const revealTarget = useCallback((id: string) => {
    if (id === "leads-analytics") setAnalyticsOpen(true);
    const wait = id === "leads-analytics" ? 150 : 50;
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTourFlashId(id);
      window.setTimeout(() => setTourFlashId((cur) => (cur === id ? null : cur)), 2200);
    }, wait);
  }, []);
  const flashCls = useCallback(
    (id: string) =>
      `relative rounded-2xl transition-all duration-500 ${tourFlashId === id ? "ring-2 ring-amber-400" : ""}`,
    [tourFlashId],
  );

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

  // ── CREW-гейт геймификации («достижения — только для своих») ──
  // Путь оператора (достижения, XP, чип звания в плейбуке) — инструмент
  // экипажа; обычному пользователю страницы он не показывается вовсе.
  // Тот же серверный чек, что гейтит crew-панели профиля
  // (getFranchizeOperatorDashboardAccess: admin/owner/active member по
  // серверной TG-сессии). Дефолт false — пока сервер не подтвердил, панелей
  // нет (без вспышки), и computeLeadAchievements для не-crew не вызывается.
  // Парольные зрители (без TG-идентичности) экипажем не считаются.
  // PROBE: тот же чек запрашивают AchievementToastSync (layout) и
  // AchievementExplorer — общий single-flight+TTL probe превращает 3
  // одинаковых server-action-запроса в 1 на страницу.
  const [isCrew, setIsCrew] = useState(false);
  useEffect(() => {
    if (!dbUser?.user_id || !slug) {
      setIsCrew(false);
      return;
    }
    let cancelled = false;
    void probeCrewAccess(slug)
      .then((res) => {
        if (!cancelled) setIsCrew(res.canOpen);
      })
      .catch(() => {
        if (!cancelled) setIsCrew(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dbUser?.user_id, slug]);

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
  // «Обновлено HH:MM» — тихий 90-секундный meta-рефреш невидим, штамп возвращает
  // оператору доверие: данные живые, хотя список не перерисовывается.
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  // Серверные агрегаты по ПОЛНОМУ набору + метаданные окна (total/hasMore).
  const [aggState, setAggState] = useState<LeadsAggregates | null>(null);
  const [pageInfo, setPageInfo] = useState<LeadsPageInfo | null>(null);

  // ── Оконная загрузка («load best leads quickly first») ─────────────────────
  // Сервер сам фильтрует/сортирует/режет окно (lib/leads-query-core): первый
  // ответ несёт только LEADS_PAGE_SIZE ЛУЧШИХ лидов + агрегаты по ПОЛНОМУ
  // набору (плитки/воронка/плейбук/достижения/лидерборд). «Показать ещё»
  // дозагружает следующее окно. Режимы:
  //   reset — окно с нуля (первая загрузка / смена фильтров / повтор);
  //   more  — дозагрузка к уже показанным (offset = leadsState.length);
  //   meta  — ТИХИЙ фон-рефреш: только агрегаты и счётчик total (окно и
  //           скролл оператора не трогаются).
  const fetchSeqRef = useRef(0);
  const leadsStateRef = useRef<LeadRow[]>([]);
  const todosStateRef = useRef<LeadTodoRow[]>([]);
  useEffect(() => {
    leadsStateRef.current = leadsState;
  }, [leadsState]);
  useEffect(() => {
    todosStateRef.current = todosState;
  }, [todosState]);

  // Зеркало фильтров для fetch-колбэка (обновляется эффектом ДО любых fetch).
  const filtersRef = useRef<GetLeadsWindowOpts>({});
  useEffect(() => {
    filtersRef.current = {
      q: debouncedSearchQuery.trim() || undefined,
      source: filterSource,
      stage: filterStage,
      owner: filterOwner,
      segment,
      hidePlaceholders,
      sort: sortMode,
    };
  }, [debouncedSearchQuery, filterSource, filterStage, filterOwner, segment, hidePlaceholders, sortMode]);

  const hashOfFilters = (o: GetLeadsWindowOpts): string =>
    JSON.stringify([
      o.q || "",
      o.source || "all",
      o.stage || "all",
      o.owner || "all",
      o.segment || "all",
      !!o.hidePlaceholders,
      o.sort || "priority",
    ]);

  const fetchWindow = useCallback(
    async (mode: "reset" | "more" | "meta", isCancelled: () => boolean): Promise<boolean> => {
      const initData = (() => {
        try {
          const tg = (window as any).Telegram?.WebApp;
          return typeof tg?.initData === "string" && tg.initData.length > 0 ? tg.initData : undefined;
        } catch {
          return undefined;
        }
      })();
      const base = filtersRef.current;
      const opts: GetLeadsWindowOpts =
        mode === "more"
          ? { ...base, offset: leadsStateRef.current.length, limit: LEADS_PAGE_SIZE }
          : { ...base, offset: 0, limit: LEADS_PAGE_SIZE, metaOnly: mode === "meta" };
      const hash = hashOfFilters(base);
      // reset инвалидирует все более старые ответы (смена фильтров/повтор);
      // more/meta применяются, только пока не начался новый reset.
      const seqAtStart = mode === "reset" ? ++fetchSeqRef.current : fetchSeqRef.current;
      const stillRelevant = () =>
        !isCancelled() &&
        fetchSeqRef.current === seqAtStart &&
        hashOfFilters(filtersRef.current) === hash;

      // STATIC import — безопасно: leads.ts без module-level server-only.
      const maxAttempts = mode === "reset" ? 3 : 1;
      let lastError = "";
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await getFranchizeLeads(
            slug,
            dbUser?.user_id || passwordAuthOwnerId || "",
            false, // isPasswordAuth=false — сервер сначала пробует cookie-auth
            initData,
            // 2026-09-01: форвардим analytics-пароль для password-auth браузеров.
            storedPassword || undefined,
            opts,
          );
          if (!stillRelevant()) return false;
          if (result.success) {
            const freshAgg = result.agg ?? undefined;
            const freshPage = result.page ?? undefined;
            const freshOperators = result.operators || undefined;
            const freshEvents = (result.leadEvents || []).filter(Boolean) as LeadEventRow[];
            const freshBoard = (result.leaderboard || []).filter(Boolean) as LeadLeaderboardEntry[];

            if (mode === "meta") {
              // Тихий рефреш: ТОЛЬКО агрегаты и счётчик total.
              if (freshAgg) setAggState(freshAgg);
              if (freshPage) setPageInfo(freshPage);
              setLastSyncAt(Date.now());
              return true;
            }

            const freshLeads = (result.leads || []).filter(Boolean) as LeadRow[];
            const freshTodos = (result.todos || []).filter(Boolean) as LeadTodoRow[];

            let accLeads = freshLeads;
            let accTodos = freshTodos;
            if (mode === "more") {
              // Дозагрузка: дописываем хвост, дедуп на случай гонки.
              const seenL = new Set(leadsStateRef.current.map((l) => l.user_id));
              accLeads = [...leadsStateRef.current, ...freshLeads.filter((l) => !seenL.has(l.user_id))];
              const seenT = new Set(
                todosStateRef.current.map((t) => t.id).filter(Boolean) as string[],
              );
              accTodos = [...todosStateRef.current, ...freshTodos.filter((t) => !t.id || !seenT.has(t.id))];
            }
            setLeadsState(accLeads);
            setTodosState(accTodos);
            if (freshAgg) setAggState(freshAgg);
            if (freshPage) setPageInfo(freshPage);
            if (freshOperators) setOperators(freshOperators);
            setLeadEvents(freshEvents);
            setLeaderboard(freshBoard);
            setLeadsLoadError(null);
            setLastSyncAt(Date.now()); // штамп «обновлено HH:MM» в футере списка

            // Кэш-сквозная запись: память (LRU) + sessionStorage (перезагрузка).
            const entry: LeadsCacheEntry = {
              at: Date.now(),
              hash,
              leads: accLeads,
              todos: accTodos,
              operators: freshOperators,
              leadEvents: freshEvents,
              leaderboard: freshBoard,
              agg: freshAgg,
              pageInfo: freshPage,
            };
            writeMemoryCache(slug, hash, entry);
            writeSessionCache(slug, entry);
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
          // growing backoff: 1.5s → 4s (cookie-set races, cold starts)
          await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 1500 : 4000));
          if (!stillRelevant()) return false;
        }
      }
      if (mode === "reset") setLeadsLoadError(lastError);
      else if (mode === "more") showToast(`Не удалось догрузить лиды: ${lastError}`, "error", 4200);
      return false;
    },
    [slug, dbUser?.user_id, passwordAuthOwnerId, storedPassword, showToast],
  );

  // ── Auth headers (rate/handling/prefs REST routes) ──
  const authHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (dbUser?.user_id) h["x-telegram-user-id"] = dbUser.user_id;
    else if (storedPassword) h["x-auth-password"] = storedPassword;
    return h;
  }, [dbUser?.user_id, storedPassword]);

  // ── Prefs: фильтры и «Путь оператора» в users.metadata (jsonb) ────────────
  // КЛИЕНТСКАЯ ПРОСЬБА: «save filters settings upon page reload». Хук читает
  // metadata.leads_ui/leads_path при авторизации (fallback — localStorage) и
  // владеет всей логикой записи: debounce 800 мс, флэш при уходе со страницы
  // (keepalive), ретрай сбоя, защита серверных настроек от дефолтов.
  const { prefsResolution, saveFilters, savePath, saveFlash } = useLeadsUserPrefs({
    slug,
    isAuthed,
    hasTelegramIdentity: !!dbUser?.user_id,
    authHeaders,
    retryTick: manualRetryTick,
  });
  const prefsRef = useRef({ saveFilters, savePath });
  useEffect(() => {
    prefsRef.current = { saveFilters, savePath };
  }, [saveFilters, savePath]);

  const [pathState, setPathState] = useState<LeadPathState>(DEFAULT_LEAD_PATH_STATE);
  const [prefsSettled, setPrefsSettled] = useState(false);
  const appliedPrefsRef = useRef<PrefsResolution | null>(null);
  const prefsSettledRef = useRef(false);
  // Применяем восстановленные настройки РОВНО ОДИН раз на каждую резолюцию —
  // ДО первого сетевого fetch (эффект загрузки гейтится prefsSettled).
  useEffect(() => {
    if (!prefsResolution || appliedPrefsRef.current === prefsResolution) return;
    appliedPrefsRef.current = prefsResolution;
    // CODE REVIEW FIX: если оператор успел потрогать фильтры до прихода
    // резолюции (медленная сеть, ручной повтор) — его живое состояние
    // важнее приехавшего снимка: фильтры не затираем.
    const touched =
      searchQuery !== "" ||
      debouncedSearchQuery !== "" ||
      filterSource !== "all" ||
      filterStage !== "all" ||
      filterOwner !== "all" ||
      segment !== "all" ||
      hidePlaceholders !== false ||
      sortMode !== "priority" ||
      viewMode !== "list";
    const p = touched ? null : prefsResolution.prefs;
    if (p) {
      if (typeof p.q === "string") {
        setSearchQuery(p.q);
        setDebouncedSearchQuery(p.q);
      }
      if (p.source) setFilterSource(p.source);
      if (p.stage) setFilterStage(p.stage);
      if (p.owner) setFilterOwner(p.owner);
      if (p.segment === "all" || p.segment === "hot" || p.segment === "verified" || p.segment === "warm" || p.segment === "troubled") {
        setSegment(p.segment);
      }
      if (typeof p.hidePlaceholders === "boolean") setHidePlaceholders(p.hidePlaceholders);
      if (p.sortMode === "priority" || p.sortMode === "recent" || p.sortMode === "urgent" || p.sortMode === "name" || p.sortMode === "spent") {
        setSortMode(p.sortMode);
      }
      if (p.viewMode === "list" || p.viewMode === "board" || p.viewMode === "table") setViewMode(p.viewMode);
    }
    // CODE REVIEW FIX: путь МЕРЖИМ, а не перезаписываем — drip/празднования,
    // случившиеся локально (или на другом устройстве), не откатываются
    // старым снимком при повторной резолюции («Повторить загрузку»).
    setPathState((prev) => mergeLeadPathState(prev, prefsResolution.path));
    if (!prefsSettledRef.current) {
      prefsSettledRef.current = true;
      setPrefsSettled(true);
    }
  }, [prefsResolution, searchQuery, debouncedSearchQuery, filterSource, filterStage, filterOwner, segment, hidePlaceholders, sortMode, viewMode]);

  // ── Загрузка: первая (после применения prefs) и при смене фильтров ────────
  // SWR: мгновенно рисуем из кэша (память → sessionStorage); свежий (< TTL) —
  // сети нет, устаревший — красим и тихо перевалидируем.
  useEffect(() => {
    if (!isAuthed || shouldShowPassword || !prefsSettled) return;
    const hash = hashOfFilters(filtersRef.current);
    const cached = readMemoryCache(slug, hash) ?? readSessionCache(slug, hash);
    if (cached) {
      setLeadsState(cached.leads);
      setTodosState(cached.todos);
      if (cached.agg) setAggState(cached.agg);
      if (cached.pageInfo) setPageInfo(cached.pageInfo);
      if (cached.operators) setOperators(cached.operators);
      if (cached.leadEvents) setLeadEvents(cached.leadEvents);
      if (cached.leaderboard) setLeaderboard(cached.leaderboard);
      writeMemoryCache(slug, hash, cached);
      if (Date.now() - cached.at < LEADS_CACHE_TTL_MS) {
        setIsFetchingLeads(false);
        return; // свежий кэш — сеть не нужна вовсе
      }
    }
    let cancelled = false;
    setIsFetchingLeads(true);
    (async () => {
      await fetchWindow("reset", () => cancelled);
      if (!cancelled) setIsFetchingLeads(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isAuthed,
    shouldShowPassword,
    prefsSettled,
    slug,
    fetchWindow,
    debouncedSearchQuery,
    filterSource,
    filterStage,
    filterOwner,
    segment,
    hidePlaceholders,
    sortMode,
    manualRetryTick,
  ]);

  // ── Debounced-сохранение фильтров в metadata jsonb + localStorage ──────────
  // Дебаунс (800 мс), флэш при уходе со страницы (keepalive) и ретрай сбоя —
  // внутри useLeadsUserPrefs. Здесь только отражение текущего состояния.
  useEffect(() => {
    if (!prefsSettled) return; // не сохраняем, пока не восстановили
    prefsRef.current.saveFilters({
      q: debouncedSearchQuery || undefined,
      source: filterSource,
      stage: filterStage,
      owner: filterOwner,
      segment,
      hidePlaceholders,
      sortMode,
      viewMode,
    });
  }, [prefsSettled, debouncedSearchQuery, filterSource, filterStage, filterOwner, segment, hidePlaceholders, sortMode, viewMode]);

  // ── «Показать ещё»: дозагрузка следующего окна с сервера ───────────────────
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreLeads = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    (async () => {
      try {
        await fetchWindow("more", () => false);
      } finally {
        setIsLoadingMore(false);
      }
    })();
  }, [fetchWindow, isLoadingMore]);

  // ── Тихий рефреш агрегатов (90 c, только в видимой вкладке) ────────────────
  // KPI/воронка/плейбук/лидерборд и счётчик total остаются честными, пока
  // оператор держит страницу открытой; окно и скролл не трогаются.
  useEffect(() => {
    if (!isAuthed || shouldShowPassword || !prefsSettled) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void fetchWindow("meta", () => false);
    };
    const iv = setInterval(tick, 90_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isAuthed, shouldShowPassword, prefsSettled, fetchWindow]);

  // Todo mapping — use writable state so TodoList callbacks sync the parent array
  const { getTodosForLead } = useTodosMapping(todosState);

  // Priority Score лейблы (⚡ свежий / 🔥 счёт) — считаются по ОКНУ. Полные
  // метрики (KPI/скорость/плейбук) считает СЕРВЕР по всему набору (agg) —
  // окно в 50 карточек не должно искажать «Всего лидов» и очередь SOP.
  // nowTick раз в минуту перевычисляет лейблы — просроченные перезвоны
  // вовремя получают буст без перезагрузки.
  const priorityMap = usePriorityMap(leadsState, getTodosForLead, nowTick);

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

  // ── Окно = список. Фильтрация и сортировка «лучшие сверху» выполнены
  // СЕРВЕРОМ теми же чистыми функциями (lib/leads-query-core) — порядок
  // глобальный, конкатенация окон («Показать ещё») его сохраняет.
  const sortedLeads = leadsState;
  const visibleLeads = sortedLeads;
  const hiddenCount = pageInfo ? Math.max(0, pageInfo.total - visibleLeads.length) : 0;

  // ── Ответственный: серверный ростер + легаси-имена (agg.availableOwners).
  // Пока agg не пришёл — только ростер (значение появится через мгновение).
  const availableOwners = useMemo(
    () => aggState?.availableOwners ?? operators.map((o) => ({ value: o.id, label: o.name })),
    [aggState, operators],
  );

  // Опции «Источник» — по ПОЛНОМУ набору с сервера (фильтры не исчезают).
  const availableSources = useMemo(
    () => aggState?.availableSources ?? [],
    [aggState],
  );

  const hasFilters =
    !!(debouncedSearchQuery || filterSource !== "all") ||
    filterStage !== "all" ||
    filterOwner !== "all";

  // Референс-дизайн §3: оранжевый бейдж «N» на кнопке фильтров — считаем
  // ВСЕ активные сужения списка (поиск, источник, стадия, ответственный,
  // сегмент, заглушки). Клик — resetAllFilters ниже.
  const activeFilterCount = useMemo(
    () =>
      [
        debouncedSearchQuery.trim().length > 0,
        filterSource !== "all",
        filterStage !== "all",
        filterOwner !== "all",
        segment !== "all",
        hidePlaceholders,
      ].filter(Boolean).length,
    [debouncedSearchQuery, filterSource, filterStage, filterOwner, segment, hidePlaceholders],
  );

  // FIX (mobile wave 3, dead button): EmptyState рисует «Сбросить фильтры»,
  // но onReset никто не передавал — кнопка была мёртвой. Сбрасываем ВСЁ,
  // что участвует в hasFilters. Сортировку не трогаем — это не фильтр.
  const resetAllFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setFilterSource("all");
    setFilterStage("all");
    setFilterOwner("all");
    setSegment("all");
    setHidePlaceholders(false);
  }, []);

  // ── Панели аналитики — СЕРВЕРНЫЕ агрегаты по ПОЛНОМУ набору (agg).
  // kpi включает speed (lib/lead-kpi.ts); null — первая загрузка идёт.
  const kpiMetrics = aggState?.kpi ?? null;
  // Достижения — CREW ONLY: для не-crew даже не читаем из agg.
  const achievements = useMemo(
    () => (isCrew ? aggState?.achievements ?? [] : []),
    [aggState, isCrew],
  );
  // Плейбук смены — очередь «что делать сейчас», посчитана сервером по всем
  // лидам (перезвоны и горячие за окном не выпадают из SOP).
  const playbookActions = useMemo(() => aggState?.playbook ?? [], [aggState]);
  // ВОРОНКА ПАЙПЛАЙНА (референс §2): распределение по стадиям, клик = фильтр.
  const stageBreakdown = useMemo(() => aggState?.stageBreakdown ?? [], [aggState]);

  // Segment counts for toolbar tabs — сервер (паритет с прежним поведением:
  // «all» по базовому набору, остальные с учётом поиска/источника/сегмента).
  const segmentCounts = useMemo(
    () => aggState?.segmentCounts ?? { all: 0, hot: 0, warm: 0, verified: 0, troubled: 0 },
    [aggState],
  );

  // ── «Путь оператора» (crew-only): по одному новому шагу за смену (drip),
  // завершения открывают следующий сразу (catch-up). Состояние — в
  // users.metadata.leads_path (см. prefs выше) + localStorage-зеркало.
  const pathHydratedRef = useRef(false);
  useEffect(() => {
    if (!isCrew || !prefsSettled || pathHydratedRef.current) return;
    pathHydratedRef.current = true;
    const { state: next, advanced } = applyLeadPathDrip(pathState, LEAD_PATH_STEPS.length);
    if (advanced) {
      setPathState(next);
      prefsRef.current.savePath(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCrew, prefsSettled]);

  // ── Гайды «Библиотеки оператора» → шаг «Теория» пути ──
  // Клик по ссылке в плейбуке пишет стор и шлёт «leads-guides-changed»;
  // здесь счётчик перечитывается ЖИВО (без перезагрузки) и попадает в
  // pathStats.guidesRead → computeLeadPathProgress закрывает шаг.
  const guidesKey = useMemo(() => guidesStorageKey(slug), [slug]);
  const [guidesReadCount, setGuidesReadCount] = useState(0);
  useEffect(() => {
    const reload = () => {
      try {
        setGuidesReadCount(parseGuidesReadIds(window.localStorage.getItem(guidesKey)).length);
      } catch { /* private mode */ }
    };
    reload();
    window.addEventListener("leads-guides-changed", reload as EventListener);
    return () => window.removeEventListener("leads-guides-changed", reload as EventListener);
  }, [guidesKey]);

  const pathStats = useMemo(() => {
    const meId = dbUser?.user_id || null;
    const idx = meId ? leaderboard.findIndex((e) => e.id === meId) : -1;
    return {
      myPoints: idx >= 0 ? leaderboard[idx].points : 0,
      myRank: idx >= 0 ? idx + 1 : null,
      crewSize: leaderboard.length,
      guidesRead: guidesReadCount,
    };
  }, [leaderboard, dbUser?.user_id, guidesReadCount]);

  // ── «ОТКРЫТО ЗА СМЕНУ»: личная история просмотров лидов (next iteration
  // ideas: «per-lead view history — which leads you already opened this
  // shift»). Оператор, вернувшись к списку, видит на карточке метку «👁»
  // и счётчик в футере — когнитивный налог «кого я уже смотрел?» снят.
  // История ЛИЧНАЯ и ЭФЕМЕРНАЯ: localStorage на устройстве, до конца дня
  // (lib/lead-view-history.ts) — серверу она не нужна. Все точки открытия
  // лида (список/доска/таблица/плейбук/«прочитать заметки») сходятся в
  // один selectedId — track-эффект ниже покрывает их все.
  const viewedKey = useMemo(() => viewedHistoryKey(slug), [slug]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    // Гидрация после монтирования (SSR — пусто) и при смене slug.
    try {
      setViewedIds(parseLeadViewHistory(window.localStorage.getItem(viewedKey)));
    } catch { /* private mode — история только в памяти */ }
  }, [viewedKey]);
  // Полуночная граница: вкладка ночной смены, пережившая дату, сама очищает
  // историю (таймер +1 с после полуночи; parse вернёт пустой набор).
  useEffect(() => {
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        try {
          setViewedIds(parseLeadViewHistory(window.localStorage.getItem(viewedKey)));
        } catch { /* private mode */ }
        schedule();
      }, msUntilNextMidnight());
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [viewedKey]);
  const registerLeadViewed = useCallback(
    (leadId: string) => {
      try {
        const current = parseLeadViewHistory(window.localStorage.getItem(viewedKey));
        if (current.has(leadId)) return; // уже в истории — ни записи, ни рендера
        const next = applyLeadViewed(current, leadId);
        setViewedIds(next);
        try {
          window.localStorage.setItem(viewedKey, serializeLeadViewHistory(next));
        } catch { /* private mode — история живёт в памяти до перезагрузки */ }
      } catch { /* LS недоступен — молча: история не критична */ }
    },
    [viewedKey],
  );
  useEffect(() => {
    if (selectedId) registerLeadViewed(selectedId);
  }, [selectedId, registerLeadViewed]);

  const pathProgress = useMemo(
    () => computeLeadPathProgress(pathState, LEAD_PATH_STEPS, pathStats),
    [pathState, pathStats],
  );

  // Scroll to selected lead
  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-lead-id="${selectedId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedId]);

  // «/» — мгновенный фокус в поиск (привычка операторов-десктопщиков).
  // Не мешаем, если фокус уже в поле ввода/редакторе.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const el = document.getElementById("leads-search-input");
      if (el) {
        e.preventDefault();
        (el as HTMLInputElement).focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      // Тихий meta-рефреш: счётчик total и агрегаты (плитки/воронка/плейбук)
      // без сброса окна и скролла оператора.
      void fetchWindow("meta", () => false);
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
  // (authHeaders определён выше, в блоке оконной загрузки — нужен и prefs.)

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

  // ── Отправка ответа в реальный чат Авито (Messenger API v3 через наш роут).
  // chatId — единственный стабильный идентификатор чата (ключ лида может
  // быть алиас-мерджнут: avito:<id> → телефон → opdoc:<id>). После успеха
  // оптимистично дописываем реплику в лог чата карточки (сервер уже записал
  // свою копию — дубль не попадёт: nextMessages на клиенте и сервере
  // сходятся по одному тексту/времени отправки).
  const handleSendAvitoReply = useCallback(async (text: string) => {
    const lead = selectedId ? leadsState.find((l) => l.user_id === selectedId) : null;
    const chatId = lead?.avito?.chatId;
    if (!lead || !chatId) {
      return { ok: false, error: "Лид не привязан к чату Авито" };
    }
    try {
      const resp = await fetch("/api/franchize/lead-avito-reply", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ crewId, slug, chatId, leadId: lead.user_id, text }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.success) {
        return { ok: false, error: body?.error || `Не удалось отправить (HTTP ${resp.status})` };
      }
      const message = body.message as { at: string; from: string; text: string };
      setLeadsState((prev) =>
        prev.map((l) =>
          l.user_id === lead.user_id && l.avito
            ? { ...l, avito: { ...l.avito, messages: [...(l.avito.messages || []), message].slice(-12) } }
            : l,
        ),
      );
      return { ok: true, message };
    } catch {
      return { ok: false, error: "Ошибка сети при отправке в Авито" };
    }
  }, [selectedId, leadsState, crewId, slug, authHeaders]);

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
                  // SLA-счётчик «Без активности» читает lastModifiedAt —
                  // касание только что было, сбрасываем его локально сразу,
                  // а не после следующего рефетча (иначе карточка до
                  // обновления списка продолжает показывать старый простой).
                  lastModifiedAt:
                    !l.lastModifiedAt || (res.data?.created_at && res.data.created_at > l.lastModifiedAt)
                      ? res.data?.created_at || l.lastModifiedAt
                      : l.lastModifiedAt,
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
      <div id="leads-kpi" className={flashCls("leads-kpi")}>
        {/* Плиты — готовые числа с сервера (agg.kpiCards по ПОЛНОМУ набору);
            скелет рисуется, пока первый ответ в пути. */}
        <LeadsKPICards stats={aggState?.kpiCards} T={T} />
      </div>

      {/* Плейбук смены — ВСЕГДА на виду (и на телефоне тоже): это не
          аналитика, а рабочая очередь «что делать сейчас». Раньше он жил
          внутри мобильного свёртка «Аналитика смены» — и главный SOP-
          инструмент оператора был спрятан за тапом. Панель сама компактна
          на телефоне (2 действия + «ещё N»). Чип звания — crew-only. */}
      <div id="leads-playbook" className={flashCls("leads-playbook")}>
        <LeadsPlaybookPanel
          actions={playbookActions}
          onOpenLead={(leadId) => setSelectedId(leadId)}
          T={T}
          storageKey={isCrew ? `leads-achv:${slug}` : undefined}
          doneStorageKey={isCrew ? `leads-playbook-done:${slug}` : undefined}
          compactPrefKey={`leads-playbook-expanded:${slug}`}
          guidesKey={guidesKey}
          superlist={aggState?.superlist ?? null}
        />
      </div>

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
            speed встроен в kpiMetrics (lib/lead-kpi.ts) — один проход по данным.
            winPatterns — «общие факторы побед» (lead-win-patterns.ts): панель
            молчит, когда данных мало. */}
        {kpiMetrics && (
          <LeadSpeedPanel metrics={kpiMetrics.speed} winPatterns={kpiMetrics.winPatterns} T={T} />
        )}

        {/* Воронка KPI из протокола встречи: Активность → Диалог → КЭВ → Сделка,
            конверсии, норма дня, «горячие ждут», тест-драйвы, ср. чек.
            Наверху — кликабельная полоса стадий пайплайна (референс §2):
            клик по сегменту = фильтр списка по стадии. */}
        {kpiMetrics && (
          <LeadsFunnelPanel
            kpi={kpiMetrics}
            T={T}
            stageBreakdown={stageBreakdown}
            activeStage={filterStage}
            onStageSelect={setFilterStage}
          />
        )}

        {/* Достижения экипажа — CREW ONLY (путь оператора не для обычных
            пользователей; для не-crew панель даже не считается). storageKey —
            sticky-стор «заработано навсегда» на экипаж (фикс повторных тостов
            при колебании метрик и перезагрузках). */}
        {isCrew && (
          <div id="leads-achievements" className={flashCls("leads-achievements")}>
            <LeadsAchievementsPanel achievements={achievements} storageKey={`leads-achv:${slug}`} T={T} />
            {/* ПРОЗРАЧНЫЙ ЛИДЕРБОРД (Lead Game): серверная агрегация журнала
                lead_events — все участники видят одни и те же цифры. Прогресс
                засчитывается не только за закрытия (взяты/перезвоны/задачи). */}
            <LeadsLeaderboardPanel
              leaderboard={leaderboard}
              currentActorId={dbUser?.user_id || null}
              T={T}
            />
            {/* «ПУТЬ ОПЕРАТОРА»: геймификационная лестница — по одному новому
                шагу за смену (drip), завершение текущего шага открывает
                следующий сразу (catch-up по очкам прозрачного лидерборда).
                Состояние — в users.metadata.leads_path (см. prefs). */}
            <div className="mt-5">
              <LeadsPathPanel
                progress={pathProgress}
                state={pathState}
                myPoints={pathStats.myPoints}
                guidesRead={guidesReadCount}
                onStatePatch={(next) => {
                  setPathState(next);
                  prefsRef.current.savePath(next);
                }}
                T={T}
              />
            </div>
          </div>
        )}
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

      <div id="leads-toolbar" className={flashCls("leads-toolbar")}>
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
          activeFilterCount={activeFilterCount} onResetFilters={resetAllFilters}
          T={T} isAuto={isAuto}
        />
      </div>

      {/* Однократная подсказка после первого успешного сохранения настроек:
          оператор видит, что фильтры/вид запоминаются между сменами. */}
      {saveFlash && (
        <div className="flex justify-end px-1 pt-1">
          <span
            className="rounded-full border px-2.5 py-1 text-[11px]"
            style={{ borderColor: T.border, color: T.textFaint, backgroundColor: T.bgCard }}
          >
            ✓ Фильтры и вид запоминаются автоматически
          </span>
        </div>
      )}

      {viewMode === "board" ? (
        <LeadBoard
          leads={visibleLeads}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onDismiss={handleDismissLead}
          getTodosForLead={getTodosForLead}
          priorityMap={priorityMap}
          onReadNotes={handleReadNotes}
          viewedIds={viewedIds}
          T={T}
        />
      ) : viewMode === "table" ? (
        // NEW (iter6): analytics-style table view — same interaction model as
        // the card list (click a row → detail panel on desktop / sheet on
        // mobile), but dense and scannable.
        sortedLeads.length === 0 ? (
          <EmptyState hasFilters={hasFilters} searchQuery={debouncedSearchQuery} onReset={resetAllFilters} T={T} />
        ) : (
          <LeadTableView
            leads={visibleLeads}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            getTodosForLead={getTodosForLead}
            priorityMap={priorityMap}
            onReadNotes={handleReadNotes}
            viewedIds={viewedIds}
            sortMode={sortMode}
            onSortChange={setSortMode}
            T={T}
          />
        )
      ) : sortedLeads.length === 0 ? (
        <EmptyState hasFilters={hasFilters} searchQuery={debouncedSearchQuery} onReset={resetAllFilters} T={T} />
      ) : (
        <LeadList
          leads={visibleLeads}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          onDismiss={handleDismissLead}
          getTodosForLead={getTodosForLead}
          priorityMap={priorityMap}
          onReadNotes={handleReadNotes}
          viewedIds={viewedIds}
          T={T}
          crewId={crewId}
          slug={slug}
        />
      )}

      {/* ── Серверная пагинация: «показано X из Y» + «Показать ещё» ──
          Первая порция — только LEADS_PAGE_SIZE лучших лидов (сортировка
          «лучшие сверху» на сервере); остальное дозагружается окнами.
          Счётчик честный: pageInfo.total приходит с сервера по отфильтрованному
          набору и тихо обновляется фоновым meta-рефрешем. Строка видна
          всегда (не только при hasMore) — она же даёт штамп «обновлено
          HH:MM» от тихого 90-секундного рефреша. */}
      {pageInfo && (
        <div className="flex flex-col items-center gap-2 py-4">
          {pageInfo.hasMore && (
            <button
              type="button"
              onClick={loadMoreLeads}
              disabled={isLoadingMore}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border px-5 py-2 text-sm font-semibold transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
              style={{ borderColor: T.border, backgroundColor: T.bgCard, color: T.text }}
            >
              {isLoadingMore ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  Догружаю…
                </>
              ) : (
                <>Показать ещё {Math.min(LEADS_PAGE_SIZE, pageInfo.total - visibleLeads.length)}</>
              )}
            </button>
          )}
          <span className="text-[11px]" style={{ color: T.textFaint }}>
            Показано {visibleLeads.length} из {pageInfo.total} лидов
            {pageInfo.hasMore ? " — лучшие уже наверху" : ""}
            {viewedIds.size > 0 ? ` · открыто за смену: ${viewedIds.size}` : ""}
            {lastSyncAt
              ? ` · обновлено ${new Date(lastSyncAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
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
              onSendAvitoReply={handleSendAvitoReply}
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
              recordedEvents={leadEvents.filter((e) => e.leadId === selectedId)}
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

      {/* ОБЗОР-ТУР + кнопка «?»: step-by-step введение (плейбук → KPI →
          фильтры → шторка → аналитика → путь оператора) и ссылка на полный
          гайд. Автозапуск один раз, когда лиды загрузились и гейт пройден;
          «Пропустить»/Esc закрывают навсегда (done-флаг), кнопка «?» —
          всегда доступна. Геймификационный шаг — только crew. */}
      <LeadsGuidedTour
        T={T}
        slug={slug}
        isCrew={isCrew}
        autoLaunch={!shouldShowPassword && leadsState.length > 0}
        onReveal={revealTarget}
      />
    </div>
  );
}