"use server";

import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { generateDocxWithColontitul } from './docProcessor';

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
    orgName: string;
    docTitle: string;
}

function escapeTelegramMarkdownV2(text: string): string {
    if (!text) return '';
    const charsToEscape = /[_*[\]()~`>#+\-=|{}.!]/g;
    return text.replace(charsToEscape, (char) => `\\${char}`);
}


async function sendTelegramDocument( 
  chatId: string,
  fileBlob: Blob,
  fileName: string,
  caption?: string 
): Promise<{ success: boolean; data?: any; error?: string }> {
   if (!TELEGRAM_BOT_TOKEN) {
    logger.error("[todoc/actions.ts] Telegram bot token not configured");
    return { success: false, error: "Telegram bot token not configured" };
  }
  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", fileBlob, fileName);
    if (caption) {
      formData.append("caption", caption,); 
      formData.append("parse_mode", "MarkdownV2"); 
    }
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: formData, 
    });
    const data: TelegramApiResponse = await response.json();
    if (!data.ok) {
       logger.error(`[todoc/actions.ts] Telegram API error: ${data.description}`, { chatId, errorCode: data.error_code, caption });
      throw new Error(data.description || "Failed to send document");
    }
    logger.info(`[todoc/actions.ts] Successfully sent document "${fileName}" to chat ${chatId}`);
    return { success: true, data: data.result };
  } catch (error) {
     logger.error(`[todoc/actions.ts] Error sending doc to telegram:`, error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred" };
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
        return { success: false, error: "Document file not provided." };
    }
     if (!file.name.endsWith('.docx')) {
        return { success: false, error: "Only .docx files are supported." };
    }

    try {
        const docDetails: DocDetailsPayload = {
            docCode: formData.get('docCode') as string || '',
            docTitle: formData.get('docTitle') as string || '',
            razrab: formData.get('razrab') as string || '',
            prov: formData.get('prov') as string || '',
            nkontr: formData.get('nkontr') as string || '',
            utv: formData.get('utv') as string || '',
            lit: formData.get('lit') as string || '',
            orgName: formData.get('orgName') as string || '',
        };

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        
        const generatedDocBytes = await generateDocxWithColontitul(fileBuffer, docDetails);
        
        const safeFileName = docDetails.docCode.replace(/[^a-zA-Z0-9-]/g, '_') || 'document';
        const newFileName = `${safeFileName}.docx`;
        
        const caption = `📄 Ваш обработанный документ готов: *${escapeTelegramMarkdownV2(newFileName)}*\n\nВ него был добавлен настроенный вами колонтитул и сохранены все изображения и текст\\.`;
        
        const blob = new Blob([generatedDocBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

        const sendResult = await sendTelegramDocument(chatId, blob, newFileName, caption);

        if (sendResult.success) {
            return { success: true, message: `Документ "${newFileName}" успешно сгенерирован и отправлен.` };
        } else {
            return { success: false, error: `Не удалось отправить документ: ${sendResult.error}` };
        }

    } catch (error: any) {
        logger.error('[processAndSendDocumentAction] Critical error during document generation or sending:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unexpected server error during document processing.';
        return { success: false, error: errorMsg };
    }
}