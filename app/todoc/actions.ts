"use server";

import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { addColontitulToDocx } from './docProcessor';

// Re-using Telegram logic structure from the provided example
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramApiResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
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

export async function processAndSendDocumentAction(
    formData: FormData,
    chatId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    debugLogger.log(`[processAndSendDocumentAction] Initiated for Chat ID: ${chatId}`);

    if (!chatId) {
        return { success: false, error: "User chat ID not provided." };
    }

    const file = formData.get("document") as File | null;
    if (!file) {
        return { success: false, error: "No document file provided." };
    }

    // Basic validation
    if (file.size > 10 * 1024 * 1024) { // 10 MB limit
        return { success: false, error: "File size exceeds 10MB limit." };
    }
    if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
        return { success: false, error: "Invalid file type. Please upload a .doc or .docx file." };
    }
    
    try {
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        // These are placeholder details that could be filled in by the user on the page in a future version.
        const docDetails = {
            docCode: "РК.ТТ-761.102 ПЗ",
            razrab: "Иванов И.И.",
            prov: "Петров П.П.",
            nkontr: "Сидоров С.С.",
            utv: "Смирнов А.А.",
            docTitle: "РЕФЕРАТ",
            lit: "У",
            list: "3",
            listov: "33",
            orgName: "ВНУ им. В. Даля\nКафедра ТТ\nГруппа ТТ-761"
        };
        
        const modifiedDocBytes = await addColontitulToDocx(fileBuffer, file.name, docDetails);
        
        const originalFileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const newFileName = `PROCESSED_${originalFileNameWithoutExt}.docx`; // Always output .docx
        
        const caption = `📄 Ваш обработанный документ готов: *${newFileName}*\n\nВ него был добавлен стандартный колонтитул (основная надпись) согласно ГОСТ\\.`;
        
        const blob = new Blob([modifiedDocBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

        const sendResult = await sendTelegramDocument(chatId, blob, newFileName, caption);

        if (sendResult.success) {
            return { success: true, message: `Документ "${newFileName}" успешно обработан и отправлен.` };
        } else {
            return { success: false, error: `Не удалось отправить документ: ${sendResult.error}` };
        }

    } catch (error: any) {
        logger.error('[processAndSendDocumentAction] Critical error during document processing or sending:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unexpected server error during document processing.';
        return { success: false, error: errorMsg };
    }
}