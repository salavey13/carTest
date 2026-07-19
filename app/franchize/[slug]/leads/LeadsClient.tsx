"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, X, Bike } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";

// Import extracted components
import { LeadsKPICards } from "./components/LeadsKPICards";
import { LeadsToolbar } from "./components/LeadsToolbar";
import { LeadList } from "./components/LeadList";
import { LeadBoard } from "./components/LeadBoard";
import { MobileLeadSheet } from "./components/MobileLeadSheet";
import { EmptyState } from "./components/EmptyState";
import { LeadDetailContent } from "./components/LeadDetailContent";
import { Avatar } from "./components/Avatar";
import { SourceBadge } from "./components/SourceBadge";

// Import constants
import {
  type Segment,
  type ViewMode,
  type SortMode,
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
    storedPassword,
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

  // Segment counts for toolbar tabs
  const segmentCounts = useMemo(() => ({
    all: leads.length,
    hot: hot.length,
    warm: warm.length,
    verified: verified.length,
    troubled: leads.filter((l) => l.troubled).length,
  }), [leads, hot, warm, verified]);

  // Scroll to selected lead
  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-lead-id="${selectedId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedId]);

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
        segmentCounts={segmentCounts}
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
                    <LeadDetailContent lead={selectedLead} todos={getTodosForLead(selectedLead)} crewId={crewId} slug={slug} T={T} />
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
            <LeadDetailContent lead={selectedLead} todos={getTodosForLead(selectedLead)} crewId={crewId} slug={slug} T={T} />
          </MobileLeadSheet>
        );
      })()}
    </div>
  );
}