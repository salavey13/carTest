"use server";

import { useAppContext } from '@/contexts/AppContext'; // Not usable in Server Actions directly for user ID
import { sendTelegramDocument } from '@/app/actions';
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import { supabaseAdmin } from '@/hooks/supabase'; // For getting user_id if not passed

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Helper function to verify admin status (optional, if you want to restrict this action)
async function verifyAdmin(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    if (!supabaseAdmin) {
       logger.error("Admin client unavailable for verification in toPdf actions.");
       return false;
    }
    try {
       const { data: user, error } = await supabaseAdmin
           .from('users')
           .select('status, role')
           .eq('user_id', userId)
           .single();

       if (error || !user) {
           logger.warn(`Admin verification failed for user ${userId} in toPdf: ${error?.message || 'User not found'}`);
           return false;
       }
       const isAdmin = user.status === 'admin' || user.role === 'admin' || user.role === 'vprAdmin';
       debugLogger.log(`Admin verification for ${userId} in toPdf: ${isAdmin}`);
       return isAdmin;
    } catch (err) {
       logger.error(`Exception during admin verification for user ${userId} in toPdf:`, err);
       return false;
    }
}


export async function convertXlsxToPdfAndSend(
    formData: FormData,
    chatId: string // Passed from client, derived from useAppContext
): Promise<{ success: boolean; message?: string; error?: string }> {
    debugLogger.log(`[toPdf Action] Initiated by chat ID: ${chatId}`);

    if (!chatId) {
        return { success: false, error: "User chat ID not provided. Cannot send PDF." };
    }

    const file = formData.get('xlsxFile') as File;

    // 1. --- File Validation ---
    if (!file) {
        return { success: false, error: 'No file provided.' };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return { success: false, error: `File is too large. Maximum size: ${MAX_FILE_SIZE_MB}MB.` };
    }
    if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !file.name.endsWith('.xlsx')) {
        return { success: false, error: 'Invalid file type. Only XLSX files are accepted.' };
    }

    debugLogger.log(`[toPdf Action] File validated: ${file.name}, size: ${file.size} bytes`);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return { success: false, error: 'The XLSX file is empty or contains no sheets.' };
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 }); // array of arrays

        debugLogger.log(`[toPdf Action] Parsed XLSX. Sheet: ${firstSheetName}, ${jsonData.length} rows.`);

        // 2. --- PDF Generation (Simple Text Dump) ---
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.A4);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 10;
        const margin = 50;
        let y = height - margin;

        page.drawText(`Report from: ${file.name}`, {
            x: margin,
            y,
            font,
            size: fontSize + 4,
            color: rgb(0.1, 0.1, 0.1),
        });
        y -= (fontSize + 4) * 1.5;

        page.drawText(`Sheet: ${firstSheetName}`, {
            x: margin,
            y,
            font,
            size: fontSize + 2,
            color: rgb(0.2, 0.2, 0.2),
        });
        y -= (fontSize + 2) * 1.5;


        for (const row of jsonData) {
            if (y < margin + fontSize) { // Check for page break
                // page = pdfDoc.addPage(PageSizes.A4); // Add new page
                // y = height - margin; // Reset y position
                // For MVP, let's just stop if content exceeds one page to keep it simple
                logger.warn("[toPdf Action] PDF content exceeded one page for MVP. Truncating.");
                break;
            }

            const rowText = (row as any[])
                .map(cell => (cell !== null && cell !== undefined ? String(cell) : ''))
                .join(' | '); // Simple delimiter

            if (rowText.trim()) { // Only draw non-empty rows
                 // Simple text wrapping attempt
                const textWidth = font.widthOfTextAtSize(rowText, fontSize);
                const maxWidth = width - 2 * margin;

                if (textWidth > maxWidth) {
                    // Basic split, could be improved with word wrapping logic
                    const chunks = [];
                    let currentChunk = "";
                    for (const word of rowText.split(' ')) {
                        if (font.widthOfTextAtSize(currentChunk + word + " ", fontSize) > maxWidth) {
                            chunks.push(currentChunk.trim());
                            currentChunk = word + " ";
                        } else {
                            currentChunk += word + " ";
                        }
                    }
                    chunks.push(currentChunk.trim());

                    for (const chunk of chunks) {
                        if (y < margin + fontSize) break; // Stop if out of space
                        page.drawText(chunk, { x: margin, y, font, size: fontSize, color: rgb(0, 0, 0) });
                        y -= fontSize * 1.2;
                    }

                } else {
                    page.drawText(rowText, { x: margin, y, font, size: fontSize, color: rgb(0, 0, 0) });
                    y -= fontSize * 1.2; // Line height
                }
            }
        }

        const pdfBytes = await pdfDoc.save();
        debugLogger.log(`[toPdf Action] PDF generated. Size: ${pdfBytes.byteLength} bytes.`);

        // 3. --- Send PDF to Telegram ---
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfFileName = `converted_${file.name.replace(/\.xlsx$/i, '')}.pdf`;

        const sendResult = await sendTelegramDocument(chatId, pdfBlob, pdfFileName);

        if (sendResult.success) {
            logger.info(`[toPdf Action] PDF "${pdfFileName}" sent successfully to chat ID ${chatId}.`);
            return { success: true, message: `PDF "${pdfFileName}" has been sent to your Telegram chat.` };
        } else {
            logger.error(`[toPdf Action] Failed to send PDF to Telegram for chat ID ${chatId}: ${sendResult.error}`);
            return { success: false, error: `Failed to send PDF to Telegram: ${sendResult.error}` };
        }

    } catch (error) {
        logger.error('[toPdf Action] Critical error during XLSX to PDF conversion:', error);
        const errorMsg = error instanceof Error ? error.message : 'An unexpected server error occurred during conversion.';
        // Optionally notify admin on critical errors
        // await notifyAdmin(`[toPdf Action CRITICAL ERROR] User: ${chatId}, File: ${file.name}, Error: ${errorMsg}`);
        return { success: false, error: errorMsg };
    }
}