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

const translitMap: { [key: string]: string } = {
    'а':'a', 'б':'b', 'в':'v', 'г':'g', 'д':'d', 'е':'e', 'ё':'yo', 'ж':'zh',
    'з':'z', 'и':'i', 'й':'y', 'к':'k', 'л':'l', 'м':'m', 'н':'n', 'о':'o',
    'п':'p', 'р':'r', 'с':'s', 'т':'t', 'у':'u', 'ф':'f', 'х':'h', 'ц':'ts',
    'ч':'ch', 'ш':'sh', 'щ':'shch', 'ъ':'', 'ы':'y', 'ь':'', 'э':'e', 'ю':'yu', 'я':'ya'
};

function transliterate(text: string): string {
    return text.toLowerCase().split('').map(char => translitMap[char] || char).join('');
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

async function processDocument(formData: FormData): Promise<{ docBytes: Uint8Array, fileName: string }> {
    const file = formData.get("document") as File | null;
    if (!file) {
        throw new Error("Document file not provided.");
    }
    if (!file.name.endsWith('.docx')) {
        throw new Error("Only .docx files are supported.");
    }

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
    
    const transliteratedTitle = transliterate(docDetails.docTitle).replace(/[^a-z0-9-]/g, '_');
    const originalFileNameWithoutExt = file.name.replace(/\.docx$/, '');
    const newFileName = `PROCESSED_${transliteratedTitle || originalFileNameWithoutExt}.docx`;

    return { docBytes: generatedDocBytes, fileName: newFileName };
}

export async function processAndSendDocumentAction(
    formData: FormData,
    chatId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    debugLogger.log(`[processAndSendDocumentAction] Initiated for Chat ID: ${chatId}`);
    if (!chatId) return { success: false, error: "User chat ID not provided." };

    try {
        const { docBytes, fileName } = await processDocument(formData);
        const caption = `📄 Ваш обработанный документ готов: *${escapeTelegramMarkdownV2(fileName)}*\n\nВ него был добавлен настроенный вами колонтитул и сохранены все изображения и текст\\.`;
        const blob = new Blob([docBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const sendResult = await sendTelegramDocument(chatId, blob, fileName, caption);

        if (sendResult.success) {
            return { success: true, message: `Документ "${fileName}" успешно сгенерирован и отправлен.` };
        } else {
            return { success: false, error: `Не удалось отправить документ: ${sendResult.error}` };
        }

    } catch (error: any) {
        logger.error('[processAndSendDocumentAction] Critical error:', error);
        return { success: false, error: error.message || 'Unexpected server error.' };
    }
}


export async function generateAndReturnDocxAction(
    formData: FormData
): Promise<{ success: boolean; fileContent?: string; fileName?: string; error?: string }> {
    debugLogger.log(`[generateAndReturnDocxAction] Initiated for download.`);
    try {
        const { docBytes, fileName } = await processDocument(formData);
        const base64Content = Buffer.from(docBytes).toString('base64');
        return { success: true, fileContent: base64Content, fileName };
    } catch (error: any) {
        logger.error('[generateAndReturnDocxAction] Critical error:', error);
        return { success: false, error: error.message || 'Unexpected server error.' };
    }
}