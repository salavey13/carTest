"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gauge, TrendingUp, AlertTriangle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RentalOdometerDelta } from "./RentalOdometerDelta";
import { useAppContext } from "@/contexts/AppContext";
import { useRentalOdometerDraft } from "./RentalOdometerDraftContext";

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
 *   - ACTIVE rental + renter: SAME live input (2026-09-24 owner request
 *     «give renter the powers» — the renter types the return reading
 *     himself), with renter-worded hints (no deposit-deduction operator
 *     talk, overage still shown as «may be deducted from deposit»). The
 *     server route authorizes the renter via the signed actor cookie.
 *   - PENDING/CONFIRMED rental without a pickup freeze (2026-09-28 owner
 *     request «allow renter to set start odometer value for rental he
 *     created via web app flow»): the START reading becomes an active
 *     input (autosave to metadata.odometer_before via field:"start") —
 *     the renter who created the deal confirms the real dash reading
 *     himself; the freeze dialog pre-fills from this value afterwards.
 *   - ACTIVE rental + guest: passive "при выдаче" card (existing look).
 *   - COMPLETED rental: passive start → end + delta card (existing look),
 *     the draft (if the operator typed it but closed via a path that skipped
 *     the odometer write) still renders as the end value.
 *
 * Draft sync (2026-09-28): every successful autosave is REPORTED to
 * RentalOdometerDraftContext, and a pending debounced save is flushable —
 * the closure modal awaits the flush before pre-filling, so the value
 * typed here can no longer go missing there.
 */
interface RentalOdometerInputProps {
  rentalId: string;
  crewSlug: string;
  status: string;
  odometerBefore?: number | null;
  /** True when the start value came from a hint/last-known/specs chain —
   *  NOT a confirmed handover reading (metadata.odometer_before / freeze). */
  odometerBeforeIsHint?: boolean;
  /** Authoritative end value (set by confirmVehicleReturn at closure). */
  odometerAfter?: number | null;
  /** Draft typed on this page before closure (metadata.odometer_after_draft). */
  odometerAfterDraft?: number | null;
  /** Pickup freeze already saved → the handover reading is locked. */
  hasPickupFreeze?: boolean;
  canEdit: boolean;
  /** Rental's renter id (rentals.user_id) — lets the editor detect a renter
   *  viewer and switch the hint copy from operator to renter wording. */
  renterId?: string | null;
  /** Fallback renter identity (rental_contract_artefacts chat id). */
  renterTelegramChatId?: string | null;
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
  odometerBeforeIsHint,
  odometerAfter,
  odometerAfterDraft,
  hasPickupFreeze,
  canEdit,
  renterId,
  renterTelegramChatId,
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
  // Pre-pickup phase: the handover reading is not locked yet — whoever the
  // role guard lets through (operator / renter / subrenter) can set it.
  const canEditStart =
    (status === "pending_confirmation" || status === "confirmed") && !hasPickupFreeze;

  // Pre-pickup: editable START reading (web-flow self-service).
  if (canEditStart) {
    return (
      <OdometerStartEditor
        rentalId={rentalId}
        initialStart={before}
        isHint={Boolean(odometerBeforeIsHint) || before == null}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        borderSoft={borderSoft}
        accentColor={accentColor}
      />
    );
  }

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
      renterId={renterId}
      renterTelegramChatId={renterTelegramChatId}
      includedKm={includedKm}
      overageRatePerKm={overageRatePerKm}
      textPrimary={textPrimary}
      textSecondary={textSecondary}
      borderSoft={borderSoft}
      accentColor={accentColor}
    />
  );
}

/** Shared save-status pill (сохраняем… / сохранено / ошибка). */
function SaveStatePill({
  saveState,
  textSecondary,
}: {
  saveState: "idle" | "saving" | "saved" | "error";
  textSecondary: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold"
      style={{
        color: saveState === "error" ? "#ef4444" : saveState === "saved" ? "#22c55e" : textSecondary,
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
  );
}

/** Parse a raw odometer string → km number | null (empty) | NaN (invalid). */
function parseOdometer(raw: string): number | null | typeof NaN {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Math.round(Number(trimmed));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

// ─────────────────────────────────────────────────────────────────────────────
// START-odometer editor (pre-pickup phase, web-flow self-service)
// ─────────────────────────────────────────────────────────────────────────────
function OdometerStartEditor({
  rentalId,
  initialStart,
  isHint,
  textPrimary,
  textSecondary,
  borderSoft,
  accentColor,
}: {
  rentalId: string;
  initialStart: number | null;
  isHint: boolean;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
  accentColor: string;
}) {
  const [startValue, setStartValue] = useState<string>(initialStart != null ? String(initialStart) : "");
  const [savedValue, setSavedValue] = useState<number | null>(initialStart);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { dbUser } = useAppContext();

  const parsed = parseOdometer(startValue);
  const invalid = Number.isNaN(parsed);
  // R1 #7 (honest clear): the start reading is write-once-until-freeze and the
  // server treats null as a no-op — an emptied field must not flip the badge
  // to «сохранено». We simply don't autosave an empty field; the last saved
  // value stays in the card until the user types a number again.
  const unchanged = parsed === savedValue || (parsed === null && savedValue === null) || parsed === null;

  const persist = useCallback(
    async (value: number | null) => {
      setSaveState("saving");
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (dbUser?.user_id) headers["x-telegram-user-id"] = dbUser.user_id;
        const res = await fetch("/api/franchize/rental-odometer", {
          method: "POST",
          headers,
          body: JSON.stringify({ rentalId, odometerAfter: value, field: "start" }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `HTTP ${res.status}`);
        }
        setSavedValue(value);
        setSaveState("saved");
      } catch (e) {
        console.warn("[RentalOdometerInput] start save failed:", e);
        setSaveState("error");
        toast.error("Не удалось сохранить одометр. Проверьте соединение и повторите.");
      }
    },
    [rentalId, dbUser?.user_id],
  );

  // Debounced autosave (700ms) — same cadence as the end-odometer editor.
  useEffect(() => {
    if (invalid || unchanged) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("saving");
    const value = parsed;
    debounceRef.current = setTimeout(() => {
      void persist(value);
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startValue, invalid]);

  // Flush a pending save when the tab hides / component unmounts.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      if (invalid) return;
      const value = parseOdometer(startValue);
      if (value === null) return; // honest clear — nothing to persist
      if (value === savedValue) return;
      void persist(value);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startValue, invalid, savedValue]);

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: isHint ? "#f59e0b60" : borderSoft }}
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
            Одометр при выдаче
          </p>
          <p className="text-sm font-bold" style={{ color: textPrimary }}>
            {isHint ? "Подтвердите показание" : "Показание зафиксировано"}
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-semibold opacity-70" style={{ color: textSecondary }}>
            Пробег на момент выдачи (км)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={startValue}
            onChange={(e) => {
              setStartValue(e.target.value);
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
      </div>

      <div className="mt-2 flex min-h-[18px] items-center justify-between gap-2">
        <span className="text-[10px] opacity-70" style={{ color: textSecondary }}>
          {invalid
            ? "Проверьте число — нужны целые километры."
            : isHint
              ? "Значение из карточки байка — поправьте по реальным показаниям спидометра."
              : "Эти показания зафиксируются при выдаче — по ним считается пробег за аренду."}
        </span>
        <SaveStatePill saveState={saveState} textSecondary={textSecondary} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// END-odometer editor (active rental — operator or renter)
// ─────────────────────────────────────────────────────────────────────────────
function OdometerEditor({
  rentalId,
  crewSlug,
  before,
  initialEnd,
  renterId,
  renterTelegramChatId,
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
  renterId?: string | null;
  renterTelegramChatId?: string | null;
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

  // Renter viewer? The rental page passes rentals.user_id + the artefact
  // chat-id fallback — same two identities FranchizeRentalRoleGuard uses
  // for the "renter" role. Renter wording = no deposit-deduction operator
  // talk in the footer hints.
  const isRenterViewer = Boolean(
    dbUser?.user_id &&
      (dbUser.user_id === renterId ||
        (renterTelegramChatId && dbUser.user_id === renterTelegramChatId)),
  );

  // ── Draft context (2026-09-28): report saves + expose a flush so the
  // closure modal always opens with the freshest value. R1 #4: the flush
  // must also await an IN-FLIGHT persist (debounce already fired but the
  // POST is still on the wire — slow mobile networks in the TG WebView),
  // otherwise the modal pre-fills the stale value and the owner-reported
  // symptom resurfaces.
  const draftStore = useRentalOdometerDraft();
  // Live state mirror for the flush closure (no stale deps).
  const stateRef = useRef({ endValue, savedValue, invalid });
  stateRef.current = { endValue, savedValue, invalid };
  const pendingRef = useRef<number | null | undefined>(undefined); // undefined = nothing pending
  const inFlightRef = useRef<Promise<number | null> | null>(null);

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
        // Forward to the shared draft store — the closure modal reads it.
        draftStore?.reportSaved(value);
      } catch (e) {
        console.warn("[RentalOdometerInput] save failed:", e);
        setSaveState("error");
        toast.error("Не удалось сохранить одометр. Проверьте соединение и повторите.");
      }
    },
    [rentalId, dbUser?.user_id, draftStore],
  );

  /** persist + remember the promise, resolving with the attempted value. */
  const runPersist = useCallback(
    (value: number | null) => {
      const p = persist(value)
        .then(() => value)
        .catch(() => value);
      inFlightRef.current = p;
      void p.finally(() => {
        if (inFlightRef.current === p) inFlightRef.current = null;
      });
      return p;
    },
    [persist],
  );

  // Register the flush: cancels a pending debounced save and persists it
  // immediately, or awaits an in-flight POST, resolving with the freshest
  // value either way.
  useEffect(() => {
    if (!draftStore) return;
    draftStore.registerFlush(async () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (pendingRef.current !== undefined) {
        const value = pendingRef.current;
        pendingRef.current = undefined;
        return runPersist(value);
      }
      if (inFlightRef.current) return inFlightRef.current;
      const { savedValue: saved } = stateRef.current;
      return saved;
    });
    return () => draftStore.registerFlush(null);
  }, [draftStore, runPersist]);

  // Debounced autosave: 700ms after the last keystroke. Before unmount /
  // navigation flush the pending change immediately so the closure modal
  // always sees the freshest value.
  useEffect(() => {
    if (invalid) return;
    const value = endValue.trim() === "" ? null : Math.round(Number(endValue));
    const unchanged = value === savedValue || (value === null && savedValue === null);
    if (unchanged) {
      pendingRef.current = undefined;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("saving");
    pendingRef.current = value;
    debounceRef.current = setTimeout(() => {
      pendingRef.current = undefined;
      runPersist(value);
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
      runPersist(value);
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
            ? `Превышение: ${overage.km} км${overage.charge > 0 ? ` × ${overageRatePerKm} ₽ = ${overage.charge.toLocaleString("ru-RU")} ₽${isRenterViewer ? " — может быть удержано из депозита" : " — удержите из депозита"}` : ""}`
            : before != null && liveDelta != null && !invalid
              ? isRenterViewer
                ? `Показания сохранятся в карточке аренды — оператор увидит их при закрытии.`
                : `Учитывайте разницу при возврате депозита в модалке закрытия.`
              : isRenterViewer
                ? `Сохранится в карточке аренды — оператор увидит при закрытии.`
                : `Сохранится в карточке аренды и подставится при закрытии.`}
        </span>
        <SaveStatePill saveState={saveState} textSecondary={textSecondary} />
      </div>
    </div>
  );
}
