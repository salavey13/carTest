"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { sendTelegramInvoice } from "@/app/actions";
import { sosCommand } from "./sos";
import { confirmVehiclePickup, confirmVehicleReturn } from "@/app/rentals/actions";

const buttonLabels: Record<string, string> = {
  "action_upload-photo-start": "📸 Загрузить фото 'ДО'",
  "action_upload-photo-end": "📸 Загрузить фото 'ПОСЛЕ'",
  "action_confirm-pickup": "✅ Подтвердить получение",
  "action_confirm-return": "✅ Подтвердить возврат",
  "action_drop-anywhere": "棄 Я сваливаю (200 XTR)",
  sos: "🆘 SOS",
  cancel: "❌ Закрыть",
};

type RentalContextCandidate = {
  rental_id: string;
  user_id: string;
  owner_id: string;
  status: "pending_confirmation" | "confirmed" | "active";
  created_at: string;
};

const statusPriority: Record<RentalContextCandidate["status"], number> = {
  active: 3,
  confirmed: 2,
  pending_confirmation: 1,
};

function pickBestRentalContext(userId: string, rows: RentalContextCandidate[]) {
  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => {
    const byStatus = statusPriority[b.status] - statusPriority[a.status];
    if (byStatus !== 0) return byStatus;

    const selfA = a.user_id === a.owner_id;
    const selfB = b.user_id === b.owner_id;
    if (selfA !== selfB) return selfA ? 1 : -1;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const selected = sorted[0];
  return {
    rentalId: selected.rental_id,
    role: selected.user_id === userId ? ("renter" as const) : ("owner" as const),
    status: selected.status,
  };
}

async function getRentalContext(userId: string): Promise<{ rentalId: string; role: "renter" | "owner"; status: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, user_id, owner_id, status, created_at")
    .or(`user_id.eq.${userId},owner_id.eq.${userId}`)
    .in("status", ["pending_confirmation", "confirmed", "active"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    logger.error(`[actionsCommand] Error fetching rental context for ${userId}`, error);
    return null;
  }

  return pickBestRentalContext(userId, (data || []) as RentalContextCandidate[]);
}

export async function actionsCommand(chatId: number, userId: string) {
  logger.info(`[actionsCommand] User ${userId} initiated /actions command.`);
  const context = await getRentalContext(userId);
  if (!context) {
    await sendComplexMessage(chatId, "🤔 У вас нет активных аренд, требующих действий.", [], { removeKeyboard: true });
    return;
  }

  const { data: events, error } = await supabaseAdmin
    .from("events")
    .select("type, status")
    .eq("rental_id", context.rentalId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error(`[actionsCommand] Error fetching events for rental ${context.rentalId}`, error);
    await sendComplexMessage(chatId, "🚨 Ошибка при получении статуса аренды.", [], { removeKeyboard: true });
    return;
  }

  const eventTypes = new Set((events || []).map((e) => e.type));
  let buttons: string[] = [];

  if (context.role === "renter") {
    if (context.status === "active") {
      if (!eventTypes.has("photo_end")) buttons.push("action_upload-photo-end");
      buttons.push("action_drop-anywhere", "sos");
    } else if (!eventTypes.has("photo_start")) {
      buttons.push("action_upload-photo-start");
    }
  }

  if (context.role === "owner") {
    const hasCompletedStartPhoto = (events || []).some((e) => e.type === "photo_start" && e.status === "completed");
    const isPickupConfirmed = (events || []).some((e) => e.type === "pickup_confirmed");
    const hasCompletedEndPhoto = (events || []).some((e) => e.type === "photo_end" && e.status === "completed");

    if (hasCompletedStartPhoto && !isPickupConfirmed) buttons.push("action_confirm-pickup");
    if (hasCompletedEndPhoto) buttons.push("action_confirm-return");
  }

  const keyboard: KeyboardButton[][] = buttons.map((key) => [{ text: buttonLabels[key] }]).concat([[{ text: buttonLabels.cancel }]]);

  if (keyboard.length > 1) {
    await sendComplexMessage(chatId, "👇 Выберите доступное действие:", keyboard, { keyboardType: "reply" });
  } else {
    await sendComplexMessage(chatId, "На данный момент для вас нет доступных действий.", [], { removeKeyboard: true });
  }
}

export async function handleActionChoice(chatId: number, userId: string, choice: string) {
  const context = await getRentalContext(userId);
  if (!context) {
    await sendComplexMessage(chatId, "Не удалось найти активную аренду.", [], { removeKeyboard: true });
    return;
  }
  const actionKey = Object.keys(buttonLabels).find((key) => buttonLabels[key] === choice);

  switch (actionKey) {
    case "action_upload-photo-start":
    case "action_upload-photo-end": {
      const photoType = actionKey.endsWith("start") ? "start" : "end";
      await supabaseAdmin.from("user_states").upsert({
        user_id: userId,
        state: "awaiting_rental_photo",
        context: { rental_id: context.rentalId, photo_type: photoType },
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
      await sendComplexMessage(
        chatId,
        `Отлично! Теперь отправьте фото ${photoType === "start" ? "'ДО'" : "'ПОСЛЕ'"} в этот чат в течение 15 минут.`,
        [],
        { removeKeyboard: true }
      );
      break;
    }
    case "action_confirm-pickup":
      await confirmVehiclePickup(context.rentalId, userId);
      break;
    case "action_confirm-return":
      await confirmVehicleReturn(context.rentalId, userId);
      break;
    case "action_drop-anywhere": {
      const invoicePayload = `drop_anywhere_${context.rentalId}_${Date.now()}`;
      await sendTelegramInvoice(
        userId,
        "Услуга 'Бросить Где Угодно'",
        "Оплата за возможность оставить транспорт в текущем месте. Экипаж заберет его.",
        invoicePayload,
        20000
      );
      await sendComplexMessage(chatId, "Счет на 200 XTR отправлен. После оплаты вы сможете отправить геотег.", [], { removeKeyboard: true });
      break;
    }
    case "sos":
      await sosCommand(chatId, userId);
      return;
    case "cancel":
      await sendComplexMessage(chatId, "Меню действий закрыто.", [], { removeKeyboard: true });
      break;
    default:
      await sendComplexMessage(chatId, "Неизвестное действие.", [], { removeKeyboard: true });
      break;
  }
  if (actionKey !== "sos" && actionKey !== "cancel") {
    await sendComplexMessage(chatId, "✅ Команда принята.", [], { removeKeyboard: true });
  }
}
