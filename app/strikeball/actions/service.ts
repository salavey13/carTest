"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import path from 'path'; 
import fs from 'fs';   
import { sendTelegramDocument } from "@/app/actions"; 

const pdfLibModule = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');
const { PDFDocument, rgb } = pdfLibModule;

/**
 * Generates a Tactical Briefing PDF for the lobby and sends it to the user via Telegram.
 * FIX: Decoupled User join to ensure bots and members always load.
 */
export async function generateAndSendLobbyPdf(userId: string, lobbyId: string) {
  try {
    // 1. Fetch Lobby
    const { data: lobby, error: lobbyError } = await supabaseAdmin
        .from("lobbies")
        .select("*")
        .eq("id", lobbyId)
        .single();

    if (lobbyError || !lobby) throw new Error("Lobby not found");

    // 2. Fetch Members (Raw, no Join yet to prevent FK issues with bots)
    const { data: rawMembers, error: membersError } = await supabaseAdmin
        .from("lobby_members")
        .select("*")
        .eq("lobby_id", lobbyId);

    if (membersError) throw new Error("Failed to fetch members");

    // 3. Resolve Human Names manually
    // Filter out bots to get real user IDs
    const humanIds = rawMembers
        ?.filter((m: any) => !m.is_bot && m.user_id)
        .map((m: any) => m.user_id) || [];

    let userMap: Record<string, any> = {};
    
    if (humanIds.length > 0) {
        const { data: users } = await supabaseAdmin
            .from("users")
            .select("user_id, username, full_name")
            .in("user_id", humanIds);
        
        users?.forEach((u: any) => {
            userMap[u.user_id] = u;
        });
    }

    // 4. Merge Data
    const members = rawMembers?.map((m: any) => {
        const user = userMap[m.user_id];
        return {
            ...m,
            displayName: m.is_bot 
                ? `[БОТ] T-${m.id.split('-')[0].toUpperCase()}` 
                : (user?.username ? `@${user.username}` : (user?.full_name || 'Неизвестный'))
        };
    }) || [];

    // --- PDF GENERATION ---
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkitModule);

    let customFont;
    try {
        const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
        if (fs.existsSync(fontPath)) {
            const fontBytes = fs.readFileSync(fontPath);
            customFont = await pdfDoc.embedFont(fontBytes);
        } else {
            logger.warn("Cyrillic font not found, falling back to Standard.");
            customFont = await pdfDoc.embedFont(pdfLibModule.StandardFonts.Helvetica);
        }
    } catch (e) {
        customFont = await pdfDoc.embedFont(pdfLibModule.StandardFonts.Helvetica);
    }

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    let y = height - 50;
    const fontSize = 10; // Smaller font to fit more

    const drawText = (text: string, size: number = fontSize, color = rgb(0, 0, 0)) => {
        // Fallback for non-cyrillic font environment
        const safeText = customFont.name === 'Helvetica' ? text.replace(/[а-яА-ЯёЁ]/g, '?') : text;
        page.drawText(safeText, { x: 50, y, size, font: customFont, color });
        y -= (size + 5);
    };

    // Header
    drawText(`ОПЕРАТИВНАЯ СВОДКА / TACTICAL REPORT`, 16, rgb(0.7, 0, 0));
    y -= 10;
    drawText(`ОПЕРАЦИЯ: ${lobby.name}`, 12);
    drawText(`РЕЖИМ: ${lobby.mode?.toUpperCase()}`, 10);
    drawText(`ID: ${lobby.id.slice(0, 8)}`, 10);
    drawText(`ВРЕМЯ: ${lobby.start_at ? new Date(lobby.start_at).toLocaleString('ru-RU') : 'ПО ГОТОВНОСТИ'}`, 10);
    
    if (lobby.field_id) {
        drawText(`КООРДИНАТЫ: ${lobby.field_id}`, 10);
    }
    
    y -= 15;

    // Insert QR Code for Joining
    try {
        // Safe deep link
        const qrData = `https://t.me/oneSitePlsBot/app?startapp=lobby_${lobby.id}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
        const qrArrayBuffer = await fetch(qrUrl).then(res => res.arrayBuffer());
        const qrImage = await pdfDoc.embedPng(qrArrayBuffer);
        
        page.drawImage(qrImage, {
            x: width - 130,
            y: height - 130,
            width: 80,
            height: 80
        });
        
        // Add label under QR
        page.drawText("SCAN TO JOIN", {
            x: width - 130, 
            y: height - 145, 
            size: 8, 
            font: customFont, 
            color: rgb(0.5, 0.5, 0.5)
        });
    } catch (qrError) {
        logger.error("QR Gen Error", qrError);
    }

    // Teams Logic (Case-insensitive check)
    const blueTeam = members.filter((m: any) => m.team?.toLowerCase() === 'blue');
    const redTeam = members.filter((m: any) => m.team?.toLowerCase() === 'red');

    // Blue Team Table
    drawText(`--- СИНИЕ (BLUE) [${blueTeam.length}] ---`, 12, rgb(0, 0, 0.6));
    blueTeam.forEach((m: any, i: number) => {
        drawText(`${i + 1}. ${m.displayName} (${m.status})`);
        // If driver info exists in metadata
        if (m.metadata?.transport?.role === 'driver') {
             drawText(`   [ВОДИТЕЛЬ: ${m.metadata.transport.car_name} | Мест: ${m.metadata.transport.seats}]`, 8, rgb(0.3, 0.3, 0.3));
        }
    });

    y -= 15;

    // Red Team Table
    drawText(`--- КРАСНЫЕ (RED) [${redTeam.length}] ---`, 12, rgb(0.6, 0, 0));
    redTeam.forEach((m: any, i: number) => {
        drawText(`${i + 1}. ${m.displayName} (${m.status})`);
        if (m.metadata?.transport?.role === 'driver') {
             drawText(`   [ВОДИТЕЛЬ: ${m.metadata.transport.car_name} | Мест: ${m.metadata.transport.seats}]`, 8, rgb(0.3, 0.3, 0.3));
        }
    });

    y -= 30;

    // Instructions
    drawText(`ИНСТРУКЦИИ:`, 10, rgb(0.4, 0.4, 0.4));
    drawText(`1. Сканируйте QR для входа в лобби.`, 8);
    drawText(`2. Используйте кнопку "Я УБИТ" в приложении для статуса.`, 8);
    drawText(`3. Соблюдайте правила страйкбола.`, 8);

    // Save & Send
    const pdfBytes = await pdfDoc.save();
    const fileName = `BRIEFING_${lobby.id.slice(0,6)}.pdf`;
    const fileBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    const sendRes = await sendTelegramDocument(userId, fileBlob, fileName, "🖨️ **Файл готов к печати**");

    if (!sendRes.success) throw new Error(sendRes.error);

    return { success: true, message: "PDF отправлен!" };

  } catch (error: any) {
    logger.error("generateAndSendLobbyPdf Error", error);
    return { success: false, error: error.message };
  }
}