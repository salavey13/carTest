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
//     смена начинает с чистой очередью. Вкладка, пережившая полночь
//     (ночная смена), очищается САМА: таймер до полуночи перечитывает стор,
//     а toggle дополнительно защищён от протекания чужого дня
//     (lib/lead-playbook-done.ts). Это ручное «сделал» дополняет
//     автогашение: как только лид обработан в данных, действие само
//     исчезает из очереди.
//   • Прогресс в шапке: «Отработано N из M» — полоска, как у звания.
//
// Пустая очередь — тоже результат: «Очередь чиста» = всё отработано.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ListChecks, Copy, Check, Sparkles, ChevronRight, ChevronDown, Trophy } from "lucide-react";
import type { NextAction } from "../lib/lead-playbook";
import { PLAYBOOK_BENCHMARKS } from "../lib/lead-playbook";
import type { LeadsSuperlistState } from "../leads-types";
import {
  applyPlaybookDoneToggle,
  msUntilNextMidnight,
  parsePlaybookDone,
  playbookTodayKey,
  type PlaybookDoneState,
} from "../lib/lead-playbook-done";
import { computeOperatorRank, operatorRankForXp, primaryBadgeForAction } from "../lib/lead-gamification";
import { loadAchievementStore } from "../lib/lead-achievements";
import {
  OPERATOR_GUIDES,
  applyGuideRead,
  parseGuidesReadIds,
} from "../lib/lead-path";

interface LeadsPlaybookPanelProps {
  actions: NextAction[];
  /** Открыть лида-адресата в шторке (просьба UX: действие без перехода —
   *  это только текст; курс 2026: SOP = «прочитал → сделал», а «сделал»
   *  начинается с открытия диалога). leadId отсутствует → строка статична. */
  onOpenLead?: (leadId: string) => void;
  /** Тост-обратная связь для копирования (2026-09-10, критик R3): раньше
   *  сбой clipboard (http/TG WebView/headless) гас молча — оператор не мог
   *  понять, скопировалось или нет. */
  onToast?: (msg: string, kind?: "info" | "success" | "error") => void;
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
  /** Ключ session-предпочтения «очередь развёрнута» на телефоне — для
   *  ВСЕХ пользователей (очередь — не геймификация). Без ключа компактный
   *  режим просто сворачивается на каждый новый заход. */
  compactPrefKey?: string;
  /** Ключ отметок «гайд прочитан» (`leads-guides:<slug>`) — питает галочки
   *  «Библиотеки оператора» и шаг «Теория» пути. БЕЗ crew-гейта: чтение —
   *  личная полезность для любого пользователя, а шаг пути закрывается
   *  только у экипажа (путь просто не монтируется не-crew). */
  guidesKey?: string;
  /** Механика «Суперлист закрыт» (сервер, lib/superlist-clear.ts): золотой
   *  баннер «весь список отработан под ноль». justCleared — праздник в ЭТОМ
   *  ответе; в течение 2 ч после — приглушённый вариант баннера. */
  superlist?: LeadsSuperlistState | null;
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

/** Запись стора отметок (I/O-обёртка; чистая логика — в lib/lead-playbook-done.ts). */
function saveDoneSet(storageKey: string, state: PlaybookDoneState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ day: state.day, keys: Array.from(state.keys) }));
  } catch {
    /* private mode / quota — отметки живут в памяти до перезагрузки */
  }
}

/** Микро-тактильный отклик (Android/Chrome; iOS тихо игнорирует). */
function buzz(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* нет хаптики — не беда */
  }
}

export function LeadsPlaybookPanel({ actions, onOpenLead, onToast, T, storageKey, doneStorageKey, compactPrefKey, guidesKey, superlist }: LeadsPlaybookPanelProps) {
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

  // ── «БИБЛИОТЕКА ОПЕРАТОРА»: отметки «гайд прочитан» (шаг «Теория» пути) ──
  // Читается после монтирования (SSR — пусто) и ЖИВО: клик по ссылке пишет
  // стор и шлёт window-событие «leads-guides-changed» — и локальный стейт,
 //  и LeadsClient (pathStats.guidesRead → прогресс шага «Теория»)
 //  перечитывают стор без перезагрузки. I/O тут (как у done-отметок выше);
 //  чистая логика — в lib/lead-path.ts.
  const [guidesReadIds, setGuidesReadIds] = useState<string[]>([]);
  useEffect(() => {
    const reload = () => {
      if (!guidesKey) return;
      try {
        setGuidesReadIds(parseGuidesReadIds(window.localStorage.getItem(guidesKey)));
      } catch { /* private mode */ }
    };
    reload();
    window.addEventListener("leads-guides-changed", reload as EventListener);
    return () => window.removeEventListener("leads-guides-changed", reload as EventListener);
  }, [guidesKey]);
  const markGuideRead = useCallback(
    (guideId: string) => {
      if (!guidesKey) return;
      try {
        const next = applyGuideRead(parseGuidesReadIds(window.localStorage.getItem(guidesKey)), guideId);
        window.localStorage.setItem(guidesKey, JSON.stringify(next));
      } catch { /* private mode — отметка живёт в памяти до перезагрузки */ }
      window.dispatchEvent(new Event("leads-guides-changed"));
    },
    [guidesKey],
  );

  // ── «Сделал» — дневные отметки, crew-only ──
  // Чистая логика (день/сброс/защита полуночи) — в lib/lead-playbook-done.ts.
  const [doneState, setDoneState] = useState<PlaybookDoneState>({ day: "", keys: new Set() });
  useEffect(() => {
    if (!doneStorageKey) {
      setDoneState({ day: "", keys: new Set() });
      return;
    }
    setDoneState({ day: playbookTodayKey(), keys: parsePlaybookDone(window.localStorage.getItem(doneStorageKey)) });
  }, [doneStorageKey]);

  // ДЕННАЯ ГРАНИЦА: вкладка оператора (ночная смена), пережившая полночь,
  // больше не держит вчерашние отметки — таймер до полуночи перечитывает
  // стор, parsePlaybookDone возвращает пустой набор для чужого дня, очередь
  // очищается САМА (без действий и перезагрузки). Многодневные вкладки:
  // таймер перенастраивается на следующую полночь.
  useEffect(() => {
    if (!doneStorageKey) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setDoneState({ day: playbookTodayKey(), keys: parsePlaybookDone(window.localStorage.getItem(doneStorageKey)) });
        schedule();
      }, msUntilNextMidnight());
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [doneStorageKey]);

  const toggleDone = useCallback(
    (key: string) => {
      if (!doneStorageKey) return;
      setDoneState((prev) => {
        // Защита полуночи внутри toggle: если таймер ещё не успел, а день
        // уже сменился — базой будет ЧИСТЫЙ набор, вчерашние отметки не
        // протекут в запись нового дня.
        const next = applyPlaybookDoneToggle(prev, key);
        // Тактильный клик на «сделал» (на «вернуть в очередь» — тихо:
        // отмена — не достижение).
        if (next.added) buzz(12);
        saveDoneSet(doneStorageKey, next);
        return { day: next.day, keys: next.keys };
      });
    },
    [doneStorageKey],
  );

  // Очередь = активные (не отмеченные) + отработанные (уходят вниз).
  const doneKeys = doneState.keys;
  const { active, done } = useMemo(() => {
    const activeList: NextAction[] = [];
    const doneList: NextAction[] = [];
    for (const a of actions) {
      if (doneStorageKey && doneKeys.has(doneKeyOf(a))) doneList.push(a);
      else activeList.push(a);
    }
    return { active: activeList, done: doneList };
  }, [actions, doneState, doneStorageKey]);

  // Компактный режим на телефоне: первые 2 активных + «ещё N».
  // SSR-начало — развернуто (гидрация без расхождений); ПЕРВЫЙ замер после
  // монтирования сужает <sm: очередь — рабочий список, но 6 строк на
  // телефоне съедают экран; 2 первых + счётчик дают картину без свайпа.
  // FIX: раньше expandedMobile инициализировался true и НИЧЕГО не сбрасывал
  // его в false — compact оставался false навсегда, «ещё N» не появлялся,
  // и телефон всегда получал все 6 строк (компактный режим был мёртвым
  // кодом). Теперь первый замер matchMedia сворачивает очередь; последующие
  // смены ориентировки/ресайза выбор пользователя не перекрывают.
  // Развёрнутое состояние ОПОМИНАЕТСЯ в sessionStorage (compactPrefKey) —
  // оператор, работающий из полной очереди, не сворачивает её заново
  // на каждом возврате на страницу.
  const [expandedMobile, setExpandedMobile] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const prefExpanded = (() => {
      try {
        return !!compactPrefKey && window.sessionStorage.getItem(compactPrefKey) === "1";
      } catch {
        return false;
      }
    })();
    let first = true;
    const sync = () => {
      setIsNarrow(mq.matches);
      if (first && mq.matches && !prefExpanded) setExpandedMobile(false);
      first = false;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [compactPrefKey]);
  const compact = isNarrow && !expandedMobile;
  const visibleActive = compact ? active.slice(0, 2) : active;
  const hiddenCount = active.length - visibleActive.length;
  const [doneOpen, setDoneOpen] = useState(false);

  const copyMessage = async (key: string, text: string) => {
    // 2026-09-10 (критик R3): ЛЮБОЙ исход теперь виден оператору.
    // 1) Clipboard API; 2) fallback textarea+execCommand (http/TG WebView);
    // 3) если и это запрещено — явный тост, а не тишина.
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      buzz(8);
      onToast?.("Сообщение скопировано", "success");
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
      return;
    } catch {
      /* фолбэк ниже */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        setCopiedKey(key);
        buzz(8);
        onToast?.("Сообщение скопировано", "success");
        window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
        return;
      }
    } catch {
      /* тост ниже */
    }
    onToast?.("Браузер не дал доступ к буферу — текст можно выделить и скопировать вручную", "error");
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
    // CREW ONLY: чип — часть геймификации, обычному пользователю не
    // показывается (storageKey — crew-маркер, как у чипа звания выше).
    const feeds = isDoneRow || !storageKey ? null : primaryBadgeForAction(a.key);
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

      {/* СУПЕРЛИСТ ЗАКРЫТ: золотой баннер полного покрытия списка. Сервер
          празднует с кулдауном 12 ч; баннер живёт 2 ч после праздника, чтобы
          вернувшиеся операторы тоже увидели. */}
      {(() => {
        if (!superlist) return null;
        const justCleared = !!superlist.justCleared;
        const recentMs = superlist.lastClearedAt ? Date.now() - new Date(superlist.lastClearedAt).getTime() : NaN;
        const recent = justCleared || (Number.isFinite(recentMs) && recentMs >= 0 && recentMs < 2 * 60 * 60 * 1000);
        if (!recent) return null;
        return (
          <motion.div
            initial={justCleared ? { opacity: 0, scale: 0.96 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, type: "spring", bounce: 0.35 }}
            className="mb-3 flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
            style={{
              borderColor: "rgba(245,158,11,0.45)",
              background: justCleared
                ? "linear-gradient(90deg, rgba(245,158,11,0.18), rgba(245,158,11,0.06))"
                : "rgba(245,158,11,0.08)",
            }}
          >
            <Trophy className="h-5 w-5 shrink-0" style={{ color: "#f59e0b" }} aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-bold" style={{ color: "#f59e0b" }}>
                {justCleared ? "Суперлист закрыт под ноль! 🏆" : "Суперлист закрыт недавно"}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug" style={{ color: T.textMuted }}>
                {justCleared
                  ? `Весь список «что делать сейчас» отработан — закрытие №${superlist.totalClears} экипажа. Бейдж и +25 очков — closer'у, фанфары — владельцу и админам.`
                  : `Полных закрытий суперлиста у экипажа: ${superlist.totalClears}. Держим планку!`}
              </p>
            </div>
          </motion.div>
        );
      })()}

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
              onClick={() => {
                setExpandedMobile(true);
                // Помним выбор до конца таб-сессии — возвраты на страницу
                // не сворачивают очередь заново.
                if (compactPrefKey) {
                  try {
                    window.sessionStorage.setItem(compactPrefKey, "1");
                  } catch {
                    /* private mode */
                  }
                }
              }}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition active:scale-[0.99]"
              style={{ borderColor: T.border, color: T.textMuted }}
            >
              Ещё {hiddenCount} {hiddenCount === 1 ? "действие" : hiddenCount < 5 ? "действия" : "действий"}
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          )}
          {/* «Свернуть» — обратная сторона «Ещё N»: раньше развёрнутая очередь
              была односторонней до конца таб-сессии (sessionStorage держал "1",
              а пути назад не было). Снимаем предпочтение — следующий заход
              снова компактный, текущий сворачивается сразу. */}
          {isNarrow && expandedMobile && active.length > 2 && (
            <button
              type="button"
              onClick={() => {
                setExpandedMobile(false);
                if (compactPrefKey) {
                  try {
                    window.sessionStorage.removeItem(compactPrefKey);
                  } catch {
                    /* private mode */
                  }
                }
              }}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition active:scale-[0.99]"
              style={{ borderColor: T.border, color: T.textMuted }}
            >
              Свернуть очередь
              <ChevronDown className="h-4 w-4 rotate-180" aria-hidden />
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
      </div>

      {/* БИБЛИОТЕКА ОПЕРАТОРА — все три самоучителя системы вместо бывшей
          одиночной ссылки на Avito-гид. Галочка = «открывал в этой смене
          мышления» (отметка живёт в localStorage на экипаж, без crew-гейта);
          три галочки закрывают шаг «Теория» пути оператора. */}
      <div className="mt-3 border-t pt-3" style={{ borderColor: T.border }}>
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.textFaint }}>
          Библиотека оператора
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {OPERATOR_GUIDES.map((g) => {
            const read = guidesReadIds.includes(g.id);
            return (
              <a
                key={g.id}
                href={g.href}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => markGuideRead(g.id)}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition hover:brightness-125 active:scale-[0.98]"
                style={{
                  borderColor: read ? "rgba(34,197,94,0.4)" : T.border,
                  color: read ? "#22c55e" : T.textMuted,
                  backgroundColor: read ? "rgba(34,197,94,0.07)" : "transparent",
                }}
                title={`${g.desc}${read ? " · открыто — засчитано в «Теорию»" : ""}`}
              >
                {read ? <Check className="h-3 w-3 shrink-0" aria-hidden /> : <span aria-hidden>{g.emoji}</span>}
                {g.title}
              </a>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
