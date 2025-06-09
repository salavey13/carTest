"use server";

import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import path from 'path'; 
import fs from 'fs';   
import { supabaseAdmin } from '@/hooks/supabase'; 
import { sendTelegramMessage as commonSendTelegramMessage } from '@/app/actions'; 

const pdfLibModule = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');

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
        
    if (fetchError && fetchError.code === 'PGRST116') { // User not found, no metadata yet
        debugLogger.log(`[topdf/actions loadUserPdfFormData] User ${userId} not found, no PDF form data to load.`);
        return { success: true, data: undefined }; // No data, but not an error
    }
    if (fetchError) { // Other errors
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

const { StandardFonts, rgb, PageSizes } = pdfLibModule; 
type PDFFont = any; 

async function drawMarkdownWrappedText(
    page: any, 
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    baseFont: PDFFont, 
    boldFont: PDFFont, 
    baseFontSize: number,
    color = rgb(0, 0, 0)
): Promise<number> {
    const lines = text.split('\n');
    let currentY = y;
    const margin = 50; 

    for (const line of lines) {
        if (currentY < margin + lineHeight) { // Check if enough space for at least one line
            debugLogger.warn("[PDF Gen drawMarkdownWrappedText] Content potentially overflowing page for this line segment. Stopping text draw for this line and subsequent ones in this call.");
            return currentY; // Return currentY to indicate where drawing stopped
        }

        let effectiveFont = baseFont;
        let effectiveSize = baseFontSize;
        let currentX = x;
        let lineToDraw = line;

        // --- Style parsing ---
        if (line.startsWith('### ')) {
            effectiveFont = boldFont; effectiveSize = baseFontSize + 2; lineToDraw = line.substring(4);
        } else if (line.startsWith('## ')) {
            effectiveFont = boldFont; effectiveSize = baseFontSize + 4; lineToDraw = line.substring(3);
        } else if (line.startsWith('# ')) {
            effectiveFont = boldFont; effectiveSize = baseFontSize + 6; lineToDraw = line.substring(2);
        } else if (line.startsWith('* ') || line.startsWith('- ')) {
            lineToDraw = `• ${line.substring(2)}`; currentX += 10;
        } else if (line.match(/^(\s*)\* /) || line.match(/^(\s*)- /)) {
            const indentMatch = line.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[0].length : 0;
            currentX += 10 + (indent * 5);
            lineToDraw = `• ${line.replace(/^(\s*)[\*-] /, '')}`;
        }
        // --- End Style parsing ---

        const words = lineToDraw.split(' ');
        let currentLineSegment = '';
        for (const word of words) {
            const testSegment = currentLineSegment + (currentLineSegment ? ' ' : '') + word;
            let textWidth = 0;
            try {
                 // Attempt to replace unsupported characters before measuring and drawing
                const sanitizedTestSegment = testSegment.replace(/[^\x00-\uFFFF]/g, "?"); // Allow wider range, replace truly unsupported with ?
                textWidth = effectiveFont.widthOfTextAtSize(sanitizedTestSegment, effectiveSize);

                if (currentX + textWidth > maxWidth && currentLineSegment) {
                    if (currentY < margin + lineHeight) { debugLogger.warn("[PDF Gen drawMarkdownWrappedText] Overflow during word wrap."); return currentY; }
                    page.drawText(currentLineSegment.replace(/[^\x00-\uFFFF]/g, "?"), { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
                    currentY -= lineHeight * (effectiveSize / baseFontSize);
                    currentLineSegment = word; // Start new line with current word
                } else {
                    currentLineSegment = testSegment;
                }
            } catch (e: any) {
                logger.warn(`[PDF Gen drawMarkdownWrappedText] Error measuring/processing word: "${word}" in segment "${testSegment}". Error: ${e.message}. Replacing unsupported chars.`);
                // Sanitize the problematic segment and try to continue if possible, or just the word
                const sanitizedWord = word.replace(/[^\x00-\uFFFF]/g, "?");
                currentLineSegment = currentLineSegment + (currentLineSegment ? ' ' : '') + sanitizedWord; 
            }
        }
        if (currentLineSegment) { // Draw remaining part of the line
            if (currentY < margin + lineHeight) { debugLogger.warn("[PDF Gen drawMarkdownWrappedText] Overflow at end of line."); return currentY; }
             try {
                page.drawText(currentLineSegment.replace(/[^\x00-\uFFFF]/g, "?"), { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
            } catch (e: any) {
                logger.warn(`[PDF Gen drawMarkdownWrappedText] Final attempt to draw sanitized line segment failed: "${currentLineSegment}". Error: ${e.message}`);
            }
        }
        currentY -= lineHeight * (effectiveSize / baseFontSize); // Move to next line position
    }
    return currentY; // Return Y position after drawing all lines
}
const pageMargins = 50;

export async function generatePdfFromMarkdownAndSend(
    markdownContent: string,
    chatId: string,
    originalFileName: string = "report",
    userName?: string, 
    userAge?: string,  
    userGender?: string,
    heroImageUrl?: string 
): Promise<{ success: boolean; message?: string; error?: string }> {
    debugLogger.log(`[Markdown to PDF Action] Initiated for Chat ID: ${chatId}, User: ${userName || 'N/A'}`);

    if (!chatId) return { success: false, error: "User chat ID not provided." };
    if (!markdownContent || !markdownContent.trim()) return { success: false, error: "No Markdown content provided." };
    
    try {
        const PDFDocumentClass = pdfLibModule.PDFDocument;
        const fontkitInstanceToUse = fontkitModule.default || fontkitModule;

        if (!PDFDocumentClass || typeof PDFDocumentClass.create !== 'function') {
            logger.error("[PDF Gen] CRITICAL: PDFDocumentClass or PDFDocumentClass.create is not available.");
            return { success: false, error: "Critical PDF library load error." };
        }
        const pdfDoc = await PDFDocumentClass.create();
        
        if (typeof pdfDoc.registerFontkit === 'function') {
            pdfDoc.registerFontkit(fontkitInstanceToUse);
        } else {
            logger.warn("[PDF Gen] pdfDoc.registerFontkit is not a function. Font embedding might be limited.");
        }
        
        const regularFontBytes = fs.readFileSync(path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf'));
        const boldFontBytes = fs.readFileSync(path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans-Bold.ttf'));
        const customFont = await pdfDoc.embedFont(regularFontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        let page = pdfDoc.addPage(PageSizes.A4);
        const { width, height } = page.getSize();
        let currentY = height - pageMargins;
        const baseFontSize = 10;
        const lineHeight = 14;

        // Embed Hero Image if URL is provided
        if (heroImageUrl) {
            try {
                const imageResponse = await fetch(heroImageUrl);
                if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
                const imageBytes = await imageResponse.arrayBuffer();
                let embeddedImage;
                if (heroImageUrl.toLowerCase().endsWith('.png')) {
                    embeddedImage = await pdfDoc.embedPng(imageBytes);
                } else if (heroImageUrl.toLowerCase().endsWith('.jpg') || heroImageUrl.toLowerCase().endsWith('.jpeg')) {
                    embeddedImage = await pdfDoc.embedJpg(imageBytes);
                } else {
                    logger.warn(`[PDF Gen] Unsupported hero image type: ${heroImageUrl}. Skipping image.`);
                }

                if (embeddedImage) {
                    const imgMaxWidth = width - 2 * pageMargins;
                    const aspectRatio = embeddedImage.width / embeddedImage.height;
                    const imgDisplayWidth = imgMaxWidth;
                    const imgDisplayHeight = imgDisplayWidth / aspectRatio;

                    if (currentY - imgDisplayHeight - 10 < pageMargins) { // Check if space for image + title
                        page = pdfDoc.addPage(PageSizes.A4);
                        currentY = height - pageMargins;
                    }
                    page.drawImage(embeddedImage, {
                        x: pageMargins,
                        y: currentY - imgDisplayHeight,
                        width: imgDisplayWidth,
                        height: imgDisplayHeight,
                    });
                    currentY -= (imgDisplayHeight + 15); // Space after image
                }
            } catch (imgError: any) {
                logger.error(`[PDF Gen] Error embedding hero image from ${heroImageUrl}: ${imgError.message}`);
            }
        }
        
        const sanitizedTitleFileNameBase = originalFileName.replace(/[^\w\s\d.,!?"'%*()\-+=\[\]{};:@#~$&\/\\]/g, "_").substring(0, 50);
        const pdfTitle = userName ? `Отчет для ${userName}: ${sanitizedTitleFileNameBase}` : `Отчет: ${sanitizedTitleFileNameBase}`;

        if (currentY < pageMargins + 20 ) { page = pdfDoc.addPage(PageSizes.A4); currentY = height - pageMargins; }
        page.drawText(pdfTitle, { x: pageMargins, y: currentY, font: customBoldFont, size: 16, color: rgb(0.1, 0.1, 0.4) });
        currentY -= 20;

        if(userName || userAge || userGender) {
            if (currentY < pageMargins + lineHeight ) { page = pdfDoc.addPage(PageSizes.A4); currentY = height - pageMargins; }
            let userInfoLine = "Данные пользователя: ";
            if(userName) userInfoLine += `Имя: ${userName}`;
            if(userAge) userInfoLine += `${userName ? ', ' : ''}Возраст: ${userAge}`;
            if(userGender) userInfoLine += `${(userName || userAge) ? ', ' : ''}Пол: ${userGender}`;
            page.drawText(userInfoLine, { x: pageMargins, y: currentY, font: customFont, size: baseFontSize - 1, color: rgb(0.3, 0.3, 0.3) });
            currentY -= (lineHeight - 2);
        }
        currentY -= 10; 

        const lines = markdownContent.split('\n');
        for (const line of lines) {
            if (currentY < pageMargins + lineHeight) { 
                page = pdfDoc.addPage(PageSizes.A4);
                currentY = height - pageMargins;
                page.drawText(`${pdfTitle} (стр. ${pdfDoc.getPageCount()})`, {  x: pageMargins, y: currentY, font: customBoldFont, size: 12, color: rgb(0.2,0.2,0.2) });
                currentY -= 20;
            }
            if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
                 if (currentY < pageMargins + lineHeight ) { page = pdfDoc.addPage(PageSizes.A4); currentY = height - pageMargins; }
                page.drawLine({ start: { x: pageMargins, y: currentY - (lineHeight / 3) }, end: { x: width - pageMargins, y: currentY - (lineHeight / 3) }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
                currentY -= lineHeight;
            } else {
                 currentY = await drawMarkdownWrappedText( page, line, pageMargins, currentY, width - 2 * pageMargins, lineHeight, customFont, customBoldFont, baseFontSize, rgb(0.1, 0.1, 0.1) );
            }
        }

        const pdfBytes = await pdfDoc.save();
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
        logger.error('[Markdown to PDF Action] Critical error during PDF generation or sending:', error, error.stack);
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
        // Ensure ADMIN_CHAT_ID is a string, commonSendTelegramMessage expects string targetId
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