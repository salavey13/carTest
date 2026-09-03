// /app/franchize/[slug]/leads/components/LeadTableView.tsx
"use client";

//
// NEW (iter6, user request): "Таблица" view mode for the leads page — the same
// table-view UX the operator already knows from the analytics CSV modal:
//   • sticky header + zebra rows + hover highlight
//   • tabular-nums for money, right-aligned
//   • horizontal scroll on mobile (swipe), full width on desktop
//   • click a row → opens the lead detail (same as clicking a LeadCard)
//   • click a column header → sorts (synced with the toolbar sort dropdown)
//   • footer with row count + total revenue
//
// The kanban (Воронка) and the card list stay as they are; this is a third
// view aimed at scanning many leads fast.
//

import { useMemo } from "react";
import { ArrowDown, ArrowUp, Bike, CircleDollarSign, Table2, ExternalLink, Flame, Zap, PhoneCall, StickyNote, History } from "lucide-react";
import type { LeadRow, LeadTodoRow } from "../leads-types";
import { relativeTime, metaFor, isAvitoLead, AVITO_COLOR, AVITO_BG } from "../leads-utils";
import { STAGE_LABELS as PIPELINE_STAGE_LABELS, STAGE_COLORS } from "../lib/pipeline-stages";
import { getLeadHandling, isHandlingTodo, formatCallbackTime, isCallbackOverdue } from "../lib/lead-handling";
import { type SortMode } from "../leads-constants";
import { type LeadPriority } from "../lib/lead-priority";
import { Avatar } from "./Avatar";
import type { ThemeTokens } from "../hooks/useTheme";

interface LeadTableViewProps {
  leads: LeadRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[];
  /** Priority Score 0–100 (ТЗ): колонка «Приоритет» + лайбочки. */
  priorityMap?: Map<string, LeadPriority>;
  /** «Прочитать заметки» — открывает шторку лида сразу на заметках. */
  onReadNotes?: (leadId: string) => void;
  sortMode: SortMode;
  onSortChange?: (mode: SortMode) => void;
  T: ThemeTokens;
}

/** Pipeline stage (stageKey) → display label + tint. Falls back to the raw key. */
function stageMeta(stage: string | null | undefined): { label: string; color: string } {
  const key = stage || "new";
  const label = (PIPELINE_STAGE_LABELS as Record<string, string>)[key];
  const color = (STAGE_COLORS as Record<string, string>)[key];
  if (label) return { label, color: color || "#64748b" };
  return { label: key, color: "#64748b" };
}

export function LeadTableView({
  leads,
  selectedId,
  onSelect,
  getTodosForLead,
  priorityMap,
  onReadNotes,
  sortMode,
  onSortChange,
  T,
}: LeadTableViewProps) {
  // Precompute per-lead derived values once (pending todos, spent, activity, priority, handling).
  const rows = useMemo(
    () =>
      leads.map((lead) => {
        const todos = getTodosForLead(lead);
        return {
          lead,
          priority: priorityMap?.get(lead.user_id),
          // handling-строки («отработан»/«перезвонить») считаем отдельно —
          // в колонке задач они не учитываются, у них своя колонка «Работа».
          pendingTodos: todos.filter((t) => t.status !== "done" && !isHandlingTodo(t)).length,
          totalTodos: todos.filter((t) => !isHandlingTodo(t)).length,
          handling: getLeadHandling(todos),
          spent: Number(lead.totalSpent || 0),
          activity: lead.lastSeenAt || lead.createdAt || "",
          // «Изменено» — дата последней модификации лида (заметка/туду/стадия).
          // fallback на активность, чтобы колонка не пустовала у лидов без
          // модификаций; чистый null показываем прочерком ниже.
          modified: lead.lastModifiedAt || "",
        };
      }),
    [leads, getTodosForLead, priorityMap],
  );

  const totalRevenue = useMemo(() => rows.reduce((sum, r) => sum + r.spent, 0), [rows]);

  const fmtMoney = (n: number): string =>
    n > 0 ? n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽" : "—";

  /** Header cell for sortable columns. */
  const SortHeader = ({
    label,
    mode,
    align = "left",
  }: {
    label: string;
    mode: SortMode;
    align?: "left" | "right" | "center";
  }) => {
    const active = sortMode === mode;
    const clickable = !!onSortChange;
    return (
      <th
        onClick={clickable ? () => onSortChange?.(mode) : undefined}
        className={`whitespace-nowrap border-b-2 border-r px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide ${
          clickable ? "cursor-pointer select-none" : ""
        }`}
        style={{
          borderColor: T.border,
          color: active ? T.text : T.textMuted,
          textAlign: align,
          backgroundColor: T.bgElevated,
        }}
        title={clickable ? "Сортировать" : undefined}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active && sortMode === "recent" ? null : null}
          {active && (mode === "name") ? <ArrowUp className="h-3 w-3" /> : null}
          {active && (mode === "spent" || mode === "recent" || mode === "priority" || mode === "urgent") ? <ArrowDown className="h-3 w-3" /> : null}
        </span>
      </th>
    );
  };

  if (rows.length === 0) {
    return (
      <div
        className="flex min-h-[240px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed p-8 text-center text-sm"
        style={{ borderColor: T.border, color: T.textMuted }}
      >
        <Table2 className="h-8 w-8 opacity-40" aria-hidden />
        <p>Нет лидов для отображения</p>
        <p className="text-[11px]">Измените фильтры или поисковый запрос</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="overflow-x-auto rounded-2xl border"
        style={{ borderColor: T.border, backgroundColor: T.bgCard, WebkitOverflowScrolling: "touch" }}
      >
        <table className="w-full border-collapse text-left text-xs" style={{ color: T.text, minWidth: "1020px" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Приоритет (ТЗ) — итоговый индекс 0–100: чем выше, тем выше лид.
                  Сортируемый заголовок синхронизирован с тулбаром. Ставим ПЕРВОЙ
                  колонкой — менеджер считывает очередь сверху вниз. */}
              <SortHeader label="Приоритет" mode="priority" align="center" />
              <th
                className="whitespace-nowrap border-b-2 border-r px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated, textAlign: "left" }}
              >
                Клиент
              </th>
              <th
                className="whitespace-nowrap border-b-2 border-r px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated, textAlign: "left" }}
              >
                Контакты
              </th>
              <th
                className="whitespace-nowrap border-b-2 border-r px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated, textAlign: "left" }}
              >
                Источник
              </th>
              <th
                className="whitespace-nowrap border-b-2 border-r px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated, textAlign: "left" }}
              >
                Стадия
              </th>
              {/* «Работа» — «отработан» / «перезвонить в ...» (просьба босса:
                  заметка о перезвоне видна прямо в списке). */}
              <th
                className="whitespace-nowrap border-b-2 border-r px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated, textAlign: "left" }}
              >
                Работа
              </th>
              <th
                className="whitespace-nowrap border-b-2 border-r px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated, textAlign: "left" }}
              >
                Ответственный
              </th>
              <th
                className="whitespace-nowrap border-b-2 border-r px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated, textAlign: "left" }}
              >
                Техника
              </th>
              <th
                className="whitespace-nowrap border-b-2 border-r px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated, textAlign: "center" }}
              >
                Задачи
              </th>
              <SortHeader label="Выручка" mode="spent" align="right" />
              <SortHeader label="Активность" mode="recent" />
              <th
                className="whitespace-nowrap border-b-2 px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated, textAlign: "left" }}
                title="Когда лида последний раз модифицировали: заметка, туду, смена стадии"
              >
                Изменено
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lead, priority, pendingTodos, totalTodos, spent, handling }, idx) => {
              const selected = selectedId === lead.user_id;
              const avito = isAvitoLead(lead);
              const stage = stageMeta(lead.stageKey);
              const meta = metaFor(lead.source);
              const owner = lead.assigneeName || lead.ownerName || "—";
              // 📝 Заметки лида — флажок в колонке «Клиент» (не 0 → показать).
              const notesCount = lead.notesCount ?? 0;
              const lastNoteMs = lead.lastNoteAt ? new Date(lead.lastNoteAt).getTime() : 0;
              const noteIsNew = notesCount > 0 && Number.isFinite(lastNoteMs) && lastNoteMs > 0 && Date.now() - lastNoteMs <= 24 * 60 * 60 * 1000;
              return (
                <tr
                  key={lead.user_id}
                  data-lead-id={lead.user_id}
                  onClick={() => onSelect(selected ? null : lead.user_id)}
                  className="cursor-pointer transition-colors"
                  style={{
                    backgroundColor: selected
                      ? `color-mix(in srgb, ${T.accent} 10%, transparent)`
                      : avito
                        ? AVITO_BG
                        : idx % 2 === 1
                          ? `color-mix(in srgb, ${T.text} 3%, transparent)`
                          : "transparent",
                    // Selected row keeps the accent stripe; Avito rows get a
                    // green stripe so they pop out of the table instantly.
                    boxShadow: selected
                      ? `inset 3px 0 0 0 ${T.accent}`
                      : avito
                        ? `inset 3px 0 0 0 ${AVITO_COLOR}`
                        : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!selected) e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${T.accent} 6%, transparent)`;
                  }}
                  onMouseLeave={(e) => {
                    if (!selected) {
                      e.currentTarget.style.backgroundColor = avito
                        ? AVITO_BG
                        : idx % 2 === 1
                          ? `color-mix(in srgb, ${T.text} 3%, transparent)`
                          : "transparent";
                    }
                  }}
                >
                  {/* Приоритет — score 0–100 + лайбочки ⚡/🔥 (ТЗ п.4).
                      Горячие (≥70) — красный бейдж со счётом; свежие (≤60 мин) —
                      синяя молния; для Авито ×2 показываем множитель. */}
                  <td className="whitespace-nowrap border-b border-r px-2.5 py-2 text-center" style={{ borderColor: T.borderSoft }}>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                      style={
                        priority?.isHot
                          ? { backgroundColor: "#ef444420", color: "#ef4444" }
                          : (priority?.score ?? 0) >= 50
                            ? { backgroundColor: "#f59e0b20", color: "#f59e0b" }
                            : { backgroundColor: T.borderSoft, color: T.textFaint }
                      }
                      title={`Индекс приоритета ${priority?.score ?? "—"}/100${(priority?.channelMultiplier ?? 0) > 1 ? ` (канал ×${priority?.channelMultiplier})` : ""}`}
                    >
                      {priority?.isHot && <Flame className="h-2.5 w-2.5" aria-hidden />}
                      {priority?.score ?? "—"}
                    </span>
                    {priority?.isFresh && (
                      <span
                        className="ml-1 inline-flex items-center rounded-full px-1 py-0.5 text-[9px] font-bold"
                        style={{ backgroundColor: "#3b82f620", color: "#3b82f6" }}
                        title="Обращение меньше часа назад (LIFO)"
                      >
                        <Zap className="h-2.5 w-2.5" aria-hidden />
                      </span>
                    )}
                    {priority?.channelMultiplier === 2 && (
                      <span
                        className="ml-1 rounded px-1 py-0.5 text-[9px] font-bold"
                        style={{ backgroundColor: AVITO_BG, color: AVITO_COLOR }}
                        title="Приоритет ×2 — лид с Авито"
                      >
                        ×2
                      </span>
                    )}
                  </td>
                  {/* Клиент */}
                  <td className="max-w-[220px] border-b border-r px-2.5 py-2" style={{ borderColor: T.borderSoft }}>
                    <div className="flex items-center gap-2">
                      <Avatar name={lead.full_name} source={lead.source} size={28} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold" style={{ color: T.text }}>
                          {lead.full_name || "Без имени"}
                        </p>
                        {/* 📝 Заметки — подсвеченный флажок в строке таблицы: клик
                            открывает шторку сразу на заметках («новая» ≤24 ч —
                            с точкой-индикатором). */}
                        {notesCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReadNotes?.(lead.user_id);
                            }}
                            className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition hover:brightness-110"
                            style={
                              noteIsNew
                                ? { backgroundColor: "#8b5cf626", color: "#8b5cf6", border: "1px solid #8b5cf644" }
                                : { backgroundColor: "#8b5cf614", color: "#8b5cf6" }
                            }
                            title={lead.lastNoteAt ? `Последняя заметка: ${relativeTime(lead.lastNoteAt)}` : "Есть заметки"}
                          >
                            <StickyNote className="h-2.5 w-2.5 shrink-0" aria-hidden />
                            <span className="truncate">Заметки: {notesCount}</span>
                            {noteIsNew && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" aria-label="новая" />}
                          </button>
                        )}
                        {lead.troubled && (
                          <span className="text-[10px] font-medium" style={{ color: "#ef4444" }}>
                            ⚠ проблемный
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Контакты */}
                  <td className="max-w-[160px] border-b border-r px-2.5 py-2" style={{ borderColor: T.borderSoft }}>
                    <p className="truncate tabular-nums" style={{ color: T.textMuted }}>{lead.phone || "—"}</p>
                    {lead.username && (
                      <p className="truncate text-[10px]" style={{ color: T.textFaint }}>@{lead.username}</p>
                    )}
                  </td>
                  {/* Источник */}
                  <td className="border-b border-r px-2.5 py-2" style={{ borderColor: T.borderSoft }}>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: meta.bg, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {avito &&
                        (lead.avito?.itemUrl ? (
                          <a
                            href={lead.avito.itemUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold transition hover:brightness-110"
                            style={{ backgroundColor: AVITO_BG, color: AVITO_COLOR }}
                            title="Открыть чат Авито"
                          >
                            Авито <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span
                            className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ backgroundColor: AVITO_BG, color: AVITO_COLOR }}
                            title="Лид из чата Авито — ссылка на чат в карточке лида"
                          >
                            Авито
                          </span>
                        ))}
                    </span>
                  </td>
                  {/* Стадия */}
                  <td className="border-b border-r px-2.5 py-2" style={{ borderColor: T.borderSoft }}>
                    <span
                      className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: `${stage.color}18`, color: stage.color }}
                    >
                      {stage.label}
                    </span>
                  </td>
                  {/* Работа: «отработан» + «перезвонить в ...» */}
                  <td className="whitespace-nowrap border-b border-r px-2.5 py-2" style={{ borderColor: T.borderSoft }}>
                    {handling.callback ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        style={
                          isCallbackOverdue(handling.callback)
                            ? { backgroundColor: "#ef444420", color: "#ef4444" }
                            : { backgroundColor: "#f59e0b20", color: "#f59e0b" }
                        }
                        title={
                          (isCallbackOverdue(handling.callback) ? "ПЕРЕЗВОН ПРОСРОЧЕН: " : "Перезвонить: ") +
                          formatCallbackTime(handling.callback.dueAt) +
                          (handling.callback.note ? ` · ${handling.callback.note}` : "")
                        }
                      >
                        <PhoneCall className="h-2.5 w-2.5" aria-hidden />
                        {formatCallbackTime(handling.callback.dueAt)}
                      </span>
                    ) : handling.handled ? (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: "#22c55e20", color: "#22c55e" }}
                        title={handling.handledAt ? `Отработан: ${formatCallbackTime(handling.handledAt)}` : "Отработан"}
                      >
                        ✅ Обработан
                      </span>
                    ) : (
                      <span style={{ color: T.textFaint }}>—</span>
                    )}
                  </td>
                  {/* Ответственный */}
                  <td className="max-w-[140px] border-b border-r px-2.5 py-2" style={{ borderColor: T.borderSoft }}>
                    <p className="truncate" style={{ color: T.textMuted }}>{owner}</p>
                  </td>
                  {/* Техника */}
                  <td className="max-w-[170px] border-b border-r px-2.5 py-2" style={{ borderColor: T.borderSoft }}>
                    {lead.bikeTitle ? (
                      <span className="inline-flex max-w-full items-center gap-1 truncate">
                        <Bike className="h-3 w-3 shrink-0" style={{ color: T.textFaint }} aria-hidden />
                        <span className="truncate" style={{ color: T.textMuted }}>{lead.bikeTitle}</span>
                      </span>
                    ) : (
                      <span style={{ color: T.textFaint }}>—</span>
                    )}
                  </td>
                  {/* Задачи */}
                  <td className="border-b border-r px-2.5 py-2 text-center" style={{ borderColor: T.borderSoft }}>
                    {totalTodos > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        style={
                          pendingTodos > 0
                            ? { backgroundColor: "#f59e0b20", color: "#f59e0b" }
                            : { backgroundColor: "#10b98120", color: "#10b981" }
                        }
                      >
                        {pendingTodos > 0 ? `${pendingTodos} открыто` : "готово"}
                        <span style={{ color: T.textFaint }}>/ {totalTodos}</span>
                      </span>
                    ) : (
                      <span style={{ color: T.textFaint }}>—</span>
                    )}
                  </td>
                  {/* Выручка */}
                  <td
                    className="whitespace-nowrap border-b border-r px-2.5 py-2 text-right font-semibold tabular-nums"
                    style={{ borderColor: T.borderSoft, color: spent > 0 ? T.text : T.textFaint }}
                  >
                    {spent > 0 ? fmtMoney(spent) : "—"}
                  </td>
                  {/* Активность */}
                  <td
                    className="whitespace-nowrap border-b border-r px-2.5 py-2 text-[11px]"
                    style={{ borderColor: T.borderSoft, color: T.textMuted }}
                  >
                    {relativeTime(lead.lastSeenAt || lead.createdAt)}
                  </td>
                  {/* Изменено — последняя модификация (note/todo/stage);
                      модификаций не было — прочерк. Точная дата в подсказке. */}
                  <td
                    className="whitespace-nowrap border-b px-2.5 py-2 text-[11px]"
                    style={{ borderColor: T.borderSoft, color: lead.lastModifiedAt ? T.text : T.textFaint }}
                    title={lead.lastModifiedAt ? `Последнее изменение: ${relativeTime(lead.lastModifiedAt)}` : "Модификаций не было"}
                  >
                    {lead.lastModifiedAt ? (
                      <span className="inline-flex items-center gap-1">
                        <History className="h-3 w-3" style={{ color: T.textFaint }} aria-hidden />
                        {relativeTime(lead.lastModifiedAt)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer — row count + total revenue */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px]" style={{ color: T.textMuted }}>
        <span>
          Показано: <b style={{ color: T.text }}>{rows.length}</b>{" "}
          {rows.length === 1 ? "лид" : rows.length < 5 ? "лида" : "лидов"}
        </span>
        <span className="inline-flex items-center gap-1">
          <CircleDollarSign className="h-3 w-3" aria-hidden />
          Суммарная выручка:{" "}
          <b className="tabular-nums" style={{ color: T.text }}>
            {fmtMoney(totalRevenue)}
          </b>
        </span>
      </div>
    </div>
  );
}
