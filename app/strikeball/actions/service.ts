"use server";

import { supabaseAnon } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import path from 'path'; 
import fs from 'fs';   
import { sendTelegramDocument } from "@/app/actions"; 

const pdfLibModule = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');
const { PDFDocument, rgb } = pdfLibModule;

/**
 * Генерирует расширенный тактический PDF:
 * Стр 1: Официальный Бриф (Приложение №3) со списком ФИО
 * Стр 2+: QR-коды для баз, точек захвата и входа в игру
 */
export async function generateAndSendLobbyPdf(userId: string, lobbyId: string) {
  try {
    // 1. Сбор разведданных
    const { data: lobby } = await supabaseAnon.from("lobbies").select("*").eq("id", lobbyId).single();
    const { data: members } = await supabaseAnon.from("lobby_members").select("*").eq("lobby_id", lobbyId);
    const { data: checkpoints } = await supabaseAnon.from("lobby_checkpoints").select("*").eq("lobby_id", lobbyId);
    
    if (!lobby) throw new Error("Operation not found");

    // 2. Инициализация PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkitModule);
    const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes); 

    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    // --- ЦВЕТОВАЯ СХЕМА ---
    const COLOR_RED = rgb(0.7, 0.1, 0.1);
    const COLOR_BLUE = rgb(0.1, 0.2, 0.6);
    const COLOR_DARK = rgb(0.1, 0.1, 0.1);

    // ==========================================
    // СТРАНИЦА 1: ОФИЦИАЛЬНЫЙ БРИФ (Приложение №3)
    // ==========================================
    page.drawText("Приложение №3 к договору оферты", { x: width - 250, y: height - 40, size: 10, font: customFont });
    page.drawText("Бриф на спортивное мероприятие", { x: 40, y: height - 80, size: 20, font: customFont, color: COLOR_DARK });

    let y = height - 120;
    const drawCell = (label: string, value: string, x: number, w: number) => {
        page.drawRectangle({ x, y: y - 25, width: w, height: 25, borderColor: rgb(0,0,0), borderWidth: 0.5 });
        page.drawText(label, { x: x + 5, y: y - 10, size: 8, font: customFont, color: rgb(0.4, 0.4, 0.4) });
        page.drawText(value, { x: x + 5, y: y - 22, size: 10, font: customFont });
    };

    // Строка 1
    drawCell("Место проведения", "Клуб активного отдыха 'Антанта'", 40, 300);
    drawCell("Дата начала", lobby.start_at ? new Date(lobby.start_at).toLocaleDateString('ru-RU') : "ПО ГОТОВНОСТИ", 340, 215);
    
    y -= 35;
    // Строка 2
    drawCell("Программа (Режим)", lobby.mode?.toUpperCase() || "TDM", 40, 300);
    drawCell("Всего участников", String(members?.length || 0), 340, 215);

    y -= 35;
    // Строка 3 (Распределение по командам)
    const childrenCount = members?.filter(m => m.team === 'blue').length || 0;
    const adultsCount = members?.filter(m => m.team === 'red').length || 0;
    drawCell("Детей (Blue Team)", String(childrenCount), 40, 140);
    drawCell("Взрослых (Red Team)", String(adultsCount), 190, 150);
    drawCell("Стоимость / чел", `${lobby.metadata?.price_per_person || "___"} руб`, 350, 205);

    y -= 60;
    page.drawText("СПИСОК УЧАСТНИКОВ (ПОДТВЕРЖДЕНО ЦИФРОВОЙ ПОДПИСЬЮ):", { x: 40, y, size: 11, font: customFont, color: COLOR_DARK });
    y -= 25;

    // ШАПКА ТАБЛИЦЫ
    page.drawRectangle({ x: 40, y: y - 20, width: width - 80, height: 20, color: COLOR_DARK });
    page.drawText("№", { x: 45, y: y - 13, size: 9, font: customFont, color: rgb(1,1,1) });
    page.drawText("Ф.И.О. Оператора", { x: 70, y: y - 13, size: 9, font: customFont, color: rgb(1,1,1) });
    page.drawText("Телефон", { x: 350, y: y - 13, size: 9, font: customFont, color: rgb(1,1,1) });
    page.drawText("Команда", { x: 480, y: y - 13, size: 9, font: customFont, color: rgb(1,1,1) });
    y -= 20;

    // СПИСОК
    members?.forEach((m: any, i: number) => {
        y -= 20;
        if (y < 120) { 
            page = pdfDoc.addPage([595.28, 841.89]); 
            y = height - 50; 
        }

        const data = m.metadata?.operator_data || {};
        const name = data.fio || (m.is_bot ? `БОТ-${m.id.slice(0,4)}` : "НЕ ПОДПИСАНО");
        const phone = data.phone || (m.is_bot ? "N/A" : "____");
        const school = data.school ? ` [${data.school}]` : "";

        page.drawRectangle({ x: 40, y, width: width - 80, height: 20, borderColor: rgb(0.8,0.8,0.8), borderWidth: 0.5 });
        page.drawText(String(i + 1), { x: 45, y: y + 6, size: 8, font: customFont });
        page.drawText(`${name}${school}`, { x: 70, y: y + 6, size: 8, font: customFont });
        page.drawText(phone, { x: 350, y: y + 6, size: 8, font: customFont });
        
        const teamLabel = m.team === 'blue' ? "BLUE (Дети)" : "RED (Взр)";
        const teamColor = m.team === 'blue' ? COLOR_BLUE : COLOR_RED;
        page.drawText(teamLabel, { x: 480, y: y + 6, size: 7, font: customFont, color: teamColor });
    });

    // ПОДПИСЬ ЗАКАЗЧИКА
    y -= 60;
    page.drawText("С правилами техники безопасности (Приложение №1) ознакомлен,", { x: 40, y, size: 9, font: customFont });
    y -= 12;
    page.drawText("согласен и обязуюсь донести до всех участников мероприятия.", { x: 40, y, size: 9, font: customFont });
    y -= 30;
    page.drawText("Ф.И.О. Заказчика: ____________________________________", { x: 40, y, size: 10, font: customFont });
    page.drawText("Подпись: ____________", { x: 420, y, size: 10, font: customFont });

    // ==========================================
    // СТРАНИЦА 2+: ТАКТИЧЕСКИЕ QR-КОДЫ
    // ==========================================
    page = pdfDoc.addPage([595.28, 841.89]);
    y = height - 60;

    page.drawText("ТАКТИЧЕСКИЕ ОБЪЕКТЫ (РАСПЕЧАТАТЬ И РАЗМЕСТИТЬ)", { x: 40, y, size: 14, font: customFont, color: COLOR_DARK });
    page.drawLine({ start: { x: 40, y: y - 5 }, end: { x: width - 40, y: y - 5 }, thickness: 2, color: COLOR_RED });
    y -= 40;

    // Сетка для QR
    let qrX = 40;
    const qrSize = 130;
    const gap = 50;

    // 1. Сбор всех точек для генерации
    const allPoints = [
        { name: "ВХОД В ИГРУ (JOIN)", id: `https://t.me/oneSitePlsBot/app?startapp=lobby_${lobby.id}`, color: COLOR_DARK },
        { name: "БАЗА СИНИХ (RESPAWN)", id: `respawn_${lobby.id}_blue`, color: COLOR_BLUE },
        { name: "БАЗА КРАСНЫХ (RESPAWN)", id: `respawn_${lobby.id}_red`, color: COLOR_RED },
        ...(checkpoints || []).map(cp => ({
            name: `СЕКТОР: ${cp.name.toUpperCase()}`,
            id: `capture_${cp.id}`,
            color: COLOR_DARK
        }))
    ];

    for (const point of allPoints) {
        // Проверка переноса строки/страницы
        if (qrX + qrSize > width - 40) {
            qrX = 40;
            y -= (qrSize + 60);
        }
        if (y < 150) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - 60;
            qrX = 40;
        }

        try {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(point.id)}&color=000&bgcolor=fff&margin=1`;
            const qrBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
            const qrImg = await pdfDoc.embedPng(qrBytes);

            // Рамка QR
            page.drawRectangle({ x: qrX, y: y - qrSize, width: qrSize, height: qrSize, borderColor: point.color, borderWidth: 2 });
            page.drawImage(qrImg, { x: qrX + 5, y: y - qrSize + 5, width: qrSize - 10, height: qrSize - 10 });
            
            // Подпись под QR
            page.drawText(point.name, { x: qrX, y: y - qrSize - 15, size: 8, font: customFont, color: point.color });
            
            qrX += qrSize + gap;
        } catch (e) {
            logger.error(`QR_GEN_ERROR for ${point.name}`, e);
        }
    }

    // Футер на тактической странице
    const footerY = 40;
    page.drawText("STRIKEBALL TACTICAL OS // СИСТЕМА УПРАВЛЕНИЯ БОЕМ", { x: 40, y: footerY, size: 7, font: customFont, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(`ID_ОПЕРАЦИИ: ${lobby.id.split('-')[0].toUpperCase()}`, { x: width - 150, y: footerY, size: 7, font: customFont, color: rgb(0.5, 0.5, 0.5) });

    // 4. Финализация и отправка
    const pdfBytes = await pdfDoc.save();
    const fileName = `BRIEF_ANTANTA_${lobby.name.replace(/\s+/g, '_')}.pdf`;
    const fileBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    const sendRes = await sendTelegramDocument(userId, fileBlob, fileName, "📄 **ТАКТИЧЕСКИЙ ПАКЕТ СФОРМИРОВАН**\nВключает бриф и QR-коды для полигона.");
    
    if (!sendRes.success) throw new Error(sendRes.error);

    return { success: true, message: "PDF Dossier transmitted." };

  } catch (error: any) {
    logger.error("generateAndSendLobbyPdf Error", error);
    return { success: false, error: error.message };
  }
}

/**
 * Generates a "Stylish as F*ck" Tactical Briefing PDF.
 * Includes Rosters, Game Info, and Checkpoint QR Codes.
 */
export async function generateAndSendLobbyPdfDefault(userId: string, lobbyId: string) {
  try {
    // 1. Fetch Data
    const { data: lobby } = await supabaseAnon.from("lobbies").select("*").eq("id", lobbyId).single();
    const { data: rawMembers } = await supabaseAnon.from("lobby_members").select("*").eq("lobby_id", lobbyId);
    
    // NEW: Fetch Checkpoints
    const { data: checkpoints } = await supabaseAnon.from("lobby_checkpoints").select("*").eq("lobby_id", lobbyId);
    
    if (!lobby) throw new Error("Lobby not found");

    // We need members linked to users to get names
    const userIds = rawMembers?.map((m: any) => m.user_id).filter((id: string) => id && id.length > 10) || [];
    const { data: users } = await supabaseAnon.from("users").select("user_id, username, full_name").in("user_id", userIds);
    
    const userMap = new Map();
    users?.forEach((u: any) => userMap.set(u.user_id, u));

    // 2. Initialize PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkitModule);

    // 3. Load Fonts
    const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes); 
    
    // 4. Setup Page (A4)
    let page = pdfDoc.addPage([595.28, 841.89]); 
    const { width, height } = page.getSize();
    
    // --- COLORS ---
    const COLOR_BG = rgb(0.97, 0.97, 0.97);
    const COLOR_DARK = rgb(0.1, 0.1, 0.1);
    const COLOR_RED = rgb(0.7, 0.1, 0.1);
    const COLOR_BLUE = rgb(0.1, 0.2, 0.6);
    const COLOR_GREY = rgb(0.5, 0.5, 0.5);

    // --- BACKGROUND ---
    page.drawRectangle({ x: 0, y: 0, width, height, color: COLOR_BG });
    
    // Draw Tactical Grid
    for (let i = 0; i < width; i += 40) {
        page.drawLine({ start: { x: i, y: 0 }, end: { x: i, y: height }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    }
    for (let i = 0; i < height; i += 40) {
        page.drawLine({ start: { x: 0, y: i }, end: { x: width, y: i }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    }

    // --- HEADER ---
    const headerHeight = 80;
    page.drawRectangle({ x: 0, y: height - headerHeight, width, height: headerHeight, color: COLOR_DARK });
    
    page.drawText("TACTICAL OPERATIONS // BRIEFING", {
        x: 40,
        y: height - 50,
        size: 24,
        font: customFont,
        color: rgb(1, 1, 1)
    });

    page.drawText(`REF_ID: ${lobby.id.split('-')[0].toUpperCase()}`, {
        x: width - 150,
        y: height - 50,
        size: 10,
        font: customFont,
        color: COLOR_RED
    });

    // --- INFO CARD ---
    let y = height - 120;
    
    // QR Code Generation (Join Link)
    let qrImage;
    try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://t.me/oneSitePlsBot/app?startapp=lobby_${lobby.id}`;
        const qrBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
        qrImage = await pdfDoc.embedPng(qrBytes);
    } catch (e) { logger.error("QR Gen failed", e); }

    // Info Box
    page.drawRectangle({ x: 40, y: y - 100, width: width - 80, height: 100, color: rgb(1, 1, 1), borderColor: COLOR_DARK, borderWidth: 2 });
    
    const startX = 60;
    let infoY = y - 30;
    
    const drawLabelValue = (label: string, value: string, xPos: number, yPos: number, colorVal = COLOR_DARK) => {
        page.drawText(label, { x: xPos, y: yPos, size: 8, font: customFont, color: COLOR_GREY });
        page.drawText(value, { x: xPos, y: yPos - 14, size: 12, font: customFont, color: colorVal });
    };

    drawLabelValue("ОПЕРАЦИЯ", lobby.name, startX, infoY);
    drawLabelValue("РЕЖИМ", lobby.mode?.toUpperCase() || "TDM", startX + 200, infoY);
    
    infoY -= 40;
    const timeStr = lobby.start_at ? new Date(lobby.start_at).toLocaleString('ru-RU') : "ПО ГОТОВНОСТИ";
    drawLabelValue("СБОР", timeStr, startX, infoY);
    drawLabelValue("GPS", lobby.field_id || "НЕ УКАЗАНЫ", startX + 200, infoY);

    if (qrImage) {
        page.drawImage(qrImage, { x: width - 130, y: y - 90, width: 80, height: 80 });
        page.drawText("LOBBY JOIN", { x: width - 130, y: y - 105, size: 8, font: customFont, color: COLOR_DARK });
    }

    y -= 140;

    // --- TEAMS LAYOUT ---
    const colWidth = (width - 100) / 2;
    const blueX = 40;
    const redX = 40 + colWidth + 20;
    
    const members = rawMembers?.map((m: any) => {
        const u = userMap.get(m.user_id);
        const name = m.is_bot 
            ? `BOT-${m.id.split('-')[0].toUpperCase()}` 
            : (u?.username ? `@${u.username}` : (u?.full_name || 'OPERATOR'));
        return { ...m, name };
    }) || [];

    const blueTeam = members.filter((m: any) => m.team === 'blue');
    const redTeam = members.filter((m: any) => m.team === 'red');

    // Headers
    page.drawRectangle({ x: blueX, y: y, width: colWidth, height: 30, color: COLOR_BLUE });
    page.drawText(`BLUE SQUAD [${blueTeam.length}]`, { x: blueX + 10, y: y + 8, size: 14, font: customFont, color: rgb(1,1,1) });

    page.drawRectangle({ x: redX, y: y, width: colWidth, height: 30, color: COLOR_RED });
    page.drawText(`RED SQUAD [${redTeam.length}]`, { x: redX + 10, y: y + 8, size: 14, font: customFont, color: rgb(1,1,1) });

    y -= 10;

    let blueY = y;
    let redY = y;

    // Render Blue Roster
    blueTeam.forEach((m: any, i: number) => {
        blueY -= 25;
        if (i % 2 === 0) page.drawRectangle({ x: blueX, y: blueY - 5, width: colWidth, height: 25, color: rgb(0.95, 0.95, 1) });
        page.drawText(`${i + 1}. ${m.name}`, { x: blueX + 10, y: blueY, size: 10, font: customFont, color: COLOR_DARK });
        
        const statusColor = m.status === 'alive' ? rgb(0, 0.6, 0) : rgb(0.6, 0, 0);
        page.drawCircle({ x: blueX + colWidth - 20, y: blueY + 4, size: 4, color: statusColor });
    });

    // Render Red Roster
    redTeam.forEach((m: any, i: number) => {
        redY -= 25;
        if (i % 2 === 0) page.drawRectangle({ x: redX, y: redY - 5, width: colWidth, height: 25, color: rgb(1, 0.95, 0.95) });
        page.drawText(`${i + 1}. ${m.name}`, { x: redX + 10, y: redY, size: 10, font: customFont, color: COLOR_DARK });

        const statusColor = m.status === 'alive' ? rgb(0, 0.6, 0) : rgb(0.6, 0, 0);
        page.drawCircle({ x: redX + colWidth - 20, y: redY + 4, size: 4, color: statusColor });
    });

    // Adjust Y to be below the longest list
    y = Math.min(blueY, redY) - 50;

    // --- CHECKPOINT QR CODES (NEW SECTION) ---
    // If checkpoints exist, we print them.
    // We also print BASE RESPAWNS by default.

    if (y < 250) {
         page = pdfDoc.addPage([595.28, 841.89]);
         y = height - 50;
    }

    page.drawText("TACTICAL OBJECTIVES (PRINT & DEPLOY)", { x: 40, y: y, size: 14, font: customFont, color: COLOR_DARK });
    page.drawLine({ start: { x: 40, y: y - 5 }, end: { x: width - 40, y: y - 5 }, thickness: 2, color: COLOR_RED });
    y -= 30;

    let qrX = 40;
    const qrSize = 100;
    const gap = 20;
    
    // 1. BASE RESPAWNS (Always included)
    const basePoints = [
        { name: "BLUE BASE", id: `respawn_${lobby.id}_blue`, color: COLOR_BLUE },
        { name: "RED BASE", id: `respawn_${lobby.id}_red`, color: COLOR_RED }
    ];

    // Combine with Checkpoints
    const allPoints = [
        ...basePoints,
        ...(checkpoints || []).map((cp: any) => ({ 
            name: cp.name, 
            id: `capture_${cp.id}`, 
            color: COLOR_DARK 
        }))
    ];

    for (const point of allPoints) {
        if (qrX + qrSize > width - 40) {
            qrX = 40;
            y -= (qrSize + 40);
            if (y < 50) { page = pdfDoc.addPage([595.28, 841.89]); y = height - 50; }
        }

        try {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(point.id)}`;
            const qrBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
            const qrImg = await pdfDoc.embedPng(qrBytes);

            // Draw Container
            page.drawRectangle({ x: qrX, y: y - qrSize, width: qrSize, height: qrSize, borderColor: point.color, borderWidth: 2 });
            page.drawImage(qrImg, { x: qrX + 5, y: y - qrSize + 5, width: qrSize - 10, height: qrSize - 10 });
            
            // Label
            page.drawText(point.name.substring(0, 15), { x: qrX, y: y - qrSize - 15, size: 9, font: customFont, color: point.color });
            
            qrX += qrSize + gap;
        } catch(e) {
            console.error("QR Error", e);
        }
    }

    // --- FOOTER WARNING ---
    const bottomY = 40;
    page.drawLine({ start: { x: 40, y: bottomY + 20 }, end: { x: width - 40, y: bottomY + 20 }, thickness: 1, color: COLOR_GREY });
    
    page.drawText("WARNING: LIVE FIRE ZONE // EYE PROTECTION MANDATORY // OBEY GAME MARSHALS", {
        x: 40,
        y: bottomY,
        size: 8,
        font: customFont,
        color: COLOR_RED
    });

    page.drawText(`GENERATED VIA STRIKEBALL OPS // ${new Date().toISOString().split('T')[0]}`, {
        x: width - 250,
        y: bottomY,
        size: 8,
        font: customFont,
        color: COLOR_GREY
    });

    // Save & Send
    const pdfBytes = await pdfDoc.save();
    const fileName = `INTEL_${lobby.name.replace(/\s+/g, '_').toUpperCase()}.pdf`;
    const fileBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    const sendRes = await sendTelegramDocument(userId, fileBlob, fileName, "📄 **TACTICAL DOSSIER (UPDATED)**");
    
    if (!sendRes.success) throw new Error(sendRes.error);

    return { success: true, message: "PDF Dossier transmitted." };

  } catch (error: any) {
    logger.error("generateAndSendLobbyPdf Error", error);
    return { success: false, error: error.message };
  }
}

// ... [generateGearCatalogPdf remains same] ...
export async function generateGearCatalogPdf(userId: string) {
  try {
    const { data: gear } = await supabaseAnon.from("cars").select("*").in("type", ["gear", "weapon", "consumable"]);
    if (!gear || gear.length === 0) throw new Error("No gear found in armory.");

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkitModule);
    const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes);

    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const MARGIN = 30;
    const COLS = 2;
    const ROWS = 3;
    const CELL_WIDTH = (width - MARGIN * 2) / COLS;
    const CELL_HEIGHT = (height - MARGIN * 2) / ROWS;

    let col = 0; let row = 0;

    for (const item of gear) {
        const x = MARGIN + col * CELL_WIDTH;
        const y = height - MARGIN - (row + 1) * CELL_HEIGHT;

        page.drawRectangle({ x: x + 10, y: y + 10, width: CELL_WIDTH - 20, height: CELL_HEIGHT - 20, borderColor: rgb(0, 0, 0), borderWidth: 2 });

        try {
            const qrData = `gear_buy_${item.id}`; 
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
            const qrBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
            const qrImage = await pdfDoc.embedPng(qrBytes);
            const qrSize = 120;
            page.drawImage(qrImage, { x: x + (CELL_WIDTH - qrSize) / 2, y: y + 80, width: qrSize, height: qrSize });
        } catch (e) { console.error("QR Gen Error", e); }

        const textY = y + 60;
        const name = item.model.length > 20 ? item.model.substring(0, 20) + '...' : item.model;
        page.drawText(item.make, { x: x + 20, y: textY, size: 10, font: customFont, color: rgb(0.5, 0.5, 0.5) });
        page.drawText(name, { x: x + 20, y: textY - 15, size: 14, font: customFont, color: rgb(0, 0, 0) });
        page.drawText(`${item.daily_price} XTR`, { x: x + 20, y: textY - 35, size: 18, font: customFont, color: rgb(0.8, 0, 0) });
        page.drawText(`ID: ${item.id}`, { x: x + 20, y: y + 20, size: 8, font: customFont, color: rgb(0.7, 0.7, 0.7) });

        col++;
        if (col >= COLS) { col = 0; row++; if (row >= ROWS) { page = pdfDoc.addPage([595.28, 841.89]); row = 0; } }
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = `CATALOG_${new Date().toISOString().split('T')[0]}.pdf`;
    const fileBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const sendRes = await sendTelegramDocument(userId, fileBlob, fileName, "📦 **КАТАЛОГ СНАРЯЖЕНИЯ (QR)**");
    if (!sendRes.success) throw new Error(sendRes.error);

    return { success: true, message: "Каталог отправлен!" };
  } catch (e: any) {
    logger.error("generateGearCatalogPdf Error", e);
    return { success: false, error: e.message };
  }
}

/**
 * Генерирует готовую ссылку для шаринга лобби в Telegram.
 * Форматирует сообщение в стиле "Gaming Party Vibe".
 */
/**
 * Генерирует готовую ссылку для шаринга лобби в Telegram.
 * Принимает опционально отформатированную дату (чтобы избежать проблем с таймзоной сервера).
 */
export async function generateLobbyShareLink(lobbyId: string, formattedTime?: string) {
  try {
    // 1. Получаем данные лобби и участников
    const { data: lobby } = await supabaseAnon.from("lobbies").select("*").eq("id", lobbyId).single();
    const { data: members } = await supabaseAnon.from("lobby_members").select("*").eq("lobby_id", lobbyId);

    if (!lobby) throw new Error("Operation not found");

    // 2. Подготовка данных для сообщения
    const count = members?.length || 0;
    const maxPlayers = lobby.max_players || '?';
    const mode = lobby.mode || 'CUSTOM';
    
    // 3. Используем время, отформатированное на клиенте, либо серверный фоллбэк
    let timeStr = formattedTime || "СКОРО";
    
    // Если клиент не передал время, пробуем отформатировать на сервере (с учетом таймзоны UTC сервера)
    if (!formattedTime && lobby.start_at) {
      // ВНИМАНИЕ: На сервере (Vercel/Node) это обычно UTC.
      // Если важно конкретное время, лучше передавать его с клиента.
      timeStr = new Date(lobby.start_at).toLocaleString('ru-RU', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    }

    // 4. Формируем текст сообщения
    const text = `🎮 **ПОДБОР ИГРОКОВ** 🎮\n\n` + 
                 `📢 ЗАХОДИ В: ${lobby.name}\n` +
                 `🔥 МОД: ${mode.toUpperCase()}\n` +
                 `👾 В ЛОББИ: ${count}/${maxPlayers} чел.\n` +
                 `⏰ СТАРТ: ${timeStr}\n\n` +
                 `👉 Ждем тебя в пати! Жми!`;

    // 5. Собираем итоговый URL
    const appLink = `https://t.me/oneSitePlsBot/app?startapp=lobby_${lobbyId}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(appLink)}&text=${encodeURIComponent(text)}`;

    return { success: true, shareUrl };

  } catch (error: any) {
    logger.error("generateLobbyShareLink Error", error);
    return { success: false, error: error.message };
  }
}