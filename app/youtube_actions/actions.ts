// (Keep existing actions like sendTelegramMessage, notifyAdmins, etc.)
// No new actions specifically identified *here* for the YouTube Admin pages,
// but ensure `sendTelegramMessage` is robust as it's used by `notifyYtTeam`.
// Ensure `createOrUpdateUser` handles user roles correctly if needed by `notifyYtTeam`.

// --- Paste the FULL content of your existing /app/actions.ts file here ---
// --- including the imports and all functions ---
"use server";

import { generateCarEmbedding, createAuthenticatedClient, supabaseAdmin, supabaseAnon } from "@/hooks/supabase";
import axios from "axios";
import { verifyJwtToken, generateJwtToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { WebAppUser } from "@/types/telegram";
import { createHash, randomBytes } from "crypto";
import { handleWebhookProxy } from "./webhook-handlers/proxy"; // Import the proxy
import { getBaseUrl } from "@/lib/utils";


const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = "413553377"; // Your default Telegram chat ID
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || DEFAULT_CHAT_ID;
// Environment variables for Coze API with hardcoded defaults
const COZE_API_KEY = process.env.COZE_API_KEY;
const COZE_BOT_ID = process.env.COZE_BOT_ID || "7480584293518376966";
const COZE_USER_ID = process.env.COZE_USER_ID || "341503612082";

// Delegate webhook handling to the proxy
export async function handleWebhookUpdate(update: any) {
  await handleWebhookProxy(update);
}

/** Sends a Telegram document to a specified chat */
export async function sendTelegramDocument(
  chatId: string,
  fileContent: string,
  fileName: string
) {
  try {
    const token = TELEGRAM_BOT_TOKEN;
    if (!token) {
      logger.error("Telegram bot token not configured in sendTelegramDocument");
      return { success: false, error: "Telegram bot token not configured" };
      // throw new Error("Telegram bot token not configured"); // Or throw
    }

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", blob, fileName);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
        logger.error(`Telegram sendDocument failed: ${data.description || 'Unknown error'}`, { chatId, fileName });
      throw new Error(data.description || "Failed to send document");
    }
    logger.info(`Telegram document sent successfully to ${chatId}`, { fileName });
    return { success: true, data };
  } catch (error) {
    logger.error("Error in sendTelegramDocument:", { error: error instanceof Error ? error.message : error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

interface InlineButton {
  text: string;
  url?: string; // Standard URL button
  callback_data?: string; // Button that sends data back to your bot
  web_app?: { url: string }; // Button that opens a Web App
}

// More flexible type for inline keyboard rows
type InlineKeyboardRow = Array<{
    text: string;
    url?: string;
    callback_data?: string;
    web_app?: { url: string };
}>;

interface SendMessageOptions {
    chat_id: string;
    text?: string; // Text XOR photo+caption
    photo?: string;
    caption?: string;
    parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';
    reply_markup?: {
        inline_keyboard?: InlineKeyboardRow[];
        // Add other markup options if needed (e.g., ReplyKeyboardMarkup)
    };
    // Add other API parameters like disable_notification, reply_to_message_id etc. if needed
}

// --- Main Telegram Sending Function ---
export async function sendTelegramMessage(options: SendMessageOptions) {
    const token = TELEGRAM_BOT_TOKEN;
    if (!token) {
        logger.error("Telegram bot token not configured in sendTelegramMessage");
        return { success: false, error: "Telegram bot token not configured" };
    }
     if (!options.chat_id) {
        logger.error("sendTelegramMessage requires 'chat_id'.");
        return { success: false, error: "Chat ID is missing." };
    }
     if (!options.text && !options.photo) {
        logger.error("sendTelegramMessage requires either 'text' or 'photo'.");
        return { success: false, error: "Message content (text or photo) is missing." };
    }

    const endpoint = options.photo ? "sendPhoto" : "sendMessage";
    const url = `https://api.telegram.org/bot${token}/${endpoint}`;

    // Clean the payload: remove undefined keys as Telegram API might reject them
    const payload: Record<string, any> = {};
    for (const key in options) {
        if ((options as Record<string, any>)[key] !== undefined) {
            payload[key] = (options as Record<string, any>)[key];
        }
    }
    // Ensure reply_markup is stringified if present
     if (payload.reply_markup) {
         payload.reply_markup = JSON.stringify(payload.reply_markup);
     }


    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            logger.error(`Telegram API error (${endpoint}): ${data.description || 'Unknown error'}`, { chatId: options.chat_id, errorCode: data.error_code });
            throw new Error(data.description || `Failed to send message via ${endpoint}`);
        }

        logger.info(`Telegram message sent successfully via ${endpoint} to ${options.chat_id}`);
        return { success: true, data: data.result }; // Return the message object
    } catch (error) {
        logger.error("Error in sendTelegramMessage fetch/processing:", { error: error instanceof Error ? error.message : error, url, endpoint, chatId: options.chat_id });
        return {
            success: false,
            error: error instanceof Error ? error.message : "An unexpected error occurred while sending message",
        };
    }
}

// --- Simplified Notification Functions (using the main sender) ---

export async function notifyAdmin(message: string, adminChatId?: string) {
    const targetChatId = adminChatId || ADMIN_CHAT_ID;
    if (!targetChatId) {
         logger.warn("Admin Chat ID not set, cannot notify admin.");
         return { success: false, error: "Admin chat ID not configured." };
    }
    logger.info(`Notifying single admin (${targetChatId}): ${message}`);
    return sendTelegramMessage({ chat_id: targetChatId, text: message });
}

export async function notifyAdmins(message: string) {
    logger.info(`Notifying all admins: ${message}`);
     if (!supabaseAdmin) {
         logger.error("Admin client unavailable for notifyAdmins.");
         return { success: false, error: "Database admin client not available." };
     }
    try {
        const { data: admins, error } = await supabaseAdmin
            .from("users")
            .select("user_id")
            .eq("status", "admin"); // Or filter by role === 'admin'

        if (error) {
             logger.error("Failed to fetch admin users:", error);
            throw error;
        }
         if (!admins || admins.length === 0) {
             logger.warn("No admin users found in the database.");
             return { success: true, sentCount: 0, totalAdmins: 0 }; // Not an error, just no one to notify
         }

        let successCount = 0;
        const results = [];
        for (const admin of admins) {
            const result = await sendTelegramMessage({ chat_id: admin.user_id, text: message });
            results.push({ userId: admin.user_id, success: result.success, error: result.error });
            if (result.success) successCount++;
        }
        logger.info(`Admin notification summary: ${successCount}/${admins.length} successful.`);
        // Optionally return detailed results if needed
        return { success: true, sentCount: successCount, totalAdmins: admins.length /*, results */ };

    } catch (error: any) {
        logger.error("Error during notifyAdmins process:", error);
        return { success: false, error: error.message || "Failed to notify admins" };
    }
}


// --- CAPTCHA Functions --- (Seems unrelated to YouTube, keeping as is)
interface CaptchaSettings {
  string_length: number;
  character_set: "letters" | "numbers" | "both";
  case_sensitive: boolean;
  noise_level: number; // 0-100 (lines count)
  font_size: number; // 20-50
  background_color: string; // Hex code
  text_color: string; // Hex code
  distortion: number; // 0-1 (rotation intensity)
}

export async function generateCaptcha(settings: CaptchaSettings) {
  // ... (keep existing implementation) ...
  const chars =
    settings.character_set === "letters"
      ? "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
      : settings.character_set === "numbers"
      ? "0123456789"
      : "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const text = Array.from(
    { length: settings.string_length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");

  const width = Math.max(200, settings.string_length * 40 + 60);
  const height = 80;

  // SVG with gradient background
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${settings.background_color};stop-opacity:1" /><stop offset="100%" style="stop-color:${adjustColor(settings.background_color, -20)};stop-opacity:1" /></linearGradient></defs>`;
  svg += `<rect width="${width}" height="${height}" fill="url(#grad)" />`;

  // Distorted text with shadow
  for (let i = 0; i < text.length; i++) {
    const x = 30 + i * 40;
    const y = height / 2 + settings.font_size / 2;
    const rotation = (Math.random() - 0.5) * settings.distortion * 30; // Degrees
    svg += `<text x="${x}" y="${y}" font-family="Courier New, monospace" font-size="${settings.font_size}" fill="${settings.text_color}" transform="rotate(${rotation}, ${x}, ${y})" filter="url(#shadow)">${text[i]}</text>`;
  }

  // Shadow filter
  svg += `<defs><filter id="shadow"><feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)" /></filter></defs>`;

  // Noise (wavy lines)
  for (let i = 0; i < settings.noise_level / 10; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    svg += `<path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" stroke="rgba(150,150,150,0.5)" stroke-width="1" fill="none" />`;
  }

  svg += `</svg>`;

  const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const hash = createHash("sha256").update(settings.case_sensitive ? text : text.toLowerCase()).digest("hex");
  // Store the actual text (case-preserved) needed for comparison if case_sensitive is true
  const captchaText = text;

  logger.info("Generated CAPTCHA", { length: settings.string_length, caseSensitive: settings.case_sensitive });
  // Return text hash and original text for verification
  return { image, hash, text: captchaText, caseSensitive: settings.case_sensitive };
}

export async function verifyCaptcha(hash: string, userInput: string, originalText: string, caseSensitive: boolean) {
  const textToHash = caseSensitive ? userInput : userInput.toLowerCase();
  const computedHash = createHash("sha256").update(textToHash).digest("hex");
  const hashMatch = computedHash === hash;

  // If case sensitive, also compare original text directly
  const textMatch = caseSensitive ? userInput === originalText : true; // Always true if not case sensitive

  const success = hashMatch && textMatch;
  logger.info("Verified CAPTCHA attempt", { userInput, caseSensitive, hashMatch, textMatch, success });
  return success;
}

function adjustColor(hex: string, amount: number): string {
    // ... (keep existing implementation) ...
  const color = hex.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(color.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(color.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(color.slice(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export async function notifyCaptchaSuccess(userId: string, username?: string | null) {
  logger.info(`Notifying admins about CAPTCHA success for user: ${username || userId}`);
  const message = `🔔 User ${username || userId} successfully passed CAPTCHA.`;
  return notifyAdmins(message); // Use the central notifyAdmins function
}

export async function notifySuccessfulUsers(userIds: string[]) {
  logger.info(`Notifying ${userIds.length} users about successful CAPTCHA.`);
  const message = `🎉 Congratulations! You have successfully passed the CAPTCHA and can now proceed. 🚀`;
  let successCount = 0;
  for (const userId of userIds) {
    const result = await sendTelegramMessage({ chat_id: userId, text: message });
    if (result.success) successCount++;
  }
   logger.info(`CAPTCHA success notification sent to ${successCount}/${userIds.length} users.`);
  return { success: true, sentCount: successCount };
}

// --- Wheel of Fortune --- (Seems unrelated to YouTube, keeping as is)
export async function notifyWinners(winningNumber: number, winners: any[]) {
  logger.info(`Notifying ${winners.length} winners for Wheel of Fortune number ${winningNumber}`);
  let successCount = 0;
  try {
    // Notify each winner
    for (const winner of winners) {
      const result = await sendTelegramMessage({
        chat_id: winner.user_id,
        text: `🎉 Congratulations! Your lucky number ${winningNumber} has been drawn in the Wheel of Fortune! You are a winner! 🏆`,
      });
      if (result.success) successCount++;
    }

    // Notify admin about the winners
    const winnerNames = winners.map((w) => w.username || w.full_name || w.user_id).join(", ") || "None";
    await notifyAdmins( // Use notifyAdmins for consistency
      `🎮 Wheel of Fortune Results:\nWinning Number: ${winningNumber}\nWinners (${winners.length}): ${winnerNames}`
    );

    logger.info(`Winner notification sent to ${successCount}/${winners.length} winners.`);
    return { success: true, sentCount: successCount };
  } catch (error: any) {
    logger.error("Error notifying winners:", error);
    return {
      success: false,
      error: error.message || "Failed to notify winners",
    };
  }
}

// --- Coze AI Integration --- (Seems unrelated to YouTube, keeping as is)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function executeCozeAgent(
  botId: string,
  userId: string,
  content: string,
  metadata?: Record<string, any>
) {
  logger.info(`Executing Coze Agent: botId=${botId}, userId=${userId}`);
  if (!COZE_API_KEY) {
     logger.error("COZE_API_KEY is not configured.");
     return { success: false, error: "Coze API Key not configured." };
  }
  try {
    // Step 1: Initiate the chat with the Coze API
    const initResponse = await axios.post(
      "https://api.coze.com/v3/chat",
      {
        bot_id: botId,
        user_id: userId, // Use provided userId
        stream: false,
        auto_save_history: true, // Consider if history should always be saved
        additional_messages: [{
          role: "user",
          content: content,
          content_type: "text",
        }],
      },
      {
        headers: {
          Authorization: `Bearer ${COZE_API_KEY}`,
          "Content-Type": "application/json",
          "Accept": "*/*", // Added for compatibility as per some API docs
          "Host": "api.coze.com", // Added for compatibility
          "Connection": "keep-alive" // Added for compatibility
        },
         timeout: 15000, // Add a timeout (15 seconds)
      }
    );

    // Check Coze API specific success indicators if available, not just HTTP status
    // Example check (adjust based on actual Coze response structure):
    if (initResponse.data?.code !== 0 || !initResponse.data?.data?.id) {
        logger.error("Coze chat initiation failed:", initResponse.data);
        throw new Error(initResponse.data?.msg || "Failed to initiate Coze chat (check response code/message)");
    }

    const chatId = initResponse.data.data.id;
    const conversationId = initResponse.data.data.conversation_id;

    logger.info(`Coze chat initiated: chatId=${chatId}, conversationId=${conversationId}`);

    // Step 2: Poll for the assistant's response
    let attempts = 0;
    const maxAttempts = 15; // Increased attempts
    const pollInterval = 3000; // Increased interval (3 seconds)

    while (attempts < maxAttempts) {
       await delay(pollInterval); // Wait first
       logger.debug(`Polling Coze messages attempt ${attempts + 1}/${maxAttempts} for chat ${chatId}`);
      const messagesResponse = await axios.get(
        `https://api.coze.com/v3/chat/message/list?conversation_id=${conversationId}&chat_id=${chatId}`,
        {
          headers: {
              Authorization: `Bearer ${COZE_API_KEY}`,
              "Content-Type": "application/json",
              "Accept": "*/*",
              "Host": "api.coze.com",
              "Connection": "keep-alive"
          },
           timeout: 10000, // Timeout for polling request
        }
      );

       // Check Coze API specific success indicators
       if (messagesResponse.data?.code !== 0) {
           logger.warn(`Coze message list polling failed attempt ${attempts + 1}:`, messagesResponse.data);
           // Decide if this is fatal or retryable
           // For now, continue polling
       }

      // Find the first assistant answer message
      const assistantAnswerMsg = messagesResponse.data.data?.find(
        (msg: any) => msg.role === "assistant" && msg.type === "answer"
      );
      const assistantAnswer = assistantAnswerMsg?.content;

      if (assistantAnswer) {
         logger.info(`Coze assistant answer received for chat ${chatId}.`);
        // Step 3: Save the text response to Supabase
        if (!supabaseAdmin) {
            logger.error("Admin client unavailable for saving Coze response.");
            // Return success but indicate DB save failure
            return { success: true, data: assistantAnswer, warning: "Failed to save response to database." };
        }
        try {
            const { error } = await supabaseAdmin
                .from("coze_responses") // Ensure this table exists
                .insert({
                    // id: chatId, // Use chatId or a new UUID? Assuming auto-generated ID
                    chat_id: chatId,
                    conversation_id: conversationId,
                    bot_id: botId,
                    user_id: userId, // User who initiated
                    prompt: content, // Save original prompt
                    response: assistantAnswer, // Store as plain text
                    response_message_id: assistantAnswerMsg?.id, // Store message ID if available
                    metadata: metadata || {}, // Include passed metadata
                 });
             if (error) {
                 logger.error("Failed to save Coze response to Supabase:", error);
                 // Don't throw, return success with warning
                  return { success: true, data: assistantAnswer, warning: "Failed to save response to database." };
             }
             logger.info(`Coze response saved to database for chat ${chatId}.`);
        } catch(dbError) {
             logger.error("Exception saving Coze response to Supabase:", dbError);
              return { success: true, data: assistantAnswer, warning: "Exception while saving response to database." };
        }

        return { success: true, data: assistantAnswer }; // Return the text response
      }

      attempts++;
    }
    logger.warn(`No response from Coze agent after ${maxAttempts} attempts for chat ${chatId}.`);
    throw new Error("No response from Coze agent after maximum attempts");
  } catch (error: any) {
    logger.error("Coze execution failed:", error.response?.data || error.message || error);
    return { success: false, error: error.message || "Failed to execute Coze agent" };
  }
}

// analyzeMessage seems like a specific use-case of executeCozeAgent, could potentially be merged or kept separate
export async function analyzeMessage(content: string) {
  logger.info("Analyzing message with Coze");
  // Use the specific Bot ID and User ID intended for analysis
  const result = await executeCozeAgent(COZE_BOT_ID, COZE_USER_ID, content);

  if (!result.success || !result.data) {
    logger.error("Coze agent execution failed during analysis:", result.error);
    // Return default/error structure
    return {
      success: false,
      error: result.error || "Analysis failed",
      bullshit_percentage: 50,
      emotional_comment: "Analysis failed.",
      analyzed_content: content,
      content_summary: "Could not analyze.",
      animation: "neutral",
    };
  }

  // Attempt to parse the result assuming it *should* be JSON for analysis
  let parsedData;
  try {
    parsedData = JSON.parse(result.data);
    logger.info("Coze analysis response parsed successfully.");
  } catch (e) {
    logger.warn('Coze analysis content is not JSON, treating as plain text:', result.data);
    // Return structure with the plain text as the comment
    return {
      success: true, // Agent succeeded, parsing failed
      bullshit_percentage: 50, // Default value
      emotional_comment: result.data, // Use raw text as comment
      analyzed_content: content,
      content_summary: "No structured summary available.",
      animation: "neutral", // Default animation
    };
  }

  // Return the structured data, providing defaults for missing fields
  return {
    success: true,
    bullshit_percentage: parsedData.bullshit_percentage ?? 50,
    emotional_comment: parsedData.emotional_comment ?? "Hmm, interesting...",
    analyzed_content: parsedData.analyzed_content ?? content,
    content_summary: parsedData.content_summary ?? "No summary available.",
    animation: parsedData.animation ?? "neutral",
  };
}


// --- Embeddings --- (Seems car-related, keeping as is)
export const generateEmbeddings = async () => {
  logger.info("Checking for cars needing embeddings.");
   if (!supabaseAdmin) {
         logger.error("Admin client unavailable for generateEmbeddings.");
         return { success: false, error: "Database admin client not available." };
     }
  const { data: cars, error } = await supabaseAdmin
    .from("cars")
    .select("id")
    .is("embedding", null) // Check if embedding is null
    .limit(100); // Process in batches

  if (error) {
     logger.error("Error fetching cars needing embeddings:", error);
     return { success: false, error: error.message };
  }

  if (!cars || cars.length === 0) {
      logger.info("No cars found needing embeddings.");
      return { success: true, message: "No cars needed embedding generation." };
  }

  logger.info(`Found ${cars.length} cars needing embeddings. Triggering batch generation...`);
  // Call the centralized embedding function for batch processing
  const result = await generateCarEmbedding('batch'); // Explicitly call batch mode

  if (!result.success) {
      logger.error("Batch embedding generation failed:", result.error);
  } else {
      logger.info(`Batch embedding generation process finished: ${result.message}`);
  }
  return result;
};


// --- Car Notifications --- (Seems car-related, keeping as is, but uses the main sender)
export async function notifyCarAdmin(carId: string, message: string) {
  logger.info(`Notifying admin about action for car: ${carId}`);
   if (!supabaseAdmin) {
         logger.error("Admin client unavailable for notifyCarAdmin.");
         return { success: false, error: "Database admin client not available." };
     }

  try {
      const { data: car, error } = await supabaseAdmin
        .from("cars")
        .select("owner_id, image_url, make, model") // Fetch make/model for message
        .eq("id", carId)
        .single();

      if (error || !car || !car.owner_id) {
        logger.error("Error fetching car or owner_id for notification:", error || `Car ${carId} not found or has no owner.`);
        return { success: false, error: error?.message || `Car ${carId} not found or missing owner.` };
      }

      const adminId = car.owner_id;
      const baseUrl = getBaseUrl();
      const fullMessage = `${message}\n\nCar: ${car.make} ${car.model}`;
      const buttons: InlineKeyboardRow = [{ text: "View Car", web_app: { url: `${baseUrl}/rent/${carId}` } }]; // Use web_app button

      const result = await sendTelegramMessage({
        chat_id: adminId,
        caption: fullMessage, // Use caption if there's an image
        photo: car.image_url || undefined, // Send photo if available
        text: !car.image_url ? fullMessage : undefined, // Send text only if no photo
        reply_markup: { inline_keyboard: [buttons] },
      });

      if (!result.success) {
        logger.error(`Failed to notify admin ${adminId} for car ${carId}:`, result.error);
      } else {
          logger.info(`Successfully notified admin ${adminId} for car ${carId}.`);
      }
      return result;
  } catch(error: any) {
       logger.error(`Exception in notifyCarAdmin for car ${carId}:`, error);
       return { success: false, error: error.message || "Failed to notify car admin" };
  }
}

export async function superNotification(message: string) {
   logger.info(`Broadcasting super notification: ${message}`);
    if (!supabaseAdmin) {
         logger.error("Admin client unavailable for superNotification.");
         return { success: false, error: "Database admin client not available." };
     }
  try {
      const { data: owners, error } = await supabaseAdmin
        .from("cars") // Assuming notification goes to car owners
        .select("owner_id", { count: 'exact', head: false }) // Get distinct owner IDs
        .neq("owner_id", null); // Filter out null owners
        // .distinct(); // Use select distinct if supported or handle duplicates below

      if (error) {
        logger.error("Error fetching distinct car owners:", error);
        return { success: false, error: error.message };
      }
       if (!owners || owners.length === 0) {
           logger.warn("No car owners found for super notification.");
           return { success: true, sentCount: 0, totalOwners: 0 };
       }

      // Get unique owner IDs
      const uniqueOwnerIds = [...new Set(owners.map(o => o.owner_id))];

      let successCount = 0;
      for (const ownerId of uniqueOwnerIds) {
        const result = await sendTelegramMessage({ chat_id: ownerId, text: message });
         if (result.success) successCount++;
      }
       logger.info(`Super notification sent to ${successCount}/${uniqueOwnerIds.length} unique owners.`);
       return { success: true, sentCount: successCount, totalOwners: uniqueOwnerIds.length };
  } catch (error: any) {
       logger.error("Exception in superNotification:", error);
       return { success: false, error: error.message || "Failed to send super notification" };
  }
}

export async function broadcastMessage(message: string, role?: string) {
    logger.info(`Broadcasting message ${role ? `to role ${role}` : 'to all users'}: ${message}`);
     if (!supabaseAdmin) {
         logger.error("Admin client unavailable for broadcastMessage.");
         return { success: false, error: "Database admin client not available." };
     }
    try {
        let query = supabaseAdmin.from("users").select("user_id");
        if (role) {
            query = query.eq("role", role);
        }

        const { data: users, error } = await query;
        if (error) {
            logger.error("Error fetching users for broadcast:", error);
            return { success: false, error: error.message };
        }
         if (!users || users.length === 0) {
             logger.warn(`No users found ${role ? `with role ${role}` : ''} for broadcast.`);
             return { success: true, sentCount: 0, totalUsers: 0 };
         }

        let successCount = 0;
        for (const user of users) {
            const result = await sendTelegramMessage({ chat_id: user.user_id, text: message });
             if (result.success) successCount++;
        }
         logger.info(`Broadcast sent to ${successCount}/${users.length} users ${role ? `with role ${role}` : ''}.`);
        return { success: true, sentCount: successCount, totalUsers: users.length };
    } catch (error: any) {
         logger.error(`Exception in broadcastMessage ${role ? `to role ${role}` : ''}:`, error);
        return { success: false, error: error.message || "Failed to send broadcast" };
    }
}


// --- Payments & Invoices ---

// Creates an invoice DB record and sends Telegram invoice
export async function sendAndCreateInvoice(options: {
  chatId: string;
  title: string;
  description: string;
  payload: string; // Unique ID for this invoice attempt
  amount: number; // Amount in XTR units
  type: 'subscription' | 'car_rental' | 'donation' | 'script_access' | 'inventory_script_access' | 'support';
  metadata?: Record<string, any>;
  photo_url?: string;
  subscription_id?: number | string | null; // Optional subscription link
}) {
  logger.info(`Sending and creating invoice: type=${options.type}, payload=${options.payload}, chatId=${options.chatId}`);
  const token = TELEGRAM_BOT_TOKEN;
   const providerToken = process.env.TELEGRAM_PROVIDER_TOKEN || ""; // Use env var or "" for XTR

  if (!token) {
      return { success: false, error: "Telegram bot token not configured." };
  }
   if (!options.chatId || !options.title || !options.payload || options.amount == null) {
      return { success: false, error: "Missing required invoice parameters (chatId, title, payload, amount)." };
  }

  try {
    // 1. Send the invoice via Telegram API
     const prices = [{ label: options.title, amount: options.amount }]; // Label should match title or be descriptive
     const tgPayload: Record<string, any> = {
          chat_id: options.chatId,
          title: options.title,
          description: options.description,
          payload: options.payload,
          provider_token: providerToken,
          currency: "XTR",
          prices: prices,
          // Optional fields
          // start_parameter: "pay", // If needed for deep linking
          // need_shipping_address: false,
          // is_flexible: false,
      };
      if (options.photo_url) {
          tgPayload.photo_url = options.photo_url;
          tgPayload.photo_width = 600; // Example size
          tgPayload.photo_height = 400; // Example size
      }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendInvoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tgPayload),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
       logger.error(`Telegram sendInvoice failed: ${result.description || 'Unknown error'}`, { payload: options.payload, chatId: options.chatId });
      throw new Error(result.description || "Failed to send Telegram invoice");
    }
    logger.info(`Telegram invoice sent successfully for payload: ${options.payload}`);

    // 2. Create the invoice record in Supabase
    const dbResult = await createInvoice(
        options.type,
        options.payload, // Use the same payload ID
        options.chatId,
        options.amount,
        options.subscription_id, // Pass along subscription ID if provided
        options.metadata
     );

     if (!dbResult.success) {
         logger.error(`Failed to save invoice ${options.payload} to database after sending: ${dbResult.error}`);
         // Decide how critical DB failure is. Maybe try to void the TG invoice? Difficult.
         // Return success because TG invoice was sent, but include DB error.
         return { success: true, warning: `Telegram invoice sent, but failed to save to database: ${dbResult.error}` };
     }

    // 3. Optional: Notify admin about the invoice attempt (especially for donations/support)
    if (options.type === 'donation' || options.type === 'support') {
        const adminMessage = `🔔 New Invoice Sent:
Type: ${options.type}
Amount: ${options.amount} XTR
To: ${options.chatId} (${options.metadata?.username || 'N/A'})
Payload: ${options.payload}
${options.metadata?.message ? `Message: ${options.metadata.message}` : ''}`;
        await notifyAdmins(adminMessage);
    }

    return { success: true, data: dbResult.data }; // Return created DB invoice data
  } catch (error: any) {
    logger.error(`Error in sendAndCreateInvoice for payload ${options.payload}:`, error);
    return { success: false, error: error.message || "Failed to send or create invoice" };
  }
}

// Function specifically for donations, using the generic sender
export async function sendDonationInvoice(chatId: string, amount: number, message: string, username?: string) {
  const invoicePayload = `donation_${userId}_${Date.now()}`; // More unique payload
  return sendAndCreateInvoice({
    chatId,
    title: "Donation to Leha",
    description: `Thank you for your generous support! ${message || "(No message provided)"}`,
    payload: invoicePayload,
    amount,
    type: "donation",
    metadata: { message: message || null, username: username || null },
  });
}

// Function specifically for support, using the generic sender
export async function sendSupportInvoice(chatId: string, amount: number, description: string, username?: string) {
  const invoicePayload = `support_${userId}_${Date.now()}`; // Unique payload
  return sendAndCreateInvoice({
    chatId,
    title: "Support Request Payment",
    description: description || "Payment for technical support.",
    payload: invoicePayload,
    amount,
    type: "support",
    metadata: { description: description || null, username: username || null },
  });
}

// Confirms payment pre-checkout query
export async function confirmPayment(preCheckoutQueryId: string) {
  logger.info(`Confirming pre-checkout query: ${preCheckoutQueryId}`);
  const token = TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.error("Telegram bot token not configured for confirmPayment.");
    return { success: false, error: "Telegram bot token not configured." };
  }

  const url = `https://api.telegram.org/bot${token}/answerPreCheckoutQuery`;
  try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pre_checkout_query_id: preCheckoutQueryId,
          ok: true, // Confirming is okay
          // error_message: "Optional error message if ok: false"
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
         logger.error(`Failed to answer pre-checkout query ${preCheckoutQueryId}: ${result.description || 'Unknown error'}`);
        throw new Error(result.description || "Failed to confirm payment with Telegram");
      }
      logger.info(`Pre-checkout query ${preCheckoutQueryId} confirmed successfully.`);
      return { success: true, data: result };
  } catch(error: any) {
       logger.error(`Exception confirming pre-checkout query ${preCheckoutQueryId}:`, error);
       return { success: false, error: error.message || "Failed to confirm payment" };
  }
}

// Checks invoice status in DB (useful for polling after payment)
export async function checkInvoiceStatus(invoiceId: string) {
    // No auth token needed if checking via admin client
    logger.debug(`Checking status for invoice: ${invoiceId}`);
    const result = await getInvoiceById(invoiceId); // Uses admin client internally

    if (!result.success) {
        // Error already logged by getInvoiceById
        return { success: false, error: result.error || "Failed to fetch invoice status" };
    }

    logger.debug(`Invoice ${invoiceId} status: ${result.data?.status}`);
    return { success: true, status: result.data?.status }; // Return the status ('pending', 'paid', 'cancelled')
}

// --- Car Status Update ---
export async function updateCarStatus(carId: string, newStatus: string) {
   logger.info(`Updating status for car ${carId} to ${newStatus}`);
    if (!supabaseAdmin) {
         logger.error("Admin client unavailable for updateCarStatus.");
         return { success: false, error: "Database admin client not available." };
     }
  try {
      const { error } = await supabaseAdmin
        .from("cars")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", carId);

      if (error) {
        logger.error(`Error updating car status for ${carId}:`, error);
        return { success: false, error: error.message };
      }

      // Notify owner after successful update
      await notifyCarAdmin(carId, `🚗 Your car status has been updated to: *${newStatus}*`);
      return { success: true };
  } catch (error: any) {
      logger.error(`Exception updating car status for ${carId}:`, error);
      return { success: false, error: error.message || "Failed to update car status" };
  }
}

// --- User Authentication & Management ---
// createOrUpdateUser already exists in hooks/supabase.ts, but we need the action wrapper if called from client

// Action wrapper for createOrUpdateUser from hooks/supabase.ts
export async function createOrUpdateUserAction(user: WebAppUser) {
     if (!user?.id) {
         return { success: false, error: "Invalid user data provided." };
     }
     // Call the function from hooks/supabase.ts
     const dbUser = await createOrUpdateUser(user.id.toString(), user);
     if (!dbUser) {
         // Error logged within createOrUpdateUser
         return { success: false, error: "Failed to create or update user in database." };
     }
      // Notify default admin of new user (moved from original function)
      // Check if it's a genuinely new user if possible before notifying
      // This logic might be complex, maybe notify on every upsert for simplicity or add flags
      await notifyAdmin(`👤 User upserted: ${user.username || user.id} (${user.first_name})`);

     return { success: true, data: dbUser };
}


// Authenticates via Telegram user data, upserts user, generates JWT
export async function authenticateUser(userInfo: WebAppUser) {
  logger.info(`Authenticating user: ${userInfo.username || userInfo.id}`);
   if (!userInfo?.id) {
       return { success: false, error: "Invalid user info provided for authentication." };
   }
  try {
    // Upsert user using the function from hooks/supabase.ts
    const dbUser = await createOrUpdateUser(userInfo.id.toString(), userInfo);
    if (!dbUser) {
        throw new Error("Failed to create or update user during authentication.");
    }

    // Generate JWT token using the user ID from the DB operation
    const token = await generateJwtToken(dbUser.user_id);
     if (!token) {
         throw new Error("Failed to generate JWT token after authentication.");
     }
    logger.info(`Authentication successful for user ${dbUser.username || dbUser.user_id}.`);
    return { success: true, user: dbUser, token };
  } catch (error: any) {
    logger.error(`Authentication failed for user ${userInfo.username || userInfo.id}:`, error);
    return { success: false, error: error.message || "Authentication failed" };
  }
}

// Validates JWT token and fetches corresponding user data
export async function validateToken(token: string) {
  logger.debug("Validating token...");
  if (!token) return { success: false, error: "No token provided.", user: null };

  try {
    const decoded = verifyJwtToken(token); // Verify JWT structure and signature
    if (!decoded || !decoded.sub) {
       logger.warn("Token validation failed: Invalid or expired token structure.");
      return { success: false, error: "Invalid or expired token.", user: null };
    }

    const userId = decoded.sub; // User ID is in 'sub' claim
    logger.debug(`Token valid for userId: ${userId}. Fetching user data...`);

    // Fetch user data using the validated userId
    const user = await fetchUserData(userId); // Uses admin client

    if (!user) {
       logger.warn(`Token valid, but user ${userId} not found in database.`);
      // This could happen if user was deleted after token was issued
      return { success: false, error: "User not found.", user: null };
    }

    logger.info(`Token validation successful for user: ${user.username || user.user_id}`);
    return { success: true, user };
  } catch (error: any) {
    logger.error("Error during token validation:", error);
     if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
         return { success: false, error: `Token validation failed: ${error.message}`, user: null };
     }
    return { success: false, error: "An unexpected error occurred during token validation.", user: null };
  }
}

// Simple wrapper for saveUser - likely deprecated by authenticateUser/createOrUpdateUserAction
export async function saveUser(tgUser: WebAppUser) {
  logger.warn("saveUser action called - consider using createOrUpdateUserAction instead.");
  return createOrUpdateUserAction(tgUser);
}

// Sends result message (likely car result) - Refined to use main sender
export async function sendResult(chatId: string, result: { imageUrl: string; car: { id: string, make: string, model: string }; description: string }) {
  logger.info(`Sending result for car ${result.car.make} ${result.car.model} to chat ${chatId}`);
  try {
    const baseUrl = getBaseUrl();
    const caption = `*${result.car.make} ${result.car.model}*\n${result.description}`;
    const keyboard: InlineKeyboardRow[] = [
        [
          // Use web_app for seamless transition if /rent is part of the web app
          { text: "Rent This Car 🚗", web_app: { url: `${baseUrl}/rent/${result.car.id}` } },
          // Button to reopen the main web app
          { text: "Try Again 🔄", web_app: { url: baseUrl } },
        ],
     ];

    return sendTelegramMessage({
        chat_id: chatId,
        photo: result.imageUrl,
        caption: caption,
        parse_mode: "Markdown", // Ensure correct parse mode
        reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error: any) {
    logger.error("Error sending result message:", error);
    return { success: false, error: error.message || "Failed to send result" };
  }
}

// --- Telegram Webhook Management ---
export async function setTelegramWebhook() {
   logger.info("Attempting to set Telegram webhook...");
  const token = TELEGRAM_BOT_TOKEN;
  const webhookUrl = `${getBaseUrl()}/api/telegramWebhook`; // Ensure this API route exists and handles POST requests

  if (!token) {
     logger.error("Cannot set webhook: TELEGRAM_BOT_TOKEN is missing.");
    return { success: false, error: "Missing TELEGRAM_BOT_TOKEN" };
  }
   if (!webhookUrl.startsWith("https://")) {
       logger.error(`Cannot set webhook: Invalid webhook URL (must be HTTPS): ${webhookUrl}`);
       return { success: false, error: "Webhook URL must be HTTPS" };
   }

  const url = `https://api.telegram.org/bot${token}/setWebhook`;
  try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            url: webhookUrl,
            // Optional: Specify allowed updates to reduce load
            // allowed_updates: ["message", "callback_query", "inline_query", "pre_checkout_query", "shipping_query"]
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
         logger.error(`Failed to set Telegram webhook: ${result.description || 'Unknown error'}`);
        throw new Error(result.description || "Failed to set webhook");
      }
      logger.info(`Telegram webhook set successfully to: ${webhookUrl}`);
      return { success: true, data: result };
  } catch (error: any) {
       logger.error("Exception setting Telegram webhook:", error);
       return { success: false, error: error.message || "Failed to set webhook" };
  }
}

// Placeholder/Example for deleting webhook
export async function deleteTelegramWebhook() {
   logger.info("Attempting to delete Telegram webhook...");
    const token = TELEGRAM_BOT_TOKEN;
    if (!token) {
     logger.error("Cannot delete webhook: TELEGRAM_BOT_TOKEN is missing.");
    return { success: false, error: "Missing TELEGRAM_BOT_TOKEN" };
  }
   const url = `https://api.telegram.org/bot${token}/deleteWebhook`;
    try {
      const response = await fetch(url, { method: "POST" });
      const result = await response.json();
       if (!response.ok || !result.ok) {
         logger.error(`Failed to delete Telegram webhook: ${result.description || 'Unknown error'}`);
        throw new Error(result.description || "Failed to delete webhook");
      }
       logger.info("Telegram webhook deleted successfully.");
      return { success: true, data: result };
   } catch (error: any) {
       logger.error("Exception deleting Telegram webhook:", error);
       return { success: false, error: error.message || "Failed to delete webhook" };
   }
}

// --- Helper to find similar cars (Wrapper around Supabase hook) ---
export async function findSimilarCarsAction(embedding: number[]) {
    logger.debug("Finding similar cars via action");
    // Calls the Supabase helper function
    return findSimilarCars(embedding, 3); // Default limit 3
}

// --- END OF /app/actions.ts ---