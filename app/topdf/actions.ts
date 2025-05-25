"use server";

import { sendTelegramDocument } from '@/app/actions';
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont, PDFFontType } from 'pdf-lib';
import fs from 'fs'; 
import path from 'path'; 
import fontkit from '@pdf-lib/fontkit'; 

// Removed global fontkit registration as it was causing issues in certain Next.js/Vercel contexts.
// PDFDocument.registerFontkit(fontkit);
// debugLogger.log("[PDF Gen] fontkit registered with PDFDocument at module level.");

// Helper to draw wrapped text in PDF, considering basic Markdown
async function drawMarkdownWrappedText(
    page: import('pdf-lib').PDFPage,
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
                currentLineSegment = currentLineSegment.replace(/[^\x00-\x7F]/g, "?"); 
            }
        }
        if (currentLineSegment && currentY >= margin) {
             try {
                page.drawText(currentLineSegment, { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
             } catch (e: any) {
                 logger.warn(`[PDF Gen] Skipping final line segment due to font error: "${currentLineSegment}". Error: ${e.message}`);
                 page.drawText(currentLineSegment.replace(/[^\x00-\x7F]/g, "?"), { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
             }
            currentY -= lineHeight * (effectiveSize / baseFontSize);
        }
        if (currentY < margin) break;
    }
    return currentY;
}
const margin = 50; 

export async function generatePdfFromMarkdownAndSend(
    markdownContent: string,
    chatId: string,
    originalFileName: string = "report"
): Promise<{ success: boolean; message?: string; error?: string }> {
    debugLogger.log(`[Markdown to PDF Action] Initiated for Chat ID: ${chatId}`);

    if (!chatId) {
        return { success: false, error: "User chat ID not provided." };
    }
    if (!markdownContent || !markdownContent.trim()) {
        return { success: false, error: "No Markdown content provided to generate PDF." };
    }

    try {
        // Register fontkit right before creating the PDFDocument instance
        // This is the most reliable way to ensure it's available in all Next.js/Vercel contexts.
        PDFDocument.registerFontkit(fontkit);
        debugLogger.log("[PDF Gen] fontkit registered with PDFDocument locally before creation.");

        const pdfDoc = await PDFDocument.create();
        
        const regularFontName = 'DejaVuSans.ttf';
        const boldFontName = 'DejaVuSans-Bold.ttf';
        const currentWorkingDirectory = process.cwd();
        // The 'server-assets/fonts' directory is now correctly bundled with the serverless function
        // thanks to `outputFileTracingIncludes` in next.config.mjs.
        const fontsDir = path.join(currentWorkingDirectory, 'server-assets', 'fonts');

        debugLogger.log(`[PDF Gen] Current working directory (process.cwd()): ${currentWorkingDirectory}`);
        debugLogger.log(`[PDF Gen] Attempting to access fonts directory at absolute path: ${fontsDir}`);

        if (!fs.existsSync(fontsDir)) {
            logger.error(`[PDF Gen] CRITICAL: Fonts directory NOT FOUND at specified path: ${fontsDir}. This means the 'server-assets/fonts' directory is not accessible or does not exist at this location in the server environment.`);
            return { success: false, error: `Core fonts directory missing on server. Expected at: ${fontsDir}. Please check server deployment and logs.` };
        } else {
            debugLogger.log(`[PDF Gen] Fonts directory found at: ${fontsDir}. Attempting to list contents...`);
            try {
                const filesInFontsDir = fs.readdirSync(fontsDir);
                debugLogger.log(`[PDF Gen] Files successfully listed in ${fontsDir}: [${filesInFontsDir.join(', ')}]`);
                if (filesInFontsDir.length === 0) {
                    logger.warn(`[PDF Gen] Warning: Fonts directory ${fontsDir} is empty.`);
                }
            } catch (readDirError: any) {
                logger.warn(`[PDF Gen] Warning: Could not read contents of fonts directory ${fontsDir}, though the directory itself exists. Error: ${readDirError.message}`);
            }
        }
        
        // --- Load Regular Font ---
        const regularFontPath = path.join(fontsDir, regularFontName);
        debugLogger.log(`[PDF Gen] Attempting to load regular font from absolute path: ${regularFontPath}`);
        
        if (!fs.existsSync(regularFontPath)) {
            logger.error(`[PDF Gen] CRITICAL: Regular font file '${regularFontName}' NOT FOUND at specified path: ${regularFontPath}.`);
            return { success: false, error: `Core font file (${regularFontName}) for PDF generation is missing on the server. Path checked: ${regularFontPath}` };
        }
        
        let regularFontBytes;
        try {
            regularFontBytes = fs.readFileSync(regularFontPath);
            debugLogger.log(`[PDF Gen] Successfully read regular font file '${regularFontName}'. Size: ${regularFontBytes.byteLength} bytes.`);
        } catch (fontError: any) {
            logger.error(`[PDF Gen] CRITICAL: Failed to READ regular font file '${regularFontName}' from ${regularFontPath}. Error: ${fontError.message}`);
            return { success: false, error: `Failed to read core font file (${regularFontName}). Ensure it's not corrupted and server has permissions. Path: ${regularFontPath}` };
        }
        
        const customFont = await pdfDoc.embedFont(regularFontBytes, { subset: true });
        debugLogger.log(`[PDF Gen] Regular font '${regularFontName}' embedded successfully into PDF.`);
        
        // --- Load Bold Font ---
        let customBoldFont: PDFFont;
        const boldFontPath = path.join(fontsDir, boldFontName);
        debugLogger.log(`[PDF Gen] Attempting to load bold font from absolute path: ${boldFontPath}`);

        if (!fs.existsSync(boldFontPath)) {
            logger.warn(`[PDF Gen] Warning: Bold font file '${boldFontName}' NOT FOUND at ${boldFontPath}. Falling back to regular font for bold text.`);
            customBoldFont = customFont; 
        } else {
            try {
                const boldFontBytes = fs.readFileSync(boldFontPath);
                debugLogger.log(`[PDF Gen] Successfully read bold font file '${boldFontName}'. Size: ${boldFontBytes.byteLength} bytes.`);
                customBoldFont = await pdfDoc.embedFont(boldFontBytes, { subset: true });
                debugLogger.log(`[PDF Gen] Bold font '${boldFontName}' embedded successfully into PDF.`);
            } catch (fontError: any) {
                logger.warn(`[PDF Gen] Warning: Failed to READ bold font file '${boldFontName}' from ${boldFontPath}. Using regular font for bold text. Error: ${fontError.message}`);
                customBoldFont = customFont; 
            }
        }

        // --- Create PDF Document ---
        let page = pdfDoc.addPage(PageSizes.A4);
        const { width, height } = page.getSize();
        
        const baseFontSize = 10;
        const lineHeight = 14;
        let currentY = height - margin;

        const sanitizedTitleFileName = originalFileName.replace(/[^\w\s\d.,!?"'%*()\-+=\[\]{};:@#~$&\/\\]/g, "_");

        page.drawText(`AI Analysis Report: ${sanitizedTitleFileName}`, {
            x: margin,
            y: currentY,
            font: customBoldFont, 
            size: 16,
            color: rgb(0.1, 0.1, 0.4)
        });
        currentY -= 30;

        const lines = markdownContent.split('\n');

        for (const line of lines) {
            if (currentY < margin + lineHeight) { 
                page = pdfDoc.addPage(PageSizes.A4);
                currentY = height - margin;
                 page.drawText(`AI Analysis Report: ${sanitizedTitleFileName} (cont.)`, {
                    x: margin, y: currentY, font: customBoldFont, size: 12, color: rgb(0.2,0.2,0.2)
                });
                currentY -= 20;
            }

            if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
                page.drawLine({
                    start: { x: margin, y: currentY - (lineHeight / 3) },
                    end: { x: width - margin, y: currentY - (lineHeight / 3) },
                    thickness: 1,
                    color: rgb(0.7, 0.7, 0.7),
                });
                currentY -= lineHeight;
            } else {
                 currentY = await drawMarkdownWrappedText(
                    page,
                    line,
                    margin,
                    currentY,
                    width - 2 * margin,
                    lineHeight,
                    customFont, 
                    customBoldFont,
                    baseFontSize,
                    rgb(0.1, 0.1, 0.1)
                );
            }
        }

        const pdfBytes = await pdfDoc.save();
        debugLogger.log(`[Markdown to PDF Action] PDF generated from Markdown. Size: ${pdfBytes.byteLength} bytes.`);

        const pdfFileName = `AI_Report_${originalFileName.replace(/[^\w\d_.-]/g, "_").replace(/\.\w+$/, "")}.pdf`;
        
        const sendResult = await sendTelegramDocument(chatId, new Blob([pdfBytes], { type: 'application/pdf' }), pdfFileName);

        if (sendResult.success) {
            logger.info(`[Markdown to PDF Action] PDF "${pdfFileName}" sent successfully to chat ID ${chatId}.`);
            return { success: true, message: `PDF report "${pdfFileName}" based on AI analysis has been sent to your Telegram chat.` };
        } else {
            logger.error(`[Markdown to PDF Action] Failed to send PDF to Telegram for chat ID ${chatId}: ${sendResult.error}`);
            return { success: false, error: `Failed to send PDF to Telegram: ${sendResult.error}` };
        }

    } catch (error) {
        logger.error('[Markdown to PDF Action] Critical error during PDF generation or sending:', error);
        const errorMsg = error instanceof Error ? error.message : 'An unexpected server error occurred during PDF processing.';
        return { success: false, error: errorMsg };
    }
}