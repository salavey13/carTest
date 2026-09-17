// app/franchize/components/cart/PromoCodeInput.tsx
"use client";

// Boss request (2026-09-17): a promo field in the CART. The entered code is
// validated by the same server action the order page uses
// (validateFranchizePromoCode), so a code applied here carries into checkout
// with identical discount math — no second source of truth.

import { useState } from "react";
import { X } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import { validateFranchizePromoCode } from "../../server-actions/promotions";
import type { CartAppliedPromo } from "../../lib/cart-promo";
import { focusRingOutlineStyle } from "../../lib/theme";
import { useCrewTokens } from "../../lib/use-crew-tokens";

interface PromoCodeInputProps {
  slug: string;
  crew: FranchizeCrewVM;
  /** Live cart subtotal (pre-discount) — the base the server validates against. */
  baseAmount: number;
  appliedPromo: CartAppliedPromo | null;
  onApply: (promo: CartAppliedPromo) => void;
  onClear: () => void;
}

export function PromoCodeInput({ slug, crew, baseAmount, appliedPromo, onApply, onClear }: PromoCodeInputProps) {
  const T = useCrewTokens(crew.theme);
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed || isValidating) return;
    setIsValidating(true);
    setError(null);
    try {
      const result = await validateFranchizePromoCode({ slug, code: trimmed, baseAmount });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onApply({
        slug,
        code: result.code,
        title: result.title,
        description: result.description,
        discountAmount: result.discountAmount,
        baseAmountAtApply: baseAmount,
      });
      setCode("");
    } catch {
      setError("Не удалось проверить промокод. Попробуйте ещё раз.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="rounded-2xl border p-4" style={T.styles.card}>
      {appliedPromo ? (
        <div className="flex items-start justify-between gap-2">
          {/* min-w-0: long descriptions wrap instead of pushing the ✕ out */}
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-semibold" style={{ color: "#00C853" }}>
              Промокод {appliedPromo.code} применён
            </p>
            {appliedPromo.description && (
              <p className="mt-0.5 break-words text-xs" style={{ color: T.textMuted }}>
                {appliedPromo.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Убрать промокод"
            className="shrink-0 rounded-full p-1 transition hover:opacity-80"
            style={{ color: T.textMuted }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleApply();
          }}
          className="space-y-2"
        >
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Промокод"
              aria-label="Промокод"
              aria-invalid={Boolean(error)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="w-full min-w-0 rounded-xl border px-3 py-2 text-sm uppercase tracking-[0.08em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                borderColor: T.borderSoft,
                color: T.text,
                backgroundColor: "transparent",
                ...focusRingOutlineStyle(crew.theme),
              }}
            />
            <button
              type="submit"
              disabled={!code.trim() || isValidating || baseAmount <= 0}
              className="shrink-0 rounded-xl border px-3 text-sm font-medium transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: T.borderSoft,
                color: T.accent,
                ...focusRingOutlineStyle(crew.theme),
              }}
            >
              {isValidating ? "Проверяем..." : "Применить"}
            </button>
          </div>
          {error && (
            <p className="break-words text-xs" style={{ color: T.isLight ? "#b91c1c" : "#FF6B6B" }}>
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
