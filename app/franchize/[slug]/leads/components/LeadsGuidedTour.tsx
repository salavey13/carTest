// /app/franchize/[slug]/leads/components/LeadsGuidedTour.tsx
//
// ОБЗОР-ТУР СТРАНИЦЫ ЛИДОВ («новичок на смене»): step-by-step введение,
// связывающее разделы UI с плейбуком — очередь «что делать сейчас»,
// сводка дня, фильтры, шторка с «Готовым ответом», аналитика, путь
// оператора (crew only) и, в финале, ССЫЛКА НА ПОЛНЫЙ ГАЙД
// (/docs/avito-leads-guide.html — та самая «spa-ссылка на playbook page»,
// теперь доступна не только в футере плейбука, но и из тура и шапки страницы).
//
// Механика:
//   • Кнопка «?» справа внизу — тур открывается в любой момент.
//   • АВТО-ЗАПУСК один раз для новичка (localStorage
//     `leads-tour-done:<slug>`; «Пропустить»/Esc/✕ тоже закрывают навсегда —
//     тур не приставучий, вернуться можно кнопкой «?»).
//   • Шаг с «Показать» сворачивает карточку в ПИЛЮЛЮ внизу и вызывает
//     onReveal(targetId): родитель раскрывает мобильный свёрток аналитики,
//     отскролливает раздел и подсвечивает его рамкой — страница ВИДНА,
//     пока тур объясняет. Тап по пилюле возвращает карточку.
//   • Последний шаг — кнопка «Открыть гайд по лидам» (new tab, офлайн-safe).

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, HelpCircle, Minimize2, X } from "lucide-react";

export interface TourStep {
  emoji: string;
  title: string;
  body: string;
  /** id раздела на странице для кнопки «Показать» (onReveal). */
  target?: string;
  /** Финальный шаг: кнопка «Открыть гайд по лидам». */
  guide?: boolean;
}

export const LEADS_GUIDE_HREF = "/docs/avito-leads-guide.html";

/** Тексты шагов изолированы от рендера (легко поддерживать/тестировать). */
export function buildTourSteps(isCrew: boolean): TourStep[] {
  const steps: TourStep[] = [
    {
      emoji: "👋",
      title: "Добро пожаловать на смену",
      body: "Это рабочий стол оператора: сверху — очередь «что делать сейчас» (плейбук), под ней — лиды с фильтрами, ниже — аналитика. Кнопка «Показать» подсветит раздел прямо на странице; шаги можно пропускать.",
    },
    {
      emoji: "🎯",
      title: "Плейбук: что делать сейчас",
      body: "Рабочая очередь между диалогами (SOP курса Ultimate Sales 2026). Первая danger-строка пульсирует: окно 60 секунд — ответ в первую минуту даёт +391% к закрытию. Клик по строке открывает лида, 📋 копирует готовое сообщение, ✓ «сделал» уводит шаг в «Отработано».",
      target: "leads-playbook",
    },
    {
      emoji: "🔥",
      title: "Сводка дня",
      body: "Плитки-снимок: всего лидов, активность сегодня, горячие, клиенты, задачи в работе, выручка. «Горячие» — кому отвечаем в первую очередь: они всегда наверху плейбука.",
      target: "leads-kpi",
    },
    {
      emoji: "🗂",
      title: "Лиды и фильтры",
      body: "Поиск и фильтры: источник, стадия, ответственный, сегмент, скрытие заглушек. Клик по карточке открывает шторку лида, ⋮ — действия с лидом.",
      target: "leads-toolbar",
    },
    {
      emoji: "💬",
      title: "Готовый ответ в шторке",
      body: "Открой любого лида: в шторке — контакты, оплата, сроки и «Готовый ответ», скрипт под вопрос покупателя с вкладками Полный/Короткий. Скрипты уже знают факты экипажа — сообщения персональные, копируются одной кнопкой.",
    },
    {
      emoji: "📊",
      title: "Аналитика смены",
      body: "Скорость ответа (медиана, кто ждёт, перезвоны), воронка Активность → Диалог → КЭВ → Сделка и норматив дня. На телефоне раздел живёт за свёртком «Аналитика смены» — «Показать» раскроет его сам.",
      target: "leads-analytics",
    },
    ...(isCrew
      ? [
          {
            emoji: "🏆",
            title: "Путь оператора",
            body: "Шаги плейбука двигают ровно те метрики, которые меряют бейджи: бейджи дают XP, XP растит звание. Чип звания — в шапке плейбука, панель достижений — в аналитике.",
            target: "leads-achievements",
          } as TourStep,
        ]
      : []),
    {
      emoji: "📘",
      title: "Полный гайд по лидам",
      body: "Порядок очереди, правила ответов и шаблоны сообщений — в гайде; открывается в новой вкладке и работает офлайн. Вернуться к обзору можно в любой момент — кнопка «?» справа внизу.",
      guide: true,
    },
  ];
  return steps;
}

interface LeadsGuidedTourProps {
  T: any;
  slug: string;
  /** Геймификационный шаг и чипы звания — только экипажу. */
  isCrew: boolean;
  /** Данные страницы готовы (гейт пройден, лиды загрузились) — разрешает
   *  ОДНОКРАТНЫЙ авто-запуск обзора. Дальше — только по кнопке «?». */
  autoLaunch: boolean;
  /** Раскрыть свёрток (если нужно), отскроллить и подсветить раздел. */
  onReveal: (targetId: string) => void;
}

const GUIDE_LABEL = "Открыть гайд по лидам";

export function LeadsGuidedTour({ T, slug, isCrew, autoLaunch, onReveal }: LeadsGuidedTourProps) {
  const steps = useMemo(() => buildTourSteps(isCrew), [isCrew]);
  const total = steps.length;
  const doneKey = `leads-tour-done:${slug}`;

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [step, setStep] = useState(0);

  const autoTriedRef = useRef(false);

  // Автозапуск для новичка: один раз, когда страница реально готова.
  // 2026-09-10 FIX «блокирующей стены»: раньше автозапуск открывал ПОЛНЫЙ
  // модал (fixed inset-0 backdrop) — первые секунды страница не отвечала на
  // клики, и новичок боролся с оверлеем вместо работы. Теперь автозапуск
  // поднимает тур СРАЗУ СВЁРНУТЫМ (пилюля внизу) — страница полностью
  // кликабельна, разворот по желанию. Ручной запуск кнопкой «?» — по-прежнему
  // полный модал (юзер сам попросил).
  useEffect(() => {
    if (!autoLaunch || autoTriedRef.current) return;
    autoTriedRef.current = true;
    let seen = false;
    try {
      seen = window.localStorage.getItem(doneKey) === "1";
    } catch {
      /* private mode — считаем, что не видел */
    }
    if (seen) return;
    const t = window.setTimeout(() => {
      setStep(0);
      setMinimized(true);
      setOpen(true);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [autoLaunch, doneKey]);

  // Закрыть = «пройдено»: тур не должен встречать пользователя снова
  // (вернуться можно кнопкой «?» — она всегда на виду).
  const finish = useCallback(() => {
    setOpen(false);
    setMinimized(false);
    try {
      window.localStorage.setItem(doneKey, "1");
    } catch {
      /* quota/private mode — просто закрываем */
    }
  }, [doneKey]);

  const close = useCallback(() => {
    setOpen(false);
    setMinimized(false);
  }, []);

  const showTarget = useCallback(
    (target: string) => {
      onReveal(target);
      setMinimized(true);
    },
    [onReveal],
  );

  // Esc = закрыть (и отметить пройденным — иначе тур снова встретит).
  useEffect(() => {
    if (!open || minimized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, minimized, finish]);

  // Блокируем скролл страницы под модалкой; в свёрнутом режиме скролл нужен.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = open && !minimized ? "hidden" : prev || "";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [open, minimized]);

  const current = steps[Math.min(step, total - 1)];
  const isLast = step >= total - 1;
  const isGuide = !!current?.guide;

  return (
    <>
      {/* Постоянная точка входа: кнопка «?» справа внизу */}
      <button
        type="button"
        onClick={() => {
          setStep(0);
          setMinimized(false);
          setOpen(true);
        }}
        aria-label="Как работать с лидами — обзор страницы"
        title="Обзор страницы и гайд по лидам"
        className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition active:scale-95 hover:brightness-110"
        style={{ borderColor: T.border, backgroundColor: T.bgCard, color: T.accent }}
      >
        <HelpCircle className="h-5 w-5" aria-hidden />
      </button>

      <AnimatePresence>
        {open && !minimized && (
          <motion.div
            key="tour-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/30"
            onClick={() => setMinimized(true)}
            title="Клик — свернуть обзор и посмотреть страницу"
          >
            {/* Карточка тура: bottom-sheet на телефоне, диалог на sm+.
                Клик по фону НЕ закрывает (прогресс не теряется) — сворачивает. */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Обзор страницы лидов"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:top-1/2 sm:rounded-2xl sm:pb-4"
              style={{ borderColor: T.border, backgroundColor: T.bgCard, color: T.text }}
            >
              {/* Шапка шага */}
              <div className="flex items-start gap-2.5">
                <span aria-hidden className="text-xl leading-none">
                  {current.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.textFaint }}>
                    Обзор · шаг {step + 1} из {total}
                  </p>
                  <h3 className="text-sm font-bold" style={{ color: T.text }}>
                    {current.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  aria-label="Свернуть обзор (страница останется подсвеченной)"
                  title="Посмотреть страницу"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition hover:brightness-110"
                  style={{ borderColor: T.border, color: T.textMuted }}
                >
                  <Minimize2 className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={finish}
                  aria-label="Закрыть обзор"
                  title="Закрыть (больше не откроется само)"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition hover:brightness-110"
                  style={{ borderColor: T.border, color: T.textMuted }}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* Текст шага */}
              <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: T.textMuted }}>
                {current.body}
              </p>

              {/* Финальный шаг: ссылка на полный гайд (playbook page) */}
              {isGuide && (
                <a
                  href={LEADS_GUIDE_HREF}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border text-xs font-bold transition active:scale-[0.99] hover:brightness-110"
                  style={{ borderColor: T.accent, color: T.accent, backgroundColor: `${T.accent}14` }}
                >
                  <BookOpen className="h-4 w-4" aria-hidden />
                  {GUIDE_LABEL}
                </a>
              )}

              {/* Прогресс-точки */}
              <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
                {steps.map((s, i) => (
                  <span
                    key={s.title}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === step ? 18 : 6,
                      backgroundColor: i === step ? T.accent : T.border,
                    }}
                  />
                ))}
              </div>

              {/* Управление */}
              <div className="mt-3 flex items-center gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition active:scale-[0.99]"
                    style={{ borderColor: T.border, color: T.textMuted }}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Назад
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={finish}
                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border text-xs font-semibold transition active:scale-[0.99]"
                    style={{ borderColor: T.border, color: T.textFaint }}
                  >
                    Пропустить
                  </button>
                )}

                {current.target && (
                  <button
                    type="button"
                    onClick={() => showTarget(current.target!)}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition active:scale-[0.99] hover:brightness-110"
                    style={{ borderColor: T.accent, color: T.accent, backgroundColor: `${T.accent}14` }}
                  >
                    Показать
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => (isLast ? finish() : setStep((s) => Math.min(total - 1, s + 1)))}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl text-xs font-bold transition active:scale-[0.99] hover:brightness-110"
                  style={{ backgroundColor: T.accent, color: "#ffffff" }}
                >
                  {isLast ? "Завершить" : "Далее"}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Свёрнутый режим: пилюля внизу — страница видна и скроллится */}
        {open && minimized && (
          <motion.div
            key="tour-pill"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
          >
            <button
              type="button"
              onClick={() => setMinimized(false)}
              className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold shadow-lg transition active:scale-[0.98]"
              style={{ borderColor: T.border, backgroundColor: T.bgCard, color: T.text }}
              title="Вернуться к обзору"
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]" style={{ backgroundColor: `${T.accent}22`, color: T.accent }} aria-hidden>
                {current.emoji}
              </span>
              <span className="truncate">
                Шаг {step + 1}/{total} · {current.title}
              </span>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: T.accent, color: "#ffffff" }}>
                Далее
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
