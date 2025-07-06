// /app/topdf/pdfGenerator.ts
"use server";

import { logger } from '@/lib/logger';
import path from 'path'; 
import fs from 'fs';   

const pdfLibModule = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');
const { rgb, PageSizes } = pdfLibModule; 
type PDFFont = any; 
const pageMargins = 50;

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
    
    for (const line of lines) {
        if (currentY < pageMargins + lineHeight) { 
            logger.warn("[PDF Gen drawMarkdownWrappedText] Content potentially overflowing page for this line segment. Stopping text draw for this line and subsequent ones in this call.");
            return currentY; 
        }

        let effectiveFont = baseFont;
        let effectiveSize = baseFontSize;
        let currentX = x;
        let lineToDraw = line;

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

        const words = lineToDraw.split(' ');
        let currentLineSegment = '';
        for (const word of words) {
            const testSegment = currentLineSegment + (currentLineSegment ? ' ' : '') + word;
            let textWidth = 0;
            try {
                const sanitizedTestSegment = testSegment.replace(/[^\x00-\uFFFF]/g, "?");
                textWidth = effectiveFont.widthOfTextAtSize(sanitizedTestSegment, effectiveSize);

                if (currentX + textWidth > maxWidth && currentLineSegment) {
                    if (currentY < pageMargins + lineHeight) { logger.warn("[PDF Gen drawMarkdownWrappedText] Overflow during word wrap."); return currentY; }
                    page.drawText(currentLineSegment.replace(/[^\x00-\uFFFF]/g, "?"), { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
                    currentY -= lineHeight * (effectiveSize / baseFontSize);
                    currentLineSegment = word; 
                } else {
                    currentLineSegment = testSegment;
                }
            } catch (e: any) {
                logger.warn(`[PDF Gen drawMarkdownWrappedText] Error measuring/processing word: "${word}" in segment "${testSegment}". Error: ${e.message}. Replacing unsupported chars.`);
                const sanitizedWord = word.replace(/[^\x00-\uFFFF]/g, "?");
                currentLineSegment = currentLineSegment + (currentLineSegment ? ' ' : '') + sanitizedWord; 
            }
        }
        if (currentLineSegment) { 
            if (currentY < pageMargins + lineHeight) { logger.warn("[PDF Gen drawMarkdownWrappedText] Overflow at end of line."); return currentY; }
             try {
                page.drawText(currentLineSegment.replace(/[^\x00-\uFFFF]/g, "?"), { x: currentX, y: currentY, font: effectiveFont, size: effectiveSize, color });
            } catch (e: any) {
                logger.warn(`[PDF Gen drawMarkdownWrappedText] Final attempt to draw sanitized line segment failed: "${currentLineSegment}". Error: ${e.message}`);
            }
        }
        currentY -= lineHeight * (effectiveSize / baseFontSize); 
    }
    return currentY; 
}

async function generatePdfFromContentInternal(
    markdownContent: string,
    originalFileName: string = "report",
    userName?: string, 
    userAge?: string,  
    userGender?: string,
    heroImageUrl?: string 
): Promise<Uint8Array> {
    logger.log(`[PDF Gen Internal] Initiated. User: ${userName || 'N/A'}`);
    
    const PDFDocumentClass = pdfLibModule.PDFDocument;
    const fontkitInstanceToUse = fontkitModule.default || fontkitModule;

    if (!PDFDocumentClass || typeof PDFDocumentClass.create !== 'function') {
        logger.error("[PDF Gen Internal] CRITICAL: PDFDocumentClass or PDFDocumentClass.create is not available.");
        throw new Error("Critical PDF library load error.");
    }
    const pdfDoc = await PDFDocumentClass.create();
    
    if (typeof pdfDoc.registerFontkit === 'function') {
        pdfDoc.registerFontkit(fontkitInstanceToUse);
    } else {
        logger.warn("[PDF Gen Internal] pdfDoc.registerFontkit is not a function. Font embedding might be limited.");
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
                logger.warn(`[PDF Gen Internal] Unsupported hero image type: ${heroImageUrl}. Skipping image.`);
            }

            if (embeddedImage) {
                const imgMaxWidth = width - 2 * pageMargins;
                const aspectRatio = embeddedImage.width / embeddedImage.height;
                const imgDisplayWidth = imgMaxWidth;
                const imgDisplayHeight = imgDisplayWidth / aspectRatio;

                if (currentY - imgDisplayHeight - 10 < pageMargins) { 
                    page = pdfDoc.addPage(PageSizes.A4);
                    currentY = height - pageMargins;
                }
                page.drawImage(embeddedImage, {
                    x: pageMargins,
                    y: currentY - imgDisplayHeight,
                    width: imgDisplayWidth,
                    height: imgDisplayHeight,
                });
                currentY -= (imgDisplayHeight + 15); 
            }
        } catch (imgError: any) {
            logger.error(`[PDF Gen Internal] Error embedding hero image from ${heroImageUrl}: ${imgError.message}`);
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
    return pdfDoc.save();
}

export async function generatePdfBytes(
    markdownContent: string,
    originalFileName?: string,
    userName?: string, 
    userAge?: string,  
    userGender?: string,
    heroImageUrl?: string 
): Promise<Uint8Array> {
    return generatePdfFromContentInternal(markdownContent, originalFileName, userName, userAge, userGender, heroImageUrl);
}