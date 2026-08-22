"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

interface ActivateRentalIfReadyResult {
  success: boolean;
  activated: boolean;
  rentalId: string;
  message?: string;
  error?: string;
}

interface RentalData {
  rental_id: string;
  status: string;
  user_id: string;
  vehicle_id: string;
  metadata: Record<string, any>;
  crew_id: string;
}

interface CrewData {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
}

// ============================================================================
// activateRentalIfReady
// ============================================================================

/**
 * Проверяет, все ли verification todos выполнены для аренды.
 * Если да - активирует аренду (status: pending → active), отправляет уведомления.
 * 
 * Идемпотентна: можно вызывать многократно, если аренда уже активна - ничего не делает.
 * 
 * @param rentalId - ID аренды для проверки и активации
 * @returns Результат активации
 */
export async function activateRentalIfReady(
  rentalId: string
): Promise<ActivateRentalIfReadyResult> {
  try {
    logger.info("[activateRentalIfReady] Checking rental", { rentalId });

    // 1. Fetch rental data
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, status, user_id, vehicle_id, metadata, crew_id")
      .eq("rental_id", rentalId)
      .single();

    if (rentalError || !rental) {
      logger.error("[activateRentalIfReady] Rental not found", { rentalId, error: rentalError });
      return {
        success: false,
        activated: false,
        rentalId,
        error: `Rental not found: ${rentalError?.message || "unknown"}`,
      };
    }

    // 2. Idempotency check: if already active, do nothing
    if (rental.status === "active") {
      logger.info("[activateRentalIfReady] Rental already active", { rentalId });
      return {
        success: true,
        activated: false,
        rentalId,
        message: "Rental already active",
      };
    }

    // Only activate from pending or pending_confirmation status
    if (rental.status !== "pending" && rental.status !== "pending_confirmation") {
      logger.warn("[activateRentalIfReady] Rental not in pending status", { 
        rentalId, 
        status: rental.status 
      });
      return {
        success: false,
        activated: false,
        rentalId,
        error: `Rental status is ${rental.status}, expected pending or pending_confirmation`,
      };
    }

    // 3. Check all verification todos are completed
    // Todos are stored in crew_todos with rental_id in description JSON
    const { data: allTodos, error: todosError } = await supabaseAdmin
      .from("crew_todos")
      .select("id, title, status, category, description")
      .eq("category", "rental_verification")
      .eq("crew_id", rental.crew_id);

    if (todosError) {
      logger.error("[activateRentalIfReady] Failed to fetch todos", { 
        rentalId, 
        error: todosError 
      });
      return {
        success: false,
        activated: false,
        rentalId,
        error: `Failed to fetch todos: ${todosError.message}`,
      };
    }

    // Filter todos by rental_id in description JSON
    const todos = (allTodos || []).filter((todo) => {
      try {
        const desc = JSON.parse(todo.description || "{}");
        return desc.rental_id === rentalId;
      } catch {
        return false;
      }
    });

    // If no verification todos exist, don't activate (wait for todos to be created)
    if (!todos || todos.length === 0) {
      logger.info("[activateRentalIfReady] No verification todos found", { rentalId });
      return {
        success: true,
        activated: false,
        rentalId,
        message: "No verification todos found, waiting for creation",
      };
    }

    // Check if all todos are done
    const allDone = todos.every((todo) => todo.status === "done");
    const completedCount = todos.filter((todo) => todo.status === "done").length;
    const totalCount = todos.length;

    logger.info("[activateRentalIfReady] Todos status", {
      rentalId,
      completedCount,
      totalCount,
      allDone,
    });

    if (!allDone) {
      return {
        success: true,
        activated: false,
        rentalId,
        message: `Verification incomplete: ${completedCount}/${totalCount} todos done`,
      };
    }

    // 4. All todos completed - activate rental
    logger.info("[activateRentalIfReady] Activating rental", { rentalId });

    const metadata = (rental.metadata || {}) as Record<string, any>;
    const updatedMetadata = {
      ...metadata,
      activated_at: new Date().toISOString(),
      activated_by: "system:auto-activation",
    };

    const { error: updateError } = await supabaseAdmin
      .from("rentals")
      .update({
        status: "active",
        metadata: updatedMetadata,
      })
      .eq("rental_id", rentalId);

    if (updateError) {
      logger.error("[activateRentalIfReady] Failed to update rental", {
        rentalId,
        error: updateError,
      });
      return {
        success: false,
        activated: false,
        rentalId,
        error: `Failed to activate rental: ${updateError.message}`,
      };
    }

    // 5. Send notifications (fire-and-forget, don't block on errors)
    // Use setImmediate to not block the response
    setImmediate(() => {
      sendActivationNotifications(rental as RentalData).catch((err) => {
        logger.error("[activateRentalIfReady] Failed to send notifications", {
          rentalId,
          error: err,
        });
      });
    });

    logger.info("[activateRentalIfReady] Rental activated successfully", { rentalId });

    return {
      success: true,
      activated: true,
      rentalId,
      message: `Rental activated: ${completedCount}/${totalCount} todos completed`,
    };
  } catch (error) {
    logger.error("[activateRentalIfReady] Unexpected error", { rentalId, error });
    return {
      success: false,
      activated: false,
      rentalId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// sendActivationNotifications
// ============================================================================

/**
 * Отправляет уведомления арендатору и владельцу после активации аренды.
 * Fire-and-forget: не блокирует основную логику если отправка упала.
 */
async function sendActivationNotifications(rental: RentalData): Promise<void> {
  try {
    // Fetch crew data for owner notification
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id, slug, name")
      .eq("id", rental.crew_id)
      .single();

    if (!crew) {
      logger.warn("[sendActivationNotifications] Crew not found", { 
        crewId: rental.crew_id 
      });
      return;
    }

    // Fetch vehicle data for message
    const { data: vehicle } = await supabaseAdmin
      .from("cars")
      .select("make, model")
      .eq("id", rental.vehicle_id)
      .single();

    const vehicleName = vehicle 
      ? `${vehicle.make} ${vehicle.model}` 
      : "транспортное средство";

    // 1. Notify renter (user_id is Telegram chat_id)
    const renterMessage = `
🎉 <b>Ваша аренда активирована!</b>

${vehicleName}
ID аренды: <code>${rental.rental_id}</code>

Приятной поездки! 🏍️

Если у вас есть вопросы, свяжитесь с нами.
    `.trim();

    await sendTelegramMessage(rental.user_id, renterMessage);

    // 2. Notify crew owner
    if (crew.owner_id) {
      const ownerMessage = `
✅ <b>Аренда активирована</b>

ID: <code>${rental.rental_id}</code>
Транспорт: ${vehicleName}
Экипаж: ${crew.name}

Все verification todos выполнены. Аренда переведена в статус active.
      `.trim();

      await sendTelegramMessage(crew.owner_id, ownerMessage);
    }

    logger.info("[sendActivationNotifications] Notifications sent", {
      rentalId: rental.rental_id,
      renterChatId: rental.user_id,
      ownerChatId: crew.owner_id,
    });
  } catch (error) {
    // Fire-and-forget: log error but don't throw
    logger.error("[sendActivationNotifications] Failed to send notifications", {
      rentalId: rental.rental_id,
      error,
    });
  }
}

// ============================================================================
// sendTelegramMessage (helper)
// ============================================================================

/**
 * Отправляет сообщение через Telegram Bot API.
 * Использует forward-telegram endpoint если TELEGRAM_BOT_TOKEN не настроен напрямую.
 */
async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const forwardUrl = process.env.NEXT_PUBLIC_FORWARD_TELEGRAM_URL || "https://v0-car-test.vercel.app/api/forward-telegram";

  // Try direct Telegram API first if token is available
  if (botToken) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      });

      if (response.ok) {
        return true;
      }

      logger.warn("[sendTelegramMessage] Direct Telegram API failed, trying forward-telegram", {
        chatId,
        status: response.status,
      });
    } catch (error) {
      logger.warn("[sendTelegramMessage] Direct Telegram API error, trying forward-telegram", {
        chatId,
        error,
      });
    }
  }

  // Fallback to forward-telegram endpoint
  try {
    const response = await fetch(forwardUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("[sendTelegramMessage] Forward-telegram API error", {
        chatId,
        status: response.status,
        error: errorText,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("[sendTelegramMessage] Failed to send message via forward-telegram", {
      chatId,
      error,
    });
    return false;
  }
}
