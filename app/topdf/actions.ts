"use server";

import { sendTelegramDocument } from '@/app/actions';
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont, PDFFontType } from 'pdf-lib';
import fs from 'fs'; // Import fs for reading font file
import path from 'path'; // Import path for constructing file path

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
                // Log character causing issue if possible, fallback to word/segment
                logger.warn(`[PDF Gen] Skipping character/word due to font error: "${word}" in segment "${testSegment}". Error: ${e.message}`);
                // Attempt to replace problematic characters or skip word - basic example:
                currentLineSegment = currentLineSegment.replace(/[^\x00-\x7F]/g, "?"); // Replace non-ASCII with ?
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
        const pdfDoc = await PDFDocument.create();
        
        // --- Load custom font that supports Cyrillic ---
        // Ensure this path is correct and the font file is included in your deployment
        const fontPath = path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf');
        let customFontBytes;
        try {
            customFontBytes = fs.readFileSync(fontPath);
        } catch (fontError) {
            logger.error(`[PDF Gen] CRITICAL: Failed to load font file at ${fontPath}. Error: ${fontError}`);
            return { success: false, error: "Font file for PDF generation is missing or unreadable on the server." };
        }
        
        const customFont = await pdfDoc.embedFont(customFontBytes, { subset: true }); // Enable subsetting
        // For bold, ideally, you'd load a DejaVuSans-Bold.ttf. If not available, use the same font.
        const customBoldFont = customFont; // Or load a specific bold variant if you have it.

        let page = pdfDoc.addPage(PageSizes.A4);
        const { width, height } = page.getSize();
        
        const baseFontSize = 10;
        const lineHeight = 14;
        let currentY = height - margin;

        page.drawText(`AI Analysis Report: ${originalFileName.replace(/[^\x00-\x7F]/g, "?")}`, { // Sanitize filename for title
            x: margin,
            y: currentY,
            font: customBoldFont, // Use custom bold font
            size: 16,
            color: rgb(0.1, 0.1, 0.4)
        });
        currentY -= 30;

        const lines = markdownContent.split('\n');

        for (const line of lines) {
            if (currentY < margin + lineHeight) { 
                page = pdfDoc.addPage(PageSizes.A4);
                currentY = height - margin;
                 page.drawText(`AI Analysis Report: ${originalFileName.replace(/[^\x00-\x7F]/g, "?")} (cont.)`, {
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
                    customFont, // Use custom font
                    customBoldFont, // Use custom bold font
                    baseFontSize,
                    rgb(0.1, 0.1, 0.1)
                );
            }
        }

        const pdfBytes = await pdfDoc.save();
        debugLogger.log(`[Markdown to PDF Action] PDF generated from Markdown. Size: ${pdfBytes.byteLength} bytes.`);

        const pdfFileName = `AI_Report_${originalFileName.replace(/[^\x00-\x7F_.\-]/g, "_").replace(/\.\w+$/, "")}.pdf`; // Sanitize filename further
        
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
        const errorMsg = error instanceof Error ? error.message : 'An unexpected server error occurred.';
        return { success: false, error: errorMsg };
    }
}