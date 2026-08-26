// /app/franchize/[slug]/leads/LeadsClient.tsx
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, X, Bike } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import type {LeadRow, LeadTodoRow} from "./leads-types";
import { getFranchizeLeads } from "@/app/franchize/server-actions/leads";

// Import extracted components
import { LeadsKPICards } from "./components/LeadsKPICards";
import { LeadsToolbar } from "./components/LeadsToolbar";
import { LeadList } from "./components/LeadList";
import { LeadBoard } from "./components/LeadBoard";
import { LeadTableView } from "./components/LeadTableView";
import { MobileLeadSheet } from "./components/MobileLeadSheet";
import { EmptyState } from "./components/EmptyState";
import { LeadDetailContent } from "./components/LeadDetailContent";
import { Avatar } from "./components/Avatar";
import { SourceBadge } from "./components/SourceBadge";
import { IdentityBadge } from "./components/IdentityBadge";
import { DismissLeadDialog, type DismissReason } from "./components/DismissLeadDialog";

// Import constants
import {
  type Segment,
  type ViewMode,
  type SortMode,
  type FilterFlags,
} from "./leads-constants";
import { relativeTime } from "./leads-utils";

// Import hooks
import { useTodosMapping, useFilteredSortedLeads } from "./hooks/useLeadsData";
import { useTheme } from "./hooks/useTheme";
import { usePasswordGate } from "./hooks/usePasswordGate";

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
  const [sortMode, setSortMode] = useState<SortMode>("recent");
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
  const leadsFetchedRef = useRef(false);

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
          dbUser?.user_id || "",
          false, // isPasswordAuth=false — server tries cookie auth first
          initData,
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
  }, [slug, dbUser?.user_id]);

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
  } = useFilteredSortedLeads(leadsState, debouncedSearchQuery, filterSource, segment, getTodosForLead, sortMode, hidePlaceholders);

  // ── Stage + Owner filters (applied AFTER useFilteredSortedLeads) ──
  // These are new filters that the v2-style toolbar exposes. They narrow
  // the already-sorted leads list without re-running the full pipeline.
  const sortedLeads = useMemo(() => {
    let result = baseSortedLeads;
    if (filterStage !== "all") {
      result = result.filter((l) => (l.intentStage || "new") === filterStage);
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
  const confirmDismissLead = async (reason: string, note: string) => {
    const leadId = dismissTarget?.user_id;
    if (!leadId) return;
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
    }
  };

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

  // ── Desktop detail panel (shared by list + table views) ──────────────────
  // Extracted (iter6) so the new table view gets the same detail panel as the
  // card list — click a table row on desktop → panel slides in on the right.
  const desktopDetailPanel = (
    <AnimatePresence mode="wait">
      {(() => {
        const selectedLead = selectedId ? sortedLeads.find(l => l.user_id === selectedId) : null;
        if (!selectedLead) {
          return (
            <motion.div
              key="empty-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="sticky top-24 flex h-[calc(100vh-200px)] items-center justify-center rounded-2xl border border-dashed"
              style={{ borderColor: T.border }}
            >
              <p className="text-sm" style={{ color: T.textFaint }}>Выберите лида для просмотра деталей</p>
            </motion.div>
          );
        }
        return (
          <motion.div
            key={selectedLead.user_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", damping: 24, stiffness: 260, mass: 0.6 }}
            className="sticky top-24 max-h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border p-4"
            style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: T.shadow }}
          >
            <div className="mb-4 flex items-start gap-3">
              <Avatar name={selectedLead.full_name} source={selectedLead.source} size={56} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-bold" style={{ color: T.text }}>{selectedLead.full_name || "Без имени"}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: T.textMuted }}>
                  {selectedLead.phone && <span>{selectedLead.phone}</span>}
                  {selectedLead.username && <span>@{selectedLead.username}</span>}
                  <span>{relativeTime(selectedLead.lastSeenAt || selectedLead.createdAt)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <SourceBadge source={selectedLead.source} size="md" />
                  {selectedLead.identityState && selectedLead.identityState !== 'claimed_user' && (
                    <IdentityBadge state={selectedLead.identityState} />
                  )}
                  {selectedLead.bikeTitle && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: T.borderSoft, color: T.text }}>
                      <Bike className="h-3 w-3" /> {selectedLead.bikeTitle}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedId(null)} aria-label="Закрыть детали" className="rounded p-1 transition hover:bg-black/5" style={{ color: T.textFaint }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <LeadDetailContent lead={selectedLead} todos={getTodosForLead(selectedLead)} crewId={crewId} slug={slug} T={T} onTodoUpdate={handleTodoUpdate} />
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <LeadsKPICards leads={activeLeads} hot={hot} verified={verified} todos={todos} T={T} />

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
        sortMode={sortMode} setSortMode={setSortMode}
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
          T={T}
        />
      ) : viewMode === "table" ? (
        // NEW (iter6): analytics-style table view — same interaction model as
        // the card list (click a row → detail panel on desktop / sheet on
        // mobile), but dense and scannable.
        sortedLeads.length === 0 ? (
          <EmptyState hasFilters={hasFilters} searchQuery={debouncedSearchQuery} T={T} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className={`transition-all duration-200 ${selectedId ? "lg:col-span-7" : "lg:col-span-12"}`}>
              <LeadTableView
                leads={sortedLeads}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
                getTodosForLead={getTodosForLead}
                sortMode={sortMode}
                onSortChange={setSortMode}
                T={T}
              />
            </div>
            {/* Desktop detail panel — shared with the list view */}
            <div className="hidden lg:block lg:col-span-5">{desktopDetailPanel}</div>
          </div>
        )
      ) : sortedLeads.length === 0 ? (
        <EmptyState hasFilters={hasFilters} searchQuery={debouncedSearchQuery} T={T} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* List column — shrinks on desktop when lead selected */}
          <div className={`space-y-3 transition-all duration-200 ${selectedId ? "lg:col-span-5" : "lg:col-span-12"}`}>
            <LeadList
              leads={sortedLeads}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              onDismiss={handleDismissLead}
              getTodosForLead={getTodosForLead}
              T={T}
              crewId={crewId}
              slug={slug}
            />
          </div>

          {/* Desktop detail panel — always rendered; shows empty state or details */}
          <div className="hidden lg:block lg:col-span-7">{desktopDetailPanel}</div>
        </div>
      )}

      {/* Mobile bottom sheet — slides up on lead selection */}
      {selectedId && (() => {
        const selectedLead = sortedLeads.find(l => l.user_id === selectedId);
        if (!selectedLead) return null;
        return (
          <MobileLeadSheet open={true} onClose={() => setSelectedId(null)} title={selectedLead.full_name || selectedLead.phone || undefined} T={T}>
            <LeadDetailContent lead={selectedLead} todos={getTodosForLead(selectedLead)} crewId={crewId} slug={slug} T={T} onTodoUpdate={handleTodoUpdate} />
          </MobileLeadSheet>
        );
      })()}

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
      />
    </div>
  );
}