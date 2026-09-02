// /app/franchize/[slug]/leads/components/LeadHandlingSection.tsx
"use client";

//
// «Работа с лидом» — панель «Отработан» + «Перезвонить в ...» в шторке лида.
//
// Просьба босса: отмечать лиды как «отработанные» и оставлять заметку
// «перезвонить в такое-то время», чтобы она была КРУПНО видна прямо в
// списке лидов. Плашки в списке/таблице/канбане рисуют LeadCard /
// LeadTableView / LeadBoard из того же состояния (см. lib/lead-handling.ts),
// а здесь — место, где оператор это состояние меняет.
//
// • «Отработан» — крупная зелёная кнопка-тумблер.
// • «Перезвонить» — быстрые пресеты (+30 мин / +1 ч / +2 ч / завтра 10:00)
//   + точный datetime-local + необязательная заметка.
// • Назначенный перезвон показывается баннером: подоспевший — янтарный,
//   просроченный — красный, с кнопками «Позвонил» (завершает перезвон и
//   отмечает лид отработанным) и «Убрать».
//

import { useState } from "react";
import { PhoneCall, Check, X, CalendarClock, Undo2 } from "lucide-react";
import type { LeadHandling } from "../lib/lead-handling";
import {
  formatCallbackTime,
  isCallbackOverdue,
  callbackInMinutes,
} from "../lib/lead-handling";
import type { ThemeTokens } from "../hooks/useTheme";

interface Props {
  handling: LeadHandling;
  T: ThemeTokens;
  onMarkHandled: (handled: boolean) => void;
  onSetCallback: (iso: string, note: string) => void;
  onCompleteCallback: () => void;
  onClearCallback: () => void;
  /** Крутится запрос к API — блокируем кнопки от двойного нажатия. */
  busy?: boolean;
}

/** datetime-local value для встроенного инпута (минус 60 сек: некоторые
 *  браузеры отказываются принимать значение с секундами). */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadHandlingSection({
  handling,
  T,
  onMarkHandled,
  onSetCallback,
  onCompleteCallback,
  onClearCallback,
  busy = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dtValue, setDtValue] = useState<string>(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [note, setNote] = useState("");

  const cb = handling.callback;
  const overdue = isCallbackOverdue(cb);
  const inMin = callbackInMinutes(cb);
  const soonLabel =
    inMin === null
      ? ""
      : inMin <= 0
        ? "просрочен"
        : inMin < 60
          ? `через ${inMin} мин`
          : `через ${Math.floor(inMin / 60)} ч ${inMin % 60} мин`;

  const presets: Array<{ label: string; ms: number }> = [
    { label: "+30 мин", ms: 30 * 60 * 1000 },
    { label: "+1 ч", ms: 60 * 60 * 1000 },
    { label: "+2 ч", ms: 2 * 60 * 60 * 1000 },
    { label: "+завтра 10:00", ms: -1 }, // спец-обработка ниже
  ];

  const applyPreset = (ms: number) => {
    const d =
      ms === -1
        ? (() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(10, 0, 0, 0);
            return tomorrow;
          })()
        : new Date(Date.now() + ms);
    onSetCallback(d.toISOString(), note.trim());
    setExpanded(false);
    setNote("");
  };

  const applyExact = () => {
    const d = new Date(dtValue);
    if (Number.isNaN(d.getTime())) return;
    onSetCallback(d.toISOString(), note.trim());
    setExpanded(false);
    setNote("");
  };

  return (
    <div
      className="mt-4 rounded-2xl border p-3 md:p-4"
      style={{ borderColor: cb ? (overdue ? "#ef444455" : "#f59e0b55") : T.border, background: cb ? (overdue ? "#ef44440d" : "#f59e0b0d") : "transparent" }}
      aria-label="Работа с лидом"
    >
      {/* ── Активный перезвон — главный баннер ── */}
      {cb ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: overdue ? "#ef444422" : "#f59e0b22", color: overdue ? "#ef4444" : "#f59e0b" }}
              >
                <CalendarClock className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: overdue ? "#ef4444" : "#f59e0b" }}>
                  {overdue ? "⏰ Перезвон ПРОСРОЧЕН" : "📞 Перезвонить"}
                </p>
                <p className="truncate text-xs" style={{ color: T.textMuted }}>
                  {formatCallbackTime(cb.dueAt)}
                  {soonLabel ? ` · ${soonLabel}` : ""}
                  {cb.note ? ` · ${cb.note}` : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onCompleteCallback}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}
                title="Перезвонили — закрыть напоминание и отметить лид отработанным"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Позвонил
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onClearCallback}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition active:scale-95 disabled:opacity-50"
                style={{ borderColor: T.border, color: T.textMuted }}
                title="Убрать напоминание"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Перезвон не назначен — кнопка-активатор ── */
        <button
          type="button"
          disabled={busy}
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left transition disabled:opacity-50"
          style={{ color: "#f59e0b" }}
        >
          <span className="flex items-center gap-2.5">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}
            >
              <PhoneCall className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold">Перезвонить позже</span>
              <span className="block text-xs" style={{ color: T.textMuted }}>
                Оставить заметку-напоминание — она будет видна в списке лидов
              </span>
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold" style={{ color: T.textFaint }}>
            {expanded ? "Скрыть" : "Выбрать время"}
          </span>
        </button>
      )}

      {/* ── Форма назначения перезвона (раскрыта) ── */}
      {expanded && !cb && (
        <div className="mt-3 space-y-2.5 rounded-xl border p-2.5 md:p-3" style={{ borderColor: T.border }}>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={busy}
                onClick={() => applyPreset(p.ms)}
                className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="datetime-local"
              value={dtValue}
              min={toLocalInputValue(new Date())}
              onChange={(e) => setDtValue(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }}
              aria-label="Дата и время перезвона"
            />
            <button
              type="button"
              disabled={busy}
              onClick={applyExact}
              className="cursor-pointer rounded-xl px-4 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: "#f59e0b", color: "#1f1600" }}
            >
              Напомнить
            </button>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Заметка (необязательно): «после 18:00», «уточнить наличие»…"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }}
            aria-label="Заметка к перезвону"
            maxLength={120}
          />
        </div>
      )}

      {/* ── Тумблер «Отработан» ── */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: T.border }}>
        <span className="flex items-center gap-2 text-sm" style={{ color: T.textMuted }}>
          {handling.handled && <Check className="h-4 w-4" style={{ color: "#22c55e" }} aria-hidden />}
          <span>
            {handling.handled ? (
              <>
                Отработан{handling.handledAt ? ` · ${formatCallbackTime(handling.handledAt)}` : ""}
              </>
            ) : (
              "Лид ещё не отработан"
            )}
          </span>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onMarkHandled(!handling.handled)}
          className="inline-flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-50"
          style={
            handling.handled
              ? { border: `1px solid ${T.border}`, color: T.textMuted, backgroundColor: "transparent" }
              : { backgroundColor: "#22c55e18", color: "#22c55e" }
          }
          title={handling.handled ? "Снять отметку «отработан»" : "Отметить: с лидом разобрались"}
        >
          {handling.handled ? (
            <>
              <Undo2 className="h-3.5 w-3.5" aria-hidden /> Снять
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden /> Отработан
            </>
          )}
        </button>
      </div>
    </div>
  );
}
