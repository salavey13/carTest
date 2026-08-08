"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bike,
  TrendingUp,
  Wrench,
  EyeOff,
  type LucideIcon,
} from "lucide-react";
import type { LeadRow, LeadTodoRow } from "../leads-types";
import type { ThemeTokens } from "../hooks/useTheme";
import type {
  Mode,
  StageKey,
  FilterFlags,
  SortModeV2,
  LeadSignal,
} from "../leads-constants";

// Hooks
// Note: useFilteredSortedLeads is also exported from this module but its v1
// signature (SortMode, Segment) doesn't fit the v2 types (SortModeV2,
// FilterFlags). The filter+sort pipeline is reimplemented inline below.
import { useTodosMapping } from "../hooks/useLeadsData";
import { useLeadFilters } from "../hooks/useLeadFilters";
import { useLeadActions } from "../hooks/useLeadActions";
// NEW (polish 2026-07-30): server action for fetching leads AFTER auth passes.
// Previously the page passed leads as server-side props (visible in HTML payload
// before password gate). Now the page passes empty arrays and LeadsClient
// fetches via this action once the user is authed.
// FIX: use the same absolute @/app/franchize/server-actions/leads path that
// line 19 already uses for the LeadRow type import. Relative `../../server-actions/leads`
// would resolve to app/franchize/[slug]/server-actions/leads (WRONG — that dir
// doesn't exist). Build was failing with "Module not found: Can't resolve
// '../../server-actions/leads'".
// FIX: was statically importing getFranchizeLeads — but leads.ts now imports
// telegram-actor-cookie.ts which has `import "server-only"`. This causes
// "Cannot access 'eW' before initialization" runtime error on the client.
// Dynamic import keeps server-only code out of the client bundle.

// Lib
// All pipeline / SLA / dismiss / KPI / note logic now lives in the
// useLeadFilters and useLeadActions hooks. We only need computeLeadSignals
// here for the getLeadSignals callback (which is itself passed back into
// useLeadFilters for sort-by-urgent).
import { computeLeadSignals } from "../lib/sla-signals";

// Components
import { LeadsAppShell } from "./LeadsAppShell";
import { LeadsToolbar } from "./LeadsToolbar";
import { LeadsKPICards } from "./LeadsKPICards";
import { PipelineFunnelBar, type PipelineStage } from "./PipelineFunnelBar";
import { SegmentChips, type SegmentChip } from "./SegmentChips";
import { LeadList } from "./LeadList";
import { LeadBoard } from "./LeadBoard";
import { LeadDetailContent, type LeadDetailContentNote } from "./LeadDetailContent";
import { MobileLeadSheet } from "./MobileLeadSheet";
import { DismissLeadDialog } from "./DismissLeadDialog";
import { EmptyState } from "./EmptyState";
import { useAppContext } from "@/contexts/AppContext";
import { AnalyticsPasswordEntry } from "@/app/franchize/components/AnalyticsPasswordEntry";
import { AnalyticsLoading } from "@/app/franchize/components/AnalyticsLoading";

// ── Types ───────────────────────────────────────────────────────────────────

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

// ── Constants ───────────────────────────────────────────────────────────────

/** Intent types grouped by Mode — matches getLeadsKpis server action. */
// MODE_INTENTS moved to useLeadFilters hook

const MODE_TABS: Array<{ value: Mode; label: string; icon: LucideIcon; color: string }> = [
  { value: "rent", label: "Аренда", icon: Bike, color: "#22c55e" },
  { value: "sale", label: "Продажа", icon: TrendingUp, color: "#f59e0b" },
  { value: "service", label: "Сервис", icon: Wrench, color: "#3b82f6" },
];

// DEFAULT_FILTER_FLAGS moved to useLeadFilters hook

// ── Main Component ──────────────────────────────────────────────────────────

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
  const router = useRouter();
  const { dbUser, isLoading: authLoading } = useAppContext();
  // Password gate — same pattern as RentalsAnalyticsClient.
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);
  const shouldShowPassword = !authLoading && !dbUser && !passwordAuthOwnerId;

  // ── Theme tokens (built inline to avoid pulling useTheme's full API) ──
  const T: ThemeTokens = useMemo(() => {
    if (isAuto) {
      return {
        text: "var(--franchize-text-primary)",
        textMuted: "var(--franchize-text-secondary)",
        textFaint: "color-mix(in srgb, var(--franchize-text-secondary) 65%, transparent)",
        bg: "var(--franchize-bg-base)",
        bgCard: "color-mix(in srgb, var(--franchize-bg-card) 96%, transparent)",
        bgCardHover: "color-mix(in srgb, var(--franchize-accent-main) 6%, transparent)",
        bgElevated: "var(--franchize-bg-card)",
        border: "color-mix(in srgb, var(--franchize-border-soft) 45%, transparent)",
        borderSoft: "color-mix(in srgb, var(--franchize-border-soft) 25%, transparent)",
        borderActive: "var(--franchize-accent-main)",
        inputBg: "var(--franchize-bg-base)",
        inputBorder: "color-mix(in srgb, var(--franchize-border-soft) 55%, transparent)",
        shadow: "0 4px 24px color-mix(in srgb, var(--franchize-accent-main) 6%, transparent)",
        accent: "var(--franchize-accent-main)",
        accentContrast: "var(--franchize-accent-contrast)",
      };
    }
    return {
      text: isLightTheme ? "#1e293b" : textColor,
      textMuted: isLightTheme ? "#64748b" : `${textColor}99`,
      textFaint: isLightTheme ? "#94a3b8" : `${textColor}60`,
      bg: isLightTheme ? "#f8fafc" : bgColor,
      bgCard: isLightTheme ? "#ffffff" : `${accentColor}08`,
      bgCardHover: isLightTheme ? "#f1f5f9" : `${accentColor}12`,
      bgElevated: isLightTheme ? "#ffffff" : `${accentColor}10`,
      border: isLightTheme ? "#e2e8f0" : `${accentColor}22`,
      borderSoft: isLightTheme ? "#f1f5f9" : `${accentColor}12`,
      borderActive: accentColor,
      inputBg: isLightTheme ? "#ffffff" : `${accentColor}0a`,
      inputBorder: isLightTheme ? "#cbd5e1" : `${accentColor}30`,
      shadow: isLightTheme ? "0 4px 20px rgba(0,0,0,0.08)" : "0 4px 24px rgba(0,0,0,0.35)",
      accent: accentColor,
      accentContrast: isLightTheme ? "#16130A" : "#ffffff",
    };
  }, [isAuto, isLightTheme, textColor, bgColor, accentColor]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Writable leads/todos state ──
  // `leads` and `todos` props come from the server; we keep them in local
  // state so dismiss / todo CRUD can do optimistic updates and then
  // router.refresh() re-syncs with the server.
  const [leadsState, setLeadsState] = useState<LeadRow[]>(leads);
  const [todosState, setTodosState] = useState<LeadTodoRow[]>(todos);

  // goodmorning-fixes: REMOVED the sync effects that were resetting leadsState/todosState
  // back to the `leads`/`todos` props (which are [] from the page for security).
  // These effects fired on every re-render (when the prop reference changed), undoing
  // the fetch: leads appeared for a second, then disappeared back to 0.
  // The page intentionally passes [] — the fetch effect is the sole source of truth.

  // ── Todo mapping (rental_id / phone / user_id matching) ──
  const { getTodosForLead } = useTodosMapping(todosState);

  // ── Compute SLA signals for a lead (used by LeadCard / LeadList / LeadBoard) ──
  const getLeadSignals = useCallback(
    (lead: LeadRow): LeadSignal[] => {
      try {
        return computeLeadSignals(lead, todosState);
      } catch {
        return [];
      }
    },
    [todosState]
  );

  // ── Todo CRUD handler (passed to useLeadActions for optimistic updates) ──
  const handleTodoUpdate = useCallback(
    (action: "toggle" | "delete" | "add", todoId: string, todo?: LeadTodoRow) => {
      setTodosState((prev) => {
        if (action === "toggle") {
          return prev.map((t) =>
            t.id === todoId ? { ...t, status: t.status === "done" ? "pending" : "done" } : t
          );
        }
        if (action === "delete") return prev.filter((t) => t.id !== todoId);
        if (action === "add" && todo) return [todo, ...prev];
        return prev;
      });
    },
    []
  );

  // ── Filters + derived data (extracted to useLeadFilters hook) ──
  const {
    searchQuery, setSearchQuery,
    sortMode, setSortMode,
    mode, setMode,
    activeStageFilter,
    activeSegment, setActiveSegment,
    sourceFilter, setSourceFilter,
    ownerFilter, setOwnerFilter,
    filterFlags,
    enrichedLeads,
    sortedLeads,
    pipelineStages,
    segmentChips,
    leadsByStage,
    availableSources,
    availableOwners,
    hasActiveFilters,
    handleFilterFlagsChange,
    handleStageSelect,
    handleResetAllFilters,
  } = useLeadFilters({
    leadsState,
    todosState,
    getTodosForLead,
    getLeadSignals,
  });

  // ── Selected lead (derived from sortedLeads + selectedId) ──
  const selectedLead = useMemo(
    () => (selectedId ? sortedLeads.find((l) => l.user_id === selectedId) ?? null : null),
    [selectedId, sortedLeads]
  );

  // ── Selected lead's todos (for the detail drawer) ──
  const selectedLeadTodos = useMemo(
    () => (selectedLead ? getTodosForLead(selectedLead) : []),
    [selectedLead, getTodosForLead]
  );

  // ── View mode (list/board) ──
  const [viewMode, setViewMode] = useState<"list" | "board">("list");

  // ── Notes state for the currently selected lead ──
  // Notes are loaded/added on-demand; we keep them per-render so the
  // LeadDetailContent drawer can show newly added notes immediately.
  // The actual persistence is handled by useLeadActions.handleAddNote
  // (which calls createLeadNote server action).
  const [notesState, setNotesState] = useState<LeadDetailContentNote[]>([]);

  // Reset notes when selection changes
  useEffect(() => {
    setNotesState([]);
  }, [selectedId]);

  // ── Lead selection handler (wraps setSelectedId) ──
  const handleSelectLead = useCallback((lead: LeadRow) => {
    setSelectedId(lead.user_id);
  }, []);

  // ── Add note wrapper — calls hook's handleAddNote and updates local state ──
  // handleAddNoteFromHook is renamed on import to avoid clash; we wrap it
  // so the LeadDetailContent drawer sees an updated notes list immediately.

  // ── Async actions (extracted to useLeadActions hook) ──
  // dismiss, todo CRUD, notes, drawer actions, KPI fetch — all live in the hook.
  const {
    dismissDialogOpen,
    setDismissDialogOpen,
    dismissLead,
    kpis,
    fetchKpis,
    handleDismissLeadRequest,
    handleDismissLeadConfirm,
    handleCreateTodo,
    handleToggleTodo,
    handleDeleteTodo,
    handleAddNote: handleAddNoteFromHook,
    handleDrawerAction,
    DISMISS_REASONS,
  } = useLeadActions({
    slug,
    crewId,
    selectedLead,
    leadsState,
    dbUser,
    passwordAuthOwnerId,
    onTodoUpdate: handleTodoUpdate,
    onDismissOptimistic: (leadId) => {
      setLeadsState((prev) => prev.filter((l) => l.user_id !== leadId));
    },
    onClearSelection: () => setSelectedId(null),
    router,
  });

  // ── Wrap handleAddNote so the new note shows up in notesState immediately ──
  const handleAddNote = useCallback(
    async (text: string) => {
      const newNote = await handleAddNoteFromHook(text);
      if (newNote) {
        setNotesState((prev) => [
          {
            id: newNote.id,
            text: newNote.text,
            created_at: newNote.created_at,
            created_by: newNote.created_by ?? null,
          },
          ...prev,
        ]);
      }
    },
    [handleAddNoteFromHook]
  );

  // ── Fetch KPIs when mode changes ──
  // LR3-012 FIX: guard with auth check so KPIs don't flash 0→real on initial load.
  // Was: fired immediately before auth resolved, got zeros, then re-fired after auth.
  useEffect(() => {
    if (!isAuthed || authLoading || shouldShowPassword) return;
    void fetchKpis(mode);
  }, [mode, fetchKpis, isAuthed, authLoading, shouldShowPassword]);

  // ── NEW (polish 2026-07-30): fetch leads AFTER auth passes ──
  // The page now passes empty leads/todos arrays (security fix — see page.tsx
  // comment). We fetch the real data here once the user is authed, then
  // setLeadsState + setTodosState so the existing hooks (useLeadFilters,
  // useLeadActions) react to the new data.
  //
  // `isAuthed` = user is either logged in via Telegram WebApp (dbUser) OR
  // entered the analytics password (passwordAuthOwnerId). We don't fetch
  // while authLoading is true (AppContext still resolving) or while the
  // password entry screen is showing.
  const isAuthed = !!(dbUser?.user_id || passwordAuthOwnerId);
  const leadsFetchedRef = useRef(false);
  // HIGH FIX #8: reset the fetch ref when slug changes so navigating from
  // crew A to crew B actually fetches crew B's leads (was stuck on crew A
  // because the ref was never cleared)
  // LR3-019 FIX: also reset on auth-source change (dbUser ↔ passwordAuthOwnerId).
  // Was: only reset on slug change — if cookie expired mid-session and user
  // entered password, leadsFetchedRef stayed true and leads were never re-fetched.
  const authSource = dbUser?.user_id || passwordAuthOwnerId || "";
  useEffect(() => {
    leadsFetchedRef.current = false;
  }, [slug, authSource]);
  useEffect(() => {
    // goodmorning-fixes: auth guard with isAuthed in deps so effect re-fires when auth completes.
    // Previously removed the guard entirely → fetch fired during authLoading, succeeded,
    // but then the (now-removed) sync effect reset state to []. Now that sync effect is gone,
    // we can safely add the guard back. The guard prevents unnecessary fetches during
    // the password gate, and isAuthed in deps ensures re-fire when auth state changes.
    if (!isAuthed || authLoading || shouldShowPassword) return;
    if (leadsFetchedRef.current) return;  // dedupe — only fetch once per slug

    let cancelled = false;
    (async () => {
      try {
        const { getFranchizeLeads } = await import("@/app/franchize/server-actions/leads");
        const result = await getFranchizeLeads(
          slug,
          dbUser?.user_id || passwordAuthOwnerId || "",
          !!passwordAuthOwnerId,
        );
        if (cancelled) return;
        if (result.success) {
          leadsFetchedRef.current = true;
          const fetchedLeads = (result.leads || []).filter(Boolean) as LeadRow[];
          const fetchedTodos = (result.todos || []).filter(Boolean) as LeadTodoRow[];
          setLeadsState(fetchedLeads);
          setTodosState(fetchedTodos);
        } else {
          console.error("[LeadsClient] getFranchizeLeads failed:", result.error);
        }
      } catch (e) {
        if (!cancelled) console.error("[LeadsClient] getFranchizeLeads error:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthed, authLoading, shouldShowPassword, slug]);

  // ── Password gate ──
  // Must be AFTER all hooks (useState/useEffect/useMemo/useCallback) to satisfy
  // React rules-of-hooks. Same pattern as RentalsAnalyticsClient.
  if (authLoading) {
    const accentMain = isAuto ? "var(--franchize-accent-main)" : accentColor;
    const bgBase = isAuto ? "var(--franchize-bg-base)" : bgColor;
    return <AnalyticsLoading accentMain={accentMain} bgBase={bgBase} />;
  }
  if (shouldShowPassword) {
    return (
      <AnalyticsPasswordEntry
        crewName={slug}
        slug={slug}
        onAuthenticated={(ownerId) => setPasswordAuthOwnerId(ownerId)}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <LeadsAppShell T={T}>
      <div className="space-y-5">
        {/* Mode tabs + "Без операторов" toggle */}
        <ModeTabsRow
          mode={mode}
          onModeChange={setMode}
          hideOperatorPlaceholders={filterFlags.hideOperatorPlaceholders}
          onToggleHideOperators={() =>
            handleFilterFlagsChange({
              hideOperatorPlaceholders: !filterFlags.hideOperatorPlaceholders,
            })
          }
          T={T}
        />

        {/* 1. Toolbar */}
        <LeadsToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          sortValue={sortMode}
          onSortChange={(v) => setSortMode(v as SortModeV2)}
          sourceValue={sourceFilter}
          onSourceChange={setSourceFilter}
          availableSources={availableSources}
          ownerValue={ownerFilter}
          onOwnerChange={setOwnerFilter}
          availableOwners={availableOwners}
          stageValue={activeStageFilter || "all"}
          onStageChange={(v) => {
            // useLeadFilters exports handleStageSelect which toggles: if the
            // same stage is clicked again, it clears the filter (returns null).
            if (v === "all") {
              // Clicked "all" — if a stage is currently active, clear it by
              // toggling that stage. If none active, no-op.
              if (activeStageFilter) handleStageSelect(activeStageFilter);
            } else {
              handleStageSelect(v);
            }
          }}
          filterFlags={filterFlags}
          onFilterFlagsChange={handleFilterFlagsChange}
          viewMode={viewMode}
          onViewModeChange={(v) => setViewMode(v as "list" | "board")}
          onExport={undefined}  // LOW #21: disabled until CSV export is implemented
          T={T}
        />

        {/* 2. KPI cards */}
        {kpis && <LeadsKPICards kpis={kpis} T={T} />}

        {/* 3. Pipeline funnel */}
        <PipelineFunnelBar
          stages={pipelineStages}
          activeStage={activeStageFilter}
          onStageSelect={handleStageSelect}
          T={T}
        />

        {/* 4. Segment chips */}
        <SegmentChips
          segments={segmentChips}
          activeSegment={activeSegment}
          onChange={setActiveSegment}
          T={T}
        />

        {/* 5. Lead list OR board */}
        <AnimatePresence mode="wait">
          {viewMode === "board" ? (
            <motion.div
              key="board-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <LeadBoard
                leadsByStage={leadsByStage}
                selectedLeadId={selectedId}
                onSelectLead={handleSelectLead}
                getLeadSignals={getLeadSignals}
                T={T}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <LeadList
                leads={sortedLeads}
                selectedLeadId={selectedId}
                onSelectLead={handleSelectLead}
                onDismissLead={handleDismissLeadRequest}
                getTodosForLead={getTodosForLead}
                getLeadSignals={getLeadSignals}
                T={T}
                crewId={crewId}
                slug={slug}
                emptyState={
                  <EmptyState
                    hasFilters={hasActiveFilters}
                    searchQuery={searchQuery}
                    onReset={handleResetAllFilters}
                    T={T}
                  />
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 6. Detail panel — desktop (right-side drawer overlay) */}
        <div className="hidden lg:block">
          <AnimatePresence>
            {selectedLead && (
              <LeadDetailContent
                key={selectedLead.user_id}
                lead={selectedLead}
                todos={selectedLeadTodos}
                notes={notesState}
                slug={slug}
                T={T}
                onClose={() => setSelectedId(null)}
                onAction={handleDrawerAction}
                onCreateTodo={handleCreateTodo}
                onToggleTodo={handleToggleTodo}
                onDeleteTodo={handleDeleteTodo}
                onAddNote={handleAddNote}
                onDismissLead={() => handleDismissLeadRequest(selectedLead.user_id)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* 6. Detail panel — mobile (bottom sheet wrapping LeadDetailContent) */}
        <MobileLeadSheet
          open={!!selectedLead}
          onClose={() => setSelectedId(null)}
          title={selectedLead?.full_name || selectedLead?.phone || undefined}
          T={T}
        >
          {selectedLead && (
            <LeadDetailContent
              key={`mobile-${selectedLead.user_id}`}
              lead={selectedLead}
              todos={selectedLeadTodos}
              notes={notesState}
              slug={slug}
              T={T}
              onClose={() => setSelectedId(null)}
              onAction={handleDrawerAction}
              onCreateTodo={handleCreateTodo}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
              onAddNote={handleAddNote}
              onDismissLead={() => handleDismissLeadRequest(selectedLead.user_id)}
              asSheetChild
            />
          )}
        </MobileLeadSheet>

        {/* 7. Dismiss dialog */}
        <DismissLeadDialog
          open={dismissDialogOpen}
          lead={dismissLead}
          reasons={DISMISS_REASONS || []}
          T={T}
          onSubmit={handleDismissLeadConfirm}
          onCancel={() => {
            // Closing the dialog is enough — useLeadActions internally tracks
            // dismissLeadId and clears it on next open. We just toggle the
            // open state here.
            setDismissDialogOpen(false);
          }}
        />
      </div>
    </LeadsAppShell>
  );
}

// ── Mode tabs + "Без операторов" toggle row ─────────────────────────────────

interface ModeTabsProps {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  hideOperatorPlaceholders: boolean;
  onToggleHideOperators: () => void;
  T: ThemeTokens;
}

function ModeTabsRow({
  mode,
  onModeChange,
  hideOperatorPlaceholders,
  onToggleHideOperators,
  T,
}: ModeTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Mode tabs */}
      <div
        className="inline-flex rounded-full border p-1"
        style={{ borderColor: T.border, background: T.bgCard }}
        role="tablist"
        aria-label="Режим пайплайна"
      >
        {MODE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.value;
          return (
            <motion.button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onModeChange(tab.value)}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition"
              style={
                active
                  ? {
                      background: tab.color,
                      color: T.accentContrast,
                      boxShadow: `0 6px 18px ${tab.color}40`,
                    }
                  : { color: T.textMuted }
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{tab.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* "Без операторов" toggle */}
      <button
        type="button"
        onClick={onToggleHideOperators}
        aria-pressed={hideOperatorPlaceholders}
        title="Скрывать лиды, созданные операторами как заглушки (нет реальной активности)"
        className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition"
        style={
          hideOperatorPlaceholders
            ? {
                borderColor: `${T.accent}40`,
                background: `${T.accent}14`,
                color: T.accent,
              }
            : { borderColor: T.border, background: T.bgCard, color: T.textMuted }
        }
      >
        <EyeOff className="h-3.5 w-3.5" aria-hidden />
        Без операторов
      </button>
    </div>
  );
}
