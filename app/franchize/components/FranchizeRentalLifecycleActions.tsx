"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import {
  confirmVehiclePickup,
  confirmVehicleReturn,
  initiateTelegramRentalPhotoUpload,
} from "@/app/rentals/actions";

interface FranchizeRentalLifecycleActionsProps {
  rentalId: string;
  ownerId: string;
  renterId: string;
  // NEW (polish 2026-07-30): fallback renter identity for bot/QR-flow rentals.
  // When rentals.user_id is null (rental created via bot / QR claim), the
  // renter's Telegram chat ID lives in private.rental_contract_artefacts.telegram_chat_id.
  // We use it to detect the renter role when renterId is empty.
  renterTelegramChatId?: string;
  renterFullName?: string;
  crewId: string;
  crewSlug?: string;
  status: string;
  paymentStatus: string;
  hasPickupFreeze: boolean;
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
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--lifecycle-muted)]">Lifecycle controls</p>
      <p className="mt-1 text-xs text-[var(--lifecycle-muted)]">
        Роль: {role === "owner" ? "владелец" : role === "renter" ? `арендатор${renterFullName ? ` (${renterFullName})` : ""}` : role === "member" ? "участник экипажа" : dbUser?.user_id ? "загрузка…" : "наблюдатель"} · payment: {paymentStatus}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                if (!result.success) {
                  toast.error(result.error || "Не удалось подтвердить получение.");
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
              setClosureOdometer("");
              setClosureDamageNotes("");
              setClosureDamageLevel("none");
              setClosureDepositReturned(true);
              setClosureReturnNotes("");
              setClosureModalOpen(true);
              // Scroll to modal after render
              setTimeout(() => {
                const modal = document.querySelector('[role="dialog"]');
                if (modal) modal.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 50);
            }}
            className="rounded-xl bg-[var(--lifecycle-accent-hover)] px-3 py-2 text-sm font-semibold text-[#16130A] transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lifecycle-accent)]"
          >
            {pendingAction === "return" ? "Подтверждаем..." : "Подтвердить возврат"}
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
                if (!result.success || !result.deepLink) {
                  toast.error(result.error || "Не удалось открыть сценарий фото ДО.");
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
                if (!result.success || !result.deepLink) {
                  toast.error(result.error || "Не удалось открыть сценарий фото ПОСЛЕ.");
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="closure-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
          onClick={() => !isPending && setClosureModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md my-8 rounded-2xl border p-5"
            style={{
              backgroundColor: "var(--lifecycle-bg)",
              borderColor: "var(--lifecycle-border)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="closure-modal-title" className="text-lg font-bold mb-1" style={{ color: "var(--lifecycle-text)" }}>
              Подтвердить возврат
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--lifecycle-muted)" }}>
              Заполните поля перед закрытием аренды. Все данные сохранятся в карточку.
            </p>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--lifecycle-muted)" }}>
                  Финальный одометр (км)
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={closureOdometer}
                  onChange={(e) => setClosureOdometer(e.target.value)}
                  placeholder="например, 12345"
                  disabled={isPending}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--lifecycle-bg)",
                    borderColor: "var(--lifecycle-border)",
                    color: "var(--lifecycle-text)",
                  }}
                />
              </label>

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

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setClosureModalOpen(false)}
                disabled={isPending}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
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
                    const result = await confirmVehicleReturn(rentalId, dbUser.user_id, {
                      odometerAfter: closureOdometer ? parseInt(closureOdometer, 10) : null,
                      damageNotes: closureDamageLevel !== "none"
                        ? `[${closureDamageLevel === "heavy" ? "Серьёзные повреждения" : "Лёгкие повреждения"}] ${closureDamageNotes.trim()}`
                        : null,
                      depositReturned: closureDepositReturned,
                      returnNotes: closureReturnNotes.trim() || null,
                    });
                    if (!result.success) {
                      toast.error(result.error || "Не удалось подтвердить возврат.");
                      return;
                    }
                    toast.success("Возврат подтверждён. Карточка обновится.");
                    setClosureModalOpen(false);
                    // router.refresh() re-fetches server data so the page reflects the new "completed" status
                    router.refresh();
                  })
                }
                className="flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
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
    </div>
  );
}
