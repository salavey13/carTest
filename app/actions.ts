// app/actions.ts
"use server";

import { generateCarEmbedding, createAuthenticatedClient, supabaseAdmin, supabaseAnon } from "@/hooks/supabase";
import axios from "axios";
import { verifyJwtToken, generateJwtToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { WebAppUser } from "@/types/telegram";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = "413553377"; // Your default Telegram chat ID
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || DEFAULT_CHAT_ID;
// Environment variables for Coze API with hardcoded defaults
const COZE_API_KEY = process.env.COZE_API_KEY;
const COZE_BOT_ID = process.env.COZE_BOT_ID || '7480584293518376966';
const COZE_USER_ID = process.env.COZE_USER_ID || '341503612082';

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

/** Utility to get the base URL dynamically */
function getBaseUrl() {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://v0-car-test.vercel.app";
}

// Notify admins when a user successfully completes CAPTCHA
export async function notifyCaptchaSuccess(userId: string, username?: string | null) {
  try {
    const { data: admins, error: adminError } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("status", "admin")
    if (adminError) throw adminError

    const adminChatIds = admins.map((admin) => admin.user_id)
    const message = `🔔 Пользователь ${username || userId} успешно прошел CAPTCHA.`

    for (const adminId of adminChatIds) {
      const result = await sendTelegramMessage(
        process.env.TELEGRAM_BOT_TOKEN!,
        message,
        [],
        undefined,
        adminId
      )
      if (!result.success) {
        console.error(`Failed to notify admin ${adminId}:`, result.error)
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to notify admins",
    }
  }
}

// Notify all successful users
export async function notifySuccessfulUsers(userIds: string[]) {
  try {
    const message = `🎉 Поздравляем! Вы успешно прошли CAPTCHA и можете продолжить. 🚀`

    for (const userId of userIds) {
      const result = await sendTelegramMessage(
        process.env.TELEGRAM_BOT_TOKEN!,
        message,
        [],
        undefined,
        userId
      )
      if (!result.success) {
        console.error(`Failed to notify user ${userId}:`, result.error)
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to notify users",
    }
  }
}


// Add this new function to notify winners
export async function notifyWinners(winningNumber: number, winners: any[]) {
  try {
    // Notify each winner
    for (const winner of winners) {
      await sendTelegramMessage(
        process.env.TELEGRAM_BOT_TOKEN!,
        `🎉 Congratulations! Your lucky number ${winningNumber} has been drawn in the Wheel of Fortune! You are a winner! 🏆`,
        [],
        undefined,
        winner.user_id,
      )
    }

    // Notify admin about the winners
    const winnerNames = winners.map((w) => w.username || w.full_name || w.user_id).join(", ")
    await sendTelegramMessage(
      process.env.TELEGRAM_BOT_TOKEN!,
      `🎮 Wheel of Fortune Results:\nWinning Number: ${winningNumber}\nWinners (${winners.length}): ${winnerNames}`,
      [],
      undefined,
      ADMIN_CHAT_ID,
    )

    return { success: true }
  } catch (error) {
    logger.error("Error notifying winners:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to notify winners",
    }
  }
}

// Utility to delay execution (for polling)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function analyzeMessage(content: string) {
  try {
    // Step 1: Initiate the chat
    const initResponse = await axios.post(
      'https://api.coze.com/v3/chat',
      {
        bot_id: COZE_BOT_ID,
        user_id: COZE_USER_ID,
        stream: false,
        auto_save_history: true,
        additional_messages: [
          {
            role: 'user',
            content: content,
            content_type: 'text',
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${COZE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Initial Coze API response.data:', initResponse.data);

    const chatId = initResponse.data.data?.id;
    const conversationId = initResponse.data.data?.conversation_id;
    if (!chatId || !conversationId) {
      throw new Error('Missing chat ID or conversation ID in initial response');
    }

    // Step 2: Poll for chat messages until assistant's answer is available
    let attempts = 0;
    const maxAttempts = 10; // Limit polling
    const pollInterval = 2000; // Poll every 2 seconds

    while (attempts < maxAttempts) {
      const messagesResponse = await axios.get(
        `https://api.coze.com/v3/chat/message/list?conversation_id=${conversationId}&chat_id=${chatId}`,
        {
          headers: {
            Authorization: `Bearer ${COZE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Coze API messages response.data:', messagesResponse.data);

      // Find the assistant's answer message
      const assistantAnswer = messagesResponse.data.data?.find(
        (msg: any) => msg.role === 'assistant' && msg.type === 'answer'
      )?.content;

      if (assistantAnswer) {
        // Parse the content, assuming it's a JSON string
        let parsedData;
        try {
          parsedData = JSON.parse(assistantAnswer);
        } catch (e) {
          // If parsing fails, assume plain text and use defaults
          console.warn('Assistant content is not JSON, treating as plain text:', assistantAnswer);
          parsedData = { emotional_comment: assistantAnswer };
        }

        return {
          bullshit_percentage: parsedData.bullshit_percentage || 50,
          emotional_comment: parsedData.emotional_comment || "Hmm, interesting...",
          analyzed_content: parsedData.analyzed_content || content,
          content_summary: parsedData.content_summary || "No summary available.",
          animation: parsedData.animation || "neutral",
        };
      }

      attempts++;
      await delay(pollInterval); // Wait before next poll
    }

    throw new Error('No assistant answer received after maximum attempts');
  } catch (error) {
    console.error('Error analyzing message:', error);
    throw new Error('Failed to analyze message');
  }
}





export const generateEmbeddings = async () => {
  const { data: cars } = await supabaseAdmin
    .from("cars")
    .select("id")
    .is("embedding", null);

  if (!cars?.length) return;

  // Call the centralized embedding function for batch processing
  await generateCarEmbedding(); // No carId means batch processing
  console.log(`Triggered embedding generation for ${cars.length} cars`);
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
    .select("owner_id, image_url")
    .eq("id", carId)
    .single();

  if (error) {
    console.error("Error fetching car:", error);
    return { success: false, error: error.message };
  }

  const adminId = car.owner_id;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramToken) {
    console.error("Telegram bot token not configured");
    return { success: false, error: "Telegram bot token missing" };
  }

  const baseUrl = getBaseUrl();
  const result = await sendTelegramMessage(
    telegramToken,
    message,
    [{ text: "View Car", url: `${baseUrl}/rent/${carId}` }],
    car.image_url,
    adminId,
    carId
  );

  if (!result.success) {
    console.error("Failed to notify admin:", result.error);
  }
  return result;
}

/** Notifies all fleet admins about a fleet-wide event */
export async function superNotification(message: string) {
  const { data: owners, error } = await supabaseAdmin
    .from("cars")
    .select("owner_id")
    .neq("owner_id", null)
    .distinct();

  if (error) {
    console.error("Error fetching owners:", error);
    return;
  }

  for (const owner of owners) {
    await sendTelegramMessage(
      process.env.TELEGRAM_BOT_TOKEN!,
      message,
      [],
      undefined,
      owner.owner_id
    );
  }
}

/** Broadcasts a message to all users or a specific role */
export async function broadcastMessage(message: string, role?: string) {
  const query = supabaseAdmin.from("users").select("user_id");
  if (role) query.eq("role", role);

  const { data: users, error } = await query;
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  for (const user of users) {
    await sendTelegramMessage(
      process.env.TELEGRAM_BOT_TOKEN!,
      message,
      [],
      undefined,
      user.user_id
    );
  }
}

/** Sends a donation invoice to the user and notifies the admin */
export async function sendDonationInvoice(chatId: string, amount: number, message: string) {
  try {
    const invoicePayload = `donation_${Date.now()}`; // Unique payload for the invoice
    const title = "Donation to Leha";
    const description = `Thank you for your support! ${message || "No message provided"}`;

    // Send the invoice using existing function
    const invoiceResult = await sendTelegramInvoice(
      chatId,
      title,
      description,
      invoicePayload,
      amount,
      0, // No subscription ID for donations
      undefined // No photo for donations
    );

    if (!invoiceResult.success) {
      throw new Error(invoiceResult.error);
    }

    // Store the invoice in the database with type "donation"
    const { error: insertError } = await supabaseAdmin
      .from("invoices")
      .insert({
        id: invoicePayload,
        user_id: chatId,
        amount,
        type: "donation",
        status: "pending",
        metadata: { message },
        subscription_id: 0,
      });

    if (insertError) {
      throw new Error(`Failed to save invoice: ${insertError.message}`);
    }

    // Notify admin of the new donation attempt
    const adminMessage = `New donation attempt!\nAmount: ${amount} XTR\nFrom: ${chatId}\nMessage: ${message || "No message"}`;
    const adminResult = await sendTelegramMessage(
      process.env.TELEGRAM_BOT_TOKEN!,
      adminMessage,
      [],
      undefined,
      ADMIN_CHAT_ID
    );

    if (!adminResult.success) {
      logger.warn("Failed to notify admin:", adminResult.error);
    }

    return { success: true };
  } catch (error) {
    logger.error("Error in sendDonationInvoice:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to process donation" };
  }
}

/** Updates a car’s status and notifies the owner */
export async function updateCarStatus(carId: string, newStatus: string) {
  const { error } = await supabaseAdmin
    .from("cars")
    .update({ status: newStatus })
    .eq("id", carId);

  if (error) {
    console.error("Error updating car status:", error);
    return;
  }

  await notifyAdmin(carId, `Your car status has been updated to: ${newStatus}`);
}

export async function createOrUpdateUser(user: {
  id: string;
  username?: string | null;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  photo_url?: string;
}) {
  try {
    const { error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        user_id: user.id,
        username: user.username,
        full_name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
        avatar_url: user.photo_url,
        language_code: user.language_code,
      });

    if (insertError) {
      logger.error("Insert error:", insertError);
      throw insertError;
    }

    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      logger.error("Fetch error:", fetchError);
      throw fetchError;
    }

    // Notify default admin of new user
    await sendTelegramMessage(
      process.env.TELEGRAM_BOT_TOKEN!,
      `New user registered: ${user.username || user.id}`,
      [],
      undefined,
      ADMIN_CHAT_ID
    );

    return existingUser;
  } catch (error) {
    logger.error("Error creating/updating user:", error);
    throw error;
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
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;

    const token = generateJwtToken(chatId);
    return { user, token };
  } catch (error) {
    throw new Error("Authentication failed");
  }
}

export async function sendTelegramInvoice(
  chatId: string,
  title: string,
  description: string,
  payload: string,
  amount: number,
  subscription_id: number,
  photo_url?: string
) {
  try {
    const PROVIDER_TOKEN = ""; // Empty string for XTR payments
    const response = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendInvoice`, {
      chat_id: chatId,
      title,
      description,
      payload,
      provider_token: PROVIDER_TOKEN,
      currency: "XTR",
      prices: [{ label: "Аренда автомобиля", amount }],
      start_parameter: "pay",
      need_shipping_address: false,
      is_flexible: false,
      photo_url,
      photo_size: 600,
      photo_width: 600,
      photo_height: 400,
    });

    if (!response.data.ok) {
      throw new Error(`Telegram API error: ${response.data.description || "Unknown error"}`);
    }

    return { success: true, data: response.data };
  } catch (error) {
    logger.error("Error in sendTelegramInvoice: " + error, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to send invoice" };
  }
}

export async function handleWebhookUpdate(update: any) {
  try {
    if (update.pre_checkout_query) {
      await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
    }

    if (update.message?.successful_payment) {
      const { invoice_payload, total_amount } = update.message.successful_payment;

      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", invoice_payload)
        .single();

      if (invoiceError || !invoice) throw new Error(`Invoice error: ${invoiceError?.message}`);

      await supabaseAdmin.from("invoices").update({ status: "paid" }).eq("id", invoice_payload);

      const userId = update.message.chat.id;
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (userError) throw new Error(`User fetch error: ${userError.message}`);

      const baseUrl = getBaseUrl();

      if (invoice.type === "subscription") {
        let newStatus = "pro";
        let newRole = "subscriber";
        if (total_amount === 420) {
          newStatus = "admin";
          newRole = "admin";
        }

        await supabaseAdmin.from("users").update({ status: newStatus, role: newRole }).eq("user_id", userId);

        await sendTelegramMessage(
          process.env.TELEGRAM_BOT_TOKEN!,
          "🎉 Оплата подписки прошла успешно! Спасибо за покупку.",
          [],
          undefined,
          userId
        );

        await sendTelegramMessage(
          process.env.TELEGRAM_BOT_TOKEN!,
          `🔔 Пользователь ${userData.username || userData.user_id} обновил статус до ${newStatus.toUpperCase()}!`,
          [],
          undefined,
          ADMIN_CHAT_ID
        );
      } else if (invoice.type === "car_rental") {
        const metadata = invoice.metadata;
        const { data: car, error: carError } = await supabaseAdmin
          .from("cars")
          .select("owner_id, make, model, image_url")
          .eq("id", metadata.car_id)
          .single();

        if (carError) throw new Error(`Car fetch error: ${carError.message}`);

        await sendTelegramMessage(
          process.env.TELEGRAM_BOT_TOKEN!,
          `🎉 Оплата аренды автомобиля ${metadata.car_make} ${metadata.car_model} прошла успешно!`,
          [{ text: "View Rental", url: `${baseUrl}/rent/${metadata.car_id}` }],
          undefined,
          userId
        );

        await notifyAdmin(
          metadata.car_id,
          `Вашу ${car.make} ${car.model} арендовал ${userData.username || userData.user_id}!`
        );

        await sendTelegramMessage(
          process.env.TELEGRAM_BOT_TOKEN!,
          `🔔 Пользователь ${userData.username || userData.user_id} арендовал автомобиль ${car.make} ${car.model}.`,
          [],
          undefined,
          ADMIN_CHAT_ID
        );
      } else if (invoice.type === "donation") {
  // Новая логика для пожертвований
  const message = invoice.metadata?.message || "Сообщение отсутствует";
  await sendTelegramMessage(
    process.env.TELEGRAM_BOT_TOKEN!,
    `🎉 Поступило новое пожертвование!\nСумма: ${total_amount} XTR\nОт кого: ${userData.username || userData.user_id}\nСообщение: ${message}\nМы искренне благодарны за вашу щедрость!`,
    [],
    undefined,
    ADMIN_CHAT_ID
  );

  await sendTelegramMessage(
    process.env.TELEGRAM_BOT_TOKEN!,
    "Большое спасибо за ваше пожертвование! 🌟 Ваша поддержка вдохновляет нас и помогает двигаться вперёд. Вы — часть нашего успеха!",
    [],
    undefined,
    userId
  );
} else if (invoice.type === "script_access") {
        // Grant access and send script links
        await supabaseAdmin
          .from("users")
          .update({ has_script_access: true })
          .eq("user_id", userId);

        const scripts = [
          { name: "Block'em All", url: "https://automa.app/marketplace/blockemall" },
          { name: "Purge'em All", url: "https://automa.app/marketplace/purgeemall" },
          { name: "Hunter", url: "https://automa.app/marketplace/hunter" },
        ];

        const message =
          "Спасибо за покупку Automa Bot-Hunting Scripts! Вот ваши ссылки:\n" +
          scripts.map((script) => `- [${script.name}](${script.url})`).join("\n");

        await sendTelegramMessage(
          process.env.TELEGRAM_BOT_TOKEN!,
          message,
          [],
          undefined,
          userId
        );

        await sendTelegramMessage(
          process.env.TELEGRAM_BOT_TOKEN!,
          `🔔 Пользователь ${userData.username || userData.user_id} приобрел доступ к Automa скриптам!`,
          [],
          undefined,
          ADMIN_CHAT_ID
        );
      }
    }
  } catch (error) {
    logger.error("Error handling webhook update:", error);
  }
}

export async function confirmPayment(preCheckoutQueryId: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pre_checkout_query_id: preCheckoutQueryId,
      ok: true,
    }),
  });

  const result = await response.json();
  if (!result.ok) {
    throw new Error("Failed to confirm payment");
  }

  return result;
}

export async function validateToken(token: string) {
  try {
    const decoded = verifyJwtToken(token);
    if (!decoded) return null;

    const client = createAuthenticatedClient(token);
    const { data: user } = await client.from("users").select("*").eq("user_id", decoded.sub).single();

    return user;
  } catch (error) {
    return null;
  }
}

export async function saveUser(tgUser: any) {
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
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error saving user:", error);
    return null;
  }
}

export async function sendResult(chatId: string, result: any) {
  try {
    const baseUrl = getBaseUrl();
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;

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
                url: `${baseUrl}/rent/${result.car.id}`,
              },
              {
                text: "Try Again 🔄",
                web_app: { url: baseUrl },
              },
            ],
          ],
        },
      }),
    });

    return await response.json();
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return null;
  }
}

export async function setTelegramWebhook() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const WEBHOOK_URL = `${getBaseUrl()}/api/telegramWebhook`;

  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: WEBHOOK_URL }),
  });

  const result = await response.json();
  if (!result.ok) {
    throw new Error("Failed to set webhook");
  }

  return result;
}

export async function checkInvoiceStatus(token: string, invoiceId: string) {
  try {
    const user = await verifyJwtToken(token);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const { data, error } = await supabaseAdmin.from("invoices").select("status").eq("id", invoiceId).single();

    if (error) throw error;

    return { success: true, status: data.status };
  } catch (error) {
    logger.error("Error fetching invoice status:", error);
    return { success: false, error: "Failed to fetch invoice status" };
  }
}

export async function findSimilarCars(resultEmbedding: number[]) {
  const { data, error } = await supabaseAdmin.rpc("search_cars", {
    query_embedding: resultEmbedding,
    match_count: 3,
  });

  return data?.map((car) => ({
    ...car,
    similarity: Math.round(car.similarity * 100),
  }));
}

