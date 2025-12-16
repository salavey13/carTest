"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import path from 'path'; 
import fs from 'fs';   
import { sendTelegramDocument } from "@/app/actions"; 

const pdfLibModule = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, grayscale } = pdfLibModule;

/**
 * Generates a "Stylish as F*ck" Tactical Briefing PDF.
 */
export async function generateAndSendLobbyPdf(userId: string, lobbyId: string) {
  try {
    // 1. Fetch Data
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("*").eq("id", lobbyId).single();
    
    // We need members linked to users to get names
    // NOTE: If your DB schema for lobby_members doesn't have a direct FK to users that Supabase detects automatically,
    // you might need to fetch users manually. Assuming your previous setup worked or we fetch raw and map.
    const { data: rawMembers } = await supabaseAdmin.from("lobby_members").select("*").eq("lobby_id", lobbyId);
    
    if (!lobby) throw new Error("Lobby not found");

    // Manual User Fetch to ensure names appear even if FK is loose
    const userIds = rawMembers?.map((m: any) => m.user_id).filter((id: string) => id && id.length > 10) || [];
    const { data: users } = await supabaseAdmin.from("users").select("user_id, username, full_name").in("user_id", userIds);
    
    const userMap = new Map();
    users?.forEach((u: any) => userMap.set(u.user_id, u));

    // 2. Initialize PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkitModule);

    // 3. Load Fonts
    const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes); // Regular
    
    // 4. Setup Page (A4)
    const page = pdfDoc.addPage([595.28, 841.89]); 
    const { width, height } = page.getSize();
    
    // --- COLORS ---
    const COLOR_BG = rgb(0.97, 0.97, 0.97);
    const COLOR_DARK = rgb(0.1, 0.1, 0.1);
    const COLOR_RED = rgb(0.7, 0.1, 0.1);
    const COLOR_BLUE = rgb(0.1, 0.2, 0.6);
    const COLOR_GREY = rgb(0.5, 0.5, 0.5);
    const COLOR_LIGHT_GREY = rgb(0.9, 0.9, 0.9);

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
    
    // QR Code Generation
    let qrImage;
    try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://t.me/oneSitePlsBot/app?startapp=lobby_${lobby.id}`;
        const qrBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
        qrImage = await pdfDoc.embedPng(qrBytes);
    } catch (e) { logger.error("QR Gen failed", e); }

    // Info Box
    page.drawRectangle({ x: 40, y: y - 100, width: width - 80, height: 100, color: rgb(1, 1, 1), borderColor: COLOR_DARK, borderWidth: 2 });
    
    // Text inside Info Box
    const startX = 60;
    let infoY = y - 30;
    
    const drawLabelValue = (label: string, value: string, xPos: number, yPos: number, colorVal = COLOR_DARK) => {
        page.drawText(label, { x: xPos, y: yPos, size: 8, font: customFont, color: COLOR_GREY });
        page.drawText(value, { x: xPos, y: yPos - 14, size: 12, font: customFont, color: colorVal });
    };

    drawLabelValue("ОПЕРАЦИЯ / OPERATION", lobby.name, startX, infoY);
    drawLabelValue("РЕЖИМ / MODE", lobby.mode?.toUpperCase() || "TDM", startX + 200, infoY);
    
    infoY -= 40;
    const timeStr = lobby.start_at ? new Date(lobby.start_at).toLocaleString('ru-RU') : "ПО ГОТОВНОСТИ";
    drawLabelValue("ВРЕМЯ СБОРА / T-MINUS", timeStr, startX, infoY);
    drawLabelValue("ЛОКАЦИЯ / GPS", lobby.field_id || "НЕ УКАЗАНЫ", startX + 200, infoY);

    // Place QR Code inside the box (Right side)
    if (qrImage) {
        page.drawImage(qrImage, { x: width - 130, y: y - 90, width: 80, height: 80 });
        page.drawRectangle({ x: width - 130, y: y - 90, width: 80, height: 80, borderColor: COLOR_RED, borderWidth: 1 });
    }

    y -= 140;

    // --- TEAMS LAYOUT ---
    const colWidth = (width - 100) / 2;
    const blueX = 40;
    const redX = 40 + colWidth + 20;
    
    // Sort members
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

    // Draw Lists
    let blueY = y;
    let redY = y;

    // Render Blue
    blueTeam.forEach((m: any, i: number) => {
        blueY -= 25;
        // Zebra striping
        if (i % 2 === 0) page.drawRectangle({ x: blueX, y: blueY - 5, width: colWidth, height: 25, color: rgb(0.95, 0.95, 1) });
        
        page.drawText(`${i + 1}. ${m.name}`, { x: blueX + 10, y: blueY, size: 10, font: customFont, color: COLOR_DARK });
        
        // Status indicator
        const statusColor = m.status === 'alive' ? rgb(0, 0.6, 0) : rgb(0.6, 0, 0);
        page.drawCircle({ x: blueX + colWidth - 20, y: blueY + 4, size: 4, color: statusColor });
        
        // Driver badge
        if (m.metadata?.transport?.role === 'driver') {
            page.drawText(`[CAR: ${m.metadata.transport.seats}]`, { x: blueX + 10, y: blueY - 8, size: 6, font: customFont, color: COLOR_GREY });
        }
    });

    // Render Red
    redTeam.forEach((m: any, i: number) => {
        redY -= 25;
        if (i % 2 === 0) page.drawRectangle({ x: redX, y: redY - 5, width: colWidth, height: 25, color: rgb(1, 0.95, 0.95) });
        
        page.drawText(`${i + 1}. ${m.name}`, { x: redX + 10, y: redY, size: 10, font: customFont, color: COLOR_DARK });
        
        const statusColor = m.status === 'alive' ? rgb(0, 0.6, 0) : rgb(0.6, 0, 0);
        page.drawCircle({ x: redX + colWidth - 20, y: redY + 4, size: 4, color: statusColor });

        if (m.metadata?.transport?.role === 'driver') {
            page.drawText(`[CAR: ${m.metadata.transport.seats}]`, { x: redX + 10, y: redY - 8, size: 6, font: customFont, color: COLOR_GREY });
        }
    });

    // --- FOOTER WARNING ---
    const bottomY = 50;
    page.drawLine({ start: { x: 40, y: bottomY + 20 }, end: { x: width - 40, y: bottomY + 20 }, thickness: 2, color: COLOR_RED });
    
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

    // 9. Save & Send
    const pdfBytes = await pdfDoc.save();
    const fileName = `INTEL_${lobby.name.replace(/\s+/g, '_').toUpperCase()}_${new Date().getTime().toString().slice(-4)}.pdf`;
    
    const fileBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    // Reuse generic sender
    const sendRes = await sendTelegramDocument(userId, fileBlob, fileName, "📄 **TACTICAL DOSSIER**");
    
    if (!sendRes.success) throw new Error(sendRes.error);

    return { success: true, message: "PDF Dossier transmitted." };

  } catch (error: any) {
    logger.error("generateAndSendLobbyPdf Error", error);
    return { success: false, error: error.message };
  }
}

/**
 * Generates a Printable Gear Catalog (Stickers)
 * Layout: Grid of QR Codes + Item Name + Price.
 */
export async function generateGearCatalogPdf(userId: string) {
  try {
    // 1. Fetch Gear
    const { data: gear } = await supabaseAdmin
      .from("cars")
      .select("*")
      .in("type", ["gear", "weapon", "consumable"]);
      
    if (!gear || gear.length === 0) throw new Error("No gear found in armory.");

    // 2. Initialize PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkitModule);

    // 3. Load Fonts
    const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes);

    // 4. Setup Grid (A4)
    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    
    const MARGIN = 30;
    const COLS = 2;
    const ROWS = 3;
    const CELL_WIDTH = (width - MARGIN * 2) / COLS;
    const CELL_HEIGHT = (height - MARGIN * 2) / ROWS;

    let col = 0;
    let row = 0;

    for (const item of gear) {
        // Calculate position
        const x = MARGIN + col * CELL_WIDTH;
        const y = height - MARGIN - (row + 1) * CELL_HEIGHT;

        // Draw Card Border
        page.drawRectangle({
            x: x + 10, y: y + 10, 
            width: CELL_WIDTH - 20, height: CELL_HEIGHT - 20,
            borderColor: rgb(0, 0, 0), borderWidth: 2
        });

        // Generate QR
        try {
            const qrData = `gear_buy_${item.id}`; // Matches webhook handler
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
            const qrBytes = await fetch(qrUrl).then(res => res.arrayBuffer());
            const qrImage = await pdfDoc.embedPng(qrBytes);
            
            // Draw QR centered
            const qrSize = 120;
            page.drawImage(qrImage, {
                x: x + (CELL_WIDTH - qrSize) / 2,
                y: y + 80,
                width: qrSize,
                height: qrSize
            });
        } catch (e) {
            console.error("QR Gen Error", e);
        }

        // Draw Text
        const textY = y + 60;
        
        // Name
        const name = item.model.length > 20 ? item.model.substring(0, 20) + '...' : item.model;
        page.drawText(item.make, { x: x + 20, y: textY, size: 10, font: customFont, color: rgb(0.5, 0.5, 0.5) });
        page.drawText(name, { x: x + 20, y: textY - 15, size: 14, font: customFont, color: rgb(0, 0, 0) });
        
        // Price
        page.drawText(`${item.daily_price} XTR`, { x: x + 20, y: textY - 35, size: 18, font: customFont, color: rgb(0.8, 0, 0) });
        
        // Footer ID
        page.drawText(`ID: ${item.id}`, { x: x + 20, y: y + 20, size: 8, font: customFont, color: rgb(0.7, 0.7, 0.7) });

        // Move Grid
        col++;
        if (col >= COLS) {
            col = 0;
            row++;
            if (row >= ROWS) {
                page = pdfDoc.addPage([595.28, 841.89]);
                row = 0;
            }
        }
    }

    // 5. Send
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