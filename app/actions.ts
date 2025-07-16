// /app/actions.ts
"use server"; 

import {
  generateCarEmbedding, 
  supabaseAdmin, 
  fetchUserData as dbFetchUserData, 
  updateUserMetadata as dbUpdateUserMetadata, // <--- ВОССТАНОВЛЕН АЛИАС
  uploadImage, 
} from "@/hooks/supabase"; 
import axios from "axios";
import { verifyJwtToken, generateJwtToken } from "@/lib/auth"; 
import { logger } from "@/lib/logger"; 
import type { WebAppUser } from "@/types/telegram";
import { createHash } from "crypto"; 
import { handleWebhookProxy } from "./webhook-handlers/proxy"; 
import { getBaseUrl } from "@/lib/utils"; 
import type { Database } from "@/types/database.types";
import { Bucket } from '@supabase/storage-js'; 
import { v4 as uuidv4 } from 'uuid'; 

type User = Database["public"]["Tables"]["users"]["Row"];
type UserSettings = User['metadata']; 

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = "413553377"; 
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || DEFAULT_CHAT_ID;
const COZE_API_KEY = process.env.COZE_API_KEY;
const COZE_BOT_ID = process.env.COZE_BOT_ID;
const COZE_USER_ID = process.env.COZE_USER_ID;

function checkEnvVars() {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.error("Missing critical environment variable: TELEGRAM_BOT_TOKEN");
  }
  if (!COZE_API_KEY) {
    logger.warn("Missing environment variable: COZE_API_KEY. Coze features may be disabled.");
  }
   if (!COZE_BOT_ID) {
    logger.warn("Missing environment variable: COZE_BOT_ID. analyzeMessage may fail.");
  }
   if (!COZE_USER_ID) {
    logger.warn("Missing environment variable: COZE_USER_ID. analyzeMessage may fail.");
  }
}
checkEnvVars();

interface InlineButton {
  text: string;
  url: string;
}
interface TelegramApiResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}
interface SendPayloadBase {
    chat_id: string;
    reply_markup?: {
        inline_keyboard: Array<Array<{ text: string; url: string }>>;
    };
}
type SendTextPayload = SendPayloadBase & { text: string; parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML' };
type SendPhotoPayload = SendPayloadBase & { photo: string; caption: string; parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML' };
type SendPayload = SendTextPayload | SendPhotoPayload;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function pollCozeChat(conversationId: string, chatId: string, apiKey: string | undefined, maxAttempts = 15, pollInterval = 2000) {
    if (!apiKey) throw new Error("Coze API Key not configured");
    let attempts = 0;
    while (attempts < maxAttempts) {
        try {
            const messagesResponse = await axios.get(
                `https://api.coze.com/v3/chat/message/list?conversation_id=${conversationId}&chat_id=${chatId}`,
                {
                    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
                    timeout: 5000, 
                }
            );
            const assistantMessage = messagesResponse.data?.data?.find( (msg: any) => msg.role === "assistant" && msg.type === "answer" );
            if (assistantMessage?.content) { return assistantMessage.content; }
        } catch(pollError) {
             logger.error(`Error polling Coze chat (Attempt ${attempts + 1}/${maxAttempts}):`, pollError);
             if (axios.isAxiosError(pollError) && pollError.response?.status === 429) {
                 logger.warn("Coze API rate limit hit, backing off...");
                 await delay(pollInterval * 2); 
                 continue; 
             }
        }
        attempts++;
        await delay(pollInterval); 
    }
    throw new Error(`No assistant answer received from Coze after ${maxAttempts} attempts`);
}

function adjustColor(hex: string, amount: number): string {
  try {
      const color = hex.replace("#", "");
      if (!/^[0-9A-F]{6}$/i.test(color)) { throw new Error("Invalid hex color format"); }
      const r = Math.max(0, Math.min(255, parseInt(color.slice(0, 2), 16) + amount));
      const g = Math.max(0, Math.min(255, parseInt(color.slice(2, 4), 16) + amount));
      const b = Math.max(0, Math.min(255, parseInt(color.slice(4, 6), 16) + amount));
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch (error) {
       logger.error(`Failed to adjust color ${hex}:`, error);
      return hex; 
  }
}

export async function handleWebhookUpdate(update: any) {
  if (!update) {
    logger.warn("Received empty webhook update.");
    return;
  }
  try {
    await handleWebhookProxy(update);
  } catch (error) {
    logger.error("Error processing webhook update in handleWebhookProxy:", error);
  }
}

export async function sendTelegramMessage(
  message: string,
  buttons: InlineButton[] = [],
  imageUrl?: string,
  chatId?: string,
  carId?: string 
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured" };
  }
  const finalChatId = chatId || ADMIN_CHAT_ID;
  try {
    let finalMessage = message;
    if (carId) {
      const { data: car, error } = await supabaseAdmin.from("cars").select("make, model, daily_price").eq("id", carId).single();
      if (error) logger.error(`Failed to fetch car ${carId} for message: ${error.message}`);
      else if (car) finalMessage += `\n\nCar: ${car.make} ${car.model}\nDaily Price: ${car.daily_price} XTR`;
    }
    const payload: SendPayload = imageUrl ? { chat_id: finalChatId, photo: imageUrl, caption: finalMessage, parse_mode: "Markdown" } : { chat_id: finalChatId, text: finalMessage, parse_mode: "Markdown" };
    if (buttons.length > 0) payload.reply_markup = { inline_keyboard: [buttons.map((button) => ({ text: button.text, url: button.url }))] };
    const endpoint = imageUrl ? "sendPhoto" : "sendMessage";
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data: TelegramApiResponse = await response.json();
    if (!data.ok) { logger.error(`Telegram API error (${endpoint}): ${data.description || "Unknown error"}`, { chatId: finalChatId, errorCode: data.error_code, payload }); throw new Error(data.description || `Failed to ${endpoint}`); }
    return { success: true, data: data.result };
  } catch (error) {
    logger.error(`Error in sendTelegramMessage (${chatId || ADMIN_CHAT_ID}):`, error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred while sending Telegram message" };
  }
}

export async function sendTelegramDocument(chatId: string, fileContent: string, fileName: string): Promise<{ success: boolean; data?: any; error?: string }> {
   if (!TELEGRAM_BOT_TOKEN) return { success: false, error: "Telegram bot token not configured" };
  try {
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", blob, fileName);
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, { method: "POST", body: formData });
    const data: TelegramApiResponse = await response.json();
    if (!data.ok) { logger.error(`Telegram API error (sendDocument): ${data.description || "Unknown error"}`, { chatId, errorCode: data.error_code }); throw new Error(data.description || "Failed to send document"); }
    return { success: true, data: data.result };
  } catch (error) {
     logger.error(`Error in sendTelegramDocument (${chatId}):`, error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred while sending document" };
  }
}

export async function sendTelegramInvoice(chatId: string, title: string, description: string, payload: string, amount: number, subscription_id: number = 0, photo_url?: string): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) { return { success: false, error: "Telegram bot token not configured" }; }
  const PROVIDER_TOKEN = ""; const currency = "XTR"; const prices = [{ label: title, amount: amount }]; 
  const requestBody: Record<string, any> = { chat_id: chatId, title, description, payload, provider_token: PROVIDER_TOKEN, currency, prices, start_parameter: "pay" };
  if (photo_url) Object.assign(requestBody, { photo_url, photo_size: 600, photo_width: 600, photo_height: 400 });
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendInvoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    const data: TelegramApiResponse = await response.json();
    if (!data.ok) { logger.error(`Telegram API error (sendInvoice): ${data.description || "Unknown error"}`, { chatId, payload, errorCode: data.error_code }); throw new Error(`Telegram API error: ${data.description || "Failed to send invoice"}`);}
    try { await supabaseAdmin.from("invoices").insert({ id: payload, user_id: chatId, amount: amount, type: payload.split("_")[0], status: "pending", metadata: { description, title }, subscription_id: subscription_id || null }); } catch (dbError: any) { logger.error(`Failed to save invoice ${payload} to DB after sending: ${dbError.message}`); }
    return { success: true, data: data.result };
  } catch (error) {
    logger.error("Error in sendTelegramInvoice:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to send invoice" };
  }
}

export async function confirmPayment(preCheckoutQueryId: string): Promise<{ success: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) { return { success: false, error: "Telegram bot token not configured" }; }
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pre_checkout_query_id: preCheckoutQueryId, ok: true }) });
    const result: TelegramApiResponse = await response.json();
    if (!result.ok) { logger.error(`Telegram API error (answerPreCheckoutQuery): ${result.description}`, { preCheckoutQueryId, errorCode: result.error_code }); throw new Error(result.description || "Failed to answer pre-checkout query"); }
    logger.info(`Pre-checkout query ${preCheckoutQueryId} confirmed successfully.`);
    return { success: true };
  } catch (error) {
     logger.error(`Error confirming payment (preCheckoutQueryId: ${preCheckoutQueryId}):`, error);
     return { success: false, error: error instanceof Error ? error.message : "Failed to confirm payment" };
  }
}

export async function notifyAdmin(message: string): Promise<{ success: boolean; error?: string }> {
  const result = await sendTelegramMessage(message, [], undefined, ADMIN_CHAT_ID);
  if (!result.success) { logger.error(`Failed to notify primary admin (${ADMIN_CHAT_ID}): ${result.error}`); }
  return { success: result.success, error: result.error };
}

export async function notifyAdmins(message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: admins, error } = await supabaseAdmin.from("users").select("user_id").eq("status", "admin"); 
    if (error) { logger.error("Failed to fetch admins for notification:", error); throw error; }
    if (!admins || admins.length === 0) { logger.warn("No admins found to notify."); return { success: true }; }
    let allSuccessful = true;
    for (const admin of admins) {
      const result = await sendTelegramMessage(message, [], undefined, admin.user_id);
      if (!result.success) { allSuccessful = false; logger.error(`Failed to notify admin ${admin.user_id}: ${result.error}`); }
    }
    return { success: allSuccessful, error: allSuccessful ? undefined : "Failed to notify one or more admins" };
  } catch (error) {
     logger.error("Error notifying admins:", error);
     return { success: false, error: error instanceof Error ? error.message : "Failed to fetch or notify admins" };
  }
}

export async function notifyCarAdmin(carId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: car, error } = await supabaseAdmin.from("cars").select("owner_id, image_url, make, model").eq("id", carId).maybeSingle();
    if (error) { logger.error(`Error fetching car ${carId} for notification:`, error); return { success: false, error: `Failed to fetch car: ${error.message}` }; }
    if (!car) { logger.warn(`Car ${carId} not found for notification.`); return { success: false, error: `Car with ID ${carId} not found.` }; }
    if (!car.owner_id) { logger.warn(`Car ${carId} has no owner_id set for notification.`); return { success: true }; }
    const adminId = car.owner_id; const baseUrl = getBaseUrl(); const fullMessage = `${message}\nCar: ${car.make || 'N/A'} ${car.model || 'N/A'}`; const buttons = [{ text: "View Car", url: `${baseUrl}/rent/${carId}` }];
    const result = await sendTelegramMessage( fullMessage, buttons, car.image_url, adminId );
    if (!result.success) { logger.error(`Failed to notify car admin ${adminId} for car ${carId}: ${result.error}`); }
    return { success: result.success, error: result.error };
  } catch (error) {
      logger.error(`Unexpected error in notifyCarAdmin for car ${carId}:`, error);
       return { success: false, error: error instanceof Error ? error.message : "Unexpected error notifying car admin" };
  }
}

export async function superNotification(message: string): Promise<{ success: boolean; error?: string }> {
   try {
    const { data: owners, error } = await supabaseAdmin.from("cars").select("owner_id", { count: 'exact', head: false }).neq("owner_id", null)
      .then(response => { if (response.error) return response; const distinctOwners = Array.from(new Set(response.data?.map(o => o.owner_id))); return { data: distinctOwners.map(id => ({ owner_id: id })), error: null }; });
    if (error) { logger.error("Error fetching distinct car owners for super notification:", error); throw error; }
    if (!owners || owners.length === 0) { logger.warn("No car owners found for super notification."); return { success: true }; }
    logger.info(`Sending super notification to ${owners.length} owners.`);
    let allSuccessful = true;
    for (const owner of owners) { if (!owner.owner_id) continue; const result = await sendTelegramMessage(message, [], undefined, owner.owner_id); if (!result.success) { allSuccessful = false; logger.error(`Failed to send super notification to owner ${owner.owner_id}: ${result.error}`); }}
    return { success: allSuccessful, error: allSuccessful ? undefined : "Failed to send super notification to one or more owners" };
   } catch(error) {
       logger.error("Error sending super notification:", error);
       return { success: false, error: error instanceof Error ? error.message : "Failed to send super notification" };
   }
}

export async function broadcastMessage(message: string, role?: User['role']): Promise<{ success: boolean; error?: string }> {
  try {
    let query = supabaseAdmin.from("users").select("user_id"); if (role) { query = query.eq("role", role); }
    const { data: users, error } = await query;
    if (error) { logger.error(`Error fetching users for broadcast (role: ${role || 'all'}):`, error); throw error; }
    if (!users || users.length === 0) { logger.warn(`No users found for broadcast (role: ${role || 'all'}).`); return { success: true }; }
    logger.info(`Broadcasting message to ${users.length} users (role: ${role || 'all'}).`);
    let allSuccessful = true;
    for (const user of users) { if (!user.user_id) continue; const result = await sendTelegramMessage(message, [], undefined, user.user_id); if (!result.success) { allSuccessful = false; logger.error(`Failed to broadcast message to user ${user.user_id}: ${result.error}`); } await delay(50); }
    return { success: allSuccessful, error: allSuccessful ? undefined : "Failed to broadcast message to one or more users" };
  } catch (error) {
      logger.error("Error during broadcast:", error);
       return { success: false, error: error instanceof Error ? error.message : "Failed to broadcast message" };
  }
}

export async function notifyCaptchaSuccess(userId: string, username?: string | null): Promise<{ success: boolean; error?: string }> {
  const message = `🔔 Пользователь ${username || userId} (${userId}) успешно прошел CAPTCHA.`;
  return notifyAdmins(message);
}

export async function notifySuccessfulUsers(userIds: string[]) {
  try {
    const message = `🎉 Поздравляем! Вы успешно прошли CAPTCHA и можете продолжить. 🚀`;
    for (const userId of userIds) { const result = await sendTelegramMessage( message, [], undefined, userId ); if (!result.success) { console.error(`Failed to notify user ${userId}:`, result.error); }}
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to notify users" };
  }
}

export async function notifyUsers(userIds: string[], message: string): Promise<{ success: boolean; error?: string }> {
  if (!userIds || userIds.length === 0) { return { success: true }; }
  logger.info(`Notifying ${userIds.length} users.`);
  let allSuccessful = true;
  try {
    for (const userId of userIds) { const result = await sendTelegramMessage(message, [], undefined, userId); if (!result.success) { allSuccessful = false; logger.error(`Failed to notify user ${userId}:`, result.error); } await delay(50); }
    return { success: allSuccessful, error: allSuccessful ? undefined : "Failed to notify one or more users" };
  } catch (error) {
     logger.error("Error notifying multiple users:", error);
     return { success: false, error: error instanceof Error ? error.message : "Failed to notify users" };
  }
}

export async function notifyWinners(winningNumber: number, winners: User[]): Promise<{ success: boolean; error?: string }> {
  if (!winners || winners.length === 0) { logger.info("Wheel of Fortune: No winners to notify."); return { success: true }; }
  try {
    const winnerNotificationMessage = `🎉 Congratulations! Your lucky number ${winningNumber} has been drawn in the Wheel of Fortune! You are a winner! 🏆`;
    let allWinnersNotified = true;
    for (const winner of winners) { if (!winner.user_id) continue; const result = await sendTelegramMessage(winnerNotificationMessage, [], undefined, winner.user_id); if (!result.success) { allWinnersNotified = false; logger.error(`Failed to notify winner ${winner.user_id}: ${result.error}`); } await delay(50); }
    const winnerNames = winners.map((w) => w.username || w.full_name || w.user_id).join(", ");
    const adminMessage = `🎮 Wheel of Fortune Results:\nWinning Number: ${winningNumber}\nWinners (${winners.length}): ${winnerNames}`;
    const adminNotifyResult = await notifyAdmin(adminMessage); 
    return { success: allWinnersNotified && adminNotifyResult.success, error: !allWinnersNotified || !adminNotifyResult.success ? "Failed to notify some winners or admin" : undefined };
  } catch (error) {
    logger.error("Error notifying winners:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to notify winners" };
  }
}

export async function executeCozeAgent(botId: string, userId: string, content: string, metadata?: Record<string, any>): Promise<{ success: boolean; data?: string; error?: string }> {
    if (!COZE_API_KEY) return { success: false, error: "Coze API Key not configured" };
    try {
        const initResponse = await axios.post("https://api.coze.com/v3/chat", { bot_id: botId, user_id: userId, stream: false, auto_save_history: true, additional_messages: [{ role: "user", content: content, content_type: "text" }], }, { headers: { Authorization: `Bearer ${COZE_API_KEY}`, "Content-Type": "application/json" }, timeout: 10000 });
        const chatId = initResponse.data?.data?.id; const conversationId = initResponse.data?.data?.conversation_id;
        if (!chatId || !conversationId) { logger.error("Missing chat ID or conversation ID in Coze init response:", initResponse.data); throw new Error("Missing chat ID or conversation ID in Coze initial response"); }
        const assistantAnswer = await pollCozeChat(conversationId, chatId, COZE_API_KEY);
        const { error: insertError } = await supabaseAdmin.from("coze_responses").insert({ bot_id: botId, user_id: userId, request_content: content, response_content: assistantAnswer, metadata: metadata || {}, coze_conversation_id: conversationId, coze_chat_id: chatId });
        if (insertError) { logger.error("Failed to save Coze response to DB:", insertError); }
        return { success: true, data: assistantAnswer }; 
    } catch (error) {
        logger.error(`Coze execution failed (Bot: ${botId}, User: ${userId}):`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to execute Coze agent" };
    }
}

export async function runCozeAgent(botId: string, userId: string, content: string): Promise<{ success: boolean; data?: string; error?: string }> {
     if (!COZE_API_KEY) return { success: false, error: "Coze API Key not configured" };
    try {
        const initResponse = await axios.post("https://api.coze.com/v3/chat", { bot_id: botId, user_id: userId, stream: false, auto_save_history: true, additional_messages: [{ role: "user", content: content, content_type: "text" }], }, { headers: { Authorization: `Bearer ${COZE_API_KEY}`, "Content-Type": "application/json" }, timeout: 10000 });
        const chatId = initResponse.data?.data?.id; const conversationId = initResponse.data?.data?.conversation_id;
        if (!chatId || !conversationId) { logger.error("Missing chat ID or conversation ID in Coze init response:", initResponse.data); throw new Error("Missing chat ID or conversation ID in Coze initial response"); }
        const assistantAnswer = await pollCozeChat(conversationId, chatId, COZE_API_KEY);
        return { success: true, data: assistantAnswer };
    } catch (error) {
        logger.error(`Error running Coze agent (Bot: ${botId}, User: ${userId}):`, error);
         return { success: false, error: error instanceof Error ? error.message : "Failed to run Coze agent" };
    }
}

export async function analyzeMessage(content: string): Promise<{ success: boolean; data?: { bullshit_percentage: number; emotional_comment: string; analyzed_content: string; content_summary: string; animation: string; }; error?: string; }> {
    const botId = COZE_BOT_ID; const userId = COZE_USER_ID;
    if (!botId || !userId) { return { success: false, error: "Coze Bot ID or User ID for analysis not configured" }; }
    if (!COZE_API_KEY) return { success: false, error: "Coze API Key not configured" };
    try {
        logger.info(`Analyzing message with Coze Bot ${botId}...`);
        const agentResult = await runCozeAgent(botId, userId, content);
        if (!agentResult.success || !agentResult.data) { throw new Error(agentResult.error || "Failed to get response from Coze analysis agent"); }
        const assistantAnswer = agentResult.data; logger.debug("Raw response from Coze analysis bot:", assistantAnswer);
        let parsedData;
        try { parsedData = JSON.parse(assistantAnswer); } catch (e) { logger.warn('Coze assistant content is not valid JSON, treating as plain text:', assistantAnswer); return { success: true, data: { bullshit_percentage: 50, emotional_comment: assistantAnswer, analyzed_content: content, content_summary: "No summary available (response not JSON).", animation: "neutral" } }; }
        const resultData = { bullshit_percentage: typeof parsedData.bullshit_percentage === 'number' ? parsedData.bullshit_percentage : 50, emotional_comment: parsedData.emotional_comment || "Analysis comment missing.", analyzed_content: parsedData.analyzed_content || content, content_summary: parsedData.content_summary || "No summary available.", animation: parsedData.animation || "neutral" };
        logger.info(`Message analysis successful.`);
        return { success: true, data: resultData };
    } catch (error) {
        logger.error('Error analyzing message:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to analyze message' };
    }
}

export async function generateEmbeddings(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { count, error: fetchError } = await supabaseAdmin.from("cars").select("id", { count: 'exact', head: true }).is("embedding", null);
    if (fetchError) { logger.error("Error fetching count of cars needing embeddings:", fetchError); throw fetchError; }
    if (!count || count === 0) { logger.info("No cars found needing embedding generation."); return { success: true, message: "No cars needed embeddings." }; }
    logger.info(`Found ${count} cars needing embeddings. Triggering batch generation...`);
    const result = await generateCarEmbedding('batch'); 
    logger.info(`Triggered embedding generation for ${count} cars. Result:`, result);
    return { success: true, message: `Triggered embedding generation for ${count} cars. ${result.message}` };
  } catch (error) {
     logger.error("Error in generateEmbeddings action:", error);
     return { success: false, error: error instanceof Error ? error.message : "Failed to trigger embedding generation" };
  }
}

export async function findSimilarCars(embedding: number[], limit: number = 3): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!embedding || embedding.length === 0) { return { success: false, error: "Invalid embedding provided" }; }
    try {
        const { data, error } = await supabaseAdmin.rpc("search_cars", { query_embedding: embedding, match_count: limit });
        if (error) { logger.error("Error searching for similar cars:", error); throw error; }
        const formattedData = data?.map((car: any) => ({ ...car, similarity: car.similarity ? Math.round(car.similarity * 100) : 0 })) || [];
        return { success: true, data: formattedData };
    } catch (error) {
        logger.error("Error in findSimilarCars action:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to find similar cars" };
    }
}

export async function createOrUpdateUser(userInfo: WebAppUser): Promise<{ success: boolean; data?: User; error?: string }> {
    if (!userInfo?.id) { return { success: false, error: "Invalid user info provided" }; }
    const userId = userInfo.id.toString();
    try {
        const user = await supabaseAdmin // Directly use supabaseAdmin
            .from("users")
            .upsert({ 
                user_id: userId, 
                username: userInfo.username || null,
                full_name: `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() || null,
                avatar_url: userInfo.photo_url || null,
                language_code: userInfo.language_code || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })
            .select("*, metadata")
            .single();

        if (user.error) throw user.error;
        if (!user.data) throw new Error("Failed to create or update user in database.");
        
        logger.info(`User ${user.data.username || userId} created or updated successfully.`);
        await notifyAdmin(`User registered/updated: ${user.data.username || userId} (${userId})`);
        return { success: true, data: user.data };
    } catch (error) {
        logger.error(`Error creating/updating user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create or update user" };
    }
}

export async function authenticateUser(chatId: string, userInfo?: Partial<WebAppUser>): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
        const { data: user, error: upsertError } = await supabaseAdmin // Directly use supabaseAdmin
            .from("users") 
            .upsert({ 
                user_id: chatId, 
                username: userInfo?.username || null,
                full_name: `${userInfo?.first_name || ""} ${userInfo?.last_name || ""}`.trim() || null,
                avatar_url: userInfo?.photo_url || null,
                language_code: userInfo?.language_code || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })
            .select("*, metadata")
            .single();

        if (upsertError) throw upsertError;
        if (!user) throw new Error("Failed to create or update user during authentication.");
        
        const token = await generateJwtToken(chatId); 
        logger.info(`User ${chatId} authenticated successfully.`);
        return { success: true, user, token };
    } catch (error) {
        logger.error(`Authentication failed for user ${chatId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Authentication failed" };
    }
}

export async function validateToken(token: string): Promise<{ success: boolean; user?: User | null; error?: string }> {
  try {
    const decoded = verifyJwtToken(token); 
    if (!decoded || !decoded.sub) { logger.warn("Token validation failed: Invalid or expired token."); return { success: false, error: "Invalid or expired token", user: null }; }
    const user = await dbFetchUserData(decoded.sub); // Uses supabaseAdmin internally
    if (!user) { logger.warn(`Token valid but user ${decoded.sub} not found in database.`); return { success: false, error: "User not found", user: null }; }
    logger.info(`Token validated successfully for user ${user.user_id}.`);
    return { success: true, user };
  } catch (error) {
     logger.error("Error during token validation:", error);
     if (error instanceof Error && (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError')) { return { success: false, error: `Token validation failed: ${error.message}`, user: null }; }
    return { success: false, error: error instanceof Error ? error.message : "Failed to validate token", user: null };
  }
}

interface CaptchaSettings { string_length: number; character_set: "letters" | "numbers" | "both"; case_sensitive: boolean; noise_level: number; font_size: number; background_color: string; text_color: string; distortion: number; }

export async function generateCaptcha(settings: CaptchaSettings): Promise<{ success: boolean; data?: { image: string; hash: string; text: string }; error?: string; }> {
    try {
        if (settings.string_length <= 0 || settings.noise_level < 0 || settings.font_size < 10 || settings.distortion < 0 || settings.distortion > 1) { throw new Error("Invalid CAPTCHA settings provided.");}
        const chars = settings.character_set === "letters" ? "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" : settings.character_set === "numbers" ? "0123456789" : "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const captchaText = Array.from({ length: settings.string_length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        const width = Math.max(200, settings.string_length * (settings.font_size * 0.8) + 60); const height = Math.max(60, settings.font_size + 40); 
        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background-color: ${settings.background_color};">`;
        for (let i = 0; i < settings.noise_level / 5; i++) { const x1 = Math.random() * width; const y1 = Math.random() * height; const x2 = Math.random() * width; const y2 = Math.random() * height; svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${adjustColor(settings.text_color, 80)}" stroke-width="1" opacity="0.5" />`; }
        const textY = height / 2 + settings.font_size / 3; 
        for (let i = 0; i < captchaText.length; i++) { const x = 30 + i * (settings.font_size * 0.8); const rotation = (Math.random() - 0.5) * settings.distortion * 45; const charColor = adjustColor(settings.text_color, Math.random() * 40 - 20); svg += `<text x="${x}" y="${textY}" font-family="monospace" font-size="${settings.font_size}" fill="${charColor}" transform="rotate(${rotation}, ${x}, ${textY})">${captchaText[i]}</text>`; }
        svg += `</svg>`;
        const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
        const referenceHash = createHash("sha256").update(settings.case_sensitive ? captchaText : captchaText.toLowerCase()).digest("hex");
        return { success: true, data: { image, hash: referenceHash, text: captchaText } };
    } catch (error) {
         logger.error("Error generating CAPTCHA:", error);
         return { success: false, error: error instanceof Error ? error.message : "Failed to generate CAPTCHA" };
    }
}

export async function verifyCaptcha(correctText: string, userInput: string, caseSensitive: boolean): Promise<boolean> {
    if (!correctText || userInput === null || userInput === undefined) { return false; }
    if (caseSensitive) { return correctText === userInput; } else { return correctText.toLowerCase() === userInput.toLowerCase(); }
}

export async function sendDonationInvoice(chatId: string, amount: number, message: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (isNaN(amount) || amount <= 0) { return { success: false, error: "Invalid donation amount." }; }
        const finalAmount = amount; const invoicePayload = `donation_${chatId}_${Date.now()}`; const title = "Donation to Leha"; const description = `Thank you for your support! Message: ${message || "No message"}`;
        const invoiceResult = await sendTelegramInvoice( chatId, title, description, invoicePayload, finalAmount, 0, undefined );
        if (!invoiceResult.success) { throw new Error(invoiceResult.error || "Failed to send donation invoice via Telegram"); }
        const adminMessage = `💸 New donation attempt!\nAmount: ${amount} XTR\nFrom Chat ID: ${chatId}\nMessage: ${message || "None"}`;
        await notifyAdmin(adminMessage); 
        return { success: true };
    } catch (error) {
        logger.error("Error in sendDonationInvoice:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to process donation request" };
    }
}

export async function updateCarStatus(carId: string, newStatus: string): Promise<{ success: boolean; error?: string }> {
    try {
        const allowedStatuses = ["available", "rented", "maintenance", "unavailable"];
        if (!allowedStatuses.includes(newStatus)) { return { success: false, error: `Invalid car status: ${newStatus}` }; }
        const { error: updateError } = await supabaseAdmin.from("cars").update({ status: newStatus }).eq("id", carId);
        if (updateError) { logger.error(`Error updating status for car ${carId}:`, updateError); throw updateError; }
        logger.info(`Car ${carId} status updated to ${newStatus}. Notifying owner...`);
        const notifyResult = await notifyCarAdmin(carId, `🚗 Your car status has been updated to: ${newStatus}`);
        if (!notifyResult.success) { logger.warn(`Failed to notify owner after updating status for car ${carId}: ${notifyResult.error}`); }
        return { success: true };
    } catch (error) {
         logger.error(`Failed to update status for car ${carId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update car status" };
    }
}

export async function checkInvoiceStatus(token: string, invoiceId: string): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
        const validationResult = await validateToken(token);
        if (!validationResult.success || !validationResult.user) { return { success: false, error: validationResult.error || "Unauthorized", status: undefined }; }
        const { data, error } = await supabaseAdmin.from("invoices").select("status, user_id").eq("id", invoiceId).maybeSingle(); 
        if (error) { logger.error(`Error fetching invoice ${invoiceId} status:`, error); throw error; }
        if (!data) { return { success: false, error: "Invoice not found", status: undefined }; }
        return { success: true, status: data.status };
    } catch (error) {
        logger.error(`Error checking invoice ${invoiceId} status:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch invoice status", status: undefined };
    }
}

export async function setTelegramWebhook(): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) { return { success: false, error: "Telegram bot token not configured" }; }
  const webhookUrl = `${getBaseUrl()}/api/telegramWebhook`; 
  logger.info(`Setting Telegram webhook to: ${webhookUrl}`);
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: webhookUrl }) });
    const result: TelegramApiResponse = await response.json();
    if (!result.ok) { logger.error(`Failed to set Telegram webhook: ${result.description}`, { errorCode: result.error_code }); throw new Error(result.description || "Failed to set webhook"); }
    logger.info("Telegram webhook set successfully:", result.result);
    return { success: true, data: result.result };
  } catch (error) {
     logger.error("Error setting Telegram webhook:", error);
     return { success: false, error: error instanceof Error ? error.message : "Failed to set webhook" };
  }
}

export async function uploadBatchImages(formData: FormData): Promise<{ success: boolean; data?: { name: string; url: string; error?: undefined }[]; error?: string; failed?: { name: string; error: string }[] }> {
    try {
        const bucketName = formData.get("bucketName") as string; const files = formData.getAll("files") as File[];
        if (!bucketName) { return { success: false, error: "Bucket name is required." }; }
        if (!files || files.length === 0) { return { success: false, error: "No files selected for upload." }; }
        try { const { data: bucketData, error: bucketGetError } = await supabaseAdmin.storage.getBucket(bucketName); if (bucketGetError) throw bucketGetError;  if (!bucketData) throw new Error(`Bucket '${bucketName}' not found.`); if (!bucketData.public) throw new Error(`Bucket '${bucketName}' must be public.`); } catch (bucketCheckError) { const errorMsg = bucketCheckError instanceof Error ? bucketCheckError.message : "Failed to verify bucket"; logger.error(`Bucket check failed for ${bucketName}:`, errorMsg); return { success: false, error: `Bucket check failed: ${errorMsg}` }; }
        const uploadPromises = files.map(async (file) => {
            const fileExt = file.name.split('.').pop(); const filePath = `${file.name.replace(/\.[^/.]+$/, "")}-${uuidv4()}.${fileExt}`;
            try {
                const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from(bucketName).upload(filePath, file, { cacheControl: '3600', upsert: false });
                if (uploadError) { throw uploadError; } if (!uploadData?.path) { throw new Error("Upload succeeded but path is missing."); }
                const { data: urlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(uploadData.path); 
                if (!urlData?.publicUrl) { throw new Error("Could not get public URL after upload."); }
                return { name: file.name, url: urlData.publicUrl };
            } catch (uploadError) { const errorMsg = uploadError instanceof Error ? uploadError.message : "Unknown upload error"; logger.error(`Failed to upload file ${file.name} to ${bucketName}/${filePath}:`, errorMsg); return { name: file.name, error: errorMsg }; }
        });
        const results = await Promise.all(uploadPromises);
        const successfulUploads = results.filter(r => r && 'url' in r) as { name: string; url: string }[];
        const uploadErrors = results.filter(r => r && 'error' in r) as { name: string; error: string }[];
        if (successfulUploads.length === 0 && uploadErrors.length > 0) { return { success: false, error: `All ${files.length} uploads failed. First error: ${uploadErrors[0]?.error ?? 'Unknown'}`, failed: uploadErrors }; }
        else if (uploadErrors.length > 0) { return { success: true, data: successfulUploads, error: `${uploadErrors.length} out of ${files.length} uploads failed.`, failed: uploadErrors }; }
        else if (successfulUploads.length === 0 && uploadErrors.length === 0) { return { success: false, error: "Upload process completed without any results." }; }
        return { success: true, data: successfulUploads };
    } catch (error) {
        logger.error("Critical error in uploadBatchImages:", error);
        const errorMsg = error instanceof Error ? error.message : "Batch image upload failed due to an unexpected error.";
        return { success: false, error: errorMsg };
    }
}

export async function listPublicBuckets(): Promise<{ success: boolean; data?: Bucket[]; error?: string }> {
    try {
        const { data, error } = await supabaseAdmin.storage.listBuckets(); if (error) throw error;
        const publicBuckets = data.filter(bucket => bucket.public);
        return { success: true, data: publicBuckets };
    } catch (error) {
        logger.error("Failed to list public buckets:", error);
        const errorMsg = error instanceof Error ? error.message : "Could not fetch public buckets";
        return { success: false, error: errorMsg };
    }
}

// Corrected function to merge settings properly
export async function updateUserSettings(userId: string, partialSettingsToUpdate: Partial<UserSettings>): Promise<{ success: boolean; error?: string }> {
  if (!userId) { return { success: false, error: "User ID is required." }; }
  if (!supabaseAdmin) { 
    logger.error("[updateUserSettings] Supabase admin client is not available.");
    return { success: false, error: "Database client (admin) unavailable." };
  }
  
  try {
    // 1. Fetch current user data, including metadata
    const currentUserData = await dbFetchUserData(userId); // This uses supabaseAdmin
    if (!currentUserData) {
      logger.error(`[updateUserSettings] User ${userId} not found. Cannot update settings.`);
      return { success: false, error: "User not found." };
    }
    
    const currentMetadata = currentUserData.metadata || {};
    
    // 2. Merge current metadata with the partial updates
    const updatedFullMetadata: UserSettings = {
      ...currentMetadata,
      ...partialSettingsToUpdate 
    };
    
    // 3. Update the database with the full, merged metadata object
    const result = await dbUpdateUserMetadata(userId, updatedFullMetadata); // This uses supabaseAdmin as per previous fix
    
    if (result.success) { 
        logger.info(`User settings updated successfully for user ${userId}. New metadata snapshot:`, updatedFullMetadata); 
        return { success: true }; 
    } else { 
        logger.error(`Failed to update user settings for ${userId}: ${result.error}. Attempted to save:`, updatedFullMetadata); 
        return { success: false, error: result.error || "Failed to update settings." }; 
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error during settings update.";
    logger.error(`Exception in updateUserSettings for ${userId}:`, e);
    return { success: false, error: errorMsg };
  }
}

export async function createCrew(crewData: { name: string; description: string; logo_url: string; owner_id: string; }) {
    if (!supabaseAdmin) {
        return { success: false, error: "Admin client is not available." };
    }
    try {
        const { data, error } = await supabaseAdmin
            .from('crews')
            .insert({
                name: crewData.name,
                description: crewData.description,
                logo_url: crewData.logo_url,
                owner_id: crewData.owner_id
            })
            .select()
            .single();

        if (error) throw error;
        
        // Also add the owner as the first member of the crew
        await supabaseAdmin.from('crew_members').insert({
            crew_id: data.id,
            user_id: crewData.owner_id,
            role: 'owner'
        });

        return { success: true, data };
    } catch (error) {
        logger.error("Error creating crew:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getTopFleets() {
    if (!supabaseAdmin) {
        return { success: false, error: "Admin client is not available." };
    }
    try {
        const { data, error } = await supabaseAdmin.rpc('get_top_fleets');
        if (error) throw error;
        return { success: true, data };
    } catch(error) {
        logger.error("Error getting top fleets:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getTopCrews() {
    if (!supabaseAdmin) {
        return { success: false, error: "Admin client is not available." };
    }
    try {
        const { data, error } = await supabaseAdmin.rpc('get_top_crews');
        if (error) throw error;
        return { success: true, data };
    } catch(error) {
        logger.error("Error getting top crews:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
