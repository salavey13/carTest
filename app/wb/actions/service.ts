"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import path from 'path'; 
import fs from 'fs';   
import { sendTelegramDocument } from "@/app/actions"; 

// Using dynamic import for pdf-lib to handle server-side fontkit registration
const pdfLib = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb } = pdfLib;

/**
 * Генерирует тактический отчет по рейду/смене (AAR)
 * Фокус на прозрачности выплат и пошаговом аудите действий.
 */
export async function generateCrewShiftPdf(userId: string, shiftId: string) {
  logger.info(`[AAR_GEN] Initiating PDF generation for Shift: ${shiftId} by User: ${userId}`);

  try {
    // 1. Извлечение полных данных смены
    const { data: shift, error: shiftError } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*, crews(name, slug), users(username, full_name)")
      .eq("id", shiftId)
      .single();

    if (shiftError || !shift) throw new Error("Смена не найдена в базе данных.");

    const actions = Array.isArray(shift.actions) ? shift.actions : [];
    const crewName = shift.crews?.name || "НЕИЗВЕСТНЫЙ_СКЛАД";
    const operatorName = shift.users?.username || shift.users?.full_name || "RECRUIT";

    // 2. Инициализация документа
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Загрузка тактического шрифта (DejaVuSans поддерживает кириллицу)
    const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
    if (!fs.existsSync(fontPath)) throw new Error("Системный шрифт не найден.");
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes); 

    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    // --- ЦВЕТОВАЯ ПАЛИТРА (Tactical OLED Style) ---
    const COLOR_BLACK = rgb(0, 0, 0);
    const COLOR_DARK_GREY = rgb(0.1, 0.1, 0.1);
    const COLOR_CYAN = rgb(0, 0.76, 1);
    const COLOR_WHITE = rgb(1, 1, 1);
    const COLOR_RED = rgb(0.8, 0.1, 0.1);

    // --- HEADER (Digital Blackout) ---
    page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: COLOR_BLACK });
    page.drawText("LOGISTICS AFTER-ACTION REPORT", { x: 40, y: height - 50, size: 22, font: customFont, color: COLOR_WHITE });
    page.drawText(`MISSION_ID: ${shiftId.toUpperCase()} // STATUS: ARCHIVED`, { x: 40, y: height - 75, size: 9, font: customFont, color: COLOR_CYAN });

    let y = height - 140;

    // --- SUMMARY GRID ---
    const drawStat = (label: string, value: string, x: number) => {
        page.drawText(label, { x, y: y, size: 8, font: customFont, color: rgb(0.5, 0.5, 0.5) });
        page.drawText(value, { x, y: y - 16, size: 13, font: customFont, color: COLOR_BLACK });
    };

    const totalUnits = actions.reduce((acc: number, a: any) => acc + (a.qty || 0), 0);
    const duration = shift.duration_minutes ? `${Math.round(shift.duration_minutes)} МИН` : "ACTIVE";
    const payout = `${totalUnits * 50} ₽`; // Твоя формула: 50 RUB за юнит

    drawStat("ОПЕРАТОР", operatorName.toUpperCase(), 40);
    drawStat("ЛОКАЦИЯ", crewName.toUpperCase(), 220);
    drawStat("ТАЙМИНГ", duration, 420);

    y -= 55;
    drawStat("ОБЪЕМ_ЛУТА", `${totalUnits} ЕД.`, 40);
    drawStat("ТИП_ОПЕРАЦИИ", shift.shift_type?.toUpperCase() || "RAID", 220);
    drawStat("ДОБЫЧА (EST)", payout, 420);

    // Separator line
    y -= 45;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 30;

    // --- AUDIT TRAIL TABLE ---
    page.drawText("AUDIT_TRAIL: ПОШАГОВЫЙ ЖУРНАЛ ДЕЙСТВИЙ", { x: 40, y, size: 10, font: customFont, color: COLOR_BLACK });
    y -= 25;

    // Table Header
    page.drawRectangle({ x: 40, y: y - 20, width: width - 80, height: 20, color: COLOR_DARK_GREY });
    const headerLabels = ["ВРЕМЯ", "ТИП", "ОБЪЕКТ / SKU", "ЯЧЕЙКА", "КОЛ"];
    const xOffsets = [45, 100, 160, 420, 500];
    
    headerLabels.forEach((label, i) => {
        page.drawText(label, { x: xOffsets[i], y: y - 13, size: 7, font: customFont, color: COLOR_WHITE });
    });

    y -= 20;

    // Action Rows
    actions.forEach((a: any, i: number) => {
        y -= 20;
        // Page overflow check
        if (y < 80) { 
            page = pdfDoc.addPage([595.28, 841.89]); 
            y = height - 50; 
        }

        const time = a.ts ? new Date(a.ts).toLocaleTimeString('ru-RU', { hour12: false }) : "--:--";
        const isOffload = a.type === 'offload';
        const typeLabel = isOffload ? "ВЫДАЧА" : "ПРИЕМКА";
        const typeColor = isOffload ? COLOR_RED : rgb(0, 0.5, 0);

        page.drawRectangle({ x: 40, y, width: width - 80, height: 20, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
        
        page.drawText(time, { x: 45, y: y + 6, size: 7, font: customFont });
        page.drawText(typeLabel, { x: 100, y: y + 6, size: 7, font: customFont, color: typeColor });
        page.drawText(String(a.item || a.itemId || "Unknown").substring(0, 45), { x: 160, y: y + 6, size: 7, font: customFont });
        page.drawText(String(a.voxel || a.voxel_id || "--"), { x: 420, y: y + 6, size: 7, font: customFont });
        page.drawText(String(a.qty || 0), { x: 500, y: y + 6, size: 7, font: customFont });
    });

    // --- VERIFICATION FOOTER ---
    y = 50;
    const vHash = Buffer.from(`${shiftId}-${userId}`).toString('base64').substring(0, 24);
    page.drawText(`VERIFICATION_HASH: ${vHash}`, { x: 40, y, size: 6, font: customFont, color: rgb(0.6, 0.6, 0.6) });
    page.drawText(`GENERATED_VIA_ONESITE_PLS_STUDIO // ${new Date().toISOString()}`, { x: width - 250, y, size: 6, font: customFont, color: rgb(0.6, 0.6, 0.6) });

    // 3. Finalization
    const pdfBytes = await pdfDoc.save();
    const fileName = `AAR_${shift.crews.slug.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
    const fileBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    const sendRes = await sendTelegramDocument(userId, fileBlob, fileName, 
        `🏁 **ОТЧЕТ ПО РЕЙДУ ЗАВЕРШЕН**\n\n` +
        `📦 Обработано: ${totalUnits} ед.\n` +
        `💰 Сумма к выплате: ${payout}\n` +
        `👤 Оператор: @${operatorName}`
    );

    if (!sendRes.success) throw new Error(sendRes.error);
    return { success: true, message: "Отчет успешно передан в Telegram." };

  } catch (error: any) {
    logger.error("[SHIFT_PDF_CRITICAL]", error);
    return { success: false, error: error.message || "Ошибка генерации PDF" };
  }
}