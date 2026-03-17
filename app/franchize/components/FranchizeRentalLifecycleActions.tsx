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
  status: string;
  paymentStatus: string;
  palette: {
    accentMain: string;
    accentMainHover: string;
    bgCard: string;
    borderSoft: string;
    textPrimary: string;
    textSecondary: string;
  };
}

export function FranchizeRentalLifecycleActions({
  rentalId,
  ownerId,
  renterId,
  status,
  paymentStatus,
  palette,
}: FranchizeRentalLifecycleActionsProps) {
  const { dbUser } = useAppContext();
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const role = useMemo(() => {
    if (!dbUser?.user_id) return "guest" as const;
    if (dbUser.user_id === ownerId) return "owner" as const;
    if (dbUser.user_id === renterId) return "renter" as const;
    return "guest" as const;
  }, [dbUser?.user_id, ownerId, renterId]);

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

  const canConfirmPickup = role === "owner" && ["pending_confirmation", "confirmed"].includes(status);
  const canConfirmReturn = role === "owner" && status === "active";
  const canUploadStartPhoto = role === "renter" && ["pending_confirmation", "confirmed"].includes(status);
  const canUploadEndPhoto = role === "renter" && status === "active";

  return (
    <div
      className="mt-4 rounded-2xl border bg-[var(--lifecycle-bg)] p-3"
      style={{
        ["--lifecycle-bg" as string]: `${palette.bgCard}CC`,
        ["--lifecycle-border" as string]: palette.borderSoft,
        ["--lifecycle-muted" as string]: palette.textSecondary,
        ["--lifecycle-text" as string]: palette.textPrimary,
        ["--lifecycle-accent" as string]: palette.accentMain,
        ["--lifecycle-accent-hover" as string]: palette.accentMainHover,
        borderColor: "var(--lifecycle-border)",
      }}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--lifecycle-muted)]">Lifecycle controls</p>
      <p className="mt-1 text-xs text-[var(--lifecycle-muted)]">
        Роль: {role === "owner" ? "владелец" : role === "renter" ? "арендатор" : "наблюдатель"} · payment: {paymentStatus}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {canConfirmPickup && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              withAction("pickup", async () => {
                if (!dbUser?.user_id) {
                  toast.error("Нужна авторизация в Telegram WebApp.");
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
            className="rounded-xl bg-[var(--lifecycle-accent)] px-3 py-2 text-sm font-semibold text-[#16130A] transition-colors hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lifecycle-accent)]"
          >
            {pendingAction === "pickup" ? "Подтверждаем..." : "Подтвердить выдачу"}
          </button>
        )}

        {canConfirmReturn && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              withAction("return", async () => {
                if (!dbUser?.user_id) {
                  toast.error("Нужна авторизация в Telegram WebApp.");
                  return;
                }
                const result = await confirmVehicleReturn(rentalId, dbUser.user_id);
                if (!result.success) {
                  toast.error(result.error || "Не удалось подтвердить возврат.");
                  return;
                }
                toast.success("Возврат подтвержден. Обновите карточку для актуального статуса.");
              })
            }
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
                if (!result.success) {
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
                if (!result.success) {
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

      {role === "guest" && <p className="mt-3 text-xs text-[var(--lifecycle-muted)]">Действия доступны владельцу или арендатору этой сделки.</p>}
    </div>
  );
}
