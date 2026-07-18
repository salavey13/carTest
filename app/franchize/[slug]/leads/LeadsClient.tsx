"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Lock, X, Bike } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { validateAnalyticsPassword } from "@/app/franchize/server-actions/rentals-dashboard";
import type { LeadRow, LeadTodoRow, LeadRentalRow, LeadSaleRow } from "@/app/franchize/server-actions/leads";

// Import extracted components
import { LeadsKPICards } from "./components/LeadsKPICards";
import { LeadsToolbar } from "./components/LeadsToolbar";
import { LeadCard } from "./components/LeadCard";
import { LeadList } from "./components/LeadList";
import { LeadBoard } from "./components/LeadBoard";
import { EmptyState } from "./components/EmptyState";
import { LeadDetailContent } from "./components/LeadDetailContent";
import { Avatar } from "./components/Avatar";
import { SourceBadge } from "./components/SourceBadge";

// Import constants
import {
  SOURCE_META,
  SEGMENT_META,
  type Segment,
  type ViewMode,
  type SortMode,
  BOARD_COLUMNS,
} from "./leads-constants";
import {
  relativeTime,
  formatDate,
  temperatureColor,
  temperatureLabel,
  isToday,
  metaFor,
  fmtMoney,
  getInitials,
} from "./leads-utils";

// Import hooks
import { useTodosMapping, useFilteredSortedLeads } from "./hooks/useLeadsData";
import { useTheme } from "./hooks/useTheme";
import { usePasswordGate } from "./hooks/usePasswordGate";
import { useVirtualList } from "./hooks/useVirtualList";

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

  const { dbUser } = useAppContext();
  const T = useTheme({ isAuto, isLightTheme, textColor, bgColor, accentColor });

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
    handlePasswordSubmit,
  } = usePasswordGate(slug, isInTelegram, dbUser?.user_id);

  // Todo mapping
  const { getTodosForLead } = useTodosMapping(todos);

  // Filtered, sorted, categorized leads
  const {
    sortedLeads,
    hot,
    verified,
    warm,
    availableSources,
    hasFilters,
    boardColumns,
  } = useFilteredSortedLeads(leads, debouncedSearchQuery, filterSource, segment, getTodosForLead, sortMode);

  // Scroll to selected lead
  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-lead-id="${selectedId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedId]);

  // Dismiss lead
  const handleDismissLead = async (leadId: string) => {
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, dismissLead: true, slug }),
      });
      if (!resp.ok) { alert("Не удалось убрать лид. Попробуйте позже."); return; }
      window.location.reload();
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
      <LeadsKPICards leads={leads} hot={hot} verified={verified} todos={todos} T={T} />

      <LeadsToolbar
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        sortMode={sortMode} setSortMode={setSortMode}
        filterSource={filterSource} setFilterSource={setFilterSource}
        availableSources={availableSources}
        segment={segment} setSegment={setSegment}
        viewMode={viewMode} setViewMode={setViewMode}
        T={T} isAuto={isAuto}
      />

      {viewMode === "board" ? (
        <LeadBoard
          leads={sortedLeads}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(selectedId === id ? null : id)}
          onDismiss={handleDismissLead}
          getTodosForLead={getTodosForLead}
          T={T}
        />
      ) : sortedLeads.length === 0 ? (
        <EmptyState hasFilters={hasFilters} T={T} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* List */}
          <div className={`space-y-3 ${selectedId ? "lg:col-span-5" : "lg:col-span-12"}`}>
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

          {/* Desktop detail panel */}
          {selectedId && (
            <div className="hidden lg:block lg:col-span-7">
              <div className="sticky top-24 max-h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border p-4" style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: T.shadow }}>
                <div className="mb-4 flex items-start gap-3">
                  {(() => {
                    const selectedLead = sortedLeads.find(l => l.user_id === selectedId);
                    if (!selectedLead) return null;
                    return (
                      <>
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
                      </>
                    );
                  })()}
                </div>
                {(() => {
                  const selectedLead = sortedLeads.find(l => l.user_id === selectedId);
                  if (!selectedLead) return null;
                  return <LeadDetailContent lead={selectedLead} todos={getTodosForLead(selectedLead)} crewId={crewId} slug={slug} T={T} />;
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}