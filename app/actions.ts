// app/actions.ts
"use server"

import { createAuthenticatedClient, supabaseAdmin } from "@/hooks/supabase"
import axios from "axios"
import { verifyJwtToken, generateJwtToken } from "@/lib/auth"
//import { acquireBadge, fetchUserBadges } from "@/lib/badgeUtils"
import { logger } from "@/lib/logger"
import type { WebAppUser } from "@/types/telegram"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "413553377"

export async function createOrUpdateUser(user: {
  id: string
  username?: string | null
  first_name?: string
  last_name?: string
  language_code?: string
  photo_url?: string
}) {
  try {
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (fetchError && fetchError.message !== "No rows found") throw fetchError

    if (existingUser) return existingUser

    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        user_id: user.id,
        username: user.username,
        full_name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
        avatar_url: user.photo_url,
        language_code: user.language_code,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return newUser
  } catch (error) {
    console.error("Error creating/updating user:", error)
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
) {
  try {
    // Empty provider token for Stars (XTR)
    const PROVIDER_TOKEN = "" // Empty string for XTR payments

    // Send invoice via Telegram API
    const response = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendInvoice`, {
      chat_id: chatId,
      title,
      description,
      payload,
      provider_token: PROVIDER_TOKEN,
      currency: "XTR", // Use Stars as the currency
      prices: [{ label: "Subscription", amount }],
      start_parameter: "pay",
      need_shipping_address: false,
      is_flexible: false,
    })

    // Save invoice information in Supabase
    const { error } = await supabaseAdmin.from("invoices").insert([{ id: payload, user_id: chatId, status: "pending" }])

    if (error) {
      logger.error(`Failed to save invoice for user ${chatId}:`, error.message)
      throw new Error(`Database error: ${error.message}`)
    }

    logger.info(`Invoice sent and saved successfully for user ${chatId}: ${payload}`)
    return { success: true, data: response.data }
  } catch (error) {
    logger.error("Error in sendTelegramInvoice:", error)
    return { success: false, error: "Failed to send invoice" }
  }
}

export async function handleWebhookUpdate(update: any) {
  try {
    if (update.pre_checkout_query) {
      // Confirm pre-checkout
      await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      })
    }

    if (update.message?.successful_payment) {
      const { invoice_payload, total_amount } = update.message.successful_payment

      // Update invoice status in Supabase
      const { error: updateError } = await supabaseAdmin
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoice_payload)

      if (updateError) {
        logger.error(`Failed to update invoice status for payload ${invoice_payload}:`, updateError.message)
        throw new Error(`Database error: ${updateError.message}`)
      }

      // Get user details
      const userId = update.message.chat.id
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single()

      if (userError) {
        logger.error(`Failed to fetch user data for user ${userId}:`, userError.message)
        throw new Error(`Database error: ${userError.message}`)
      }

      // Determine subscription type based on amount
      let newStatus = "pro"
      let newRole = "subscriber"
      if (total_amount === 420) {
        // VIP subscription
        newStatus = "admin"
        newRole = "admin"
      }

      // Update user status and role
      const { error: updateUserError } = await supabaseAdmin
        .from("users")
        .update({ status: newStatus, role: newRole })
        .eq("user_id", userId)

      if (updateUserError) {
        logger.error(`Failed to update user ${userId} status/role:`, updateUserError.message)
        throw new Error(`Database error: ${updateUserError.message}`)
      }

      // Notify the user
      const telegramBotUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`
      await axios.post(telegramBotUrl, {
        chat_id: userId,
        text: "🎉 Payment successful! Thank you for your purchase.",
      })

      // Notify all admins
      const { data: admins, error: adminError } = await supabaseAdmin
        .from("users")
        .select("user_id")
        .eq("role", "admin")
      if (adminError) {
        logger.error("Failed to fetch admin users:", adminError.message)
        throw new Error(`Database error: ${adminError.message}`)
      }

      const adminMessage = `🔔 User ${userData.username || userData.user_id} has upgraded to ${newStatus.toUpperCase()}!`

      for (const admin of admins) {
        await axios.post(telegramBotUrl, {
          chat_id: admin.user_id,
          text: adminMessage,
        })
      }

      logger.info("Payment confirmed, user updated, and admins notified successfully")
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
                url: `https://v0-car-test.vercel.app/rent/${result.slug}`,
              },
              {
                text: "Try Again 🔄",
                web_app: { url: "https://t.me/oneSitePlsBot/Friends" },
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

