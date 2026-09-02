// /app/franchize/[slug]/leads/LeadsClient.tsx
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import type {LeadRow, LeadTodoRow} from "./leads-types";
import { getFranchizeLeads } from "@/app/franchize/server-actions/leads";

// Import extracted components
import { LeadsKPICards } from "./components/LeadsKPICards";
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
  /** m4 fix: notify is a server-side Telegram send — dedupe double taps. */
  const [notifyBusy, setNotifyBusy] = useState(false);
  const leadsFetchedRef = useRef(false);

  // ── Lead detail sheet state (2026-09-01 sheet overhaul) ──
  // Notes are fetched lazily for the SELECTED lead (they live in a separate
  // table and would bloat the initial leads payload if fetched for everyone).
  const [notesState, setNotesState] = useState<LeadDrawerNote[]>([]);
  const [notesLeadId, setNotesLeadId] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  // Lightweight toast for action feedback (copy/notify errors etc.) —
  // z-[70]: above the sheet (z-[60]) and the header (z-50).
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, ms = 2600) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), ms);
  }, []);

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
  const priorityMap = usePriorityMap(leadsState, getTodosForLead);

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
  const sortedLeads = useMemo(() => {
    let result = baseSortedLeads;
    if (filterStage !== "all") {
      result = result.filter((l) => (l.stageKey || "new") === filterStage);
    }
    if (filterOwner !== "all") {
      result = result.filter((l) => {
        const owner = l.assigneeName || l.ownerName || "—";
        return owner === filterOwner;
      });
    }
    return result;
  }, [baseSortedLeads, filterStage, filterOwner]);

  // Available owners — computed from ALL leads (not filtered) so the dropdown
  // always shows every possible owner even if the current filter hides them.
  const availableOwners = useMemo(() => {
    const set = new Set<string>();
    for (const l of leadsState) {
      const owner = l.assigneeName || l.ownerName;
      if (owner) set.add(owner);
    }
    return Array.from(set).sort();
  }, [leadsState]);

  const hasFilters = baseHasFilters || filterStage !== "all" || filterOwner !== "all";

  // Filter out operator placeholders from segment counts for cleaner metrics
  const activeLeads = useMemo(() => 
    hidePlaceholders 
      ? leadsState.filter((l) => l.identityState !== 'operator_placeholder')
      : leadsState,
    [leadsState, hidePlaceholders]
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
        alert(`Не удалось убрать лид: ${msg}`);
        return;
      }
      // Optimistic remove from local state, then re-sync with server
      setLeadsState((prev) => prev.filter((l) => l.user_id !== leadId));
      setSelectedId((prev) => prev === leadId ? null : prev);
      // Close the dialog
      setDismissTarget(null);
      router.refresh();
    } catch (e) {
      alert("Ошибка сети.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, isAuthed, crewId, passwordAuthOwnerId]);

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
            showToast(`TG ID ${lead.telegramChatId} скопирован`);
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
        if (notifyBusy) break; // m4 fix: no double-fire — duplicate TG messages
        setNotifyBusy(true);
        showToast("Отправляем уведомление…", 1200);
        try {
          const res = await notifyLeadViaTelegram({
            slug,
            chatId: lead.telegramChatId,
            bikeTitle: lead.bikeTitle ?? undefined,
            initData: getTelegramInitData(),
          });
          showToast(res.success ? "Уведомление отправлено" : (res.error || "Ошибка отправки"));
        } catch {
          showToast("Ошибка отправки — нет связи");
        } finally {
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
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ crewId, slug, leadId: lead.user_id, leadName: lead.full_name || "", title: title.trim() }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.success) {
        showToast(body?.error || `Не удалось создать задачу (HTTP ${resp.status})`);
        return;
      }
      // Optimistic local append (the API returns the full todo row).
      const todo = body.todo as LeadTodoRow;
      setTodosState((prev) => [todo, ...prev]);
    } catch {
      showToast("Ошибка сети при создании задачи");
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
        showToast(body?.error || "Не удалось обновить задачу");
      }
    } catch {
      setTodosState((prev) => prev.map((t) => (t.id === todoId ? { ...t, status: current.status } : t)));
      showToast("Ошибка сети");
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
        showToast(body?.error || "Не удалось удалить задачу");
      }
    } catch {
      setTodosState(snapshot);
      showToast("Ошибка сети");
    }
  }, [todosState, crewId, authHeaders, showToast]);

  // ── Sheet notes handler (server action, cookie-auth) ──
  const handleAddNote = useCallback(async (text: string) => {
    const lead = selectedId ? leadsState.find((l) => l.user_id === selectedId) : null;
    if (!lead || !text.trim()) return;
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
      } else {
        showToast(res.error || "Не удалось сохранить заметку");
      }
    } catch {
      showToast("Ошибка сети при сохранении заметки");
    }
  }, [selectedId, leadsState, crewId, dbUser?.user_id, passwordAuthOwnerId, passwordAuthed, showToast]);

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
      <LeadsKPICards leads={activeLeads} hot={hot} verified={verified} todos={todosState} T={T} />

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
          leads={sortedLeads}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onDismiss={handleDismissLead}
          getTodosForLead={getTodosForLead}
          priorityMap={priorityMap}
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
            leads={sortedLeads}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            getTodosForLead={getTodosForLead}
            priorityMap={priorityMap}
            sortMode={sortMode}
            onSortChange={setSortMode}
            T={T}
          />
        )
      ) : sortedLeads.length === 0 ? (
        <EmptyState hasFilters={hasFilters} searchQuery={debouncedSearchQuery} T={T} />
      ) : (
        <LeadList
          leads={sortedLeads}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          onDismiss={handleDismissLead}
          getTodosForLead={getTodosForLead}
          priorityMap={priorityMap}
          T={T}
          crewId={crewId}
          slug={slug}
        />
      )}

      {/* Adaptive lead-detail sheet — bottom sheet on phones/narrow windows,
          right-side drawer on ≥lg. Replaces BOTH the old mobile-only sheet
          (whose inner drawer used to take over the whole screen) and the old
          inline desktop panel (whose close button hid under the CrewHeader). */}
      {selectedId && (() => {
        const selectedLead = sortedLeads.find(l => l.user_id === selectedId);
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
              notifyBusy={notifyBusy}
              asSheetChild
            />
          </LeadDetailSheet>
        );
      })()}

      {/* Toast — action feedback (copy/notify/todo errors). z-[70] sits above
          the sheet (z-[60]) and the CrewHeader (z-50). */}
      {toastMsg && (
        <div
          className="fixed inset-x-0 bottom-6 z-[70] mx-auto w-fit max-w-[92vw] rounded-full border px-4 py-2.5 text-sm font-medium shadow-lg"
          style={{ backgroundColor: T.bgCard, borderColor: T.border, color: T.text }}
          role="status"
        >
          {toastMsg}
        </div>
      )}

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