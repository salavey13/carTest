"use server";

import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { generateDocxWithColontitul } from './docProcessor';
import { supabaseAdmin } from '@/hooks/supabase';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { v4 as uuidv4 } from 'uuid';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DOCX_MEDIA_BUCKET = 'docx-media'; // Define a bucket for temporary media

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

export async function extractDataFromDocxAction(formData: FormData): Promise<{ success: boolean; text?: string; imageUrls?: string[]; error?: string; }> {
    const file = formData.get("document") as File | null;
    if (!file) return { success: false, error: "No file provided." };
    if (!file.name.endsWith('.docx')) return { success: false, error: "Only .docx files are supported for data extraction." };

    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // 1. Extract Text
        const contentXml = await zip.file("word/document.xml")?.async("string");
        if (!contentXml) return { success: false, error: "word/document.xml not found in the DOCX file." };
        
        const xmlParser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true });
        const jsonObj = xmlParser.parse(contentXml);
        const paragraphs = jsonObj['w:document']['w:body']['w:p'];
        const textContent = (Array.isArray(paragraphs) ? paragraphs : [paragraphs])
            .map((p: any) => {
                if (!p || !p['w:r']) return '';
                const runs = Array.isArray(p['w:r']) ? p['w:r'] : [p['w:r']];
                return runs.map((r: any) => (r && r['w:t']) ? (typeof r['w:t'] === 'object' ? r['w:t']['#text'] || '' : r['w:t']) : '').join('');
            }).join('\n');

        // 2. Extract, Upload, and Get URLs for Images
        const mediaFolder = zip.folder("word/media");
        const imageUrls: string[] = [];
        if (mediaFolder) {
            const imagePromises = mediaFolder.file(/.*\.(jpeg|jpg|png|gif)$/).map(async (imageFile) => {
                const imageBuffer = await imageFile.async("nodebuffer");
                const fileName = `${uuidv4()}-${imageFile.name}`;
                const { data, error } = await supabaseAdmin.storage.from(DOCX_MEDIA_BUCKET).upload(fileName, imageBuffer, {
                    contentType: `image/${imageFile.name.split('.').pop()}`,
                    upsert: true
                });
                if (error) {
                    logger.error(`Failed to upload ${imageFile.name} to Supabase:`, error);
                    return null;
                }
                const { data: { publicUrl } } = supabaseAdmin.storage.from(DOCX_MEDIA_BUCKET).getPublicUrl(data.path);
                return publicUrl;
            });
            const results = await Promise.all(imagePromises);
            imageUrls.push(...results.filter((url): url is string => url !== null));
        }
        
        return { success: true, text: textContent, imageUrls };
    } catch(e) {
        logger.error("Failed to extract data from DOCX:", e);
        return { success: false, error: "Could not parse the DOCX file. It might be corrupted." };
    }
}


export async function generateAndSendDocumentAction(
    payload: { docContent: string, docDetails: DocDetailsPayload },
    chatId: string
): Promise<{ success:boolean; message?: string; error?: string }> {
    debugLogger.log(`[generateAndSendDocumentAction] Initiated for Chat ID: ${chatId}`);

    if (!chatId) return { success: false, error: "User chat ID not provided." };
    if (!payload.docContent.trim()) return { success: false, error: "Document content cannot be empty." };

    try {
        const { docContent, docDetails } = payload;
        
        const generatedDocBytes = await generateDocxWithColontitul(docContent, docDetails);
        
        const safeFileName = docDetails.docCode.replace(/[^a-zA-Z0-9-]/g, '_') || 'document';
        const newFileName = `${safeFileName}.docx`;
        
        const caption = `📄 Ваш сгенерированный документ готов: *${escapeTelegramMarkdownV2(newFileName)}*\n\nВ него был добавлен настроенный вами колонтитул \\(основная надпись\\)\\.`;
        
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