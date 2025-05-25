"use server";

import { sendTelegramDocument } from '@/app/actions';
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
// Use direct import for PDFDocument and related types/constants from pdf-lib
// Removed fontkit import as we are now using standard fonts
import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont } from 'pdf-lib';
import fs from 'fs'; 
import path from 'path'; 

// Helper to draw wrapped text in PDF, considering basic Markdown
async function drawMarkdownWrappedText(
    page: /* import('pdf-lib').PDFPage */ any, 
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    baseFont: PDFFont, // Use PDFFont type as it's compatible with embedded standard fonts
    boldFont: PDFFont, // Use PDFFont type
    baseFontSize: number,
    color = rgb(0, 0, 0)
): Promise<number> {
    const lines = text.split('\n');
    let currentY = y;
    // const margin = 50; // margin is already defined globally

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
                // With standard fonts, this error should be very rare unless text contains non-ASCII characters not covered by the font subset.
                logger.warn(`[PDF Gen] Skipping character/word due to font error (standard font): "${word}" in segment "${testSegment}". Error: ${e.message}`);
                currentLineSegment = currentLineSegment.replace(/[^\x00-\x7F]/g, "?"); // Replace problematic chars
            }
        }
        if (currentLineSegment && currentY >= margin) {
             try {
                page.drawText(currentLineSegment, { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
             } catch (e: any) {
                 logger.warn(`[PDF Gen] Skipping final line segment due to font error (standard font): "${currentLineSegment}". Error: ${e.message}`);
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
        const pdfDoc = await PDFDocument.create();
        
        // Use Standard Fonts directly. No need for fontkit or reading font files.
        const customFont = await pdfDoc.embedStandardFont(StandardFonts.TimesRoman);
        debugLogger.log(`[PDF Gen] Standard font '${StandardFonts.TimesRoman}' embedded successfully into PDF.`);
        
        const customBoldFont = await pdfDoc.embedStandardFont(StandardFonts.TimesRomanBold);
        debugLogger.log(`[PDF Gen] Standard bold font '${StandardFonts.TimesRomanBold}' embedded successfully into PDF.`);
        
        // No longer need to check for fontsDir or font files as standard fonts are used.
        // const currentWorkingDirectory = process.cwd();
        // const fontsDir = path.join(currentWorkingDirectory, 'server-assets', 'fonts');
        // if (!fs.existsSync(fontsDir)) { ... } // Removed
        // let regularFontBytes = fs.readFileSync(regularFontPath); // Removed
        // const boldFontBytes = fs.readFileSync(boldFontPath); // Removed

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