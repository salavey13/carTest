"use server";

import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import path from 'path'; 
import fs from 'fs';   
import { supabaseAdmin } from '@/hooks/supabase'; // Use admin client directly

const pdfLibModule = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN && process.env.NODE_ENV !== 'test') { 
    logger.error("[topdf/actions.ts] Missing critical environment variable: TELEGRAM_BOT_TOKEN for PDF sending.");
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

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: single row not found (user might not exist yet or has no metadata)
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
        
    if (fetchError && fetchError.code !== 'PGRST116') {
        logger.error(`[topdf/actions loadUserPdfFormData] Error fetching user metadata for ${userId}:`, fetchError);
        return { success: false, error: fetchError.message || "Failed to fetch user data." };
    }
    if (!userData) {
      debugLogger.log(`[topdf/actions loadUserPdfFormData] User ${userId} not found or no metadata.`);
      // Return success false if user not found, or success true with undefined data if that's acceptable
      return { success: false, error: "User not found to load PDF form data." };
    }

    const formData = userData.metadata?.[PDF_FORM_DATA_KEY] as { userName?: string; userAge?: string; userGender?: string } | undefined;
    
    if (formData) {
      debugLogger.log(`[topdf/actions loadUserPdfFormData] PDF form data loaded for user ${userId}`, formData);
      return { success: true, data: formData };
    } else {
      debugLogger.log(`[topdf/actions loadUserPdfFormData] No PDF form data found for user ${userId}`);
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
        if (currentY < margin) {
            debugLogger.warn("[PDF Gen] Content overflowing page, stopping text draw for this line.");
            break;
        }

        let effectiveFont = baseFont;
        let effectiveSize = baseFontSize;
        let currentX = x;
        let lineToDraw = line;

        if (line.startsWith('### ')) {
            effectiveFont = boldFont;
            effectiveSize = baseFontSize + 2;
            lineToDraw = line.substring(4);
        } else if (line.startsWith('## ')) {
            effectiveFont = boldFont;
            effectiveSize = baseFontSize + 4;
            lineToDraw = line.substring(3);
        } else if (line.startsWith('# ')) {
            effectiveFont = boldFont;
            effectiveSize = baseFontSize + 6;
            lineToDraw = line.substring(2);
        } else if (line.startsWith('* ') || line.startsWith('- ')) {
            lineToDraw = `• ${line.substring(2)}`;
            currentX += 10;
        } else if (line.match(/^(\s*)\* /) || line.match(/^(\s*)- /)) {
            const indentMatch = line.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[0].length : 0;
            currentX += 10 + (indent * 5);
            lineToDraw = `• ${line.replace(/^(\s*)[\*-] /, '')}`;
        }

        const words = lineToDraw.split(' ');
        let currentLineSegment = '';
        for (const word of words) {
            const testSegment = currentLineSegment + (currentLineSegment ? ' ' : '') + word;
            try {
                const textWidth = effectiveFont.widthOfTextAtSize(testSegment, effectiveSize);
                if (currentX + textWidth > maxWidth && currentLineSegment) {
                    page.drawText(currentLineSegment, { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
                    currentY -= lineHeight * (effectiveSize / baseFontSize);
                    currentLineSegment = word;
                    if (currentY < margin) break;
                } else {
                    currentLineSegment = testSegment;
                }
            } catch (e: any) {
                logger.warn(`[PDF Gen] Skipping character/word due to font error: "${word}" in segment "${testSegment}". Error: ${e.message}`);
                currentLineSegment = currentLineSegment.replace(/[^\x00-\u04FF\u0500-\u052F\s\d\p{P}]/gu, "?"); 
            }
        }
        if (currentLineSegment && currentY >= margin) {
            try {
                page.drawText(currentLineSegment, { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
            } catch (e: any) {
                logger.warn(`[PDF Gen] Skipping final line segment due to font error: "${currentLineSegment}". Error: ${e.message}`);
                page.drawText(currentLineSegment.replace(/[^\x00-\u04FF\u0500-\u052F\s\d\p{P}]/gu, "?"), { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
            }
            currentY -= lineHeight * (effectiveSize / baseFontSize);
        }
        if (currentY < margin) break;
    }
    return currentY;
}
const pageMargins = 50;

export async function generatePdfFromMarkdownAndSend(
    markdownContent: string,
    chatId: string,
    originalFileName: string = "report",
    userName?: string, 
    userAge?: string,  
    userGender?: string 
): Promise<{ success: boolean; message?: string; error?: string }> {
    debugLogger.log(`[Markdown to PDF Action] Initiated for Chat ID: ${chatId}, User: ${userName || 'N/A'}`);

    if (!chatId) {
        return { success: false, error: "User chat ID not provided." };
    }
    if (!markdownContent || !markdownContent.trim()) {
        return { success: false, error: "No Markdown content provided to generate PDF." };
    }
    
    try {
        const PDFDocumentClass = pdfLibModule.PDFDocument;
        const fontkitInstanceToUse = fontkitModule.default || fontkitModule;

        if (!PDFDocumentClass) {
            logger.error("[PDF Gen] CRITICAL: pdfLibModule.PDFDocument is undefined. Cannot proceed.");
            return { success: false, error: "Critical PDF library load error (PDFDocument class not found)." };
        }
        if (!fontkitInstanceToUse || (typeof fontkitInstanceToUse !== 'object' && typeof fontkitInstanceToUse !== 'function')) {
            logger.error("[PDF Gen] CRITICAL: fontkitInstanceToUse is not a valid object or function. Cannot proceed.", fontkitInstanceToUse);
            return { success: false, error: "Critical PDF library load error (fontkit instance is invalid)." };
        }

        if (typeof PDFDocumentClass.create !== 'function') {
            logger.error("[PDF Gen] CRITICAL: PDFDocumentClass.create is not a function. Cannot create PDF document.", PDFDocumentClass);
            return { success: false, error: "Internal error: PDFDocument class is not correctly initialized for PDF creation." };
        }
        const pdfDoc = await PDFDocumentClass.create();

        let registrationAttempted = false;
        let registrationSuccessful = false;

        if (typeof pdfDoc.registerFontkit === 'function') {
            registrationAttempted = true;
            debugLogger.log("[PDF Gen] Attempting registration: pdfDoc.registerFontkit()");
            try {
                pdfDoc.registerFontkit(fontkitInstanceToUse);
                registrationSuccessful = true;
                debugLogger.log("[PDF Gen] Registered fontkit via pdfDoc.registerFontkit() (ON INSTANCE).");
            } catch (e: any) {
                debugLogger.warn(`[PDF Gen] Failed pdfDoc.registerFontkit() (ON INSTANCE): ${e.message}`);
            }
        } else {
             debugLogger.log("[PDF Gen] pdfDoc.registerFontkit is NOT a function.");
        }

        if (!registrationSuccessful && PDFDocumentClass.prototype && typeof PDFDocumentClass.prototype.registerFontkit === 'function') {
            registrationAttempted = true;
            debugLogger.log("[PDF Gen] Attempting fallback registration: PDFDocumentClass.prototype.registerFontkit.call(PDFDocumentClass, ...)");
            try {
                PDFDocumentClass.prototype.registerFontkit.call(PDFDocumentClass, fontkitInstanceToUse);
                registrationSuccessful = true; 
                debugLogger.log("[PDF Gen] Fallback PDFDocumentClass.prototype.registerFontkit.call(PDFDocumentClass) SUCCEEDED (or did not throw).");
            } catch (e: any) {
                debugLogger.warn(`[PDF Gen] Fallback PDFDocumentClass.prototype.registerFontkit.call(PDFDocumentClass) FAILED: ${e.message}`);
            }
        }

        if (!registrationSuccessful && typeof PDFDocumentClass.registerFontkit === 'function') {
            registrationAttempted = true;
            debugLogger.log("[PDF Gen] Attempting fallback registration: PDFDocumentClass.registerFontkit(...) (STATIC direct)");
            try {
                PDFDocumentClass.registerFontkit(fontkitInstanceToUse);
                registrationSuccessful = true;
                debugLogger.log("[PDF Gen] Fallback PDFDocumentClass.registerFontkit (STATIC direct) SUCCEEDED.");
            } catch (e: any) {
                 debugLogger.warn(`[PDF Gen] Fallback PDFDocumentClass.registerFontkit (STATIC direct) FAILED: ${e.message}`);
            }
        }

        if (!registrationSuccessful) {
            if (registrationAttempted) {
                 logger.error("[PDF Gen] CRITICAL: All fontkit registration attempts failed or were ineffective.");
                 return { success: false, error: "Critical PDF library setup error (All fontkit registration attempts failed or were ineffective)." };
            } else {
                 logger.error("[PDF Gen] CRITICAL: No suitable fontkit registration method found on PDFDocument or its instance. Check diagnostics.");
                 return { success: false, error: "Critical PDF library setup error (No fontkit registration method found. Diagnostics might provide clues)." };
            }
        }
        
        debugLogger.log("[PDF Gen] Fontkit registration process completed. Registration successful: " + registrationSuccessful + ". Proceeding to embed fonts.");

        const regularFontName = 'DejaVuSans.ttf';
        const boldFontName = 'DejaVuSans-Bold.ttf';
        const currentWorkingDirectory = process.cwd();
        const fontsDir = path.join(currentWorkingDirectory, 'server-assets', 'fonts');

        debugLogger.log(`[PDF Gen] Current working directory (process.cwd()): ${currentWorkingDirectory}`);
        debugLogger.log(`[PDF Gen] Attempting to access fonts directory at absolute path: ${fontsDir}`);

        if (!fs.existsSync(fontsDir)) {
            logger.error(`[PDF Gen] CRITICAL: Fonts directory NOT FOUND at specified path: ${fontsDir}.`);
            return { success: false, error: `Core fonts directory missing on server. Expected at: ${fontsDir}.` };
        }
        
        const regularFontPath = path.join(fontsDir, regularFontName);
        if (!fs.existsSync(regularFontPath)) {
            logger.error(`[PDF Gen] CRITICAL: Regular font file '${regularFontName}' NOT FOUND at: ${regularFontPath}.`);
            return { success: false, error: `Font file (${regularFontName}) missing. Path: ${regularFontPath}` };
        }
        
        const regularFontBytes = fs.readFileSync(regularFontPath);
        const customFont = await pdfDoc.embedFont(regularFontBytes); 
        
        let customBoldFont: PDFFont; 
        const boldFontPath = path.join(fontsDir, boldFontName);
        if (!fs.existsSync(boldFontPath)) {
            logger.warn(`[PDF Gen] Bold font file '${boldFontName}' NOT FOUND at: ${boldFontPath}. Using regular font as bold.`);
            customBoldFont = customFont; 
        } else {
            try {
                const boldFontBytes = fs.readFileSync(boldFontPath);
                customBoldFont = await pdfDoc.embedFont(boldFontBytes); 
            } catch (fontError: any) {
                logger.warn(`[PDF Gen] Error embedding bold font '${boldFontName}': ${fontError.message}. Using regular font as bold.`);
                customBoldFont = customFont; 
            }
        }

        let page = pdfDoc.addPage(PageSizes.A4);
        const { width, height } = page.getSize();
        let currentY = height - pageMargins;
        const baseFontSize = 10;
        const lineHeight = 14;
        
        const sanitizedTitleFileNameBase = originalFileName.replace(/[^\w\s\d.,!?"'%*()\-+=\[\]{};:@#~$&\/\\]/g, "_").substring(0, 50);
        const pdfTitle = userName ? `Отчет для ${userName}: ${sanitizedTitleFileNameBase}` : `Отчет: ${sanitizedTitleFileNameBase}`;

        page.drawText(pdfTitle, {
            x: pageMargins, y: currentY, font: customBoldFont, size: 16, color: rgb(0.1, 0.1, 0.4)
        });
        currentY -= 20;
        if(userName || userAge || userGender) {
            let userInfoLine = "Данные пользователя: ";
            if(userName) userInfoLine += `Имя: ${userName}`;
            if(userAge) userInfoLine += `${userName ? ', ' : ''}Возраст: ${userAge}`;
            if(userGender) userInfoLine += `${(userName || userAge) ? ', ' : ''}Пол: ${userGender}`;
            page.drawText(userInfoLine, {
                x: pageMargins, y: currentY, font: customFont, size: baseFontSize - 1, color: rgb(0.3, 0.3, 0.3)
            });
            currentY -= (lineHeight - 2);
        }
        currentY -= 10; 

        const lines = markdownContent.split('\n');
        for (const line of lines) {
            if (currentY < pageMargins + lineHeight) { 
                page = pdfDoc.addPage(PageSizes.A4);
                currentY = height - pageMargins;
                page.drawText(`${pdfTitle} (продолжение)`, { 
                    x: pageMargins, y: currentY, font: customBoldFont, size: 12, color: rgb(0.2,0.2,0.2)
                });
                currentY -= 20;
            }
            if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
                page.drawLine({
                    start: { x: pageMargins, y: currentY - (lineHeight / 3) },
                    end: { x: width - pageMargins, y: currentY - (lineHeight / 3) },
                    thickness: 1, color: rgb(0.7, 0.7, 0.7),
                });
                currentY -= lineHeight;
            } else {
                 currentY = await drawMarkdownWrappedText(
                    page, line, pageMargins, currentY, width - 2 * pageMargins,
                    lineHeight, customFont, customBoldFont, baseFontSize, rgb(0.1, 0.1, 0.1)
                );
            }
        }

        const pdfBytes = await pdfDoc.save();
        const pdfFileName = `Report_${(userName || originalFileName).replace(/[^\w\d_.-]/g, "_").substring(0, 50)}.pdf`;
        
        let caption = `📄 Ваш PDF отчет готов: "${pdfFileName}"`;
        if (userName || userAge || userGender) {
            caption += `\n\n👤 Для: ${userName || 'N/A'}`;
            if (userAge) caption += `, Возраст: ${userAge}`;
            if (userGender) caption += `, Пол: ${userGender}`;
        }
        
        const sendResult = await sendTelegramDocument(chatId, new Blob([pdfBytes], { type: 'application/pdf' }), pdfFileName, caption);

        if (sendResult.success) {
            return { success: true, message: `PDF отчет "${pdfFileName}" отправлен с информацией о пользователе.` };
        } else {
            return { success: false, error: `Failed to send PDF: ${sendResult.error}` };
        }

    } catch (error: any) {
        logger.error('[Markdown to PDF Action] Critical error during PDF generation or sending:', error, error.stack);
        if (error.constructor && error.constructor.name === 'FontkitNotRegisteredError') {
             return { success: false, error: `PDF library error: Font system (fontkit) not available. Original: ${error.message}` };
        }
        const errorMsg = error instanceof Error ? error.message : 'Unexpected server error during PDF processing.';
        return { success: false, error: errorMsg };
    }
}