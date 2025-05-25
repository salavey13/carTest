"use server";

import { sendTelegramDocument, runCozeAgent } from '@/app/actions'; // Using runCozeAgent from existing actions
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont } from 'pdf-lib';
import { supabaseAdmin } from '@/hooks/supabase'; 

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// This should be your Coze Bot ID dedicated to financial report analysis
const FINANCIAL_ANALYZER_BOT_ID = process.env.COZE_FINANCIAL_ANALYZER_BOT_ID || "7377000000000000001"; // Placeholder - REPLACE THIS
const COZE_USER_ID_FOR_ANALYSIS = process.env.COZE_USER_ID_FOR_REPORTS || "default_report_user";


interface AISummaryResponse {
    report_title?: string;
    executive_summary?: string;
    key_findings?: Array<{ finding: string; details?: string; impact?: string }>;
    recommendations?: string[];
    data_period?: string;
    charts_summary?: string; // Future: AI could describe charts or key data points for charts
    conclusion?: string;
}

// Helper to draw wrapped text in PDF
async function drawWrappedText(
    page: import('pdf-lib').PDFPage,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    font: PDFFont,
    fontSize: number,
    color = rgb(0, 0, 0)
): Promise<number> {
    const words = text.split(' ');
    let currentLine = '';
    let currentY = y;

    for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const textWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (textWidth > maxWidth && currentLine) {
            page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
            currentY -= lineHeight;
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
        currentY -= lineHeight;
    }
    return currentY; // Return the new Y position
}


export async function convertXlsxToPdfAndSend(
    formData: FormData,
    chatId: string,
    userId: string // The actual user ID from useAppContext, for Coze call
): Promise<{ success: boolean; message?: string; error?: string }> {
    debugLogger.log(`[toPdf AI Action] Initiated by User ID: ${userId}, for Chat ID: ${chatId}`);

    if (!chatId) {
        return { success: false, error: "User chat ID not provided. Cannot send PDF." };
    }
     if (!userId) {
        return { success: false, error: "User ID not provided for AI Analysis." };
    }
     if (!FINANCIAL_ANALYZER_BOT_ID || FINANCIAL_ANALYZER_BOT_ID === "7377000000000000001") {
        logger.error("[toPdf AI Action] COZE_FINANCIAL_ANALYZER_BOT_ID is not configured or is placeholder.");
        return { success: false, error: "AI Analyzer Bot is not configured on the server." };
    }


    const file = formData.get('xlsxFile') as File;

    if (!file) return { success: false, error: 'No file provided.' };
    if (file.size > MAX_FILE_SIZE_BYTES) return { success: false, error: `File is too large. Maximum size: ${MAX_FILE_SIZE_MB}MB.` };
    if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !file.name.endsWith('.xlsx')) {
        return { success: false, error: 'Invalid file type. Only XLSX files are accepted.' };
    }

    debugLogger.log(`[toPdf AI Action] File validated: ${file.name}`);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return { success: false, error: 'The XLSX file is empty or contains no sheets.' };
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // Convert to CSV string for potentially simpler AI ingestion
        const csvDataString = XLSX.utils.sheet_to_csv(worksheet);
        
        debugLogger.log(`[toPdf AI Action] Parsed XLSX. Sheet: ${firstSheetName}. Data converted to CSV string (length: ${csvDataString.length})`);

        // --- AI Analysis Step ---
        const aiPrompt = `You are an expert financial analyst AI. Analyze the following financial data extracted from an XLSX report (provided as CSV content).
        Identify key trends, significant figures, potential risks, and actionable insights.
        The original filename was: ${file.name}. The data is from sheet: ${firstSheetName}.
        Please structure your response as a JSON object with the following fields:
        - "report_title": A concise title for this analysis, incorporating the original filename.
        - "executive_summary": A 2-3 sentence high-level overview of the financial state.
        - "key_findings": An array of objects, where each object has "finding" (a brief statement, e.g., 'Revenue Growth'), "details" (elaboration on the finding), and optionally "impact" (e.g., 'Positive', 'Negative', 'Neutral'). Max 5-7 key findings.
        - "recommendations": An array of 2-3 actionable recommendations based on your analysis.
        - "data_period": If identifiable from the data, state the period this report likely covers (e.g., "Q4 2023", "FY 2023").
        - "conclusion": A brief concluding remark.

        Here is the CSV data:
        \`\`\`csv
        ${csvDataString.substring(0, 15000)} 
        \`\`\`
        Ensure your entire response is a single, valid JSON object.`;

        logger.info(`[toPdf AI Action] Sending data to Coze Bot ID: ${FINANCIAL_ANALYZER_BOT_ID} for analysis by user ${userId}. Prompt length: ${aiPrompt.length}`);
        
        // Using runCozeAgent as a stand-in for executeCozeAgent if it's more generic
        const aiResult = await runCozeAgent(FINANCIAL_ANALYZER_BOT_ID, userId, aiPrompt);

        if (!aiResult.success || !aiResult.data) {
            logger.error("[toPdf AI Action] AI analysis failed or returned no data.", aiResult.error);
            return { success: false, error: `AI analysis failed: ${aiResult.error || 'No response from AI.'}` };
        }

        debugLogger.log("[toPdf AI Action] Raw AI Response:", aiResult.data);
        let aiSummary: AISummaryResponse;
        try {
            aiSummary = JSON.parse(aiResult.data);
        } catch (parseError) {
            logger.error("[toPdf AI Action] Failed to parse AI JSON response:", parseError, "Raw Data:", aiResult.data);
            return { success: false, error: "AI returned an invalid response format. Could not parse analysis." };
        }

        debugLogger.log("[toPdf AI Action] Parsed AI Summary:", aiSummary);

        // --- PDF Generation from AI Summary ---
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.A4);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const margin = 50;
        let y = height - margin;
        const textMaxWidth = width - 2 * margin;

        // Title
        page.drawText(aiSummary.report_title || `Financial Analysis of ${file.name}`, {
            x: margin, y, font: boldFont, size: 18, color: rgb(0.1, 0.1, 0.4)
        });
        y -= 30;

        // Executive Summary
        if (aiSummary.executive_summary) {
            page.drawText("Executive Summary", { x: margin, y, font: boldFont, size: 14, color: rgb(0.1, 0.1, 0.1) });
            y -= 20;
            y = await drawWrappedText(page, aiSummary.executive_summary, margin, y, textMaxWidth, 14, font, 10, rgb(0.2, 0.2, 0.2));
            y -= 15;
        }
        
        // Data Period
        if (aiSummary.data_period) {
             page.drawText("Data Period:", { x: margin, y, font: boldFont, size: 11, color: rgb(0.3,0.3,0.3) });
             page.drawText(aiSummary.data_period, { x: margin + 80, y, font: font, size: 11, color: rgb(0.3,0.3,0.3) });
             y -= 20;
        }


        // Key Findings
        if (aiSummary.key_findings && aiSummary.key_findings.length > 0) {
            page.drawText("Key Findings", { x: margin, y, font: boldFont, size: 14, color: rgb(0.1, 0.1, 0.1) });
            y -= 20;
            for (const finding of aiSummary.key_findings) {
                if (y < margin + 40) { page.addPage(); y = height - margin; } // Add new page if needed
                y = await drawWrappedText(page, `• ${finding.finding || 'N/A'}`, margin, y, textMaxWidth, 12, boldFont, 10);
                if (finding.details) {
                     y = await drawWrappedText(page, `  Details: ${finding.details}`, margin + 10, y, textMaxWidth - 10, 12, font, 9, rgb(0.3,0.3,0.3));
                }
                if (finding.impact) {
                     y = await drawWrappedText(page, `  Impact: ${finding.impact}`, margin + 10, y, textMaxWidth -10, 12, font, 9, rgb(0.3,0.3,0.3));
                }
                y -= 8;
            }
            y -= 15;
        }

        // Recommendations
        if (aiSummary.recommendations && aiSummary.recommendations.length > 0) {
            if (y < margin + 60) { page.addPage(); y = height - margin; }
            page.drawText("Recommendations", { x: margin, y, font: boldFont, size: 14, color: rgb(0.1, 0.1, 0.1) });
            y -= 20;
            for (const rec of aiSummary.recommendations) {
                if (y < margin + 20) { page.addPage(); y = height - margin; }
                y = await drawWrappedText(page, `• ${rec}`, margin, y, textMaxWidth, 12, font, 10);
                y -= 5;
            }
            y -= 15;
        }
        
        // Conclusion
        if (aiSummary.conclusion) {
            if (y < margin + 40) { page.addPage(); y = height - margin; }
            page.drawText("Conclusion", { x: margin, y, font: boldFont, size: 14, color: rgb(0.1, 0.1, 0.1) });
            y -= 20;
            y = await drawWrappedText(page, aiSummary.conclusion, margin, y, textMaxWidth, 14, font, 10, rgb(0.2, 0.2, 0.2));
        }

        // Footer
        const footerText = `Supervibe AI Analysis | Generated: ${new Date().toLocaleDateString()}`;
        const footerY = margin / 2;
        page.drawText(footerText, {
            x: margin, y: footerY, font, size: 8, color: rgb(0.5, 0.5, 0.5)
        });


        const pdfBytes = await pdfDoc.save();
        debugLogger.log(`[toPdf AI Action] AI-summary PDF generated. Size: ${pdfBytes.byteLength} bytes.`);

        // --- Send PDF to Telegram ---
        const pdfFileName = `AI_Analysis_${file.name.replace(/\.xlsx$/i, '')}.pdf`;
        // const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' }); // Blob for sendTelegramDocument
        // For sendTelegramDocument that takes string (fileContent), convert Uint8Array to string if needed, or adjust sendTelegramDocument
        // Assuming sendTelegramDocument is adapted to handle ArrayBuffer or Blob.
        // If it needs a string, this part needs adjustment based on sendTelegramDocument's new signature.
        // For now, assuming it can take a Blob.

        const sendResult = await sendTelegramDocument(chatId, new Blob([pdfBytes], { type: 'application/pdf' }), pdfFileName);


        if (sendResult.success) {
            logger.info(`[toPdf AI Action] AI-summary PDF "${pdfFileName}" sent successfully to chat ID ${chatId}.`);
            return { success: true, message: `AI-powered PDF summary "${pdfFileName}" has been sent to your Telegram chat.` };
        } else {
            logger.error(`[toPdf AI Action] Failed to send AI-summary PDF to Telegram for chat ID ${chatId}: ${sendResult.error}`);
            return { success: false, error: `Failed to send PDF to Telegram: ${sendResult.error}` };
        }

    } catch (error) {
        logger.error('[toPdf AI Action] Critical error during XLSX AI analysis to PDF:', error);
        const errorMsg = error instanceof Error ? error.message : 'An unexpected server error occurred during AI-powered conversion.';
        return { success: false, error: errorMsg };
    }
}