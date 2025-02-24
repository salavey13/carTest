// app/actions.ts
"use server"

import { createAuthenticatedClient, supabaseAdmin, supabaseAnon } from "@/hooks/supabase"
import axios from "axios"
import { verifyJwtToken, generateJwtToken } from "@/lib/auth"
//import { acquireBadge, fetchUserBadges } from "@/lib/badgeUtils"
import { logger } from "@/lib/logger"
import type { WebAppUser } from "@/types/telegram"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DEFAULT_CHAT_ID = "413553377"; // Your default Telegram chat ID
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || DEFAULT_CHAT_ID

interface InlineButton {
  text: string;
  url: string;
}

type SendMessagePayload =
  | {
      chat_id: string;
      text: string;
      reply_markup?: {
        inline_keyboard: Array<Array<{ text: string; url: string }>>;
      };
    }
  | {
      chat_id: string;
      photo: string;
      caption: string;
      reply_markup?: {
        inline_keyboard: Array<Array<{ text: string; url: string }>>;
      };
    };


/** Sends a Telegram message with optional image and buttons */
export async function sendTelegramMessage(
  token: string,
  message: string,
  buttons: InlineButton[] = [],
  imageUrl?: string,
  chatId?: string,
  carId?: string
) {
  try {
    const finalChatId = chatId || ADMIN_CHAT_ID;

    let finalMessage = message;
    if (carId) {
      const { data: car, error } = await supabaseAdmin
        .from("cars")
        .select("make, model, daily_price")
        .eq("id", carId)
        .single();
      if (error) throw new Error(`Failed to fetch car: ${error.message}`);
      if (car) {
        finalMessage += `\n\nCar: ${car.make} ${car.model}\nDaily Price: ${car.daily_price} XTR`;
      }
    }

    const payload: SendMessagePayload = imageUrl
      ? {
          chat_id: finalChatId,
          photo: imageUrl,
          caption: finalMessage,
          reply_markup: buttons.length
            ? {
                inline_keyboard: [buttons.map((button) => ({ text: button.text, url: button.url }))],
              }
            : undefined,
        }
      : {
          chat_id: finalChatId,
          text: finalMessage,
          reply_markup: buttons.length
            ? {
                inline_keyboard: [buttons.map((button) => ({ text: button.text, url: button.url }))],
              }
            : undefined,
        };

    const endpoint = imageUrl ? "sendPhoto" : "sendMessage";
    const response = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.description || "Failed to send message");
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/** Notifies an admin about a car-related action */
export async function notifyAdmin(carId: string, message: string) {
  const { data: car, error } = await supabaseAdmin
    .from("cars")
    .select("owner_id")
    .eq("id", carId)
    .single();

  if (error) {
    console.error("Error fetching car:", error);
    return { success: false, error: error.message };
  }

  const adminId = car.owner_id;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN; // Store in .env
  if (!telegramToken) {
    console.error("Telegram bot token not configured");
    return { success: false, error: "Telegram bot token missing" };
  }

  const result = await sendTelegramMessage(
    telegramToken,
    message,
    [{ text: "View Car", url: `https://v0-car-test.vercel.app/rent/${carId}` }], // Adjust URL as needed
    car.image_url, // Add imageUrl if available in car data
    adminId, // Use owner_id as chatId
    carId // Include carId to append car details
  );

  if (!result.success) {
    console.error("Failed to notify admin:", result.error);
  }
  return result;
}

// Usage example: Notify when a car is rented
//await notifyAdmin("car-uuid-123", "Your car has been rented!");
export async function createOrUpdateUser(user: {
  id: string
  username?: string | null
  first_name?: string
  last_name?: string
  language_code?: string
  photo_url?: string
}) {
  try {
    const { error: insertError } = await supabaseAdmin // Use supabaseAdmin
      .from("users")
      .insert({
        user_id: user.id,
        username: user.username,
        full_name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
        avatar_url: user.photo_url,
        language_code: user.language_code,
      })

    if (insertError) {
      debugLogger.error("Insert error:", insertError)
      throw insertError
    }

    const { data: existingUser, error: fetchError } = await supabaseAdmin // Use supabaseAdmin
      .from("users")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle() // Use maybeSingle for consistency

    if (fetchError) {
      debugLogger.error("Fetch error:", fetchError)
      throw fetchError
    }

    if (existingUser) return existingUser
    return newUser
  } catch (error) {
    debugLogger.error("Error creating/updating user:", error)
    throw error
  }
}

export async function authenticateUser(chatId: string, userInfo?: Partial<WebAppUser>) {
  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          user_id: chatId,
          username: userInfo?.username,
          full_name: `${userInfo?.first_name || ""} ${userInfo?.last_name || ""}`.trim(),
          avatar_url: userInfo?.photo_url,
          language_code: userInfo?.language_code,
        },
        { onConflict: "user_id" },
      )
      .select()
      .single()

    if (error) throw error

    const token = generateJwtToken(chatId)
    return { user, token }
  } catch (error) {
    throw new Error("Authentication failed")
  }
}

export async function sendTelegramInvoice(
  chatId: string,
  title: string,
  description: string,
  payload: string,
  amount: number,
  subscription_id: number,
  photo_url?: string // Optional parameter for the car's image
) {
  try {
    const PROVIDER_TOKEN = "" // Empty string for XTR payments
    const response = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendInvoice`, {
      chat_id: chatId,
      title,
      description,
      payload,
      provider_token: PROVIDER_TOKEN,
      currency: "XTR",
      prices: [{ label: "Аренда автомобиля", amount }], // Updated label to Russian
      start_parameter: "pay",
      need_shipping_address: false,
      is_flexible: false,
      photo_url, // Add the image URL here
      photo_size: 600, // Optional: recommended size in pixels (width or height)
      photo_width: 600, // Optional: width of the photo
      photo_height: 400, // Optional: height of the photo (adjust based on your images)
    })

    if (!response.data.ok) {
      throw new Error(`Ошибка Telegram API: ${response.data.description || "Неизвестная ошибка"}`)
    }

    return { success: true, data: response.data }
  } catch (error) {
    logger.error("Ошибка в sendTelegramInvoice: " + error, error)
    return { success: false, error: error instanceof Error ? error.message : "Не удалось отправить счет" }
  }
}

export async function handleWebhookUpdate(update: any) {
  try {
    if (update.pre_checkout_query) {
      await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      })
    }

    if (update.message?.successful_payment) {
      const { invoice_payload, total_amount } = update.message.successful_payment

      // Fetch the invoice from Supabase to get its type and metadata
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", invoice_payload)
        .single()

      if (invoiceError || !invoice) {
        throw new Error(`Invoice not found or database error: ${invoiceError?.message}`)
      }

      // Update invoice status to "paid"
      const { error: updateError } = await supabaseAdmin
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoice_payload)

      if (updateError) throw new Error(`Database error: ${updateError.message}`)

      const userId = update.message.chat.id
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single()

      if (userError) throw new Error(`Database error: ${userError.message}`)

      const telegramBotUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`
      const { data: admins } = await supabaseAdmin.from("users").select("user_id").eq("status", "admin")

      if (invoice.type === "subscription") {
        // Handle subscription logic
        let newStatus = "pro"
        let newRole = "subscriber"
        if (total_amount === 420) {
          newStatus = "admin"
          newRole = "admin"
        }

        const { error: updateUserError } = await supabaseAdmin
          .from("users")
          .update({ status: newStatus, role: newRole })
          .eq("user_id", userId)

        if (updateUserError) throw new Error(`Database error: ${updateUserError.message}`)

        await axios.post(telegramBotUrl, {
          chat_id: userId,
          text: "🎉 Оплата подписки прошла успешно! Спасибо за покупку.",
        })

        
        const adminMessage = `🔔 Пользователь ${userData.username || userData.user_id} обновил статус до ${newStatus.toUpperCase()}!`
        for (const admin of admins) {
          await axios.post(telegramBotUrl, { chat_id: admin.user_id, text: adminMessage })
        }
      } else if (invoice.type === "car_rental") {
        // Handle car rental logic
        const metadata = invoice.metadata // Assuming metadata is stored in invoice

        await axios.post(telegramBotUrl, {
          chat_id: userId,
          text: `🎉 Оплата аренды автомобиля ${metadata.car_make} ${metadata.car_model} прошла успешно! Спасибо за покупку.`,
        })

        const adminMessage = `🔔 Пользователь ${userData.username || userData.user_id} арендовал автомобиль ${metadata.car_make} ${metadata.car_model} на ${metadata.days} дней за ${metadata.price_stars} XTR.`
        for (const admin of admins) {
          await axios.post(telegramBotUrl, { chat_id: admin.user_id, text: adminMessage })
        }
      } else {
        throw new Error("Unknown invoice type")
      }
    }
  } catch (error) {
    logger.error("Error handling webhook update:", error)
  }
}

export async function confirmPayment(preCheckoutQueryId: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN")
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pre_checkout_query_id: preCheckoutQueryId,
      ok: true,
    }),
  })

  const result = await response.json()
  if (!result.ok) {
    throw new Error("Failed to confirm payment")
  }

  return result
}

export async function validateToken(token: string) {
  try {
    const decoded = verifyJwtToken(token)
    if (!decoded) return null

    // Use regular client with RLS for normal operations
    const client = createAuthenticatedClient(token)
    const { data: user } = await client.from("users").select("*").eq("user_id", decoded.sub).single()

    return user
  } catch (error) {
    return null
  }
}

export async function saveUser(tgUser: TelegramUser) {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert({
        id: tgUser.id.toString(),
        avatar_url: tgUser.photo_url,
        full_name: `${tgUser.first_name} ${tgUser.last_name || ""}`.trim(),
        telegram_username: tgUser.username,
        language_code: tgUser.language_code,
      })
      .select()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error saving user:", error)
    return null
  }
}

export async function sendResult(chatId: string, result: any) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: result.imageUrl,
        caption: `*${result.car}*\n${result.description}`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Rent This Car 🚗",
                url: `https://your-domain.com/rent/${result.slug}`,
              },
              {
                text: "Try Again 🔄",
                web_app: { url: "https://your-domain.com" },
              },
            ],
          ],
        },
      }),
    })

    return await response.json()
  } catch (error) {
    console.error("Error sending Telegram message:", error)
    return null
  }
}

export const generateEmbeddings = async () => {
  const { data: cars } = await supabaseAdmin.from("cars").select("id,description").is("embedding", null)

  if (!cars?.length) return

  const pipe = await pipeline("feature-extraction", "Supabase/gte-small", { quantized: true })

  for (const car of cars) {
    const output = await pipe(car.description, {
      pooling: "mean",
      normalize: true,
    })

    await supabaseAdmin
      .from("cars")
      .update({ embedding: JSON.stringify(Array.from(output.data)) })
      .eq("id", car.id)
  }
}

export async function setTelegramWebhook() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const WEBHOOK_URL = `https://${process.env.VERCEL_URL}/api/telegramWebhook`

  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN")
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: WEBHOOK_URL }),
  })

  const result = await response.json()
  if (!result.ok) {
    throw new Error("Failed to set webhook")
  }

  return result
}

export async function checkInvoiceStatus(token: string, invoiceId: string) {
  try {
    const user = await verifyJwtToken(token)
    if (!user) {
      throw new Error("Unauthorized")
    }

    const { data, error } = await supabaseAdmin.from("invoices").select("status").eq("id", invoiceId).single()

    if (error) throw error

    return { success: true, status: data.status }
  } catch (error) {
    logger.error("Error fetching invoice status:", error)
    return { success: false, error: "Failed to fetch invoice status" }
  }
}

// app/actions.ts old openai embeddings(don't use)
export async function findSimilarCars(resultEmbedding: number[]) {
  const { data, error } = await supabaseAdmin.rpc("search_cars", {
    query_embedding: resultEmbedding,
    match_count: 3,
  })

  return data?.map((car) => ({
    ...car,
    similarity: Math.round(car.similarity * 100),
  }))
}

