"use server";

import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { supabaseAdmin } from '@/hooks/supabase'; 
import { sendTelegramMessage as commonSendTelegramMessage } from '@/app/actions'; 
import { generatePdfBytes } from './pdfGenerator'; // Import the core PDF generation logic

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if ((!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) && process.env.NODE_ENV !== 'test') { 
    logger.error("[topdf/actions.ts] Missing critical environment variables: TELEGRAM_BOT_TOKEN or ADMIN_CHAT_ID.");
}

interface TelegramApiResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

const PDF_FORM_DATA_KEY = 'pdfFormCache'; 

export async function saveUserPdfFormData(
  userId: string,
  formData: { userName?: string; userAge?: string; userGender?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: "User ID is required to save PDF form data." };
  }
  if (!supabaseAdmin) { 
    logger.error("[topdf/actions saveUserPdfFormData] Supabase admin client is not available.");
    return { success: false, error: "Server configuration error (admin client)." };
  }

  try {
    const { data: userData, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('user_id', userId)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') { 
        logger.error(`[topdf/actions saveUserPdfFormData] Error fetching user metadata for ${userId}:`, fetchError);
        return { success: false, error: fetchError.message || "Failed to fetch user data." };
    }
    
    const currentMetadata = userData?.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      [PDF_FORM_DATA_KEY]: formData,
    };

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateError) {
      logger.error(`[topdf/actions saveUserPdfFormData] Failed to save PDF form data for user ${userId}:`, updateError);
      return { success: false, error: updateError.message || "Failed to save PDF form data." };
    }
    
    debugLogger.log(`[topdf/actions saveUserPdfFormData] PDF form data saved for user ${userId}`, formData);
    return { success: true };

  } catch (e: any) {
    logger.error(`[topdf/actions saveUserPdfFormData] Exception for user ${userId}:`, e);
    return { success: false, error: e.message || "Server error saving PDF form data." };
  }
}

export async function loadUserPdfFormData(
  userId: string
): Promise<{ success: boolean; data?: { userName?: string; userAge?: string; userGender?: string }; error?: string }> {
  if (!userId) {
    return { success: false, error: "User ID is required to load PDF form data." };
  }
   if (!supabaseAdmin) { 
    logger.error("[topdf/actions loadUserPdfFormData] Supabase admin client is not available.");
    return { success: false, error: "Server configuration error (admin client)." };
  }

  try {
    const { data: userData, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('user_id', userId)
        .single();
        
    if (fetchError && fetchError.code === 'PGRST116') { 
        debugLogger.log(`[topdf/actions loadUserPdfFormData] User ${userId} not found, no PDF form data to load.`);
        return { success: true, data: undefined }; 
    }
    if (fetchError) { 
        logger.error(`[topdf/actions loadUserPdfFormData] Error fetching user metadata for ${userId}:`, fetchError);
        return { success: false, error: fetchError.message || "Failed to fetch user data." };
    }
    
    const formData = userData.metadata?.[PDF_FORM_DATA_KEY] as { userName?: string; userAge?: string; userGender?: string } | undefined;
    
    if (formData) {
      debugLogger.log(`[topdf/actions loadUserPdfFormData] PDF form data loaded for user ${userId}`, formData);
      return { success: true, data: formData };
    } else {
      debugLogger.log(`[topdf/actions loadUserPdfFormData] No PDF form data found for user ${userId} (metadata exists but no key).`);
      return { success: true, data: undefined }; 
    }
  } catch (e: any) {
    logger.error(`[topdf/actions loadUserPdfFormData] Exception for user ${userId}:`, e);
    return { success: false, error: e.message || "Server error loading PDF form data." };
  }
}

async function sendTelegramDocument( 
  chatId: string,
  fileBlob: Blob,
  fileName: string,
  caption?: string 
): Promise<{ success: boolean; data?: any; error?: string }> {
   if (!TELEGRAM_BOT_TOKEN && process.env.NODE_ENV !== 'test') {
    logger.error("[topdf/actions.ts sendTelegramDocument] Telegram bot token not configured");
    return { success: false, error: "Telegram bot token not configured" };
  }
   if (process.env.NODE_ENV === 'test' && !TELEGRAM_BOT_TOKEN) { 
     logger.warn("[topdf/actions.ts sendTelegramDocument] TEST MODE: Telegram bot token not configured, simulating success.");
     return { success: true, data: { message_id: 12345 } };
   }

  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", fileBlob, fileName);

    if (caption) {
      formData.append("caption", caption);
      formData.append("parse_mode", "Markdown"); 
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: formData, 
    });

    const data: TelegramApiResponse = await response.json();
    if (!data.ok) {
       logger.error(`[topdf/actions.ts sendTelegramDocument] Telegram API error: ${data.description || "Unknown error"}`, { chatId, errorCode: data.error_code, captionProvided: !!caption });
      throw new Error(data.description || "Failed to send document");
    }

    logger.info(`[topdf/actions.ts sendTelegramDocument] Successfully sent document "${fileName}" to chat ${chatId}${caption ? ' with caption.' : '.'}`);
    return { success: true, data: data.result };
  } catch (error) {
     logger.error(`[topdf/actions.ts sendTelegramDocument] Error (chatId: ${chatId}, fileName: ${fileName}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred while sending document",
    };
  }
}

export async function generatePdfFromMarkdownAndSend(
    markdownContent: string,
    chatId: string,
    originalFileName: string = "report",
    userName?: string, 
    userAge?: string,  
    userGender?: string,
    heroImageUrl?: string 
): Promise<{ success: boolean; message?: string; error?: string }> {
    debugLogger.log(`[generatePdfFromMarkdownAndSend Action] Initiated for Chat ID: ${chatId}`);

    if (!chatId) return { success: false, error: "User chat ID not provided." };
    if (!markdownContent || !markdownContent.trim()) return { success: false, error: "No Markdown content provided." };
    
    try {
        const pdfBytes = await generatePdfBytes(
            markdownContent, 
            originalFileName, 
            userName, 
            userAge, 
            userGender, 
            heroImageUrl
        );
        
        const pdfFileName = `PRIZMA_${(userName || originalFileName).replace(/[^\w\d_.-]/g, "_").substring(0, 40)}.pdf`;
        
        let caption = `📄 Ваш PDF отчет PRIZMA готов: "${pdfFileName}"`;
        if (userName) caption += `\n👤 Для: ${userName}`;
        
        const sendResult = await sendTelegramDocument(chatId, new Blob([pdfBytes], { type: 'application/pdf' }), pdfFileName, caption);

        if (sendResult.success) {
            return { success: true, message: `PDF отчет "${pdfFileName}" успешно отправлен.` };
        } else {
            return { success: false, error: `Failed to send PDF: ${sendResult.error}` };
        }

    } catch (error: any) {
        logger.error('[generatePdfFromMarkdownAndSend Action] Critical error during PDF generation or sending:', error, error.stack);
        const errorMsg = error instanceof Error ? error.message : 'Unexpected server error during PDF processing.';
        return { success: false, error: errorMsg };
    }
}

export async function notifyAdminAction(
    userId: string, 
    username: string | null | undefined,
    messageFromUser: string
): Promise<{success: boolean, error?: string}> {
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
        logger.error("[topdf/actions notifyAdminAction] Telegram Bot Token or Admin Chat ID not configured.");
        return { success: false, error: "Server configuration error for notifications." };
    }
    const adminMessage = `🆘 Запрос в поддержку от PRIZMA:\n\nПользователь: ${username || 'N/A'} (ID: ${userId})\nСообщение: "${messageFromUser}"\nСтраница: /topdf`;
    try {
        const result = await commonSendTelegramMessage(String(ADMIN_CHAT_ID), adminMessage);
        if (result.success) {
            logger.info(`[topdf/actions notifyAdminAction] Support request from user ${userId} sent to admin.`);
            return { success: true };
        } else {
            logger.error(`[topdf/actions notifyAdminAction] Failed to send support request to admin: ${result.error}`);
            return { success: false, error: result.error };
        }
    } catch (e: any) {
        logger.error(`[topdf/actions notifyAdminAction] Exception sending support request:`, e);
        return { success: false, error: e.message || "Server error sending support request." };
    }
}