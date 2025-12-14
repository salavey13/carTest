"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import path from 'path'; 
import fs from 'fs';   
import { sendTelegramDocument } from "@/app/topdf/actions"; // Reuse existing helper

const pdfLibModule = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, StandardFonts } = pdfLibModule;

/**
 * Generates a Tactical Briefing PDF for the lobby and sends it to the user via Telegram.
 */
export async function generateAndSendLobbyPdf(userId: string, lobbyId: string) {
  try {
    // 1. Fetch Data
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("*").eq("id", lobbyId).single();
    const { data: members } = await supabaseAdmin.from("lobby_members").select("*, user:users(username, full_name)").eq("lobby_id", lobbyId);

    if (!lobby) throw new Error("Lobby not found");

    // 2. Initialize PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkitModule);

    // 3. Load Fonts (Cyrillic Support)
    const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes);
    
    // 4. Create Page
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    let y = height - 50;
    const fontSize = 12;
    const lineHeight = 16;

    // Helper to draw text
    const drawText = (text: string, size: number = fontSize, color = rgb(0, 0, 0)) => {
        page.drawText(text, { x: 50, y, size, font: customFont, color });
        y -= (size + 5);
    };

    // 5. Draw Header
    drawText(`ОПЕРАТИВНАЯ СВОДКА`, 20, rgb(0.8, 0, 0));
    y -= 10;
    drawText(`ОПЕРАЦИЯ: ${lobby.name}`, 14);
    drawText(`РЕЖИМ: ${lobby.mode.toUpperCase()}`);
    drawText(`ДАТА/ВРЕМЯ: ${lobby.start_at ? new Date(lobby.start_at).toLocaleString('ru-RU') : 'ПО ГОТОВНОСТИ'}`);
    drawText(`КООРДИНАТЫ: ${lobby.field_id || 'НЕ УКАЗАНЫ'}`);
    y -= 20;

    // 6. Draw QR Code (Lobby Link)
    try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://t.me/oneSitePlsBot/app?startapp=lobby_${lobby.id}`;
        const qrImageBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
        const qrImage = await pdfDoc.embedPng(qrImageBytes);
        const qrSize = 100;
        
        page.drawImage(qrImage, {
            x: width - 50 - qrSize,
            y: height - 50 - qrSize,
            width: qrSize,
            height: qrSize
        });
        
        page.drawText("СКАНИРУЙ ДЛЯ ВХОДА", {
            x: width - 160,
            y: height - 60 - qrSize,
            size: 8,
            font: customFont,
            color: rgb(0.5, 0.5, 0.5)
        });
    } catch (qrErr) {
        logger.error("Failed to embed QR", qrErr);
    }

    // 7. Draw Rosters
    const blueTeam = members?.filter((m: any) => m.team === 'blue') || [];
    const redTeam = members?.filter((m: any) => m.team === 'red') || [];

    drawText(`--- СОСТАВ СИНИХ (${blueTeam.length}) ---`, 14, rgb(0, 0, 0.8));
    blueTeam.forEach((m: any, i: number) => {
        const name = m.is_bot ? `[BOT] ${m.id.slice(0,4)}` : (m.user?.username ? `@${m.user.username}` : 'Боец');
        drawText(`${i + 1}. ${name} [${m.status}]`);
    });

    y -= 20;

    drawText(`--- СОСТАВ КРАСНЫХ (${redTeam.length}) ---`, 14, rgb(0.8, 0, 0));
    redTeam.forEach((m: any, i: number) => {
        const name = m.is_bot ? `[BOT] ${m.id.slice(0,4)}` : (m.user?.username ? `@${m.user.username}` : 'Боец');
        drawText(`${i + 1}. ${name} [${m.status}]`);
    });

    y -= 40;
    
    // 8. Footer / Safety Info
    drawText(`ИНСТРУКТАЖ ПО ТЕХНИКЕ БЕЗОПАСНОСТИ:`, 10, rgb(0.3, 0.3, 0.3));
    drawText(`1. Защита глаз обязательна в игровой зоне.`, 10);
    drawText(`2. "Убит" - поднять руку/красную тряпку.`, 10);
    drawText(`3. Не спорить. Решение маршала окончательное.`, 10);

    // 9. Save & Send
    const pdfBytes = await pdfDoc.save();
    const fileName = `INTEL_${lobby.name.replace(/\s+/g, '_')}.pdf`;
    
    // We reuse the existing generic Telegram document sender
    // NOTE: using 'blob' might require conversion depending on environment, 
    // but the `sendTelegramDocument` expects a Blob-like object in FormData.
    const fileBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    const sendRes = await sendTelegramDocument(userId, fileBlob, fileName, "📄 **ОПЕРАТИВНАЯ СВОДКА ГОТОВА**");
    
    if (!sendRes.success) throw new Error(sendRes.error);

    return { success: true, message: "PDF отправлен в Telegram" };

  } catch (error: any) {
    logger.error("generateAndSendLobbyPdf Error", error);
    return { success: false, error: error.message };
  }
}