"use client";

// /gift/roman-quest — the FEATURE TOUR hub (task154 iter3 → task164 BESTSELLER).
// ─────────────────────────────────────────────────────────────────────────────
// Boss audio «BESTSELLER» 29.10: the quest becomes a product. One page, two
// skins (useFeatureTourGate):
//   • birthday (Roman) — «Квест Романа», trail of 10 riddle-stops, finale =
//     the gift at /gift/roman;
//   • tour (everyone else) — «⭐ ФИЧА-ТУР VIP BIKE»: the same trail as a
//     feature showcase with per-card CTA. Crew owners get REAL activation
//     checkboxes for their own crew (POST /api/roman-quest/activations →
//     crews.metadata.feature_tour); guests get ⭐ demo buttons that route to
//     the crew's Telegram; the finale card becomes the sales pitch («Хочу
//     такой экипаж» / owner bulk-activation), NOT the birthday letter.
// noindex. Progress lives in localStorage (roman-quest-progress, shared
// with the stop markers).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  readRomanQuestProgress,
  useFeatureTourGate,
} from "@/components/roman-gift/RomanQuestCake";
import {
  TOUR_FEATURES,
  TOUR_STOPS_TOTAL,
  tourFeatureHasCta,
} from "@/components/roman-gift/tourFeatures";

const CREW_CONTACT_URL = "https://t.me/I_O_S_NN";

export default function RomanQuestOverviewPage() {
  const router = useRouter();
  const gate = useFeatureTourGate();
  const [progress, setProgress] = useState(0);

  // owner activation panel state
  const [ownCrewSlug, setOwnCrewSlug] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagSaving, setFlagSaving] = useState<string | null>(null);
  const [flagError, setFlagError] = useState(false);

  const isBirthday = gate.skin === "birthday" && gate.role === "roman";
  const isOwner = gate.role === "owner";

  useEffect(() => {
    setProgress(readRomanQuestProgress());
  }, []);

  useEffect(() => {
    if (gate.status !== "ready" || !isOwner) return;
    let cancelled = false;
    setFlagsLoading(true);
    fetch("/api/roman-quest/activations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((payload: { crewSlug: string | null; features: Record<string, boolean> }) => {
        if (cancelled) return;
        setOwnCrewSlug(payload.crewSlug);
        setFlags(payload.features || {});
      })
      .catch(() => {
        if (!cancelled) setOwnCrewSlug(null);
      })
      .finally(() => {
        if (!cancelled) setFlagsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gate.status, isOwner]);

  const toggleFlag = useCallback(
    async (featureKey: string, value: boolean) => {
      setFlagSaving(featureKey);
      setFlagError(false);
      try {
        const r = await fetch("/api/roman-quest/activations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featureKey, value }),
        });
        if (!r.ok) throw new Error(String(r.status));
        const payload = (await r.json()) as { features: Record<string, boolean> };
        setFlags(payload.features || {});
      } catch {
        setFlagError(true);
      } finally {
        setFlagSaving(null);
      }
    },
    [],
  );

  const nextStop = useMemo(
    () => TOUR_FEATURES.find((s) => s.stop > progress) ?? null,
    [progress],
  );
  const questDone = progress >= TOUR_STOPS_TOTAL;
  const activatedCount = TOUR_FEATURES.filter((f) => flags[f.key] === true).length;

  const accent = isBirthday ? "amber" : "sky";
  const accentText = isBirthday ? "text-amber-400/85" : "text-sky-400/85";
  const accentGradient = isBirthday
    ? "from-amber-200 via-amber-400 to-amber-200"
    : "from-sky-200 via-sky-400 to-sky-200";
  const doneBorder = isBirthday ? "border-amber-400/40 bg-[#17130c]/90 hover:border-amber-300/70" : "border-sky-400/40 bg-[#0d1117]/90 hover:border-sky-300/70";
  const todoBorder = "border-stone-800 bg-[#12100d]/80 hover:border-sky-400/30";
  const nodeDone = isBirthday
    ? "border-amber-300/70 bg-amber-400/15 text-amber-200"
    : "border-sky-300/70 bg-sky-400/15 text-sky-200";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0c0b09] text-stone-100">
      <div
        className="pointer-events-none absolute inset-0 z-[-1]"
        style={{
          background: isBirthday
            ? "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(212,175,55,0.16), transparent 60%), radial-gradient(ellipse 50% 40% at 85% 30%, rgba(255,154,60,0.07), transparent 60%), radial-gradient(ellipse 60% 50% at 10% 70%, rgba(212,175,55,0.06), transparent 60%)"
            : "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(56,189,248,0.14), transparent 60%), radial-gradient(ellipse 50% 40% at 85% 30%, rgba(99,102,241,0.08), transparent 60%), radial-gradient(ellipse 60% 50% at 10% 70%, rgba(56,189,248,0.05), transparent 60%)",
        }}
      />

      <div className="mx-auto max-w-2xl px-5 pb-32 pt-14 sm:pt-16">
        {/* ── hero ── */}
        <div className="text-center">
          <p className={`font-serif text-[11px] uppercase tracking-[0.45em] ${accentText}`}>
            {isBirthday ? "VIP BIKE · карта квеста · октябрь 2026" : "VIP BIKE · фич-тур · 2026"}
          </p>
          <h1 className="mt-4 font-serif text-4xl font-bold leading-tight sm:text-5xl">
            {isBirthday ? (
              <>
                Квест{" "}
                <span className={`bg-gradient-to-r ${accentGradient} bg-clip-text text-transparent`}>
                  Романа
                </span>
              </>
            ) : (
              <>
                ФИЧА-ТУР{" "}
                <span className={`bg-gradient-to-r ${accentGradient} bg-clip-text text-transparent`}>
                  VIP BIKE
                </span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-stone-300">
            {isBirthday
              ? "Экипаж спрятал подарок и разложил его след по самым интересным страницам приложения. Каждая остановка — не просто страница, а штука, которая тебе пригодится."
              : "Самый богатый набор фич в проекте — десять остановок, каждая про то, что умеет VIP BIKE. Смотрите, пробуйте, а владельцы экипажей включают фичи для своей команды прямо здесь."}
          </p>

          {/* progress */}
          <div className="mx-auto mt-7 max-w-md">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-stone-500">
              <span>прогресс</span>
              <span className={isBirthday ? "text-amber-300" : "text-sky-300"}>
                {Math.min(progress, TOUR_STOPS_TOTAL)} / {TOUR_STOPS_TOTAL}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-800">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${
                  isBirthday ? "from-amber-600 via-amber-400 to-amber-200" : "from-sky-600 via-sky-400 to-sky-200"
                }`}
                style={{ width: `${Math.min(100, (Math.min(progress, TOUR_STOPS_TOTAL) / TOUR_STOPS_TOTAL) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── owner activation panel ── */}
        {isOwner && (
          <section className="mt-10 rounded-2xl border border-sky-400/30 bg-[#0d1117]/85 p-6">
            <h2 className="font-serif text-lg font-semibold text-sky-100">
              ☑ Активация для экипажа{ownCrewSlug ? <span className="ml-2 font-mono text-sm text-sky-300">{ownCrewSlug}</span> : null}
            </h2>
            <p className="mt-1 text-sm text-stone-400">
              Галочка включает фичу для вашего экипажа — конфиг хранится в metadata экипажа.
            </p>
            {flagsLoading ? (
              <p className="mt-4 text-sm text-stone-500">Загружаю флаги…</p>
            ) : ownCrewSlug ? (
              <>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {TOUR_FEATURES.filter((f) => tourFeatureHasCta(f.key)).map((f) => (
                    <label
                      key={f.key}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-800 bg-[#10141b] px-4 py-3 text-sm transition hover:border-sky-400/40"
                    >
                      <input
                        type="checkbox"
                        checked={flags[f.key] === true}
                        disabled={flagSaving === f.key}
                        onChange={() => void toggleFlag(f.key, flags[f.key] !== true)}
                        className="h-5 w-5 cursor-pointer accent-sky-400"
                      />
                      <span className="min-w-0 flex-1 text-stone-200">
                        <span className="mr-1.5" aria-hidden>{f.icon}</span>
                        {f.title}
                      </span>
                      {flagSaving === f.key && <span className="text-xs text-stone-500">…</span>}
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-stone-500">
                  Включено: {activatedCount} из {TOUR_FEATURES.filter((f) => tourFeatureHasCta(f.key)).length}
                  {flagError && <span className="ml-2 text-red-400">не сохранилось — попробуй ещё</span>}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-stone-500">
                Не вижу экипажа, где вы владелец — галочки появляются автоматически.
              </p>
            )}
          </section>
        )}

        {/* ── trail ── */}
        <ol className="relative mt-12 space-y-4">
          {/* vertical trail line */}
          <div
            aria-hidden
            className="absolute bottom-6 left-[27px] top-6 w-px bg-gradient-to-b from-sky-400/40 via-stone-700 to-stone-800"
          />

          {TOUR_FEATURES.map((s) => {
            const done = progress >= s.stop;
            return (
              <li key={s.href} className="relative">
                <button
                  type="button"
                  onClick={() => router.push(s.href)}
                  className={
                    "group w-full rounded-2xl border p-5 text-left transition-all duration-300 " +
                    (done ? doneBorder : todoBorder)
                  }
                >
                  <div className="flex items-start gap-4">
                    {/* node on the trail */}
                    <span
                      className={
                        "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm transition-colors " +
                        (done ? nodeDone : "border-stone-700 bg-[#0c0b09] text-stone-500")
                      }
                    >
                      {done ? "✓" : s.stop}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className={"font-serif text-lg font-medium " + (done ? (isBirthday ? "text-amber-200" : "text-sky-200") : "text-stone-200")}>
                          <span className="mr-2" aria-hidden>{s.icon}</span>
                          {s.title}
                        </h2>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-stone-600 group-hover:text-stone-500">
                          {s.page}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-stone-400">{s.pitch}</p>
                      {/* CTA row on the card */}
                      {tourFeatureHasCta(s.key) && !isBirthday && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {isOwner && ownCrewSlug ? (
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs text-sky-200">
                              <input
                                type="checkbox"
                                checked={flags[s.key] === true}
                                disabled={flagSaving === s.key}
                                onChange={() => void toggleFlag(s.key, flags[s.key] !== true)}
                                className="h-4 w-4 cursor-pointer accent-sky-400"
                              />
                              включить для {ownCrewSlug}
                            </label>
                          ) : (
                            <span className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs text-sky-200">
                              ⭐ {s.priceStars} · подключить
                            </span>
                          )}
                        </div>
                      )}
                      <span className={"mt-2 inline-block text-xs transition-colors " + (isBirthday ? "text-amber-400/70 group-hover:text-amber-300" : "text-sky-400/70 group-hover:text-sky-300")}>
                        {done ? "пройдено · зайти ещё →" : "открыть страницу →"}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}

          {/* ── final card: split finale ── */}
          <li className="relative">
            {isBirthday ? (
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
                    ? "Все десять следов собраны — подарок твой. Заходи."
                    : `Собери все ${TOUR_STOPS_TOTAL} следов — и он откроется.`}
                </p>
              </button>
            ) : (
              <div className="w-full rounded-2xl border border-sky-400/40 bg-gradient-to-b from-sky-400/10 to-sky-600/5 p-6 text-center">
                <div className="text-4xl">⭐</div>
                <h2 className="mt-2 font-serif text-xl font-semibold text-sky-100">
                  {isOwner ? "Соберите свой набор" : "Хочу такой экипаж"}
                </h2>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-stone-400">
                  {isOwner
                    ? ownCrewSlug
                      ? `Галочками выше включите фичи для экипажа ${ownCrewSlug} — набор собирается под вас.`
                      : "Зайдите через Telegram — галочки активации появятся автоматически."
                    : "Всё, что вы видели на этом туре, работает у экипажа VIP BIKE прямо сейчас. Хотите так же — напишите экипажу, развернём и для вашей команды."}
                </p>
                {!isOwner && (
                  <a
                    href={CREW_CONTACT_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-4 inline-block rounded-xl border border-sky-400/60 bg-sky-400/10 px-6 py-3 font-serif text-sky-200 transition hover:bg-sky-400/20 hover:text-sky-100"
                  >
                    Написать экипажу в Telegram →
                  </a>
                )}
                {questDone && (
                  <p className="mt-3 text-xs text-stone-500">
                    Тур пройден: {TOUR_STOPS_TOTAL} из {TOUR_STOPS_TOTAL} — вы видели всё.
                  </p>
                )}
              </div>
            )}
          </li>
        </ol>

        {/* ── footer ── */}
        <footer className="mt-12 text-center">
          <div className="font-serif text-2xl font-bold tracking-[0.3em] text-stone-100">
            VIP<span className={isBirthday ? "text-amber-400" : "text-sky-400"}>BIKE</span>
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-stone-600">
            {isBirthday ? "спрятано экипажем · найдено тобой · 2026" : "десять фич · один тур · 2026"}
          </p>
        </footer>
      </div>

      {/* ── sticky continue CTA ── */}
      {!questDone && nextStop && (
        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-stone-700/60 bg-[#0c0b09]/95 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-stone-500">
                {isBirthday ? "следующий след" : "следующая фича"}
              </p>
              <p className="truncate font-serif text-sm text-stone-100">
                {nextStop.icon} {nextStop.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(nextStop.href)}
              className={
                "shrink-0 rounded-xl border px-6 py-3 font-serif text-base transition-all duration-300 " +
                (isBirthday
                  ? "border-amber-400/60 bg-gradient-to-b from-amber-400/15 to-amber-600/10 text-amber-200 hover:from-amber-400/25 hover:text-amber-100"
                  : "border-sky-400/60 bg-gradient-to-b from-sky-400/15 to-sky-600/10 text-sky-200 hover:from-sky-400/25 hover:text-sky-100")
              }
            >
              {isBirthday ? "Продолжить квест →" : "Следующая фича →"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
