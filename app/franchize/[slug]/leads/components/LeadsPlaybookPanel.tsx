// /app/franchize/[slug]/leads/components/LeadsPlaybookPanel.tsx
//
// ПЛЕЙБУК СМЕНЫ — «что делать сейчас» (off-the-call SOP из курса
// The Ultimate Sales Training 2026). У оператора обычно есть скрипт на
// случай диалога («Готовый ответ» в шторке), но не план на минуты МЕЖДУ
// диалогами — по курсу именно они решают: скорость первого ответа (+391%),
// скорость к первому (50%), подтверждения визитов (+30% явки), pull-up
// будущих броней, реанимация «пропавших».
//
// Панель получает ГОТОВУЮ очередь действий из lib/lead-playbook.ts
// (buildNextActions — чистая функция от лидов и todos) и рисует её списком:
// иконка · что сделать · почему сейчас (цифра курса) · кнопка копирования
// готового сообщения · чекбокс «сделал». Футер — бенчмарки курса
// (60 сек / 5 мин / 50% / +29%).
//
// UX (mobile overhaul + «improve playbook»):
//   • ПАНЕЛЬ ВСЕГДА НА ВИДУ: вынесена из-под свёртка «Аналитика смены» —
//     очередь действий не аналитика, а рабочий инструмент; на телефоне
//     компактный режим (первые 2 действия + «ещё N»), на sm+ — весь список.
//   • «СДЕЛАЛ»: у каждого действия чекбокс — строка уходит в свёрнутый
//     блок «Отработано (N)» внизу (клик — раскрыть и вернуть, если поторопился).
//     Отметки живут в localStorage ДО КОНЦА ДНЯ (ключ на экипаж) — новая
//     смена начинает с чистой очередью. Это ручное «сделал» дополняет
//     автогашение: как только лид обработан в данных, действие само
//     исчезает из очереди.
//   • Прогресс в шапке: «Отработано N из M» — полоска, как у звания.
//
// Пустая очередь — тоже результат: «Очередь чиста» = всё отработано.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ListChecks, Copy, Check, Sparkles, ChevronRight, ChevronDown } from "lucide-react";
import type { NextAction } from "../lib/lead-playbook";
import { PLAYBOOK_BENCHMARKS } from "../lib/lead-playbook";
import { computeOperatorRank, operatorRankForXp, primaryBadgeForAction } from "../lib/lead-gamification";
import { loadAchievementStore } from "../lib/lead-achievements";

interface LeadsPlaybookPanelProps {
  actions: NextAction[];
  /** Открыть лида-адресата в шторке (просьба UX: действие без перехода —
   *  это только текст; курс 2026: SOP = «прочитал → сделал», а «сделал»
   *  начинается с открытия диалога). leadId отсутствует → строка статична. */
  onOpenLead?: (leadId: string) => void;
  T: any;
  /** Ключ sticky-стора достижений (`leads-achv:<slug>`) — из него считается
   *  звание «пути оператора» для чипа в шапке. Связка замыкается там, где
   *  идёт работа: SOP-шаги сверху → бейджи внизу страницы → XP → звание.
   *  CREW ONLY: передаётся только членам экипажа — без ключа чипа нет. */
  storageKey?: string;
  /** Ключ дневных отметок «сделал» (`leads-playbook-done:<slug>`) — тоже
   *  crew-only. Без ключа чекбоксы не рисуются (обычному пользователю
   *  очередь просто читается). */
  doneStorageKey?: string;
}

const TONE_COLOR: Record<NextAction["tone"], string> = {
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

/** Ключ отметки действия: leadId стабилен; без лида — ключ+заголовок. */
function doneKeyOf(a: NextAction): string {
  return a.leadId ? `${a.key}:${a.leadId}` : `${a.key}:${a.title}`;
}

/** Сегодняшняя дата (локальная) — отметки живут до полуночи. */
function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loadDoneSet(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { day?: string; keys?: unknown };
    if (parsed.day !== todayKey() || !Array.isArray(parsed.keys)) return new Set();
    return new Set(parsed.keys.filter((k): k is string => typeof k === "string"));
  } catch {
    return new Set();
  }
}

function saveDoneSet(storageKey: string, keys: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ day: todayKey(), keys: Array.from(keys) }));
  } catch {
    /* private mode / quota — отметки живут в памяти до перезагрузки */
  }
}

export function LeadsPlaybookPanel({ actions, onOpenLead, T, storageKey, doneStorageKey }: LeadsPlaybookPanelProps) {
  // Какая строка только что скопирована — галочка вместо иконки на 2 секунды.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ПУТЬ ОПЕРАТОРА в контексте работы: звание из того же sticky-стора, что
  // у панели достижений. Читается после монтирования (SSR — пусто) и ЖИВО:
  // saveAchievementStore шлёт window-событие «leads-achv-changed»
  // (storage-события в своей вкладке не срабатывают), чип перечитывает стор —
  // XP растёт прямо над очередью действий, без перезагрузки. Чип появляется,
  // как только есть первый XP. crew-only: без storageKey ничего не считаем.
  const [leadXp, setLeadXp] = useState(0);
  useEffect(() => {
    if (!storageKey) return;
    const reload = () => setLeadXp(computeOperatorRank(loadAchievementStore(storageKey)).xp);
    reload();
    window.addEventListener("leads-achv-changed", reload as EventListener);
    return () => window.removeEventListener("leads-achv-changed", reload as EventListener);
  }, [storageKey]);
  const rank = useMemo(() => operatorRankForXp(leadXp), [leadXp]);

  // ── «Сделал» — дневные отметки, crew-only ──
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!doneStorageKey) {
      setDoneKeys(new Set());
      return;
    }
    setDoneKeys(loadDoneSet(doneStorageKey));
  }, [doneStorageKey]);

  const toggleDone = useCallback(
    (key: string) => {
      if (!doneStorageKey) return;
      setDoneKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        saveDoneSet(doneStorageKey, next);
        return next;
      });
    },
    [doneStorageKey],
  );

  // Очередь = активные (не отмеченные) + отработанные (уходят вниз).
  const { active, done } = useMemo(() => {
    const activeList: NextAction[] = [];
    const doneList: NextAction[] = [];
    for (const a of actions) {
      if (doneStorageKey && doneKeys.has(doneKeyOf(a))) doneList.push(a);
      else activeList.push(a);
    }
    return { active: activeList, done: doneList };
  }, [actions, doneKeys, doneStorageKey]);

  // Компактный режим на телефоне: первые 2 активных + «ещё N».
  // SSR-начало — развернуто (гидрация без расхождений), после монтирования
  // сужаем на <sm: очередь — рабочий список, но 6 строк на телефоне съедают
  // экран; 2 первых + счётчик дают картину без свайпа.
  const [expandedMobile, setExpandedMobile] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const compact = isNarrow && !expandedMobile;
  const visibleActive = compact ? active.slice(0, 2) : active;
  const hiddenCount = active.length - visibleActive.length;
  const [doneOpen, setDoneOpen] = useState(false);

  const copyMessage = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      // Clipboard API может быть недоступен (http/TG WebView) — тихо игнорируем:
      // текст остаётся виден в detail, оператор скопирует вручную.
    }
  };

  const renderRow = (a: NextAction, i: number, isDoneRow: boolean) => {
    const tone = TONE_COLOR[a.tone];
    const rowKey = `${a.key}:${a.leadId ?? a.title}`;
    const isCopied = copiedKey === rowKey;
    const clickable = !!a.leadId && !!onOpenLead;
    // Связка «плейбук → достижения»: шаг плейбука двигает РОВНО ТУ
    // метрику, которую меряет бейдж (lib/lead-gamification.ts).
    // Чип показывает, какой бейдж прокачает этот шаг — оператор видит,
    // что SOP-действие не абстрактная дисциплина, а прогресс в пути.
    const feeds = isDoneRow ? null : primaryBadgeForAction(a.key);
    // Тело строки — кнопка, если есть лид-адресат: клик открывает
    // шторку лида (полный контекст перед звонком/сообщением).
    const Body = clickable ? "button" : "div";
    const doneKey = doneKeyOf(a);
    return (
      <li
        key={rowKey}
        className={`flex items-stretch gap-2.5 rounded-xl border px-3 py-2 transition ${isDoneRow ? "opacity-60" : ""}`}
        style={{ borderColor: T.border, backgroundColor: T.borderSoft }}
      >
        <Body
          {...(clickable
            ? {
                type: "button" as const,
                onClick: () => onOpenLead!(a.leadId!),
                "aria-label": `${a.title} — открыть лида`,
              }
            : {})}
          className={`flex min-w-0 flex-1 items-start gap-2.5 rounded-lg text-left ${
            clickable ? "cursor-pointer transition hover:brightness-110 active:scale-[0.99]" : ""
          }`}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px]"
            style={{ backgroundColor: `${tone}1f`, filter: isDoneRow ? "grayscale(1)" : "none" }}
          >
            {a.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[12px] font-bold leading-tight ${isDoneRow ? "line-through" : ""}`}
              style={{ color: tone }}
              title={a.title}
            >
              {/* №1 danger-очереди пульсирует: первое действие —
                  «ответить сейчас» (окно 60 сек / зона смерти 5 мин).
                  Тот же паттерн ping, что у «новая заметка» на карточке. */}
              {i === 0 && a.tone === "danger" && !isDoneRow && (
                <span className="relative mr-1.5 inline-flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: tone }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: tone }} />
                </span>
              )}
              {a.title}
            </p>
            <p className={`mt-0.5 text-[10px] leading-snug ${isDoneRow ? "line-through" : ""}`} style={{ color: T.textFaint }} title={a.detail}>
              {a.detail}
            </p>
            {feeds && (
              <p
                className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                title={`Этот шаг приближает бейдж «${feeds.title}» — достижения считаются из тех же цифр`}
              >
                <span aria-hidden>🏆</span>
                прокачает: {feeds.emoji} {feeds.title}
              </p>
            )}
          </div>
          {clickable && (
            <ChevronRight
              className="mt-1 h-4 w-4 shrink-0"
              style={{ color: T.textFaint }}
              aria-hidden
            />
          )}
        </Body>
        {/* «Сделал» — crew-only (doneStorageKey). Отметил → строка ушла
            вниз в «Отработано»; клик по ✓ снова — вернуть в очередь. */}
        {doneStorageKey && (
          <button
            type="button"
            onClick={() => toggleDone(doneKey)}
            aria-pressed={isDoneRow}
            aria-label={isDoneRow ? "Вернуть в очередь" : "Отметить выполненным"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors"
            style={{
              borderColor: isDoneRow ? "rgba(34,197,94,0.5)" : T.border,
              color: isDoneRow ? "#22c55e" : T.textFaint,
              backgroundColor: isDoneRow ? "rgba(34,197,94,0.08)" : "transparent",
            }}
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        {a.message && (
          <button
            type="button"
            onClick={() => copyMessage(rowKey, a.message!)}
            aria-label={isCopied ? "Скопировано" : "Скопировать сообщение"}
            className="h-9 w-9 shrink-0 rounded-lg border transition-colors"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderColor: isCopied ? "rgba(34,197,94,0.5)" : T.border,
              color: isCopied ? "#22c55e" : T.textMuted,
              backgroundColor: isCopied ? "rgba(34,197,94,0.08)" : "transparent",
            }}
          >
            {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </li>
    );
  };

  const total = actions.length;
  const doneCount = done.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border p-3 sm:p-4"
      style={{ borderColor: T.border, backgroundColor: T.bgCard }}
    >
      {/* Шапка */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" style={{ color: T.accent }} />
          <h3 className="text-sm font-bold" style={{ color: T.text }}>
            Что делать сейчас
          </h3>
          <span className="text-[10px]" style={{ color: T.textFaint }}>
            плейбук смены · off-the-call SOP
          </span>
        </div>
        {active.length > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: `${TONE_COLOR[active[0].tone]}22`, color: TONE_COLOR[active[0].tone] }}
          >
            {active.length}{" "}
            {active.length % 10 === 1 && active.length % 100 !== 11
              ? "действие"
              : [2, 3, 4].includes(active.length % 10) && ![12, 13, 14].includes(active.length % 100)
                ? "действия"
                : "действий"}
          </span>
        )}
        {/* ПУТЬ ОПЕРАТОРА — чип звания в шапке плейбука: путь виден там, где
            идёт работа (панель достижений — внизу длинного скролла). Появляется
            с первым XP; тултип объясняет весь цикл SOP → бейдж → XP → звание. */}
        {leadXp > 0 && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
            title={`Путь оператора: ${rank.xp} XP. Шаги этой очереди открывают бейджи — бейджи дают XP, XP растит звание. Панель достижений внизу страницы.`}
          >
            <span aria-hidden>{rank.emoji}</span>
            {rank.title} · {rank.xp} XP
            {rank.next && <span className="hidden font-semibold sm:inline">· ещё {rank.xpToNext}</span>}
          </span>
        )}
      </div>

      {/* Прогресс смены: отработано N из M — тот же визуал, что у полосы звания. */}
      {doneStorageKey && total > 0 && doneCount > 0 && (
        <div className="mb-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.textFaint }}>
              Отработано {doneCount} из {total}
            </span>
            <span className="text-[10px] font-bold" style={{ color: "#22c55e" }}>
              {Math.round((doneCount / total) * 100)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: T.border }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round((doneCount / total) * 100)}%`,
                background: "linear-gradient(90deg, rgba(34,197,94,0.55), #22c55e)",
              }}
            />
          </div>
        </div>
      )}

      {/* Очередь действий */}
      {active.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border px-3 py-3" style={{ borderColor: T.border, backgroundColor: T.borderSoft }}>
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: "#22c55e" }} />
          <p className="text-xs" style={{ color: T.textMuted }}>
            {doneCount > 0
              ? `Очередь чиста: всё отработано (${doneCount} за смену) 👏 Горячие отвечены, перезвоны в срок, пропавших нет.`
              : "Очередь чиста: горячие отвечены, перезвоны в срок, пропавших нет. Идеальная смена."}
          </p>
        </div>
      ) : (
        <>
          <ol className="space-y-2">{visibleActive.map((a, i) => renderRow(a, i, false))}</ol>
          {/* «ещё N» — компактный мобильный режим */}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpandedMobile(true)}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition active:scale-[0.99]"
              style={{ borderColor: T.border, color: T.textMuted }}
            >
              Ещё {hiddenCount} {hiddenCount === 1 ? "действие" : hiddenCount < 5 ? "действия" : "действий"}
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          )}
        </>
      )}

      {/* Отработано — свёрнутый блок: отмеченные «сделал» строки уходят сюда.
          Раскрыть — увидеть/вернуть (клик по ✓ строки возвращает в очередь). */}
      {doneStorageKey && doneCount > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setDoneOpen((v) => !v)}
            aria-expanded={doneOpen}
            className="flex min-h-[40px] w-full items-center justify-between rounded-xl border px-3 py-2 text-[11px] font-bold transition"
            style={{ borderColor: "rgba(34,197,94,0.35)", color: "#22c55e", backgroundColor: "rgba(34,197,94,0.06)" }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Отработано ({doneCount})
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${doneOpen ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {doneOpen && (
            <ol className="mt-2 space-y-2">
              {done.map((a, i) => renderRow(a, i, true))}
            </ol>
          )}
        </div>
      )}

      {/* Бенчмарки курса — ориентиры, почему именно такой порядок */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {PLAYBOOK_BENCHMARKS.map((b) => (
          <span
            key={b.key}
            className="flex items-center gap-1 text-[10px]"
            style={{ color: T.textFaint }}
            title={b.fact}
          >
            <span
              className="rounded px-1 py-0.5 text-[9px] font-bold"
              style={{ backgroundColor: `${T.accent}1f`, color: T.accent }}
            >
              {b.label}
            </span>
            {b.fact}
          </span>
        ))}
        {/* Ссылка на полную инструкцию — порядок очереди и правила ответов
            подробно разобраны в гайде (self-contained, работает офлайн). */}
        <a
          href="/docs/avito-leads-guide.html"
          target="_blank"
          rel="noreferrer noopener"
          className="ml-auto inline-flex items-center gap-1 text-[10px] underline decoration-dotted transition hover:brightness-125"
          style={{ color: T.accent }}
        >
          📘 Как работать с лидами
        </a>
      </div>
    </motion.div>
  );
}
