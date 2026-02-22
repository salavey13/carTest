"use client";

import { useMemo, useState, useTransition } from "react";
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

  const canConfirmPickup = role === "owner" && ["pending_confirmation", "confirmed"].includes(status);
  const canConfirmReturn = role === "owner" && status === "active";
  const canUploadStartPhoto = role === "renter" && ["pending_confirmation", "confirmed"].includes(status);
  const canUploadEndPhoto = role === "renter" && status === "active";

  return (
    <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: palette.borderSoft, backgroundColor: `${palette.bgCard}CC` }}>
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: palette.textSecondary }}>
        Lifecycle controls
      </p>
      <p className="mt-1 text-xs" style={{ color: palette.textSecondary }}>
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
            className="rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ backgroundColor: palette.accentMain, color: "#16130A" }}
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
            className="rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ backgroundColor: palette.accentMainHover, color: "#16130A" }}
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
                window.location.assign(result.deepLink);
              })
            }
            className="rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: palette.borderSoft, color: palette.textPrimary }}
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
                window.location.assign(result.deepLink);
              })
            }
            className="rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: palette.borderSoft, color: palette.textPrimary }}
          >
            {pendingAction === "photo-end" ? "Открываем..." : "Фото ПОСЛЕ в Telegram"}
          </button>
        )}
      </div>

      {role === "guest" && <p className="mt-3 text-xs" style={{ color: palette.textSecondary }}>Действия доступны владельцу или арендатору этой сделки.</p>}
    </div>
  );
}
