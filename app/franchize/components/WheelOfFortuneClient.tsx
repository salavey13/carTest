// /app/franchize/components/WheelOfFortuneClient.tsx
"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Колесо фортуны для franchize-витрин (boss 2026-10-11).
//
// Портировано из /components/WheelOfFortune.tsx («счастливое число» + админка
// победителей) в промо-колесо с реальными наградами: сегмент = хардкодный
// промокод (WHEEL1000/2000/5000/15%), который валидируется сервером
// (validateFranchizePromoCode → BUILT_IN_PROMO_CODES) и применяется в корзине.
//
// Отличия от оригинала:
//  · индекс выигрыша выбирается ДО анимации (weighted), колесо докручивается
//    точно до него — визуал всегда совпадает с фактическим призом (в старом
//    варианте сегмент вычислялся из остатка поворота и мог разойтись с UI);
//  · лимит 1 крутка / 24 ч на экипаж в localStorage (?demo=1 снимает);
//  · результат ведёт в корзину с ?promo=CODE — корзина валидирует код
//    сервером и применяет скидку (та же математика, что и ручной ввод).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Copy, Check, RotateCw, Ticket, ShoppingCart, Sparkles } from "lucide-react";

import type { FranchizeCrewVM } from "../actions";
import { useCrewTokens } from "../lib/use-crew-tokens";
import {
  WHEEL_SEGMENTS,
  WHEEL_SEGMENT_ANGLE,
  WHEEL_PROMO_CODES,
  computeTargetRotation,
  pickWeightedSegmentIndex,
  readLastSpinAt,
  writeLastSpinAt,
  spinCooldownRemainingMs,
  formatCooldown,
  type WheelSegment,
} from "../lib/wheel-of-fortune";

const SPIN_DURATION_S = 5;

type SpinResult =
  | { kind: "promo"; segment: WheelSegment; promoCode: string }
  | { kind: "respin"; segment: WheelSegment }
  | { kind: "miss"; segment: WheelSegment };

interface WheelOfFortuneClientProps {
  crew: FranchizeCrewVM;
  slug: string;
}

export function WheelOfFortuneClient({ crew, slug }: WheelOfFortuneClientProps) {
  const T = useCrewTokens(crew.theme);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [cooldownMs, setCooldownMs] = useState(0);
  const isDemoModeRef = useRef(false);

  // ?demo=1 — босс-тест: снимает суточный лимит круток.
  useEffect(() => {
    isDemoModeRef.current = new URLSearchParams(window.location.search).get("demo") === "1";
  }, []);

  // Тик кулдауна: пересчитываем остаток каждые 30 секунд.
  useEffect(() => {
    const recompute = () => {
      if (isDemoModeRef.current) {
        setCooldownMs(0);
        return;
      }
      setCooldownMs(spinCooldownRemainingMs(readLastSpinAt(window.localStorage, slug)));
    };
    recompute();
    const timer = window.setInterval(recompute, 30_000);
    return () => window.clearInterval(timer);
  }, [slug]);

  const uniqueAwards = useMemo(() => {
    const seen = new Set<string>();
    return WHEEL_PROMO_CODES.filter((promo) => {
      if (seen.has(promo.code)) return false;
      seen.add(promo.code);
      return true;
    });
  }, []);

  const handleSpinComplete = useCallback(
    (segmentIndex: number) => {
      const segment = WHEEL_SEGMENTS[segmentIndex];
      setIsSpinning(false);

      if (segment.kind === "promo" && segment.promoCode) {
        setResult({ kind: "promo", segment, promoCode: segment.promoCode });
        writeLastSpinAt(window.localStorage, slug, Date.now());
        toast.success(`Выигрыш: ${segment.label}! Промокод ${segment.promoCode}`);
        return;
      }

      if (segment.kind === "respin") {
        setResult({ kind: "respin", segment });
        // «Ещё раз» не записывает кулдаун — крутка остаётся доступной.
        toast.info("Ещё одна крутка! Крути смело.");
        return;
      }

      setResult({ kind: "miss", segment });
      writeLastSpinAt(window.localStorage, slug, Date.now());
      toast.info("Мимо! Возвращайся завтра или следи за акциями.");
    },
    [slug],
  );

  const spin = useCallback(() => {
    if (isSpinning) return;
    if (cooldownMs > 0 && !isDemoModeRef.current) {
      toast.info(`Следующая крутка будет доступна ${formatCooldown(cooldownMs)}.`);
      return;
    }

    setResult(null);
    setCopied(false);
    setIsSpinning(true);

    const segmentIndex = pickWeightedSegmentIndex();
    setRotation((previous) => computeTargetRotation(segmentIndex, previous));
    // Анимация фиксирует ровно выбранный сегмент (см. computeTargetRotation).
    window.setTimeout(() => handleSpinComplete(segmentIndex), SPIN_DURATION_S * 1000 + 120);
  }, [cooldownMs, handleSpinComplete, isSpinning]);

  const copyCode = useCallback(async () => {
    if (!result || result.kind !== "promo") return;
    try {
      await navigator.clipboard.writeText(result.promoCode);
      setCopied(true);
      toast.success("Промокод скопирован");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback для старых WebView: выделяем код визуально, юзер копирует руками.
      toast.info(`Промокод: ${result.promoCode}`);
    }
  }, [result]);

  const resolvedSlug = crew.slug || slug;
  const cartHref = result && result.kind === "promo"
    ? `/franchize/${resolvedSlug}/cart?promo=${result.promoCode}`
    : `/franchize/${resolvedSlug}/cart`;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      {/* Хедер-карточка в стиле промо-баннера */}
      <div
        className="relative overflow-hidden rounded-3xl border p-6 sm:p-8"
        style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: T.accent }} />

        <p className="break-all text-xs uppercase tracking-[0.2em]" style={{ color: T.accent }}>
          / FRANCHIZE / {crew.header.brandName?.toUpperCase() ?? resolvedSlug.toUpperCase()} / WHEEL
        </p>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold" style={{ color: T.text }}>
          Колесо фортуны
          <Sparkles className="h-6 w-6" style={{ color: T.accent }} />
        </h1>
        <p className="mt-2 max-w-xl text-sm" style={{ color: T.textMuted }}>
          Крути колесо и забирай скидку на аренду или покупку: 1 000 ₽, 2 000 ₽, 5 000 ₽ или 15%.
          Промокод применяется в корзине — сервер проверит его автоматически.
        </p>

        <div className="mt-8 flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
          {/* Колесо */}
          <div className="relative mx-auto aspect-square w-full max-w-[340px] shrink-0">
            {/* Указатель сверху */}
            <div
              className="absolute left-1/2 top-[-6px] z-20 h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: "12px solid transparent",
                borderRight: "12px solid transparent",
                borderTop: `24px solid ${T.accent}`,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                // Конвенция (см. computeTargetRotation): `from -A/2` — сектор i
                // центрирован на угле i*A от вершины, сектор 0 стоит под
                // указателем у неповернутого колеса.
                background: `conic-gradient(from ${(-WHEEL_SEGMENT_ANGLE / 2).toFixed(2)}deg, ${WHEEL_SEGMENTS.map(
                  (segment, index) =>
                    `${segment.color} ${(index * WHEEL_SEGMENT_ANGLE).toFixed(2)}deg ${((index + 1) * WHEEL_SEGMENT_ANGLE).toFixed(2)}deg`,
                ).join(", ")})`,
                boxShadow: "0 0 0 8px rgba(255,255,255,0.14), 0 12px 40px rgba(0,0,0,0.45)",
                willChange: "transform",
              }}
              animate={{ rotate: rotation }}
              transition={{ duration: SPIN_DURATION_S, ease: [0.16, 1, 0.3, 1] }}
            >
              {WHEEL_SEGMENTS.map((segment, index) => {
                const bisector = index * WHEEL_SEGMENT_ANGLE;
                return (
                  <div
                    key={segment.id}
                    className="absolute inset-0"
                    style={{ transform: `rotate(${bisector}deg)` }}
                  >
                    {/* Подпись сектора: радиально, читается от центра наружу */}
                    <div
                      className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center"
                      style={{ transform: `translate(-50%, 14px)`, transformOrigin: "50% 0" }}
                    >
                      <span
                        className="whitespace-nowrap text-[13px] font-extrabold leading-tight sm:text-sm"
                        style={{ color: segment.textColor, textShadow: "0 1px 2px rgba(255,255,255,0.25)" }}
                      >
                        {segment.label}
                      </span>
                      {segment.sublabel && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: segment.textColor, opacity: 0.85 }}>
                          {segment.sublabel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Ступица */}
            <div
              className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
              style={{
                background: "radial-gradient(circle at 30% 25%, #F8FAFC 0%, #CBD5E1 45%, #64748B 100%)",
                boxShadow: "0 4px 14px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.7)",
                border: "2px solid rgba(255,255,255,0.5)",
              }}
            >
              <span className="text-lg font-black" style={{ color: "#334155" }}>{crew.header.brandName?.slice(0, 2).toUpperCase() ?? "VB"}</span>
            </div>
          </div>

          {/* Панель результата / призы */}
          <div className="w-full max-w-sm space-y-4">
            <button
              type="button"
              onClick={spin}
              disabled={isSpinning || (cooldownMs > 0 && !isDemoModeRef.current)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: T.accent, color: T.accentContrast }}
            >
              {isSpinning ? (
                <>
                  <RotateCw className="h-5 w-5 animate-spin" />
                  Крутим...
                </>
              ) : cooldownMs > 0 && !isDemoModeRef.current ? (
                <>Возвращайся {formatCooldown(cooldownMs)}</>
              ) : (
                <>
                  <RotateCw className="h-5 w-5" />
                  Крутить колесо
                </>
              )}
            </button>

            {result?.kind === "promo" ? (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="rounded-2xl border p-4"
                style={{ borderColor: T.accent, backgroundColor: T.accentSoft }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: T.textMuted }}>
                  Твой выигрыш
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-2xl font-black tracking-wide" style={{ color: T.text }}>
                    {result.promoCode}
                  </p>
                  <button
                    type="button"
                    onClick={copyCode}
                    aria-label="Скопировать промокод"
                    className="shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:opacity-80"
                    style={{ borderColor: T.borderSoft, color: T.accent }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
                  {result.segment.label} {result.segment.sublabel ?? ""} — примени в корзине перед оформлением.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <a
                    href={cartHref}
                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition hover:opacity-90"
                    style={{ backgroundColor: T.accent, color: T.accentContrast }}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    В корзину с промокодом
                  </a>
                  <a
                    href={`/franchize/${resolvedSlug}`}
                    className="flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-80"
                    style={{ borderColor: T.borderSoft, color: T.text }}
                  >
                    Выбрать байк в каталоге
                  </a>
                </div>
              </motion.div>
            ) : (
              <div className="rounded-2xl border p-4" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: T.text }}>
                  <Ticket className="h-4 w-4" style={{ color: T.accent }} />
                  Что на колесе
                </p>
                <ul className="mt-2 space-y-1.5">
                  {uniqueAwards.map((promo) => (
                    <li key={promo.code} className="flex items-center justify-between text-sm" style={{ color: T.textMuted }}>
                      <span>Скидка {promo.label}</span>
                      <span className="rounded-lg px-2 py-0.5 font-mono text-xs font-bold" style={{ backgroundColor: T.accentSoft, color: T.accent }}>
                        {promo.code}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] leading-relaxed" style={{ color: T.textFaint }}>
                  Одна крутка в сутки. Промокод суммируется с ценой корзины, но не с другими промокодами;
                  финальную скидку подтверждает сервер при оформлении.
                </p>
              </div>
            )}

            {result?.kind === "respin" && (
              <p className="text-center text-sm font-semibold" style={{ color: T.accent }}>
                Джекпот удачи — дополнительная крутка! Жми «Крутить колесо».
              </p>
            )}
            {result?.kind === "miss" && (
              <p className="text-center text-sm" style={{ color: T.textMuted }}>
                Не повезло — но колесо крутится каждый день. Заходи завтра!
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
