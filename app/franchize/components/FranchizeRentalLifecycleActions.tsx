"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import {
  confirmVehiclePickup,
  confirmVehicleReturn,
  initiateTelegramRentalPhotoUpload,
  abortRental,
} from "@/app/rentals/actions";
import { useRentalOdometerDraft } from "./RentalOdometerDraftContext";
import { useKeyboardAwareOverlay } from "./useKeyboardAwareOverlay";
// Task 124 — commissions summary in the closure modal. Lazily fetched ON OPEN
// through a crew-gated server action (codereview fix: a page-level prop
// leaked the наценка into renters' RSC payloads and paid queries on every
// view). Type-only import — nothing server-side reaches the client bundle.
import type { ClosureCommissionPreview } from "../lib/closure-commission";
import { getClosureCommissionPreviewAction } from "../server-actions/rental-verify-actions";
// Photo gallery import removed — gallery is only on the rental detail page, not in the closure modal

// Task 47: "error boundary when closing active rent — Cannot read properties
// of undefined (reading 'success')". All closure actions return an object on
// every code path, but the transport can still resolve a Server Action
// promise with `undefined` (network blip, Vercel function timeout mid-flight,
// stale action id after a redeploy) — the same failure OrderPageClient
// documented at iter14. Every action reply below is therefore guarded.
//
// Mechanism note (verified against the vendored React 18.3 canary): a throw
// inside a startTransition async callback does NOT reach an error boundary on
// this stack — it surfaces via reportError/console. The boundary screenshot
// the boss sent remains partially unexplained (possibly an older client
// bundle); what IS proven is that these reply reads were the only producers
// of the reported TypeError on this page. Follow-up: capture the boundary's
// full stack next time it fires.
const SERVER_REPLY_LOST =
  "Ответ сервера не получен. Действие могло пройти — проверьте статус аренды: карточка сейчас обновится.";
// Actions whose server UPDATE precedes the reply: a lost reply (undefined
// resolve OR rejection) may still have applied — use the honest wording.
// "pickup" mutates before replying too (confirmVehiclePickup writes the
// freeze receipt first) — milder consequences, same set.
const REPLY_MAY_HAVE_APPLIED = new Set(["return", "abort", "pickup"]);

interface FranchizeRentalLifecycleActionsProps {
  rentalId: string;
  ownerId: string;
  renterId: string;
  renterTelegramChatId?: string;
  renterFullName?: string;
  crewId: string;
  crewSlug?: string;
  status: string;
  paymentStatus: string;
  hasPickupFreeze: boolean;
  // Fix: show how much cash/bank was collected at rental start
  paymentSplit?: { cash: number; bank: number; cardDestination?: string | null } | null;
  // 2026-09-11: odometer moved to the main rental page — the closure modal is
  // now PRE-FILLED with the draft the operator typed there (rental page shows
  // start (readonly) + end (input) + live difference). The modal shows the
  // delta so the operator instantly knows how much to deduct from the deposit.
  odometerBefore?: number | null;
  odometerAfterDraft?: number | null;
  palette: {
    accentMain: string;
    accentMainHover: string;
    bgCard: string;
    borderSoft: string;
    textPrimary: string;
    textSecondary: string;
  };
  isAuto?: boolean;
}

export function FranchizeRentalLifecycleActions({
  rentalId,
  ownerId,
  renterId,
  renterTelegramChatId,
  renterFullName,
  crewId,
  crewSlug,
  status,
  paymentStatus,
  hasPickupFreeze,
  paymentSplit,
  odometerBefore,
  odometerAfterDraft,
  palette,
  isAuto = false,
}: FranchizeRentalLifecycleActionsProps) {
  const { dbUser, userCrewMemberships } = useAppContext();
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const role = useMemo(() => {
    if (!dbUser?.user_id) return "guest" as const;
    // If user is authed but memberships haven't loaded yet, show "loading"
    // instead of "guest" — prevents the "наблюдатель" flash.
    if (dbUser.user_id && userCrewMemberships.length === 0 && !ownerId) {
      // Can't determine yet — will re-evaluate when memberships load
      // Check if user IS the owner first (doesn't need memberships)
    }
    if (dbUser.user_id === ownerId) return "owner" as const;
    // Polish 2026-07-30: also match against renterTelegramChatId fallback
    // (for bot/QR-flow rentals where rentals.user_id is null).
    if (renterId && dbUser.user_id === renterId) return "renter" as const;
    if (renterTelegramChatId && dbUser.user_id === renterTelegramChatId) return "renter" as const;
    // Check if user is a crew member with admin/co_owner/owner role
    // Try matching by crewId (UUID) first, then by slug (more reliable —
    // the UUID can mismatch if the crew was recreated or the ID format differs)
    const membership = userCrewMemberships.find((m) => m.crewId === crewId)
      || (crewSlug ? userCrewMemberships.find((m) => m.slug === crewSlug) : undefined);
    if (membership && ["owner", "admin", "co_owner"].includes(membership.role)) return "owner" as const;
    if (membership) return "member" as const;
    return "guest" as const;
  }, [dbUser?.user_id, ownerId, renterId, renterTelegramChatId, userCrewMemberships, crewId, crewSlug]);

  const withAction = (name: string, callback: () => Promise<void>) => {
    setPendingAction(name);
    startTransition(async () => {
      try {
        await callback();
      } catch (err) {
        // Task 47: an unexpected throw/rejection here used to vanish into
        // reportError (async transition throws do NOT replay to the error
        // boundary on React 18; the spinner itself reset via finally) — the
        // operator got NO feedback at all. For closure/abort a rejection
        // means the reply was lost AFTER the server may have applied the
        // UPDATE — same honest wording as the undefined-reply branch.
        console.error(`[FranchizeRentalLifecycleActions] ${name} failed:`, err);
        toast.error(
          REPLY_MAY_HAVE_APPLIED.has(name)
            ? SERVER_REPLY_LOST
            : "Действие не выполнено. Попробуйте ещё раз.",
        );
      } finally {
        setPendingAction(null);
      }
    });
  };

  const navigateToDeepLink = (deepLink: string) => {
    try {
      const resolvedUrl = new URL(deepLink, window.location.origin);
      const isSameOrigin = resolvedUrl.origin === window.location.origin;
      const isSafeProtocol = ["http:", "https:", "tg:"].includes(resolvedUrl.protocol);

      if (!isSafeProtocol) {
        toast.error("Небезопасная ссылка для перехода.");
        return;
      }

      if (isSameOrigin) {
        router.push(`${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`);
        return;
      }

      window.location.assign(resolvedUrl.toString());
    } catch (_error) {
      toast.error("Некорректная ссылка для перехода.");
    }
  };

  const canConfirmPickup = (role === "owner" || role === "member") && ["pending_confirmation", "confirmed"].includes(status);
  const pickupNeedsFreezeFirst = canConfirmPickup && !hasPickupFreeze;
  // FIX: show close button for ALL crew members (owner, admin, co_owner, AND member).
  // The server action (confirmVehicleReturn) handles the actual auth check —
  // it rejects regular members with "Недостаточно прав". Showing the button
  // is better UX than hiding it, because:
  // 1. userCrewMemberships might not have loaded yet (empty array → role="guest")
  // 2. The user might have admin role but the crewId lookup fails (UUID mismatch)
  // 3. The server-side auth is the real gate — UI visibility is just convenience
  const canConfirmReturn = (role === "owner" || role === "member") && status === "active";
  const canUploadStartPhoto = role === "renter" && ["pending_confirmation", "confirmed"].includes(status);
  const canUploadEndPhoto = role === "renter" && status === "active";
  // NEW: Abort button — for rentals that need to be cancelled:
  //  - Pre-created rentals that never happened (customer no-show, cancelled, mistake)
  //  - Active rentals created by mistake and needing to be voided (e.g. wrong bike, wrong renter, duplicate)
  // Sets status to 'cancelled' which is excluded from analytics KPIs.
  // Only available for owner/member role on rentals that haven't been completed yet.
  // Active rentals CAN be aborted — but the operator gets an extra warning in the modal
  // because cancelling an active rental is more impactful (bike already handed out).
  const canAbort = (role === "owner" || role === "member")
    && ["pending_confirmation", "confirmed", "active"].includes(status);

  // ── BUG G fix: closure-data modal state ──
  // Previously the "Подтвердить возврат" button called confirmVehicleReturn
  // with NO arguments — so odometer_after, damage_notes, deposit_returned
  // were silently dropped. Now we open a small modal first that prompts the
  // operator for these fields, then call confirmVehicleReturn with the data.
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [closureOdometer, setClosureOdometer] = useState("");
  const [closureDamageNotes, setClosureDamageNotes] = useState("");
  const [closureDamageLevel, setClosureDamageLevel] = useState<"none" | "light" | "heavy">("none");
  const [closureDepositReturned, setClosureDepositReturned] = useState(true);
  const [closureReturnNotes, setClosureReturnNotes] = useState("");
  // Task 124 — «✅ расчёт сходится» (checked by default: the operator agrees
  // with the commissions summary at a glance; unchecking deliberately marks
  // the сверка snapshot so the second party looks twice).
  const [calcOk, setCalcOk] = useState(true);
  // Task 124 (codereview fix) — the summary is LAZY: fetched once when the
  // modal opens, through the crew-gated action. null while loading/failed —
  // the block shows a loading hint, the operatorAgreed vote is only sent
  // when the checkbox was actually rendered.
  const [commissionPreview, setCommissionPreview] = useState<ClosureCommissionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 2026-09-28: the draft typed on the page (RentalOdometerInput autosave)
  // is the freshest client-side source for the prefill — the server prop
  // lags behind until router.refresh(). flushAndGetDraft() also flushes a
  // still-pending debounced save, so opening the modal right after typing
  // no longer loses the value.
  const draftStore = useRentalOdometerDraft();
  const [draftHint, setDraftHint] = useState<number | null>(null);

  // ── I2: Penalty capture state ──
  // When operator withholds part of the deposit (damage, missing fuel, etc.),
  // they enter a penalty amount + destination + reason. confirmVehicleReturn
  // then writes a `penalty` row + adjusts the auto-return to a reduced amount.
  //
  // Penalty UI is shown only when "Депозит возвращён" checkbox is ON (if it's
  // off, the operator is signalling no deposit flow at all — penalty makes no
  // sense). When penalty > 0, the modal shows a live "Возврат: X ₽ / Удержание: Y ₽"
  // breakdown so the operator can verify the math before submitting.
  const [closurePenaltyAmount, setClosurePenaltyAmount] = useState("");
  const [closurePenaltyDestination, setClosurePenaltyDestination] = useState<"cash" | "tbank" | "sber">("cash");
  const [closurePenaltyReason, setClosurePenaltyReason] = useState("");

  // ── Abort modal state ──
  // Confirm-before-abort: cancellation is irreversible (status flips to 'cancelled',
  // excluded from analytics, renter gets a Telegram notification). Modal collects
  // a brief reason so the operator has to type something — prevents misclicks.
  const [abortModalOpen, setAbortModalOpen] = useState(false);
  const [abortReason, setAbortReason] = useState("");

  // Keyboard-aware overlay (mobile: the on-screen keyboard must not cover
  // the bottom action row — see hook docblock). Declared after ALL the modal
  // state it references (hooks read abortModalOpen at render time).
  const closureOverlayRef = useRef<HTMLDivElement | null>(null);
  const abortOverlayRef = useRef<HTMLDivElement | null>(null);
  const { keyboardPx: closureKeyboardPx } = useKeyboardAwareOverlay(closureOverlayRef, closureModalOpen);
  const { keyboardPx: abortKeyboardPx } = useKeyboardAwareOverlay(abortOverlayRef, abortModalOpen);

  // Task 124 — the floating quick bar (fixed, z-50, later in DOM) used to
  // paint OVER the modal's bottom action row on mobile: the «Закрыть аренду»
  // button sat underneath it, partially under the phone's native gestures
  // too. The bar listens for this window event and hides itself while the
  // modal is open (decoupled — no prop drilling through the server page).
  useEffect(() => {
    if (closureModalOpen) {
      window.dispatchEvent(new CustomEvent("rental-closure-modal", { detail: { open: true } }));
      return () => {
        window.dispatchEvent(new CustomEvent("rental-closure-modal", { detail: { open: false } }));
      };
    }
    return undefined;
  }, [closureModalOpen]);

  // Themed CSS vars
  const lifecycleVars = useMemo(() => {
    if (isAuto) {
      return {
        "--lifecycle-bg": "color-mix(in srgb, var(--franchize-bg-card) 80%, transparent)",
        "--lifecycle-border": "var(--franchize-border-soft)",
        "--lifecycle-muted": "var(--franchize-text-secondary)",
        "--lifecycle-text": "var(--franchize-text-primary)",
        "--lifecycle-accent": "var(--franchize-accent-main)",
        "--lifecycle-accent-hover": "color-mix(in srgb, var(--franchize-accent-main) 85%, white)",
      } as React.CSSProperties;
    }
    return {
      "--lifecycle-bg": `${palette.bgCard}CC`,
      "--lifecycle-border": palette.borderSoft,
      "--lifecycle-muted": palette.textSecondary,
      "--lifecycle-text": palette.textPrimary,
      "--lifecycle-accent": palette.accentMain,
      "--lifecycle-accent-hover": palette.accentMainHover,
    } as React.CSSProperties;
  }, [isAuto, palette]);

  return (
    <div
      className="mt-4 rounded-2xl border p-3"
      style={{
        ...lifecycleVars,
        backgroundColor: "var(--lifecycle-bg)",
        borderColor: "var(--lifecycle-border)",
      }}
    >
      {/* goodmorning-polish: removed "Lifecycle controls" heading + "Роль: ... · payment: ..." line.
          This info is already visible elsewhere on the page (status badge, detail grid shows
          payment status in Russian). Keeping it here was redundant visual noise. */}

      <div className="grid gap-2 sm:grid-cols-2">
        {canConfirmPickup && (
          <button
            type="button"
            disabled={isPending || pickupNeedsFreezeFirst}
            onClick={() =>
              withAction("pickup", async () => {
                if (!dbUser?.user_id) {
                  toast.error("Нужна авторизация в Telegram WebApp.");
                  return;
                }
                if (!hasPickupFreeze) {
                  toast.error("Сначала сохраните выдачу в документах аренды.");
                  return;
                }
                const result = await confirmVehiclePickup(rentalId, dbUser.user_id);
                if (!result?.success) {
                  toast.error(result?.error || "Не удалось подтвердить получение.");
                  return;
                }
                toast.success("Получение подтверждено. Обновите карточку для актуального статуса.");
              })
            }
            className="rounded-xl bg-[var(--lifecycle-accent)] px-3 py-2 text-sm font-semibold text-[#16130A] transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lifecycle-accent)]"
          >
            {pendingAction === "pickup" ? "Подтверждаем..." : "Подтвердить выдачу"}
          </button>
        )}

        {canConfirmReturn && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              // BUG G fix: open the closure-data modal instead of immediately
              // calling confirmVehicleReturn. The modal collects odometer_after,
              // damage_notes, deposit_returned, return_notes — then the actual
              // confirmVehicleReturn call happens in handleSubmitClosure.
              // 2026-09-28: prefill from the SHARED DRAFT STORE (flushes a
              // pending debounced save first) — falls back to the server prop.
              void (async () => {
                let draft = odometerAfterDraft;
                try {
                  draft = (await draftStore?.flushAndGetDraft()) ?? odometerAfterDraft;
                } catch {
                  /* fall back to the server prop */
                }
                // 2026-09-28b (owner re-report «odometer passed to modal
                // inconsistently»): the draft store only knows about saves made
                // on THIS device — a draft typed by the RENTER (his own end
                // reading) or on the operator's other device never reached it.
                // Before showing an empty field, pull the DB truth; report it
                // back to the store so reopen skips the round-trip.
                if (draft == null) {
                  try {
                    const res = await fetch(
                      `/api/franchize/rental-odometer?rentalId=${encodeURIComponent(rentalId)}`,
                      { cache: "no-store" },
                    );
                    const json = await res.json().catch(() => null);
                    const serverDraft: unknown = json?.odometer_after_draft;
                    if (res.ok && json?.success && typeof serverDraft === "number") {
                      draft = serverDraft;
                      draftStore?.reportSaved(serverDraft);
                    }
                  } catch {
                    /* offline — the operator types the value manually */
                  }
                }
                setClosureOdometer(draft != null ? String(draft) : "");
                setDraftHint(draft ?? null);
                setClosureDamageNotes("");
                setClosureDamageLevel("none");
                setClosureDepositReturned(true);
                setClosureReturnNotes("");
                // Task 124 — «расчёт ок» re-checked every open (the summary
                // may differ from the previous rental's; default = agree).
                setCalcOk(true);
                // Task 124 — lazy commissions summary: one fetch per open,
                // non-fatal (null → the modal works without the block).
                setCommissionPreview(null);
                if (crewSlug) {
                  setPreviewLoading(true);
                  void (async () => {
                    try {
                      const res = await getClosureCommissionPreviewAction({ slug: crewSlug, rentalId });
                      if (res.success && res.data) setCommissionPreview(res.data);
                    } catch {
                      /* block stays hidden */
                    } finally {
                      setPreviewLoading(false);
                    }
                  })();
                }
                // I2: reset penalty state too — don't carry over from previous rental
                setClosurePenaltyAmount("");
                setClosurePenaltyDestination("cash");
                setClosurePenaltyReason("");
                setClosureModalOpen(true);
                // Scroll to modal after render
                setTimeout(() => {
                  const modal = document.querySelector('[role="dialog"]');
                  if (modal) modal.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 50);
              })();
            }}
            className="rounded-xl bg-[var(--lifecycle-accent-hover)] px-3 py-2 text-sm font-semibold text-[#16130A] transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lifecycle-accent)]"
          >
            {pendingAction === "return" ? "Подтверждаем..." : "Подтвердить возврат"}
          </button>
        )}

        {canAbort && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setAbortReason("");
              setAbortModalOpen(true);
            }}
            className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
          >
            {pendingAction === "abort" ? "Отменяем..." : "Отменить аренду"}
          </button>
        )}

        {canUploadStartPhoto && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              withAction("photo-start", async () => {
                if (!dbUser?.user_id) {
                  toast.error("Нужна авторизация в Telegram WebApp.");
                  return;
                }
                const result = await initiateTelegramRentalPhotoUpload(rentalId, dbUser.user_id, "start");
                if (!result?.success || !result.deepLink) {
                  toast.error(result?.error || "Не удалось открыть сценарий фото ДО.");
                  return;
                }
                navigateToDeepLink(result.deepLink);
              })
            }
            className="rounded-xl border border-[var(--lifecycle-border)] px-3 py-2 text-sm text-[var(--lifecycle-text)] transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lifecycle-accent)]"
          >
            {pendingAction === "photo-start" ? "Открываем..." : "Фото ДО в Telegram"}
          </button>
        )}

        {canUploadEndPhoto && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              withAction("photo-end", async () => {
                if (!dbUser?.user_id) {
                  toast.error("Нужна авторизация в Telegram WebApp.");
                  return;
                }
                const result = await initiateTelegramRentalPhotoUpload(rentalId, dbUser.user_id, "end");
                if (!result?.success || !result.deepLink) {
                  toast.error(result?.error || "Не удалось открыть сценарий фото ПОСЛЕ.");
                  return;
                }
                navigateToDeepLink(result.deepLink);
              })
            }
            className="rounded-xl border border-[var(--lifecycle-border)] px-3 py-2 text-sm text-[var(--lifecycle-text)] transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lifecycle-accent)]"
          >
            {pendingAction === "photo-end" ? "Открываем..." : "Фото ПОСЛЕ в Telegram"}
          </button>
        )}
      </div>

      {role === "guest" && <p className="mt-3 text-xs text-[var(--lifecycle-muted)]">Действия доступны владельцу, арендатору или участнику экипажа.</p>}
      {pickupNeedsFreezeFirst && (
        <p className="mt-3 text-xs text-[var(--lifecycle-muted)]">
          Подтверждение выдачи будет доступно после сохранения выдачи в документах аренды.
        </p>
      )}

      {/* ── BUG G fix: closure-data modal ──
          Collects odometer_after, damage_notes, deposit_returned, return_notes
          before calling confirmVehicleReturn. Previously the button called
          confirmVehicleReturn with NO arguments — closure data was silently
          dropped, bikes never got last_known_odometer updated, deposits were
          not tracked, damage wasn't recorded. */}
      {closureModalOpen && (
        <div
          ref={closureOverlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="closure-modal-title"
          // 2026-09-28 UX: bottom-sheet on mobile (items-end) — the keyboard can
          // never cover the sheet's action row, because the sheet starts at the
          // bottom edge and the overlay padding tracks the keyboard height
          // (visualViewport). Desktop keeps the centered dialog look.
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto sm:items-center sm:p-4"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            // 2026-10-29 (owner voice): on Android TG WebView the sheet's
            // bottom edge sat flush with the screen bottom — right under the
            // system nav/gesture bar. Lift the WHOLE sheet 12px even without
            // a keyboard (footer padding adds the rest).
            paddingBottom: closureKeyboardPx > 0 ? closureKeyboardPx : 12,
          }}
          onClick={() => !isPending && setClosureModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-t-2xl border flex flex-col sm:my-8 sm:rounded-2xl"
            style={{
              backgroundColor: "var(--lifecycle-bg)",
              borderColor: "var(--lifecycle-border)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              // Task 124 height diet: the CARD no longer scrolls as a whole —
              // the fields area scrolls, the action row is a fixed footer, so
              // «Закрыть аренду» can never end up at the very bottom edge of
              // the screen (under the quick bar / native gestures).
              maxHeight: `calc(100dvh - ${closureKeyboardPx > 0 ? closureKeyboardPx : 0}px - 1rem)`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-2"
            >
            <h3 id="closure-modal-title" className="text-lg font-bold mb-1" style={{ color: "var(--lifecycle-text)" }}>
              Подтвердить возврат
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--lifecycle-muted)" }}>
              Заполните поля перед закрытием аренды. Все данные сохранятся в карточку.
            </p>
            {/* 2026-09-28: transparency — show WHERE the prefill came from when
                a draft was typed on the page (owner report: the saved value
                "didn't appear" in the modal). */}
            {draftHint != null && (
              <p className="mb-3 rounded-lg px-2.5 py-1.5 text-[11px] font-medium" style={{ color: "var(--lifecycle-muted)", backgroundColor: "color-mix(in srgb, var(--lifecycle-accent) 8%, transparent)" }}>
                📏 Подставлен черновик со страницы: {draftHint.toLocaleString("ru-RU")} км — ввод на странице аренды.
              </p>
            )}

            <div className="space-y-3">
              {/* Task 124 — the full odometer input lives on the rental page
                  (with the live delta there); the modal keeps only a mini
                  read-only line. Half the modal height won back. */}
              <div
                className="rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "var(--lifecycle-border)",
                  backgroundColor: "color-mix(in srgb, var(--lifecycle-accent) 5%, transparent)",
                }}
              >
                {(() => {
                  const beforeNum = typeof odometerBefore === "number" ? odometerBefore : null;
                  const endNum = closureOdometer.trim() === "" ? null : Math.round(Number(closureOdometer));
                  const endValid = endNum != null && !Number.isNaN(endNum);
                  if (!endValid) {
                    return (
                      <span style={{ color: "#f59e0b" }}>
                        ⚠️ Одометр не указан — впишите «Одометр при возврате» на странице аренды (поле ниже по карточке).
                      </span>
                    );
                  }
                  const delta = beforeNum != null ? endNum! - beforeNum : null;
                  return (
                    <span style={{ color: "var(--lifecycle-text)" }}>
                      🛞 Одометр: <b>{endNum!.toLocaleString("ru-RU")} км</b>
                      {beforeNum != null && (
                        <>
                          {" "}/ выдача {beforeNum.toLocaleString("ru-RU")} /{" "}
                          <b style={{ color: delta != null && delta < 0 ? "#ef4444" : "#22c55e" }}>
                            {delta != null && delta < 0
                              ? "меньше выдачи — проверьте"
                              : `+${delta!.toLocaleString("ru-RU")} км`}
                          </b>
                        </>
                      )}
                    </span>
                  );
              })()}
              </div>

              {/* Fix: show payment split from rental start — helps operator
                  understand how much was collected and in what form. */}
              {paymentSplit && (paymentSplit.cash > 0 || paymentSplit.bank > 0) && (
                <div
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{
                    borderColor: "var(--lifecycle-border)",
                    backgroundColor: "color-mix(in srgb, var(--lifecycle-accent) 5%, transparent)",
                  }}
                >
                  <span style={{ color: "var(--lifecycle-muted)" }}>Получено при выдаче: </span>
                  {paymentSplit.cash > 0 && (
                    <span style={{ color: "#22c55e" }}>💵 {paymentSplit.cash.toLocaleString("ru-RU")} ₽</span>
                  )}
                  {paymentSplit.cash > 0 && paymentSplit.bank > 0 && <span style={{ color: "var(--lifecycle-muted)" }}> + </span>}
                  {paymentSplit.bank > 0 && (
                    <span style={{ color: "#3b82f6" }}>
                      💳 {paymentSplit.bank.toLocaleString("ru-RU")} ₽
                      {paymentSplit.cardDestination ? ` (${paymentSplit.cardDestination === "tbank" ? "Тинькофф" : "Сбербанк"})` : ""}
                    </span>
                  )}
                </div>
              )}

              {previewLoading && !commissionPreview && (
                <div
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{
                    borderColor: "var(--lifecycle-border)",
                    backgroundColor: "color-mix(in srgb, var(--lifecycle-accent) 5%, transparent)",
                    color: "var(--lifecycle-muted)",
                  }}
                >
                  🧮 Считаем расчёт сверки…
                </div>
              )}

              {/* ── Task 124: commissions summary + «расчёт ок» checkbox ──
                  The operator used to sign the closure BLIND: the сверка math
                  appeared only after closure, in the Telegram DM. Now the same
                  canonical numbers ride IN the modal (lazy-fetched once per
                  open), with a pre-checked «расчёт сходится» — one glance,
                  one tap, done. Unchecking marks the snapshot so the owner
                  looks twice. */}
              {commissionPreview && Number(commissionPreview.totalCost) > 0 && (
                <div
                  className="rounded-lg border p-3 space-y-1.5"
                  style={{
                    borderColor: "var(--lifecycle-border)",
                    backgroundColor: "color-mix(in srgb, var(--lifecycle-accent) 6%, transparent)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold" style={{ color: "var(--lifecycle-text)" }}>
                      🧮 Расчёт сверки
                    </span>
                    {commissionPreview.formula?.shortRental && (
                      <span className="text-[10px] font-semibold" style={{ color: "#f59e0b" }}>
                        до 24 ч — комиссия пополам
                      </span>
                    )}
                  </div>
                  {commissionPreview.formula && (
                    <p className="text-xs leading-relaxed" style={{ color: "var(--lifecycle-muted)" }}>
                      эталон: мот <b style={{ color: "var(--lifecycle-text)" }}>{Math.round(commissionPreview.formula.bikeStandard).toLocaleString("ru-RU")} ₽</b>
                      {commissionPreview.formula.bikeTierLabel ? ` (${commissionPreview.formula.bikeTierLabel})` : ""}
                      {" "}+ экип <b style={{ color: "var(--lifecycle-text)" }}>{Math.round(commissionPreview.formula.gearStandard).toLocaleString("ru-RU")} ₽</b>
                      {" "}= <b style={{ color: "var(--lifecycle-text)" }}>{Math.round(commissionPreview.formula.standardTotal).toLocaleString("ru-RU")} ₽</b>
                    </p>
                  )}
                  <p className="text-xs leading-relaxed" style={{ color: "var(--lifecycle-muted)" }}>
                    чек <b style={{ color: "var(--lifecycle-text)" }}>{Math.round(commissionPreview.totalCost).toLocaleString("ru-RU")} ₽</b>
                    {" "}+ наценка{" "}
                    <b style={{ color: Number(commissionPreview.overprice) > 0 ? "#f59e0b" : "var(--lifecycle-text)" }}>
                      {Math.round(commissionPreview.overprice).toLocaleString("ru-RU")} ₽
                    </b>
                    {" "}+ комиссия{" "}
                    <b style={{ color: "#22c55e" }}>
                      {Math.round(commissionPreview.total).toLocaleString("ru-RU")} ₽
                    </b>
                    {commissionPreview.formula ? (
                      <> ({Math.round(commissionPreview.base).toLocaleString("ru-RU")} + {Math.round(commissionPreview.equipment).toLocaleString("ru-RU")} + {Math.round(commissionPreview.overprice).toLocaleString("ru-RU")})</>
                    ) : null}
                  </p>
                  {commissionPreview.paper && (
                    <p className="text-xs leading-relaxed" style={{ color: "var(--lifecycle-muted)" }}>
                      📄 договор: <b style={{ color: "var(--lifecycle-text)" }}>{Math.round(commissionPreview.paper.totalSum).toLocaleString("ru-RU")} ₽</b>
                      {" "}+ залог{" "}
                      <b style={{ color: "var(--lifecycle-text)" }}>{Math.round(commissionPreview.paper.depositRub).toLocaleString("ru-RU")} ₽</b>
                      {commissionPreview.paper.depositRub > 0 && Number(commissionPreview.depositBooks) === 0 && (
                        <span style={{ color: "#f59e0b" }}> · в учёте залог 0 ₽</span>
                      )}
                      {commissionPreview.paper.depositRub > 0 &&
                        Number(commissionPreview.depositBooks) > 0 &&
                        Number(commissionPreview.depositBooks) !== commissionPreview.paper.depositRub && (
                          <span style={{ color: "#f59e0b" }}>
                            {" "}· в учёте {Math.round(commissionPreview.depositBooks).toLocaleString("ru-RU")} ₽
                          </span>
                        )}
                    </p>
                  )}
                  <label
                    className="flex items-start gap-2 cursor-pointer rounded-lg border px-2.5 py-2"
                    style={{
                      borderColor: calcOk ? "#22c55e66" : "#f59e0b99",
                      backgroundColor: calcOk ? "#22c55e12" : "#f59e0b1a",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={calcOk}
                      onChange={(e) => setCalcOk(e.target.checked)}
                      disabled={isPending}
                      className="h-4 w-4 mt-0.5"
                    />
                    <span className="text-xs" style={{ color: "var(--lifecycle-text)" }}>
                      <b>Расчёт сходится</b> — сверка уйдёт владельцу автоматически
                      {!calcOk && (
                        <span className="block text-[11px]" style={{ color: "#f59e0b" }}>
                          сверка уйдёт с пометкой «оператор не согласился» — владелец присмотрится
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={closureDepositReturned}
                  onChange={(e) => setClosureDepositReturned(e.target.checked)}
                  disabled={isPending}
                  className="h-4 w-4"
                />
                <span className="text-sm" style={{ color: "var(--lifecycle-text)" }}>
                  Депозит возвращён арендатору
                </span>
              </label>

              {/* ── I2: Penalty capture ──
                  Shows ONLY when "Депозит возвращён" is checked (otherwise penalty makes no sense).
                  Lets the operator withhold part of the deposit for damage / missing fuel / etc.
                  Writes a `penalty` row + adjusts the auto-return to a reduced amount.
                  Math: if collected=20000, penalty=3000 → returned=17000. */}
              {closureDepositReturned && (
                <div
                  className="rounded-lg border p-3 space-y-2"
                  style={{
                    borderColor: closurePenaltyAmount ? "rgba(239, 68, 68, 0.4)" : "var(--lifecycle-border)",
                    backgroundColor: closurePenaltyAmount ? "rgba(239, 68, 68, 0.05)" : "transparent",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold" style={{ color: "var(--lifecycle-muted)" }}>
                      ⚠️ Удержание из депозита
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--lifecycle-muted)" }}>
                      необязательно
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[10px] font-medium" style={{ color: "var(--lifecycle-muted)" }}>
                        Сумма удержания, ₽
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={closurePenaltyAmount}
                        onChange={(e) => setClosurePenaltyAmount(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder="например, 3000"
                        disabled={isPending}
                        className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
                        style={{
                          backgroundColor: "var(--lifecycle-bg)",
                          borderColor: "var(--lifecycle-border)",
                          color: "var(--lifecycle-text)",
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-medium" style={{ color: "var(--lifecycle-muted)" }}>
                        Куда применить
                      </span>
                      <select
                        value={closurePenaltyDestination}
                        onChange={(e) => setClosurePenaltyDestination(e.target.value as "cash" | "tbank" | "sber")}
                        disabled={isPending}
                        className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
                        style={{
                          backgroundColor: "var(--lifecycle-bg)",
                          borderColor: "var(--lifecycle-border)",
                          color: "var(--lifecycle-text)",
                        }}
                      >
                        <option value="cash">💵 Наличные</option>
                        <option value="tbank">💳 Тинькофф</option>
                        <option value="sber">💳 Сбербанк</option>
                      </select>
                    </label>
                  </div>
                  {closurePenaltyAmount && (
                    <label className="block">
                      <span className="text-[10px] font-medium" style={{ color: "var(--lifecycle-muted)" }}>
                        Причина удержания
                      </span>
                      <input
                        type="text"
                        value={closurePenaltyReason}
                        onChange={(e) => setClosurePenaltyReason(e.target.value)}
                        placeholder="например, царапина на баке"
                        disabled={isPending}
                        className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm outline-none"
                        style={{
                          backgroundColor: "var(--lifecycle-bg)",
                          borderColor: "var(--lifecycle-border)",
                          color: "var(--lifecycle-text)",
                        }}
                      />
                    </label>
                  )}
                  {closurePenaltyAmount && (
                    <p className="text-[10px] italic" style={{ color: "var(--lifecycle-muted)" }}>
                      Депозит будет возвращён за вычетом удержания.
                      Сумма удержания спишется с выбранного назначения (cash / T-Bank / Sber).
                    </p>
                  )}
                </div>
              )}

              <div>
                <span className="text-xs font-semibold" style={{ color: "var(--lifecycle-muted)" }}>
                  Состояние ТС при возврате
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {([
                    { value: "none", label: "Без повреждений", color: "#22c55e" },
                    { value: "light", label: "Лёгкие", color: "#f59e0b" },
                    { value: "heavy", label: "Серьёзные", color: "#ef4444" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setClosureDamageLevel(opt.value)}
                      disabled={isPending}
                      className="rounded-lg border px-2 py-2 text-xs font-semibold transition"
                      style={{
                        borderColor: closureDamageLevel === opt.value ? opt.color : "var(--lifecycle-border)",
                        backgroundColor: closureDamageLevel === opt.value ? `${opt.color}20` : "transparent",
                        color: closureDamageLevel === opt.value ? opt.color : "var(--lifecycle-text)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {closureDamageLevel !== "none" && (
                <label className="block">
                  <span className="text-xs font-semibold" style={{ color: "var(--lifecycle-muted)" }}>
                    Детали повреждений
                  </span>
                  <textarea
                    value={closureDamageNotes}
                    onChange={(e) => setClosureDamageNotes(e.target.value)}
                    placeholder="Опишите повреждения: царапины, потёртости, отсутствующие детали…"
                    disabled={isPending}
                    rows={2}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                    style={{
                      backgroundColor: "var(--lifecycle-bg)",
                      borderColor: "var(--lifecycle-border)",
                      color: "var(--lifecycle-text)",
                    }}
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--lifecycle-muted)" }}>
                  Комментарий оператора (необязательно)
                </span>
                <textarea
                  value={closureReturnNotes}
                  onChange={(e) => setClosureReturnNotes(e.target.value)}
                  placeholder="Любые дополнительные заметки…"
                  disabled={isPending}
                  rows={2}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                  style={{
                    backgroundColor: "var(--lifecycle-bg)",
                    borderColor: "var(--lifecycle-border)",
                    color: "var(--lifecycle-text)",
                  }}
                />
              </label>
            </div>

            {/* Photo gallery removed from closure modal (user request — modal
                was too big, didn't fit screen height). Photos are managed on
                the rental detail page itself, not in the closure modal. */}
            </div>

            {/* Task 124 — fixed footer: always visible, out of the scroll flow,
                safe-area aware. Combined with the quick-bar auto-hide (window
                event) the «Закрыть аренду» button is reachable on ANY phone.
                2026-10-29 (owner voice «кнопки под системными кнопками
                андроида»): env(safe-area-inset-bottom)=0 в Android WebView —
                теперь --app-safe-bottom (флор 16px) + 8px запаса, кнопки py-3
                (target ≥44px). Итог: ~28px от футера + 12px лифт оверлея. */}
            <div
              className="flex gap-2 border-t px-5 pt-3"
              style={{
                borderColor: "var(--lifecycle-border)",
                backgroundColor: "var(--lifecycle-bg)",
                paddingBottom: "calc(var(--app-safe-bottom, 16px) + 0.5rem)",
              }}
            >
              <button
                type="button"
                onClick={() => setClosureModalOpen(false)}
                disabled={isPending}
                className="flex-1 rounded-xl px-3 py-3 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--lifecycle-border) 30%, transparent)",
                  color: "var(--lifecycle-text)",
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  withAction("return", async () => {
                    if (!dbUser?.user_id) {
                      toast.error("Нужна авторизация в Telegram WebApp.");
                      return;
                    }
                    // I2: parse penalty amount (empty string → 0)
                    const penaltyAmt = closurePenaltyAmount
                      ? parseInt(closurePenaltyAmount, 10)
                      : 0;
                    const result = await confirmVehicleReturn(rentalId, dbUser.user_id, {
                      odometerAfter: closureOdometer ? Math.round(Number(closureOdometer)) : null,
                      damageNotes: closureDamageLevel !== "none"
                        ? `[${closureDamageLevel === "heavy" ? "Серьёзные повреждения" : "Лёгкие повреждения"}] ${closureDamageNotes.trim()}`
                        : null,
                      depositReturned: closureDepositReturned,
                      returnNotes: closureReturnNotes.trim() || null,
                      // Task 124 — the «расчёт сходится» vote travels into the
                      // сверка snapshot (agreement line / disagreement flag).
                      // Sent ONLY when the summary (and its checkbox) actually
                      // rendered — no invisible agreement (codereview A2).
                      operatorAgreed: commissionPreview ? calcOk : undefined,
                      // I2: penalty capture — only sent if amount > 0
                      ...(penaltyAmt > 0 ? {
                        penalty: {
                          amount: penaltyAmt,
                          destination: closurePenaltyDestination,
                          reason: closurePenaltyReason.trim() || "Penalty withheld at closure",
                        },
                      } : {}),
                    });
                    // Task 47: undefined reply = transport died mid-call; the
                    // rental may already be completed server-side (the UPDATE
                    // precedes all the non-fatal notifications). Refresh so
                    // the card shows the REAL status instead of telling the
                    // operator to check manually.
                    if (!result) {
                      toast.error(SERVER_REPLY_LOST);
                      router.refresh();
                      return;
                    }
                    if (!result.success) {
                      toast.error(result.error || "Не удалось подтвердить возврат.");
                      return;
                    }
                    // I2: surface penalty-specific errors (non-fatal — rental still closed)
                    if (result.penaltyError) {
                      toast.warning(`Возврат подтверждён, но удержание не записано: ${result.penaltyError}`);
                    } else {
                      toast.success("Возврат подтверждён. Карточка обновится.");
                    }
                    setClosureModalOpen(false);
                    // router.refresh() re-fetches server data so the page reflects the new "completed" status
                    router.refresh();
                  })
                }
                className="flex-1 rounded-xl px-3 py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: "var(--lifecycle-accent)",
                  color: "#16130A",
                }}
              >
                {pendingAction === "return" ? "Сохраняем…" : "Закрыть аренду"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Abort modal ── */}
      {abortModalOpen && (
        <div
          ref={abortOverlayRef}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
          style={{ paddingBottom: abortKeyboardPx > 0 ? abortKeyboardPx : 12 }}
          onClick={() => !isPending && setAbortModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border p-5 sm:my-8 sm:rounded-2xl"
            style={{
              backgroundColor: "var(--lifecycle-bg)",
              borderColor: "rgba(244, 63, 94, 0.5)",
              maxHeight: `calc(100dvh - ${abortKeyboardPx > 0 ? abortKeyboardPx : 0}px - 1rem)`,
              overflowY: "auto",
              overscrollBehavior: "contain",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-rose-200">Отменить аренду?</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--lifecycle-text)" }}>
              Аренда будет помечена как <span className="font-semibold text-rose-300">отменённая</span>:
            </p>
            <ul className="mt-2 list-disc pl-5 text-xs space-y-1" style={{ color: "var(--lifecycle-muted)" }}>
              <li>Статус сменится на «Отменена»</li>
              <li>Аренда перестанет учитываться в аналитике (KPI, выручка, конверсия)</li>
              <li>Арендатор получит уведомление в Telegram</li>
              <li>Действие необратимо — отмену нельзя будет «вернуть»</li>
              {status === "active" && (
                <li className="font-semibold text-rose-300 pt-1">
                  ⚠ Внимание: эта аренда уже АКТИВНА — байк был выдан клиенту.
                  Перед отменой убедитесь, что байк физически вернулся к вам.
                  Эта кнопка только меняет статус в БД — она не оформляет возврат.
                </li>
              )}
            </ul>
            <label className="mt-3 block text-xs font-semibold" style={{ color: "var(--lifecycle-text)" }}>
              Причина отмены (необязательно, но желательно):
            </label>
            <textarea
              value={abortReason}
              onChange={(e) => setAbortReason(e.target.value)}
              placeholder="Например: клиент не приехал, передумал, ошибка создания, активная создана по ошибке..."
              rows={2}
              className="mt-1 w-full rounded-lg border p-2 text-sm"
              style={{
                backgroundColor: "var(--lifecycle-bg)",
                borderColor: "var(--lifecycle-border)",
                color: "var(--lifecycle-text)",
              }}
            />
            {/* 2026-10-29: same Android nav-bar clearance as the closure modal
                (--app-safe-bottom) + taller buttons (py-3). */}
            <div
              className="mt-3 flex gap-2"
              style={{ paddingBottom: "calc(var(--app-safe-bottom, 16px) + 0.25rem)" }}
            >
              <button
                type="button"
                disabled={isPending}
                onClick={() => !isPending && setAbortModalOpen(false)}
                className="flex-1 rounded-xl border px-3 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  borderColor: "var(--lifecycle-border)",
                  color: "var(--lifecycle-text)",
                }}
              >
                Не отменять
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  withAction("abort", async () => {
                    if (!dbUser?.user_id) {
                      toast.error("Нужна авторизация в Telegram WebApp.");
                      return;
                    }
                    const result = await abortRental({
                      rentalId,
                      actorUserId: dbUser.user_id,
                      reason: abortReason.trim() || undefined,
                      crewSlug,
                    });
                    if (!result) {
                      toast.error(SERVER_REPLY_LOST);
                      router.refresh();
                      return;
                    }
                    if (!result.success) {
                      toast.error(result.error || "Не удалось отменить аренду.");
                      return;
                    }
                    toast.success("Аренда отменена. Она больше не учитывается в аналитике.");
                    setAbortModalOpen(false);
                    router.refresh();
                  })
                }
                className="flex-1 rounded-xl px-3 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#e11d48" }}
              >
                {pendingAction === "abort" ? "Отменяем…" : "Подтвердить отмену"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

