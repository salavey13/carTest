"use client";

// RomanQuestCake → FEATURE TOUR stop (task154 iter2+iter3 → task164 BESTSELLER)
// ──────────────────────────────────────────────────────────────────────────
// A tiny floating marker sits in the bottom-left corner of a host page:
//   🎂 birthday skin — Roman only (gate role "roman"): the original riddle
//      trail, «Роман, это для тебя», ends at /gift/roman.
//   ⭐ tour skin — everyone else (boss audio «BESTSELLER»: «если кто-то
//      другой заходит вместо Романа — всё покажу, всё также расскажу,
//      интересно, только он ещё может нажать кнопку»): the SAME trail, but
//      every stop is a feature pitch with a CTA —
//        • crew owners: a real ☑ «Включить для экипажа …» checkbox
//          (POST /api/roman-quest/activations → crews.metadata.feature_tour
//          of the crew THEY OWN — even while browsing someone else's page);
//        • guests/members: «⭐ N · Подключить» — Telegram-Stars demo button
//          (boss: «фейк-кнопки пока») that routes to the crew's Telegram.
//
// GATE v2 (see app/api/roman-quest/gate/route.ts): the tour is PUBLIC now —
// renters/anonymous see the ⭐ sales skin; only the birthday skin is
// personal. Progress stays in localStorage under "roman-quest-progress"
// (max stop reached) — shared by the gift page and the overview.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  tourFeatureByKey,
  tourFeatureHasCta,
} from "./tourFeatures";

export const ROMAN_QUEST_KEY = "roman-quest-progress";

export function readRomanQuestProgress(): number {
  try {
    return Number(window.localStorage.getItem(ROMAN_QUEST_KEY) || "0") || 0;
  } catch {
    return 0;
  }
}

export type TourGateRole = "roman" | "owner" | "member" | "guest";
export type TourGateSkin = "birthday" | "tour";

export interface TourGateState {
  status: "loading" | "ready";
  skin: TourGateSkin;
  role: TourGateRole;
  crewSlug?: string;
}

const GATE_SESSION_KEY = "roman-quest-gate-v2";

const LOADING_GATE: TourGateState = { status: "loading", skin: "tour", role: "guest" };

function readGateFromSession(): TourGateState | null {
  try {
    const raw = window.sessionStorage.getItem(GATE_SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<TourGateState>;
    if (
      (v.skin === "birthday" || v.skin === "tour") &&
      v.role &&
      ["roman", "owner", "member", "guest"].includes(v.role)
    ) {
      return {
        status: "ready",
        skin: v.skin,
        role: v.role as TourGateRole,
        crewSlug: typeof v.crewSlug === "string" ? v.crewSlug : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeGateToSession(state: TourGateState) {
  try {
    window.sessionStorage.setItem(
      GATE_SESSION_KEY,
      JSON.stringify({ skin: state.skin, role: state.role, crewSlug: state.crewSlug }),
    );
  } catch {
    /* private mode — best-effort cache */
  }
}

/**
 * Shared audience gate for every tour surface (stops + overview + gift).
 * Resolves once per browser session via /api/roman-quest/gate. Fail-open:
 * a gate outage degrades to the public tour skin, never to a blank page.
 */
export function useFeatureTourGate(): TourGateState {
  const [state, setState] = useState<TourGateState>(LOADING_GATE);

  useEffect(() => {
    let cancelled = false;
    const cached = readGateFromSession();
    if (cached) {
      setState(cached);
      return;
    }
    fetch("/api/roman-quest/gate", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { skin?: string; role?: string; crewSlug?: string }) => {
        if (cancelled) return;
        const next: TourGateState = {
          status: "ready",
          skin: data?.skin === "birthday" ? "birthday" : "tour",
          role:
            data?.role === "roman" || data?.role === "owner" || data?.role === "member"
              ? data.role
              : "guest",
          crewSlug: typeof data?.crewSlug === "string" ? data.crewSlug : undefined,
        };
        writeGateToSession(next);
        setState(next);
      })
      .catch(() => {
        if (cancelled) return;
        const next: TourGateState = { status: "ready", skin: "tour", role: "guest" };
        writeGateToSession(next);
        setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** @deprecated v2 name — kept for one release so old imports still resolve. */
export const useRomanQuestGate = useFeatureTourGate;

interface RomanQuestCakeProps {
  /** Which stop of the trail this host page is (1..10). */
  stop: number;
  /** Birthday: the riddle. Tour: the feature pitch (same text works for both). */
  riddle: string;
  /** Where the "next" button leads (next stop or the finale). */
  nextHref: string;
  /** Label for the next button. */
  nextLabel: string;
  /** Catalog key of the feature this stop sells — enables the CTA row. */
  featureKey?: string;
}

const STOPS_TOTAL = 10;

/** Total stops in the trail — the gift page reads it for its stamp. */
export const ROMAN_QUEST_STOPS = STOPS_TOTAL;

const CREW_CONTACT_URL = "https://t.me/I_O_S_NN";

// ── owner activation state (per modal open) ────────────────────────────────
type ActivationState = "unknown" | "on" | "off";
interface ActivationsPayload {
  crewSlug: string | null;
  features: Record<string, boolean>;
}

function useActivations(open: boolean) {
  const [data, setData] = useState<ActivationsPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData(null);
    setSaveError(false);
    fetch("/api/roman-quest/activations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((payload: ActivationsPayload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setData({ crewSlug: null, features: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggle = useCallback(
    async (featureKey: string, value: boolean): Promise<boolean> => {
      setSaving(true);
      setSaveError(false);
      try {
        const r = await fetch("/api/roman-quest/activations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featureKey, value }),
        });
        if (!r.ok) throw new Error(String(r.status));
        const payload = (await r.json()) as ActivationsPayload & { ok?: boolean };
        if (payload.features) setData({ crewSlug: payload.crewSlug, features: payload.features });
        return true;
      } catch {
        setSaveError(true);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { data, saving, saveError, toggle };
}

export function RomanQuestCake({ stop, riddle, nextHref, nextLabel, featureKey }: RomanQuestCakeProps) {
  const router = useRouter();
  const gate = useFeatureTourGate();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buyDemoOpen, setBuyDemoOpen] = useState(false);
  const activations = useActivations(open);

  const feature = featureKey ? tourFeatureByKey(featureKey) : undefined;
  const ctaOn = Boolean(feature && tourFeatureHasCta(feature.key));

  useEffect(() => {
    setProgress(readRomanQuestProgress());
  }, []);

  const isBirthday = gate.skin === "birthday" && gate.role === "roman";
  const isOwner = gate.role === "owner";
  const markerIcon = isBirthday ? "🎂" : "⭐";
  const modalKicker = isBirthday ? `Подсказка ${stop} из ${STOPS_TOTAL}` : `Фича ${stop} из ${STOPS_TOTAL}`;
  const modalTitle = isBirthday ? "Роман, это для тебя" : "ФИЧА-ТУР VIP BIKE";

  // task164 — the last stop's «Открыть подарок» leads to the birthday letter
  // for Roman and to the TOUR FINALE (sales hub) for everyone else. Host pages
  // stay skin-agnostic.
  const finaleHref = "/gift/roman";
  const isFinaleStep = nextHref === finaleHref;
  const resolvedNextHref = isFinaleStep && !isBirthday ? "/gift/roman-quest" : nextHref;
  const resolvedNextLabel = isFinaleStep && !isBirthday ? "К финалу тура" : nextLabel;

  const handleOpen = useCallback(() => {
    setOpen(true);
    setBuyDemoOpen(false);
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
    router.push(resolvedNextHref);
  }, [resolvedNextHref, router]);

  const featureFlag: ActivationState = !ctaOn || !feature
    ? "unknown"
    : activations.data?.features[feature.key] === true
      ? "on"
      : activations.data?.features[feature.key] === false
        ? "off"
        : "unknown";

  const handleOwnerToggle = useCallback(() => {
    if (!feature || !activations.data?.crewSlug || activations.saving) return;
    const nextValue = featureFlag !== "on";
    void activations.toggle(feature.key, nextValue);
  }, [activations, feature, featureFlag]);

  // Render nothing while the verdict loads — no flash for anyone, no layout
  // shift on host pages. (v2: the tour renders for EVERYONE once resolved.)
  if (gate.status === "loading") return null;

  return (
    <>
      {/* The hidden trigger: a small dim marker in the corner */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label={isBirthday ? "Торт" : "Фича-тур"}
        title={markerIcon}
        className={
          "fixed bottom-4 left-4 z-[70] flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 sm:h-11 sm:w-11 " +
          (isBirthday
            ? "border-amber-400/40 bg-black/60 text-lg hover:border-amber-300/80 hover:bg-black/80 hover:shadow-amber-500/20"
            : "border-sky-400/30 bg-black/60 text-lg hover:border-sky-300/70 hover:bg-black/80 hover:shadow-sky-500/20")
        }
        style={{ opacity: 0.55 }}
      >
        <span aria-hidden>{markerIcon}</span>
        {progress >= stop && (
          <span
            className={
              "absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-black " +
              (isBirthday ? "bg-amber-400" : "bg-sky-400")
            }
          />
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
            className={
              "relative w-full max-w-md overflow-hidden rounded-2xl border p-7 text-center shadow-[0_0_60px_rgba(120,170,255,0.12)] " +
              (isBirthday
                ? "border-amber-400/35 bg-[#101014]"
                : "border-sky-400/30 bg-[#0d1016]")
            }
            onClick={(e) => e.stopPropagation()}
          >
            {/* subtle top hairline */}
            <div
              className={
                "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent " +
                (isBirthday ? "via-amber-400/70" : "via-sky-400/60")
              }
            />

            <div className="text-4xl">{markerIcon}</div>
            <p
              className={
                "mt-3 font-serif text-[11px] uppercase tracking-[0.35em] " +
                (isBirthday ? "text-amber-400/80" : "text-sky-400/80")
              }
            >
              {modalKicker}
            </p>
            <h3 className={"mt-2 font-serif text-2xl font-semibold " + (isBirthday ? "text-amber-50" : "text-sky-50")}>
              {modalTitle}
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-stone-300">{riddle}</p>
            {!isBirthday && feature && (
              <p className="mt-3 text-[13px] leading-relaxed text-stone-400">
                <span className="text-sky-300/90">Что это даёт экипажу:</span> {feature.gives}
              </p>
            )}

            {/* progress dots */}
            <div className="mt-5 flex items-center justify-center gap-2">
              {Array.from({ length: STOPS_TOTAL }, (_, i) => i + 1).map((i) => (
                <span
                  key={i}
                  className={
                    "h-1.5 w-6 rounded-full transition-colors " +
                    (progress >= i
                      ? isBirthday
                        ? "bg-amber-400"
                        : "bg-sky-400"
                      : "bg-stone-700")
                  }
                />
              ))}
            </div>

            {/* CTA row — tour skin only, feature stops only */}
            {!isBirthday && ctaOn && feature && (
              <div className="mt-5 rounded-xl border border-sky-400/25 bg-sky-400/5 p-4">
                {isOwner && activations.data?.crewSlug ? (
                  <label className="flex cursor-pointer items-center justify-center gap-3 text-sm text-stone-200">
                    <input
                      type="checkbox"
                      checked={featureFlag === "on"}
                      onChange={handleOwnerToggle}
                      disabled={activations.saving}
                      className="h-5 w-5 cursor-pointer accent-sky-400"
                    />
                    <span>
                      Включить для экипажа{" "}
                      <span className="font-mono text-sky-300">{activations.data.crewSlug}</span>
                      {featureFlag === "on" ? " — включено ✓" : ""}
                    </span>
                  </label>
                ) : isOwner ? (
                  <p className="text-xs text-stone-500">Загружаю галочки активации…</p>
                ) : buyDemoOpen ? (
                  <div className="text-sm leading-relaxed text-stone-300">
                    <p>
                      Демо-режим: оплата звёздами подключается следом. Хотите такую фичу для
                      своего экипажа — напишите экипажу, включим вручную прямо сейчас.
                    </p>
                    <a
                      href={CREW_CONTACT_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 inline-block rounded-xl border border-sky-400/60 bg-sky-400/10 px-5 py-2.5 font-medium text-sky-200 transition hover:bg-sky-400/20 hover:text-sky-100"
                    >
                      Написать экипажу в Telegram →
                    </a>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBuyDemoOpen(true)}
                    className="w-full rounded-xl border border-sky-400/60 bg-gradient-to-b from-sky-400/15 to-sky-600/10 px-5 py-3 font-serif text-base font-medium text-sky-200 transition-all duration-300 hover:from-sky-400/25 hover:text-sky-100"
                  >
                    ⭐ {feature.priceStars} · Подключить фичу
                  </button>
                )}
                {activations.saveError && (
                  <p className="mt-2 text-xs text-red-400">Не сохранилось — попробуй ещё раз</p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleNext}
              className={
                "mt-6 w-full rounded-xl border px-6 py-3 font-serif text-base font-medium tracking-wide transition-all duration-300 " +
                (isBirthday
                  ? "border-amber-400/60 bg-gradient-to-b from-amber-400/15 to-amber-600/10 text-amber-200 hover:from-amber-400/25 hover:to-amber-600/20 hover:text-amber-100"
                  : "border-sky-400/60 bg-gradient-to-b from-sky-400/15 to-sky-600/10 text-sky-200 hover:from-sky-400/25 hover:to-sky-600/20 hover:text-sky-100")
              }
            >
              {resolvedNextLabel} →
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
