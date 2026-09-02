// /app/franchize/[slug]/leads/components/LeadBoard.tsx
"use client";

import { useMemo } from "react";
import { Avatar } from "./Avatar";
import { relativeTime, metaFor, getInitials, isAvitoLead, AVITO_COLOR, AVITO_BG } from "../leads-utils";
import { BOARD_COLUMNS, AVITO_COLUMN_STAGES } from "../leads-constants";
import {
  getLeadHandling,
  isHandlingTodo,
  isCallbackOverdue,
  formatCallbackTime,
} from "../lib/lead-handling";
import type {LeadRow, LeadTodoRow} from "../leads-types";
import type { LeadPriority } from "../lib/lead-priority";

interface LeadBoardProps {
  leads: LeadRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDismiss: (id: string) => void;
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[];
  /** Priority Score 0–100 (ТЗ): сортировка внутри колонок + score-бейджи. */
  priorityMap?: Map<string, LeadPriority>;
  T: any;
}

/**
 * Kanban board — horizontal column layout on ALL viewport sizes.
 *
 * Old behavior: `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5`
 * On mobile (<640px) this fell back to `grid-cols-1` → all 5 stages stacked
 * vertically as a long list. The user said "previously it was columns even on
 * mobile" — the intent has always been a side-by-side kanban.
 *
 * New behavior: `flex overflow-x-auto` with each column `min-w-[260px]` on
 * mobile (sm: `min-w-[280px]`, lg: `min-w-[260px]`). All 5 stages are
 * side-by-side horizontally and the user swipes left/right to navigate
 * between them. Each column scrolls vertically independently.
 *
 * This is the standard kanban UX (Trello, Linear, Notion) — narrow columns
 * with horizontal swipe, not a vertical list of stages.
 */
export function LeadBoard({ leads, selectedId, onSelect, onDismiss, getTodosForLead, priorityMap, T }: LeadBoardProps) {
  const columns = useMemo(() => {
    // Group by the COMPUTED pipeline stage (stageKey), not the raw DB stage —
    // see groupLeadsForBoard(): raw stages like "viewed"/"clicked" used to
    // collapse everything into the «Новые» fallback column.
    //
    // ВИРТУАЛЬНАЯ колонка «Авито» (первая): авито-лиды на дотрудовой стадии
    // (new/needs_contact) собираются сюда, чтобы не растворялись в общем
    // потоке; как только сделка доходит до договора — обычная колонка воронки.
    const map: Record<string, LeadRow[]> = {};
    for (const c of BOARD_COLUMNS) map[c.key] = [];
    for (const l of leads) {
      const stage = l.stageKey || "new";
      const key = isAvitoLead(l) && AVITO_COLUMN_STAGES.has(stage) ? "avito" : stage;
      if (!map[key]) map[key] = [];
      map[key].push(l);
    }
    // ТЗ: внутри колонки лиды стоят по Priority Score (убыв.) — «горячие»
    // и свежие сверху, дальше — по свежести активности (LIFO tie-break).
    if (priorityMap) {
      for (const key of Object.keys(map)) {
        map[key].sort((a, b) => {
          const aP = priorityMap.get(a.user_id)?.score ?? 0;
          const bP = priorityMap.get(b.user_id)?.score ?? 0;
          if (aP !== bP) return bP - aP;
          return new Date(b.lastSeenAt || b.createdAt || 0).getTime()
            - new Date(a.lastSeenAt || a.createdAt || 0).getTime();
        });
      }
    }
    return map;
  }, [leads, priorityMap]);

  return (
    <div
      className="pb-2"
      style={{
        display: "flex",
        gap: "12px",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "thin",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {BOARD_COLUMNS.map(({ key, label, color }) => {
        const colLeads = columns[key] || [];
        return (
          <div
            key={key}
            className="rounded-2xl border"
            style={{
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              width: "260px",
              maxHeight: "calc(100vh - 280px)",
              minHeight: "320px",
              borderColor: T.border,
              backgroundColor: T.bgElevated,
            }}
          >
            {/* Column header — sticky at top of column */}
            <div
              className="flex shrink-0 items-center justify-between border-b p-3"
              style={{ borderColor: T.border }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="truncate text-xs font-bold" style={{ color: T.text }}>{label}</span>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: T.borderSoft, color: T.text }}
              >
                {colLeads.length}
              </span>
            </div>

            {/* Column body — scrolls independently */}
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {colLeads.length === 0 && (
                <div
                  className="rounded-xl border border-dashed p-4 text-center text-[11px]"
                  style={{ borderColor: T.borderSoft, color: T.textFaint }}
                >
                  Пусто
                </div>
              )}
              {colLeads.map((lead) => {
                const todos = getTodosForLead(lead);
                const pending = todos.filter((t) => t.status !== "done" && !isHandlingTodo(t)).length;
                const handling = getLeadHandling(todos);
                const meta = metaFor(lead.source);
                const pr = priorityMap?.get(lead.user_id);
                return (
                  <div
                    key={lead.user_id}
                    onClick={() => onSelect(selectedId === lead.user_id ? null : lead.user_id)}
                    className="cursor-pointer rounded-xl border p-2.5 transition hover:shadow-sm"
                    style={{
                      borderColor: T.border,
                      backgroundColor: T.bgCard,
                      boxShadow: selectedId === lead.user_id ? `0 0 0 2px ${T.borderActive}33` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={lead.full_name} source={lead.source} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold" style={{ color: T.text }}>
                          {lead.full_name || "Без имени"}
                        </p>
                        <p className="truncate text-[10px]" style={{ color: T.textMuted }}>
                          {lead.phone || lead.username || relativeTime(lead.createdAt)}
                        </p>
                      </div>
                      {/* Priority Score (ТЗ) — score-бейдж: 🔥 для горячих (≥70),
                          ⚡ для свежих (≤60 мин). Мини-версия лайбочки карточки. */}
                      {pr && (pr.isHot || pr.isFresh) && (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
                          style={
                            pr.isHot
                              ? { backgroundColor: "#ef444420", color: "#ef4444" }
                              : { backgroundColor: "#3b82f620", color: "#3b82f6" }
                          }
                          title={`Индекс приоритета ${pr.score}/100${pr.channelMultiplier > 1 ? ` (канал ×${pr.channelMultiplier})` : ""}`}
                        >
                          {pr.isHot ? "🔥" : "⚡"}{pr.score}
                        </span>
                      )}
                      {pending > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 text-[9px] font-bold text-amber-400">
                          {pending}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-medium"
                        style={{ backgroundColor: meta.bg, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {isAvitoLead(lead) && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                          style={{ backgroundColor: AVITO_BG, color: AVITO_COLOR }}
                          title="Лид из чата Авито — ответить можно в чате (ссылка в карточке лида)"
                        >
                          Авито
                        </span>
                      )}
                      {/* 📞 Назначенный перезвон — виден прямо на канбан-карточке.
                          Просроченный — красный, подоспевший — янтарный. */}
                      {handling.callback && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                          style={
                            isCallbackOverdue(handling.callback)
                              ? { backgroundColor: "#ef444420", color: "#ef4444" }
                              : { backgroundColor: "#f59e0b20", color: "#f59e0b" }
                          }
                          title={handling.callback.note || "Назначен перезвон"}
                        >
                          📞 {formatCallbackTime(handling.callback.dueAt)}
                        </span>
                      )}
                      {/* ✅ Отработан — спокойная зелёная отметка. */}
                      {handling.handled && !handling.callback && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-medium"
                          style={{ backgroundColor: "#22c55e20", color: "#22c55e" }}
                          title="Лид отработан"
                        >
                          ✅ Обработан
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
