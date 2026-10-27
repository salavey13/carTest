"use client";

// RomanQuestCake — hidden birthday quest stop for Roman (task154)
// ──────────────────────────────────────────────────────────────────────────
// A tiny floating 🎂 sits in the bottom-left corner of a host page. Most
// visitors never notice it; Roman follows the riddle trail from the kickoff
// message. Each click opens a warm dark-gold modal with a riddle that points
// to the next stop (or to the gift itself on the last stop).
//
// Progress lives in localStorage under "roman-quest-progress" (max stop
// reached) — the gift page reads the same key to show the quest stamp.
// Zero server dependencies: pure client, no auth, no tracking, no DB.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const ROMAN_QUEST_KEY = "roman-quest-progress";

export function readRomanQuestProgress(): number {
  try {
    return Number(window.localStorage.getItem(ROMAN_QUEST_KEY) || "0") || 0;
  } catch {
    return 0;
  }
}

interface RomanQuestCakeProps {
  /** Which stop of the trail this host page is (1..3). */
  stop: 1 | 2 | 3;
  /** Riddle text shown in the modal. */
  riddle: string;
  /** Where the "next" button leads (next stop or the gift). */
  nextHref: string;
  /** Label for the next button. */
  nextLabel: string;
}

const STOPS_TOTAL = 3;

export function RomanQuestCake({ stop, riddle, nextHref, nextLabel }: RomanQuestCakeProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(readRomanQuestProgress());
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    try {
      const prev = readRomanQuestProgress();
      if (stop > prev) window.localStorage.setItem(ROMAN_QUEST_KEY, String(stop));
      setProgress(Math.max(prev, stop));
    } catch {
      /* private mode — progress is best-effort */
    }
  }, [stop]);

  const handleNext = useCallback(() => {
    setOpen(false);
    router.push(nextHref);
  }, [nextHref, router]);

  return (
    <>
      {/* The hidden trigger: a small dim cake in the corner */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Торт"
        title="🎂"
        className="fixed bottom-4 left-4 z-[70] flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/40 bg-black/60 text-lg shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-amber-300/80 hover:bg-black/80 hover:shadow-amber-500/20 sm:h-11 sm:w-11"
        style={{ opacity: 0.55 }}
      >
        <span aria-hidden>🎂</span>
        {progress >= stop && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-black bg-amber-400" />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-400/35 bg-[#101014] p-7 text-center shadow-[0_0_60px_rgba(212,175,55,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* subtle gold top hairline */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

            <div className="text-4xl">🎂</div>
            <p className="mt-3 font-serif text-[11px] uppercase tracking-[0.35em] text-amber-400/80">
              Подсказка {stop} из {STOPS_TOTAL}
            </p>
            <h3 className="mt-2 font-serif text-2xl font-semibold text-amber-50">Роман, это для тебя</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-stone-300">{riddle}</p>

            {/* progress dots */}
            <div className="mt-5 flex items-center justify-center gap-2">
              {Array.from({ length: STOPS_TOTAL }, (_, i) => i + 1).map((i) => (
                <span
                  key={i}
                  className={
                    "h-1.5 w-8 rounded-full transition-colors " +
                    (progress >= i ? "bg-amber-400" : "bg-stone-700")
                  }
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="mt-6 w-full rounded-xl border border-amber-400/60 bg-gradient-to-b from-amber-400/15 to-amber-600/10 px-6 py-3 font-serif text-base font-medium tracking-wide text-amber-200 transition-all duration-300 hover:from-amber-400/25 hover:to-amber-600/20 hover:text-amber-100"
            >
              {nextLabel} →
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 text-xs text-stone-500 transition-colors hover:text-stone-300"
            >
              Позже
            </button>
          </div>
        </div>
      )}
    </>
  );
}
