"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import path from 'path'; 
import fs from 'fs';   
import { sendTelegramDocument } from "@/app/actions"; 

const pdfLibModule = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');
const { PDFDocument, rgb } = pdfLibModule;

export async function generateAndSendLobbyPdf(userId: string, lobbyId: string) {
  try {
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("*").eq("id", lobbyId).single();
    const { data: rawMembers } = await supabaseAdmin.from("lobby_members").select("*").eq("lobby_id", lobbyId);
    const { data: checkpoints } = await supabaseAdmin.from("lobby_checkpoints").select("*").eq("lobby_id", lobbyId);
    
    if (!lobby) throw new Error("Lobby not found");

    const userIds = rawMembers?.map((m: any) => m.user_id).filter((id: string) => id && id.length > 10) || [];
    const { data: users } = await supabaseAdmin.from("users").select("user_id, username, full_name").in("user_id", userIds);
    
    const userMap = new Map();
    users?.forEach((u: any) => userMap.set(u.user_id, u));

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkitModule);

    const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes); 
    
    const page = pdfDoc.addPage([595.28, 841.89]); 
    const { width, height } = page.getSize();
    
    const COLOR_BG = rgb(0.97, 0.97, 0.97);
    const COLOR_DARK = rgb(0.1, 0.1, 0.1);
    const COLOR_RED = rgb(0.7, 0.1, 0.1);
    const COLOR_BLUE = rgb(0.1, 0.2, 0.6);
    const COLOR_GREY = rgb(0.5, 0.5, 0.5);

    // Grid & Header (Same as before)
    page.drawRectangle({ x: 0, y: 0, width, height, color: COLOR_BG });
    for (let i = 0; i < width; i += 40) page.drawLine({ start: { x: i, y: 0 }, end: { x: i, y: height }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    for (let i = 0; i < height; i += 40) page.drawLine({ start: { x: 0, y: i }, end: { x: width, y: i }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });

    const headerHeight = 80;
    page.drawRectangle({ x: 0, y: height - headerHeight, width, height: headerHeight, color: COLOR_DARK });
    page.drawText("TACTICAL OPERATIONS // BRIEFING", { x: 40, y: height - 50, size: 24, font: customFont, color: rgb(1, 1, 1) });
    page.drawText(`REF_ID: ${lobby.id.split('-')[0].toUpperCase()}`, { x: width - 150, y: height - 50, size: 10, font: customFont, color: COLOR_RED });

    let y = height - 120;
    
    // Main Join QR
    let qrImage;
    try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://t.me/oneSitePlsBot/app?startapp=lobby_${lobby.id}`;
        const qrBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
        qrImage = await pdfDoc.embedPng(qrBytes);
    } catch (e) { logger.error("QR Gen failed", e); }

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

    // --- TEAMS ---
    const colWidth = (width - 100) / 2;
    const blueX = 40;
    const redX = 40 + colWidth + 20;
    const members = rawMembers?.map((m: any) => { const u = userMap.get(m.user_id); const name = m.is_bot ? `BOT-${m.id.split('-')[0].toUpperCase()}` : (u?.username ? `@${u.username}` : 'OPERATOR'); return { ...m, name }; }) || [];
    const blueTeam = members.filter((m: any) => m.team === 'blue');
    const redTeam = members.filter((m: any) => m.team === 'red');

    page.drawRectangle({ x: blueX, y: y, width: colWidth, height: 30, color: COLOR_BLUE });
    page.drawText(`BLUE SQUAD [${blueTeam.length}]`, { x: blueX + 10, y: y + 8, size: 14, font: customFont, color: rgb(1,1,1) });
    page.drawRectangle({ x: redX, y: y, width: colWidth, height: 30, color: COLOR_RED });
    page.drawText(`RED SQUAD [${redTeam.length}]`, { x: redX + 10, y: y + 8, size: 14, font: customFont, color: rgb(1,1,1) });

    y -= 10;
    let blueY = y; let redY = y;

    blueTeam.forEach((m: any, i: number) => { blueY -= 25; if (i % 2 === 0) page.drawRectangle({ x: blueX, y: blueY - 5, width: colWidth, height: 25, color: rgb(0.95, 0.95, 1) }); page.drawText(`${i + 1}. ${m.name}`, { x: blueX + 10, y: blueY, size: 10, font: customFont, color: COLOR_DARK }); });
    redTeam.forEach((m: any, i: number) => { redY -= 25; if (i % 2 === 0) page.drawRectangle({ x: redX, y: redY - 5, width: colWidth, height: 25, color: rgb(1, 0.95, 0.95) }); page.drawText(`${i + 1}. ${m.name}`, { x: redX + 10, y: redY, size: 10, font: customFont, color: COLOR_DARK }); });

    // --- BASE RESPAWN / HQ CODES ---
    // These are the "Ancient" QRs. Friendly = Respawn, Enemy = Win.
    const hqY = Math.min(blueY, redY) - 60;
    
    // Blue HQ
    try {
        const qrData = `respawn_${lobby.id}_blue`; 
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
        const qrBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
        const qrImg = await pdfDoc.embedPng(qrBytes);
        
        page.drawRectangle({ x: blueX, y: hqY, width: 100, height: 100, borderColor: COLOR_BLUE, borderWidth: 3 });
        page.drawImage(qrImg, { x: blueX + 5, y: hqY + 5, width: 90, height: 90 });
        page.drawText("BLUE BASE / HQ", { x: blueX, y: hqY - 15, size: 10, font: customFont, color: COLOR_BLUE });
        page.drawText("SCAN TO RESPAWN", { x: blueX, y: hqY - 25, size: 8, font: customFont, color: COLOR_GREY });
    } catch(e) {}

    // Red HQ
    try {
        const qrData = `respawn_${lobby.id}_red`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
        const qrBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
        const qrImg = await pdfDoc.embedPng(qrBytes);
        
        page.drawRectangle({ x: redX, y: hqY, width: 100, height: 100, borderColor: COLOR_RED, borderWidth: 3 });
        page.drawImage(qrImg, { x: redX + 5, y: hqY + 5, width: 90, height: 90 });
        page.drawText("RED BASE / HQ", { x: redX, y: hqY - 15, size: 10, font: customFont, color: COLOR_RED });
        page.drawText("SCAN TO RESPAWN", { x: redX, y: hqY - 25, size: 8, font: customFont, color: COLOR_GREY });
    } catch(e) {}
    
    y = hqY - 60;

    // --- CHECKPOINT QR CODES (Tactical) ---
    if (checkpoints && checkpoints.length > 0) {
        if (y < 200) { page = pdfDoc.addPage([595.28, 841.89]); y = height - 50; }

        page.drawText("TACTICAL CHECKPOINTS (CAPTURE POINTS)", { x: 40, y: y, size: 12, font: customFont, color: COLOR_DARK });
        page.drawLine({ start: { x: 40, y: y - 5 }, end: { x: width - 40, y: y - 5 }, thickness: 2, color: COLOR_RED });
        y -= 30;

        let qrX = 40;
        const qrSize = 90;
        const gap = 20;

        for (const cp of checkpoints) {
            if (qrX + qrSize > width - 40) { qrX = 40; y -= (qrSize + 40); if (y < 50) { page = pdfDoc.addPage([595.28, 841.89]); y = height - 50; } }

            try {
                const qrData = `capture_${cp.id}`; 
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
                const qrBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
                const qrImg = await pdfDoc.embedPng(qrBytes);

                page.drawImage(qrImg, { x: qrX, y: y - qrSize, width: qrSize, height: qrSize });
                page.drawRectangle({ x: qrX, y: y - qrSize, width: qrSize, height: qrSize, borderColor: COLOR_DARK, borderWidth: 1 });
                page.drawText(cp.name.substring(0, 15), { x: qrX, y: y - qrSize - 12, size: 9, font: customFont, color: COLOR_DARK });
                
                qrX += qrSize + gap;
            } catch(e) {}
        }
    }

    // Save
    const pdfBytes = await pdfDoc.save();
    const fileName = `INTEL_${lobby.name.replace(/\s+/g, '_').toUpperCase()}.pdf`;
    const fileBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const sendRes = await sendTelegramDocument(userId, fileBlob, fileName, "📄 **TACTICAL DOSSIER**");
    if (!sendRes.success) throw new Error(sendRes.error);

    return { success: true, message: "PDF Sent" };
  } catch (error: any) {
    logger.error("generateAndSendLobbyPdf Error", error);
    return { success: false, error: error.message };
  }
}