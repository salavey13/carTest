"use server";

import { sendTelegramDocument } from '@/app/actions';
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';

// Use require for pdf-lib to ensure stable access to static methods like registerFontkit
// in Next.js server environments, especially when externalized.
const { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont } = require('pdf-lib');
import fs from 'fs';
import path from 'path';
import fontkit from '@pdf-lib/fontkit';

// Register fontkit with the PDFDocument class obtained via require.
// This must be done *after* pdf-lib is loaded via require.
try {
    PDFDocument.registerFontkit(fontkit);
    debugLogger.log("[PDF Gen] fontkit registered with PDFDocument successfully (via require).");
} catch (e: any) {
    logger.error("[PDF Gen] CRITICAL: Failed to register fontkit with PDFDocument.", e);
    // This is a critical failure, re-throw or handle appropriately if actions can't proceed.
    // For now, it will likely cause failures downstream in embedFont.
}


// Helper function definitions remain the same.
async function drawMarkdownWrappedText(
    page: any, // Should be PDFPage from pdf-lib but require might make types tricky without more setup
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    baseFont: any, // PDFFont
    boldFont: any, // PDFFont
    baseFontSize: number,
    color = rgb(0, 0, 0)
): Promise<number> {
    const lines = text.split('\n');
    let currentY = y;
    const margin = 50; // Assuming this is page margin, already accounted for in x, y, maxWidth

    for (const line of lines) {
        if (currentY < margin) { // Check against bottom margin
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
            currentX += 10; // Indent for list items
        } else if (line.match(/^(\s*)\* /) || line.match(/^(\s*)- /)) { // Nested lists
            const indentMatch = line.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[0].length : 0;
            currentX += 10 + (indent * 5); // Base indent + nested indent
            lineToDraw = `• ${line.replace(/^(\s*)[\*-] /, '')}`;
        }

        const words = lineToDraw.split(' ');
        let currentLineSegment = '';
        for (const word of words) {
            const testSegment = currentLineSegment + (currentLineSegment ? ' ' : '') + word;
            try {
                // widthOfTextAtSize might not be available if font is not correctly typed PDFFont
                const textWidth = effectiveFont.widthOfTextAtSize(testSegment, effectiveSize);
                if (currentX + textWidth > maxWidth && currentLineSegment) {
                    page.drawText(currentLineSegment, { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
                    currentY -= lineHeight * (effectiveSize / baseFontSize); // Adjust line height based on font size changes
                    currentLineSegment = word;
                    if (currentY < margin) break; // Check again after moving Y
                } else {
                    currentLineSegment = testSegment;
                }
            } catch (e: any) {
                logger.warn(`[PDF Gen] Skipping character/word due to font error: "${word}" in segment "${testSegment}". Error: ${e.message}`);
                // Attempt to replace problematic characters if any, or just skip.
                // This usually happens if a character is not in the font's glyph set.
                // For DejaVuSans, this should be rare for Cyrillic, but good to have fallback.
                currentLineSegment = currentLineSegment.replace(/[^\x00-\u04FF\u0500-\u052F\s\d\p{P}]/gu, "?"); // Keep ASCII, Cyrillic, spaces, digits, punctuation
            }
        }
        if (currentLineSegment && currentY >= margin) {
            try {
                page.drawText(currentLineSegment, { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
            } catch (e: any) {
                logger.warn(`[PDF Gen] Skipping final line segment due to font error: "${currentLineSegment}". Error: ${e.message}`);
                page.drawText(currentLineSegment.replace(/[^\x00-\u04FF\u0500-\u052F\s\d\p{P}]/gu, "?"), { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
            }
            currentY -= lineHeight * (effectiveSize / baseFontSize); // Adjust line height
        }
        if (currentY < margin) break;
    }
    return currentY;
}
const pageMargins = 50; // Consistent margin definition

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

        const regularFontName = 'DejaVuSans.ttf';
        const boldFontName = 'DejaVuSans-Bold.ttf';
        const currentWorkingDirectory = process.cwd();
        const fontsDir = path.join(currentWorkingDirectory, 'server-assets', 'fonts');

        debugLogger.log(`[PDF Gen] Current working directory (process.cwd()): ${currentWorkingDirectory}`);
        debugLogger.log(`[PDF Gen] Attempting to access fonts directory at absolute path: ${fontsDir}`);

        if (!fs.existsSync(fontsDir)) {
            logger.error(`[PDF Gen] CRITICAL: Fonts directory NOT FOUND at specified path: ${fontsDir}.`);
            return { success: false, error: `Core fonts directory missing on server. Expected at: ${fontsDir}.` };
        } else {
            debugLogger.log(`[PDF Gen] Fonts directory found at: ${fontsDir}. Checking contents...`);
            try {
                const filesInFontsDir = fs.readdirSync(fontsDir);
                debugLogger.log(`[PDF Gen] Files in ${fontsDir}: [${filesInFontsDir.join(', ')}]`);
                if (filesInFontsDir.length === 0) {
                    logger.warn(`[PDF Gen] Warning: Fonts directory ${fontsDir} is empty.`);
                }
            } catch (readDirError: any) {
                logger.warn(`[PDF Gen] Warning: Could not read contents of fonts directory ${fontsDir}. Error: ${readDirError.message}`);
            }
        }
        
        const regularFontPath = path.join(fontsDir, regularFontName);
        debugLogger.log(`[PDF Gen] Attempting to load regular font from: ${regularFontPath}`);
        if (!fs.existsSync(regularFontPath)) {
            logger.error(`[PDF Gen] CRITICAL: Regular font file '${regularFontName}' NOT FOUND at: ${regularFontPath}.`);
            return { success: false, error: `Font file (${regularFontName}) missing. Path: ${regularFontPath}` };
        }
        
        let regularFontBytes;
        try {
            regularFontBytes = fs.readFileSync(regularFontPath);
            debugLogger.log(`[PDF Gen] Read regular font '${regularFontName}'. Size: ${regularFontBytes.byteLength} bytes.`);
        } catch (fontError: any) {
            logger.error(`[PDF Gen] CRITICAL: Failed to READ regular font '${regularFontName}' from ${regularFontPath}. Error: ${fontError.message}`);
            return { success: false, error: `Failed to read font file (${regularFontName}). Path: ${regularFontPath}` };
        }
        
        const customFont = await pdfDoc.embedFont(regularFontBytes); 
        debugLogger.log(`[PDF Gen] Custom font '${regularFontName}' embedded.`);
        
        let customBoldFont: any; // PDFFont
        const boldFontPath = path.join(fontsDir, boldFontName);
        debugLogger.log(`[PDF Gen] Attempting to load bold font from: ${boldFontPath}`);

        if (!fs.existsSync(boldFontPath)) {
            logger.warn(`[PDF Gen] Warning: Bold font '${boldFontName}' NOT FOUND at ${boldFontPath}. Using regular font for bold.`);
            customBoldFont = customFont; 
        } else {
            try {
                const boldFontBytes = fs.readFileSync(boldFontPath);
                debugLogger.log(`[PDF Gen] Read bold font '${boldFontName}'. Size: ${boldFontBytes.byteLength} bytes.`);
                customBoldFont = await pdfDoc.embedFont(boldFontBytes); 
                debugLogger.log(`[PDF Gen] Custom bold font '${boldFontName}' embedded.`);
            } catch (fontError: any) {
                logger.warn(`[PDF Gen] Warning: Failed to READ bold font '${boldFontName}' from ${boldFontPath}. Using regular for bold. Error: ${fontError.message}`);
                customBoldFont = customFont; 
            }
        }

        let page = pdfDoc.addPage(PageSizes.A4);
        const { width, height } = page.getSize();
        
        const baseFontSize = 10;
        const lineHeight = 14;
        let currentY = height - pageMargins;

        const sanitizedTitleFileName = originalFileName.replace(/[^\w\s\d.,!?"'%*()\-+=\[\]{};:@#~$&\/\\]/g, "_");

        page.drawText(`AI Analysis Report: ${sanitizedTitleFileName}`, {
            x: pageMargins,
            y: currentY,
            font: customBoldFont, 
            size: 16,
            color: rgb(0.1, 0.1, 0.4)
        });
        currentY -= 30;

        const lines = markdownContent.split('\n');

        for (const line of lines) {
            if (currentY < pageMargins + lineHeight) { 
                page = pdfDoc.addPage(PageSizes.A4);
                currentY = height - pageMargins;
                page.drawText(`AI Analysis Report: ${sanitizedTitleFileName} (cont.)`, {
                    x: pageMargins, y: currentY, font: customBoldFont, size: 12, color: rgb(0.2,0.2,0.2)
                });
                currentY -= 20;
            }

            if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
                page.drawLine({
                    start: { x: pageMargins, y: currentY - (lineHeight / 3) },
                    end: { x: width - pageMargins, y: currentY - (lineHeight / 3) },
                    thickness: 1,
                    color: rgb(0.7, 0.7, 0.7),
                });
                currentY -= lineHeight;
            } else {
                 currentY = await drawMarkdownWrappedText(
                    page,
                    line,
                    pageMargins, // x
                    currentY,    // y
                    width - (2 * pageMargins), // maxWidth
                    lineHeight,
                    customFont, 
                    customBoldFont,
                    baseFontSize,
                    rgb(0.1, 0.1, 0.1)
                );
            }
        }

        const pdfBytes = await pdfDoc.save();
        debugLogger.log(`[Markdown to PDF Action] PDF generated. Size: ${pdfBytes.byteLength} bytes.`);

        const pdfFileName = `AI_Report_${originalFileName.replace(/[^\w\d_.-]/g, "_").replace(/\.\w+$/, "")}.pdf`;
        
        const sendResult = await sendTelegramDocument(chatId, new Blob([pdfBytes], { type: 'application/pdf' }), pdfFileName);

        if (sendResult.success) {
            logger.info(`[Markdown to PDF Action] PDF "${pdfFileName}" sent to chat ID ${chatId}.`);
            return { success: true, message: `PDF report "${pdfFileName}" sent to Telegram.` };
        } else {
            logger.error(`[Markdown to PDF Action] Failed to send PDF to Telegram for chat ID ${chatId}: ${sendResult.error}`);
            return { success: false, error: `Failed to send PDF to Telegram: ${sendResult.error}` };
        }

    } catch (error) {
        logger.error('[Markdown to PDF Action] Critical error during PDF generation or sending:', error);
        const errorMsg = error instanceof Error ? error.message : 'An unexpected server error occurred during PDF processing.';
         // Check if the error is specifically the fontkit registration issue to provide a more specific message
        if (error instanceof Error && error.message.toLowerCase().includes("registerfontkit is not a function")) {
             return { success: false, error: "Critical PDF library setup error (fontkit). Please contact support." };
        }
        return { success: false, error: errorMsg };
    }
}