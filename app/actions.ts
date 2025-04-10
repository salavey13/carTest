// /app/actions.ts
"use server";

import {
  generateCarEmbedding, // Assuming this is only called server-side now
  supabaseAdmin,
  fetchUserData as dbFetchUserData,         // Renamed import
  createOrUpdateUser as dbCreateOrUpdateUser, // Renamed import
} from "@/hooks/supabase";
import axios from "axios";
import { verifyJwtToken, generateJwtToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { WebAppUser } from "@/types/telegram";
import { createHash, randomBytes } from "crypto";
import { handleWebhookProxy } from "./webhook-handlers/proxy";
import { getBaseUrl } from "@/lib/utils";
import type { Database } from "@/types/database.types"; // Ensure this type is correctly defined

// Type alias for Supabase User Row
type User = Database["public"]["Tables"]["users"]["Row"];

// --- Configuration ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = "413553377"; // Consider moving to env vars if it changes per environment
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || DEFAULT_CHAT_ID;
const COZE_API_KEY = process.env.COZE_API_KEY;
const COZE_BOT_ID = process.env.COZE_BOT_ID; // Removed default, should be configured
const COZE_USER_ID = process.env.COZE_USER_ID; // Removed default, should be configured

// Helper function to check essential environment variables
function checkEnvVars() {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.error("Missing critical environment variable: TELEGRAM_BOT_TOKEN");
    throw new Error("Telegram bot token not configured");
  }
  if (!COZE_API_KEY) {
    logger.warn("Missing environment variable: COZE_API_KEY. Coze features may be disabled.");
    // Don't throw, maybe some parts of the app don't need Coze
  }
   if (!COZE_BOT_ID) {
    logger.warn("Missing environment variable: COZE_BOT_ID. analyzeMessage may fail.");
  }
   if (!COZE_USER_ID) {
    logger.warn("Missing environment variable: COZE_USER_ID. analyzeMessage may fail.");
  }
  // Add checks for other essential keys like Supabase keys if they weren't checked elsewhere
}

// Call check on server start (or lazily before first use)
checkEnvVars();

// --- Webhook Handling ---

// Delegate webhook handling to the proxy
export async function handleWebhookUpdate(update: any) {
  // Consider adding basic validation of the 'update' object structure here
  if (!update) {
    logger.warn("Received empty webhook update.");
    return;
  }
  try {
    await handleWebhookProxy(update);
  } catch (error) {
    logger.error("Error processing webhook update in handleWebhookProxy:", error);
    // Depending on the error, might want to notify admin or return a specific response
  }
}

// --- Telegram API Interactions ---

interface InlineButton {
  text: string;
  url: string;
}

// Base type for Telegram API responses (adjust based on actual API)
interface TelegramApiResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

// Type for send message/photo payload
type SendPayload = {
  chat_id: string;
  reply_markup?: {
    inline_keyboard: Array<Array<{ text: string; url: string }>>;
  };
} & ({ text: string } | { photo: string; caption: string });


/** Sends a Telegram message or photo with optional buttons */
export async function sendTelegramMessage(
  message: string,
  buttons: InlineButton[] = [],
  imageUrl?: string,
  chatId?: string,
  carId?: string // Keep carId specific to this function if needed
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured" };
  }
  const finalChatId = chatId || ADMIN_CHAT_ID;

  try {
    let finalMessage = message;
    // Fetch car details if carId is provided
    if (carId) {
      const { data: car, error } = await supabaseAdmin
        .from("cars")
        .select("make, model, daily_price")
        .eq("id", carId)
        .single();
      if (error) {
        logger.error(`Failed to fetch car ${carId} for message: ${error.message}`);
        // Decide whether to send message without car info or fail
        // return { success: false, error: `Failed to fetch car info: ${error.message}` };
      } else if (car) {
        finalMessage += `\n\nCar: ${car.make} ${car.model}\nDaily Price: ${car.daily_price} XTR`;
      }
    }

    const payload: SendPayload = imageUrl
      ? {
          chat_id: finalChatId,
          photo: imageUrl,
          caption: finalMessage,
        }
      : {
          chat_id: finalChatId,
          text: finalMessage,
        };

    if (buttons.length > 0) {
      payload.reply_markup = {
        inline_keyboard: [buttons.map((button) => ({ text: button.text, url: button.url }))],
      };
    }

    const endpoint = imageUrl ? "sendPhoto" : "sendMessage";
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data: TelegramApiResponse = await response.json();

    if (!data.ok) {
      logger.error(`Telegram API error (${endpoint}): ${data.description || "Unknown error"}`, { chatId: finalChatId, errorCode: data.error_code });
      throw new Error(data.description || `Failed to ${endpoint}`);
    }

    return { success: true, data: data.result };
  } catch (error) {
    logger.error(`Error in sendTelegramMessage (${chatId || ADMIN_CHAT_ID}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred while sending Telegram message",
    };
  }
}

/** Sends a Telegram document to a specified chat */
export async function sendTelegramDocument(
  chatId: string,
  fileContent: string,
  fileName: string
): Promise<{ success: boolean; data?: any; error?: string }> {
   if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured" };
  }

  try {
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", blob, fileName);

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: formData, // Don't set Content-Type header when using FormData, browser does it
    });

    const data: TelegramApiResponse = await response.json();
    if (!data.ok) {
       logger.error(`Telegram API error (sendDocument): ${data.description || "Unknown error"}`, { chatId, errorCode: data.error_code });
      throw new Error(data.description || "Failed to send document");
    }

    return { success: true, data: data.result };
  } catch (error) {
     logger.error(`Error in sendTelegramDocument (${chatId}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred while sending document",
    };
  }
}

/** Sends a Telegram invoice using the sendInvoice method */
export async function sendTelegramInvoice(
  chatId: string,
  title: string,
  description: string,
  payload: string, // Unique invoice payload identifier
  amount: number, // Amount in the smallest units of the currency (e.g., cents for USD, kopecks for RUB, but seems like XTR uses whole units here?)
  subscription_id: number = 0, // Optional, defaults to 0
  photo_url?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured" };
  }
  // Note: PROVIDER_TOKEN is empty for XTR (Telegram Stars)
  const PROVIDER_TOKEN = "";
  const currency = "XTR"; // Using Telegram Stars

  // Prices array expects amount in smallest units. Assuming XTR is represented as whole units here.
  const prices = [{ label: title, amount: amount }]; // Adjust label if needed

  const requestBody: Record<string, any> = {
      chat_id: chatId,
      title,
      description,
      payload,
      provider_token: PROVIDER_TOKEN,
      currency,
      prices,
      start_parameter: "pay", // Optional: Deep-linking parameter
      // need_shipping_address: false, // Default is false
      // is_flexible: false, // Default is false
  };

  if (photo_url) {
    requestBody.photo_url = photo_url;
    requestBody.photo_size = 600; // Optional: size of the photo
    requestBody.photo_width = 600; // Optional: photo width
    requestBody.photo_height = 400; // Optional: photo height
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendInvoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    const data: TelegramApiResponse = await response.json();

    if (!data.ok) {
      logger.error(`Telegram API error (sendInvoice): ${data.description || "Unknown error"}`, { chatId, payload, errorCode: data.error_code });
      throw new Error(`Telegram API error: ${data.description || "Failed to send invoice"}`);
    }

    // Store the invoice in the database *after* successfully sending it
    // Consider moving this DB logic to the caller function (e.g., purchaseDisableDummyMode)
    // to keep this function focused only on Telegram API interaction.
    // If kept here, ensure proper error handling for DB operation.
    try {
        const { error: insertError } = await supabaseAdmin
            .from("invoices")
            .insert({
                id: payload, // Use the same unique payload as invoice ID
                user_id: chatId,
                amount: amount, // Store the amount (confirm if it should be divided by 100 for XTR)
                type: payload.split("_")[0], // Infer type from payload prefix (e.g., "donation") - might be brittle
                status: "pending",
                metadata: { description, title }, // Store relevant info
                subscription_id: subscription_id || 0, // Ensure subscription_id is stored
            });

        if (insertError) {
            // Log the error, but maybe don't fail the whole operation if invoice was sent
            logger.error(`Failed to save invoice ${payload} to DB after sending: ${insertError.message}`);
            // Decide if this should return an error to the user.
            // return { success: false, error: `Failed to save invoice to database: ${insertError.message}` };
        }
    } catch (dbError) {
         logger.error(`Exception saving invoice ${payload} to DB after sending:`, dbError);
    }


    return { success: true, data: data.result };
  } catch (error) {
    logger.error("Error in sendTelegramInvoice:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to send invoice" };
  }
}


/** Confirms a pre-checkout query */
export async function confirmPayment(preCheckoutQueryId: string): Promise<{ success: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured" };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pre_checkout_query_id: preCheckoutQueryId,
        ok: true, // Confirming the payment is possible
      }),
    });

    const result: TelegramApiResponse = await response.json();
    if (!result.ok) {
      logger.error(`Telegram API error (answerPreCheckoutQuery): ${result.description}`, { preCheckoutQueryId, errorCode: result.error_code });
      throw new Error(result.description || "Failed to answer pre-checkout query");
    }
    logger.info(`Pre-checkout query ${preCheckoutQueryId} confirmed successfully.`);
    return { success: true };
  } catch (error) {
     logger.error(`Error confirming payment (preCheckoutQueryId: ${preCheckoutQueryId}):`, error);
     return { success: false, error: error instanceof Error ? error.message : "Failed to confirm payment" };
  }
}


// --- Notifications ---

/** Notifies the primary admin */
export async function notifyAdmin(message: string): Promise<{ success: boolean; error?: string }> {
  const result = await sendTelegramMessage(message, [], undefined, ADMIN_CHAT_ID);
  // Log only if there was an error sending the notification
  if (!result.success) {
     logger.error(`Failed to notify primary admin (${ADMIN_CHAT_ID}): ${result.error}`);
  }
  return { success: result.success, error: result.error };
}

/** Notifies all users with 'admin' status */
export async function notifyAdmins(message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: admins, error } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("status", "admin"); // Assuming 'status' field determines admin

    if (error) {
      logger.error("Failed to fetch admins for notification:", error);
      throw error;
    }

    if (!admins || admins.length === 0) {
      logger.warn("No admins found to notify.");
      // Notify the default admin as a fallback?
      // await notifyAdmin(`(No admins found) ${message}`);
      return { success: true }; // No error, just no one to notify
    }

    let allSuccessful = true;
    for (const admin of admins) {
      const result = await sendTelegramMessage(message, [], undefined, admin.user_id);
      if (!result.success) {
        allSuccessful = false;
        logger.error(`Failed to notify admin ${admin.user_id}: ${result.error}`);
        // Continue notifying others
      }
    }
    return { success: allSuccessful, error: allSuccessful ? undefined : "Failed to notify one or more admins" };
  } catch (error) {
     logger.error("Error notifying admins:", error);
     return { success: false, error: error instanceof Error ? error.message : "Failed to fetch or notify admins" };
  }
}

/** Notifies a car owner about a car-related action */
export async function notifyCarAdmin(carId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: car, error } = await supabaseAdmin
      .from("cars")
      .select("owner_id, image_url, make, model") // Select necessary fields
      .eq("id", carId)
      .maybeSingle(); // Use maybeSingle to handle car not found gracefully

    if (error) {
      logger.error(`Error fetching car ${carId} for notification:`, error);
      return { success: false, error: `Failed to fetch car: ${error.message}` };
    }

    if (!car) {
       logger.warn(`Car ${carId} not found for notification.`);
       return { success: false, error: `Car with ID ${carId} not found.` };
    }
     if (!car.owner_id) {
       logger.warn(`Car ${carId} has no owner_id set for notification.`);
       // Notify default admin instead?
       // await notifyAdmin(`Action on car ${carId} (owner unknown): ${message}`);
       return { success: true }; // Success, but no one to notify
    }


    const adminId = car.owner_id;
    const baseUrl = getBaseUrl();
    const fullMessage = `${message}\nCar: ${car.make || 'N/A'} ${car.model || 'N/A'}`;
    const buttons = [{ text: "View Car", url: `${baseUrl}/rent/${carId}` }]; // Adjust URL as needed

    const result = await sendTelegramMessage(
      fullMessage,
      buttons,
      car.image_url, // Send image if available
      adminId
      // carId is not needed by sendTelegramMessage if message already includes details
    );

    if (!result.success) {
      logger.error(`Failed to notify car admin ${adminId} for car ${carId}: ${result.error}`);
    }
    return { success: result.success, error: result.error };
  } catch (error) {
      logger.error(`Unexpected error in notifyCarAdmin for car ${carId}:`, error);
       return { success: false, error: error instanceof Error ? error.message : "Unexpected error notifying car admin" };
  }
}

/** Notifies all distinct car owners */
export async function superNotification(message: string): Promise<{ success: boolean; error?: string }> {
   try {
    // Select distinct owner_id where it's not null
    const { data: owners, error } = await supabaseAdmin
      .from("cars")
      .select("owner_id", { count: 'exact', head: false }) // Get distinct owners
      .neq("owner_id", null) // Ensure owner_id exists
      .then(response => {
          if (response.error) return response;
          // Manual distinct filtering if Supabase distinct doesn't work as expected
          const distinctOwners = Array.from(new Set(response.data?.map(o => o.owner_id)));
          return { data: distinctOwners.map(id => ({ owner_id: id })), error: null };
      });


    if (error) {
      logger.error("Error fetching distinct car owners for super notification:", error);
      throw error;
    }

     if (!owners || owners.length === 0) {
      logger.warn("No car owners found for super notification.");
      return { success: true };
    }

    logger.info(`Sending super notification to ${owners.length} owners.`);

    let allSuccessful = true;
    for (const owner of owners) {
       if (!owner.owner_id) continue; // Skip if somehow owner_id is null/undefined
      const result = await sendTelegramMessage(message, [], undefined, owner.owner_id);
       if (!result.success) {
        allSuccessful = false;
        logger.error(`Failed to send super notification to owner ${owner.owner_id}: ${result.error}`);
      }
    }
    return { success: allSuccessful, error: allSuccessful ? undefined : "Failed to send super notification to one or more owners" };
   } catch(error) {
       logger.error("Error sending super notification:", error);
       return { success: false, error: error instanceof Error ? error.message : "Failed to send super notification" };
   }
}

/** Broadcasts a message to all users or users with a specific role */
export async function broadcastMessage(message: string, role?: string): Promise<{ success: boolean; error?: string }> {
  try {
    let query = supabaseAdmin.from("users").select("user_id");
    if (role) {
      query = query.eq("role", role); // Assuming 'role' field exists
    } else {
      // Optionally add a condition to exclude inactive/banned users?
      // query = query.neq('status', 'banned');
    }

    const { data: users, error } = await query;

    if (error) {
      logger.error(`Error fetching users for broadcast (role: ${role || 'all'}):`, error);
      throw error;
    }

     if (!users || users.length === 0) {
      logger.warn(`No users found for broadcast (role: ${role || 'all'}).`);
      return { success: true };
    }

    logger.info(`Broadcasting message to ${users.length} users (role: ${role || 'all'}).`);

    let allSuccessful = true;
    for (const user of users) {
       if (!user.user_id) continue;
      const result = await sendTelegramMessage(message, [], undefined, user.user_id);
      if (!result.success) {
        allSuccessful = false;
        logger.error(`Failed to broadcast message to user ${user.user_id}: ${result.error}`);
      }
      // Add a small delay to avoid hitting Telegram rate limits for large broadcasts
      await delay(50); // 50ms delay between messages (adjust as needed)
    }
    return { success: allSuccessful, error: allSuccessful ? undefined : "Failed to broadcast message to one or more users" };
  } catch (error) {
      logger.error("Error during broadcast:", error);
       return { success: false, error: error instanceof Error ? error.message : "Failed to broadcast message" };
  }
}

// Notify admins when a user successfully completes CAPTCHA
export async function notifyCaptchaSuccess(userId: string, username?: string | null): Promise<{ success: boolean; error?: string }> {
  const message = `🔔 Пользователь ${username || userId} (${userId}) успешно прошел CAPTCHA.`;
  // Notify all admins using the dedicated function
  return notifyAdmins(message);
}

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

// Notify specific users (e.g., after successful CAPTCHA)
export async function notifyUsers(userIds: string[], message: string): Promise<{ success: boolean; error?: string }> {
  if (!userIds || userIds.length === 0) {
    return { success: true }; // Nothing to do
  }
  logger.info(`Notifying ${userIds.length} users.`);

  let allSuccessful = true;
  try {
    for (const userId of userIds) {
      const result = await sendTelegramMessage(message, [], undefined, userId);
      if (!result.success) {
        allSuccessful = false;
        logger.error(`Failed to notify user ${userId}:`, result.error);
      }
       await delay(50); // Avoid rate limits
    }
    return { success: allSuccessful, error: allSuccessful ? undefined : "Failed to notify one or more users" };
  } catch (error) {
     logger.error("Error notifying multiple users:", error);
     return { success: false, error: error instanceof Error ? error.message : "Failed to notify users" };
  }
}

// Notify winners and admin about Wheel of Fortune results
export async function notifyWinners(winningNumber: number, winners: User[]): Promise<{ success: boolean; error?: string }> {
  if (!winners || winners.length === 0) {
    logger.info("Wheel of Fortune: No winners to notify.");
    return { success: true };
  }

  try {
    const winnerNotificationMessage = `🎉 Congratulations! Your lucky number ${winningNumber} has been drawn in the Wheel of Fortune! You are a winner! 🏆`;
    let allWinnersNotified = true;

    // Notify each winner
    for (const winner of winners) {
      if (!winner.user_id) continue;
      const result = await sendTelegramMessage(winnerNotificationMessage, [], undefined, winner.user_id);
      if (!result.success) {
        allWinnersNotified = false;
        logger.error(`Failed to notify winner ${winner.user_id}: ${result.error}`);
      }
       await delay(50);
    }

    // Notify admin about the winners
    const winnerNames = winners.map((w) => w.username || w.full_name || w.user_id).join(", ");
    const adminMessage = `🎮 Wheel of Fortune Results:\nWinning Number: ${winningNumber}\nWinners (${winners.length}): ${winnerNames}`;
    const adminNotifyResult = await notifyAdmin(adminMessage); // Use notifyAdmin

    return {
        success: allWinnersNotified && adminNotifyResult.success,
        error: !allWinnersNotified || !adminNotifyResult.success ? "Failed to notify some winners or admin" : undefined
    };
  } catch (error) {
    logger.error("Error notifying winners:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to notify winners",
    };
  }
}


// --- Coze API Interactions ---

// Utility to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Common function to poll Coze API for response
async function pollCozeChat(conversationId: string, chatId: string, apiKey: string | undefined, maxAttempts = 15, pollInterval = 2000) {
    if (!apiKey) throw new Error("Coze API Key not configured");

    let attempts = 0;
    while (attempts < maxAttempts) {
        try {
            const messagesResponse = await axios.get(
                `https://api.coze.com/v3/chat/message/list?conversation_id=${conversationId}&chat_id=${chatId}`,
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json", // Needed? Check Coze docs
                    },
                    timeout: 5000, // Add timeout for the request itself
                }
            );

            // logger.debug('Coze API messages response.data:', messagesResponse.data); // Verbose logging

            // Find the assistant's answer message
            const assistantMessage = messagesResponse.data?.data?.find(
                (msg: any) => msg.role === "assistant" && msg.type === "answer"
            );

            if (assistantMessage?.content) {
                return assistantMessage.content; // Return the content string
            }

        } catch(pollError) {
             logger.error(`Error polling Coze chat (Attempt ${attempts + 1}/${maxAttempts}):`, pollError);
             // Optional: Implement backoff or different handling based on error type
             if (axios.isAxiosError(pollError) && pollError.response?.status === 429) {
                 logger.warn("Coze API rate limit hit, backing off...");
                 await delay(pollInterval * 2); // Double delay on rate limit
                 continue; // Try again after longer delay
             }
        }

        attempts++;
        await delay(pollInterval); // Wait before next poll
    }

    throw new Error(`No assistant answer received from Coze after ${maxAttempts} attempts`);
}


/**
 * Executes a Coze agent, waits for the response, saves it, and returns the text.
 * @deprecated Consider using runCozeAgentAndSave or runCozeAgent directly.
 */
export async function executeCozeAgent(
  botId: string,
  userId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; data?: string; error?: string }> {
    if (!COZE_API_KEY) return { success: false, error: "Coze API Key not configured" };

    try {
        // Step 1: Initiate the chat
        const initResponse = await axios.post(
            "https://api.coze.com/v3/chat",
            {
                bot_id: botId,
                user_id: userId,
                stream: false,
                auto_save_history: true, // Assuming this is desired
                additional_messages: [{ role: "user", content: content, content_type: "text" }],
            },
            {
                headers: { Authorization: `Bearer ${COZE_API_KEY}`, "Content-Type": "application/json" },
                 timeout: 10000, // Timeout for initial request
            }
        );

        const chatId = initResponse.data?.data?.id;
        const conversationId = initResponse.data?.data?.conversation_id;

        if (!chatId || !conversationId) {
            logger.error("Missing chat ID or conversation ID in Coze init response:", initResponse.data);
            throw new Error("Missing chat ID or conversation ID in Coze initial response");
        }

        // Step 2: Poll for the assistant's response
        const assistantAnswer = await pollCozeChat(conversationId, chatId, COZE_API_KEY);

        // Step 3: Save the text response to Supabase
        const { error: insertError } = await supabaseAdmin
            .from("coze_responses") // Ensure this table exists and has RLS if needed
            .insert({
                bot_id: botId,
                user_id: userId, // Ensure this matches the user ID format in your 'users' table if linking
                request_content: content, // Renamed field for clarity
                response_content: assistantAnswer,
                metadata: metadata || {}, // Store metadata if provided
                coze_conversation_id: conversationId, // Store Coze IDs for reference
                coze_chat_id: chatId,
            });

        if (insertError) {
             logger.error("Failed to save Coze response to DB:", insertError);
            // Decide whether to throw or just return success=false
            throw new Error(`Failed to save Coze response: ${insertError.message}`);
        }

        return { success: true, data: assistantAnswer }; // Return the text response

    } catch (error) {
        logger.error(`Coze execution failed (Bot: ${botId}, User: ${userId}):`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to execute Coze agent" };
    }
}

/** Runs a Coze agent and returns the plain text response without saving it. */
export async function runCozeAgent(
    botId: string,
    userId: string, // Coze User ID, may not be the same as your app's user ID
    content: string
): Promise<{ success: boolean; data?: string; error?: string }> {
     if (!COZE_API_KEY) return { success: false, error: "Coze API Key not configured" };

    try {
        // Step 1: Initiate the chat
        const initResponse = await axios.post(
            "https://api.coze.com/v3/chat",
            {
                bot_id: botId,
                user_id: userId, // Use the Coze user ID
                stream: false,
                auto_save_history: true,
                additional_messages: [{ role: "user", content: content, content_type: "text" }],
            },
            {
                headers: { Authorization: `Bearer ${COZE_API_KEY}`, "Content-Type": "application/json" },
                 timeout: 10000,
            }
        );

        const chatId = initResponse.data?.data?.id;
        const conversationId = initResponse.data?.data?.conversation_id;
        if (!chatId || !conversationId) {
            logger.error("Missing chat ID or conversation ID in Coze init response:", initResponse.data);
            throw new Error("Missing chat ID or conversation ID in Coze initial response");
        }

        // Step 2: Poll for the assistant's response
        const assistantAnswer = await pollCozeChat(conversationId, chatId, COZE_API_KEY);

        return { success: true, data: assistantAnswer };

    } catch (error) {
        logger.error(`Error running Coze agent (Bot: ${botId}, User: ${userId}):`, error);
         return { success: false, error: error instanceof Error ? error.message : "Failed to run Coze agent" };
    }
}

/** Analyzes a message using a specific Coze bot and parses the expected JSON response. */
export async function analyzeMessage(content: string): Promise<{
    success: boolean;
    data?: {
        bullshit_percentage: number;
        emotional_comment: string;
        analyzed_content: string;
        content_summary: string;
        animation: string; // Consider using a more specific type/enum if possible
    };
    error?: string;
}> {
    // Use the configured Bot ID and User ID for this specific analysis task
    const botId = COZE_BOT_ID;
    const userId = COZE_USER_ID;

    if (!botId || !userId) {
         return { success: false, error: "Coze Bot ID or User ID for analysis not configured" };
    }
     if (!COZE_API_KEY) return { success: false, error: "Coze API Key not configured" };


    try {
        logger.info(`Analyzing message with Coze Bot ${botId}...`);
        // Reuse runCozeAgent to get the raw response
        const agentResult = await runCozeAgent(botId, userId, content);

        if (!agentResult.success || !agentResult.data) {
            throw new Error(agentResult.error || "Failed to get response from Coze analysis agent");
        }

        const assistantAnswer = agentResult.data;
        logger.debug("Raw response from Coze analysis bot:", assistantAnswer);

        // Parse the content, expecting a JSON string
        let parsedData;
        try {
            parsedData = JSON.parse(assistantAnswer);
             // Optional: Add validation here using Zod or similar to ensure structure
        } catch (e) {
            logger.warn('Coze assistant content is not valid JSON, treating as plain text:', assistantAnswer);
            // Fallback: Use the raw text as the emotional comment
            return {
                success: true, // Still successful in getting *a* response
                data: {
                    bullshit_percentage: 50, // Default value
                    emotional_comment: assistantAnswer, // Use raw text
                    analyzed_content: content, // Original content
                    content_summary: "No summary available (response not JSON).",
                    animation: "neutral", // Default animation
                }
            };
        }

        // Construct the result using parsed data, providing defaults for missing fields
        const resultData = {
            bullshit_percentage: typeof parsedData.bullshit_percentage === 'number' ? parsedData.bullshit_percentage : 50,
            emotional_comment: parsedData.emotional_comment || "Analysis comment missing.",
            analyzed_content: parsedData.analyzed_content || content,
            content_summary: parsedData.content_summary || "No summary available.",
            animation: parsedData.animation || "neutral",
        };

         logger.info(`Message analysis successful.`);
        return { success: true, data: resultData };

    } catch (error) {
        logger.error('Error analyzing message:', error);
         return { success: false, error: error instanceof Error ? error.message : 'Failed to analyze message' };
    }
}


// --- Embeddings ---

/** Triggers batch generation of embeddings for cars missing them. */
export const generateEmbeddings = async (): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const { data: cars, error: fetchError, count } = await supabaseAdmin
      .from("cars")
      .select("id", { count: 'exact', head: true }) // Just get the count efficiently
      .is("embedding", null);

    if (fetchError) {
       logger.error("Error fetching count of cars needing embeddings:", fetchError);
      throw fetchError;
    }

    if (!count || count === 0) {
      logger.info("No cars found needing embedding generation.");
      return { success: true, message: "No cars needed embeddings." };
    }

    logger.info(`Found ${count} cars needing embeddings. Triggering batch generation...`);
    // Call the centralized embedding function (now in supabase.ts) for batch processing
    // Assuming generateCarEmbedding without args triggers batch mode via Edge Function
    const result = await generateCarEmbedding(); // Expects generateCarEmbedding to handle the Edge Function call

    logger.info(`Triggered embedding generation for ${count} cars. Result:`, result); // Log result if any
    return { success: true, message: `Triggered embedding generation for ${count} cars.` };

  } catch (error) {
     logger.error("Error in generateEmbeddings action:", error);
     return { success: false, error: error instanceof Error ? error.message : "Failed to trigger embedding generation" };
  }
};

/** Finds cars similar to a given embedding vector */
export async function findSimilarCars(
    embedding: number[],
    limit: number = 3
): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!embedding || embedding.length === 0) {
        return { success: false, error: "Invalid embedding provided" };
    }
    try {
        // Assuming search_cars RPC function exists and works
        const { data, error } = await supabaseAdmin.rpc("search_cars", {
            query_embedding: embedding,
            match_count: limit,
        });

        if (error) {
            logger.error("Error searching for similar cars:", error);
            throw error;
        }

        // Format the result slightly
        const formattedData = data?.map((car: any) => ({ // Use 'any' carefully, define type if possible
            ...car,
            similarity: car.similarity ? Math.round(car.similarity * 100) : 0, // Calculate percentage
        })) || [];

        return { success: true, data: formattedData };
    } catch (error) {
         logger.error("Error in findSimilarCars action:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to find similar cars" };
    }
}

// --- User Management & Authentication ---

/** Creates or updates a user based on Telegram info, notifies admin. */
export async function createOrUpdateUser(userInfo: WebAppUser): Promise<{ success: boolean; data?: User; error?: string }> {
    if (!userInfo?.id) {
        return { success: false, error: "Invalid user info provided" };
    }
    const userId = userInfo.id.toString();

    try {
         // Use the consolidated function from hooks/supabase.ts
        const user = await dbCreateOrUpdateUser(userId, userInfo);

        if (!user) {
            // This case might indicate an issue within dbCreateOrUpdateUser if it's expected to always return a user
            throw new Error("Failed to create or update user in database.");
        }

        logger.info(`User ${user.username || userId} created or updated successfully.`);

        // Notify default admin of new *or updated* user (Consider if only new needed)
        // Use notifyAdmin for simplicity
        await notifyAdmin(`User registered/updated: ${user.username || userId} (${userId})`);

        return { success: true, data: user };
    } catch (error) {
        logger.error(`Error creating/updating user ${userId}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create or update user",
        };
    }
}


/** Authenticates a user, upserts their data, and returns user + JWT */
export async function authenticateUser(chatId: string, userInfo?: Partial<WebAppUser>): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
        // Upsert user data using the function from hooks/supabase.ts
        const user = await dbCreateOrUpdateUser(chatId, userInfo || { id: parseInt(chatId, 10) }); // Provide base info if userInfo is missing

        if (!user) {
            throw new Error("Failed to create or update user during authentication.");
        }

        // Generate JWT token for the authenticated user
        const token = await generateJwtToken(chatId); // Assuming generateJwtToken is async or handles async operations

        logger.info(`User ${chatId} authenticated successfully.`);
        return { success: true, user, token };
    } catch (error) {
        logger.error(`Authentication failed for user ${chatId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Authentication failed" };
    }
}

/** Validates a JWT token and returns the corresponding user data */
export async function validateToken(token: string): Promise<{ success: boolean; user?: User | null; error?: string }> {
  try {
    const decoded = verifyJwtToken(token); // Assuming this synchronous or handles async internally
    if (!decoded || !decoded.sub) {
      logger.warn("Token validation failed: Invalid or expired token.");
      return { success: false, error: "Invalid or expired token", user: null };
    }

    // Fetch user data using the validated user ID (subject of the token)
    // Use the consolidated function from hooks/supabase.ts
    const user = await dbFetchUserData(decoded.sub);

    if (!user) {
       logger.warn(`Token valid but user ${decoded.sub} not found in database.`);
      // Decide if this is an error or just means user was deleted
       return { success: false, error: "User not found", user: null };
    }

     logger.info(`Token validated successfully for user ${user.user_id}.`);
    return { success: true, user };
  } catch (error) {
     logger.error("Error during token validation:", error);
     // Differentiate between token format errors and DB errors?
     if (error instanceof Error && (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError')) {
          return { success: false, error: `Token validation failed: ${error.message}`, user: null };
     }
    return { success: false, error: error instanceof Error ? error.message : "Failed to validate token", user: null };
  }
}


// --- CAPTCHA ---

interface CaptchaSettings {
  string_length: number;
  character_set: "letters" | "numbers" | "both";
  case_sensitive: boolean; // Note: verification logic needs to respect this
  noise_level: number; // 0-100 (lines count)
  font_size: number; // 20-50
  background_color: string; // Hex code (e.g., "#FFFFFF")
  text_color: string; // Hex code (e.g., "#000000")
  distortion: number; // 0-1 (rotation intensity)
}

// Helper to adjust color brightness (used in CAPTCHA)
function adjustColor(hex: string, amount: number): string {
  try {
      const color = hex.replace("#", "");
      // Ensure hex is valid before parsing
      if (!/^[0-9A-F]{6}$/i.test(color)) {
          throw new Error("Invalid hex color format");
      }
      const r = Math.max(0, Math.min(255, parseInt(color.slice(0, 2), 16) + amount));
      const g = Math.max(0, Math.min(255, parseInt(color.slice(2, 4), 16) + amount));
      const b = Math.max(0, Math.min(255, parseInt(color.slice(4, 6), 16) + amount));
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch (error) {
       logger.error(`Failed to adjust color ${hex}:`, error);
      return hex; // Return original color on error
  }
}


export async function generateCaptcha(settings: CaptchaSettings): Promise<{
    success: boolean;
    data?: { image: string; hash: string; text: string /* Return text for verification */ };
    error?: string;
}> {
    try {
        // Validate settings
        if (settings.string_length <= 0 || settings.noise_level < 0 || settings.font_size < 10 || settings.distortion < 0 || settings.distortion > 1) {
             throw new Error("Invalid CAPTCHA settings provided.");
        }

        const chars =
            settings.character_set === "letters"
            ? "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
            : settings.character_set === "numbers"
            ? "0123456789"
            : "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        const captchaText = Array.from(
            { length: settings.string_length },
            () => chars[Math.floor(Math.random() * chars.length)]
        ).join("");

        const width = Math.max(200, settings.string_length * (settings.font_size * 0.8) + 60); // Adjust width based on font size
        const height = Math.max(60, settings.font_size + 40); // Adjust height based on font size

        // SVG generation (simplified for clarity, consider a library for complex SVG)
        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background-color: ${settings.background_color};">`;
        // Optional: Add gradient background
        // svg += `<defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${settings.background_color};stop-opacity:1" /><stop offset="100%" style="stop-color:${adjustColor(settings.background_color, -20)};stop-opacity:1" /></linearGradient></defs>`;
        // svg += `<rect width="${width}" height="${height}" fill="url(#grad)" />`;

        // Noise (lines)
        for (let i = 0; i < settings.noise_level / 5; i++) { // Reduced line count for performance/clarity
            const x1 = Math.random() * width;
            const y1 = Math.random() * height;
            const x2 = Math.random() * width;
            const y2 = Math.random() * height;
            svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${adjustColor(settings.text_color, 80)}" stroke-width="1" opacity="0.5" />`;
        }

        // Text with distortion
        const textY = height / 2 + settings.font_size / 3; // Center text vertically better
        for (let i = 0; i < captchaText.length; i++) {
            const x = 30 + i * (settings.font_size * 0.8); // Adjust spacing based on font size
            const rotation = (Math.random() - 0.5) * settings.distortion * 45; // Rotation in degrees
            const charColor = adjustColor(settings.text_color, Math.random() * 40 - 20); // Slight color variation per char
            svg += `<text x="${x}" y="${textY}" font-family="monospace" font-size="${settings.font_size}" fill="${charColor}" transform="rotate(${rotation}, ${x}, ${textY})">${captchaText[i]}</text>`;
        }

        // Optional: Add more noise like dots
        // ...

        svg += `</svg>`;

        const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

        // Store the *actual text* in the session or temporary storage for verification,
        // not just the hash. Hashing the input during verification is better.
        // The hash returned here might be for internal reference if needed.
        const referenceHash = createHash("sha256")
            .update(settings.case_sensitive ? captchaText : captchaText.toLowerCase())
            .digest("hex");

        return { success: true, data: { image, hash: referenceHash, text: captchaText } };
    } catch (error) {
         logger.error("Error generating CAPTCHA:", error);
         return { success: false, error: error instanceof Error ? error.message : "Failed to generate CAPTCHA" };
    }
}

// Verification should compare user input against the stored *text* (case-insensitively if needed)
// This function is likely called from a context where the original CAPTCHA text is available (e.g., user session)
export async function verifyCaptcha(
    correctText: string, // The actual text generated
    userInput: string,
    caseSensitive: boolean
): Promise<boolean> {
    if (!correctText || userInput === null || userInput === undefined) {
        return false;
    }
    if (caseSensitive) {
        return correctText === userInput;
    } else {
        return correctText.toLowerCase() === userInput.toLowerCase();
    }
}


// --- Misc Actions ---

/** Sends a donation invoice and notifies admin */
export async function sendDonationInvoice(chatId: string, amount: number, message: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Ensure amount is valid
        if (isNaN(amount) || amount <= 0) {
             return { success: false, error: "Invalid donation amount." };
        }
        // Convert amount to smallest unit if necessary (assuming XTR uses whole units)
        const finalAmount = amount; // Adjust if XTR needs smallest units, e.g., amount * 100

        const invoicePayload = `donation_${chatId}_${Date.now()}`; // Unique payload
        const title = "Donation to Leha"; // Keep concise
        const description = `Thank you for your support! Message: ${message || "No message"}`;

        // Send the invoice using the dedicated function
        const invoiceResult = await sendTelegramInvoice(
            chatId,
            title,
            description,
            invoicePayload,
            finalAmount,
            0, // No subscription ID for donations
            undefined // No photo for donations (or add a generic thank you image)
        );

        if (!invoiceResult.success) {
            // Error already logged by sendTelegramInvoice
            throw new Error(invoiceResult.error || "Failed to send donation invoice via Telegram");
        }

        // Note: sendTelegramInvoice already attempts to save the invoice.
        // If saving is moved out of sendTelegramInvoice, add the DB insert here.
        /*
        const { error: insertError } = await supabaseAdmin
            .from("invoices")
            .insert({
                id: invoicePayload,
                user_id: chatId,
                amount: finalAmount, // Store amount consistently
                type: "donation",
                status: "pending",
                metadata: { message: message || null, title },
                subscription_id: 0,
            });

        if (insertError) {
             logger.error(`Failed to save donation invoice ${invoicePayload} to DB:`, insertError);
            // Decide if this should be a user-facing error
            throw new Error(`Failed to save invoice record: ${insertError.message}`);
        }
        */

        // Notify admin of the new donation *attempt*
        const adminMessage = `💸 New donation attempt!\nAmount: ${amount} XTR\nFrom Chat ID: ${chatId}\nMessage: ${message || "None"}`;
        await notifyAdmin(adminMessage); // Use notifyAdmin

        return { success: true };
    } catch (error) {
        logger.error("Error in sendDonationInvoice:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to process donation request" };
    }
}

/** Updates a car’s status and notifies the owner */
export async function updateCarStatus(carId: string, newStatus: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Optional: Validate newStatus against allowed values?
        const allowedStatuses = ["available", "rented", "maintenance", "unavailable"];
        if (!allowedStatuses.includes(newStatus)) {
            return { success: false, error: `Invalid car status: ${newStatus}` };
        }

        // Update car status
        const { error: updateError } = await supabaseAdmin
            .from("cars")
            .update({ status: newStatus, updated_at: new Date().toISOString() }) // Also update timestamp
            .eq("id", carId);

        if (updateError) {
            logger.error(`Error updating status for car ${carId}:`, updateError);
            throw updateError;
        }

         logger.info(`Car ${carId} status updated to ${newStatus}. Notifying owner...`);

        // Notify the car owner using the dedicated function
        const notifyResult = await notifyCarAdmin(carId, `🚗 Your car status has been updated to: ${newStatus}`);

        // Return success even if notification fails, but log the failure
         if (!notifyResult.success) {
             logger.warn(`Failed to notify owner after updating status for car ${carId}: ${notifyResult.error}`);
         }

        return { success: true };
    } catch (error) {
         logger.error(`Failed to update status for car ${carId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update car status" };
    }
}


/** Checks the status of a specific invoice */
export async function checkInvoiceStatus(token: string, invoiceId: string): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
        // Validate the token and get user ID
        const validationResult = await validateToken(token);
        if (!validationResult.success || !validationResult.user) {
            return { success: false, error: validationResult.error || "Unauthorized", status: undefined };
        }
        const userId = validationResult.user.user_id;

        // Fetch invoice, ensuring it belongs to the user (if RLS isn't strictly enforced on this check)
        const { data, error } = await supabaseAdmin
            .from("invoices")
            .select("status, user_id")
            .eq("id", invoiceId)
            .maybeSingle(); // Use maybeSingle

        if (error) {
            logger.error(`Error fetching invoice ${invoiceId} status:`, error);
            throw error;
        }

        if (!data) {
             return { success: false, error: "Invoice not found", status: undefined };
        }

        // Optional: Double-check ownership if needed (though RLS should handle this ideally)
        // if (data.user_id !== userId) {
        //    logger.warn(`User ${userId} attempted to check status of invoice ${invoiceId} owned by ${data.user_id}`);
        //    return { success: false, error: "Access denied", status: undefined };
        // }

        return { success: true, status: data.status };
    } catch (error) {
        logger.error(`Error checking invoice ${invoiceId} status:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch invoice status", status: undefined };
    }
}

/** Sets the Telegram webhook URL */
export async function setTelegramWebhook(): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured" };
  }
  const webhookUrl = `${getBaseUrl()}/api/telegramWebhook`; // Ensure this API route exists and handles POST requests

  logger.info(`Setting Telegram webhook to: ${webhookUrl}`);

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const result: TelegramApiResponse = await response.json();

    if (!result.ok) {
      logger.error(`Failed to set Telegram webhook: ${result.description}`, { errorCode: result.error_code });
      throw new Error(result.description || "Failed to set webhook");
    }

    logger.info("Telegram webhook set successfully:", result.result);
    return { success: true, data: result.result };
  } catch (error) {
     logger.error("Error setting Telegram webhook:", error);
     return { success: false, error: error instanceof Error ? error.message : "Failed to set webhook" };
  }
}



// --- RESTORED / DEPRECATED? ---


/**
 * Sends a result (likely car info) back via Telegram Photo message.
 * Might be specific to a particular Mini App flow.
 * @deprecated Review if this specific message format/flow is still used.
 */
export async function sendResult(chatId: string, result: any) {
    // Original had no explicit error handling or success/error return structure
    if (!TELEGRAM_BOT_TOKEN) {
        logger.error("sendResult failed: Telegram bot token not configured");
        return { success: false, error: "Telegram bot token not configured" };
    }
    if (!chatId || !result || !result.imageUrl || !result.car || !result.car.id) {
         logger.warn("sendResult called with missing data", { chatId, result });
         return { success: false, error: "Missing required data for sendResult" };
    }

    try {
        const baseUrl = getBaseUrl();
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;

        // Construct caption safely
        const caption = `*${result.car.make || result.car.model || 'Car'}*\n${result.description || 'No description'}`; // Handle potential missing fields

        const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            photo: result.imageUrl,
            caption: caption,
            parse_mode: "Markdown",
            reply_markup: {
            inline_keyboard: [
                [
                {
                    text: "Rent This Car 🚗",
                    url: `${baseUrl}/rent/${result.car.id}`, // Ensure car.id exists
                },
                {
                    text: "Try Again 🔄",
                    web_app: { url: baseUrl }, // Ensure web_app URL is correct
                },
                ],
            ],
            },
        }),
        });

        const data: TelegramApiResponse = await response.json();

        if (!data.ok) {
            logger.error(`Error sending result via Telegram: ${data.description}`, { chatId, errorCode: data.error_code });
            throw new Error(data.description || "Failed to send result photo");
        }

        logger.info(`Result sent successfully to chat ${chatId}`);
        return { success: true, data: data.result };
    } catch (error) {
        logger.error(`Exception in sendResult for chat ${chatId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to send result" };
    }
}
