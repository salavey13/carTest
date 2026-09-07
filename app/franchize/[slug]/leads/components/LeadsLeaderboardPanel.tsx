// /app/franchize/[slug]/leads/components/LeadsLeaderboardPanel.tsx
//
// ПРОЗРАЧНЫЙ ЛИДЕРБОРД (Lead Game wave, «обслуживание лидов — соревнование»).
//
// Принципиальное отличие от «пути оператора» в панели достижений: там XP
// живёт в localStorage конкретного браузера (личный прогресс), а здесь —
// СЕРВЕРНАЯ агрегация public.lead_events, одинаковая для всех участников
// экипажа. Прогресс засчитывается не только за закрытия: реакция на лид,
// состоявшийся перезвон, задача, заметка — всё в очках (веса в
// lib/lead-events.ts, считает сервер).
//
// UI: топ-строки с медалями, у лидера — заметная подсветка; чипы разбивки
// (взяты · перезвоны · задачи · заметки · сделки) раскрывают «из чего очки»;
// своя строка подсвечивается («вы»); пустое состояние объясняет, откуда
// очки возьмутся. expandable — по умолчанию топ-5.

"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import type { LeadLeaderboardEntry } from "../leads-types";
import type { ThemeTokens } from "../hooks/useTheme";

interface Props {
  leaderboard: LeadLeaderboardEntry[];
  /** TG id текущего оператора — подсветить «вы». */
  currentActorId?: string | null;
  T: ThemeTokens;
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Какая доля очков — «живые» действия, а не закрытия (для подсказки). */
function breakdownChips(row: LeadLeaderboardEntry): string[] {
  const chips: string[] = [];
  if (row.handled > 0) chips.push(`взяты ×${row.handled}`);
  if (row.callbacks > 0) chips.push(`перезвоны ×${row.callbacks}`);
  if (row.todoDone > 0) chips.push(`задачи ×${row.todoDone}`);
  if (row.notes > 0) chips.push(`заметки ×${row.notes}`);
  if (row.closed > 0) chips.push(`сделки ×${row.closed}`);
  return chips;
}

function lastActionLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMin = Math.round((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export function LeadsLeaderboardPanel({ leaderboard, currentActorId, T }: Props) {
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(
    () => [...leaderboard].sort((a, b) => b.points - a.points),
    [leaderboard],
  );
  const maxPoints = rows[0]?.points ?? 0;
  const shown = expanded ? rows : rows.slice(0, 5);
  const hidden = rows.length - shown.length;
  const meIndex = currentActorId
    ? rows.findIndex((r) => r.id === currentActorId)
    : -1;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border p-3 sm:p-4"
      style={{ borderColor: T.border, backgroundColor: T.bgCard }}
      aria-label="Лидерборд операторов"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" style={{ color: "#eab308" }} aria-hidden />
          <h3 className="text-sm font-bold" style={{ color: T.text }}>
            Лидерборд смены
          </h3>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: "#eab30822", color: "#eab308" }}
          >
            {rows.length}
          </span>
        </div>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
            style={{ color: T.textMuted }}
          >
            {expanded ? "Свернуть" : `Ещё ${hidden}`}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p
          className="rounded-xl border border-dashed px-3 py-4 text-center text-[11px] leading-relaxed"
          style={{ borderColor: T.border, color: T.textFaint }}
        >
          Очки появятся, как только кто-то возьмёт лид, назначит перезвон или
          закроет сделку — считаем не только закрытия. Цифры общие для всей
          команды: что видишь ты, то видит и экипаж.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {shown.map((row, i) => {
            const isMe = currentActorId != null && row.id === currentActorId;
            const chips = breakdownChips(row);
            return (
              <li
                key={row.id}
                className="relative overflow-hidden rounded-xl border px-3 py-2"
                style={{
                  borderColor: i === 0 ? "#eab30855" : T.border,
                  backgroundColor: isMe ? `${T.accent}0f` : T.borderSoft,
                }}
                title={`Последнее действие: ${lastActionLabel(row.lastActionAt) || "—"}`}
              >
                {/* Прогресс-полоса за строкой — доля от лидера */}
                {maxPoints > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 -z-0 opacity-10"
                    style={{
                      width: `${Math.max(6, Math.round((row.points / maxPoints) * 100))}%`,
                      backgroundColor: i === 0 ? "#eab308" : T.accent,
                    }}
                    aria-hidden
                  />
                )}
                <div className="relative flex items-center gap-2.5">
                  <span className="w-6 shrink-0 text-center text-sm" aria-hidden>
                    {MEDALS[i] ?? <span className="text-xs font-black" style={{ color: T.textMuted }}>{i + 1}</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold leading-tight" style={{ color: T.text }}>
                      {row.name}
                      {isMe && (
                        <span
                          className="ml-1.5 rounded-md px-1 py-0.5 text-[9px] font-black uppercase"
                          style={{ backgroundColor: `${T.accent}22`, color: T.accent }}
                        >
                          вы
                        </span>
                      )}
                    </p>
                    {chips.length > 0 && (
                      <p className="mt-0.5 truncate text-[10px] font-semibold" style={{ color: T.textFaint }}>
                        {chips.join(" · ")}
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-black"
                    style={{ backgroundColor: "#eab3081f", color: "#eab308" }}
                  >
                    {row.points} XP
                  </span>
                </div>
              </li>
            );
          })}
          {/* Своя строка вне топ-5 — показываем отдельно, лидерборд честный */}
          {!expanded && meIndex >= 5 && (
            <li
              className="rounded-xl border px-3 py-2"
              style={{ borderColor: T.border, backgroundColor: `${T.accent}0f` }}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 shrink-0 text-center text-xs font-black" style={{ color: T.textMuted }}>
                  {meIndex + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-tight" style={{ color: T.text }}>
                    {rows[meIndex].name}
                    <span
                      className="ml-1.5 rounded-md px-1 py-0.5 text-[9px] font-black uppercase"
                      style={{ backgroundColor: `${T.accent}22`, color: T.accent }}
                    >
                      вы
                    </span>
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-black"
                  style={{ backgroundColor: "#eab3081f", color: "#eab308" }}
                >
                  {rows[meIndex].points} XP
                </span>
              </div>
            </li>
          )}
        </ol>
      )}
    </motion.section>
  );
}
