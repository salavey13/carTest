"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { sendTelegramDocument } from "@/app/actions"; // Using core action
import path from 'path'; 
import fs from 'fs';   

const pdfLibModule = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, StandardFonts } = pdfLibModule;

export async function generateAndSendLobbyPdf(userId: string, lobbyId: string) {
  try {
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("*").eq("id", lobbyId).single();
    const { data: members } = await supabaseAdmin.from("lobby_members").select("*, user:users(username, full_name)").eq("lobby_id", lobbyId);

    if (!lobby) throw new Error("Lobby not found");

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkitModule);

    // Try to load Cyrillic font, fallback to Helvetica (which breaks cyrillic, but prevents crash)
    let customFont;
    try {
        const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
        if (fs.existsSync(fontPath)) {
            const fontBytes = fs.readFileSync(fontPath);
            customFont = await pdfDoc.embedFont(fontBytes);
        } else {
            customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            logger.warn("Cyrillic font not found, falling back to Helvetica");
        }
    } catch (e) {
        customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    let y = height - 50;

    const drawLine = (text: string, size = 12, color = rgb(0,0,0)) => {
        // Basic transliteration if font is standard (hacky fallback)
        const safeText = customFont.name === 'Helvetica' ? text.replace(/[а-яА-ЯёЁ]/g, '?') : text;
        page.drawText(safeText, { x: 50, y, size, font: customFont, color });
        y -= (size + 5);
    };

    drawLine(`ОПЕРАТИВНАЯ СВОДКА / OP REPORT`, 18, rgb(0.8, 0, 0));
    y -= 10;
    drawLine(`ID: ${lobby.id}`, 10);
    drawLine(`NAME: ${lobby.name}`, 14);
    drawLine(`MODE: ${lobby.mode?.toUpperCase()}`, 12);
    drawLine(`GPS: ${lobby.field_id || "N/A"}`, 12);
    y -= 20;

    // Drivers
    const drivers = members?.filter((m: any) => m.metadata?.transport?.role === 'driver') || [];
    if (drivers.length > 0) {
        drawLine(`ТРАНСПОРТ / LOGISTICS (${drivers.length})`, 14, rgb(0, 0.5, 0));
        drivers.forEach((d: any) => {
            const seats = d.metadata.transport.seats;
            const car = d.metadata.transport.car_name;
            const name = d.user?.username || "Unknown";
            drawLine(`[DRIVER] @${name} - ${car} (${seats} seats)`);
        });
        y -= 20;
    }

    // Rosters
    const blue = members?.filter((m: any) => m.team === 'blue') || [];
    const red = members?.filter((m: any) => m.team === 'red') || [];

    drawLine(`BLUE TEAM (${blue.length})`, 14, rgb(0, 0, 0.8));
    blue.forEach((m: any) => drawLine(`- ${m.user?.username || 'Bot'} [${m.status}]`));
    y -= 20;

    drawLine(`RED TEAM (${red.length})`, 14, rgb(0.8, 0, 0));
    red.forEach((m: any) => drawLine(`- ${m.user?.username || 'Bot'} [${m.status}]`));

    // Generate QR
    try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://t.me/oneSitePlsBot/app?startapp=lobby_${lobby.id}`;
        const qrImg = await fetch(qrUrl).then(r => r.arrayBuffer());
        const qrImage = await pdfDoc.embedPng(qrImg);
        page.drawImage(qrImage, { x: width - 150, y: height - 150, width: 100, height: 100 });
    } catch (e) { /* ignore */ }

    const pdfBytes = await pdfDoc.save();
    const fileName = `INTEL_${lobby.id.slice(0,6)}.pdf`;
    const fileBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    const res = await sendTelegramDocument(userId, fileBlob, fileName, "📄 BRIEFING DOC");
    if (!res.success) throw new Error(res.error);

    return { success: true, message: "Sent to Telegram" };

  } catch (e: any) {
    logger.error("PDF Gen Error", e);
    return { success: false, error: e.message };
  }
}