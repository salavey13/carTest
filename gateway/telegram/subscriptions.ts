import { emit, subscribe } from "@/core/events";
import { sendMessage } from "@/gateway/telegram/sendMessage";
import { logger } from "@/lib/logger";

let isInitialized = false;

export function ensureTelegramSubscriptions() {
  if (isInitialized) return;

  subscribe("plant_dry", async (event) => {
    const plant = event.plantName ? ` ${event.plantName}` : "";
    const severity = event.severity ? ` (${event.severity})` : "";

    await sendMessage(event.chatId, `🌵 Растение${plant} просит полив${severity}.`);
  });

  isInitialized = true;
  logger.info("[gateway.telegram] Core event subscriptions initialized");
}

// Helper for local/manual smoke checks.
export function emitPlantDryTest(chatId: string | number) {
  emit({ type: "plant_dry", chatId, plantName: "Demo plant", severity: "medium" });
}
