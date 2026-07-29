"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
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
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
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

// Lib
import {
  computeLeadStage,
  computeQrStatus,
  PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
} from "../lib/pipeline-stages";
import { computeLeadSignals, isHotLead } from "../lib/sla-signals";
// DISMISS_REASONS now in useLeadActions hook
import { dismissLeadWithReason } from "@/app/franchize/server-actions/leads-dismiss";
// getLeadsKpis now in useLeadActions hook
// createLeadNote now in useLeadActions hook

// Components
import { LeadsAppShell } from "./LeadsAppShell";
import { LeadsToolbar } from "./LeadsToolbar";
import { LeadsKPICards } from "./LeadsKPICards";
import { PipelineFunnelBar, type PipelineStage } from "./PipelineFunnelBar";
import { SegmentChips, type SegmentChip } from "./SegmentChips";
import { LeadList } from "./LeadList";
import { LeadBoard } from "./LeadBoard";
import { LeadDetailContent } from "./LeadDetailContent";
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

  // ── Selected lead's todos (for the detail drawer) ──
  const selectedLeadTodos = useMemo(
    () => (selectedLead ? getTodosForLead(selectedLead) : []),
    [selectedLead, getTodosForLead]
  );

  // ── Dismiss dialog lead object ──
  // dismissLead now comes from useLeadActions hook

  // ── View mode (list/board) ──
  const [viewMode, setViewMode] = useState<"list" | "board">("list");

  // ── Fetch KPIs when mode changes ──
  useEffect(() => {
    void fetchKpis(mode);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

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
          onStageChange={(v) => setActiveStageFilter(v === "all" ? null : (v as StageKey))}
          filterFlags={filterFlags}
          onFilterFlagsChange={handleFilterFlagsChange}
          viewMode={viewMode}
          onViewModeChange={(v) => setViewMode(v as "list" | "board")}
          onExport={() => {
            // Future: CSV export
          }}
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
            setDismissDialogOpen(false);
            setDismissLeadId(null);
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
