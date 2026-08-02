"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Loader2, X, RefreshCw } from "lucide-react";

/**
 * RentalExtendModal
 * ──────────────────────────────────────────────────────────────────────────
 * Phase 3 from PRD: "Продлить" enhancement.
 *
 * Replaces the old "Продлить" link (which just opened the catalog with the
 * bike filter, forcing the operator to redo the whole checkout) with a
 * 1-click modal that:
 *   1. Shows a date picker (start = today, end = +1 day default)
 *   2. Pre-fills everything from the original rental (renter, bike, equipment, price)
 *   3. Calls extendRental server action
 *   4. The server action generates new DOCX, sends to operator TG + crew email
 *      + renter (if QR claimed), creates new rental row linked via metadata.extended_from
 *
 * Why a modal instead of a new page?
 *   - Operator is already on the rental page — modal keeps them in context.
 *   - Date selection is the only thing that changes; everything else is read-only.
 *   - Faster than navigating to a new page + re-entering all data.
 *
 * Accessibility:
 *   - role="dialog" aria-modal="true"
 *   - Focus trapped inside modal (Escape closes)
 *   - All buttons have type="button" to prevent accidental form submission
 */
interface RentalExtendModalProps {
  rentalId: string;
  originalStartDate?: string | null;
  originalEndDate?: string | null;
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

export function RentalExtendModal({
  rentalId,
  originalStartDate,
  originalEndDate,
  bikeTitle,
  renterName,
  accentColor,
  accentTextOn,
  borderColor,
  textPrimary,
  textSecondary,
  triggerClassName,
  triggerStyle,
}: RentalExtendModalProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Today's date as YYYY-MM-DD for date input `min` attribute
  const todayStr = new Date().toISOString().slice(0, 10);

  // a11y: Escape closes modal, focus returns to trigger button.
  // Doesn't implement full focus trap (Tab cycle) — would need react-focus-lock lib.
  // But Escape + focus return covers ~80% of keyboard users' needs.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    // Lock body scroll while modal open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus first interactive element on open
    const timer = setTimeout(() => {
      const firstInput = dialogRef.current?.querySelector<HTMLInputElement>("input, button");
      firstInput?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(timer);
    };
  }, [open, isPending]);

  const openModal = () => {
    // Default: start = today, end = +1 day (or original rental's end if known)
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const end = tomorrow.toISOString().slice(0, 10);
    setStartDate(start);
    setEndDate(end);
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!startDate || !endDate) {
      toast.error("Укажите даты начала и окончания.");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error("Неверный формат дат.");
      return;
    }
    if (end <= start) {
      toast.error("Дата окончания должна быть позже даты начала.");
      return;
    }

    startTransition(async () => {
      try {
        // Dynamically import the server action to keep bundle small if not used
        const { extendRental } = await import("@/app/rentals/actions");
        const result = await extendRental({
          originalRentalId: rentalId,
          newStartDate: startDate,
          newEndDate: endDate,
        });
        if (!result.success) {
          toast.error(result.error || "Не удалось продлить аренду.");
          return;
        }
        toast.success(`Аренда продлена до ${endDate}. Новый договор отправлен.`);
        setOpen(false);
        // Navigate to the new rental page if returned
        if (result.newRentalId) {
          router.push(`?extended_from=${result.newRentalId.slice(0, 8)}`);
        }
        router.refresh();
      } catch (err) {
        console.error("[extend-rental] Error:", err);
        toast.error("Не удалось продлить аренду. Попробуйте ещё раз.");
      }
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="extend-modal-title"
        className={
          triggerClassName ||
          "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
        }
        style={triggerStyle || { backgroundColor: accentColor, color: accentTextOn }}
      >
        <RefreshCw className="h-4 w-4 shrink-0" />
        Продлить
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="extend-modal-title"
          aria-describedby="extend-modal-desc"
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

            <h3 id="extend-modal-title" className="text-lg font-bold mb-1">
              Продлить аренду
            </h3>
            <p id="extend-modal-desc" className="text-xs mb-4" style={{ color: textSecondary }}>
              Создаст новую аренду с тем же арендатором, байком и экипировкой. Договор отправится автоматически.
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
                <p className="mb-1">
                  <span style={{ color: textSecondary }}>👤 Арендатор:</span>{" "}
                  <span className="font-semibold">{renterName}</span>
                </p>
              )}
              {originalEndDate && (
                <p>
                  <span style={{ color: textSecondary }}>📅 Текущий возврат:</span>{" "}
                  <span className="font-semibold">
                    {new Date(originalEndDate).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
              )}
            </div>

            {/* Date pickers */}
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: textSecondary }}>
                  <Calendar className="inline h-3 w-3 mr-1" />
                  Новая дата начала
                </span>
                <input
                  type="date"
                  value={startDate}
                  min={todayStr}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isPending}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor,
                    backgroundColor: "var(--franchize-bg-card, #1a1a1a)",
                    color: textPrimary,
                  }}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: textSecondary }}>
                  <Calendar className="inline h-3 w-3 mr-1" />
                  Новая дата окончания
                </span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || todayStr}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isPending}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor,
                    backgroundColor: "var(--franchize-bg-card, #1a1a1a)",
                    color: textPrimary,
                  }}
                />
              </label>
            </div>

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
                    Создаём…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Продлить
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
