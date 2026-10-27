"use client";

// /gift/roman-quest — the quest overview (task154 iter3, boss: «create an
// awesome overview out of Roman's quest» + «more pages about features»).
// ─────────────────────────────────────────────────────────────────────────────
// A warm dark-gold companion page that doubles as TWO things:
//   1. The quest launcher — the whole 7-stop trail on one map, with live
//      progress from localStorage and a «Продолжить квест» button that jumps
//      straight to the first uncompleted stop.
//   2. The features overview for Roman — every stop card explains what that
//      page GIVES him (the crew's answer to «he seldomly opens it up — what
//      is the list of useful things for him?»).
//
// GATED like the cakes: useRomanQuestGate() — vip-bike crew & anonymous PC
// see the map, TG-identified simple users get an empty page. noindex.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  readRomanQuestProgress,
  ROMAN_QUEST_STOPS,
  useRomanQuestGate,
} from "@/components/roman-gift/RomanQuestCake";

const QUEST_STOPS: Array<{
  n: number;
  href: string;
  icon: string;
  title: string;
  page: string;
  pitch: string;
}> = [
  {
    n: 1,
    href: "/",
    icon: "🏠",
    title: "Главный экран",
    page: "vip-bike-лендинг",
    pitch: "Лицо всего проекта: витрина, парк, цены. То, что видит каждый гость — и то, чем вы управляете.",
  },
  {
    n: 2,
    href: "/franchize/vip-bike",
    icon: "🏍️",
    title: "Витрина экипажа",
    page: "/franchize/vip-bike",
    pitch: "Свой каталог со корзиной: гость выбирает байк и даты сам, бот оформляет договор и напоминания.",
  },
  {
    n: 3,
    href: "/franchize/discovery",
    icon: "🛰",
    title: "Карта сети",
    page: "/franchize/discovery",
    pitch: "Все экипажи проекта — круги, размер которых это люди. Видно, какой мир вы с Ильёй строите.",
  },
  {
    n: 4,
    href: "/leaderboard",
    icon: "🏆",
    title: "Зал славы",
    page: "/leaderboard",
    pitch: "Топы экипажей и флотов всего проекта с живыми цифрами. Место vip-bike в большой игре.",
  },
  {
    n: 5,
    href: "/rent-bike",
    icon: "⚙️",
    title: "MOTO-GARAGE",
    page: "/rent-bike",
    pitch: "Гараж изнутри: выбрал байк, тапнул даты — бронирование собрано. Так катают ваши райдеры.",
  },
  {
    n: 6,
    href: "/franchize/vip-bike/map-riders",
    icon: "🗺",
    title: "Карта райдеров",
    page: "/franchize/vip-bike/map-riders",
    pitch: "Live-карта экипажа: кто где катает, meetup-точки, статусы поездок. Экипаж на ладони.",
  },
  {
    n: 7,
    href: "/franchize/vip-bike/season-stats",
    icon: "📈",
    title: "Цифры сезона",
    page: "/franchize/vip-bike/season-stats",
    pitch: "Весь сезон 2026 до рубля: аренды, продажи, касса и сверка расчётов. Деньги со-владельца — на одном табло.",
  },
];

export default function RomanQuestOverviewPage() {
  const router = useRouter();
  const gate = useRomanQuestGate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(readRomanQuestProgress());
  }, []);

  const nextStop = useMemo(
    () => QUEST_STOPS.find((s) => s.n > progress) ?? null,
    [progress],
  );
  const questDone = progress >= ROMAN_QUEST_STOPS;

  // GATE: simple TG users (renters) get nothing — same contract as the cakes.
  if (gate === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0c0b09]">
        <div className="text-3xl animate-pulse">🎂</div>
      </main>
    );
  }
  if (gate === "hidden") return null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0c0b09] text-amber-50">
      <div
        className="pointer-events-none absolute inset-0 z-[-1]"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(212,175,55,0.16), transparent 60%), radial-gradient(ellipse 50% 40% at 85% 30%, rgba(255,154,60,0.07), transparent 60%), radial-gradient(ellipse 60% 50% at 10% 70%, rgba(212,175,55,0.06), transparent 60%)",
        }}
      />

      <div className="mx-auto max-w-2xl px-5 pb-32 pt-14 sm:pt-16">
        {/* ── hero ── */}
        <div className="text-center">
          <p className="font-serif text-[11px] uppercase tracking-[0.45em] text-amber-400/85">
            VIP BIKE · карта квеста · октябрь 2026
          </p>
          <h1 className="mt-4 font-serif text-4xl font-bold leading-tight sm:text-5xl">
            Квест{" "}
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Романа
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-stone-300">
            Экипаж спрятал подарок и разложил его след по самым интересным страницам приложения.
            Каждая остановка — не просто страница, а штука, которая тебе пригодится.
          </p>

          {/* progress */}
          <div className="mx-auto mt-7 max-w-md">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-stone-500">
              <span>прогресс</span>
              <span className="text-amber-300">
                {Math.min(progress, ROMAN_QUEST_STOPS)} / {ROMAN_QUEST_STOPS}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-200 transition-all duration-700"
                style={{ width: `${Math.min(100, (Math.min(progress, ROMAN_QUEST_STOPS) / ROMAN_QUEST_STOPS) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── trail ── */}
        <ol className="relative mt-12 space-y-4">
          {/* vertical trail line */}
          <div
            aria-hidden
            className="absolute bottom-6 left-[27px] top-6 w-px bg-gradient-to-b from-amber-400/40 via-stone-700 to-stone-800"
          />

          {QUEST_STOPS.map((s) => {
            const done = progress >= s.n;
            return (
              <li key={s.href} className="relative">
                <button
                  type="button"
                  onClick={() => router.push(s.href)}
                  className={
                    "group w-full rounded-2xl border p-5 text-left transition-all duration-300 " +
                    (done
                      ? "border-amber-400/40 bg-[#17130c]/90 hover:border-amber-300/70"
                      : "border-stone-800 bg-[#12100d]/80 hover:border-amber-400/35")
                  }
                >
                  <div className="flex items-start gap-4">
                    {/* node on the trail */}
                    <span
                      className={
                        "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm transition-colors " +
                        (done
                          ? "border-amber-300/70 bg-amber-400/15 text-amber-200"
                          : "border-stone-700 bg-[#0c0b09] text-stone-500")
                      }
                    >
                      {done ? "✓" : s.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className={"font-serif text-lg font-medium " + (done ? "text-amber-200" : "text-stone-200")}>
                          <span className="mr-2" aria-hidden>{s.icon}</span>
                          {s.title}
                        </h2>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-stone-600 group-hover:text-stone-500">
                          {s.page}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-stone-400">{s.pitch}</p>
                      <span className="mt-2 inline-block text-xs text-amber-400/70 transition-colors group-hover:text-amber-300">
                        {done ? "пройдено · зайти ещё →" : "открыть страницу →"}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}

          {/* final card — the gift */}
          <li className="relative">
            <button
              type="button"
              onClick={() => router.push("/gift/roman")}
              className={
                "group w-full rounded-2xl border p-6 text-center transition-all duration-300 " +
                (questDone
                  ? "border-amber-300/70 bg-gradient-to-b from-amber-400/15 to-amber-600/10 shadow-[0_0_50px_rgba(212,175,55,0.18)] hover:border-amber-200"
                  : "border-stone-800 bg-[#0f0d0a]/80")
              }
            >
              <div className={"text-4xl " + (questDone ? "" : "opacity-50 grayscale")}>🎁</div>
              <h2 className={"mt-2 font-serif text-xl font-semibold " + (questDone ? "text-amber-100" : "text-stone-500")}>
                Твой подарок
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-stone-400">
                {questDone
                  ? "Все семь следов собраны. Осталось нажать одну кнопку."
                  : `Собери все ${ROMAN_QUEST_STOPS} следов — и он откроется.`}
              </p>
            </button>
          </li>
        </ol>

        {/* ── footer ── */}
        <footer className="mt-12 text-center">
          <div className="font-serif text-2xl font-bold tracking-[0.3em] text-amber-100">
            VIP<span className="text-amber-400">BIKE</span>
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-stone-600">
            спрятано экипажем · найдено тобой · 2026
          </p>
        </footer>
      </div>

      {/* ── sticky continue CTA ── */}
      {!questDone && nextStop && (
        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-amber-400/20 bg-[#0c0b09]/95 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-stone-500">следующий след</p>
              <p className="truncate font-serif text-sm text-amber-200">
                {nextStop.icon} {nextStop.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(nextStop.href)}
              className="shrink-0 rounded-xl border border-amber-400/60 bg-gradient-to-b from-amber-400/15 to-amber-600/10 px-6 py-3 font-serif text-base text-amber-200 transition-all duration-300 hover:from-amber-400/25 hover:text-amber-100"
            >
              Продолжить квест →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
