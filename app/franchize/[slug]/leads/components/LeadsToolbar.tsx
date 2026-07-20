"use client";

import { Search, X, LayoutList, Columns3, Download, Filter, ShieldAlert } from "lucide-react";
import { Users, Flame, CheckCircle, Phone, AlertCircle } from "lucide-react";
import { type Segment } from "../leads-constants";

const SEGMENT_META: Record<Segment, { label: string; icon: any; color: string }> = {
  all: { label: "Все", icon: Users, color: "#64748b" },
  hot: { label: "Горячие", icon: Flame, color: "#ef4444" },
  verified: { label: "Клиенты", icon: CheckCircle, color: "#10b981" },
  warm: { label: "Заявки", icon: Phone, color: "#3b82f6" },
  troubled: { label: "Проблемные", icon: AlertCircle, color: "#dc2626" },
};

export function LeadsToolbar({
  searchQuery,
  setSearchQuery,
  sortMode,
  setSortMode,
  filterSource,
  setFilterSource,
  availableSources,
  segment,
  setSegment,
  viewMode,
  setViewMode,
  segmentCounts,
  hidePlaceholders,
  setHidePlaceholders,
  T,
  isAuto,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  sortMode: "recent" | "urgent" | "name" | "spent";
  setSortMode: (v: "recent" | "urgent" | "name" | "spent") => void;
  filterSource: string;
  setFilterSource: (v: string) => void;
  availableSources: string[];
  segment: Segment;
  setSegment: (v: Segment) => void;
  viewMode: "list" | "board";
  setViewMode: (v: "list" | "board") => void;
  segmentCounts?: Partial<Record<Segment, number>>;
  hidePlaceholders: boolean;
  setHidePlaceholders: (v: boolean) => void;
  T: any;
  isAuto: boolean;
}) {
  return (
    <div
      className="sticky top-0 z-10 -mx-4 space-y-3 border-b px-4 py-3 backdrop-blur-md sm:rounded-2xl sm:border"
      style={{ backgroundColor: isAuto ? `color-mix(in srgb, var(--franchize-bg-base) 88%, transparent)` : T.bgCard, borderColor: T.border }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: T.textFaint }} />
          <input
            type="text"
            placeholder="Имя, телефон, байк, Telegram…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border py-2.5 pl-10 pr-9 text-sm outline-none transition focus:ring-2 focus:ring-offset-0"
            style={{
              backgroundColor: T.inputBg,
              borderColor: T.inputBorder,
              color: T.text,
              "--tw-ring-color": T.borderActive,
            } as React.CSSProperties}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 transition hover:opacity-80" style={{ color: T.textFaint }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border p-1" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
            <button onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${viewMode === "list" ? "" : "hover:opacity-70"}`}
              style={viewMode === "list" ? { backgroundColor: T.accent, color: T.accentContrast } : { color: T.textMuted }}>
              <LayoutList className="h-3.5 w-3.5" /> Список
            </button>
            <button onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${viewMode === "board" ? "" : "hover:opacity-70"}`}
              style={viewMode === "board" ? { backgroundColor: T.accent, color: T.accentContrast } : { color: T.textMuted }}>
              <Columns3 className="h-3.5 w-3.5" /> Воронка
            </button>
          </div>

          <button
            onClick={() => setHidePlaceholders(!hidePlaceholders)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              hidePlaceholders ? '' : 'opacity-50'
            }`}
            style={{
              borderColor: hidePlaceholders ? '#f59e0b40' : T.border,
              color: hidePlaceholders ? '#f59e0b' : T.textMuted,
              backgroundColor: hidePlaceholders ? '#f59e0b10' : 'transparent',
            }}
            title={hidePlaceholders ? 'Показать заглушки операторов' : 'Скрыть заглушки операторов'}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {hidePlaceholders ? 'Без операторов' : 'С операторами'}
          </button>

          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
            className="rounded-xl border px-3 py-2 text-xs outline-none"
            style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}>
            <option value="all">Все источники</option>
            {availableSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "recent" | "urgent" | "name" | "spent")}
            className="rounded-xl border px-3 py-2 text-xs outline-none"
            style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}>
            <option value="recent">Свежие</option>
            <option value="urgent">🔥 Срочные</option>
            <option value="spent">💰 По выручке</option>
            <option value="name">А → Я</option>
          </select>

          <button disabled
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium opacity-50"
            style={{ borderColor: T.border, color: T.textMuted }}>
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {(Object.keys(SEGMENT_META) as Segment[]).map((key) => {
          const meta = SEGMENT_META[key];
          const Icon = meta.icon;
          const active = segment === key;
          const count = segmentCounts?.[key];
          return (
            <button key={key} onClick={() => setSegment(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${active ? "" : "hover:opacity-80"}`}
              style={active ? { backgroundColor: meta.color + "15", color: meta.color, borderColor: meta.color + "40" } : { color: T.textMuted, borderColor: "transparent" }}>
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
              {count !== undefined && (
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                  style={active ? { backgroundColor: meta.color + "30", color: meta.color } : { backgroundColor: T.borderSoft, color: T.textFaint }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}