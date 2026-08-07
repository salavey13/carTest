"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone, Loader2, X, Check } from "lucide-react";

/**
 * RentalSetPhoneModal
 * ──────────────────────────────────────────────────────────────────────────
 * Allows operators/admins/owners to set or update the renter's phone number
 * on a rental — used when /doc skipped phone input.
 *
 * Calls `setRentalPhone` server action which updates:
 *   - private.rental_contract_artifacts.renter_phone (what the page reads)
 *   - private.user_rental_secrets.renter_phone (next-rent prefill, best-effort)
 *   - public.rentals.metadata.renter_phone (leads/todos pipeline, best-effort)
 *
 * Pattern cloned from RentalExtendModal:
 *   - Hand-rolled modal (no Radix/shadcn Dialog)
 *   - role="dialog" aria-modal="true"
 *   - Escape closes, body scroll lock, autofocus input
 *   - type="button" on all buttons to prevent accidental form submit
 */
interface RentalSetPhoneModalProps {
  rentalId: string;
  currentPhone?: string | null;
  bikeTitle?: string;
  renterName?: string;
  accentColor: string;
  accentTextOn: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  /** Trigger button — when clicked, opens the modal */
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
}

export function RentalSetPhoneModal({
  rentalId,
  currentPhone,
  bikeTitle,
  renterName,
  accentColor,
  accentTextOn,
  borderColor,
  textPrimary,
  textSecondary,
  triggerClassName,
  triggerStyle,
}: RentalSetPhoneModalProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Reset phone field when modal opens (in case currentPhone changed externally)
  useEffect(() => {
    if (open) setPhone(currentPhone ?? "");
  }, [open, currentPhone]);

  // a11y: Escape closes modal, focus returns to trigger button.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      const telInput = dialogRef.current?.querySelector<HTMLInputElement>("input[type='tel']");
      telInput?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(timer);
    };
  }, [open, isPending]);

  const handleSubmit = () => {
    if (!phone.trim()) {
      toast.error("Введите номер телефона.");
      return;
    }

    startTransition(async () => {
      try {
        const { setRentalPhone } = await import("@/app/rentals/actions");
        const result = await setRentalPhone({ rentalId, phone });
        if (!result.success) {
          toast.error(result.error || "Не удалось сохранить телефон.");
          return;
        }
        toast.success("Телефон сохранён. Клиент сможет получить QR-код.");
        setOpen(false);
        router.refresh();
      } catch (err) {
        console.error("[set-phone] Error:", err);
        toast.error("Не удалось сохранить телефон. Попробуйте ещё раз.");
      }
    });
  };

  const hasPhone = Boolean(currentPhone);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        id="set-phone-modal-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="set-phone-modal-title"
        className={
          triggerClassName ||
          "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition hover:opacity-80"
        }
        style={triggerStyle || { color: accentColor }}
      >
        {hasPhone ? (
          <>
            <Phone className="h-3 w-3 shrink-0" />
            Изменить
          </>
        ) : (
          <>
            <Phone className="h-3 w-3 shrink-0" />
            📞 Указать телефон
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="set-phone-modal-title"
          aria-describedby="set-phone-modal-desc"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            ref={dialogRef}
            className="relative w-full max-w-md rounded-2xl border p-5"
            style={{
              borderColor,
              backgroundColor: "var(--franchize-bg-card, #1a1a1a)",
              color: textPrimary,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => !isPending && setOpen(false)}
              aria-label="Закрыть"
              aria-disabled={isPending}
              className="absolute right-3 top-3 rounded-lg p-1.5 opacity-60 transition hover:opacity-100 disabled:opacity-30"
              style={{ color: textSecondary }}
            >
              <X className="h-4 w-4" />
            </button>

            <h3 id="set-phone-modal-title" className="text-lg font-bold mb-1">
              {hasPhone ? "Изменить телефон" : "Указать телефон"}
            </h3>
            <p id="set-phone-modal-desc" className="text-xs mb-4" style={{ color: textSecondary }}>
              {hasPhone
                ? "Обновите номер телефона арендатора."
                : "Без телефона клиент не получит QR-код и не сможет привязать Telegram."}
            </p>

            {/* Read-only context card */}
            <div
              className="mb-4 rounded-xl border p-3 text-xs"
              style={{ borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              {bikeTitle && (
                <p className="mb-1">
                  <span style={{ color: textSecondary }}>🏍 Байк:</span>{" "}
                  <span className="font-semibold">{bikeTitle}</span>
                </p>
              )}
              {renterName && (
                <p>
                  <span style={{ color: textSecondary }}>👤 Арендатор:</span>{" "}
                  <span className="font-semibold">{renterName}</span>
                </p>
              )}
            </div>

            {/* Phone input */}
            <label className="block">
              <span className="text-xs font-semibold" style={{ color: textSecondary }}>
                <Phone className="inline h-3 w-3 mr-1" />
                Номер телефона
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isPending}
                placeholder="+7 999 123-45-67"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none font-mono"
                style={{
                  borderColor,
                  backgroundColor: "var(--franchize-bg-card, #1a1a1a)",
                  color: textPrimary,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isPending) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <span className="mt-1 block text-[10px]" style={{ color: textSecondary }}>
                Формат: +7 XXX XXX-XX-XX (или 8XXX…, 7XXX…, XXX…)
              </span>
            </label>

            {/* Action buttons */}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--franchize-border-soft, #333) 30%, transparent)",
                  color: textPrimary,
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: accentColor, color: accentTextOn }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Сохранение…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Сохранить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
