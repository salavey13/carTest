"use server";

import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { generateDocxWithColontitul } from './docProcessor';

// Re-using Telegram logic structure from the provided example
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramApiResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

interface DocDetailsPayload {
    razrab?: string;
    prov?: string;
    nkontr?: string;
    utv?: string;
    docCode: string;
    lit: string;
    list: string;
    listov: string;
    orgName: string;
    docTitle: string;
}

// A generic function to send a document to Telegram
async function sendTelegramDocument( 
  chatId: string,
  fileBlob: Blob,
  fileName: string,
  caption?: string 
): Promise<{ success: boolean; data?: any; error?: string }> {
   if (!TELEGRAM_BOT_TOKEN && process.env.NODE_ENV !== 'test') {
    logger.error("[todoc/actions.ts sendTelegramDocument] Telegram bot token not configured");
    return { success: false, error: "Telegram bot token not configured" };
  }
   if (process.env.NODE_ENV === 'test' && !TELEGRAM_BOT_TOKEN) { 
     logger.warn("[todoc/actions.ts sendTelegramDocument] TEST MODE: Telegram bot token not configured, simulating success.");
     return { success: true, data: { message_id: 12345 } };
   }

  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", fileBlob, fileName);

    if (caption) {
      // Basic markdown escape for caption
      const charsToEscape = /[_*[\]()~`>#+\-=|{}.!]/g;
      const escapedCaption = caption.replace(charsToEscape, '\\$&');
      formData.append("caption", escapedCaption); 
      formData.append("parse_mode", "MarkdownV2"); 
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: formData, 
    });

    const data: TelegramApiResponse = await response.json();
    if (!data.ok) {
       logger.error(`[todoc/actions.ts sendTelegramDocument] Telegram API error: ${data.description || "Unknown error"}`, { chatId, errorCode: data.error_code });
      throw new Error(data.description || "Failed to send document");
    }

    logger.info(`[todoc/actions.ts sendTelegramDocument] Successfully sent document "${fileName}" to chat ${chatId}`);
    return { success: true, data: data.result };
  } catch (error) {
     logger.error(`[todoc/actions.ts sendTelegramDocument] Error (chatId: ${chatId}, fileName: ${fileName}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred while sending document",
    };
  }
}

export async function generateAndSendDocumentAction(
    payload: { docContent: string, docDetails: DocDetailsPayload },
    chatId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    debugLogger.log(`[generateAndSendDocumentAction] Initiated for Chat ID: ${chatId}`);

    if (!chatId) {
        return { success: false, error: "User chat ID not provided." };
    }
    
    if (!payload.docContent.trim()) {
        return { success: false, error: "Document content cannot be empty." };
    }

    try {
        const { docContent, docDetails } = payload;
        
        const generatedDocBytes = await generateDocxWithColontitul(docContent, docDetails);
        
        const newFileName = `${docDetails.docCode.replace(/[^a-zA-Z0-9-]/g, '_') || 'document'}.docx`;
        
        const caption = `📄 Ваш сгенерированный документ готов: *${newFileName}*\n\nВ него был добавлен настроенный вами колонтитул (основная надпись)\\.`;
        
        const blob = new Blob([generatedDocBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

        const sendResult = await sendTelegramDocument(chatId, blob, newFileName, caption);

        if (sendResult.success) {
            return { success: true, message: `Документ "${newFileName}" успешно сгенерирован и отправлен.` };
        } else {
            return { success: false, error: `Не удалось отправить документ: ${sendResult.error}` };
        }

    } catch (error: any) {
        logger.error('[generateAndSendDocumentAction] Critical error during document generation or sending:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unexpected server error during document processing.';
        return { success: false, error: errorMsg };
    }
}