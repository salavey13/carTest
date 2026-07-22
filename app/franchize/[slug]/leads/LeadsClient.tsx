"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, X, Bike } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";

// Import extracted components
import { LeadsKPICards, type LeadsKpis } from "./components/LeadsKPICards";
import { LeadsToolbar } from "./components/LeadsToolbar";
import { LeadList } from "./components/LeadList";
import { LeadBoard } from "./components/LeadBoard";
import { MobileLeadSheet } from "./components/MobileLeadSheet";
import { EmptyState } from "./components/EmptyState";
import { LeadDetailContent } from "./components/LeadDetailContent";
import { Avatar } from "./components/Avatar";
import { SourceBadge } from "./components/SourceBadge";
import { IdentityBadge } from "./components/IdentityBadge";

// Import constants
import {
  type Segment,
  type ViewMode,
  type SortMode,
  type FilterFlags,
  type SortModeV2,
  type LeadSignal,
} from "./leads-constants";
import { computeLeadSignals } from "./lib/sla-signals";
import { STAGE_LABELS } from "./lib/pipeline-stages";
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
  const [segment, setSegment] = useState<Segment>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [hidePlaceholders, setHidePlaceholders] = useState(true); // Hide operator placeholders by default
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [filterFlags, setFilterFlags] = useState<FilterFlags>({
    overdueOnly: false,
    unclaimedQrOnly: false,
    documentsMissingOnly: false,
    activeRentalOnly: false,
    returnDueOnly: false,
    dismissedOnly: false,
    hideOperatorPlaceholders: true,
  });

  const router = useRouter();
  const { dbUser } = useAppContext();
  const T = useTheme({ isAuto, isLightTheme, textColor, bgColor, accentColor });

  // Writable leads state — dismiss removes optimistically, router.refresh() re-syncs
  const [leadsState, setLeadsState] = useState(leads);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Password gate
  const isInTelegram = useMemo(() => {
    if (typeof window === "undefined") return false;
    const tg = (window as any).Telegram?.WebApp;
    return !!(tg?.initData && tg.initData.length > 0);
  }, []);

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

  // Todo mapping — use writable state so TodoList callbacks sync the parent array
  const [todosState, setTodosState] = useState(todos);
  const { getTodosForLead } = useTodosMapping(todosState);

  /** Compute SLA signals for a lead — needed by v2 LeadCard/LeadList/LeadBoard */
  const getLeadSignals = useCallback((lead: LeadRow): LeadSignal[] => {
    try {
      return computeLeadSignals(lead, todosState);
    } catch {
      return [];
    }
  }, [todosState]);

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

  // Filtered, sorted, categorized leads
  const {
    sortedLeads,
    hot,
    verified,
    warm,
    availableSources,
    hasFilters,
    boardColumns,
  } = useFilteredSortedLeads(leadsState, debouncedSearchQuery, filterSource, segment, getTodosForLead, sortMode, hidePlaceholders);

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

  // KPI cards — computed client-side from activeLeads + hot.
  // Mirrors server-side getLeadsKpis() math (app/franchize/server-actions/leads-kpis.ts)
  // but without a mode filter — v1 LeadsClient shows a single segment.
  const kpis = useMemo<LeadsKpis>(() => {
    const totalLeads = activeLeads.filter((l) => l.stageKey !== "closed_lost").length;
    const hotLeads = hot.length;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 864e5);
    const recent = activeLeads.filter((l) => !!l.createdAt && new Date(l.createdAt) >= thirtyDaysAgo);
    const recentWon = recent.filter((l) => l.stageKey === "closed_won").length;
    const conversionRate = recent.length > 0 ? Math.round((recentWon / recent.length) * 100) : 0;
    const monthlyRevenue = activeLeads.reduce(
      (sum, l) => sum + l.rentals
        .filter((r) => r.status === "active" || r.status === "completed")
        .reduce((s, r) => s + (Number(r.totalCost) || 0), 0),
      0,
    );
    return { totalLeads, hotLeads, conversionRate, monthlyRevenue };
  }, [activeLeads, hot]);

  // Scroll to selected lead
  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-lead-id="${selectedId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedId]);

  // Auto-focus a lead from the URL (?leadId=…) — used by startapp deep-link
  // `lead_<id>` from lead-watcher Telegram notifications.
  // Читаем window.location.search напрямую, чтобы не тянуть useSearchParams
  // (ему нужен Suspense boundary в Next.js 14 при статической генерации).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const leadId = params.get("leadId");
    if (!leadId) return;
    // Only set if the lead is actually in the loaded list — otherwise the
    // detail pane shows an empty state. If list is still loading, the effect
    // re-runs when `leads` prop updates.
    if (leads.some((l) => l.user_id === leadId)) {
      setSelectedId((prev) => (prev === leadId ? prev : leadId));
    }
  }, [leads]);

  // Dismiss lead — pass auth headers so the server can verify crew membership
  const handleDismissLead = async (leadId: string) => {
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
        body: JSON.stringify({ leadId, dismissLead: true, slug, crewId }),
      });
      if (!resp.ok) { alert("Не удалось убрать лид. Попробуйте позже."); return; }
      // Optimistic remove from local state, then re-sync with server
      setLeadsState((prev) => prev.filter((l) => l.user_id !== leadId));
      setSelectedId((prev) => prev === leadId ? null : prev);
      router.refresh();
    } catch { alert("Ошибка сети."); }
  };

  // Password gate render
  if (showPasswordEntry && !passwordAuthed) {
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
      <LeadsKPICards kpis={kpis} T={T} />

      <LeadsToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        sortValue={(sortMode as string) as SortModeV2}
        onSortChange={(v: SortModeV2) => setSortMode(v as SortMode)}
        sourceValue={sourceFilter}
        onSourceChange={setSourceFilter}
        availableSources={availableSources}
        ownerValue={ownerFilter}
        onOwnerChange={setOwnerFilter}
        stageValue={stageFilter}
        onStageChange={setStageFilter}
        filterFlags={filterFlags}
        onFilterFlagsChange={(f: Partial<FilterFlags>) => setFilterFlags((prev) => ({ ...prev, ...f }))}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExport={() => {}}
        T={T}
      />

      {viewMode === "board" ? (
        <LeadBoard
          leadsByStage={boardColumns as Record<string, LeadRow[]>}
          selectedLeadId={selectedId}
          onSelectLead={(lead: LeadRow) => setSelectedId(lead.user_id)}
          getLeadSignals={getLeadSignals}
          T={T}
        />
      ) : sortedLeads.length === 0 ? (
        <EmptyState hasFilters={hasFilters} searchQuery={debouncedSearchQuery} T={T} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* List column — shrinks on desktop when lead selected */}
          <div className={`space-y-3 transition-all duration-200 ${selectedId ? "lg:col-span-5" : "lg:col-span-12"}`}>
            <LeadList
              leads={sortedLeads}
              selectedLeadId={selectedId}
              onSelectLead={(lead: LeadRow) => setSelectedId(lead.user_id)}
              onDismissLead={handleDismissLead}
              getTodosForLead={getTodosForLead}
              getLeadSignals={getLeadSignals}
              T={T}
              crewId={crewId}
              slug={slug}
            />
          </div>

          {/* Desktop detail panel — always rendered; shows empty state or details */}
          <div className="hidden lg:block lg:col-span-7">
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
                      <button onClick={() => setSelectedId(null)} className="rounded p-1 transition hover:bg-black/5" style={{ color: T.textFaint }}>
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <LeadDetailContent
                    lead={selectedLead}
                    todos={getTodosForLead(selectedLead)}
                    notes={[]}
                    T={T}
                    onClose={() => setSelectedId(null)}
                    onAction={() => {}}
                    onCreateTodo={() => {}}
                    onToggleTodo={(id: string) => handleTodoUpdate('toggle', id)}
                    onDeleteTodo={(id: string) => handleTodoUpdate('delete', id)}
                    onAddNote={() => {}}
                  />
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Mobile bottom sheet — slides up on lead selection */}
      {selectedId && (() => {
        const selectedLead = sortedLeads.find(l => l.user_id === selectedId);
        if (!selectedLead) return null;
        return (
          <MobileLeadSheet open={true} onClose={() => setSelectedId(null)} title={selectedLead.full_name || selectedLead.phone || undefined} T={T}>
            <LeadDetailContent
                    lead={selectedLead}
                    todos={getTodosForLead(selectedLead)}
                    notes={[]}
                    T={T}
                    onClose={() => setSelectedId(null)}
                    onAction={() => {}}
                    onCreateTodo={() => {}}
                    onToggleTodo={(id: string) => handleTodoUpdate('toggle', id)}
                    onDeleteTodo={(id: string) => handleTodoUpdate('delete', id)}
                    onAddNote={() => {}}
                  />
          </MobileLeadSheet>
        );
      })()}
    </div>
  );
}