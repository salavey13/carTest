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
// готового сообщения. Футер — бенчмарки курса (60 сек / 5 мин / 50% / +29%).
//
// Пустая очередь — тоже результат: «Очередь чиста» = всё отработано.

"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ListChecks, Copy, Check, Sparkles, ChevronRight } from "lucide-react";
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
   *  Без ключа чип не рисуется. */
  storageKey?: string;
}

const TONE_COLOR: Record<NextAction["tone"], string> = {
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

export function LeadsPlaybookPanel({ actions, onOpenLead, T, storageKey }: LeadsPlaybookPanelProps) {
  // Какая строка только что скопирована — галочка вместо иконки на 2 секунды.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ПУТЬ ОПЕРАТОРА в контексте работы: звание из того же sticky-стора, что
  // у панели достижений. Читается после монтирования (SSR — пусто) и ЖИВО:
  // saveAchievementStore шлёт window-событие «leads-achv-changed»
  // (storage-события в своей вкладке не срабатывают), чип перечитывает стор —
  // XP растёт прямо над очередью действий, без перезагрузки. Чип появляется,
  // как только есть первый XP: свежий оператор не видит шума.
  const [leadXp, setLeadXp] = useState(0);
  useEffect(() => {
    if (!storageKey) return;
    const reload = () => setLeadXp(computeOperatorRank(loadAchievementStore(storageKey)).xp);
    reload();
    window.addEventListener("leads-achv-changed", reload as EventListener);
    return () => window.removeEventListener("leads-achv-changed", reload as EventListener);
  }, [storageKey]);
  const rank = useMemo(() => operatorRankForXp(leadXp), [leadXp]);

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
        {actions.length > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: `${TONE_COLOR[actions[0].tone]}22`, color: TONE_COLOR[actions[0].tone] }}
          >
            {actions.length}{" "}
            {actions.length % 10 === 1 && actions.length % 100 !== 11
              ? "действие"
              : [2, 3, 4].includes(actions.length % 10) && ![12, 13, 14].includes(actions.length % 100)
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

      {/* Очередь действий */}
      {actions.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border px-3 py-3" style={{ borderColor: T.border, backgroundColor: T.borderSoft }}>
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: "#22c55e" }} />
          <p className="text-xs" style={{ color: T.textMuted }}>
            Очередь чиста: горячие отвечены, перезвоны в срок, пропавших нет. Идеальная смена.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {actions.map((a, i) => {
            const tone = TONE_COLOR[a.tone];
            const rowKey = `${a.key}:${a.leadId ?? i}`;
            const isCopied = copiedKey === rowKey;
            const clickable = !!a.leadId && !!onOpenLead;
            // Связка «плейбук → достижения»: шаг плейбука двигает РОВНО ТУ
            // метрику, которую меряет бейдж (lib/lead-gamification.ts).
            // Чип показывает, какой бейдж прокачает этот шаг — оператор видит,
            // что SOP-действие не абстрактная дисциплина, а прогресс в пути.
            const feeds = primaryBadgeForAction(a.key);
            // Тело строки — кнопка, если есть лид-адресат: клик открывает
            // шторку лида (полный контекст перед звонком/сообщением).
            const Body = clickable ? "button" : "div";
            return (
              <li
                key={rowKey}
                className="flex items-stretch gap-2.5 rounded-xl border px-3 py-2"
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
                    style={{ backgroundColor: `${tone}1f` }}
                  >
                    {a.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold leading-tight" style={{ color: tone }} title={a.title}>
                      {/* №1 danger-очереди пульсирует: первое действие —
                          «ответить сейчас» (окно 60 сек / зона смерти 5 мин).
                          Тот же паттерн ping, что у «новая заметка» на карточке. */}
                      {i === 0 && a.tone === "danger" && (
                        <span className="relative mr-1.5 inline-flex h-2 w-2" aria-hidden>
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: tone }} />
                          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: tone }} />
                        </span>
                      )}
                      {i + 1}. {a.title}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug" style={{ color: T.textFaint }} title={a.detail}>
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
                {a.message && (
                  <button
                    type="button"
                    onClick={() => copyMessage(rowKey, a.message!)}
                    aria-label={isCopied ? "Скопировано" : "Скопировать сообщение"}
                    className="ml-1 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors"
                    style={{
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
          })}
        </ol>
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
