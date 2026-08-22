"use server";

import { supabaseAnon } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import path from 'path'; 
import fs from 'fs';   
import { sendTelegramDocument } from "@/app/actions"; 

// Подключаем модули PDF
const pdfLib = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb } = pdfLib;

/**
 * Генерирует тактический отчет по рейду/смене (AAR)
 * Исправлена синтаксическая ошибка в координатах Y.
 */
export async function generateCrewShiftPdf(userId: string, shiftId: string) {
  logger.info(`[AAR_GEN] Начало генерации PDF для смены: ${shiftId}`);

  try {
    const { data: shift, error: shiftError } = await supabaseAnon
      .from("crew_member_shifts")
      .select("*, crews(name, slug), users(username, full_name)")
      .eq("id", shiftId)
      .single();

    if (shiftError || !shift) throw new Error("Смена не найдена.");

    const actions = Array.isArray(shift.actions) ? shift.actions : [];
    const crewName = shift.crews?.name || "НЕИЗВЕСТНЫЙ_СКЛАД";
    const operatorName = shift.users?.username || shift.users?.full_name || "RECRUIT";

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes); 

    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const COLOR_BLACK = rgb(0, 0, 0);
    const COLOR_CYAN = rgb(0, 0.76, 1);
    const COLOR_WHITE = rgb(1, 1, 1);
    const COLOR_RED = rgb(0.8, 0.1, 0.1);

    // Header
    page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: COLOR_BLACK });
    page.drawText("LOGISTICS AFTER-ACTION REPORT", { x: 40, y: height - 50, size: 22, font: customFont, color: COLOR_WHITE });
    page.drawText(`MISSION_ID: ${shiftId.toUpperCase()} // STATUS: ARCHIVED`, { x: 40, y: height - 75, size: 9, font: customFont, color: COLOR_CYAN });

    let y = height - 140;

    const totalUnits = actions.reduce((acc: number, a: any) => acc + (Number(a.qty) || 0), 0);
    const duration = shift.duration_minutes ? `${Math.round(shift.duration_minutes)} МИН` : "ACTIVE";
    const payout = `${totalUnits * 50} ₽`;

    // Summary Grid
    const drawStat = (label: string, value: string, x: number, targetY: number) => {
        page.drawText(label, { x, y: targetY, size: 8, font: customFont, color: rgb(0.5, 0.5, 0.5) });
        page.drawText(value, { x, y: targetY - 16, size: 13, font: customFont, color: COLOR_BLACK });
    };

    drawStat("ОПЕРАТОР", operatorName.toUpperCase(), 40, y);
    drawStat("ЛОКАЦИЯ", crewName.toUpperCase(), 220, y);
    drawStat("ТАЙМИНГ", duration, 420, y);

    y -= 55;
    drawStat("ОБЪЕМ_ЛУТА", `${totalUnits} ЕД.`, 40, y);
    drawStat("ТИП_ОПЕРАЦИИ", shift.shift_type?.toUpperCase() || "RAID", 220, y);
    drawStat("ДОБЫЧА (EST)", payout, 420, y);

    y -= 45;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 30;

    page.drawText("AUDIT_TRAIL: ПОШАГОВЫЙ ЖУРНАЛ ДЕЙСТВИЙ", { x: 40, y, size: 10, font: customFont, color: COLOR_BLACK });
    y -= 25;

    page.drawRectangle({ x: 40, y: y - 20, width: width - 80, height: 20, color: rgb(0.1, 0.1, 0.1) });
    const xOffsets = [45, 100, 160, 420, 500];
    const headers = ["ВРЕМЯ", "ТИП", "ОБЪЕКТ / SKU", "ЯЧЕЙКА", "КОЛ"];
    headers.forEach((h, i) => page.drawText(h, { x: xOffsets[i], y: y - 13, size: 7, font: customFont, color: COLOR_WHITE }));
    
    y -= 20;

    actions.forEach((a: any) => {
        y -= 20;
        if (y < 80) { page = pdfDoc.addPage([595.28, 841.89]); y = height - 50; }
        const time = a.ts ? new Date(a.ts).toLocaleTimeString('ru-RU', { hour12: false }) : "--:--";
        page.drawRectangle({ x: 40, y, width: width - 80, height: 20, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
        page.drawText(time, { x: 45, y: y + 6, size: 7, font: customFont });
        page.drawText(a.type === 'offload' ? "ВЫДАЧА" : "ПРИЕМКА", { x: 100, y: y + 6, size: 7, font: customFont, color: a.type === 'offload' ? COLOR_RED : rgb(0, 0.5, 0) });
        page.drawText(String(a.item || "Unknown").substring(0, 40), { x: 160, y: y + 6, size: 7, font: customFont });
        page.drawText(String(a.voxel || a.voxel_id || "--"), { x: 420, y: y + 6, size: 7, font: customFont });
        page.drawText(String(a.qty || 0), { x: 500, y: y + 6, size: 7, font: customFont });
    });

    const pdfBytes = await pdfDoc.save();
    const fileName = `AAR_${shift.crews.slug.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
    const sendRes = await sendTelegramDocument(userId, new Blob([pdfBytes]), fileName, `🏁 **ОТЧЕТ ПО СМЕНЕ ГОТОВ**`);

    return { success: sendRes.success };
  } catch (error: any) {
    logger.error("[PDF_ERROR]", error);
    return { success: false, error: error.message };
  }
}

/**
 * Генерирует сводный отчет по рейду.
 * Исправлены ошибки синтаксиса в Total Row.
 */
export async function generateRaidSummaryPdf(userId: string, slug: string) {
  try {
    const { data: crew } = await supabaseAnon.from("crews").select("id, name").eq("slug", slug).single();
    if (!crew) throw new Error("Экипаж не найден.");

    const today = new Date().toISOString().split('T')[0];
    const { data: shifts, error } = await supabaseAnon
      .from("crew_member_shifts")
      .select("*, users(username, full_name)")
      .eq("crew_id", crew.id)
      .gte("clock_in_time", `${today}T00:00:00`)
      .order("clock_in_time", { ascending: true });

    if (error || !shifts || shifts.length === 0) throw new Error("Смен за сегодня нет.");

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes); 

    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.1, 0.1, 0.1) });
    page.drawText("RAID_LOGISTICS_SUMMARY", { x: 40, y: height - 40, size: 18, font: customFont, color: rgb(1,1,1) });
    page.drawText(`СКЛАД: ${crew.name.toUpperCase()} // ДАТА: ${today}`, { x: 40, y: height - 60, size: 9, font: customFont, color: rgb(0, 0.76, 1) });

    let y = height - 120;
    page.drawText("ВЕДОМОСТЬ ВЫПЛАТ:", { x: 40, y, size: 11, font: customFont });
    y -= 25;

    page.drawRectangle({ x: 40, y: y - 20, width: width - 80, height: 20, color: rgb(0.2, 0.2, 0.2) });
    const xOffsets = [45, 200, 350, 480];
    ["ОПЕРАТОР", "ВРЕМЯ", "ОБЪЕМ", "К ВЫПЛАТЕ"].forEach((h, i) => page.drawText(h, { x: xOffsets[i], y: y - 13, size: 8, font: customFont, color: rgb(1,1,1) }));
    
    y -= 20;
    let grandTotalUnits = 0;

    shifts.forEach((s: any) => {
        const units = Array.isArray(s.actions) ? s.actions.reduce((acc: number, a: any) => acc + (Number(a.qty) || 0), 0) : 0;
        grandTotalUnits += units;
        y -= 20;
        if (y < 60) { page = pdfDoc.addPage(); y = height - 50; }
        page.drawRectangle({ x: 40, y, width: width - 80, height: 20, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
        page.drawText(s.users?.username || "RECRUIT", { x: 45, y: y + 6, size: 8, font: customFont });
        page.drawText(`${Math.round(s.duration_minutes || 0)} м`, { x: 200, y: y + 6, size: 8, font: customFont });
        page.drawText(`${units} ед`, { x: 350, y: y + 6, size: 8, font: customFont });
        page.drawText(`${units * 50} ₽`, { x: 480, y: y + 6, size: 8, font: customFont, color: rgb(0, 0.5, 0) });
    });

    y -= 40;
    page.drawRectangle({ x: 40, y, width: width - 80, height: 30, color: rgb(0.95, 0.95, 0.95) });
    // ИСПРАВЛЕНО: Добавлены ключи y: y + 10
    page.drawText("ИТОГО ПО РЕЙДУ:", { x: 45, y: y + 10, size: 10, font: customFont, color: rgb(0,0,0) });
    page.drawText(`${grandTotalUnits} ед.`, { x: 350, y: y + 10, size: 10, font: customFont, color: rgb(0,0,0) });
    page.drawText(`${grandTotalUnits * 50} ₽`, { x: 480, y: y + 10, size: 12, font: customFont, color: rgb(0, 0.5, 0) });

    const pdfBytes = await pdfDoc.save();
    const fileName = `SUMMARY_${slug.toUpperCase()}_${today}.pdf`;
    await sendTelegramDocument(userId, new Blob([pdfBytes]), fileName, `🏛️ **СВОДНЫЙ ОТЧЕТ ЗА СЕГОДНЯ**`);

    return { success: true };
  } catch (e: any) {
    logger.error("[RAID_PDF_ERROR]", e);
    return { success: false, error: e.message };
  }
}