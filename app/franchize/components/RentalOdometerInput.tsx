"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gauge, TrendingUp, AlertTriangle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RentalOdometerDelta } from "./RentalOdometerDelta";
import { useAppContext } from "@/contexts/AppContext";

/**
 * RentalOdometerInput
 * ──────────────────────────────────────────────────────────────────────────
 * 2026-09-11 — owner request: «move "odometer at the end" from closure modal
 * to main rental page, show "odometer at rent start" AND "odometer at rental
 * end" on same screen (active input or passive label depending on rental
 * status). For an active rental "start odometer" is already set and readonly,
 * and "end odometer" is an active input — the difference is calculated
 * dynamically and shown right away. This way setting "odometer end" is easier,
 * the difference is visible immediately, and when the closure modal opens the
 * operator already knows how much to deduct from the deposit.»
 *
 * Behavior:
 *   - ACTIVE rental + operator: start reading (readonly) + end reading (input,
 *     debounced autosave to rentals.metadata.odometer_after_draft via
 *     POST /api/franchize/rental-odometer) + live Δ badge.
 *   - ACTIVE rental + renter/guest: passive "при выдаче" card (existing look).
 *   - COMPLETED rental: passive start → end + delta card (existing look),
 *     the draft (if the operator typed it but closed via a path that skipped
 *     the odometer write) still renders as the end value.
 */
interface RentalOdometerInputProps {
  rentalId: string;
  crewSlug: string;
  status: string;
  odometerBefore?: number | null;
  /** Authoritative end value (set by confirmVehicleReturn at closure). */
  odometerAfter?: number | null;
  /** Draft typed on this page before closure (metadata.odometer_after_draft). */
  odometerAfterDraft?: number | null;
  canEdit: boolean;
  includedKm?: number | null;
  overageRatePerKm?: number | null;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
  accentColor: string;
}

export function RentalOdometerInput({
  rentalId,
  crewSlug,
  status,
  odometerBefore,
  odometerAfter,
  odometerAfterDraft,
  canEdit,
  includedKm,
  overageRatePerKm,
  textPrimary,
  textSecondary,
  borderSoft,
  accentColor,
}: RentalOdometerInputProps) {
  const before = typeof odometerBefore === "number" ? odometerBefore : null;
  const closureAfter = typeof odometerAfter === "number" ? odometerAfter : null;
  const draft = typeof odometerAfterDraft === "number" ? odometerAfterDraft : null;
  const isActive = status === "active";

  // Passive render for completed rentals or when the operator can't edit:
  // the start → end + delta card (or start-only for active w/o edit rights).
  if (!isActive || !canEdit) {
    return (
      <RentalOdometerDelta
        odometerBefore={odometerBefore}
        odometerAfter={closureAfter ?? draft}
        includedKm={includedKm}
        overageRatePerKm={overageRatePerKm}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        borderSoft={borderSoft}
        accentColor={accentColor}
      />
    );
  }

  return (
    <OdometerEditor
      rentalId={rentalId}
      crewSlug={crewSlug}
      before={before}
      initialEnd={closureAfter ?? draft}
      includedKm={includedKm}
      overageRatePerKm={overageRatePerKm}
      textPrimary={textPrimary}
      textSecondary={textSecondary}
      borderSoft={borderSoft}
      accentColor={accentColor}
    />
  );
}

function OdometerEditor({
  rentalId,
  crewSlug,
  before,
  initialEnd,
  includedKm,
  overageRatePerKm,
  textPrimary,
  textSecondary,
  borderSoft,
  accentColor,
}: {
  rentalId: string;
  crewSlug: string;
  before: number | null;
  initialEnd: number | null;
  includedKm?: number | null;
  overageRatePerKm?: number | null;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
  accentColor: string;
}) {
  const [endValue, setEndValue] = useState<string>(initialEnd != null ? String(initialEnd) : "");
  const [savedValue, setSavedValue] = useState<number | null>(initialEnd);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{ value: string; sentAt: number }>({ value: initialEnd != null ? String(initialEnd) : "", sentAt: 0 });

  const parsed = (() => {
    const trimmed = endValue.trim();
    if (!trimmed) return null;
    const n = Math.round(Number(trimmed));
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  })();
  const invalid = Number.isNaN(parsed);
  const liveDelta = parsed != null && !invalid && before != null ? parsed - before : null;
  const overage =
    liveDelta != null && includedKm != null && liveDelta > includedKm
      ? { km: liveDelta - includedKm, charge: overageRatePerKm ? (liveDelta - includedKm) * overageRatePerKm : 0 }
      : null;

  const { dbUser } = useAppContext();

  const persist = useCallback(
    async (value: number | null) => {
      setSaveState("saving");
      try {
        // Auth follows the RentalReturnChecklist pattern: the signed actor
        // cookie is PRIMARY; the x-telegram-user-id header is the fallback
        // verifyCrewAccess accepts (mock dev / transition clients).
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (dbUser?.user_id) headers["x-telegram-user-id"] = dbUser.user_id;
        const res = await fetch("/api/franchize/rental-odometer", {
          method: "POST",
          headers,
          body: JSON.stringify({ rentalId, odometerAfter: value }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `HTTP ${res.status}`);
        }
        setSavedValue(value);
        setSaveState("saved");
      } catch (e) {
        loggerWarn(e);
        setSaveState("error");
        toast.error("Не удалось сохранить одометр. Проверьте соединение и повторите.");
      }
    },
    [rentalId, dbUser?.user_id],
  );

  // Debounced autosave: 700ms after the last keystroke. Before unmount /
  // navigation flush the pending change immediately so the closure modal
  // always sees the freshest value.
  useEffect(() => {
    if (invalid) return;
    const value = endValue.trim() === "" ? null : Math.round(Number(endValue));
    const unchanged = value === savedValue || (value === null && savedValue === null);
    if (unchanged) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("saving");
    debounceRef.current = setTimeout(() => {
      latestRef.current.sentAt = Date.now();
      void persist(value);
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endValue, invalid]);

  // Flush pending save when the tab is hidden / component unmounts.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      if (invalid) return;
      const value = endValue.trim() === "" ? null : Math.round(Number(endValue));
      if (value === savedValue) return;
      void persist(value);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endValue, invalid, savedValue]);

  const deltaBadge = (() => {
    if (invalid) {
      return (
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ backgroundColor: "#ef444420", color: "#ef4444" }}
        >
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          проверьте число
        </span>
      );
    }
    if (liveDelta == null) {
      return (
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold opacity-70"
          style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
        >
          разница появится после ввода
        </span>
      );
    }
    const negative = liveDelta < 0;
    return (
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
        style={{
          backgroundColor: negative ? "#ef444420" : overage ? "#ef444420" : "#22c55e20",
          color: negative ? "#ef4444" : overage ? "#ef4444" : "#22c55e",
        }}
      >
        {negative ? <AlertTriangle className="mr-1 inline h-3 w-3" /> : <TrendingUp className="mr-1 inline h-3 w-3" />}
        {negative ? "меньше выдачи" : `${liveDelta.toLocaleString("ru-RU")} км за аренду`}
      </span>
    );
  })();

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: before == null ? "#f59e0b60" : borderSoft }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
        >
          <Gauge className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wider opacity-60" style={{ color: textSecondary }}>
            Одометр — выдача → возврат
          </p>
          {before != null ? (
            <p className="text-sm font-bold" style={{ color: textPrimary }}>
              {before.toLocaleString("ru-RU")} км{" "}
              <span className="font-medium opacity-60">на момент выдачи (зафиксирован)</span>
            </p>
          ) : (
            <p className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
              Одометр при выдаче неизвестен — введите возврат по факту на месте.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-semibold opacity-70" style={{ color: textSecondary }}>
            Одометр при возврате (км)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={endValue}
            onChange={(e) => {
              setEndValue(e.target.value);
              setSaveState((s) => (s === "saved" ? "idle" : s));
            }}
            placeholder="например, 12345"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-semibold outline-none focus:ring-2"
            style={{
              backgroundColor: "transparent",
              borderColor: invalid ? "#ef4444" : borderSoft,
              color: textPrimary,
            }}
          />
        </label>
        <div className="shrink-0 pb-1">{deltaBadge}</div>
      </div>

      <div className="mt-2 flex min-h-[18px] items-center justify-between gap-2">
        <span className="text-[10px] opacity-70" style={{ color: textSecondary }}>
          {overage
            ? `Превышение: ${overage.km} км${overage.charge > 0 ? ` × ${overageRatePerKm} ₽ = ${overage.charge.toLocaleString("ru-RU")} ₽ — удержите из депозита` : ""}`
            : before != null && liveDelta != null && !invalid
              ? `Учитывайте разницу при возврате депозита в модалке закрытия.`
              : `Сохранится в карточке аренды и подставится при закрытии.`}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold"
          style={{
            color:
              saveState === "error" ? "#ef4444" : saveState === "saved" ? "#22c55e" : textSecondary,
          }}
        >
          {saveState === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
          {saveState === "saved" && <Check className="h-3 w-3" />}
          {saveState === "saving"
            ? "сохраняем…"
            : saveState === "saved"
              ? "сохранено"
              : saveState === "error"
                ? "ошибка сохранения"
                : ""}
        </span>
      </div>
    </div>
  );
}

function loggerWarn(e: unknown) {
  // Local console only — avoid pulling the server logger into a client bundle.
  console.warn("[RentalOdometerInput] save failed:", e);
}
