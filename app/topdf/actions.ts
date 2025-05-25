"use server";

import { sendTelegramDocument } from '@/app/actions';
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';

// Use require for pdf-lib and fontkit
const pdfLibModule = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');

// --- PDF LIBRARY DIAGNOSTICS (runs once on cold start) ---
console.log('--- PDF LIBRARY DIAGNOSTICS START ---');
try {
    const pdfLibKeys = Object.keys(pdfLibModule || {});
    console.log(`[PDF DIAG] Keys of require("pdf-lib") (${pdfLibKeys.length}): ${pdfLibKeys.join(', ')}`);
    console.log(`[PDF DIAG] typeof require("pdf-lib").registerFontkit (on module itself): typeof ${(pdfLibModule || {}).registerFontkit}`);

    if (pdfLibModule && pdfLibModule.PDFDocument) {
        const PDFD = pdfLibModule.PDFDocument;
        console.log('[PDF DIAG] pdfLibModule.PDFDocument IS PRESENT.');
        const pdfDKeys = Object.keys(PDFD || {});
        console.log(`[PDF DIAG] Keys of pdfLibModule.PDFDocument (${pdfDKeys.length}): ${pdfDKeys.join(', ')}`);
        if (PDFD.prototype) {
            const protoKeys = Object.keys(PDFD.prototype);
            console.log(`[PDF DIAG] Keys of pdfLibModule.PDFDocument.prototype (${protoKeys.length}): ${protoKeys.join(', ')}`);
        } else {
            console.log('[PDF DIAG] pdfLibModule.PDFDocument.prototype IS NOT PRESENT.');
        }
        console.log(`[PDF DIAG] typeof pdfLibModule.PDFDocument.registerFontkit: typeof ${(PDFD || {}).registerFontkit}`);
    } else {
        console.log('[PDF DIAG] require("pdf-lib").PDFDocument IS UNDEFINED or NULL.');
    }

    const fontkitKeys = Object.keys(fontkitModule || {});
    console.log(`[PDF DIAG] Keys of require("@pdf-lib/fontkit") (${fontkitKeys.length}): ${fontkitKeys.join(', ')}`);
    console.log(`[PDF DIAG] typeof require("@pdf-lib/fontkit").default: typeof ${(fontkitModule || {}).default}`);
    console.log(`[PDF DIAG] typeof require("@pdf-lib/fontkit") (module itself): typeof ${fontkitModule}`);
} catch (e: any) {
    console.error('[PDF DIAG] Error during initial diagnostics logging:', e.message, e.stack);
}
console.log('--- PDF LIBRARY DIAGNOSTICS END ---');
// --- END DIAGNOSTICS ---

const { StandardFonts, rgb, PageSizes } = pdfLibModule;
// Note: PDFDocument will be determined dynamically later.
type PDFFont = any; 

let fontkitRegistered = false;

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
    originalFileName: string = "report"
): Promise<{ success: boolean; message?: string; error?: string }> {
    debugLogger.log(`[Markdown to PDF Action] Initiated for Chat ID: ${chatId}`);

    if (!chatId) {
        return { success: false, error: "User chat ID not provided." };
    }
    if (!markdownContent || !markdownContent.trim()) {
        return { success: false, error: "No Markdown content provided to generate PDF." };
    }

    let PDFDocumentClass: any; // Will hold the actual PDFDocument class

    try {
        if (!fontkitRegistered) {
            debugLogger.log("[PDF Gen] Attempting to register fontkit...");
            
            let determinedPDFDocumentClass: any;
            if (pdfLibModule && pdfLibModule.PDFDocument && typeof pdfLibModule.PDFDocument.registerFontkit === 'function') {
                determinedPDFDocumentClass = pdfLibModule.PDFDocument;
                debugLogger.log("[PDF Gen] Using 'pdfLibModule.PDFDocument' as PDFDocument class.");
            } else if (pdfLibModule && typeof pdfLibModule.registerFontkit === 'function') {
                // Fallback: pdfLibModule itself might be the PDFDocument class
                determinedPDFDocumentClass = pdfLibModule;
                debugLogger.log("[PDF Gen] Using 'pdfLibModule' (direct require result) as PDFDocument class.");
            } else {
                logger.error("[PDF Gen] CRITICAL: Could not determine usable PDFDocument class from require('pdf-lib'). 'registerFontkit' method not found on expected objects.");
                return { success: false, error: "Critical PDF library load error (PDFDocument class with registerFontkit not found)." };
            }

            const fontkitInstanceToUse = fontkitModule.default || fontkitModule;

            try {
                determinedPDFDocumentClass.registerFontkit(fontkitInstanceToUse);
                fontkitRegistered = true;
                PDFDocumentClass = determinedPDFDocumentClass; // Store the successfully used class
                debugLogger.log("[PDF Gen] fontkit registered successfully.");
            } catch (registrationError: any) {
                logger.error("[PDF Gen] CRITICAL: Error during fontkit registration call:", registrationError);
                return { success: false, error: `PDF library error during fontkit registration: ${registrationError.message}` };
            }
        } else {
             // If already registered, ensure PDFDocumentClass is set from the module
            if (pdfLibModule && pdfLibModule.PDFDocument) {
                PDFDocumentClass = pdfLibModule.PDFDocument;
            } else if (pdfLibModule && typeof pdfLibModule.registerFontkit === 'function') {
                 PDFDocumentClass = pdfLibModule;
            } else {
                 logger.error("[PDF Gen] CRITICAL: fontkit was marked registered, but PDFDocument class could not be re-determined.");
                 return { success: false, error: "Critical PDF library inconsistency after fontkit registration." };
            }
            debugLogger.log("[PDF Gen] fontkit already registered. Using determined PDFDocumentClass.");
        }

        if (!PDFDocumentClass) {
             logger.error("[PDF Gen] CRITICAL: PDFDocumentClass is not defined before PDF creation. This should not happen.");
             return { success: false, error: "Internal error: PDFDocument class not initialized." };
        }

        const pdfDoc = await PDFDocumentClass.create();

        const regularFontName = 'DejaVuSans.ttf';
        const boldFontName = 'DejaVuSans-Bold.ttf';
        const currentWorkingDirectory = process.cwd();
        const fontsDir = path.join(currentWorkingDirectory, 'server-assets', 'fonts');

        // ... (rest of the font loading and PDF generation logic remains the same)
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
            customBoldFont = customFont; 
        } else {
            try {
                const boldFontBytes = fs.readFileSync(boldFontPath);
                customBoldFont = await pdfDoc.embedFont(boldFontBytes); 
            } catch (fontError: any) {
                customBoldFont = customFont; 
            }
        }

        let page = pdfDoc.addPage(PageSizes.A4);
        const { width, height } = page.getSize();
        let currentY = height - pageMargins;
        const baseFontSize = 10;
        const lineHeight = 14;
        const sanitizedTitleFileName = originalFileName.replace(/[^\w\s\d.,!?"'%*()\-+=\[\]{};:@#~$&\/\\]/g, "_");

        page.drawText(`AI Analysis Report: ${sanitizedTitleFileName}`, {
            x: pageMargins, y: currentY, font: customBoldFont, size: 16, color: rgb(0.1, 0.1, 0.4)
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
        const pdfFileName = `AI_Report_${originalFileName.replace(/[^\w\d_.-]/g, "_").replace(/\.\w+$/, "")}.pdf`;
        const sendResult = await sendTelegramDocument(chatId, new Blob([pdfBytes], { type: 'application/pdf' }), pdfFileName);

        if (sendResult.success) {
            return { success: true, message: `PDF report "${pdfFileName}" sent.` };
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